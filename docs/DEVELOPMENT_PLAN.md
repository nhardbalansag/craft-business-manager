# Craft Business Manager — Development Plan

## Objective

Build a desktop-first tool for material costing, mold-yield learning, inventory-based production estimates, multi-vessel candle recipes, and selling-price/profit planning.

The domain layer must remain storage-agnostic so Excel persistence can later move to SQLite without rewriting business rules.

## Phase 0 — Repository & Architecture Foundation

Status: **COMPLETE**

Delivered React + TypeScript + Vite, branch strategy, domain contracts, pure costing/yield helpers, storage abstraction, Vitest, and GitHub Actions CI.

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

1.4 — Material-Specific Calibration               COMPLETE
    1.4A — Cup-to-Weight Calibration Model        COMPLETE
    1.4B — Effective Conversion Precedence        COMPLETE
    1.4C — Calibration UI & Tests                 COMPLETE

1.5 — Supplier & Source Metadata                  IN PROGRESS
    1.5A — Supplier / Source Contract             IMPLEMENTED / VALIDATION PENDING
    1.5B — Materials UI Integration               NOT STARTED

1.6 — Phase 1 Integration & Completion Gate       NOT STARTED
    1.6A — Integrated Materials Workflow          NOT STARTED
    1.6B — Regression, Build & Completion         NOT STARTED
```

### Phase 1.1 — Measurement & Conversion Foundation

Established the authoritative unit catalog, canonical units (`g`, `mL`, `pc`), standard same-dimension conversions, runtime validation, controlled errors, explicit rounding, and exhaustive conversion tests.

Dry `cup -> g` is deliberately excluded from universal unit conversion.

### Phase 1.2 — Material Master Domain

Established the material source-data contract, material taxonomy, package-unit labels, repository/service boundary, CRUD/search/filter/archive workflow, duplicate protection, and visible Materials workspace.

### Phase 1.3 — Purchase Costing & Inventory Quantity

Established deterministic package costing, on-hand normalization, inventory valuation, and business validation.

```text
package base quantity
= purchase quantity × effective package conversion

cost per base unit
= package cost ÷ package base quantity

inventory value
= normalized on-hand quantity × cost per base unit
```

### Phase 1.4 — Material-Specific Calibration

Status: **COMPLETE**

1.4A added material-specific measurement evidence and derived grams-per-cup.

Example:

```text
5 cups plaster = 1 kg
1 kg = 1,000 g
=> 200 g/cup
```

1.4B integrated explicit precedence:

```text
ordinary package conversion:
manual -> standard -> error

dry cup-to-weight conversion:
latest material calibration -> manual g/cup fallback -> error
```

1.4C made calibration operational in the React app:

- shared session material/calibration services
- CalibrationRepository and CalibrationService
- calibration create/list/effective/delete workflow
- enabled Calibration navigation tab
- material selector and measurement form
- live normalized cup/gram and g/cup preview
- calibration history and effective sample
- calibrated cup inputs in Materials
- calibration-aware costing, stock normalization, and inventory valuation
- MaterialService persistence validation using calibration evidence
- application and regression tests

Phase 1.4C evidence:

- PR #15 merged
- merge commit `a4ca2dd406fd90e8640fdf4011eb8bf684a2ccfb`
- final PR-head CI passed
- post-merge `develop` CI run `34823193266` passed

Implementation docs:

- `docs/PHASE_1_4A_CUP_WEIGHT_CALIBRATION.md`
- `docs/PHASE_1_4B_EFFECTIVE_CONVERSION_PRECEDENCE.md`
- `docs/PHASE_1_4C_CALIBRATION_UI.md`

### Phase 1.5A — Supplier / Source Contract

The lightweight supplier/source model is implemented without introducing a standalone Supplier module.

Material source metadata can record:

- vendor name
- branch/platform/source detail
- purchase/re-order link
- contact number
- social-page reference
- buying notes

The source contract is isolated from costing. Supplier metadata cannot change package cost/base-unit, calibration, normalized stock, or inventory valuation.

Application safeguards include:

- whitespace normalization
- empty-source collapse
- `http`/`https` purchase-link validation
- supplier-aware material search
- deep cloning of nested source metadata at repository/service boundaries

Implementation detail: `docs/PHASE_1_5A_SUPPLIER_SOURCE_CONTRACT.md`.

### Current active task

**1.5A — Supplier / Source Contract — validation and merge gate**

After 1.5A is merged and post-merge CI passes, the next task is:

**1.5B — Materials UI Integration**

---

## Phase 2 — Product Recipes & Mold Yield

Planned:

- paintable art, candle pot, and candle product categories
- mix presets and ratio basis
- sample-yield recording
- good/rejected piece tracking
- material-per-good-piece calculation
- safety-waste adjustment
- estimated producible pieces from inventory

Mold volume remains optional; real sample batches are authoritative when volume is unknown.

---

## Phase 3 — Multi-Vessel / Multi-Component Products

Support sellable products composed of multiple purchased or molded components, with total component cost and limiting component capacity.

---

## Phase 4 — Pricing & Production Planning

Planned:

- total unit cost
- fixed profit
- markup percentage
- target margin
- planned batch cost
- expected revenue/profit
- production-capacity warnings

---

## Phase 5 — Excel Persistence

Planned:

- workbook schema/versioning
- load/save `.xlsx`
- workbook validation
- atomic save strategy
- timestamped backups
- import existing workbook data where feasible

Proposed sheets: Materials, Calibrations, MixPresets, Products, RecipeItems, ProductComponents, MoldYieldSamples, Settings.

---

## Phase 6 — Tauri Desktop Integration

Planned native dialogs, application data directory, backup folder, safe write/replace flow, and desktop packaging.

---

## Phase 7 — Reporting & Operational Polish

Planned dashboard, inventory valuation, profitability, material requirements, low-stock indicators, production history, and Excel report export.

---

## Storage migration path

```text
UI -> Application Services -> StoragePort
                             |- ExcelStorage (v1)
                             `- SQLiteStorage (future)
```

No React component should read or write spreadsheet cells directly.
