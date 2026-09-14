# Craft Business Manager — Development Plan

## Objective

Build a desktop-first tool for material costing, mold-yield learning, inventory-based production estimates, multi-vessel candle recipes, and selling-price/profit planning.

The domain layer must remain storage-agnostic so Excel persistence can later move to SQLite without rewriting business rules.

## Phase 0 — Repository & Architecture Foundation

Status: **COMPLETE**

Delivered React + TypeScript + Vite, branch strategy, domain contracts, pure costing/yield helpers, storage abstraction, Vitest, and GitHub Actions CI.

---

## Phase 1 — Materials, Units & Calibration

Status: **IN PROGRESS — FINAL COMPLETION GATE**

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
    1.6A — Integrated Materials Workflow          COMPLETE
    1.6B — Regression, Build & Completion         IMPLEMENTED / VALIDATION PENDING
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

Implementation docs:

- `docs/PHASE_1_5A_SUPPLIER_SOURCE_CONTRACT.md`
- `docs/PHASE_1_5B_MATERIALS_SOURCE_UI.md`

### Phase 1.6A — Integrated Materials Workflow

Status: **COMPLETE**

Phase 1.6A validated the full Phase 1 material workflow across standard unit conversion, calibrated plaster cup-to-weight handling, package conversion, costing, stock normalization, inventory valuation, supplier/source search, archive filtering, and financial isolation of supplier-only edits.

Integration hardening also prevents deleting the final calibration required by a currently saved cup-based material state.

Validation evidence:

- PR #21 merged
- merge commit `a0e3a605eb0a137613e583b0711229088f9c61fd`
- feature CI passed
- final PR-head CI passed
- post-merge `develop` CI run `34826188230` passed

Implementation detail: `docs/PHASE_1_6A_INTEGRATED_MATERIALS_WORKFLOW.md`.

### Phase 1.6B — Regression, Build & Completion

Status: **IMPLEMENTED — VALIDATION PENDING**

This final Phase 1 gate adds React render smoke coverage for both completed Phase 1 workspaces and re-runs the entire unit, domain, application, integration, typecheck, and production-build surface before Phase 1 can be closed.

No new business-domain behavior is introduced in 1.6B.

Completion detail: `docs/PHASE_1_6B_REGRESSION_BUILD_COMPLETION.md`.

### Current active task

**1.6B — Regression, Build & Completion — validation / merge gate**

Phase 1 will be marked complete only after the exact feature PR head passes CI, the PR merges to `develop`, and post-merge `develop` CI passes. The next development phase will then be **Phase 2 — Product Recipes & Mold Yield**.

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
