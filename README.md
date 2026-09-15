# Craft Business Manager

Desktop-first business costing, inventory, production-yield, production-planning, and pricing manager for a craft business producing:

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
   ├── ExcelStorage (planned Phase 5 persistence)
   └── SQLiteStorage (future)
   ↓
Tauri filesystem boundary (planned Phase 6)
```

React components do not directly read or write spreadsheet cells.

## Implemented through Phase 4

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

The Production workspace now includes:

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

## Current phase boundaries

The following remain intentionally not implemented:

- Excel persistence/import/export — **Phase 5**;
- native Tauri filesystem workflow — **Phase 6**;
- stock reservation, automatic stock deduction, stock transaction history, or production posting — requires separate future planning;
- tax/VAT, marketplace/payment fees, accounting posting, and global overhead allocation — outside completed Phase 4 scope.

## Branching

- `main` — stable/releasable;
- `develop` — integration branch;
- `feature/*` — implementation work;
- `docs/*` — documentation/status closeout when useful.

## Validation status

Phase 4 final technical completion gate:

```text
81 test files passed
986 tests passed
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

Phase 4.6B validation PR: **#128 — MERGED**

Validation merge:

`154babc616253cb5da3578781563c61e6c53d372`

Exact post-merge CI:

`34981363478 — SUCCESS`

The existing Vite warning for the minified main JavaScript chunk being slightly above 500 kB is non-blocking and remains a future performance/code-splitting concern.

See:

- `docs/DEVELOPMENT_PLAN.md`
- `docs/PHASE_4_PROGRESS.md`
- `docs/PHASE_4_6B_REGRESSION_BUILD_COMPLETION.md`

## Current status

**Phase 0 — COMPLETE**  
**Phase 1 — COMPLETE**  
**Phase 2 — COMPLETE**  
**Phase 3 — COMPLETE**  
**Phase 4 — COMPLETE**

Next planned phase:

**Phase 5 — Excel Persistence — NEXT FOR SCOPE REVIEW / NOT STARTED**

Phase 5 must receive its own dedicated scope/decomposition review and development plan before implementation begins.
