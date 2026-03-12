---
description: 
alwaysApply: true
---

# Agent guidance — PE E&P LOS Dashboard

This file mirrors the project's Cursor rules so terminal and other agents see the same guidance. **When Cursor rules or `ProjectBrief.md` are updated, update this file to keep them aligned.** Do not change the meaning of rules; this is a visibility/synchronization artifact.

---

## Project Scope

- **Core purpose:** Private-equity due diligence tool for analyzing well-by-well Lease Operating Statements (LOS) on a private E&P acquisition. Single primary user (one PE professional doing internal DD); not a public-facing app.
- **Primary problem:** Turn raw LOS CSV data into investment-committee-quality views: portfolio rollups, well-by-well analysis, and ARIES model assumption overlays.
- **Key capabilities:** Ingest tab- or comma-delimited LOS CSV; aggregate by month and well; 7-tab UI (ARIES Inputs, Input Charts, Asset Rollup, Well by Well, LOS Table, GPT Analysis, Historical Inputs); Operated/Non-Operated and lift-type filters; export to CSV.
- **Architecture:** Two builds — (1) standalone `LOS Dashboard.html` (no Node.js), (2) Vite + React in `pe-los-dashboard/` (run with `npm install && npm run dev` when Node.js is available). Client-side only; no backend. Business logic in utils/ and constants/; UI in components/ and root `App.jsx`.

Agents should review this scope before implementing new features or making structural changes. If the project direction changes materially, ask the user whether the scope should be updated.

---

## Quick context

- **Project:** Private-equity due diligence tool for well-by-well Lease Operating Statements (LOS). Client-side only; no backend.
- **Primary user:** One PE professional, internal DD. Not public-facing.
- **Two builds:** (1) `LOS Dashboard.html` — standalone HTML, no install. (2) `pe-los-dashboard/` — Vite + React; run with `npm install && npm run dev` when Node.js is available.

---

## Unresolved / read first

_(None at this time.)_

---

## Project overview

- Ingest tab- or comma-delimited CSV LOS data; aggregate; produce investment-committee-quality charts with ARIES assumption overlays.
- **Data:** ~22 columns (0-indexed), one row per well × month × LOS category. Auto-detect delimiter; strip BOM; use Net Amount col 21 and Net Volume col 20; NGL volume in gallons → divide by 42 for BBL.
- **Revenue rows** have negative Net Amount in source — use `Math.abs()` for display. Cost Category is primary index for bucket mapping; LOS Category is fallback. CAPEX and MS (midstream) excluded from LOS totals.
- **Key constants:** `GAS_BOE = 6` (6 MCF = 1 BOE). Days in month = actual (28/29/30/31), not 30.

---

## File structure

- **Root:** `ProjectBrief.md` (full context), `LOS Dashboard.html` (standalone), `AGENTS.md` (this file).
- **Vite:** `pe-los-dashboard/` — canonical modules:
  - `src/App.jsx` — orchestration only: state, file upload, tab routing, tab UI components
  - `src/constants/losMapping.js` — LOS_BUCKETS, COST_CAT_BUCKETS, CHART_COLORS, ARIES state shape, TABS
  - `src/constants/gptMapping.js` — canonical midstream GPT column aliases
  - `src/constants/wbwTypes.js` — WBW_TYPES, SORT_OPTIONS
  - `src/ingest/parseCsv.js` — parseCSVText (returns `{ rows, warnings }`), parseDate, parseNum, resolveBucket
  - `src/ingest/parseMidstreamGptCsv.js` — parseMidstreamGptCSVText for variable-format GPT statements
  - `src/domain/metrics.js` — GAS_BOE, sd, daysInMonth, emptyM, accum, metrics
  - `src/domain/gptFormulas.js` — centralized GPT formulas (NGL yield, shrink, BTU, gas diff, NGL %WTI, GPT $/Mcf)
  - `src/selectors/buildRollups.js` — buildMonthlyRollup, buildWellData, buildLOSCatData, filterRows, selectActiveInputs
  - `src/selectors/buildGptRollup.js` — by-meter and total GPT rollups; feeds operated GPT assumptions
  - `src/export/exportCsv.js` — exportInputs, exportHistorical, parseAriesImport
  - `src/charts/chartConfig.js` — shared Recharts config, segLabel, topLabel, rl, smartUnit, buildLTM, safeAvg
  - `src/utils/formatters.js` — display formatters (f$, fB, fP, fG, fBoed, fMcfd, fMdol, …)
  - `src/__tests__/` — Vitest tests (parseCsv, metrics, buildRollups). Run with `npm test`.
  - CSV for auto-load: `pe-los-dashboard/public/data/los_data.csv`.

---

## Data and calculations (summary)

- **Buckets:** oil, gas, ngl, fixed, variable_oil, variable_water, gpt, workover, prod_taxes, capex (excluded), null (skipped). Cost Category → bucket in `COST_CAT_BUCKETS`; fallback `LOS_BUCKETS` by LOS Category.
- **Metrics:** `totalFixed = fixed + workover`; `totalLOS = var_oil + var_water + totalFixed + gpt + prod_taxes`; `opMargin = totalRevenue - totalLOS`; `assetFCF = opMargin - capex`; `fixedPerWell = gross_fixed / wellCount`; `workoverPerWell = gross_workover / wellCount`; `varOilPerBOE` (legacy key) = `gross_var_oil / gross_oil`; `gptPerMcf = gross_gpt / gross_gas_volume`; `varWaterPerBBL = gross_var_water / gross_water_volume`; `netBOE = oil_vol + ngl_vol + gas_vol/6`.
- **Design:** Light mode, Evercore IB palette (e.g. Oil #1F3864, Gas #C55A11, NGL #548235). Inter font. Chart reference lines: My Case orange dashed, VDR gray dotted.

---

## Architecture and conventions

- No backend. Pure client-side parsing and aggregation. `useMemo` on rollup/wellData keyed off rawRows; `React.memo` on WellCard for performance.
- **Canonical module rule:** All domain logic (parsing, bucketing, aggregation, export) lives in the canonical modules (`ingest/`, `domain/`, `selectors/`, `export/`, `charts/`, `utils/`, `constants/`). `App.jsx` imports from these — it must not re-define domain logic inline.
- **parseCSVText returns `{ rows, warnings }`** — structural errors throw; data-quality issues (bad dates, non-numeric values, unmapped categories) are returned as warning strings for display.
- **parseDate:** Accepts only 2-digit years (YY); validates round-trip; rejects rolled-over invalid dates.
- ARIES state: `vdrCase` / `myCase` each with `op` and `obo` sub-objects; `selectActiveInputs()` flattens by current op filter for chart reference lines.
- Operated / Non-Operated / Total and lift-type (JP / RP / Other) filters applied by `filterRows()` selector. Sensitive CSVs under `01. Analysis/` and `pe-los-dashboard/public/data/` are in `.gitignore`.

---

## Agent role

Agents implement features and fixes per `ProjectBrief.md`, keep this file and `ProjectBrief.md` in sync when rules or status change, and follow the engineering principles below.

---

## Engineering principles (apply when relevant)

- **Architecture:** Modular monolith; strict layer separation (ui → api → services → data). Lower layers never depend on higher. Business logic in services/domain; data access in repository/data only.
- **Data:** Treat external inputs as untrusted; validate at boundaries; canonical internal model; adapters for variable source formats.
- **Code quality:** Simple, readable, maintainable; no hidden behavior; descriptive names; ~300 lines/file and ~80 lines/function where practical; no duplicated logic.
- **Testability & reliability:** Isolate pure logic from I/O; enforce domain invariants; explicit error handling and idempotency for async/retries.
- **Security:** Enforce auth/authz at server boundaries; never rely on UI for security.
- **Observability:** Log errors and important events with context; no silent failures.
- **Schema/contracts:** Prefer additive changes; explicit migrations; avoid destructive DB changes unless approved.
- **Discipline:** Avoid speculative abstraction; simplest correct solution; prefer simplifying or reusing over adding code.

---

## Sync instruction

Current implementation note: the Vite app supports separate historical uploads for pricing, gross volumes, and midstream GPT statements. Matching is done by normalized Well Name / Applicable Tag / Property Name for gross-volume files. Current global unit-cost formulas are: oil = gross oil cost / gross oil volume; workover = gross workover cost / monthly well count; fixed = gross fixed cost / monthly well count; JP and RP fixed/workover use their own rolling JP/RP well counts; water = gross water cost / gross water volume; GP&T = gross GPT cost / gross gas volume. When GPT statement data is uploaded, operated rollups use GPT-derived `gptPerMcf`, `gasDifferential`, and `nglDifferential`; OBO continues to use LOS-derived values. Status freshness check (2026-03-11): `node --version` = `v24.14.0`, `npm --version` = `11.9.0`, `npm test` passing (`113` tests).

When you change Cursor rules (e.g. in `.cursor/rules/`) or update `ProjectBrief.md`, update this file so terminal and other agents keep the same guidance. Do not add or remove rules here; mirror only.
