# PE E&P LOS Dashboard — Project Context

This file is shared between Claude Code (CLI) and Claude in Cursor so both can work on the same project with full context. Update this file whenever significant decisions are made or status changes.

---

## Project Overview

A private-equity due diligence tool for analyzing well-by-well Lease Operating Statements (LOS) on a private E&P acquisition. The app ingests a tab- or comma-delimited CSV of LOS data, aggregates it, and produces investment-committee-quality charts with ARIES model assumption overlays.

**Primary user:** One PE professional doing internal DD. Not a public-facing app.

---

## Two Parallel Builds

### 1. `LOS Dashboard.html` ← CURRENT WORKING VERSION
Single standalone HTML file. No Node.js required. Opens directly in Chrome.
- React 18 + Recharts + PapaParse + Tailwind Play CDN, all loaded from CDN
- JSX compiled in-browser by Babel standalone
- CSV loaded via drag-and-drop or file picker (no auto-fetch — browser security)
- **Use this until Node.js is installed**

### 2. `pe-los-dashboard/` ← VITE PROJECT (ready, not yet runnable)
Full Vite + React project. Requires Node.js.
```
npm install
npm run dev
```
Identical features to the HTML version but faster, hot-reload, and serves `/public/data/los_data.csv` automatically on startup.
- **CSV goes in:** `pe-los-dashboard/public/data/los_data.csv`
- **Use this once Node.js is installed**

---

## Current Status

### Working
- [x] 3-tab layout (ARIES Inputs, Portfolio Rollup, Well by Well)
- [x] CSV parsing — tab- or comma-delimited, dynamic column detection from header
- [x] Data aggregations — monthly rollup + per-well monthly series
- [x] Sign flip: oil/gas/NGL revenue + volume stored negative in source, flipped via Math.abs()
- [x] 13 portfolio rollup charts — all BarCharts, titles with units, IB pitchbook style
- [x] ARIES input form (VDR Case / My Case / Variance / Historical Avg)
- [x] ARIES overlay reference lines on rollup charts (orange dashed = My Case, gray dotted = VDR)
- [x] Well-by-well cards with 28 chart type options, search/filter, and sort (oil/gas/total vol)
- [x] % of Total shown in each well card footer (contribution to portfolio for most recent month)
- [x] LOS Table tab — full P&L-style LOS statement with Portfolio Total / per-well toggle, Net / Gross toggle, and Operating Margin row that ties to rollup totals
- [x] Operated / Non-Operated / Total filter in nav bar — filters all tabs simultaneously
- [x] Lift type filter in nav bar (All | JP | RP | Other) — stacked below op filter, composes with AND logic
- [x] ARIES Inputs split: Operated and Non-Operated sub-columns for both VDR Case and My Case
- [x] Export to CSV (ARIES inputs + full historical data)
- [x] BOM stripping for Excel-exported CSVs
- [x] Dependency guard with helpful error messages if CDN scripts fail
- [x] Light mode UI — white bg, dark text, Evercore IB color palette, no dark colors

### Known Issues

- **Node.js:** Confirmed NOT installed as of 2026-03-05 — `node --version` and `npm --version` both return "command not found" in Cursor terminal. Must install from [nodejs.org](https://nodejs.org) (LTS) before `pe-los-dashboard/` can be used.

### Unresolved / Needs Confirmation

> **Read this before starting any session.** These items are blocking or uncertain and need user input before proceeding.

| # | Item | Action Required |
|---|------|-----------------|
| 1 | Node.js not installed | User must install Node.js LTS from [nodejs.org](https://nodejs.org), then restart Cursor, before the Vite project can be used |

### Recently Resolved
- **Grey page / Recharts CDN failure** — Confirmed 2026-03-06: jsDelivr and unpkg both fail on this machine. Fix: entire Recharts 2.12.7 UMD build inlined directly into `LOS Dashboard.html` (no external file needed). Also added missing `prop-types` CDN script (Recharts UMD peer dep) before the inlined Recharts block.
- **CSV comma-delimiter error** — Confirmed 2026-03-06: data file (`Gross and Net LOS_3.5.26.csv`) is comma-delimited, not tab-delimited. Fix: `parseCSVText()` now auto-detects delimiter by counting tabs vs commas in the first line. UI hint updated to "Tab or comma delimited."

---

### Not Yet Built (Future)
- [ ] WTI oil price strip overlay
- [ ] ARIES export formatted for ARIES economic model input

---

## Data File Specification

**Format:** Tab- or comma-delimited (auto-detected), 22 columns (0-indexed), one row per well × month × LOS category

| Index | Column | Notes |
|-------|--------|-------|
| 0 | Well Name | Trim whitespace |
| 1 | Cost Category | RevO, RevG, RevNGL, Fixed, Other, Var, VW, GPT, WORK, PTo, PTg, PTngl, AT, MS |
| 2 | Gross Up By | WI or NRI |
| 3 | NRI | Decimal e.g. 0.795799 |
| 4 | WI | Decimal, usually 1.0 |
| 5 | Gross Amount | |
| 6 | Gross Volume | |
| 7 | Net Amount | **NOT USED** — use col 21 |
| 8 | JP/RP | Jet Pump or Rod Pump tag |
| 9–10 | x, Comp | Unused |
| 11 | Service End Date | **DATE FIELD** — format M/DD/YY e.g. 1/31/24 |
| 12 | Property # | |
| 13 | Property Name | |
| 14 | JP/RP | Duplicate — ignore |
| 15 | OP/OBO | Operated or Non-Operated |
| 16 | LOS CATEGORY | Primary category label — maps to buckets |
| 17–19 | Main, Sub, Alloc LOE | Unused |
| 20 | Net Volume | **USE THIS for all volumes** |
| 21 | Net Amount | **USE THIS for all costs/revenues** |

**Key parsing rules:**
- Revenue rows (Oil, Gas, NGL) have **negative** Net Amount — flip sign with `Math.abs()` for display
- **NGL volume is in gallons in the source data** — divide by 42 to convert to BBL before all calculations (1 BBL = 42 gallons). Applied in `accum()` for both net and gross NGL volume.
- `Net Volume` on RevO/RevG/RevNGL rows = production volumes
- `CAPEX` rows excluded from all LOS totals
- Dataset: ~40 wells × 24 months ≈ 5,000–10,000 rows
- Parser auto-detects delimiter (tab vs comma by inspecting first line), skips header row, strips Excel BOM (`\uFEFF`), normalizes CRLF

---

## Cost Category → Bucket Mapping

**Cost Category is the primary index.** LOS Category is the fallback only when Cost Category is blank or unrecognized.

```js
// PRIMARY — Cost Category (cat field, col 1)
const COST_CAT_BUCKETS = {
  'RevO': 'oil', 'RevG': 'gas', 'RevNGL': 'ngl',   // revenue + volume
  'Fixed': 'fixed', 'Other': 'fixed',               // direct LOE
  'Var':   'variable_oil',
  'VW':    'variable_water',
  'GPT':   'gpt',                                    // separate GPT section
  'WORK':  'workover',                               // workover costs
  'PTo': 'prod_taxes', 'PTg': 'prod_taxes', 'PTngl': 'prod_taxes', 'AT': 'prod_taxes',
  'MS':  null,  // midstream revenue credit — EXCLUDED from analysis
}

// FALLBACK — LOS Category (los field, col 16)
const LOS_BUCKETS = {
  'Oil': 'oil', 'Gas': 'gas', 'NGL': 'ngl',
  'Chemicals': 'variable_oil', 'Fuel & Power': 'variable_oil',
  'Gathering, Trans. & Processing': 'variable_oil',
  'Liquids Hauling & Disposal': 'variable_water',
  'Company Labor': 'fixed', 'Contract Labor/Pumper': 'fixed',
  'Field Office': 'fixed', 'EHS & Regulatory': 'fixed',
  'LOE': 'fixed',
  'Measurement/Automation': 'fixed', 'Surface Repairs & Maint': 'fixed',
  'Vehicles': 'fixed', 'Well Servicing': 'fixed',
  'Ad Valorem Taxes': 'prod_taxes',
  'Production Taxes-Oil': 'prod_taxes', 'Production Taxes-Gas': 'prod_taxes',
  'Production Taxes-NGL': 'prod_taxes',
  'CAPEX': 'capex',  // excluded from LOS
  // 'Non-LOS': unmapped → null → skipped
}
```

**Buckets:** `oil`, `gas`, `ngl`, `fixed`, `variable_oil`, `variable_water`, `gpt`, `workover`, `prod_taxes`, `capex` (excluded), `null` (skipped)

---

## Key Calculations

```js
const GAS_BOE = 6  // 6 MCF = 1 BOE

netBOE        = oil_vol + ngl_vol + (gas_vol / 6)
totalRevenue  = abs(oil_rev) + abs(gas_rev) + abs(ngl_rev)  // revenue stored negative
totalFixed    = fixed + workover                  // Fixed & Workover always combined
totalLOS      = var_oil + var_water + totalFixed + gpt + prod_taxes  // CAPEX + MS excluded
assetFCF      = opMargin - capex                 // Asset Free Cash Flow
capexPerWell  = capex / active_well_count
opMargin      = totalRevenue - totalLOS

realizedOil   = oil_rev / oil_vol       // $/BBL
realizedGas   = gas_rev / gas_vol       // $/MMBTU
realizedNGL   = ngl_rev / ngl_vol       // $/BBL

varOilPerBOE  = var_oil / (oil_vol + ngl_vol)
fixedPerWell  = fixed / active_well_count_that_month
prodTaxPct    = prod_taxes / totalRevenue * 100
costPerBOE    = totalLOS / netBOE

// Daily rates: divide monthly total by days in month (not 30)
netOild = oil_vol / daysInMonth(date)
```

**Note:** Water volumes are NOT in the LOS data. Variable water is shown as $/month, not $/BBL.

---

## Design System (Updated Session 6 — Light Mode IB Pitchbook Style)

```
Background:      #f9fafb (gray-50)
Card background: #ffffff
Border:          #e5e7eb (gray-200)
Text primary:    #111827 (gray-900)
Text secondary:  #6b7280 (gray-500)
Text muted:      #9ca3af (gray-400)

Chart colors (Evercore IB palette):
  Oil:           #1F3864  (dark navy)
  Gas:           #C55A11  (burnt orange)
  NGL:           #548235  (forest green)
  Fixed:         #2E74B5  (medium blue)
  Var Oil:       #5B9BD5  (steel blue)
  Var Water:     #9DC3E6  (light blue)
  Prod Taxes:    #BDD7EE  (pale blue)
  Revenue:       #1F3864  (same as oil)
  Margin:        #548235  (same as NGL)
  Cost/BOE:      #C55A11  (same as gas)
  My Case:       #C55A11  orange dashed reference line
  VDR Case:      #7F7F7F  gray dotted reference line

Grid:  #9CA3AF solid horizontal lines (no vertical)
Tabs active: border-[#1F3864] text-[#1F3864]
Font: Inter (Google Fonts)
```

---

## Repository

**GitHub (private):** https://github.com/IsaiasTristan/crescent-pass-los-dashboard
**Remote:** `origin` → HTTPS
**Branch:** `main`

Sensitive data files (raw LOS CSVs under `01. Analysis/` and `pe-los-dashboard/public/data/`) are excluded via `.gitignore`.

---

## File Structure

```
C:\Coding Projects\01. Crescent Pass\
├── CLAUDE.md                          ← this file
├── LOS Dashboard.html                 ← standalone, use now
└── pe-los-dashboard/                  ← Vite project, use after Node install
    ├── package.json
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── public/
    │   └── data/
    │       └── los_data.csv           ← put CSV here for auto-load
    └── src/
        ├── main.jsx
        ├── App.jsx                    ← root: CSV load/upload, tab routing, state
        ├── index.css
        ├── constants/
        │   └── losMapping.js          ← LOS_BUCKETS, COST_CAT_BUCKETS, CHART_COLORS
        ├── utils/
        │   ├── parseCSV.js            ← tab-delimited parser, col index map
        │   ├── aggregations.js        ← buildMonthlyRollup(), buildWellData()
        │   └── exportCSV.js           ← exportAriesInputs(), exportHistoricalData()
        └── components/
            ├── ChartCard.jsx          ← reusable chart wrapper + mini table
            ├── ExportButton.jsx       ← styled download button
            ├── InputsTab.jsx          ← ARIES inputs form
            ├── RollupTab.jsx          ← 13 portfolio charts, 2-col grid
            └── WellByWellTab.jsx      ← well cards + chart type toggle
```

---

## ARIES Inputs State Shape

```js
// Nested by op/obo sub-case (added Session 9)
{
  vdrCase: {
    op:  { fixedPerWellMonth, varOilPerBOE, varWaterPerBBL, prodTaxPct, oilDiff, gasDiff, nglDiffPct },
    obo: { ...same keys... },
  },
  myCase: {
    op:  { ...same keys... },
    obo: { ...same keys... },
  }
}

// activeInputs (computed memo) — flattened for chart reference lines
// opFilter === 'obo'  → uses obo sub-case
// opFilter === 'op' or 'all' → uses op sub-case
activeInputs = { vdrCase: inputs.vdrCase[slice], myCase: inputs.myCase[slice] }

// Variance = myCase[slice] - vdrCase[slice]
// Green = My Case better (lower cost, or higher differential)
// Red   = My Case worse

// Key definitions (all fields, same for op and obo):
//   fixedPerWellMonth — $/well/month, flat (no escalation)
//   varOilPerBOE      — $/BOE, applied to oil + NGL
//   varWaterPerBBL    — $/BBL water (water vols not in LOS data)
//   prodTaxPct        — % of gross revenue
//   oilDiff           — $/BBL vs WTI (negative = discount)
//   gasDiff           — $/MMBTU vs Henry Hub
//   nglDiffPct        — % of WTI e.g. 35
```

---

## Architecture Decisions

- **No backend.** Pure client-side. All parsing and aggregation in the browser.
- **useMemo on rollup + wellData** keyed off rawRows — no re-calc on every render.
- **React.memo on WellCard** — 40 wells × re-renders would be slow otherwise.
- **Water volumes not in LOS** — variable water shown as $/month, not $/BBL. ARIES input field for $/BBL water exists but has no historical comparison.
- **GPT row** in inputs is grayed-out placeholder. Will be loaded from a separate CSV (format TBD) joined by well + month.
- **Gross vs. Net production:** Gross volumes from col 6, Net volumes from col 20. Both stored in parsed rows. Rollup uses both.
- **Gas BOE conversion:** 6 MCF = 1 BOE (hardcoded constant `GAS_BOE = 6`).
- **Days in month:** Use actual days (28/29/30/31), not fixed 30, when converting monthly totals to daily rates.

---

## CDN Script Load Order (HTML version)

```
1. Tailwind Play CDN
2. PapaParse 5.4.1
3. React 18 (unpkg)
4. ReactDOM 18 (unpkg)
5. prop-types 15.8.1 (unpkg) — required peer dep for Recharts UMD
6. Recharts 2.12.7 — INLINED directly in HTML (avoids CDN + file:// issues)
7. Babel Standalone 7.24.0
8. <script type="text/babel"> — all app code
```

If any script fails, a dependency guard at the top of the Babel script catches it and shows a named error card instead of a silent grey page. Recharts is inlined so it never makes a network request.

---

## Discord Mobile Approval Hook

Claude Code is configured to pause before any `Bash`, `Write`, or `Edit` call and ask for phone approval via Discord.

**Files:**
- `~/.claude/hooks/discord_approval.py` — hook script (Python, no external packages)
- `~/.claude/hooks/SETUP.md` — full setup instructions
- `~/.claude/settings.json` — hook wired into Claude Code via `PreToolUse` matcher

**Flow:**
1. Claude tries to run a tool → hook fires
2. Discord message sent to `#claude-approvals` with full tool details
3. Script polls every 3s for a 👍 (approve) or 👎 (deny) reaction
4. 5-minute timeout → auto-approve (configurable)
5. Read-only tools (Read, Glob, Grep) bypassed — no notification

**Required env vars (Windows System Environment Variables):**
```
DISCORD_BOT_TOKEN   = your-discord-bot-token
DISCORD_CHANNEL_ID  = your-channel-id
```

**Status:** Script written and wired. Needs Discord bot setup per `SETUP.md` before it's live.

---

## Session Log (reverse chronological)

**2026-03-06 — Session 12**
- **`Other` cat = CAPEX**: `COST_CAT_BUCKETS['Other']` changed from `'fixed'` → `'capex'`. CAPEX is now tracked separately and excluded from all LOE totals.
- **CAPEX flows through full pipeline**: `emptyM` + `accum` + `metrics` now accumulate `capex`. `buildMonthlyRollup` and `buildWellData` no longer skip capex rows. `buildLOSCatData` no longer skips capex rows.
- **New metrics**: `totalFixed = fixed + workover` (combined), `capexPerWell = capex / wellCount`, `assetFCF = opMargin - capex`.
- **`fixedPerWell` now = (fixed + workover) / wellCount** universally — matches "Total Fixed = Fixed + Workover" rule.
- **LOS Table restructured** (top to bottom): Variable Oil → Variable Water → Fixed & Workover (combined) → GP&T → Production Taxes → Total LOE → Operating Margin → CAPEX → Asset Free Cash Flow.
- **Asset Free Cash Flow row**: green margin row added below CAPEX in LOS Table. = Operating Margin − CAPEX.
- **Rollup Total LOS stacked chart**: now stacks var_oil + var_water + totalFixed + gpt + prod_taxes (was missing gpt+workover).
- **New rollup charts**: "Fixed & Workover ($M)", "GPT ($M)", "CAPEX ($M)" in Total Cost section; "CAPEX ($/Well/mo)" in Unit Cost section.
- **Colors added**: `gpt: #4472C4` (slate blue), `workover: #70AD47` (green), `capex: #C00000` (dark red).
- **WBW costStack**: now stacks var_oil + var_water + totalFixed + gpt + prod_taxes (capex excluded from LOE stack).

**2026-03-06 — Session 11**
- **Cost Category made primary index**: `resolveBucket()` now checks `cat` (Cost Category, col 1) first, falls back to `los` (LOS Category, col 16). Previously `los` was primary.
- **New buckets added**: `gpt` (Gathering/Trans/Processing) and `workover`. Both tracked separately through `emptyM`, `accum`, `metrics`, and `totalLOS`.
- **`MS` (midstream revenue credit) explicitly excluded**: maps to `null` → skipped in all aggregations.
- **COST_CAT_BUCKETS reworked**: `Other→fixed`, `GPT→gpt`, `WORK→workover`, `AT→prod_taxes`, `PTngl→prod_taxes` (renamed from `PTn`), `MS→null`.
- **LOS Table new sections**: "Gathering, Trans. & Processing" section (subtotal GPT) and "Workover" section added between Direct LOE and Production Taxes. `totalLOE` now includes GPT + Workover.
- **JP/RP_USE column fix**: lift filter now reads from `JP/RP_USE` column (detected by header name, fuzzy match) instead of hardcoded `JP/RP` at col 8. `Other` lift type = wells where `JP/RP_USE` value is not "JP" or "RP" (includes "Other"/"ALLOC" tagged rows).
- **LOS bucket additions**: `Ad Valorem Taxes→prod_taxes`, `LOE→fixed`, `Gathering, Trans. & Processing→variable_oil` added to LOS_BUCKETS fallback.

**2026-03-06 — Session 10**
- **Lift type multi-select filter** added to nav bar (JP / RP / Other pills, stacked below Op/Non-Op toggle). `liftFilter` is an array — multiple lift types can be active simultaneously. `filteredRows` applies AND logic between op + lift filters and OR logic across selected lift types. "Clear" button resets to all.
- **LOS Table $/BOE toggle**: `perBoe` state added to `LOSTableTab`. `bw()` wrapper divides dollar amounts by that month's total BOE when active. `fDol` / `fM` formatters show `$X.XX` (no unit suffix) — units are communicated via the table title only.
- **LOS Statement title is dynamic**: shows `"LOS Statement ($/BOE)"` when perBoe is on, `"LOS Statement ($)"` when off. No `/BOE` text appears next to individual cell values.
- **LOS Statement visual reformat**: section header rows (`rHdr`) now render as plain bold text in the sticky first column with no dark background and empty `<td>` cells for month columns — dates appear only once in the `<thead>`.
- **WBW units: MBoed → Boed / MMcfd → Mcfd**: New formatters `fBoed` and `fMcfd` display raw (unscaled) values. `WBW_TYPES` array and `WellMiniChart` internal formatters updated throughout. Labels updated (e.g. "Boed", "Mcfd").
- **Single-bar chart fix**: `maxBarSize={80}` added to all `BarChart` instances in `WellMiniChart` — prevents bars from stretching excessively wide when only one or two data points are visible after filtering.
- **Lift filter bug fix — well-level modal classification**: `filteredRows` previously checked `r.jpRp` at the row level, excluding all per-well cost rows when "Other" was selected. Fix v1 used "last non-empty" well-level classification. Fix v2 (current) uses **modal (most-frequent) classification counting blank rows** — this prevents a single stray JP/RP row on an ALLOC well from overriding the true classification. `wellJpRpCounts` tallies every row's jpRp (including blanks) per well; the modal value determines the well's lift type for filtering.
- **LOS table catch-all "Other Midstream" section**: Added `unknownCats` to surface any LOS category whose bucket doesn't resolve to a known bucket (null or unmapped). Rows slip through due to missing LOS_BUCKETS/COST_CAT_BUCKETS mappings appear in this section rather than being silently dropped.
- **LOS table section restructure** (matching financial statement image): replaced Variable Oil / Variable Water / Fixed & Workover / GPT / Production Taxes section headers with: **Direct LOE** (variable_oil + variable_water + fixed, excluding named recurring items), **Recurring LOE** (Overhead, LOE, Insurance — configured via `RECURRING_NAMES` Set), **Other Operating Expenses** (workover + prod_taxes + gpt). Subtotals are cumulative: Total Direct LOE → Total Recurring LOE (= Direct + Recurring) → Total Operating Expenses (= all). Operating Margin and Asset FCF are highlighted rows. Asset FCF = Op Margin − CAPEX − Other Midstream.
- **Sign handling bug fix (buildLOSCatData + accum)**: Both `buildLOSCatData` and `accum()` previously used `Math.abs()` on ALL amounts, including cost rows. Credit/reversal rows (stored as NEGATIVE in source) were incorrectly flipped to positive and added. Fix: revenue buckets (oil/gas/ngl) still use `Math.abs()` since they're stored negative; cost buckets (fixed, variable_oil, variable_water, gpt, workover, prod_taxes, capex) now use the raw signed amount directly so credits reduce totals correctly.
- **LOS_BUCKETS GPT fix**: `'Gathering, Trans. & Processing'` was incorrectly mapped to `'variable_oil'`; corrected to `'gpt'`. Same fix propagates to `accum()` automatically via `resolveBucket`. Note: rows where Cost Category column = 'Var' still resolve to 'variable_oil' (COST_CAT_BUCKETS takes priority in resolveBucket); only rows where LOS CATEGORY is 'Gathering, Trans. & Processing' AND Cost Category is not in COST_CAT_BUCKETS resolve to 'gpt' via LOS_BUCKETS.

**2026-03-06 — Session 9**
- **Operated / Non-Operated / Total filter** added to nav bar (pill toggle: Total | Operated | Non-Op). Filters `filteredRows` → `rollup` → `wellData` → all tabs simultaneously. Active filter label shown as badge in header stats.
- **ARIES Inputs split into Op/Non-Op**: state shape changed from `{vdrCase:{key}, myCase:{key}}` to `{vdrCase:{op:{key},obo:{key}}, myCase:{op:{key},obo:{key}}}`. InputsTab now shows 4 input columns (VDR Operated, VDR Non-Op, My Operated, My Non-Op) + 2 variance columns + Hist Avg.
- **`activeInputs`**: computed `useMemo` that flattens the op/obo sub-level based on the active `opFilter` (`'all'`→op, `'op'`→op, `'obo'`→obo). Passed to RollupTab and WellByWellTab for chart reference lines.
- **exportInputs**: updated to export 4 input columns (VDR Op, VDR OBO, My Op, My OBO) plus separate variance columns for each sub-case.
- **LOSTableTab**: now receives `filteredRows` (op-filtered) instead of raw `rows`, so the LOS table also respects the global op filter.

**2026-03-06 — Session 8**
- **LOS Table tab** (was "Well by Well Tables") completely replaced with a P&L-style LOS statement
- **View toggle**: dropdown to switch between "Portfolio Total" and any individual well
- **Net/Gross toggle**: switches all volumes and dollar amounts between net (NRI-adjusted) and gross (pre-NRI/WI)
- **Table structure**: Volumes (Gas/Oil/NGL/BOE + Daily Rate), Revenues, Direct LOE (per-category line items), Production Taxes (per-category), Total LOE, Operating Margin
- **LOE line items** are dynamic — all LOS_CATEGORY values from data are shown individually, alpha-sorted within each bucket group (fixed, variable_oil, variable_water)
- **Ties to rollup**: `buildLOSCatData()` uses the same bucket exclusions (skips null bucket + capex) as `buildMonthlyRollup()`, so Total LOE and Operating Margin match the Asset Rollup tab
- **`buildLOSCatData(rawRows, isGross)`** — new aggregation function; tracks per-category amounts and volumes per month; NGL volume converted gallons→BBL (/42); signs flipped via Math.abs() on both amount and volume
- **Tab label** changed from "Well by Well Tables" to "LOS Table"

**2026-03-06 — Session 7**
- **GAS BOE CONFIRMED**: `netBOE = oil_vol + ngl_vol + gas_vol/6` with `GAS_BOE = 6` constant. Added `netGasBOEd`, `grossGasBOEd`, `netGasBOE`, `grossGasBOE` to metrics() so stacked BOE charts correctly convert gas from MCF to BOE (was a unit mismatch bug: stacking MCF with BBL in previous sessions)
- **MBoed convention**: New formatters `fMBd` (MBoed/MBpd), `fMMcfd` (MMcfd), `fMdol` ($M). All production now displayed in thousands, gas in MMcf, costs in $M.
- **Bar chart labels**: Added `segLabel(fmt)` and `topLabel(fmt)` factory functions for Recharts `LabelList` content. Stacked bar charts now show: individual segment labels (white text inside each bar, hidden if bar < 14px) and total labels above each bar (dark text, 1 decimal).
- **Well by Well Charts**: Completely new `WBW_TYPES` array (28 types, vs 11 before). Organized by groups: Total Production, Oil & NGL, Gas Production, Costs ($M), Realized Prices, Taxes. Each group has primary (daily rate) and secondary (monthly total) variants.
- **WbwSelector**: New grouped chart type selector UI replaces the flat button list. Group labels + buttons organized by category.
- **Sort dropdown**: Changed from toggle buttons to `<select>` dropdown with distinct navy border styling (clearly different from toggle buttons).
- **Well by Well Tables**: `tableFmt` (number only, no unit) in cells; `tableLabel` as the column header showing metric name + unit; `WbwSelector` for metric selection; sort dropdown.
- **Asset Rollup** (renamed from Portfolio Rollup): Restructured into 4 sections: Volumes, Total Cost ($M), Unit Cost ($/Boe), Other. Now has 17 charts (was 13). All stacked bars have segment + total labels. Gas correctly converted to BOE in stacked charts.
- **Color palette update**: Dark navy (#1F3864) → medium blue (#2E74B5) → gray (#808080) → orange (#C55A11) → green (#548235) sequence. NGL changed from forest green to medium blue. Gas-in-BOE uses gray.
- **`LabelList`** added to Recharts destructuring.
- **Pushed to GitHub main branch**

**2026-03-06 — Session 6**
- Full UI overhaul to light mode (white bg, black fonts, IB pitchbook style)
- Applied Evercore IB color palette to all charts (navy oil, burnt orange gas, forest green NGL, etc.)
- Fixed sign flip: oil/gas/NGL volumes and revenues were stored negative — all now use `Math.abs()` in `accum()`
- Fixed all garbled Unicode in the HTML file (double-encoded UTF-8 chars like `â€"` for em dash) — replaced with clean ASCII
- Converted all LineCharts to BarCharts in Portfolio Rollup and Well-by-Well tabs
- Updated all chart titles to include units in parentheses (e.g., "Oil Volume (BBL/d)")
- Added sort controls to Well-by-Well tab: sort by Oil Vol, Gas Vol, or Total Vol (BOE) for most recent month
- Added "% of Total" column to each Well Card footer (contribution to total for most recent month using selected sort metric)
- ARIES VDR/My Case reference lines already active in Portfolio Rollup (orange dashed = My Case, gray dotted = VDR)
- Updated dynamic column detection notes in parsing (already implemented in Session 5)

**2026-03-06 — Session 5**
- User confirmed dashboard opens; new error when dropping CSV: "Expected 17+ tab-delimited columns; found 1"
- Root cause: data file (`Gross and Net LOS_3.5.26.csv`) is comma-delimited, not tab-delimited
- Fix: `parseCSVText()` updated to auto-detect delimiter (tabs vs commas in first line); PapaParse now uses detected delimiter
- UI hint text updated from "Tab-delimited" → "Tab or comma delimited"
- Updated CLAUDE.md Data File Specification and Project Overview to reflect comma support
- Pushed fixes to GitHub (`main`)
- **Still pending:** Node.js install for Vite project

**2026-03-06 — Session 4**
- User confirmed grey page shows red error card: "Missing: Recharts"
- Root cause 1: `recharts@2.12.7` UMD fails to load from both jsDelivr and unpkg on this machine
- Root cause 2: Recharts UMD requires `prop-types` globally (`window.PropTypes`) — was not loaded
- Fix: inlined entire Recharts 2.12.7 UMD build directly into `LOS Dashboard.html`; added `prop-types` CDN script before it; updated dependency guard to check `PropTypes`
- Removed `recharts.umd.js` local file approach (no longer needed — Recharts is inlined)
- Updated CLAUDE.md to reflect issue resolved; Recharts CDN failure is no longer an open item
- **Still pending:** Node.js install for Vite project

**2026-03-06 — Session 3**
- Initialized git repository in project root
- Created `.gitignore` (excludes `node_modules/`, `dist/`, raw CSV data files under `01. Analysis/` and `pe-los-dashboard/public/data/`)
- Made initial commit (20 files)
- Created private GitHub repo: https://github.com/IsaiasTristan/crescent-pass-los-dashboard
- Pushed to `main` branch via HTTPS
- Updated CLAUDE.md with repository section

**2026-03-05 — Session 2**
- Confirmed Node.js is NOT installed (`node --version` / `npm --version` both return "command not found" in Cursor terminal)
- User validated CLAUDE.md as sufficient context for agent handoff
- Added "Unresolved / Needs Confirmation" table to make blockers visible at the top of Current Status
- Updated Known Issue block with explicit Node.js confirmation and clearer next-step instruction
- Grey page fix in `LOS Dashboard.html` still unconfirmed — user has not yet tested in Chrome

**2026-03-05 — Session 1**
- Built full Vite project (17 files) from scratch per spec
- Built standalone HTML version (no Node.js required)
- Fixed grey page bug: Recharts CDN switched to jsDelivr, added onerror fallback, added dependency guard
- Fixed CSV BOM stripping for Excel-exported files
- Created this CLAUDE.md
- **Pending:** User needs to confirm whether grey page / dependency error is resolved after CDN fix
