# BVB Index Distribution / Portfolio Tracker

Live app:  
https://dragosgeornoiu.github.io/bvb-index-distribution/

A small GitHub Pages tool that compares a personal BVB portfolio to the BET index distribution and suggests buy or sell orders that move the portfolio closer to the index. It also includes a time-series chart of index weight changes (Allocation History).

---

## WHY THIS EXISTS

I wanted a quick way to:

- track how close my portfolio weights are to BET
- see which holdings are overweight / underweight versus the index
- split available cash into buy orders that keep the portfolio close to BET over time
- plan sell orders that raise a desired amount of cash while keeping the remaining portfolio as close as possible to BET
- visualize how BET weights shift day-to-day (useful for understanding rebalancing moves)

---

## PAGES

### Tracker (`index.html`)

Import a portfolio, compare it with BET, generate buy or sell suggestions with whole-share and fee constraints, and validate the result in the “Portfolio after applying suggestions” table.

### Allocation History (`allocation.html`)

Time-series chart of BET constituent weights using daily snapshots. Supports multi-select symbols, time ranges, and day-to-day deltas.

### Data Coverage (`data.html`)

Calendar overview of available daily snapshots and static metadata snapshots.

---

## TECHNICAL OVERVIEW

### Stack

- Frontend: HTML, CSS, vanilla JavaScript (no framework)
- Charts: Chart.js (CDN)
- Hosting: GitHub Pages (static site)
- Automation: GitHub Actions
- Scraper: Python (`scripts/scrape_bvb.py`)
- Tests: Node.js built-in test runner (`node:test`)

### Architecture: static and reproducible

The application has no backend:

- All data is stored as static files in the repository.
- A GitHub Action runs daily, scrapes BET weights, and commits a new snapshot.
- The UI reads committed data only, making results deterministic and reproducible.
- Calculation logic is tested directly from the JavaScript embedded in `index.html`.

---

## DATA SOURCES AND STORAGE

### 1. BET weights (daily snapshots)

Stored under:

```text
input/bvb_distribution/bvb-companies-YYYY-MM-DD.csv
input/bvb_distribution/bvb-companies-latest.csv
```

CSV format:

```csv
symbol,weight
TLV,19.52
SNP,15.20
SNG,12.81
H2O,12.44
BRD,7.00
...
```

### 2. Allocation History input

Uses the same daily CSV snapshots.

Repository folder:  
https://github.com/DragosGeornoiu/bvb-index-distribution/tree/master/input/bvb_distribution

Loading process:

- lists files using the GitHub Contents API
- downloads CSVs using raw GitHub URLs
- defaults to the last 3 months, or all available snapshots if fewer exist

### 3. Fees and FX

Static JSON snapshots:

```text
input/meta/eur_ron.json
input/meta/tradeville_fees_ro_bvb.json
```

- `eur_ron.json` supplies the EUR/RON conversion used in the Tracker.
- `tradeville_fees_ro_bvb.json` supplies estimated TradeVille BVB fee tiers.
- These values are not fetched live at runtime, ensuring reproducibility.

---

## INPUT FORMATS (TRACKER)

All portfolio values and market prices are interpreted as RON.

### 1. Portfolio CSV upload

Upload a CSV with these headers:

```csv
symbol,value,market_price
TLV,176844.44,37.16
SNP,136291.48,1.0380
SNG,114597.92,14.12
H2O,114276.00,178.00
BRD,63273.00,32.20
TGN,60404.70,88.70
DIGI,48388.20,56.20
EL,45800.25,38.65
SNN,30782.40,72.60
M,29235.70,11.18
ONE,11623.50,30.75
CASH_VALUE,19393.15,
```

Notes:

- `symbol` is the BVB ticker.
- `value` is the current market value of the position in RON.
- `market_price` is the current market price in RON and is required for practical whole-share buy/sell suggestions.
- `CASH_VALUE` is optional available cash in RON.
- `CASH_VALUE` is excluded from stock-weight calculations, but is included when calculating cash available after a sell.

### 2. TradeVille copy / paste import

Paste the TradeVille portfolio table directly. The parser ignores headers and totals, extracts the symbol, market price and evaluated value, and maps the `RON` row to `CASH_VALUE`.

Example:

```text
Instrumente BVB in RON
simbol    Nume                                  sold      Pret piata  Cost mediu  Variatie zi  Variatie cost  evaluare    Profit/ Pierdere  Pondere
TLV       Banca Transilvania                    4,759     37.16       25.6357     -0.16%       44.95%          176,844.44  54,117.29         20.78%
SNP       OMV Petrom                            131,302   1.0380      0.6255      0.29%        65.96%          136,291.48  53,606.75         15.99%
SNG       S.N.G.N. Romgaz                       8,116     14.12       4.9356      0.14%        186.09%         114,597.92  74,068.03         13.50%
H2O       S.P.E.E.H. Hidroelectrica             642       178.00      123.7809    1.14%        43.80%          114,276.00  34,339.59         13.39%
BRD       BRD - Groupe Societe Generale         1,965     32.20       16.5522     0.78%        94.54%          63,273.00   30,487.03         7.43%
TGN       S.N.T.G.N. Transgaz                   681       88.70       28.6609     0.34%        209.48%         60,404.70   40,636.57         7.12%
DIGI      Digi Communications                   861       56.20       24.3188     -1.40%       131.10%         48,388.20   27,248.69         5.71%
EL        Societatea Energetica Electrica       1,185     38.65       13.6743     2.25%        182.65%         45,800.25   29,407.10         5.37%
SNN       Nuclearelectrica                      424       72.60       24.6568     -4.35%       194.44%         30,782.40   20,200.31         3.61%
M         MedLife                               2,615     11.18       6.4371      1.08%        73.68%          29,235.70   12,280.49         3.46%
ONE       One United Properties                 378       30.75       10.0936     0.49%        204.65%         11,623.50   7,758.59          1.37%
Total active:                                                                                                  832,195.05                    97.72%
RON       RON                                   19,393.15  -           -           -            -               19,393.15   0.00             2.28%
Total Portofoliu                                                                                               850,910.73 RON
```

Notes:

- The parser extracts `Pret piata` as `market_price` and `evaluare` as `value`.
- The parser detects the `RON` row and maps it to `CASH_VALUE`.
- It ignores “Total …” rows and other rows it cannot parse safely.
- The exact visual layout of pasted TradeVille text can vary; the parser is intentionally tolerant.

---

## TRACKER CALCULATIONS

### Portfolio weights

- Portfolio weight per symbol is calculated from stock positions only.
- `CASH_VALUE` is excluded from stock weights.
- If “Only consider companies in my portfolio” is enabled, BET weights are normalized only over symbols present in the imported portfolio.

### Index weights

- Index weights are loaded from the latest BET snapshot.
- Weights are normalized to 100% for the selected universe.

### Comparison table

The main table shows:

- BET Weight
- Normalized BET Weight
- Portfolio Weight
- Difference in value and percentage

---

## BUY SUGGESTIONS

### Goal

Invest available cash as close to the BET index as possible without selling.

### Constraints

- buy-only
- total spend cannot exceed available cash
- whole shares only
- minimum investment per symbol
- estimated variable and fixed fees per order
- market prices from the imported portfolio are used for practical suggestions

### High-level flow

1. Load and normalize the latest BET snapshot.
2. Calculate current stock weights.
3. Identify underweight symbols.
4. Allocate available cash iteratively while respecting fees, minimum investment and whole-share constraints.
5. Simulate the portfolio after applying the suggestions.

---

## SELL SUGGESTIONS / REBALANCING

### Goal

Raise a desired **total cash amount in the account after the sale** while keeping the remaining stock portfolio as close as possible to the normalized BET distribution.

The requested amount can be entered in **EUR or RON**. EUR is converted using the static `eur_ron.json` snapshot.

### How cash is interpreted

The input is not “how much gross stock value to sell”.

It means:

```text
existing CASH_VALUE + estimated net proceeds from sales ≈ desired final cash
```

For example, if current cash is 3,800 EUR and the desired final cash is 33,000 EUR, the tool aims to raise approximately 29,200 EUR net from sales.

### Constraints and behavior

- whole shares only
- no position can be sold below zero shares
- estimated TradeVille fees are included per sell order
- existing `CASH_VALUE` is counted first
- the algorithm may raise a small amount above the requested target because shares are indivisible
- when this happens, the UI clearly shows the requested amount, estimated net raised, excess amount, gross sale value and estimated fees
- if Sell mode is selected, the desired final cash amount is required; a report is not generated with an empty or zero value

### Rebalancing approach

The sell algorithm evaluates the portfolio **after the proposed sale** and seeks a set of whole-share sell orders that:

1. reaches the desired final cash target after estimated fees; and
2. minimizes the remaining portfolio’s deviation from normalized BET weights.

The result is validated in the “Portfolio after applying sell suggestions” table, which shows the post-sale weight and value deviation for every symbol.

### Important limitation

The output is a planning suggestion. Actual fills, market prices, fees and order execution can differ from the static inputs used by the tool. Always verify prices, quantities and broker fees before placing orders.

---

## TESTING

The project includes automated calculation tests in:

```text
tests/portfolio-calculations.test.js
```

The tests use Node.js’ built-in test runner and load the calculation functions directly from `index.html`. This keeps the tests aligned with the code actually deployed to GitHub Pages.

### Run tests locally

Requirements:

- Node.js 22 or later
- npm

Install dependencies:

```bash
npm ci
```

Run the full test suite:

```bash
npm test
```

The current suite contains 19 tests covering:

- CSV parsing, including supported delimiters and market-price header aliases
- invalid CSV input and missing market prices
- TradeVille copy/paste parsing
- duplicate-symbol handling
- stock-only portfolio totals and cash handling
- BET weight normalization
- EUR/RON conversion for sell targets
- TradeVille fee-tier selection and fee calculations
- buy suggestions, whole-share constraints, minimum investment and available-cash limits
- sell suggestions, existing cash handling, fees, target overage and impossible targets
- post-buy and post-sell portfolio simulation models
- fallback behavior when fee metadata is unavailable

---

## CONTINUOUS INTEGRATION

Tests run automatically through GitHub Actions using:

```text
.github/workflows/tests.yml
```

The workflow runs on:

- every push to `master`
- every pull request targeting `master`

It performs the following steps:

1. checks out the repository
2. installs Node.js 22
3. runs `npm ci`
4. runs `npm test`

If a test fails, the GitHub Actions workflow fails and GitHub sends the repository notification email configured for the account.

The test workflow does not block the GitHub Pages deployment by itself. It acts as an automated validation signal after each push.

---

## DAILY BET SCRAPING

The daily BET scraper workflow is separate from the test workflow:

```text
.github/workflows/daily_bvb_scrape.yml
```

It runs on a daily schedule and can also be triggered manually.

The workflow:

1. downloads the BET index composition from BVB
2. parses constituent weights
3. writes a dated CSV snapshot
4. updates `bvb-companies-latest.csv`
5. commits and pushes changes only when the data changed

The scraper uses:

```text
scripts/scrape_bvb.py
```

---

## DISCLAIMER

This tool is for personal tracking and planning only. It does not provide financial advice.

Always verify prices, fees, available quantities and broker rules before trading.
