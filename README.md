# BVB Index Distribution / Portfolio Tracker

Live app:
https://dragosgeornoiu.github.io/bvb-index-distribution/

A small GitHub Pages tool that compares a personal BVB portfolio to the BET index distribution and suggests how to invest available cash to move the portfolio closer to the index (buy-only, no selling).

---

## Why this exists

I wanted a quick way to:

- track how close my portfolio weights are to BET
- see which holdings are overweight / underweight vs the index
- split available cash into buy orders that keep the portfolio close to BET over time

---

## Features

### 1) Portfolio comparison vs BET

- Loads the latest BET constituent weights from a CSV snapshot.
- Optionally filters the index universe to the symbols that exist in your portfolio.
- Normalizes index weights to 100% for the chosen universe.
- Displays differences both as:
  - percentage points
  - value difference in RON (based on your current stocks-only total)

### 2) New investment suggestions (buy-only, fee-aware, whole shares)

When “Enable New Investment” is ON, the app:

- uses available cash (CASH_VALUE) as the maximum budget
- suggests whole-share buys only (no fractional shares)
- accounts for estimated broker fees (variable percent + fixed fee once per symbol)
- respects a minimum gross investment per stock when introducing a new symbol
- attempts to spend as much cash as possible while staying close to the index target
- shows unallocated cash when it’s not possible to spend the remainder

### 3) Portfolio simulation after suggestions

A second table shows:

- the new portfolio weights after applying suggestions (gross invested only)
- the new differences versus normalized BET weights

Fees are costs, not assets, so they are not added to holdings.
They are included only in budgeting (Allocated / Total cost).

### 4) Daily index snapshots (GitHub Actions)

A GitHub Actions workflow scrapes BET index weights daily and commits:

- input/bvb_distribution/bvb-companies-YYYY-MM-DD.csv
- input/bvb_distribution/bvb-companies-latest.csv

### 5) Data Coverage page

The “Data Coverage” tab displays:

- a calendar-style overview of available snapshots
- missing days (if any)
- links to each daily snapshot file

---

## Input formats

You can import your portfolio in two ways.

### 1) Portfolio CSV upload (recommended for automation)

Format:

symbol,value,market_price
SNP,126506.66,0.9855
TLV,122179.18,30.34
SNG,77051.70,9.90
...
CASH_VALUE,12023.80,

Notes:

- symbol is the BVB ticker
- value is the current position value (RON), not percentage
- market_price is required for suggestions and is kept at full precision (not rounded)
- CASH_VALUE represents available cash and is excluded from portfolio weights
- currency is not enforced, but values must be consistent (typically RON)

### 2) TradeVille copy / paste import

You can paste your portfolio table directly from TradeVille.

The parser is intentionally tolerant and will:

- ignore headers and extra text
- extract instrument rows (symbol, market price, evaluated value)
- detect the RON cash row automatically and map it to CASH_VALUE
- ignore totals and summary rows

Example pasted content (simplified):

simbol   sold     Pret piata   evaluare
SNP      128,368  0.9855       126,506.66
TLV      4,027    30.34        122,179.18
...
RON      12,023.80

Internally, this is converted to the same structure as a CSV upload, so calculations behave identically.

---

## Tables and column meanings

### Portfolio Comparison table

Columns:

- Symbol — BVB ticker
- BVB Weight — raw index weight from the snapshot file
- Normalized BVB Weight — weights normalized to 100% within the chosen universe
- Portfolio Weight — current portfolio weights computed from stocks-only total
- Difference (Val and %) — deviation from target in RON and percentage points

A sanity check line shows that the sum of value differences is approximately zero.

### Portfolio after applying suggestions

This is a simulation after adding the suggested gross investments to your holdings.

Columns:

- Normalized BVB Weight — target
- New Portfolio Weight — post-suggestion weight
- New Difference (Val and %) — post-suggestion deviation

---

## Suggestion algorithm (technical)

The algorithm is buy-only and works with whole shares and estimated fees.

### Fee model

For each suggested symbol:

- gross = shares * market_price
- fee = gross * feePercent + fixedFee
- total cost = gross + fee

The fixed fee is applied once per symbol when shares > 0.
The sum of total costs never exceeds available cash.

### Objective

The goal is index tracking.

- Target weights come from the normalized index.
- For each candidate buy (1 share), portfolio weights are recomputed.

The objective minimized is the total squared error:

sum over all symbols of (newWeight - targetWeight)^2

### Strategy

1) Tracking pass (improving only)
   Repeatedly buy the single share that most reduces the total squared error,
   while respecting budget and constraints.

2) Sweep pass (spend remaining cash)
   If cash remains, continue buying the least harmful next share
   to spend as much as possible while keeping tracking close.

### Minimum per stock constraint

If a buy would introduce a new symbol (going from 0 to 1 share),
the algorithm checks that it can reach the configured minimum gross investment
for that symbol (e.g. 500 RON) within the remaining budget, including fees.
If not, that symbol is not opened.

### Precision

Market prices are never rounded in the UI.
This avoids misleading share-cost math (for example 0.9855 vs 0.98).

---

## How to use

1. Open the app.
2. Import your portfolio (CSV upload or TradeVille copy/paste).
3. Click Generate Report to compare vs the latest BET weights.
4. Optional: enable New Investment and set a minimum per stock.
5. Generate again to receive buy-only suggestions.
6. Review Portfolio after applying suggestions to validate the impact.

---

## Project structure

- index.html — main tracker UI and logic
- about.html — documentation page
- data.html — data coverage calendar
- styles.css — styling
- scripts/scrape_bvb.py — BET scraper
- input/bvb_distribution/ — daily snapshots and latest snapshot
- .github/workflows/daily_bvb_scrape.yml — daily scraping workflow

---

## Disclaimer

This tool is for personal tracking and convenience only.
It does not provide financial advice.
