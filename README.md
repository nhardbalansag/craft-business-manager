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

## Implemented through Phase 5.2

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

- **SheetJS Community Edition 0.20.3** is selected and pinned from the maintained upstream tarball;
- `WorkbookCodec` provides a library-neutral workbook-byte boundary;
- `SheetJsWorkbookCodec` is the only SheetJS-specific production adapter;
- XLSX encode/decode is fully in memory;
- encode returns `Uint8Array`;
- decode accepts `Uint8Array | ArrayBuffer`;
- authoritative formula writes are rejected;
- real inbound formulas surface as formula metadata rather than being evaluated;
- formula-looking strings remain literal text;
- 12 focused real-XLSX tests cover the codec boundary.

### Phase 5.2B deterministic XLSX export

Phase 5.2B is complete.

```text
BusinessDataset
   -> validate complete source state
   -> canonical WorkbookNeutralDocument
   -> validate workbook schema
   -> WorkbookCodec / SheetJS
   -> Uint8Array XLSX bytes
```

Export covers all 13 canonical sheets, explicit metadata, deterministic rows/columns, normalized child sheets, source-metadata flattening, null-vs-zero fidelity, high-precision source numbers, ISO timestamp text, literal formula-looking text, and generated-workbook self-validation.

### Phase 5.2C strict XLSX import

Phase 5.2C is complete.

```text
XLSX bytes
   -> WorkbookCodec decode
   -> workbook schema + current metadata validation
   -> reconstruct all nine source collections
   -> reconstruct normalized child arrays
   -> orphan/order integrity checks
   -> Phase 5.1C dataset validation
   -> accepted BusinessDataset + imported workbook metadata
```

Import behavior includes:

- controlled codec/schema/metadata/reconstruction/dataset diagnostics;
- current-version-only fail-closed validation;
- Material source metadata reconstructed only when evidence exists;
- nullable pricing policy reconstructed without conflating null and explicit zero;
- MixPreset categories/lines and YieldSample inputs rebuilt by explicit order;
- trim-aware case-insensitive child-parent matching while preserving authoritative parent IDs;
- orphan child, duplicate order, gap, and non-1-starting sequence rejection;
- formula cells rejected before reconstruction; cached formula values are never accepted as source data;
- formula-looking literal text remains literal through real XLSX bytes;
- complete 5.2B export -> XLSX -> 5.2C import semantic round-trip;
- no repository/session mutation during import.

## Current phase boundaries

The following remain intentionally not implemented:

- complete source snapshot operation — **Phase 5.3A**;
- validated atomic repository/session hydration — **Phase 5.3B**;
- persistence coordinator and `ExcelStorage.load/save` lifecycle — **Phase 5.3C**;
- older-workbook migration — **Phase 5.4A**;
- backup/atomic-write transport — **Phase 5.4B**;
- full hostile-workbook corruption/resource-limit hardening — **Phase 5.4C**;
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

Latest integrated technical baseline after Phase 5.2C implementation:

```text
87 test files passed
1091 tests passed
18 Phase 5.2C focused import tests
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

Phase 5.2C implementation PR: **#146 — MERGED**

Implementation merge:

`3cd2bb280ef463b2267cafbbd28b9b9aba1fb656`

Exact post-merge CI:

`35012385953 — SUCCESS`

The existing Vite warning for the minified main JavaScript chunk being slightly above 500 kB remains non-blocking. Persistence is not yet wired into the React application entry path, so later runtime/UI integration should remeasure bundle impact and may use deferred/dynamic loading.

See:

- `docs/DEVELOPMENT_PLAN.md`
- `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`
- `docs/PHASE_5_PROGRESS.md`
- `docs/PHASE_5_2C_STRICT_XLSX_TO_DATASET_IMPORT_DIAGNOSTICS.md`

## Current status

**Phase 0 — COMPLETE**  
**Phase 1 — COMPLETE**  
**Phase 2 — COMPLETE**  
**Phase 3 — COMPLETE**  
**Phase 4 — COMPLETE**  
**Phase 5 — IN PROGRESS**

Phase 5.1 and Phase 5.2 are complete.

Current next task:

**Phase 5.3A — Complete Source Snapshot Service — NEXT / NOT STARTED**

5.3A must first receive a dedicated scope/decomposition review and development plan from the exact final green Phase 5.2C closeout baseline before implementation begins.
