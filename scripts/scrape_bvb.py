from curl_cffi import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime
import os

# -------------------------------
# Config
# -------------------------------
URL = "https://www.bvb.ro/FinancialInstruments/Indices/IndicesProfiles.aspx?i=BET"
OUTPUT_DIR = "input/bvb_distribution"

# -------------------------------
# Fetch the page
# -------------------------------
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}
response = requests.get(URL, headers=headers)
response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")
table = soup.find("table", {"id": "gvC"})

if not table:
    raise Exception("Could not find table gvC in page. Site layout may have changed.")

# -------------------------------
# Parse rows
# -------------------------------
rows = table.find_all("tr")[1:]  # skip header
data = []
for row in rows:
    cols = [c.get_text(strip=True) for c in row.find_all("td")]
    if len(cols) >= 2:
        symbol = cols[0]
        weight = cols[-1].replace(",", ".")
        try:
            weight = float(weight)
        except ValueError:
            continue
        data.append({"symbol": symbol, "weight": weight})

# -------------------------------
# Save CSVs
# -------------------------------
df = pd.DataFrame(data)
today = datetime.today().strftime("%Y-%m-%d")

os.makedirs(OUTPUT_DIR, exist_ok=True)
file_daily = os.path.join(OUTPUT_DIR, f"bvb-companies-{today}.csv")
file_latest = os.path.join(OUTPUT_DIR, "bvb-companies-latest.csv")

df.to_csv(file_daily, index=False)
df.to_csv(file_latest, index=False)

print(f"Saved {len(data)} rows to {file_daily} and updated latest copy as {file_latest}")
