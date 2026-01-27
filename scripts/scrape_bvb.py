from curl_cffi import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime
import os
import sys

URL = "https://www.bvb.ro/FinancialInstruments/Indices/IndicesProfiles.aspx?i=BET"
OUTPUT_DIR = "input/bvb_distribution"

headers = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}


def parse_ro_number(text: str) -> float:
    # "1.138.407,70" -> 1138407.70
    t = text.strip().replace(".", "").replace(",", ".")
    return float(t)


def find_weights_table(soup: BeautifulSoup):
    # 1) current known id in your HTML: gvTD
    table = soup.find("table", {"id": "gvTD"})
    if table:
        return table

    # 2) fallback: find a table that has "Pondere (%)" in header
    for t in soup.find_all("table"):
        thead = t.find("thead")
        if not thead:
            continue
        header_text = thead.get_text(" ", strip=True)
        if "Pondere" in header_text and "%" in header_text:
            return t

    return None


def save_csv(df: pd.DataFrame):
    today = datetime.today().strftime("%Y-%m-%d")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    file_daily = os.path.join(OUTPUT_DIR, f"bvb-companies-{today}.csv")
    file_latest = os.path.join(OUTPUT_DIR, "bvb-companies-latest.csv")
    df.to_csv(file_daily, index=False)
    df.to_csv(file_latest, index=False)
    print(f"Saved {len(df)} rows to {file_daily} and updated latest copy as {file_latest}")


def main():
    response = requests.get(URL, headers=headers, timeout=60)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    table = find_weights_table(soup)

    if not table:
        print("WARNING: Could not find weights table (gvTD / Pondere header). Keeping previous latest CSV.")
        # Exit 0 so pipeline doesn't fail; you still have previous bvb-companies-latest.csv in repo
        return 0

    # Build header list so we can locate the "Simbol" and "Pondere (%)" columns robustly
    header_cells = table.find("thead").find_all("th") if table.find("thead") else []
    headers_text = [h.get_text(" ", strip=True) for h in header_cells]

    # Default: symbol is first col, weight is last col (matches current page)
    symbol_idx = 0
    weight_idx = -1

    # If headers exist, locate indices by name
    if headers_text:
        for i, h in enumerate(headers_text):
            if h.lower().startswith("simbol"):
                symbol_idx = i
            if "pondere" in h.lower():
                weight_idx = i

    body = table.find("tbody")
    if not body:
        print("WARNING: Table found but no <tbody>. Keeping previous latest CSV.")
        return 0

    data = []
    for row in body.find_all("tr"):
        cols = row.find_all(["td", "th"])
        if len(cols) <= max(symbol_idx, weight_idx if weight_idx >= 0 else 0):
            continue

        symbol = cols[symbol_idx].get_text(" ", strip=True)
        weight_raw = cols[weight_idx].get_text(" ", strip=True)

        if not symbol or not weight_raw:
            continue

        try:
            weight = parse_ro_number(weight_raw)
        except ValueError:
            continue

        data.append({"symbol": symbol, "weight": weight})

    df = pd.DataFrame(data)

    # sanity check: BET should have ~20 constituents; accept >=10 to be safe
    if df.empty or len(df) < 10:
        print(f"WARNING: Parsed only {len(df)} rows. Keeping previous latest CSV.")
        return 0

    save_csv(df)
    return 0


if __name__ == "__main__":
    sys.exit(main())
