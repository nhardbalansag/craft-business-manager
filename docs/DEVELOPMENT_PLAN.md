# Craft Business Manager — Development Plan

## Objective

Build a desktop-first tool for material costing, mold-yield learning, inventory-based production estimates, multi-vessel candle recipes, and selling-price/profit planning.

The domain layer must not depend on Excel so persistence can move to SQLite later.

## Phase 0 — Repository & Architecture Foundation

Status: **COMPLETE**

Completed foundation:

- React + TypeScript + Vite scaffold
- `main` and `develop` branch strategy
- domain type contracts
- pure costing/yield helpers
- storage-port abstraction
- Excel adapter boundary
- Vitest automated tests for current costing/yield primitives
- GitHub Actions CI using Node 22

Completion gate: **PASSED**

- dependency installation succeeds
- TypeScript typecheck succeeds
- automated domain tests succeed
- production build succeeds
- architecture decisions are documented

Validation evidence:

- Phase 0 PR: `#2`
- CI workflow validates `npm install`, `npm run typecheck`, `npm run test:run`, and `npm run build`

## Phase 1 — Materials, Units & Calibration

Status: **PLANNED — DEVELOPMENT NOT STARTED**

Dedicated plan: `docs/PHASE_1_MATERIALS_UNITS_CALIBRATION_PLAN.md`

Implementation sequence:

```text
1.1 — Measurement & Conversion Foundation
1.2 — Material Master Domain
1.3 — Purchase Costing & Inventory Quantity
1.4 — Material-Specific Calibration
1.5 — Supplier & Source Metadata
1.6 — Phase 1 Integration & Completion Gate
```

The detailed plan further splits each subphase into implementation-sized tasks and defines unit standards, cross-dimension conversion rules, calibration precedence, completion gates, and branch/PR sequencing.

Next active implementation task after this planning change:

**1.1A — Unit Catalog & Dimensional Rules**

## Phase 2 — Product Recipes & Mold Yield

- three categories: paintable art, candle pot, candle
- mix presets and ratio basis
- sample-yield recording
- good/rejected piece tracking
- material-per-good-piece calculation
- safety-waste adjustment
- estimated producible pieces from inventory

Mold volume is optional; sample batches are authoritative when volume is unknown.

## Phase 3 — Multi-Vessel / Multi-Component Products

A sellable candle may include multiple components, for example:

- 1 glass cup
- 3 mini heart molded components
- 2 mini flower molded components
- 1 wick
- 1 label

The system must calculate both total component cost and the limiting component capacity.

## Phase 4 — Pricing & Production Planning

- total unit cost including waste-adjusted material usage
- fixed profit amount
- markup percentage
- target margin percentage
- planned batch cost
- expected revenue and profit
- production-capacity warnings

## Phase 5 — Excel Persistence

- workbook schema/versioning
- load/save `.xlsx`
- workbook validation
- atomic save strategy
- timestamped backups
- import existing workbook data where feasible

Proposed sheets:

- Materials
- Calibrations
- MixPresets
- Products
- RecipeItems
- ProductComponents
- MoldYieldSamples
- Settings

## Phase 6 — Tauri Desktop Integration

- native open/save dialogs
- application data directory
- backup folder
- safe file write/replace flow
- desktop packaging

## Phase 7 — Reporting & Operational Polish

- dashboard
- inventory valuation
- product profitability report
- material requirement planning
- low-stock indicators
- production history
- Excel report export

## Storage migration path

```text
UI → Application Services → StoragePort
                             ├─ ExcelStorage (v1)
                             └─ SQLiteStorage (future)
```

No React component should read/write spreadsheet cells directly.
