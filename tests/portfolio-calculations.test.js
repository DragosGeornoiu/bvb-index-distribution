import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INDEX_HTML = path.resolve(__dirname, "..", "index.html");

function fakeElement() {
  return {
    style: {},
    dataset: {},
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    className: "",
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    addEventListener() {},
    appendChild() {},
    querySelectorAll() { return []; }
  };
}

function loadTrackerApi() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const mainScript = scripts.find(s => s.includes("const BVB_LATEST_CSV_URL"));

  assert.ok(mainScript, "index.html should contain the main tracker script");

  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, fakeElement());
      return elements.get(id);
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };

  const context = {
    document,
    console,
    alert() {},
    fetch() { throw new Error("fetch should not be called by unit tests"); },
    setTimeout,
    clearTimeout
  };

  vm.createContext(context);
  vm.runInContext(`
    ${mainScript}

    globalThis.__trackerApi = {
      parseCSV,
      portfolioValues,
      parseTradevilleToRows,
      pickTier,
      computeFeeInfoForCards,
      computeSuggestionsWithMarketPrices,
      computeSellSuggestionsWithMarketPrices,
      portfolioAfterBuySuggestions,
      portfolioAfterSellSuggestions
    };
  `, context, { filename: "index.html" });

  return context.__trackerApi;
}

const api = loadTrackerApi();

const BET_CSV = `symbol,weight
TLV,19.52
SNP,15.20
SNG,12.81
H2O,12.44
BRD,7.00
TGN,6.54
DIGI,5.22
EL,5.04
SNN,3.60
M,3.23
ONE,1.06`;

const PORTFOLIO_CSV = `symbol,value,market_price
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
CASH_VALUE,19393.15,`;

const TRADEVILLE_TEXT = `Instrumente BVB in RON
simbol\t\t\tNume\tsold\tPret piata\tCost mediu \tVariatie zi \tVariatie cost \tevaluare\tProfit/ Pierdere \tPondere
TLV\tactivitate\tlichidate pozitie\tBanca Transilvania\t4,759\t37.16\t25.6357\t-0.16%\t44.95%\t176,844.44\t54,117.29\t20.78%
SNP\tactivitate\tlichidate pozitie\tOMV Petrom\t131,302\t1.0380\t0.6255\t0.29%\t65.96%\t136,291.48\t53,606.75\t15.99%
SNG\tactivitate\tlichidate pozitie\tS.n.g.n. Romgaz\t8,116\t14.12\t4.9356\t0.14%\t186.09%\t114,597.92\t74,068.03\t13.50%
H2O\tactivitate\tlichidate pozitie\tS.p.e.e.h. Hidroelectrica\t642\t178.0\t123.7809\t1.14%\t43.80%\t114,276.00\t34,339.59\t13.39%
BRD\tactivitate\tlichidate pozitie\tBRD - Groupe Societe Generale\t1,965\t32.20\t16.5522\t0.78%\t94.54%\t63,273.00\t30,487.03\t7.43%
TGN\tactivitate\tlichidate pozitie\tS.n.t.g.n. Transgaz\t681\t88.7\t28.6609\t0.34%\t209.48%\t60,404.70\t40,636.57\t7.12%
DIGI\tactivitate\tlichidate pozitie\tDigi Communications\t861\t56.20\t24.3188\t-1.40%\t131.10%\t48,388.20\t27,248.69\t5.71%
EL\tactivitate\tlichidate pozitie\tSocietatea Energetica Electrica\t1,185\t38.65\t13.6743\t2.25%\t182.65%\t45,800.25\t29,407.10\t5.37%
SNN\tactivitate\tlichidate pozitie\tNuclearelectrica\t424\t72.6\t24.6568\t-4.35%\t194.44%\t30,782.40\t20,200.31\t3.61%
M\tactivitate\tlichidate pozitie\tMedlife\t2,615\t11.18\t6.4371\t1.08%\t73.68%\t29,235.70\t12,280.49\t3.46%
ONE\tactivitate\tlichidate pozitie\tOne United Properties\t378\t30.75\t10.0936\t0.49%\t204.65%\t11,623.50\t7,758.59\t1.37%
Total active:\t832,195.05\t384,150.42\t97.72%
RON\tactivitate\t\tRON\t19,393.15\t-\t-\t-\t-\t19,393.15\t0.00\t2.28%
Total Portofoliu\t850,910.73 RON ~ 186,154.18 USD ~ 162,415.44 EUR`;

function normalizedBet(source = BET_CSV) {
  const bvb = api.parseCSV(source);
  const total = bvb.reduce((sum, c) => sum + Number(c.weight), 0);
  return bvb.map(c => ({
    symbol: c.symbol,
    bvbWeight: Number(c.weight),
    normalizedWeight: (Number(c.weight) / total) * 100
  }));
}

function samplePortfolio() {
  return api.portfolioValues(api.parseCSV(PORTFOLIO_CSV));
}

function feeInfoFor(totalRon, overrides = {}) {
  return api.computeFeeInfoForCards(
    totalRon,
    { eur_ron: overrides.eurRon ?? 5.0972 },
    { tiers: overrides.tiers ?? [{ name: "BRONZE", threshold_eur_min: 100000, fee_percent: 0.41, fixed_fee_eur: 0.30 }] }
  );
}

function maxAbsPostTradeDeviation(normalizedBvb, after) {
  const weights = new Map(after.list.map(p => [p.symbol, p.weight]));
  return Math.max(...normalizedBvb.map(c => Math.abs((weights.get(c.symbol) || 0) - c.normalizedWeight)));
}

// Validates the main CSV import: CASH_VALUE is excluded from stock weights,
// but included in the overall portfolio total used for fee-tier selection.
test("CSV parser and portfolioValues calculate stocks-only totals and cash", () => {
  const rows = api.parseCSV(PORTFOLIO_CSV);
  const portfolio = api.portfolioValues(rows);

  assert.equal(rows.length, 12);
  assert.equal(portfolio.portfolio.length, 11);
  assert.equal(portfolio.rawStocks.length, 11);
  assert.equal(portfolio.cashValue, 19393.15);
  assert.equal(Number(portfolio.totalStocksValue.toFixed(2)), 831517.59);
  assert.equal(Number(portfolio.totalAllValue.toFixed(2)), 850910.74);

  const tlv = portfolio.portfolio.find(p => p.symbol === "TLV");
  assert.ok(tlv);
  assert.equal(tlv.market_price, 37.16);
  assert.equal(Number(tlv.weight.toFixed(2)), 21.27);
});

// Validates CSV robustness: semicolon delimiters and market-price header aliases are accepted.
test("CSV parser accepts semicolon delimiters and market price aliases", () => {
  const csv = `symbol;value;price
AAA;1000;10
BBB;3000;30
CASH_VALUE;500;`;

  const portfolio = api.portfolioValues(api.parseCSV(csv));

  assert.equal(portfolio.portfolio.length, 2);
  assert.equal(portfolio.cashValue, 500);
  assert.equal(portfolio.portfolio.find(p => p.symbol === "AAA").market_price, 10);
  assert.equal(Number(portfolio.portfolio.find(p => p.symbol === "BBB").weight.toFixed(2)), 75.00);
});

// Validates fail-fast behavior for invalid input: stock rows need market_price so whole-share orders can be calculated.
test("portfolioValues rejects stock rows without valid market_price", () => {
  const rows = api.parseCSV(`symbol,value,market_price
AAA,1000,
CASH_VALUE,50,`);

  assert.throws(() => api.portfolioValues(rows), /Missing or invalid market_price for: AAA/);
});

// Validates TradeVille paste parsing: extracts market price, evaluated value and cash from the RON row,
// while ignoring headers and total rows.
test("TradeVille paste parser extracts market prices, evaluated values and cash", () => {
  const rows = api.parseTradevilleToRows(TRADEVILLE_TEXT);
  const portfolio = api.portfolioValues(rows);

  assert.equal(rows.length, 12);
  assert.equal(portfolio.portfolio.length, 11);
  assert.equal(portfolio.cashValue, 19393.15);
  assert.equal(Number(portfolio.totalStocksValue.toFixed(2)), 831517.59);

  const snp = portfolio.portfolio.find(p => p.symbol === "SNP");
  assert.ok(snp);
  assert.equal(snp.market_price, 1.038);
  assert.equal(snp.value, 136291.48);
});

// Validates duplicate symbol handling: repeated symbols are merged and the latest valid market price is kept.
test("TradeVille parser merges duplicate symbols", () => {
  const duplicateText = `Instrumente BVB in RON
AAA\tName\t10\t10.00\t1\t0%\t0%\t100.00\t0\t50.00%
AAA\tName\t5\t11.00\t1\t0%\t0%\t55.00\t0\t27.50%
RON\tactivitate\t\tRON\t20.00\t-\t-\t-\t-\t20.00\t0\t1%`;

  const rows = api.parseTradevilleToRows(duplicateText);
  const aaa = rows.find(r => r.symbol === "AAA");

  assert.equal(rows.length, 2);
  assert.equal(aaa.value, 155);
  assert.equal(aaa.market_price, 11);
  assert.equal(rows.find(r => r.symbol === "CASH_VALUE").value, 20);
});

// Validates BET normalization used by the tables and algorithms: selected-universe weights must sum to 100%.
test("normalized BET weights sum to 100 percent", () => {
  const norm = normalizedBet();
  const sum = norm.reduce((s, x) => s + x.normalizedWeight, 0);

  assert.equal(norm.length, 11);
  assert.ok(Math.abs(sum - 100) < 1e-9);
});

// Validates fee-tier selection: total portfolio value is converted from RON to EUR,
// then the highest eligible threshold is selected.
test("fee tier selection uses total portfolio value converted to EUR", () => {
  const portfolio = samplePortfolio();
  const feeInfo = feeInfoFor(portfolio.totalAllValue);

  assert.equal(feeInfo.tierName, "BRONZE");
  assert.equal(feeInfo.feePercent, 0.41);
  assert.equal(feeInfo.fixedFeeEur, 0.30);
  assert.equal(feeInfo.eurRon, 5.0972);
});

// Validates all important fee-tier thresholds so threshold sorting is not accidentally reversed.
test("fee tier selection chooses the highest eligible threshold", () => {
  const tiers = [
    { name: "PLATINUM", threshold_eur_min: 400000, fee_percent: 0.30, fixed_fee_eur: 0.30 },
    { name: "GOLD", threshold_eur_min: 300000, fee_percent: 0.35, fixed_fee_eur: 0.30 },
    { name: "SILVER", threshold_eur_min: 200000, fee_percent: 0.39, fixed_fee_eur: 0.30 },
    { name: "BRONZE", threshold_eur_min: 100000, fee_percent: 0.41, fixed_fee_eur: 0.30 },
    { name: "STANDARD", threshold_eur_min: 0, fee_percent: 0.43, fixed_fee_eur: 0.30 }
  ];

  assert.equal(feeInfoFor(50_000 * 5, { eurRon: 5, tiers }).tierName, "STANDARD");
  assert.equal(feeInfoFor(100_000 * 5, { eurRon: 5, tiers }).tierName, "BRONZE");
  assert.equal(feeInfoFor(250_000 * 5, { eurRon: 5, tiers }).tierName, "SILVER");
  assert.equal(feeInfoFor(350_000 * 5, { eurRon: 5, tiers }).tierName, "GOLD");
  assert.equal(feeInfoFor(450_000 * 5, { eurRon: 5, tiers }).tierName, "PLATINUM");
});

// Validates fallback behavior: invalid fee metadata returns null instead of breaking calculations.
test("fee info returns null when EUR/RON metadata is invalid", () => {
  const result = api.computeFeeInfoForCards(100000, { eur_ron: 0 }, { tiers: [] });

  assert.equal(result, null);
});

// Validates the main buy scenario: it does not overspend cash, buys whole shares only,
// includes fees and produces a consistent post-buy portfolio model.
test("buy suggestions respect available cash, fees, whole shares and update the after table model", () => {
  const portfolio = samplePortfolio();
  const feeInfo = feeInfoFor(portfolio.totalAllValue);
  const norm = normalizedBet();

  const suggestions = api.computeSuggestionsWithMarketPrices(
    norm,
    portfolio.portfolio,
    portfolio.totalStocksValue,
    portfolio.cashValue,
    500,
    feeInfo
  );

  assert.ok(suggestions.items.length > 0);
  assert.ok(suggestions.investedTotal <= portfolio.cashValue + 0.005);
  assert.ok(suggestions.unallocated >= -0.005);
  assert.ok(suggestions.unallocated < 5);
  assert.ok(suggestions.items.every(it => Number.isInteger(it.shares) && it.shares > 0));
  assert.ok(suggestions.items.every(it => it.totalCost >= it.amountGross));

  const after = api.portfolioAfterBuySuggestions(
    portfolio.portfolio,
    suggestions.items.map(it => ({ symbol: it.symbol, amount: it.amountGross, shares: it.shares, price: it.price })),
    portfolio.totalStocksValue
  );

  assert.equal(Number(after.invested.toFixed(6)), Number(suggestions.investedGross.toFixed(6)));
  assert.ok(after.newTotal > portfolio.totalStocksValue);
});

// Validates the minimum-investment rule: if the minimum is too high for available cash,
// no order should be opened.
test("buy suggestions return no orders when minimum investment is too high", () => {
  const portfolio = samplePortfolio();
  const suggestions = api.computeSuggestionsWithMarketPrices(
    normalizedBet(),
    portfolio.portfolio,
    portfolio.totalStocksValue,
    1000,
    2000,
    feeInfoFor(portfolio.totalAllValue)
  );

  assert.equal(suggestions.items.length, 0);
  assert.equal(suggestions.investedGross, 0);
  assert.equal(suggestions.investedTotal, 0);
});

// Validates fee calculation: the fixed fee is applied per symbol order, not once globally.
test("buy suggestions apply fixed fee per opened symbol order", () => {
  const portfolio = samplePortfolio();
  const feeInfo = { eurRon: 5, feePercent: 1, fixedFeeEur: 1, tierName: "TEST" };
  const suggestions = api.computeSuggestionsWithMarketPrices(
    normalizedBet(),
    portfolio.portfolio,
    portfolio.totalStocksValue,
    10000,
    0,
    feeInfo
  );

  for (const item of suggestions.items) {
    const expectedFee = item.amountGross * 0.01 + 5;
    assert.ok(Math.abs(item.fee - expectedFee) < 1e-9);
  }
});

// Validates zero-fee fallback: buy suggestions still work when fee metadata is unavailable.
test("buy suggestions work without fee metadata", () => {
  const portfolio = samplePortfolio();
  const suggestions = api.computeSuggestionsWithMarketPrices(
    normalizedBet(),
    portfolio.portfolio,
    portfolio.totalStocksValue,
    1000,
    0,
    null
  );

  assert.ok(suggestions.items.length > 0);
  assert.equal(suggestions.investedTotal, suggestions.investedGross);
  assert.ok(suggestions.items.every(it => it.fee === 0));
});

// Validates the main sell scenario: existing cash reduces the amount to raise,
// net proceeds after fees reach the target and the post-sell model remains valid.
test("sell suggestions count existing cash first and keep the remaining portfolio close to normalized BET", () => {
  const portfolio = samplePortfolio();
  const feeInfo = feeInfoFor(portfolio.totalAllValue);
  const norm = normalizedBet();
  const targetFinalCashRon = 33000 * 5.0972;
  const netNeeded = targetFinalCashRon - portfolio.cashValue;

  const suggestions = api.computeSellSuggestionsWithMarketPrices(
    norm,
    portfolio.portfolio,
    portfolio.totalStocksValue,
    targetFinalCashRon,
    portfolio.cashValue,
    feeInfo
  );

  assert.ok(suggestions.items.length > 0);
  assert.ok(suggestions.items.every(it => Number.isInteger(it.shares) && it.shares > 0));
  assert.ok(suggestions.netRaised >= netNeeded - 0.005);
  assert.ok(suggestions.netRaised - netNeeded < 50);
  assert.equal(Number((suggestions.grossSold - suggestions.feesTotal).toFixed(6)), Number(suggestions.netRaised.toFixed(6)));

  const after = api.portfolioAfterSellSuggestions(
    portfolio.portfolio,
    suggestions.items.map(it => ({ symbol: it.symbol, amount: it.amountGross, shares: it.shares, price: it.price })),
    portfolio.totalStocksValue
  );

  const finalCash = portfolio.cashValue + suggestions.netRaised;
  assert.ok(finalCash >= targetFinalCashRon - 0.005);
  assert.ok(after.newTotal < portfolio.totalStocksValue);
  assert.ok(maxAbsPostTradeDeviation(norm, after) < 0.01);
});

// Validates Sell mode with a target expressed directly in RON: the algorithm should use the same logic
// without depending on EUR conversion.
test("sell suggestions support targets expressed directly in RON", () => {
  const portfolio = samplePortfolio();
  const targetFinalCashRon = 168000;
  const suggestions = api.computeSellSuggestionsWithMarketPrices(
    normalizedBet(),
    portfolio.portfolio,
    portfolio.totalStocksValue,
    targetFinalCashRon,
    portfolio.cashValue,
    feeInfoFor(portfolio.totalAllValue)
  );

  assert.ok(suggestions.items.length > 0);
  assert.ok(portfolio.cashValue + suggestions.netRaised >= targetFinalCashRon - 0.005);
});

// Validates that no sell orders are generated when existing CASH_VALUE already reaches the target.
test("sell suggestions return no orders when existing cash already reaches the target", () => {
  const portfolio = samplePortfolio();
  const feeInfo = feeInfoFor(portfolio.totalAllValue);
  const norm = normalizedBet();

  const suggestions = api.computeSellSuggestionsWithMarketPrices(
    norm,
    portfolio.portfolio,
    portfolio.totalStocksValue,
    10000,
    portfolio.cashValue,
    feeInfo
  );

  assert.equal(suggestions.items.length, 0);
  assert.equal(suggestions.netRaised, 0);
  assert.equal(suggestions.shortfall, 0);
});

// Validates impossible targets: the algorithm must not sell more than available holdings and must report shortfall.
test("sell suggestions do not sell more than available holdings for impossible targets", () => {
  const portfolio = samplePortfolio();
  const suggestions = api.computeSellSuggestionsWithMarketPrices(
    normalizedBet(),
    portfolio.portfolio,
    portfolio.totalStocksValue,
    10_000_000,
    portfolio.cashValue,
    feeInfoFor(portfolio.totalAllValue)
  );

  assert.ok(suggestions.shortfall > 0);
  assert.ok(suggestions.grossSold <= portfolio.totalStocksValue + 0.005);

  for (const item of suggestions.items) {
    const position = portfolio.portfolio.find(p => p.symbol === item.symbol);
    assert.ok(item.shares <= Math.floor(position.value / position.market_price));
  }
});

// Validates the post-sell model: position values must not become negative, even with oversized sell input.
test("portfolioAfterSellSuggestions never produces negative position values", () => {
  const portfolio = samplePortfolio();
  const after = api.portfolioAfterSellSuggestions(
    portfolio.portfolio,
    [{ symbol: "TLV", amount: 999999999, shares: 999999999, price: 37.16 }],
    portfolio.totalStocksValue
  );

  const tlv = after.list.find(p => p.symbol === "TLV");
  assert.equal(tlv.value, 0);
  assert.ok(after.list.every(p => p.value >= 0));
});

// Validates zero-fee fallback: sell suggestions still work when fee metadata is unavailable.
test("sell suggestions work without fee metadata", () => {
  const portfolio = samplePortfolio();
  const targetFinalCashRon = 100000;
  const suggestions = api.computeSellSuggestionsWithMarketPrices(
    normalizedBet(),
    portfolio.portfolio,
    portfolio.totalStocksValue,
    targetFinalCashRon,
    portfolio.cashValue,
    null
  );

  assert.ok(suggestions.items.length > 0);
  assert.equal(suggestions.feesTotal, 0);
  assert.equal(suggestions.netRaised, suggestions.grossSold);
});
