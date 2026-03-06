# PE E&P LOS Dashboard — Project Context

This file is shared between Claude Code (CLI) and Claude in Cursor so both can work on the same project with full context. Update this file whenever significant decisions are made or status changes.

---

## Project Overview

A private-equity due diligence tool for analyzing well-by-well Lease Operating Statements (LOS) on a private E&P acquisition. The app ingests a tab-delimited CSV of LOS data, aggregates it, and produces investment-committee-quality charts with ARIES model assumption overlays.

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
- [x] CSV parsing — tab-delimited, 22-column LOS format
- [x] Data aggregations — monthly rollup + per-well monthly series
- [x] 13 portfolio rollup charts with mini data tables
- [x] ARIES input form (VDR Case / My Case / Variance / Historical Avg)
- [x] ARIES overlay reference lines on charts (gold dashed = My Case, slate dotted = VDR)
- [x] Well-by-well cards with 11 chart type options and search/filter
- [x] Export to CSV (ARIES inputs + full historical data)
- [x] BOM stripping for Excel-exported CSVs
- [x] Dependency guard with helpful error messages if CDN scripts fail

### Known Issue Being Debugged
- Grey "Loading..." page on first open — caused by CDN script failure (most likely Recharts UMD not loading)
- Fix applied: switched to jsDelivr for Recharts, added onerror fallback to unpkg, added dependency guard that shows a named error card instead of silent grey screen
- **Next step:** User needs to open `LOS Dashboard.html` directly in Chrome and report whether they see the app or a red error card naming the failed script
- **Node.js:** Confirmed NOT installed as of 2026-03-05 — `node --version` and `npm --version` both return "command not found" in Cursor terminal. Must install from [nodejs.org](https://nodejs.org) (LTS) before `pe-los-dashboard/` can be used.

### Unresolved / Needs Confirmation

> **Read this before starting any session.** These items are blocking or uncertain and need user input before proceeding.

| # | Item | Action Required |
|---|------|-----------------|
| 1 | Grey "Loading..." page in `LOS Dashboard.html` | User must open the file directly in Chrome and report: does it show the app, or a red error card naming a failed script? |
| 2 | Node.js not installed | User must install Node.js LTS from [nodejs.org](https://nodejs.org), then restart Cursor, before the Vite project can be used |

---

### Not Yet Built (Future)
- [ ] GPT (Gathering/Processing/Transport) — separate CSV integration, TBD format
- [ ] WTI oil price strip overlay
- [ ] ARIES export formatted for ARIES economic model input

---

## Data File Specification

**Format:** Tab-delimited, 22 columns (0-indexed), one row per well × month × LOS category

| Index | Column | Notes |
|-------|--------|-------|
| 0 | Well Name | Trim whitespace |
| 1 | Cost Category | Fixed, Var, VW, RevO, RevG, RevNGL, PTo, Other |
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
- `Net Volume` on RevO/RevG/RevNGL rows = production volumes
- `CAPEX` rows excluded from all LOS totals
- Dataset: ~40 wells × 24 months ≈ 5,000–10,000 rows
- Parser auto-detects and skips header row, strips Excel BOM (`\uFEFF`), normalizes CRLF

---

## LOS Category → Bucket Mapping

```js
const LOS_BUCKETS = {
  'Oil': 'oil', 'Gas': 'gas', 'NGL': 'ngl',            // revenue + volume
  'Chemicals': 'variable_oil', 'Fuel & Power': 'variable_oil',
  'Liquids Hauling & Disposal': 'variable_water',
  'Company Labor': 'fixed', 'Contract Labor/Pumper': 'fixed',
  'Field Office': 'fixed', 'EHS & Regulatory': 'fixed',
  'Measurement/Automation': 'fixed', 'Surface Repairs & Maint': 'fixed',
  'Vehicles': 'fixed', 'Well Servicing': 'fixed',
  'Production Taxes-Oil': 'prod_taxes', 'Production Taxes-Gas': 'prod_taxes',
  'Production Taxes-NGL': 'prod_taxes',
  'CAPEX': 'capex',  // excluded from LOS
}
```

Fallback: if LOS CATEGORY not in map, use Cost Category tag (Fixed→fixed, Var→variable_oil, VW→variable_water, RevO→oil, etc.)

---

## Key Calculations

```js
const GAS_BOE = 6  // 6 MCF = 1 BOE

netBOE        = oil_vol + ngl_vol + (gas_vol / 6)
totalRevenue  = abs(oil_rev) + abs(gas_rev) + abs(ngl_rev)  // revenue stored negative
totalLOS      = fixed + var_oil + var_water + prod_taxes     // CAPEX excluded
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

## Design System

```
Background:      #0f1117
Card background: #1a1d27
Border:          #2a2d3a
Text primary:    #f0f0f0
Text secondary:  #8b8fa8
Text muted:      #4a4d5a

Chart colors:
  Oil:           #4e9af1  (steel blue)
  Gas:           #f59e0b  (amber)
  NGL:           #10b981  (emerald)
  Fixed:         #6366f1  (indigo)
  Var Oil:       #f97316  (orange)
  Var Water:     #06b6d4  (cyan)
  Prod Taxes:    #a78bfa  (violet)
  Revenue:       #34d399  (green)
  Margin:        #f472b6  (pink)
  Cost/BOE:      #e879f9  (fuchsia)
  My Case:       #facc15  gold dashed line
  VDR Case:      #94a3b8  slate dotted line

Font: Inter (Google Fonts)
```

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
{
  vdrCase: {
    fixedPerWellMonth: '',   // $/well/month — flat, no escalation
    varOilPerBOE:      '',   // $/BOE — applied to oil + NGL
    varWaterPerBBL:    '',   // $/BBL water — water vols not in LOS
    prodTaxPct:        '',   // % of gross revenue
    oilDiff:           '',   // $/BBL vs WTI (negative = discount)
    gasDiff:           '',   // $/MMBTU vs Henry Hub
    nglDiffPct:        '',   // % of WTI e.g. 35
  },
  myCase: { ...same keys... }
}
// Variance = myCase - vdrCase
// Green = My Case better (lower cost, or higher differential)
// Red   = My Case worse
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
5. Recharts 2.12.7 (jsdelivr, with unpkg fallback via onerror)
6. Babel Standalone 7.24.0
7. <script type="text/babel"> — all app code
```

If any script fails, a dependency guard at the top of the Babel script catches it and shows a named error card instead of a silent grey page.

---

## Session Log (reverse chronological)

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
