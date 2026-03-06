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
- [x] Well-by-well cards with 11 chart type options, search/filter, and sort (oil/gas/total vol)
- [x] % of Total shown in each well card footer (contribution to portfolio for most recent month)
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
- [ ] GPT (Gathering/Processing/Transport) — separate CSV integration, TBD format
- [ ] WTI oil price strip overlay
- [ ] ARIES export formatted for ARIES economic model input

---

## Data File Specification

**Format:** Tab- or comma-delimited (auto-detected), 22 columns (0-indexed), one row per well × month × LOS category

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
- **NGL volume is in gallons in the source data** — divide by 42 to convert to BBL before all calculations (1 BBL = 42 gallons). Applied in `accum()` for both net and gross NGL volume.
- `Net Volume` on RevO/RevG/RevNGL rows = production volumes
- `CAPEX` rows excluded from all LOS totals
- Dataset: ~40 wells × 24 months ≈ 5,000–10,000 rows
- Parser auto-detects delimiter (tab vs comma by inspecting first line), skips header row, strips Excel BOM (`\uFEFF`), normalizes CRLF

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
