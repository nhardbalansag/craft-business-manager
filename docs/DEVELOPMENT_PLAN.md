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
    1.5A — Supplier / Source Contract             COMPLETE
    1.5B — Materials UI Integration               IMPLEMENTED / VALIDATION PENDING

1.6 — Phase 1 Integration & Completion Gate       NOT STARTED
    1.6A — Integrated Materials Workflow          NEXT AFTER 1.5B
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

Material-specific cup-to-weight evidence, effective conversion precedence, calibration application services, Calibration UI/history, and calibrated Materials calculations are complete.

Implementation docs:

- `docs/PHASE_1_4A_CUP_WEIGHT_CALIBRATION.md`
- `docs/PHASE_1_4B_EFFECTIVE_CONVERSION_PRECEDENCE.md`
- `docs/PHASE_1_4C_CALIBRATION_UI.md`

### Phase 1.5A — Supplier / Source Contract

Status: **COMPLETE**

The material domain supports lightweight source metadata for vendor name, branch/platform/source detail, purchase/re-order link, contact number, social-page reference, and buying notes.

Supplier/source data remains independent of costing. The application normalizes source text, validates purchase links, includes source text in material search, and deep-clones nested metadata at repository/service boundaries.

Validation evidence:

- PR #17 merged
- implementation merge commit `00e37f44865a67ccc209d94f2edfa621cc704b05`
- feature CI passed
- post-merge `develop` CI run `34824257561` passed

Implementation detail: `docs/PHASE_1_5A_SUPPLIER_SOURCE_CONTRACT.md`.

### Phase 1.5B — Materials UI Integration

Status: **IMPLEMENTED — VALIDATION PENDING**

The Materials workspace now exposes supplier/source metadata directly in the existing add/edit workflow.

Delivered on the feature branch:

- dedicated Supplier / source form section
- vendor/supplier name input
- branch/platform/source detail input
- purchase/re-order URL input
- contact number input
- social page/handle input
- supplier-specific buying notes
- separate material notes vs source notes
- source metadata restored during Edit
- Source column in the material list
- direct Re-order link when a purchase URL exists
- `Not recorded` state for materials without supplier metadata
- supplier-aware search exposed through the existing search box
- responsive table width adjustments for the new source column

Supplier fields remain informational and do not participate in costing, calibration, stock normalization, or inventory valuation.

Implementation detail: `docs/PHASE_1_5B_MATERIALS_SOURCE_UI.md`.

### Current active task

**1.5B — Materials UI Integration — validation / merge gate**

After feature CI, merge, and post-merge `develop` CI pass, **Phase 1.5 is complete** and the next task is **1.6A — Integrated Materials Workflow**.

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
