// Sortable table helpers used by the static HTML pages.

export function normalizeForNumberParsing(s) {
        let x = String(s ?? "").trim();
        if (!x) return "";
        x = x.replace(/\u00A0/g, " "); // nbsp
        return x;
    }

export function parseFirstNumberSmart(raw) {
        const s0 = normalizeForNumberParsing(raw);
        if (!s0) return NaN;

        // quick exclude common placeholders
        const lower = s0.toLowerCase();
        if (lower === "—" || lower === "-" || lower.includes("excluded") || lower.includes("n/a")) return NaN;

        // Remove HTML leftovers, keep text-like
        const s = s0.replace(/\s+/g, " ");

        // Find first occurrence of a number-ish token (includes thousands and decimals)
        // Examples matched: -224.41, 1,234.56, 1.234,56, 0.9855
        const m = s.match(/[-+]?\d[\d\s.,]*\d|[-+]?\d(?:[.,]\d+)?/);
        if (!m) return NaN;

        let tok = m[0].trim();
        tok = tok.replace(/\s/g, "");

        // Decide decimal separator by last occurrence of '.' or ','
        const lastDot = tok.lastIndexOf(".");
        const lastComma = tok.lastIndexOf(",");

        // If both present, treat the last one as decimal separator, the other as thousand separator
        if (lastDot !== -1 && lastComma !== -1) {
            if (lastDot > lastComma) {
                // dot is decimal, remove commas
                tok = tok.replace(/,/g, "");
            } else {
                // comma is decimal, remove dots and replace comma->dot
                tok = tok.replace(/\./g, "").replace(",", ".");
            }
        } else if (lastComma !== -1) {
            // Only comma present. Could be decimal OR thousands.
            // If looks like "1,234" (groups of 3), treat as thousands separator.
            if (/^\d{1,3}(,\d{3})+(\,\d+)?$/.test(tok)) {
                tok = tok.replace(/,/g, "");
            } else {
                // treat as decimal
                tok = tok.replace(",", ".");
            }
        } else {
            // Only dot or none. If "1.234.567" treat dots as thousands.
            if (/^\d{1,3}(\.\d{3})+$/.test(tok)) tok = tok.replace(/\./g, "");
        }

        const n = Number(tok);
        return Number.isFinite(n) ? n : NaN;
    }

export function getCellText(cell) {
        if (!cell) return "";
        return (cell.textContent ?? "").trim();
    }

export function detectColumnMode(rows, colIdx) {
        // Decide "number" if we can parse numbers for the majority of non-empty cells
        let numericHits = 0;
        let textHits = 0;

        for (const tr of rows) {
            const td = tr.children[colIdx];
            if (!td) continue;
            const txt = getCellText(td);
            if (!txt) continue;

            const n = parseFirstNumberSmart(txt);
            if (Number.isFinite(n)) numericHits++;
            else textHits++;
        }

        if (numericHits === 0 && textHits === 0) return "text";
        if (numericHits >= Math.max(2, textHits)) return "number";
        return "text";
    }

export function makeTableSortable(table) {
        if (!table || table.dataset.sortableReady === "1") return;

        // Find header row: first <tr> that has <th>
        const allRows = Array.from(table.querySelectorAll("tr"));
        const headerRow = allRows.find(r => r.querySelectorAll("th").length > 0);
        if (!headerRow) return;

        const ths = Array.from(headerRow.querySelectorAll("th"));
        if (!ths.length) return;

        // Data rows: all <tr> after headerRow that contain <td>
        const headerIndex = allRows.indexOf(headerRow);
        const dataRows = allRows
            .slice(headerIndex + 1)
            .filter(r => r.querySelectorAll("td").length > 0);

        if (!dataRows.length) return;

        ths.forEach((th, colIdx) => {
            th.classList.add("sortable");

            th.addEventListener("click", () => {
                // Toggle direction
                const isAsc = th.classList.contains("sort-asc");
                const nextDir = isAsc ? "desc" : "asc";

                // Clear all arrows in this header row
                ths.forEach(x => x.classList.remove("sort-asc", "sort-desc"));
                th.classList.add(nextDir === "asc" ? "sort-asc" : "sort-desc");

                const mode = detectColumnMode(dataRows, colIdx);

                const decorated = dataRows.map((tr, i) => {
                    const td = tr.children[colIdx];
                    const txt = getCellText(td);
                    const num = parseFirstNumberSmart(txt);
                    return { tr, i, txt, num };
                });

                decorated.sort((a, b) => {
                    // Put empty/NaN at the end always
                    if (mode === "number") {
                        const aOk = Number.isFinite(a.num);
                        const bOk = Number.isFinite(b.num);
                        if (!aOk && !bOk) return a.i - b.i;
                        if (!aOk) return 1;
                        if (!bOk) return -1;

                        const diff = a.num - b.num;
                        if (diff !== 0) return nextDir === "asc" ? diff : -diff;
                        return a.i - b.i; // stable
                    }

                    const aTxt = (a.txt ?? "").toLowerCase();
                    const bTxt = (b.txt ?? "").toLowerCase();

                    if (!aTxt && !bTxt) return a.i - b.i;
                    if (!aTxt) return 1;
                    if (!bTxt) return -1;

                    const c = aTxt.localeCompare(bTxt, undefined, { numeric: true, sensitivity: "base" });
                    if (c !== 0) return nextDir === "asc" ? c : -c;
                    return a.i - b.i;
                });

                // Re-append in sorted order (keep header where it is)
                const parent = dataRows[0].parentElement || table;
                for (const x of decorated) parent.appendChild(x.tr);
            });
        });

        table.dataset.sortableReady = "1";
    }

export function makeTablesSortable(root) {
        const scope = root || document;
        const tables = Array.from(scope.querySelectorAll("table"));
        tables.forEach(makeTableSortable);
    }
