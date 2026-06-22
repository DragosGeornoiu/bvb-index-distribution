import { makeTablesSortable } from "./table-sort.js?v=2026-06-22-8";
import {
    parseCSV,
    portfolioValues,
    parseTradevilleToRows,
    pickTier,
    computeFeeInfoForCards,
    computeSuggestionsWithMarketPrices,
    computeSellSuggestionsWithMarketPrices,
    portfolioAfterBuySuggestions,
    portfolioAfterSellSuggestions,
    formatZeroNoMinus,
    isRequiredPositiveAmount
} from "./calculations.js?v=2026-06-22-8";

const BVB_LATEST_CSV_URL = "input/bvb_distribution/bvb-companies-latest.csv";
    const EUR_RON_JSON_URL = "input/meta/eur_ron.json";
    const TRADEVILLE_FEES_JSON_URL = "input/meta/tradeville_fees_ro_bvb.json";

    const bvbLoadStatusEl = document.getElementById("bvbLoadStatus");
    const portfolioParseStatusEl = document.getElementById("portfolioParseStatus");
    const tradevilleParseStatusEl = document.getElementById("tradevilleParseStatus");
    const totalInvestmentEl = document.getElementById("totalInvestment");
    const newInvestmentAmountEl = document.getElementById("newInvestmentAmount");
    const targetCashAmountEl = document.getElementById("targetCashAmount");
    const targetCashCurrencyEl = document.getElementById("targetCashCurrency");
    const targetCashConversionHintEl = document.getElementById("targetCashConversionHint");

    const importPreviewBlockEl = document.getElementById("importPreviewBlock");
    const importPreviewTableEl = document.getElementById("importPreviewTable");

    const bvbRowsBadgeEl = document.getElementById("bvbRowsBadge");
    const portfolioRowsBadgeEl = document.getElementById("portfolioRowsBadge");
    const tradevilleRowsBadgeEl = document.getElementById("tradevilleRowsBadge");
    const importPreviewRowsBadgeEl = document.getElementById("importPreviewRowsBadge");

    const feeTierBlockEl = document.getElementById("feeTierBlock");
    const feeTierNameEl = document.getElementById("feeTierName");
    const feeTierFeesBigEl = document.getElementById("feeTierFeesBig");
    const feeTierFeesSubEl = document.getElementById("feeTierFeesSub");
    const feeTierSourcesEl = document.getElementById("feeTierSources");
    const feePortfolioRonEl = document.getElementById("feePortfolioRon");
    const feeEurRonEl = document.getElementById("feeEurRon");
    const feePortfolioEurEl = document.getElementById("feePortfolioEur");
    const feeTierRuleEl = document.getElementById("feeTierRule");
    const feeTierUpdatedEl = document.getElementById("feeTierUpdated");

    let parsedPortfolio = null;
    let metaEurRon = null;
    let metaFees = null;

    const importModeCsvEl = document.getElementById("importModeCsv");
    const importModePasteEl = document.getElementById("importModePaste");
    const csvImportBlockEl = document.getElementById("csvImportBlock");
    const pasteImportBlockEl = document.getElementById("pasteImportBlock");

    const segCsvEl = document.getElementById("segCsv");
    const segPasteEl = document.getElementById("segPaste");

    // -----------------------------
    // Global sortable tables (no deps)
    // -----------------------------

    // Extract FIRST numeric token from a cell (handles: "-224.41 (-0.03%)", "12,345.67", "12.345,67", "19.92%", etc.)




    // -----------------------------

    function setSegmentActive(isCsv) {
        segCsvEl.classList.toggle("active", isCsv);
        segPasteEl.classList.toggle("active", !isCsv);
    }

    function setImportMode(mode) {
        const isCsv = mode === "csv";
        setSegmentActive(isCsv);
        csvImportBlockEl.classList.toggle("is-hidden", !isCsv);
        pasteImportBlockEl.classList.toggle("is-hidden", isCsv);

        if (isCsv) {
            tradevilleParseStatusEl.textContent = "No pasted data";
            tradevilleRowsBadgeEl.style.display = "none";
        } else {
            portfolioParseStatusEl.textContent = "No file loaded";
            portfolioRowsBadgeEl.style.display = "none";
            document.getElementById("portfolioFileName").textContent = "No file chosen";
            document.getElementById("portfolioFile").value = "";
        }
    }

    importModeCsvEl.addEventListener("change", () => setImportMode("csv"));
    importModePasteEl.addEventListener("change", () => setImportMode("paste"));

    const filterToggleEl = document.getElementById("filterPortfolioToggle");
    const filterYesBtn = document.getElementById("filterYes");
    const filterNoBtn = document.getElementById("filterNo");
    function syncFilterButtons() {
        const on = !!filterToggleEl.checked;
        filterYesBtn.classList.toggle("active", on);
        filterNoBtn.classList.toggle("active", !on);
    }
    filterYesBtn.addEventListener("click", () => { filterToggleEl.checked = true; syncFilterButtons(); });
    filterNoBtn.addEventListener("click", () => { filterToggleEl.checked = false; syncFilterButtons(); });
    syncFilterButtons();

    const newInvToggleEl = document.getElementById("newInvestmentToggle");
    const investYesBtn = document.getElementById("investYes");
    const investNoBtn = document.getElementById("investNo");
    function syncInvestmentButtons() {
        const on = !!newInvToggleEl.checked;
        investYesBtn.classList.toggle("active", on);
        investNoBtn.classList.toggle("active", !on);
        document.getElementById("investmentFields").style.display = on ? "block" : "none";
    }
    investYesBtn.addEventListener("click", () => { newInvToggleEl.checked = true; syncInvestmentButtons(); });
    investNoBtn.addEventListener("click", () => { newInvToggleEl.checked = false; syncInvestmentButtons(); });
    newInvToggleEl.addEventListener("change", syncInvestmentButtons);
    syncInvestmentButtons();

    const orderModeBuyEl = document.getElementById("orderModeBuy");
    const orderModeSellEl = document.getElementById("orderModeSell");
    const orderBuyLabelEl = document.getElementById("orderBuyLabel");
    const orderSellLabelEl = document.getElementById("orderSellLabel");
    const buyFieldsEl = document.getElementById("buyFields");
    const sellFieldsEl = document.getElementById("sellFields");
    const orderModeHelpEl = document.getElementById("orderModeHelp");

    function getOrderMode() {
        return orderModeSellEl.checked ? "sell" : "buy";
    }

    function syncOrderMode() {
        const isSell = getOrderMode() === "sell";
        orderBuyLabelEl.classList.toggle("active", !isSell);
        orderSellLabelEl.classList.toggle("active", isSell);
        buyFieldsEl.style.display = isSell ? "none" : "block";
        sellFieldsEl.style.display = isSell ? "block" : "none";
        orderModeHelpEl.textContent = isSell
            ? "Sell mode calculates whole-share sell orders to raise the amount you want, while keeping the remaining portfolio as close as possible to BET."
            : "Buy mode uses CASH_VALUE as available cash and suggests whole-share buy orders.";
    }

    orderModeBuyEl.addEventListener("change", syncOrderMode);
    orderModeSellEl.addEventListener("change", syncOrderMode);
    syncOrderMode();

    function convertTargetCashToRon(amount, currency) {
        const n = Number(amount);
        if (!Number.isFinite(n) || n < 0) throw new Error("Please enter a valid desired cash amount.");

        if (currency === "EUR") {
            const eurRon = Number(metaEurRon?.eur_ron);
            if (!Number.isFinite(eurRon) || eurRon <= 0) {
                throw new Error("EUR/RON rate is not available, so the desired cash amount cannot be converted to RON.");
            }
            return n * eurRon;
        }

        return n;
    }

    function targetCashDisplay(targetCashInput, targetCashCurrency, targetCashAmountRon) {
        const input = Number(targetCashInput);
        if (!Number.isFinite(input)) return `${targetCashAmountRon.toFixed(2)} RON`;

        if (targetCashCurrency === "EUR") {
            const eurRon = Number(metaEurRon?.eur_ron);
            if (Number.isFinite(eurRon) && eurRon > 0) {
                return `${input.toFixed(2)} EUR × ${eurRon.toFixed(4)} = ${targetCashAmountRon.toFixed(2)} RON`;
            }
            return `${input.toFixed(2)} EUR = ${targetCashAmountRon.toFixed(2)} RON`;
        }

        return `${input.toFixed(2)} RON`;
    }

    function updateTargetCashConversionHint() {
        if (!targetCashConversionHintEl || !targetCashAmountEl || !targetCashCurrencyEl) return;
        const amount = Number(targetCashAmountEl.value);
        const currency = targetCashCurrencyEl.value;

        if (!Number.isFinite(amount) || amount < 0) {
            targetCashConversionHintEl.textContent = "";
            return;
        }

        if (currency === "EUR") {
            const eurRon = Number(metaEurRon?.eur_ron);
            if (Number.isFinite(eurRon) && eurRon > 0) {
                const ron = amount * eurRon;
                targetCashConversionHintEl.textContent = `${amount.toFixed(2)} EUR × ${eurRon.toFixed(4)} = ${ron.toFixed(2)} RON requested from sale.`;
            } else {
                targetCashConversionHintEl.textContent = "EUR amount will be converted using input/meta/eur_ron.json when you generate the report.";
            }
        } else {
            targetCashConversionHintEl.textContent = `${amount.toFixed(2)} RON desired final cash.`;
        }
    }

    targetCashAmountEl.addEventListener("input", updateTargetCashConversionHint);
    targetCashCurrencyEl.addEventListener("change", updateTargetCashConversionHint);
    updateTargetCashConversionHint();

    document.getElementById("portfolioFile").addEventListener("change", function () {
        const file = this.files[0];
        document.getElementById("portfolioFileName").textContent = file ? file.name : "No file chosen";

        parsedPortfolio = null;
        portfolioParseStatusEl.textContent = "Parsing...";
        portfolioRowsBadgeEl.style.display = "none";
        importPreviewRowsBadgeEl.style.display = "none";

        totalInvestmentEl.value = "";
        newInvestmentAmountEl.value = "";
        targetCashAmountEl.value = "";
        hideImportPreview();
        hideFeeTierSection();

        if (!file) {
            portfolioParseStatusEl.textContent = "No file loaded";
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const rows = parseCSV(event.target.result);
                const hasSymbol = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "symbol");
                const hasValue  = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "value");
                const hasPrice  = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "market_price");
                if (!hasSymbol || !hasValue || !hasPrice) throw new Error("Portfolio CSV must contain headers: symbol,value,market_price");

                const { portfolio, totalStocksValue, cashValue, totalAllValue, rawStocks } = portfolioValues(rows);
                parsedPortfolio = { portfolio, totalStocksValue, cashValue, totalAllValue, rawStocks, source: "csv" };

                totalInvestmentEl.value = totalStocksValue.toFixed(2);
                if (cashValue > 0) {
                    newInvestmentAmountEl.value = cashValue.toFixed(2);
                    portfolioParseStatusEl.textContent = `Loaded ✅ (stocks: ${totalStocksValue.toFixed(2)}, CASH_VALUE: ${cashValue.toFixed(2)})`;
                } else {
                    portfolioParseStatusEl.textContent = `Loaded ✅ (stocks: ${totalStocksValue.toFixed(2)}, no CASH_VALUE row found)`;
                }

                const totalRows = (rawStocks?.length || 0) + (cashValue > 0 ? 1 : 0);
                portfolioRowsBadgeEl.textContent = `Loaded (${totalRows} rows)`;
                portfolioRowsBadgeEl.style.display = "inline-flex";

                renderImportPreview(parsedPortfolio);
            } catch (e) {
                console.error(e);
                portfolioParseStatusEl.textContent = "Failed ❌";
                portfolioRowsBadgeEl.style.display = "none";
                alert(`Could not parse portfolio CSV: ${e.message}`);
            }
        };
        reader.readAsText(file);
    });

    document.getElementById("parseTradevilleBtn").addEventListener("click", function () {
        const text = String(document.getElementById("tradevilleText").value || "").trim();

        parsedPortfolio = null;
        tradevilleParseStatusEl.textContent = "Parsing...";
        tradevilleRowsBadgeEl.style.display = "none";
        importPreviewRowsBadgeEl.style.display = "none";

        totalInvestmentEl.value = "";
        newInvestmentAmountEl.value = "";
        targetCashAmountEl.value = "";
        hideImportPreview();
        hideFeeTierSection();

        if (!text) {
            tradevilleParseStatusEl.textContent = "No pasted data";
            return;
        }

        try {
            const rows = parseTradevilleToRows(text);
            if (!rows || rows.length === 0) throw new Error("No usable instrument rows found. Make sure you pasted the Tradeville table.");

            const { portfolio, totalStocksValue, cashValue, totalAllValue, rawStocks } = portfolioValues(rows);
            parsedPortfolio = { portfolio, totalStocksValue, cashValue, totalAllValue, rawStocks, source: "tradeville" };

            totalInvestmentEl.value = totalStocksValue.toFixed(2);
            if (cashValue > 0) {
                newInvestmentAmountEl.value = cashValue.toFixed(2);
                tradevilleParseStatusEl.textContent = `Loaded ✅ (stocks: ${totalStocksValue.toFixed(2)}, CASH_VALUE: ${cashValue.toFixed(2)})`;
            } else {
                tradevilleParseStatusEl.textContent = `Loaded ✅ (stocks: ${totalStocksValue.toFixed(2)}, no RON/CASH line detected)`;
            }

            const totalRows = (rawStocks?.length || 0) + (cashValue > 0 ? 1 : 0);
            tradevilleRowsBadgeEl.textContent = `Loaded (${totalRows} rows)`;
            tradevilleRowsBadgeEl.style.display = "inline-flex";

            renderImportPreview(parsedPortfolio);
        } catch (e) {
            console.error(e);
            tradevilleParseStatusEl.textContent = "Failed ❌";
            tradevilleRowsBadgeEl.style.display = "none";
            alert(`Could not parse pasted Tradeville data: ${e.message}`);
        }
    });

    document.getElementById("generateReport").addEventListener("click", async function () {
        if (!parsedPortfolio) {
            alert("Please import your portfolio first (CSV upload or Tradeville copy/paste).");
            return;
        }

        const onlyPortfolioCompanies = document.getElementById("filterPortfolioToggle").checked;

        const totalStocksValue = Number(totalInvestmentEl.value);
        if (!Number.isFinite(totalStocksValue) || totalStocksValue <= 0) {
            alert("Total Portfolio Value (stocks-only) is missing or invalid.");
            return;
        }

        const ordersEnabled = document.getElementById("newInvestmentToggle").checked;
        const orderMode = ordersEnabled ? getOrderMode() : "none";
        const newInvestment = (ordersEnabled && orderMode === "buy") ? Number(document.getElementById("newInvestmentAmount").value) : 0;
        const minInvestmentAmount = (ordersEnabled && orderMode === "buy") ? Number(document.getElementById("minInvestmentAmount").value) : 0;
        const targetCashInput = (ordersEnabled && orderMode === "sell") ? Number(document.getElementById("targetCashAmount").value) : 0;
        const targetCashCurrency = (ordersEnabled && orderMode === "sell") ? String(document.getElementById("targetCashCurrency").value || "RON") : "RON";
        let targetCashAmount = 0;

        if (ordersEnabled && orderMode === "buy" && (!Number.isFinite(newInvestment) || newInvestment <= 0)) {
            alert("Please enter a valid New Investment Amount.");
            return;
        }
        if (ordersEnabled && orderMode === "buy" && (!Number.isFinite(minInvestmentAmount) || minInvestmentAmount < 0)) {
            alert("Please enter a valid Minimum Investment per Stock.");
            return;
        }
        if (ordersEnabled && orderMode === "sell" && (!isRequiredPositiveAmount(document.getElementById("targetCashAmount").value))) {
            alert("Please enter a valid desired cash amount.");
            return;
        }

        bvbLoadStatusEl.textContent = "Loading...";
        bvbRowsBadgeEl.style.display = "none";

        let bvbText;
        try {
            const cacheBuster = `t=${Date.now()}`;
            const resp = await fetch(`${BVB_LATEST_CSV_URL}?${cacheBuster}`, { cache: "no-store" });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            bvbText = await resp.text();
            bvbLoadStatusEl.textContent = "Loaded ✅";
        } catch (e) {
            console.error(e);
            bvbLoadStatusEl.textContent = "Failed ❌";
            alert("Could not load the latest BVB companies file from the repository.");
            return;
        }

        const bvbData = parseCSV(bvbText);
        const bvbCount = Array.isArray(bvbData) ? bvbData.filter(r => r && r.symbol).length : 0;
        bvbRowsBadgeEl.textContent = `Loaded (${bvbCount} rows)`;
        bvbRowsBadgeEl.style.display = "inline-flex";

        await loadFeeMetaIfNeeded();
        updateTargetCashConversionHint();

        try {
            targetCashAmount = (ordersEnabled && orderMode === "sell")
                ? convertTargetCashToRon(targetCashInput, targetCashCurrency)
                : 0;
        } catch (e) {
            alert(e.message);
            return;
        }

        generateReportAndSuggestions(
            bvbData,
            parsedPortfolio.portfolio,
            parsedPortfolio.totalStocksValue,
            parsedPortfolio.totalAllValue,
            onlyPortfolioCompanies,
            ordersEnabled ? orderMode : "none",
            ordersEnabled ? newInvestment : 0,
            ordersEnabled ? minInvestmentAmount : 0,
            ordersEnabled ? targetCashAmount : 0,
            parsedPortfolio.cashValue || 0,
            ordersEnabled ? targetCashInput : 0,
            ordersEnabled ? targetCashCurrency : "RON"
        );

        // ensure all new tables become sortable
        makeTablesSortable(document);
    });

    async function loadFeeMetaIfNeeded() {
        if (metaEurRon && metaFees) return;
        metaEurRon = null;
        metaFees = null;

        try {
            const cacheBuster = `t=${Date.now()}`;
            const [eurResp, feeResp] = await Promise.all([
                fetch(`${EUR_RON_JSON_URL}?${cacheBuster}`, { cache: "no-store" }),
                fetch(`${TRADEVILLE_FEES_JSON_URL}?${cacheBuster}`, { cache: "no-store" })
            ]);
            if (eurResp.ok) metaEurRon = await eurResp.json();
            if (feeResp.ok) metaFees = await feeResp.json();
        } catch (e) {
            console.warn("Failed to load fee meta json:", e);
            metaEurRon = null;
            metaFees = null;
        }
    }


    function renderFeeTierSection(totalRon, eurJson, feesJson) {
        const eurRon = Number(eurJson?.eur_ron);
        if (!Number.isFinite(eurRon) || eurRon <= 0) throw new Error("Invalid EUR/RON rate");

        const totalEur = totalRon / eurRon;
        const tier = pickTier(totalEur, feesJson);
        if (!tier) throw new Error("No tier found");

        const thr = Number(tier.threshold_eur_min ?? 0);
        const feePct = Number(tier.fee_percent ?? 0);
        const fixedEur = Number(tier.fixed_fee_eur ?? 0);

        feeTierNameEl.textContent = tier.name || "—";
        feeTierNameEl.className = `pill ${(tier.name || "").toUpperCase()}`;

        feeTierFeesBigEl.textContent = `${feePct.toFixed(2)}% + €${fixedEur.toFixed(2)}`;
        feeTierFeesSubEl.textContent = `All Inclusive commission for BVB (estimate)`;

        feeTierRuleEl.textContent = `≥ ${formatMoney(thr)} EUR`;

        const eurUpdated = eurJson?.updated_at_utc ? String(eurJson.updated_at_utc) : "—";
        const feesUpdated = feesJson?.updated_at_utc ? String(feesJson.updated_at_utc) : "—";

        feeTierSourcesEl.innerHTML = `
      Sources:
      <a href="${TRADEVILLE_FEES_JSON_URL}" target="_blank" rel="noopener noreferrer">tradeville_fees_ro_bvb.json</a>
      ·
      <a href="${EUR_RON_JSON_URL}" target="_blank" rel="noopener noreferrer">eur_ron.json</a>
    `;

        feePortfolioRonEl.textContent = formatMoney(totalRon) + " RON";
        feeEurRonEl.textContent = eurRon + ` (observed: ${eurJson?.observed_date_text || "—"})`;
        feePortfolioEurEl.textContent = formatMoney(totalEur) + " EUR";
        feeTierUpdatedEl.textContent = `fees: ${feesUpdated} · eur: ${eurUpdated}`;

        feeTierBlockEl.style.display = "block";
    }

    function hideFeeTierSection() {
        feeTierBlockEl.style.display = "none";
        feeTierNameEl.textContent = "—";
        feeTierNameEl.className = "pill";
        feeTierFeesBigEl.textContent = "—";
        feeTierFeesSubEl.textContent = "";
    }

    function hideImportPreview() {
        importPreviewBlockEl.style.display = "none";
        importPreviewTableEl.innerHTML = "";
        importPreviewRowsBadgeEl.style.display = "none";
    }

    // IMPORTANT: Do not round market_price in the UI either
    function renderImportPreview(state) {
        if (!state) return;

        const stockRows = (state.rawStocks || []).slice().sort((a, b) => b.value - a.value);
        const cash = state.cashValue || 0;

        const rowsHtml = stockRows.map(r => {
            const weight = (r.value / state.totalStocksValue) * 100;
            return `
        <tr>
          <td class="center">${escapeHtml(r.symbol)}</td>
          <td class="right">${r.value.toFixed(2)}</td>
          <td class="right">${r.market_price}</td>
          <td class="right">${weight.toFixed(2)}%</td>
        </tr>
      `;
        }).join("");

        const cashRowHtml = cash > 0 ? `
      <tr>
        <td class="center">CASH_VALUE</td>
        <td class="right">${cash.toFixed(2)}</td>
        <td class="right muted">—</td>
        <td class="right muted">excluded</td>
      </tr>
    ` : "";

        importPreviewTableEl.innerHTML = `
      <table class="small-table">
        <tr>
          <th>Symbol</th>
          <th>Value</th>
          <th>Market price</th>
          <th>Weight (stocks-only)</th>
        </tr>
        ${rowsHtml}
        ${cashRowHtml}
      </table>
    `;

        const totalRows = stockRows.length + (cash > 0 ? 1 : 0);
        importPreviewRowsBadgeEl.textContent = `Loaded (${totalRows} rows)`;
        importPreviewRowsBadgeEl.style.display = "inline-flex";
        importPreviewBlockEl.style.display = "block";

        // make preview sortable
        makeTablesSortable(importPreviewTableEl);
    }

    function escapeHtml(s) {
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatMoney(n) {
        return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function currentEurRonRate() {
        const eurRon = Number(metaEurRon?.eur_ron);
        return Number.isFinite(eurRon) && eurRon > 0 ? eurRon : null;
    }

    function formatRonEur(n) {
        const value = Number(n);
        if (!Number.isFinite(value)) return "—";
        const eurRon = currentEurRonRate();
        if (!eurRon) return `${formatMoney(value)} RON`;
        return `${formatMoney(value)} RON / ${formatMoney(value / eurRon)} EUR`;
    }

    function formatEurOnly(n) {
        const value = Number(n);
        const eurRon = currentEurRonRate();
        if (!Number.isFinite(value) || !eurRon) return "—";
        return `${formatMoney(value / eurRon)} EUR`;
    }

    // ---- Tradeville parsing helpers (as before) ----








    // ---- CSV parsing (as before) ----








    // IMPORTANT: price is displayed as-is (no rounding)
    function buildSuggestionDetailsLine(it, feeInfo) {
        if (!it || !Number.isFinite(it.shares) || !Number.isFinite(it.price) || it.shares <= 0) return "";

        if (Number.isFinite(it.amountGross) && Number.isFinite(it.fee) && Number.isFinite(it.totalCost)) {
            if (!feeInfo || !Number.isFinite(feeInfo.eurRon)) {
                return `${it.shares} shares × ${it.price} ≈ ${formatRonEur(it.amountGross)}`;
            }
            return `${it.shares} shares × ${it.price} + ${formatRonEur(it.fee)} ≈ ${formatRonEur(it.totalCost)}`;
        }

        const gross = it.shares * it.price;
        if (!feeInfo || !Number.isFinite(feeInfo.eurRon)) {
            return `${it.shares} shares × ${it.price} ≈ ${formatRonEur(gross)}`;
        }
        const variableFee = gross * (feeInfo.feePercent / 100);
        const fixedFeeRon = feeInfo.fixedFeeEur * feeInfo.eurRon;
        const fee = variableFee + fixedFeeRon;
        return `${it.shares} shares × ${it.price} + ${formatRonEur(fee)} ≈ ${formatRonEur(gross + fee)}`;
    }

    function generateReportAndSuggestions(
        bvbData,
        portfolioWithValues,
        totalStocksValue,
        totalAllValue,
        onlyPortfolioCompanies,
        orderMode,
        newInvestment,
        minInvestmentAmount,
        targetCashAmount,
        currentCashValue,
        targetCashInput = targetCashAmount,
        targetCashCurrency = "RON"
    ) {
        const reportDiv = document.getElementById("report");
        const suggestionsDiv = document.getElementById("investmentSuggestions");
        const afterDiv = document.getElementById("afterSuggestions");

        suggestionsDiv.innerHTML = "";
        afterDiv.innerHTML = "";
        hideFeeTierSection();

        let bvbUniverse = bvbData;
        if (onlyPortfolioCompanies) {
            const owned = new Set(portfolioWithValues.map(p => p.symbol));
            bvbUniverse = bvbData.filter(b => owned.has(b.symbol));
        }

        const totalBvbWeight = bvbUniverse.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
        const normalizedBvb = bvbUniverse.map(c => ({
            symbol: c.symbol,
            bvbWeight: Number(c.weight) || 0,
            normalizedWeight: ((Number(c.weight) || 0) / totalBvbWeight) * 100
        }));

        let sumDiff = 0;
        const rowsHtml = normalizedBvb.map(c => {
            const p = portfolioWithValues.find(x => x.symbol === c.symbol);
            const pWeight = p ? p.weight : 0;

            const diffPercent = pWeight - c.normalizedWeight;
            const diffValue = (diffPercent / 100) * totalStocksValue;
            sumDiff += diffValue;

            const cls = diffValue >= 0 ? "positive-difference" : "negative-difference";

            return `
        <tr>
          <td>${c.symbol}</td>
          <td>${c.bvbWeight.toFixed(2)}%</td>
          <td>${c.normalizedWeight.toFixed(2)}%</td>
          <td>${pWeight.toFixed(2)}%</td>
          <td class="${cls}">${formatRonEur(diffValue)} (${diffPercent.toFixed(2)}%)</td>
        </tr>
      `;
        }).join("");

        reportDiv.innerHTML = `
      <h3>Portfolio Comparison</h3>
      <table>
        <tr>
          <th>Symbol</th>
          <th>BVB Weight</th>
          <th>Normalized BVB Weight</th>
          <th>Portfolio Weight</th>
          <th>Difference (Val and %)</th>
        </tr>
        ${rowsHtml}
      </table>
      <div style="margin-top:10px;" class="muted">
        Sanity check: Σ Difference ≈ <b>${formatZeroNoMinus(sumDiff)}</b>
      </div>
    `;

        // make report table sortable
        makeTablesSortable(reportDiv);

        if (orderMode === "none") return;

        const feeInfo = computeFeeInfoForCards(totalAllValue, metaEurRon, metaFees);

        // Fee tier block first (best effort)
        if (metaEurRon && metaFees) {
            try {
                renderFeeTierSection(totalAllValue, metaEurRon, metaFees);
                suggestionsDiv.appendChild(feeTierBlockEl);
            } catch (e) {
                console.warn("Fee tier render failed:", e);
                hideFeeTierSection();
            }
        }

        if (orderMode === "buy") {
            const suggestions = computeSuggestionsWithMarketPrices(
                normalizedBvb,
                portfolioWithValues,
                totalStocksValue,
                newInvestment,
                minInvestmentAmount,
                feeInfo
            );

            const allocatedTotal = suggestions.investedTotal ?? suggestions.items.reduce((sum, it) => sum + (it.totalCost ?? it.amount), 0);
            const allocatedGross = suggestions.investedGross ?? suggestions.items.reduce((sum, it) => sum + (it.amountGross ?? it.amount), 0);
            const unallocated = suggestions.unallocated;
            const unallocCls = unallocated < -0.005 ? "neg" : "";

            const listItems = suggestions.items.map(it => {
                const detailsLine = buildSuggestionDetailsLine(it, feeInfo);
                return `
        <li>
          <div class="investment-symbol">${it.symbol}</div>
          <div class="investment-amount">BUY ${it.shares} shares</div>
          ${detailsLine ? `<div class="suggestion-details">${detailsLine}</div>` : ``}
        </li>
      `;
            }).join("");

            const feeTierHtml = suggestionsDiv.innerHTML;
            suggestionsDiv.innerHTML = `
      <h3>Buy Suggestions</h3>
      ${feeTierHtml}
      <div class="total-investment" style="text-align:left; line-height:1.65; max-width:760px; margin-left:auto; margin-right:auto;">
        <div><b>Available cash:</b> ${formatRonEur(newInvestment)}</div>
        <div><b>Allocated total:</b> ${formatRonEur(allocatedTotal)}</div>
        <div><b>Unallocated:</b> <span class="${unallocCls}">${formatRonEur(unallocated)}</span></div>
      </div>
      <div class="muted" style="margin-top:6px;">
        Allocated includes estimated fees per symbol (variable + fixed). Gross-only invested: ${formatRonEur(allocatedGross)}.
      </div>
      <ul>${listItems || `<li><div class="investment-symbol">No practical buy order found</div><div class="suggestion-details">Try lowering the minimum investment or increasing available cash.</div></li>`}</ul>
      <div class="muted" style="margin-top:10px;">
        Notes: Suggestions are constrained by market prices (whole shares). Fees shown are estimates.
      </div>
    `;

            const after = portfolioAfterBuySuggestions(
                portfolioWithValues,
                suggestions.items.map(it => ({ symbol: it.symbol, amount: (it.amountGross ?? it.amount), shares: it.shares, price: it.price })),
                totalStocksValue
            );

            renderAfterSuggestionsTable(afterDiv, normalizedBvb, after, totalStocksValue, suggestions, "buy");
            makeTablesSortable(afterDiv);
            return;
        }

        if (orderMode === "sell") {
            const suggestions = computeSellSuggestionsWithMarketPrices(
                normalizedBvb,
                portfolioWithValues,
                totalStocksValue,
                targetCashAmount,
                currentCashValue,
                feeInfo
            );

            const netNeeded = Math.max(0, targetCashAmount - currentCashValue);
            const netRaised = suggestions.netRaised ?? suggestions.items.reduce((sum, it) => sum + (it.netProceeds ?? 0), 0);
            const grossSold = suggestions.grossSold ?? suggestions.items.reduce((sum, it) => sum + (it.amountGross ?? 0), 0);
            const feesTotal = suggestions.feesTotal ?? suggestions.items.reduce((sum, it) => sum + (it.fee ?? 0), 0);
            const finalCash = currentCashValue + netRaised;
            const shortfall = Math.max(0, targetCashAmount - finalCash);
            const shortfallCls = shortfall > 0.005 ? "neg" : "";

            const listItems = suggestions.items.map(it => {
                const detailsLine = buildSellSuggestionDetailsLine(it, feeInfo);
                return `
        <li>
          <div class="investment-symbol">${it.symbol}</div>
          <div class="investment-amount">SELL ${it.shares} shares</div>
          ${detailsLine ? `<div class="suggestion-details">${detailsLine}</div>` : ``}
        </li>
      `;
            }).join("");

            const feeTierHtml = suggestionsDiv.innerHTML;
            suggestionsDiv.innerHTML = `
      <h3>Sell Suggestions</h3>
      ${feeTierHtml}
      <div class="total-investment" style="text-align:left; line-height:1.65; max-width:760px; margin-left:auto; margin-right:auto;">
        <div><b>Current cash:</b> ${formatRonEur(currentCashValue)}</div>
        <div><b>Target cash:</b> ${targetCashDisplay(targetCashInput, targetCashCurrency, targetCashAmount)}</div>
        <div><b>Net needed from sales:</b> ${formatRonEur(netNeeded)}</div>
        <div><b>Estimated final cash:</b> ${formatRonEur(finalCash)}</div>
        <div><b>Shortfall:</b> <span class="${shortfallCls}">${formatRonEur(shortfall)}</span></div>
      </div>
      ${netRaised > netNeeded + 0.005 ? `<div class="card-like" style="margin-top:10px; border-color:rgba(108,99,255,.35); background:rgba(108,99,255,.06);">
        <b>Actual sale is higher than strictly needed:</b> desired final cash ${targetCashDisplay(targetCashInput, targetCashCurrency, targetCashAmount)}, net needed from sales ${formatRonEur(netNeeded)}, estimated net raised ${formatRonEur(netRaised)}, extra sold net ${formatRonEur(netRaised - netNeeded)}.
        Gross sold before fees: <b>${formatRonEur(grossSold)}</b>.
      </div>` : ``}
      <div class="muted" style="margin-top:6px;">
        Net needed from sales: ${formatRonEur(netNeeded)} · Gross sold: ${formatRonEur(grossSold)} · Estimated fees: ${formatRonEur(feesTotal)} · Net raised: ${formatRonEur(netRaised)}.
      </div>
      <ul>${listItems || `<li><div class="investment-symbol">No sale needed</div><div class="suggestion-details">Your existing CASH_VALUE already reaches the target cash amount.</div></li>`}</ul>
      <div class="muted" style="margin-top:10px;">
        Notes: Sell suggestions use whole shares, current market prices from the import, and estimated TradeVille fees. Existing CASH_VALUE is counted first.
      </div>
    `;

            const after = portfolioAfterSellSuggestions(
                portfolioWithValues,
                suggestions.items.map(it => ({ symbol: it.symbol, amount: (it.amountGross ?? it.amount), shares: it.shares, price: it.price })),
                totalStocksValue
            );

            renderAfterSuggestionsTable(afterDiv, normalizedBvb, after, totalStocksValue, suggestions, "sell", finalCash);
            makeTablesSortable(afterDiv);
        }
    }

    function buildSellSuggestionDetailsLine(it, feeInfo) {
        if (!it || !Number.isFinite(it.shares) || !Number.isFinite(it.price) || it.shares <= 0) return "";
        const gross = Number.isFinite(it.amountGross) ? it.amountGross : it.shares * it.price;
        const fee = Number.isFinite(it.fee) ? it.fee : 0;
        const net = Number.isFinite(it.netProceeds) ? it.netProceeds : gross - fee;
        if (!feeInfo || !Number.isFinite(feeInfo.eurRon)) {
            return `${it.shares} shares × ${it.price} ≈ ${formatRonEur(gross)} gross`;
        }
        return `${it.shares} shares × ${it.price} - ${formatRonEur(fee)} fees ≈ ${formatRonEur(net)} net`;
    }

    // Sell enough to reach target cash, while trying to keep the portfolio as close as possible
    // to the normalized BET weights AFTER the sale.
    //
    // Key idea:
    //   For a final gross sale G, the final stock total is T1 = T0 - G.
    //   The ideal remaining value for each symbol is targetWeight * T1.
    //   So the ideal gross amount to sell from a symbol is:
    //       currentValue - targetWeight * T1
    //   Then we convert those ideal values to whole-share orders and locally improve the result.

    // ✅ Objective-based greedy + sweep-to-spend + fee-aware + min-per-stock respected when opening new symbols



    function renderAfterSuggestionsTable(afterDiv, normalizedBvb, after, oldTotalStocksValue, suggestions, mode, finalCash) {
        const { list, newTotal, invested, sold } = after;
        const newW = new Map(list.map(x => [x.symbol, x.weight]));

        const rows = normalizedBvb.map(c => {
            const wNew = newW.get(c.symbol) || 0;
            const diffNewPct = wNew - c.normalizedWeight;
            const diffNewVal = (diffNewPct / 100) * newTotal;
            const cls = diffNewVal >= 0 ? "positive-difference" : "negative-difference";

            return `
        <tr>
          <td>${c.symbol}</td>
          <td>${c.normalizedWeight.toFixed(2)}%</td>
          <td>${wNew.toFixed(2)}%</td>
          <td class="${cls}">${formatRonEur(diffNewVal)} (${diffNewPct.toFixed(2)}%)</td>
        </tr>
      `;
        }).join("");

        afterDiv.innerHTML = `
      <div class="spacer-24"></div>
      <h3>Portfolio after applying ${mode === "sell" ? "sell" : "buy"} suggestions</h3>
      <div class="muted" style="margin-bottom:10px;">
        New stocks total: <b>${formatRonEur(newTotal)}</b> (old: ${formatRonEur(oldTotalStocksValue)}) ·
        ${mode === "sell"
            ? `Sold (gross): <b>${formatRonEur(sold || 0)}</b> · Estimated final cash: <b>${formatRonEur(Number(finalCash || 0))}</b>`
            : `Invested (gross): <b>${formatRonEur(invested)}</b> · Unallocated: <b>${formatRonEur(suggestions.unallocated)}</b>`}
      </div>
      <table>
        <tr>
          <th>Symbol</th>
          <th>Normalized BVB Weight</th>
          <th>New Portfolio Weight</th>
          <th>New Difference (Val and %)</th>
        </tr>
        ${rows}
      </table>
    `;
    }

    // Make any tables already in DOM sortable (safe to call once)
    makeTablesSortable(document);
