# BVB Index Distribution / Portfolio Tracker

Live app: https://dragosgeornoiu.github.io/bvb-index-distribution/

A small GitHub Pages tool that compares a personal BVB portfolio to the BET index distribution and suggests how to invest available cash to move the portfolio closer to the index (buy-only, no selling).

---

## Why this exists

I wanted a quick way to:
- track how close my portfolio weights are to BET
- understand which holdings are overweight/underweight versus the index
- split available cash into buy orders that keep the portfolio closer to BET over time

---

## Features

### 1) Portfolio comparison vs BET
- Loads the latest BET constituent weights from a CSV.
- Normalizes weights to 100% for the chosen universe.
- Displays differences both as:
    - percentage difference
    - value difference (based on current portfolio value)

### 2) New investment suggestions (buy-only)
When “Enable New Investment” is ON, the app:
- uses your available cash as the maximum budget
- suggests allocations across underweighted holdings
- respects a “minimum investment per stock”
- rounds down to lots of 50 so the total allocation never exceeds available cash
- shows unallocated cash if it cannot be used under constraints without selling

### 3) Portfolio simulation after suggestions
A second table shows:
- the “new portfolio weights” if you apply the proposed allocations
- the new differences versus the normalized BET weights

### 4) Daily index snapshots (GitHub Actions)
A GitHub Actions workflow scrapes BET index weights daily and commits:
- input/bvb_distribution/bvb-companies-YYYY-MM-DD.csv
- input/bvb_distribution/bvb-companies-latest.csv

### 5) Data Coverage page
The “Data Coverage” tab displays:
- a calendar-style view of which days have snapshots
- a list of missing days (if any)
- links to each daily snapshot file

---

## Input formats

### Portfolio CSV (upload in the Tracker tab)
Preferred format: values (not percentages)

    symbol,value
    SNP,126057.38
    TLV,121373.78
    ...
    CASH_VALUE,12023.80

Notes:
- CASH_VALUE is treated as available cash and excluded from portfolio weights.
- Values are assumed to be in your base currency (RON, EUR, etc.). The app does not enforce a specific currency.

### Index CSV (auto-loaded)

    symbol,weight
    TLV,19.30
    SNP,19.03
    ...

---

## How to use

1. Open the app (link at top).
2. Upload your portfolio CSV (symbol,value).
3. Click “Generate Report” to compare your portfolio vs the latest index weights.
4. Optional: enable “New Investment”, adjust minimum per stock, then generate again to get suggestions.
5. Review the “Portfolio after applying suggestions” table to validate improvement.

---

## Project structure

- index.html — main tracker UI and logic
- about.html — documentation page
- data.html — data coverage calendar + missing days detection
- styles.css — styling
- scripts/scrape_bvb.py — scraper that extracts BET weights from bvb.ro
- input/bvb_distribution/ — daily snapshots and latest snapshot
- .github/workflows/daily_bvb_scrape.yml — daily action that updates CSVs

---

## Possible future enhancements
- TradeVille portfolio import (CSV / copy-paste)
- UI / UX refinements.

---

## Disclaimer

This tool is for personal tracking and convenience. It does not provide financial advice.
