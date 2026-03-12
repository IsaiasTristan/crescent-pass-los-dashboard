### Current Development Focus
Refining the LOS dashboard so ARIES model assumptions can be validated directly against historical LOS, pricing, volume, and midstream GPT statement data. Current work is focused on standardizing global unit-cost formulas across ARIES inputs, rollup charts, and historical validation views, especially for operated versus non-operated assumptions.

### Key Decisions / Constraints
The project is a client-side private-equity diligence tool with no backend. The canonical app lives in `pe-los-dashboard/` as a Vite + React build, while `LOS Dashboard.html` remains a standalone no-install version. Business logic is kept in canonical modules under `src/constants`, `src/ingest`, `src/domain`, `src/selectors`, `src/export`, `src/charts`, and `src/utils`; the UI consumes those modules rather than re-implementing calculations inline.

The dashboard ingests LOS CSV data, supports historical pricing and gross-volume uploads, and now supports dedicated midstream GPT statement uploads with flexible header mapping. These datasets build monthly rollups, well-level histories, and ARIES-supporting metrics such as unit LOE, taxes, and differentials. Current global formulas use gross oil cost over gross oil volume, gross fixed and gross workover cost over monthly active well counts, gross water cost over gross water volume, and GP&T assumptions that are LOS-derived by default but GPT-statement-derived for operated slices when GPT data is available. Operated / Non-Operated and lift-type filters are core to the analysis and should continue to shape historical validation views.

### Major Changes Log
- 2026-03-11: Added a modular GPT Analysis feature (new parser, formula module, selector, and tab UI) for variable-format midstream statements and by-meter monthly output tables with total rollup.
- 2026-03-11: Integrated operated-only GPT-derived assumptions into monthly rollups (`gptPerMcf`, `gasDifferential`, `nglDifferential`), while keeping OBO slices LOS-derived.
- 2026-03-11: Updated status freshness check: `node --version = v24.14.0`, `npm --version = 11.9.0`, `npm test` passing (`113` tests).
- 2026-03-09: Updated global unit-cost formulas so oil/water/GP&T use the latest gross-vs-net definitions and JP/RP fixed-workover metrics use rolling lift-specific well counts.
- 2026-03-09: Completed a status freshness check and reconfirmed `node --version = v24.14.0`, `npm --version = 11.9.0`, and a passing `npm test`.
- 2026-03-09: Added historical gross-volume support for volume-based validation inputs.
- 2026-03-09: Added a dedicated high-level project brief file so all agents have a concise shared context source in addition to the detailed `ProjectBrief.md`.
