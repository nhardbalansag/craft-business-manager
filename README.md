# Craft Business Manager

Desktop-first business costing, inventory, production-yield, production-planning, pricing, and persistence-foundation manager for a craft business producing:

- paintable plaster art and mold toys for kids;
- handmade candle pots / vessels;
- candles using handmade or purchased vessels;
- event candles and multi-component craft products.

## Project direction

The application uses **React + TypeScript + Vite** and is intended to be wrapped by **Tauri** for safe local desktop file access.

The business/domain layer remains storage-agnostic. Excel (`.xlsx`) is the planned first persisted business-data format through a storage adapter, with SQLite as a later migration option without rewriting business rules.

## Architecture

```text
React UI
   ↓
Application / Business Services
   ↓
Domain Models + Costing / Production / Pricing Engines
   ↓
Storage Port
   ├── ExcelStorage (Phase 5 — persistence work in progress)
   └── SQLiteStorage (future)
   ↓
Tauri filesystem boundary (planned Phase 6)
```

React components do not directly read or write spreadsheet cells.

## Implemented through Phase 5.1

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
- Product composition roles such as vessel, molded component, decorative component, insert, and accessory;
- direct and transitive cycle prevention;
- nested Product composition with corruption-safe traversal guards;
- active-source/dependency safeguards.

### Finished component stock and assembly capacity

- explicit finished ProductStock in whole `pc` counts;
- missing stock distinguished from explicit `0 pc`;
- archived historical stock remains inspectable/correctable;
- Material-backed component cost using Phase 1 costing;
- recursive Product-backed child cost roll-up;
- total component-aware Product cost/readiness;
- overall current assembly capacity from direct materials plus immediate component availability;
- Product-backed capacity uses explicit current ProductStock;
- no silent recursive manufacture of missing child stock;
- all tied limiting resources preserved with typed identity.

### Phase 4 pricing and unit economics

- Product financial profiles with explicit labor and overhead cost per unit;
- fixed-profit, markup, and target-margin pricing policies;
- missing financial evidence remains distinct from explicit zero;
- waste-adjusted standard direct-material pricing cost with separately visible safety reserve;
- recursively fully loaded Product-backed component production cost;
- authoritative total unit cost and readiness;
- selling price, profit per unit, effective markup, and effective margin;
- consolidated Product pricing quote/readiness service;
- dedicated Pricing workspace for financial-profile editing and read-only unit economics.

### Phase 4 batch financial planning

The Production workspace includes:

- Q-specific physical planned production cost;
- direct `pc` final-batch rounding effects;
- expected revenue;
- expected physical batch profit;
- effective batch margin;
- average physical cost per finished unit;
- current capacity feasibility;
- exact over-capacity quantity;
- advisory capacity warnings;
- every authoritative tied limiting resource;
- financial and feasibility readiness/issues;
- retained Phase 3 direct-material/component/capacity detail.

Requested quantity is never silently clamped to current capacity, and Phase 4 does not reserve or deduct stock.

### Phase 5.1 persistence contract foundation

Phase 5.1 is complete and establishes the storage-independent foundation required before XLSX byte encoding/decoding:

- complete versioned `BusinessDataset` covering all nine authoritative Phase 1–4 source collections;
- Material calibration evidence included in persisted source state;
- library-independent workbook v1 schema with 13 canonical normalized sheets;
- exact sheet/column contracts and child-row relationships;
- deterministic workbook ordering and source representation rules;
- formula-cell rejection policy for authoritative fields;
- complete pre-hydration dataset semantic validation;
- trim-aware/case-insensitive duplicate identity detection before repository hydration;
- durable cross-reference validation across all source collections;
- authoritative Product composition duplicate-source/self/cycle validation reuse;
- deterministic structured dataset diagnostics;
- missing-vs-zero/null source semantics preserved;
- historical archived relationships remain round-trippable when active-state constraints are live-edit rules;
- no silent repair or partial hydration of invalid candidates.

No concrete XLSX library or XLSX byte codec has been introduced yet.

## Current phase boundaries

The following remain intentionally not implemented:

- XLSX byte encode/decode and actual workbook import/export — **Phase 5.2+**;
- complete repository snapshot/hydration and load/save coordination — **Phase 5.3+**;
- native Tauri filesystem workflow — **Phase 6**;
- stock reservation, automatic stock deduction, stock transaction history, or production posting — requires separate future planning;
- tax/VAT, marketplace/payment fees, accounting posting, and global overhead allocation — outside completed Phase 4 scope.

## Branching

- `main` — stable/releasable;
- `develop` — integration branch;
- `feature/*` — implementation work;
- `docs/*` — documentation/status closeout when useful.

## Validation status

Latest integrated technical baseline after Phase 5.1C implementation:

```text
84 test files passed
1048 tests passed
30 Phase 5.1C focused tests
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

Phase 5.1C implementation PR: **#137 — MERGED**

Implementation merge:

`95b6cb35a85dbc1e71a2b4d71bc3dba8de23b40a`

Exact post-merge CI:

`34997700828 — SUCCESS`

The existing Vite warning for the minified main JavaScript chunk being slightly above 500 kB is non-blocking and remains a future performance/code-splitting concern.

See:

- `docs/DEVELOPMENT_PLAN.md`
- `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`
- `docs/PHASE_5_PROGRESS.md`
- `docs/PHASE_5_1C_DATASET_VALIDATION_REFERENCE_INTEGRITY.md`

## Current status

**Phase 0 — COMPLETE**  
**Phase 1 — COMPLETE**  
**Phase 2 — COMPLETE**  
**Phase 3 — COMPLETE**  
**Phase 4 — COMPLETE**  
**Phase 5 — IN PROGRESS**

Phase 5.1 is complete.

Current next task:

**Phase 5.2A — XLSX Library Evaluation & Codec Boundary — NEXT / NOT STARTED**

Do not begin 5.2A implementation until separately requested from the exact final green Phase 5.1C closeout baseline.
