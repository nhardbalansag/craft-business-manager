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

1.5 — Supplier & Source Metadata                  COMPLETE
    1.5A — Supplier / Source Contract             COMPLETE
    1.5B — Materials UI Integration               COMPLETE

1.6 — Phase 1 Integration & Completion Gate       IN PROGRESS
    1.6A — Integrated Materials Workflow          IMPLEMENTED / VALIDATION PENDING
    1.6B — Regression, Build & Completion         NEXT AFTER 1.6A
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

### Phase 1.5 — Supplier & Source Metadata

Status: **COMPLETE**

Phase 1.5A added the lightweight supplier/source contract for vendor name, branch/platform/source detail, purchase/re-order link, contact number, social-page reference, and buying notes. The application normalizes source text, validates purchase links, includes source text in material search, and deep-clones nested metadata at repository/service boundaries.

Phase 1.5B exposed that contract in the Materials UI with a dedicated Supplier / source section, source-aware edit flow, Source table column, re-order link, empty-source state, and supplier-aware search.

Supplier/source data remains completely outside package costing, calibration, normalized stock, and inventory valuation.

Validation evidence:

- Phase 1.5A PR #17 merged
- Phase 1.5A implementation merge commit `00e37f44865a67ccc209d94f2edfa621cc704b05`
- Phase 1.5A post-merge CI run `34824257561` passed
- Phase 1.5B PR #19 merged
- Phase 1.5B implementation merge commit `2fa0c5fb58a4017b25aca8cb132af4811161ebf4`
- Phase 1.5B feature CI passed
- Phase 1.5B post-merge `develop` CI run `34825119934` passed

Implementation docs:

- `docs/PHASE_1_5A_SUPPLIER_SOURCE_CONTRACT.md`
- `docs/PHASE_1_5B_MATERIALS_SOURCE_UI.md`

### Phase 1.6A — Integrated Materials Workflow

Status: **IMPLEMENTED — VALIDATION PENDING**

The integration layer now exercises Phase 1 as a complete workflow instead of isolated modules.

Covered scenarios include:

- kilogram-purchased plaster with supplier metadata
- real `5 cups = 1 kg` cup-to-weight calibration
- saved cup-based stock normalization and inventory valuation
- latest-calibration precedence
- safe calibration replacement/deletion behavior
- count-package conversion (`pack -> pc`)
- standard volume conversion (`L -> mL`)
- supplier/source search
- supplier-only edits remaining financially neutral
- archive and active/archived filtering

Integration hardening also prevents deleting the last calibration required by a material's currently saved cup-to-weight state. This avoids leaving persisted material data unresolvable after calibration history maintenance.

Implementation detail: `docs/PHASE_1_6A_INTEGRATED_MATERIALS_WORKFLOW.md`.

### Current active task

**1.6A — Integrated Materials Workflow — validation / merge gate**

After feature CI, merge, and post-merge `develop` CI pass, the next task is **1.6B — Regression, Build & Completion**.

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
