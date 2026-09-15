# Craft Business Manager

Desktop-first business costing, inventory, production-yield, and pricing manager for a craft business producing:

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
Domain Models + Costing / Production Engines
   ↓
Storage Port
   ├── ExcelStorage (planned v1 persistence)
   └── SQLiteStorage (future)
   ↓
Tauri filesystem boundary
```

React components do not directly read or write spreadsheet cells.

## Implemented through Phase 3

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

### Finished component stock

- explicit finished ProductStock in whole `pc` counts;
- missing stock distinguished from explicit `0 pc`;
- archived historical stock remains inspectable/correctable;
- ProductStock is current assembly availability and is not derived from raw-material buildability.

### Component-aware cost and assembly capacity

- Material-backed component cost using Phase 1 costing;
- recursive Product-backed child cost roll-up;
- total component-aware Product cost/readiness;
- Phase 2 direct-material cost remains distinguishable from Phase 3 component cost;
- per-component assembly capacity;
- overall current assembly capacity from direct materials plus immediate component availability;
- Product-backed capacity uses explicit current ProductStock;
- no silent recursive manufacture of missing child stock;
- all tied limiting resources preserved with typed identity.

### Component-aware UI

The Products workspace now includes:

- Products;
- Mix presets;
- Components;
- Finished stock.

The Production workspace now shows:

- direct materials required to make the parent;
- discrete components required to assemble the parent;
- current component availability and per-component capacity;
- final assembly capacity;
- all tied typed limiting resources;
- component-aware cost;
- nested recursive component cost paths;
- readiness/issues.

## Current phase boundaries

The following remain intentionally not implemented:

- labor and overhead costing;
- selling price, fixed-profit pricing, markup, margin, revenue, and profit policy — **Phase 4**;
- Excel persistence/import/export — **Phase 5**;
- native Tauri filesystem workflow — **Phase 6**;
- stock reservation, automatic stock deduction, stock transaction history, or production posting — requires separate future planning.

## Branching

- `main` — stable/releasable;
- `develop` — integration branch;
- `feature/*` — implementation work;
- `docs/*` — documentation/status closeout when useful.

## Validation status

Phase 3 final completion gate:

```text
55 test files passed
628 tests passed
7 React smoke tests
5 Phase 3.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
```

Phase 3.6B completion PR: **#93**

Implementation merge:

`ceef43e2181d8696e0408457860905da1b8e6b46`

Post-merge CI:

`34930387721` — success.

See:

- `docs/DEVELOPMENT_PLAN.md`
- `docs/PHASE_3_PROGRESS.md`
- `docs/PHASE_3_6B_REGRESSION_BUILD_COMPLETION.md`

## Current status

**Phase 0 — COMPLETE**  
**Phase 1 — COMPLETE**  
**Phase 2 — COMPLETE**  
**Phase 3 — COMPLETE**

Next planned phase:

**Phase 4 — Pricing & Production Planning — NEXT / NOT STARTED**

Phase 4 should receive its own scope review and dedicated development plan before implementation begins.