# Craft Business Manager

Desktop-first business costing, inventory, production-yield, production-planning, pricing, and persistence-foundation manager for a craft business producing:

- paintable plaster art and mold toys for kids;
- handmade candle pots / vessels;
- candles using handmade or purchased vessels;
- event candles and multi-component craft products.

## Project direction

The application uses **React + TypeScript + Vite** and is intended to be wrapped by **Tauri** for safe local desktop file access.

The business/domain layer remains storage-agnostic. Excel (`.xlsx`) is the first planned persisted business-data format through storage/persistence adapters, with SQLite as a later migration option without rewriting business rules.

## Architecture

```text
React UI
   ↓
Application / Business Services
   ↓
Domain Models + Costing / Production / Pricing Engines
   ↓
Persistence Boundaries
   ├── WorkbookCodec -> SheetJsWorkbookCodec
   ├── ExcelStorage (Phase 5 wiring still in progress)
   └── SQLiteStorage (future)
   ↓
Tauri filesystem boundary (planned Phase 6)
```

React components do not directly read or write spreadsheet cells.

## Implemented through Phase 5.2A

### Materials, units, costing, inventory and calibration

- canonical `g`, `mL`, and `pc` internal units;
- standard measurement conversion;
- package costing and cost per base unit;
- current inventory normalization and valuation;
- material-specific cup-to-weight calibration/manual fallback;
- supplier/source metadata;
- Materials and Calibration workspaces.

### Products, mixes and real-production yield learning

- paintable-art, candle-pot, and candle product categories;
- reusable weight/volume mix presets;
- immutable multi-material yield samples;
- good/rejected output tracking;
- latest-derivable yield selection and fallback;
- learned canonical material requirement per good piece;
- fixed recipe materials and roles;
- yield + fixed requirement synthesis with source traceability.

### Production planning foundation

- direct-material cost preview;
- product safety-waste reserve;
- waste-adjusted per-piece and planned-batch requirements;
- whole-count physical batch rounding for indivisible `pc` materials;
- normalized-inventory producible-piece capacity;
- all tied direct-material limiters;
- Products, Yield, and Production workspaces.

Mold volume remains optional. Real sample production evidence is authoritative.

### Product components, vessels and nested products

- typed Product components backed by either a Material or another Product;
- purchased glass/plastic/stainless vessels handled as count-based Material components;
- handmade plaster pots and molded parts handled as Product-backed components;
- positive whole-piece component quantities;
- structural component roles;
- direct and transitive cycle prevention;
- nested Product composition with corruption-safe traversal guards;
- active-source/dependency safeguards.

### Finished component stock and assembly capacity

- explicit finished ProductStock in whole `pc` counts;
- missing stock distinguished from explicit `0 pc`;
- archived historical stock remains inspectable/correctable;
- Material-backed and recursive Product-backed component cost;
- component-aware Product cost/readiness;
- direct-material plus component assembly capacity;
- no silent recursive manufacture of missing child stock;
- all tied limiting resources preserved with typed identity.

### Phase 4 pricing and production planning

- Product financial profiles with explicit labor/overhead and configurable pricing policy;
- fixed-profit, markup, and target-margin pricing;
- recursively fully loaded production cost;
- selling price, profit, markup, and margin metrics;
- Q-specific physical planned batch production cost;
- expected revenue/profit/margin;
- capacity feasibility and advisory warnings;
- Pricing and Production financial workflows.

### Phase 5.1 persistence contract foundation

Phase 5.1 is complete and provides:

- complete versioned `BusinessDataset` covering all nine authoritative source collections;
- Material calibration evidence in persisted source state;
- library-independent workbook v1 schema with 13 canonical normalized sheets;
- exact sheet/column contracts and child-row relationships;
- deterministic workbook ordering/source-representation rules;
- formula-cell rejection policy and literal-text semantics;
- complete pre-hydration dataset semantic validation;
- case-insensitive duplicate identity detection before repository hydration;
- durable cross-reference and Product composition graph validation;
- deterministic diagnostics;
- missing-vs-zero/null semantics preserved;
- legitimate historical archived relationships remain round-trippable;
- no silent repair or partial hydration.

### Phase 5.2A XLSX codec foundation

Phase 5.2A is complete.

- **SheetJS Community Edition 0.20.3** is selected and pinned from the exact maintained upstream tarball;
- public npm `xlsx` is intentionally not used as the authoritative dependency source;
- `WorkbookCodec` provides a library-neutral workbook-byte boundary;
- `SheetJsWorkbookCodec` is the only SheetJS-specific production adapter;
- XLSX encode/decode is fully in memory;
- encode returns `Uint8Array`;
- decode accepts `Uint8Array | ArrayBuffer`;
- worksheet order and primitive cells round-trip through real `.xlsx` bytes;
- formula-looking strings such as `=1+1` remain literal text;
- authoritative formula writes are rejected;
- real inbound formulas are surfaced as formula metadata rather than evaluated as source data;
- decoded formulas feed the existing `FORMULA_CELL_NOT_ALLOWED` validation policy;
- no Node filesystem, Tauri filesystem, or browser file-picker dependency is required by the codec;
- 12 focused real-XLSX tests cover the codec boundary and safety behavior.

## Current phase boundaries

The following remain intentionally not implemented:

- deterministic `BusinessDataset -> WorkbookNeutralDocument -> XLSX` export mapping — **Phase 5.2B**;
- strict workbook-to-dataset reconstruction/import diagnostics — **Phase 5.2C**;
- complete repository snapshot/hydration and load/save coordination — **Phase 5.3+**;
- `ExcelStorage.load/save` runtime wiring — later Phase 5;
- browser persistence UI — **Phase 5.5**;
- native Tauri filesystem workflow — **Phase 6**;
- stock reservation, automatic stock deduction, stock transaction history, or production posting — separate future planning;
- tax/VAT, marketplace/payment fees, accounting posting, and global overhead allocation — outside completed Phase 4 scope.

## Branching

- `main` — stable/releasable;
- `develop` — integration branch;
- `feature/*` — implementation work;
- `docs/*` — documentation/status closeout when useful.

## Validation status

Latest integrated technical baseline after Phase 5.2A implementation:

```text
85 test files passed
1060 tests passed
12 Phase 5.2A focused tests
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

Phase 5.2A implementation PR: **#140 — MERGED**

Implementation merge:

`8468edf288b014a00f4f1529442fa043084f1102`

Exact post-merge CI:

`35002844064 — SUCCESS`

The existing Vite warning for the minified main JavaScript chunk being slightly above 500 kB remains non-blocking. SheetJS has not yet entered the React application entry bundle because the codec is not yet UI/application-reachable; later persistence wiring must remeasure bundle impact and may use deferred/dynamic loading.

See:

- `docs/DEVELOPMENT_PLAN.md`
- `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`
- `docs/PHASE_5_PROGRESS.md`
- `docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY.md`

## Current status

**Phase 0 — COMPLETE**  
**Phase 1 — COMPLETE**  
**Phase 2 — COMPLETE**  
**Phase 3 — COMPLETE**  
**Phase 4 — COMPLETE**  
**Phase 5 — IN PROGRESS**

Phase 5.1 is complete. Phase 5.2A is complete.

Current next task:

**Phase 5.2B — Deterministic Dataset-to-XLSX Export — NEXT / NOT STARTED**

Do not begin 5.2B implementation until separately requested from the exact final green Phase 5.2A closeout baseline. It should first receive a dedicated scope/decomposition review and development plan.
