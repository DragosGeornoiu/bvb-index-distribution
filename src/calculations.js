// Pure portfolio calculation helpers used by the tracker UI and by automated tests.
// Keep this file free of DOM access so it can run in both browser and Node.js.

export function pickTier(totalEur, feesJson) {
        const tiers = Array.isArray(feesJson?.tiers) ? feesJson.tiers.slice() : [];
        tiers.sort((a, b) => (b.threshold_eur_min ?? 0) - (a.threshold_eur_min ?? 0));
        for (const t of tiers) {
            const thr = Number(t.threshold_eur_min ?? 0);
            if (totalEur >= thr) return t;
        }
        return tiers[tiers.length - 1] || null;
    }

export function parseTradevilleToRows(text) {
        const lines = String(text)
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .split("\n")
            .map(l => l.trim())
            .filter(l => l.length > 0);

        const out = [];
        let detectedCash = null;

        for (const line of lines) {
            const normalized = line.replace(/\u00A0/g, " ");
            const parts = splitLooseColumns(normalized);
            if (parts.length < 4) continue;

            if (parts[0].toUpperCase() === "RON") {
                const cash = findBestCashLike(parts);
                if (Number.isFinite(cash) && cash > 0) detectedCash = cash;
                continue;
            }

            const sym = parts[0].trim();
            if (!/^[A-Z0-9]{1,6}$/.test(sym)) continue;

            const lastToken = String(parts[parts.length - 1] || "");
            if (!/%$/.test(lastToken)) continue;

            const evaluare = findEvaluareFromEnd(parts);
            if (!Number.isFinite(evaluare) || evaluare <= 0) continue;

            const marketPrice = findMarketPriceNearQuantity(parts);
            if (!Number.isFinite(marketPrice) || marketPrice <= 0) continue;

            out.push({ symbol: sym, value: evaluare, market_price: marketPrice });
        }

        if (Number.isFinite(detectedCash) && detectedCash > 0) {
            out.push({ symbol: "CASH_VALUE", value: detectedCash, market_price: "" });
        }

        const merged = new Map();
        for (const r of out) {
            const k = String(r.symbol).trim();
            if (!k) continue;

            const prev = merged.get(k);
            if (!prev) {
                merged.set(k, { symbol: k, value: Number(r.value) || 0, market_price: r.market_price });
            } else {
                prev.value += (Number(r.value) || 0);
                if (Number.isFinite(Number(r.market_price)) && Number(r.market_price) > 0) {
                    prev.market_price = r.market_price;
                }
            }
        }

        return Array.from(merged.values());
    }

export function splitLooseColumns(line) {
        if (line.includes("\t")) return line.split("\t").map(s => s.trim()).filter(s => s !== "");
        return line.split(/\s{2,}/g).map(s => s.trim()).filter(s => s !== "");
    }

export function parseMoney(raw) {
        if (raw == null) return NaN;
        let s = String(raw).trim();
        s = s.replace(/[A-Za-z]/g, "").trim();
        s = s.replace(/%/g, "").trim();
        s = s.replace(/\s/g, "");
        if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
        if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
        const n = Number(s);
        return Number.isFinite(n) ? n : NaN;
    }

export function isLikelyIntegerQuantityToken(tok) {
        const s = String(tok).replace(/\s/g, "");
        return /^\d{1,3}(,\d{3})*$/.test(s) || /^\d+$/.test(s);
    }

export function isLikelyPriceToken(tok) {
        const n = parseMoney(tok);
        return Number.isFinite(n) && n > 0 && n < 100000;
    }

export function findMarketPriceNearQuantity(parts) {
        for (let i = 1; i < parts.length - 1; i++) {
            const t = parts[i];
            if (!isLikelyIntegerQuantityToken(t)) continue;
            for (let j = i + 1; j < Math.min(i + 4, parts.length); j++) {
                const cand = parts[j];
                if (isLikelyPriceToken(cand)) {
                    const price = parseMoney(cand);
                    if (String(cand).includes("%")) continue;
                    return price;
                }
            }
        }
        return NaN;
    }

export function findEvaluareFromEnd(parts) {
        let hits = 0;
        let firstMoney = NaN;
        for (let i = parts.length - 1; i >= 0; i--) {
            const tok = String(parts[i] ?? "");
            if (tok.endsWith("%")) continue;
            const n = parseMoney(tok);
            if (!Number.isFinite(n)) continue;
            hits++;
            if (hits === 1) firstMoney = n;
            if (hits === 2) return n;
        }
        return firstMoney;
    }

export function findBestCashLike(parts) {
        let best = NaN;
        for (const p of parts) {
            const n = parseMoney(p);
            if (!Number.isFinite(n)) continue;
            if (!Number.isFinite(best) || n > best) best = n;
        }
        return best;
    }

export function detectDelimiter(headerLine) {
        const commaCount = (headerLine.match(/,/g) || []).length;
        const semiCount = (headerLine.match(/;/g) || []).length;
        const tabCount = (headerLine.match(/\t/g) || []).length;
        if (tabCount > commaCount && tabCount > semiCount) return "\t";
        if (semiCount > commaCount) return ";";
        return ",";
    }

export function splitCsvLine(line, delimiter) {
        const out = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                const next = line[i + 1];
                if (inQuotes && next === '"') { cur += '"'; i++; }
                else inQuotes = !inQuotes;
                continue;
            }
            if (!inQuotes && ch === delimiter) { out.push(cur); cur = ""; continue; }
            cur += ch;
        }
        out.push(cur);
        return out.map(v => v.trim());
    }

export function toNumberMaybe(raw) {
        if (raw == null) return raw;
        const s = String(raw).trim();
        if (s === "") return s;
        const noPct = s.replace(/%/g, "").trim();
        const normalized = noPct.replace(/\s/g, "");
        const n = Number(normalized);
        if (!Number.isNaN(n)) return n;
        const commaDecimal = normalized.replace(",", ".");
        const n2 = Number(commaDecimal);
        if (!Number.isNaN(n2)) return n2;
        return s;
    }

export function normalizeHeader(h) {
        const s = String(h || "").trim().toLowerCase();
        if (s === "price") return "market_price";
        if (s === "marketprice") return "market_price";
        if (s === "market_price") return "market_price";
        if (s === "pret_piata") return "market_price";
        if (s === "pretpiata") return "market_price";
        return s;
    }

export function parseCSV(data) {
        const lines = data
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .split("\n")
            .map(l => l.trim())
            .filter(l => l !== "" && !l.startsWith("#"));
        if (lines.length === 0) return [];
        const delimiter = detectDelimiter(lines[0]);
        const rawHeaders = splitCsvLine(lines[0], delimiter).map(h => h.trim());
        const headers = rawHeaders.map(normalizeHeader);

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const values = splitCsvLine(lines[i], delimiter);
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = toNumberMaybe(values[idx] ?? ""); });
            rows.push(obj);
        }
        return rows;
    }

export function portfolioValues(rows) {
        const cleaned = rows
            .map(r => ({
                symbol: String(r.symbol ?? "").trim(),
                value: Number(r.value),
                market_price: r.market_price === "" ? "" : Number(r.market_price)
            }))
            .filter(r => r.symbol !== "" && Number.isFinite(r.value));

        const cashSymbols = new Set(["CASH_VALUE", "CASH", "CASH_RON", "RON"]);
        const cashRows = cleaned.filter(r => cashSymbols.has(r.symbol.toUpperCase()));
        const stockRows = cleaned.filter(r => !cashSymbols.has(r.symbol.toUpperCase()));

        const bad = stockRows.filter(r => !(Number.isFinite(Number(r.market_price)) && Number(r.market_price) > 0));
        if (bad.length > 0) throw new Error(`Missing or invalid market_price for: ${bad.map(b => b.symbol).join(", ")}`);

        const cashValue = cashRows.reduce((s, r) => s + r.value, 0);
        const totalStocksValue = stockRows.reduce((s, r) => s + r.value, 0);
        const totalAllValue = totalStocksValue + cashValue;
        if (totalStocksValue <= 0) throw new Error("Total stocks value is 0.");

        const portfolio = stockRows.map(r => ({
            symbol: r.symbol,
            value: r.value,
            market_price: Number(r.market_price),
            weight: (r.value / totalStocksValue) * 100
        }));

        return { portfolio, totalStocksValue, cashValue, totalAllValue, rawStocks: stockRows };
    }

export function formatZeroNoMinus(x) {
        if (Math.abs(x) < 0.005) return "0.00";
        return x.toFixed(2);
    }

export function computeFeeInfoForCards(totalRon, eurJson, feesJson) {
        try {
            const eurRon = Number(eurJson?.eur_ron);
            if (!Number.isFinite(eurRon) || eurRon <= 0) return null;
            const totalEur = totalRon / eurRon;
            const tier = pickTier(totalEur, feesJson);
            if (!tier) return null;

            return {
                eurRon,
                tierName: tier.name || null,
                feePercent: Number(tier.fee_percent ?? 0),
                fixedFeeEur: Number(tier.fixed_fee_eur ?? 0)
            };
        } catch {
            return null;
        }
    }

export function computeSellSuggestionsWithMarketPrices(
        normalizedBvb,
        portfolioWithValues,
        totalStocksValue,
        targetCashAmount,
        currentCashValue,
        feeInfo
    ) {
        const netNeeded = Math.max(0, targetCashAmount - currentCashValue);
        if (netNeeded <= 0.005) {
            return { items: [], netRaised: 0, grossSold: 0, feesTotal: 0, shortfall: 0 };
        }

        const currentBySymbol = new Map(portfolioWithValues.map(p => [p.symbol, p]));
        const targets = normalizedBvb.map(c => ({ symbol: c.symbol, t: c.normalizedWeight / 100 }));
        const targetBySymbol = new Map(targets.map(x => [x.symbol, x.t]));

        const feePct = (feeInfo && Number.isFinite(feeInfo.feePercent)) ? (feeInfo.feePercent / 100) : 0;
        const fixedRon =
            (feeInfo && Number.isFinite(feeInfo.fixedFeeEur) && Number.isFinite(feeInfo.eurRon))
                ? (feeInfo.fixedFeeEur * feeInfo.eurRon)
                : 0;

        const universe = [];
        for (const x of targets) {
            const p = currentBySymbol.get(x.symbol);
            if (!p) continue;
            const price = Number(p.market_price);
            const value = Number(p.value);
            if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(value) || value <= 0) continue;
            const maxShares = Math.max(0, Math.floor(value / price));
            if (maxShares <= 0) continue;
            universe.push({
                symbol: x.symbol,
                target: x.t,
                price,
                baseValue: value,
                maxShares
            });
        }

        if (!universe.length) {
            return { items: [], netRaised: 0, grossSold: 0, feesTotal: 0, shortfall: netNeeded };
        }

        function emptyState() {
            const m = new Map();
            for (const u of universe) m.set(u.symbol, 0);
            return m;
        }

        function cloneState(state) {
            return new Map(state);
        }

        function grossForSymbol(u, shares) {
            return Math.max(0, shares) * u.price;
        }

        function feeFor(gross, shares) {
            if (shares <= 0 || gross <= 0) return 0;
            return gross * feePct + fixedRon;
        }

        function totals(state) {
            let grossSold = 0;
            let feesTotal = 0;
            let netRaised = 0;
            let orderCount = 0;

            for (const u of universe) {
                const shares = state.get(u.symbol) || 0;
                if (shares <= 0) continue;
                const gross = grossForSymbol(u, shares);
                const fee = feeFor(gross, shares);
                grossSold += gross;
                feesTotal += fee;
                netRaised += Math.max(0, gross - fee);
                orderCount += 1;
            }

            return { grossSold, feesTotal, netRaised, orderCount };
        }

        function objective(state) {
            const t = totals(state);
            const finalStocksTotal = totalStocksValue - t.grossSold;
            if (!Number.isFinite(finalStocksTotal) || finalStocksTotal <= 0) return Number.POSITIVE_INFINITY;

            let sumSq = 0;
            for (const x of targets) {
                const u = universe.find(uu => uu.symbol === x.symbol);
                const baseValue = u ? u.baseValue : (currentBySymbol.get(x.symbol)?.value || 0);
                const shares = u ? (state.get(x.symbol) || 0) : 0;
                const remainingValue = Math.max(0, baseValue - (u ? grossForSymbol(u, shares) : 0));
                const weight = remainingValue / finalStocksTotal;
                const err = weight - x.t;
                sumSq += err * err;
            }
            return sumSq;
        }

        function score(state, requireTarget) {
            const t = totals(state);
            const obj = objective(state);
            const shortfall = Math.max(0, netNeeded - t.netRaised);
            const overshoot = Math.max(0, t.netRaised - netNeeded);

            // Huge penalty for not reaching the requested cash target.
            // Small penalty for overshooting, because whole shares make exact matching impossible.
            const shortPenalty = (shortfall / Math.max(1, netNeeded)) ** 2 * 1000000;
            const overPenalty = (overshoot / Math.max(1, netNeeded)) ** 2 * 10;
            const orderPenalty = t.orderCount * 1e-10;

            if (requireTarget && shortfall > 0.005) return Number.POSITIVE_INFINITY;
            return obj + shortPenalty + overPenalty + orderPenalty;
        }

        function clampShares(u, shares) {
            return Math.max(0, Math.min(u.maxShares, Math.round(shares)));
        }

        function buildIdealState(grossTarget, roundMode) {
            const state = emptyState();
            const finalStocksTotal = Math.max(0, totalStocksValue - grossTarget);

            for (const u of universe) {
                const desiredGross = u.baseValue - (u.target * finalStocksTotal);
                const rawShares = desiredGross / u.price;
                let shares;
                if (roundMode === "floor") shares = Math.floor(rawShares);
                else if (roundMode === "ceil") shares = Math.ceil(rawShares);
                else shares = Math.round(rawShares);
                state.set(u.symbol, clampShares(u, shares));
            }

            return state;
        }

        function addBestShare(state) {
            let best = null;
            let bestScore = Number.POSITIVE_INFINITY;

            for (const u of universe) {
                const currentShares = state.get(u.symbol) || 0;
                if (currentShares >= u.maxShares) continue;

                const candidate = cloneState(state);
                candidate.set(u.symbol, currentShares + 1);
                const sc = score(candidate, false);

                if (sc < bestScore - 1e-15) {
                    bestScore = sc;
                    best = candidate;
                }
            }

            return best;
        }

        function removeBestShareIfUseful(state) {
            const currentScore = score(state, true);
            let best = null;
            let bestScore = currentScore;

            for (const u of universe) {
                const currentShares = state.get(u.symbol) || 0;
                if (currentShares <= 0) continue;

                const candidate = cloneState(state);
                candidate.set(u.symbol, currentShares - 1);

                const candidateTotals = totals(candidate);
                if (candidateTotals.netRaised + 0.005 < netNeeded) continue;

                const sc = score(candidate, true);
                if (sc < bestScore - 1e-15) {
                    bestScore = sc;
                    best = candidate;
                }
            }

            return best;
        }

        function swapBestShareIfUseful(state) {
            const currentScore = score(state, true);
            let best = null;
            let bestScore = currentScore;

            for (const from of universe) {
                const fromShares = state.get(from.symbol) || 0;
                if (fromShares <= 0) continue;

                for (const to of universe) {
                    if (from.symbol === to.symbol) continue;
                    const toShares = state.get(to.symbol) || 0;
                    if (toShares >= to.maxShares) continue;

                    const candidate = cloneState(state);
                    candidate.set(from.symbol, fromShares - 1);
                    candidate.set(to.symbol, toShares + 1);

                    const candidateTotals = totals(candidate);
                    if (candidateTotals.netRaised + 0.005 < netNeeded) continue;

                    const sc = score(candidate, true);
                    if (sc < bestScore - 1e-15) {
                        bestScore = sc;
                        best = candidate;
                    }
                }
            }

            return best;
        }

        function improveState(initialState) {
            let state = cloneState(initialState);

            // First make sure we raise enough net cash.
            let guard = 0;
            while (guard++ < 300000 && totals(state).netRaised + 0.005 < netNeeded) {
                const next = addBestShare(state);
                if (!next) break;
                state = next;
            }

            // Then remove unnecessary overshoot if it improves the final allocation.
            guard = 0;
            while (guard++ < 50000) {
                const next = removeBestShareIfUseful(state);
                if (!next) break;
                state = next;
            }

            // Finally try one-for-one swaps between symbols to improve the final BET closeness.
            guard = 0;
            while (guard++ < 5000) {
                const next = swapBestShareIfUseful(state);
                if (!next) break;
                state = next;
            }

            return state;
        }

        const candidates = [];
        const maxPossibleGross = universe.reduce((s, u) => s + (u.maxShares * u.price), 0);
        const maxPossibleNet = (() => {
            const all = emptyState();
            for (const u of universe) all.set(u.symbol, u.maxShares);
            return totals(all).netRaised;
        })();

        if (maxPossibleNet + 0.005 < netNeeded) {
            const all = emptyState();
            for (const u of universe) all.set(u.symbol, u.maxShares);
            candidates.push(all);
        } else {
            const maxOrders = Math.max(1, universe.length);
            const baseGrossEstimate = netNeeded / Math.max(0.000001, 1 - feePct);

            for (let assumedOrders = 1; assumedOrders <= maxOrders; assumedOrders++) {
                const grossEstimate = (netNeeded + assumedOrders * fixedRon) / Math.max(0.000001, 1 - feePct);
                for (const multiplier of [0.985, 0.995, 1, 1.005, 1.015]) {
                    const grossTarget = Math.max(0, Math.min(maxPossibleGross, grossEstimate * multiplier));
                    candidates.push(buildIdealState(grossTarget, "floor"));
                    candidates.push(buildIdealState(grossTarget, "round"));
                    candidates.push(buildIdealState(grossTarget, "ceil"));
                }
            }

            // Also seed from a pure proportional sale, useful when the requested cash is very large.
            const proportional = emptyState();
            const propRatio = Math.max(0, Math.min(1, baseGrossEstimate / Math.max(1, totalStocksValue)));
            for (const u of universe) proportional.set(u.symbol, clampShares(u, (u.baseValue * propRatio) / u.price));
            candidates.push(proportional);
        }

        let bestState = null;
        let bestScore = Number.POSITIVE_INFINITY;
        let bestNetOvershoot = Number.POSITIVE_INFINITY;

        for (const c of candidates) {
            const improved = improveState(c);
            const t = totals(improved);
            const sc = score(improved, false);
            const overshoot = Math.max(0, t.netRaised - netNeeded);
            const shortfall = Math.max(0, netNeeded - t.netRaised);

            if (
                sc < bestScore - 1e-15 ||
                (Math.abs(sc - bestScore) <= 1e-15 && shortfall <= 0.005 && overshoot < bestNetOvershoot)
            ) {
                bestScore = sc;
                bestNetOvershoot = overshoot;
                bestState = improved;
            }
        }

        if (!bestState) bestState = emptyState();

        const items = [];
        let grossSold = 0;
        let feesTotal = 0;
        let netRaised = 0;

        for (const u of universe) {
            const shares = bestState.get(u.symbol) || 0;
            if (shares <= 0) continue;
            const gross = grossForSymbol(u, shares);
            const fee = feeFor(gross, shares);
            const netProceeds = Math.max(0, gross - fee);
            items.push({
                symbol: u.symbol,
                shares,
                price: u.price,
                amountGross: gross,
                fee,
                netProceeds,
                amount: gross
            });
            grossSold += gross;
            feesTotal += fee;
            netRaised += netProceeds;
        }

        items.sort((a, b) => {
            const aw = targetBySymbol.get(a.symbol) ?? 0;
            const bw = targetBySymbol.get(b.symbol) ?? 0;
            return bw - aw;
        });

        return {
            items,
            netRaised,
            grossSold,
            feesTotal,
            shortfall: Math.max(0, netNeeded - netRaised)
        };
    }

export function computeSuggestionsWithMarketPrices(
        normalizedBvb,
        portfolioWithValues,
        totalStocksValue,
        cashToInvest,
        minPerStock,
        feeInfo
    ) {
        const currentBySymbol = new Map(portfolioWithValues.map(p => [p.symbol, p]));
        const targets = normalizedBvb.map(c => ({ symbol: c.symbol, t: c.normalizedWeight / 100 }));

        const T0 = totalStocksValue;
        const cash0 = cashToInvest;

        const feePct = (feeInfo && Number.isFinite(feeInfo.feePercent)) ? (feeInfo.feePercent / 100) : 0;
        const fixedRon =
            (feeInfo && Number.isFinite(feeInfo.fixedFeeEur) && Number.isFinite(feeInfo.eurRon))
                ? (feeInfo.fixedFeeEur * feeInfo.eurRon)
                : 0;

        const minGross = Number.isFinite(minPerStock) && minPerStock > 0 ? minPerStock : 0;

        // universe: symbols with valid market price
        const universe = [];
        for (const x of targets) {
            const p = currentBySymbol.get(x.symbol);
            const price = p ? Number(p.market_price) : NaN;
            if (!Number.isFinite(price) || price <= 0) continue;
            universe.push({
                symbol: x.symbol,
                target: x.t,
                price,
                baseValue: p ? Number(p.value) : 0
            });
        }
        if (universe.length === 0) return { items: [], unallocated: cash0, investedGross: 0, investedTotal: 0 };

        const bySym = new Map(universe.map(u => [u.symbol, u]));

        // state per symbol
        const st = new Map();
        for (const u of universe) st.set(u.symbol, { shares: 0, gross: 0 });

        function feeFor(gross, shares) {
            if (shares <= 0) return 0;
            return gross * feePct + fixedRon;
        }
        function totalCostFor(gross, shares) {
            return gross + feeFor(gross, shares);
        }

        function currentTotalGrossInvested() {
            let s = 0;
            for (const v of st.values()) s += v.gross;
            return s;
        }
        function currentTotalCostInvested() {
            let s = 0;
            for (const u of universe) {
                const v = st.get(u.symbol);
                s += totalCostFor(v.gross, v.shares);
            }
            return s;
        }

        // If opening a new symbol (shares=0), ensure we can reach minGross for that symbol
        // within current cashRemaining (including fees).
        function canOpenSymbolWithMin(sym, cashRemaining) {
            if (minGross <= 0) return true;
            const u = bySym.get(sym);
            if (!u) return false;
            const reqShares = Math.ceil(minGross / u.price);
            const reqGross = reqShares * u.price;
            const reqTotal = totalCostFor(reqGross, reqShares); // includes fixed fee once
            return reqTotal <= cashRemaining + 1e-9;
        }

        function evalBuyOne(sym) {
            const u = bySym.get(sym);
            if (!u) return null;

            const cur = st.get(sym);
            const nextShares = cur.shares + 1;
            const nextGross = cur.gross + u.price;

            const prevCost = totalCostFor(cur.gross, cur.shares);
            const nextCost = totalCostFor(nextGross, nextShares);
            const deltaCost = nextCost - prevCost;

            const investedGross = currentTotalGrossInvested();
            const T_before = T0 + investedGross;
            const T_after  = T_before + u.price;

            let delta = 0;
            for (const uu of universe) {
                const vv = st.get(uu.symbol);
                const grossBefore = vv.gross;
                const grossAfter  = vv.gross + (uu.symbol === sym ? u.price : 0);

                const newValBefore = uu.baseValue + grossBefore;
                const newValAfter  = uu.baseValue + grossAfter;

                const wBefore = newValBefore / T_before;
                const wAfter  = newValAfter  / T_after;

                const errBefore = wBefore - uu.target;
                const errAfter  = wAfter  - uu.target;

                delta += (errAfter * errAfter) - (errBefore * errBefore);
            }

            return { deltaObj: delta, deltaCost };
        }

        function buyOne(sym) {
            const u = bySym.get(sym);
            const cur = st.get(sym);
            cur.shares += 1;
            cur.gross += u.price;
        }

        // Greedy pass: only take improvements (deltaObj < 0)
        function runGreedy(disallowNewSymbolsSet) {
            let guard = 0;
            while (guard++ < 200000) {
                const spent = currentTotalCostInvested();
                const cashRemaining = cash0 - spent;
                if (cashRemaining < 0.01) break;

                let bestSym = null;
                let bestDelta = 0; // need negative

                for (const u of universe) {
                    const cur = st.get(u.symbol);

                    if (disallowNewSymbolsSet && cur.shares === 0 && disallowNewSymbolsSet.has(u.symbol)) continue;

                    // if this buy would open a symbol, ensure we can reach minGross overall for that symbol
                    if (cur.shares === 0 && !canOpenSymbolWithMin(u.symbol, cashRemaining)) continue;

                    const ev = evalBuyOne(u.symbol);
                    if (!ev) continue;
                    if (ev.deltaCost > cashRemaining + 1e-9) continue;

                    if (ev.deltaObj < bestDelta) {
                        bestDelta = ev.deltaObj;
                        bestSym = u.symbol;
                    }
                }

                if (!bestSym) break;
                buyOne(bestSym);
            }
        }

        // Sweep pass: spend remaining cash, choose least-bad deltaObj (smallest), while respecting fees/min/open constraints
        function runSweep(disallowNewSymbolsSet) {
            let guard = 0;
            while (guard++ < 200000) {
                const spent = currentTotalCostInvested();
                const cashRemaining = cash0 - spent;
                if (cashRemaining < 0.01) break;

                let bestSym = null;
                let bestDelta = Infinity;
                let bestDeltaCost = -Infinity; // tie-break: spend more

                for (const u of universe) {
                    const cur = st.get(u.symbol);

                    if (disallowNewSymbolsSet && cur.shares === 0 && disallowNewSymbolsSet.has(u.symbol)) continue;

                    // if opening a new symbol during sweep, ensure we can actually satisfy minGross for that symbol
                    if (cur.shares === 0 && !canOpenSymbolWithMin(u.symbol, cashRemaining)) continue;

                    const ev = evalBuyOne(u.symbol);
                    if (!ev) continue;
                    if (ev.deltaCost > cashRemaining + 1e-9) continue;

                    if (
                        ev.deltaObj < bestDelta - 1e-15 ||
                        (Math.abs(ev.deltaObj - bestDelta) <= 1e-15 && ev.deltaCost > bestDeltaCost)
                    ) {
                        bestDelta = ev.deltaObj;
                        bestDeltaCost = ev.deltaCost;
                        bestSym = u.symbol;
                    }
                }

                if (!bestSym) break;
                buyOne(bestSym);
            }
        }

        // 1) optimize tracking (improving moves only)
        runGreedy(null);

        // 2) soft-min: drop positions below minGross, rerun greedy without reopening those
        let dropped = null;
        if (minGross > 0) {
            const toDrop = new Set();
            for (const u of universe) {
                const cur = st.get(u.symbol);
                if (cur.shares > 0 && cur.gross + 1e-9 < minGross) toDrop.add(u.symbol);
            }
            if (toDrop.size > 0) {
                for (const sym of toDrop) st.set(sym, { shares: 0, gross: 0 });
                runGreedy(toDrop);
                dropped = toDrop;
            }
        }

        // 3) spend remaining cash with minimal damage, still respecting min-per-stock when opening new symbols
        runSweep(dropped);

        // Build items
        const items = [];
        let spentTotal = 0;
        let spentGross = 0;

        for (const u of universe) {
            const cur = st.get(u.symbol);
            if (cur.shares <= 0) continue;

            // (should already be true, but keep safe)
            if (minGross > 0 && cur.gross + 1e-9 < minGross) continue;

            const fee = feeFor(cur.gross, cur.shares);
            const totalCost = cur.gross + fee;

            items.push({
                symbol: u.symbol,
                shares: cur.shares,
                price: u.price,
                amountGross: cur.gross,
                fee,
                totalCost,
                amount: cur.gross
            });

            spentTotal += totalCost;
            spentGross += cur.gross;
        }

        const unallocated = Math.max(0, cash0 - spentTotal);
        return { items, unallocated, investedGross: spentGross, investedTotal: spentTotal };
    }

export function portfolioAfterBuySuggestions(portfolioWithValues, items, totalStocksValue) {
        const map = new Map(portfolioWithValues.map(p => [p.symbol, { ...p }]));
        for (const it of items) {
            const existing = map.get(it.symbol);
            if (existing) existing.value += it.amount;
            else map.set(it.symbol, { symbol: it.symbol, value: it.amount, weight: 0, market_price: NaN });
        }
        const invested = items.reduce((s, it) => s + it.amount, 0);
        const newTotal = totalStocksValue + invested;

        const list = Array.from(map.values()).map(p => ({
            symbol: p.symbol,
            value: p.value,
            weight: (p.value / newTotal) * 100
        }));

        return { list, newTotal, invested };
    }

export function portfolioAfterSellSuggestions(portfolioWithValues, items, totalStocksValue) {
        const map = new Map(portfolioWithValues.map(p => [p.symbol, { ...p }]));
        for (const it of items) {
            const existing = map.get(it.symbol);
            if (!existing) continue;
            existing.value = Math.max(0, existing.value - it.amount);
        }
        const sold = items.reduce((sum, it) => sum + it.amount, 0);
        const newTotal = Math.max(0, totalStocksValue - sold);

        const list = Array.from(map.values()).map(p => ({
            symbol: p.symbol,
            value: p.value,
            weight: newTotal > 0 ? (p.value / newTotal) * 100 : 0
        }));

        return { list, newTotal, invested: -sold, sold };
    }

export function normalizeBetWeights(bvbData, allowedSymbols = null) {
    let universe = Array.isArray(bvbData) ? bvbData : [];
    if (allowedSymbols) {
        const allowed = allowedSymbols instanceof Set ? allowedSymbols : new Set(allowedSymbols);
        universe = universe.filter(row => allowed.has(row.symbol));
    }

    const totalWeight = universe.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
    if (totalWeight <= 0) return [];

    return universe.map(row => ({
        symbol: row.symbol,
        bvbWeight: Number(row.weight) || 0,
        normalizedWeight: ((Number(row.weight) || 0) / totalWeight) * 100
    }));
}

// Validates the required Sell-mode amount before any portfolio calculation is performed.
export function isRequiredPositiveAmount(value) {
  const amount = typeof value === "string" && value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(amount) && amount > 0;
}
