# BVB Index Distribution / Portfolio Tracker

Live app:  
https://dragosgeornoiu.github.io/bvb-index-distribution/

A small GitHub Pages tool that compares a personal BVB portfolio to the BET index distribution and suggests how to invest available cash to move the portfolio closer to the index (buy-only, no selling).

---

## Why this exists

I wanted a quick way to:
- track how close my portfolio weights are to BET
- understand which holdings are overweight / underweight versus the index
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
- respects a minimum investment per stock
- rounds allocations down to lots of 50
- never exceeds available cash
- shows unallocated cash when constraints prevent full usage

### 3) Portfolio simulation after suggestions
A second table shows:
- the new portfolio weights after applying suggestions
- the new differences versus normalized BET weights

### 4) Daily index snapshots (GitHub Actions)
A GitHub Actions workflow scrapes BET index weights daily and commits:
- `input/bvb_distribution/bvb-companies-YYYY-MM-DD.csv`
- `input/bvb_distribution/bvb-companies-latest.csv`

### 5) Data Coverage page
The “Data Coverage” tab displays:
- a calendar-style overview of available snapshots
- missing days (if any)
- links to each daily snapshot file

---

## Input formats

### Portfolio import options

You can import your portfolio in **two ways**.

---

### 1) Portfolio CSV upload (recommended for automation)

Format:

```
symbol,value
SNP,126057.38
TLV,121373.78
SNG,75962.08
...
CASH_VALUE,12023.80
```

Notes:
- `symbol` is the BVB ticker
- `value` is the current position value (not percentage)
- `CASH_VALUE` represents available cash
- CASH_VALUE is excluded from portfolio weights
- Currency is not enforced (RON, EUR, etc.)

---

### 2) TradeVille copy / paste import

You can paste your portfolio table directly from TradeVille.

The parser is intentionally tolerant and will:
- ignore headers and extra text
- extract only valid instrument rows
- detect the `RON` cash row automatically
- ignore totals and summary rows

Example pasted content:

```
simbol      Nume                    sold   Pret piata   evaluare   Pondere
SNP         OMV Petrom              128,368 0.9760       125,287.17 20.57%
TLV         Banca Transilvania      4,027   30.22        121,695.94 19.98%
SNG         Romgaz                  7,783   9.78         76,117.74  12.50%
...
RON         RON                     12,023.80
```

Internally, this is converted to the same structure as a CSV upload, so all calculations and suggestions behave identically.

---

## How to use

1. Open the app.
2. Import your portfolio (CSV upload or TradeVille copy/paste).
3. Click **Generate Report** to compare your portfolio vs the latest BET weights.
4. Optional: enable **New Investment** and set a minimum per stock.
5. Generate again to receive buy-only suggestions.
6. Review **Portfolio after applying suggestions** to validate improvement.

---

## Project structure

- `index.html` — main tracker UI and logic
- `about.html` — documentation page
- `data.html` — data coverage calendar
- `styles.css` — styling
- `scripts/scrape_bvb.py` — BET scraper
- `input/bvb_distribution/` — daily snapshots and latest snapshot
- `.github/workflows/daily_bvb_scrape.yml` — daily scraping workflow

---

## Disclaimer

This tool is for personal tracking and convenience only.  
It does not provide financial advice.
