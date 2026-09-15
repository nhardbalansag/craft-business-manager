# Craft Business Manager

Desktop-first business costing, inventory, production-yield, production-planning, pricing, and persistence manager for a craft business producing:

- paintable plaster art and mold toys for kids;
- handmade candle pots / vessels;
- candles using handmade or purchased vessels;
- event candles and multi-component craft products.

## Project direction

The application uses **React + TypeScript + Vite** and is intended to be wrapped by **Tauri** for safe local desktop file access.

The business/domain layer remains storage-agnostic. Excel (`.xlsx`) is the first persisted business-data format through storage/persistence adapters, with SQLite as a later migration option without rewriting business rules.

## Architecture

```text
React UI
   ↓
Application / Business Services
   ↓
Domain Models + Costing / Production / Pricing Engines
   ↓
Persistence Boundaries
   ├── BusinessDataset ↔ Workbook mapping
   ├── WorkbookCodec -> SheetJsWorkbookCodec
   ├── ExcelStorage (Phase 5 wiring still in progress)
   └── SQLiteStorage (future)
   ↓
Tauri filesystem boundary (planned Phase 6)
```

React components do not directly read or write spreadsheet cells.

## Implemented through Phase 5.2B

### Materials, products, production and pricing

The completed Phase 1–4 foundation includes:

- canonical `g`, `mL`, and `pc` units and standard/material-specific conversions;
- Material purchasing, costing, inventory and supplier/source metadata;
- Product categories, MixPresets, real-production YieldSamples, fixed recipes and safety waste;
- stock-based production capacity and limiting-resource analysis;
- purchased and handmade Product components/vessels with cycle-safe nested composition;
- explicit finished ProductStock and component-aware cost/capacity;
- Product financial profiles, fully loaded costs, fixed-profit/markup/margin pricing;
- planned-batch cost, revenue, profit, margin and capacity warnings;
- Materials, Products, Yield, Production and Pricing workflows.

### Phase 5.1 persistence contract foundation

Phase 5.1 is complete and provides:

- complete versioned `BusinessDataset` covering all nine authoritative source collections;
- Material calibration evidence in persisted source state;
- library-independent workbook v1 schema with 13 canonical normalized sheets;
- exact sheet/column contracts and child-row relationships;
- deterministic workbook ordering/source-representation rules;
- formula-cell rejection policy and literal-text semantics;
- complete pre-hydration dataset semantic validation;
- duplicate identity, durable cross-reference and Product composition graph validation;
- deterministic diagnostics;
- missing-vs-zero/null semantics preserved;
- no silent repair or partial hydration.

### Phase 5.2A XLSX codec foundation

Phase 5.2A is complete.

- **SheetJS Community Edition 0.20.3** is selected and pinned from the exact maintained upstream tarball;
- `WorkbookCodec` provides a library-neutral workbook-byte boundary;
- `SheetJsWorkbookCodec` is the only SheetJS-specific production adapter;
- XLSX encode/decode is fully in memory;
- encode returns `Uint8Array`;
- decode accepts `Uint8Array | ArrayBuffer`;
- authoritative formula writes are rejected;
- real inbound formulas are surfaced as formula metadata instead of being evaluated;
- formula-looking strings remain literal text;
- 12 focused real-XLSX tests cover the codec boundary.

### Phase 5.2B deterministic XLSX export

Phase 5.2B is complete.

The application now has a complete authoritative export direction:

```text
BusinessDataset
   -> validate complete source state
   -> canonical WorkbookNeutralDocument
   -> validate workbook schema
   -> WorkbookCodec / SheetJS
   -> Uint8Array XLSX bytes
```

Delivered behavior includes:

- all 13 canonical workbook sheets, including empty required sheets;
- exact schema-owned column ordering;
- `_Meta` written first with explicit `exportedAt` metadata and no hidden clock;
- deterministic top-level row ordering independent of source-array order;
- MixPreset categories/lines and YieldSample inputs normalized into ordered child sheets;
- Material supplier/source metadata flattened into explicit source columns;
- Product pricing policy flattened without conflating null and numeric zero;
- missing ProductStock/profile evidence preserved as missing;
- explicit zero and boolean false preserved;
- full source numeric precision and ISO timestamp text preserved;
- formula-looking user/source text preserved literally through real `.xlsx` bytes;
- invalid datasets rejected before codec invocation with structured validation issues;
- generated neutral workbook self-validated before byte encoding;
- exporter does not mutate input source data.

## Current phase boundaries

The following remain intentionally not implemented:

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

Latest integrated technical baseline after Phase 5.2B implementation:

```text
86 test files passed
1073 tests passed
13 Phase 5.2B focused export tests
12 Phase 5.2A real-XLSX codec tests
30 Phase 5.1C dataset validation tests
22 Phase 5.1B workbook schema tests
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

Phase 5.2B implementation PR: **#143 — MERGED**

Implementation merge:

`296960ee2f6e70999f4d279d59f977f4cf1c1d22`

Exact post-merge CI:

`35007932757 — SUCCESS`

The existing Vite warning for the minified main JavaScript chunk being slightly above 500 kB remains non-blocking. Persistence is not yet wired into the React application entry path, so later UI/runtime integration should remeasure bundle impact and may use deferred/dynamic loading.

See:

- `docs/DEVELOPMENT_PLAN.md`
- `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`
- `docs/PHASE_5_PROGRESS.md`
- `docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT.md`

## Current status

**Phase 0 — COMPLETE**  
**Phase 1 — COMPLETE**  
**Phase 2 — COMPLETE**  
**Phase 3 — COMPLETE**  
**Phase 4 — COMPLETE**  
**Phase 5 — IN PROGRESS**

Phase 5.1, 5.2A, and 5.2B are complete.

Current next task:

**Phase 5.2C — Strict XLSX-to-Dataset Import & Diagnostics — NEXT / NOT STARTED**

5.2C must first receive a dedicated scope/decomposition review and development plan from the exact final green 5.2B closeout baseline before implementation begins.
