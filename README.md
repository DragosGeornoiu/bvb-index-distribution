# BVB Index Distribution / Portfolio Tracker

Live app:
https://dragosgeornoiu.github.io/bvb-index-distribution/

A small GitHub Pages tool that compares a personal BVB portfolio to the BET index distribution and suggests how to invest available cash to move the portfolio closer to the index (buy-only, no selling). It also includes a time-series chart of index weight changes (Allocation History).

---

WHY THIS EXISTS

I wanted a quick way to:
- track how close my portfolio weights are to BET
- see which holdings are overweight / underweight versus the index
- split available cash into buy orders that keep the portfolio close to BET over time
- visualize how BET weights shift day-to-day (useful for understanding rebalancing moves)

---

PAGES

Tracker (index.html)
Import portfolio, compare vs BET, generate buy-only investment suggestions (with constraints and fees), and validate results via the “Portfolio after applying suggestions” table.

Allocation History (allocation.html)
Time-series chart of BET constituent weights using daily snapshots. Supports multi-select symbols, time ranges, and day-to-day deltas.

Data Coverage (data.html)
Calendar overview of which daily snapshots exist and links to them.

---

TECHNICAL OVERVIEW

STACK
Frontend: HTML, CSS, vanilla JavaScript (no framework)
Charts: Chart.js (CDN)
Hosting: GitHub Pages (static site)
Automation: GitHub Actions
Scraper: Python (scripts/scrape_bvb.py)

ARCHITECTURE (STATIC AND REPRODUCIBLE)
The application has no backend:
- All data is stored as static files in the repository.
- A GitHub Action runs daily, scrapes BET weights, and commits a new snapshot.
- The UI only reads committed data, making results deterministic and reproducible.

---

DATA SOURCES AND STORAGE

1) BET WEIGHTS (DAILY SNAPSHOTS)

Stored under:
input/bvb_distribution/bvb-companies-YYYY-MM-DD.csv
input/bvb_distribution/bvb-companies-latest.csv

CSV FORMAT EXAMPLE:
symbol,weight
TLV,19.92
SNP,18.59
SNG,11.59
H2O,11.39
BRD,7.03
TGN,6.01
EL,4.51
DIGI,4.18
M,3.71
SNN,3.35
TEL,2.11
FP,1.40
ONE,1.33
PE,1.08
AQ,0.87
ATB,0.83
TTS,0.70
TRP,0.66
SFG,0.59
WINE,0.16

2) ALLOCATION HISTORY INPUT

Uses the same daily CSV snapshots.
Repository folder:
https://github.com/DragosGeornoiu/bvb-index-distribution/tree/master/input/bvb_distribution

Loading process:
- list files using GitHub Contents API
- download CSVs using raw GitHub URLs
- default range is last 3 months (or all available if fewer)

3) FEES AND FX (IF ENABLED)

Fee tiers and FX rates are stored as static JSON snapshots in the repository.
They are not fetched live at runtime, ensuring reproducibility.

---

INPUT FORMATS (TRACKER)

PORTFOLIO CSV UPLOAD

symbol,value
SNP,126506.66
TLV,122179.18
SNG,77051.70
H2O,75628.80
BRD,45400.00
EL,30187.50
SNN,22605.00
DIGI,28245.00
M,24600.00
ONE,11226.60
CASH_VALUE,12023.80

Notes:
- symbol is the BVB ticker
- value is the current position value
- CASH_VALUE is optional available cash
- CASH_VALUE is excluded from weight calculations

TRADEVILLE COPY / PASTE IMPORT

Example paste:
Instrumente BVB in RON
simbol    Nume                       sold     Pret piata   evaluare      Pondere
SNP       OMV Petrom                 128,368  0.9855       126,506.66    20.54%
TLV       Banca Transilvania         4,027    30.34        122,179.18    19.84%
SNG       S.n.g.n. Romgaz            7,783    9.90         77,051.70     12.51%
H2O       Hidroelectrica             606      124.8        75,628.80     12.28%
RON       RON                        12,023.80

The parser ignores headers and totals, extracts symbol + evaluated value,
and maps the RON row to CASH_VALUE.

---

BUY-ONLY SUGGESTION ALGORITHM

GOAL
Invest available cash as close to the BET index as possible without selling.

CONSTRAINTS
- buy-only
- total spend cannot exceed available cash
- whole shares only
- minimum investment per symbol
- estimated fees per order (variable + fixed)
- prices and calculations preserve decimals (no UI rounding)

HIGH-LEVEL FLOW
1. Load latest BET snapshot and normalize weights to 100%.
2. Compute current portfolio weights (excluding cash).
3. Compute target value per symbol.
4. Identify underweight symbols.
5. Allocate cash iteratively, respecting constraints and fees.
6. Spend remaining cash if it further reduces deviation.

OUTPUT
- per-symbol buy suggestions with full cost breakdown
- simulated portfolio after applying suggestions

---

DISCLAIMER

This tool is for personal tracking only.
It does not provide financial advice.
Always verify prices and fees in your broker before trading.
