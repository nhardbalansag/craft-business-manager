# Craft Business Manager — Development Plan

## Objective

Build a desktop-first tool for material costing, mold-yield learning, inventory-based production estimates, multi-vessel candle recipes, and selling-price/profit planning.

The domain layer must remain storage-agnostic so Excel persistence can later move to SQLite without rewriting business rules.

## Phase 0 — Repository & Architecture Foundation

Status: **COMPLETE**

Delivered:

- React + TypeScript + Vite scaffold
- `main` / `develop` branch strategy
- domain type contracts and pure costing/yield helpers
- storage-port abstraction and Excel adapter boundary
- Vitest regression suite
- GitHub Actions CI on Node 22

Completion gate: **PASSED**

---

## Phase 1 — Materials, Units & Calibration

Status: **IN PROGRESS**

Dedicated plan: `docs/PHASE_1_MATERIALS_UNITS_CALIBRATION_PLAN.md`

```text
1.1 — Measurement & Conversion Foundation         COMPLETE
    1.1A — Unit Catalog & Dimensional Rules        COMPLETE
    1.1B — Standard Conversion Engine             COMPLETE
    1.1C — Conversion Validation & Tests          COMPLETE

1.2 — Material Master Domain                      COMPLETE
    1.2A — Material Contract & Classification     COMPLETE
    1.2B — Material Application CRUD Services     COMPLETE
    1.2C — Materials UI                           COMPLETE

1.3 — Purchase Costing & Inventory Quantity       COMPLETE
    1.3A — Package Cost / Base-Unit Costing        COMPLETE
    1.3B — On-Hand Quantity Normalization         COMPLETE
    1.3C — Inventory Valuation & Validation       COMPLETE

1.4 — Material-Specific Calibration               IN PROGRESS
    1.4A — Cup-to-Weight Calibration Model        COMPLETE
    1.4B — Effective Conversion Precedence        COMPLETE
    1.4C — Calibration UI & Tests                 FEATURE CI PASSED / MERGE GATE

1.5 — Supplier & Source Metadata                  NOT STARTED
    1.5A — Supplier / Source Contract             NEXT AFTER 1.4C
    1.5B — Materials UI Integration               NOT STARTED

1.6 — Phase 1 Integration & Completion Gate       NOT STARTED
    1.6A — Integrated Materials Workflow          NOT STARTED
    1.6B — Regression, Build & Completion         NOT STARTED
```

### Phase 1.1 summary

Established one authoritative unit catalog, standard same-dimension conversion engine, runtime unit validation, controlled conversion errors, and exhaustive conversion tests. Canonical units are `g`, `mL`, and `pc`. Dry `cup -> g` remains material-specific and is never a universal unit rule.

Implementation docs:

- `docs/PHASE_1_1A_UNIT_CATALOG.md`
- `docs/PHASE_1_1B_STANDARD_CONVERSION_ENGINE.md`
- `docs/PHASE_1_1C_CONVERSION_VALIDATION.md`

### Phase 1.2 summary

Established the authoritative material source-data contract, material taxonomy, package-unit labels, MaterialRepository/MaterialService boundary, create/update/list/search/filter/archive behavior, duplicate protection, and the first visible Materials workspace.

The Materials UI supports purchase source data, stock source data, manual conversion, costing previews, search/filtering, editing, and soft archive.

Implementation docs:

- `docs/PHASE_1_2A_MATERIAL_CONTRACT.md`
- `docs/PHASE_1_2B_MATERIAL_CRUD_SERVICES.md`
- `docs/PHASE_1_2C_MATERIALS_UI.md`

### Phase 1.3 summary

Established deterministic package costing, manual-over-standard package conversion precedence, canonical on-hand normalization, inventory valuation, and validation of invalid inventory states.

Core formulas:

```text
package base quantity
= purchase quantity × effective package conversion

cost per base unit
= package cost ÷ package base quantity

inventory value
= normalized on-hand quantity × cost per base unit
```

Implementation docs:

- `docs/PHASE_1_3A_PACKAGE_COSTING.md`
- `docs/PHASE_1_3B_ON_HAND_NORMALIZATION.md`
- `docs/PHASE_1_3C_INVENTORY_VALUATION.md`

### Phase 1.4A summary

Added material-specific cup-to-weight calibration evidence. The system stores the facts actually measured and derives normalized cups, normalized grams, and grams-per-cup.

Example:

```text
5 cups plaster = 1 kg
1 kg = 1,000 g
=> 200 g/cup
```

Calibration is tied to one weight-based material. Invalid/mismatched evidence is rejected. Multiple samples use the deterministic strategy `latest valid calibration wins`.

Implementation doc: `docs/PHASE_1_4A_CUP_WEIGHT_CALIBRATION.md`.

### Phase 1.4B summary

Integrated calibration into package costing, on-hand normalization, and inventory valuation.

Ordinary package precedence:

```text
manual package conversion
    ↓
standard same-dimension conversion
    ↓
controlled error
```

Dry cup-to-weight precedence:

```text
latest valid material calibration
    ↓
manual g/cup fallback
    ↓
controlled error
```

Only the specific material-aware `cup -> g` bridge is permitted. Arbitrary cross-dimension conversions remain invalid. Calculation results identify the conversion source and calibration ID where applicable.

Implementation doc: `docs/PHASE_1_4B_EFFECTIVE_CONVERSION_PRECEDENCE.md`.

### Phase 1.4C current state

The calibration capability is now operational through the React application.

Delivered on PR #15:

- shared session-scoped material and calibration services
- CalibrationRepository abstraction + in-memory repository
- CalibrationService create/list/effective/delete workflow
- duplicate calibration-ID and missing-material validation
- enabled Calibration navigation tab
- weight-based material selector
- measured volume/known weight form
- live normalized cup/gram and `g/cup` preview
- calibration history and effective-sample display
- delete action for erroneous evidence
- Materials UI support for calibrated `cup` purchase/on-hand inputs
- calibration-aware package costing, stock normalization, and inventory valuation previews
- MaterialService persistence validation using injected calibration evidence
- calibration application tests
- calibrated MaterialService integration tests

Feature CI passed:

- dependency installation
- TypeScript typecheck
- all automated tests
- production build

Remaining 1.4C gate:

- final PR-head CI after status documentation update
- merge PR #15 to `develop`
- post-merge `develop` CI

When those gates pass, **Phase 1.4 — Material-Specific Calibration is complete**.

Next active task after completion:

**1.5A — Supplier / Source Contract**

---

## Phase 2 — Product Recipes & Mold Yield

Planned capabilities:

- product categories: paintable art, candle pot, candle
- mix presets and ratio basis
- sample-yield recording
- good/rejected piece tracking
- material-per-good-piece calculation
- safety-waste adjustment
- estimated producible pieces from inventory

Mold volume is optional; real sample batches remain authoritative when mold volume is unknown.

---

## Phase 3 — Multi-Vessel / Multi-Component Products

A sellable product may include multiple components, for example:

- 1 glass cup
- 3 mini heart molded components
- 2 mini flower molded components
- 1 wick
- 1 label

The system must calculate total component cost and limiting component capacity.

---

## Phase 4 — Pricing & Production Planning

Planned capabilities:

- total unit cost including waste-adjusted material usage
- fixed profit amount
- markup percentage
- target margin percentage
- planned batch cost
- expected revenue and profit
- production-capacity warnings

---

## Phase 5 — Excel Persistence

Planned capabilities:

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

---

## Phase 6 — Tauri Desktop Integration

Planned capabilities:

- native open/save dialogs
- application data directory
- backup folder
- safe file write/replace flow
- desktop packaging

---

## Phase 7 — Reporting & Operational Polish

Planned capabilities:

- dashboard
- inventory valuation
- product profitability report
- material requirement planning
- low-stock indicators
- production history
- Excel report export

---

## Storage migration path

```text
UI -> Application Services -> StoragePort
                             |- ExcelStorage (v1)
                             `- SQLiteStorage (future)
```

No React component should read or write spreadsheet cells directly.
