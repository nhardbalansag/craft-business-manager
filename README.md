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

## Implemented through Phase 2

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

### Production planning

- direct-material cost preview;
- product safety-waste reserve;
- waste-adjusted per-piece and planned-batch requirements;
- whole-count physical batch rounding for indivisible `pc` materials;
- normalized-inventory producible-piece capacity;
- all tied limiting materials;
- Products, Yield, and Production Estimate workspaces.

Mold volume remains optional. Real sample production evidence is authoritative.

## Phase boundaries

The following are intentionally not yet implemented:

- purchased vessels / container component composition;
- molded or nested child-product composition;
- multi-component capacity and cost roll-up;
- selling price, markup, margin, revenue, and profit policy;
- Excel persistence/import/export;
- native Tauri file-system workflow.

## Branching

- `main` — stable/releasable;
- `develop` — integration branch;
- `feature/*` — implementation work;
- `docs/*` — documentation/status closeout when useful.

## Validation status

Phase 2 final completion gate:

```text
38 test files passed
349 tests passed
TypeScript typecheck passed
Production Vite build passed
```

Phase 2.6B completion merge: `e79303fdcad4fb298154be957f938584f164a61b`

Post-merge CI run: `34908149932` — success.

See:

- `docs/DEVELOPMENT_PLAN.md`
- `docs/PHASE_2_PROGRESS.md`
- `docs/PHASE_2_6B_REGRESSION_BUILD_COMPLETION.md`

## Current status

**Phase 0 — COMPLETE**  
**Phase 1 — COMPLETE**  
**Phase 2 — COMPLETE**

Next: **Phase 3 — Product Components, Vessels & Nested Molded Products**.

Phase 3 should be assessed and split into explicit implementation phases/sub-phases before development begins.
