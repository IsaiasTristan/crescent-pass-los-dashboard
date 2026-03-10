### Current Development Focus
Refining the LOS dashboard so ARIES model assumptions can be validated directly against historical LOS, pricing, and volume data. Current work is focused on improving the relationship between the `ARIES Inputs` experience and the supporting historical charts, especially for operated versus non-operated assumptions.

### Key Decisions / Constraints
The project is a client-side private-equity diligence tool with no backend. The canonical app lives in `pe-los-dashboard/` as a Vite + React build, while `LOS Dashboard.html` remains a standalone no-install version. Business logic is kept in canonical modules under `src/constants`, `src/ingest`, `src/domain`, `src/selectors`, `src/export`, `src/charts`, and `src/utils`; the UI consumes those modules rather than re-implementing calculations inline.

The dashboard ingests LOS CSV data, supports historical pricing and gross-volume uploads, and uses those datasets to build monthly rollups, well-level histories, and ARIES-supporting metrics such as unit LOE, taxes, and differentials. Operated / Non-Operated and lift-type filters are core to the analysis and should continue to shape historical validation views.

### Major Changes Log
- 2026-03-09: Added historical gross-volume support so net water can be derived from `gross water / WI` and used for water-cost validation.
- 2026-03-09: Added a dedicated high-level project brief file so all agents have a concise shared context source in addition to the detailed `ProjectBrief.md`.
