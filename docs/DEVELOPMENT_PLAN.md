# Craft Business Manager — Development Plan

## Objective

Build a desktop-first tool for material costing, mold-yield learning, inventory-based production estimates, multi-vessel candle recipes, and selling-price/profit planning.

The domain layer must remain storage-agnostic so Excel persistence can later move to SQLite without rewriting business rules.

## Phase 0 — Repository & Architecture Foundation

Status: **COMPLETE**

Delivered React + TypeScript + Vite, branch strategy, domain contracts, pure costing/yield helpers, storage abstraction, Vitest, and GitHub Actions CI.

---

## Phase 1 — Materials, Units & Calibration

Status: **COMPLETE**

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

1.6 — Phase 1 Integration & Completion Gate       COMPLETE
    1.6A — Integrated Materials Workflow          COMPLETE
    1.6B — Regression, Build & Completion         COMPLETE
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

Status: **COMPLETE**

The final Phase 1 gate added React render smoke coverage for the Materials and Calibration workspaces and re-ran the complete unit, domain, application, integration, typecheck, and production-build surface.

Validation evidence:

- PR #23 merged
- merge commit `ee6953c9e1d132325c77e23cd9e07c859b469dbb`
- feature CI run `34826926034` passed
- final PR-head CI run `34827053087` passed
- post-merge `develop` CI run `34827137558` passed

Completion detail: `docs/PHASE_1_6B_REGRESSION_BUILD_COMPLETION.md`.

### Phase 1 completion result

**Phase 1 is complete.** The material, measurement, costing, calibration, inventory, supplier/source, application-service, UI, integration, and final regression/build gates all passed.

---

## Phase 2 — Product Recipes & Mold Yield

Status: **PLANNED — IMPLEMENTATION NOT STARTED**

Dedicated plan: `docs/PHASE_2_PRODUCT_RECIPES_MOLD_YIELD_PLAN.md`

Phase 2 has been assessed and should be split into the following implementation units:

```text
2.1 — Product & Mix Foundation
    2.1A — Product Contract & Category Rules                  NEXT
    2.1B — Mix Preset Contract & Ratio Engine                 NOT STARTED
    2.1C — Product / Mix Repositories & Application Services  NOT STARTED

2.2 — Yield Evidence & Per-Good-Piece Learning
    2.2A — Yield Sample Evidence Contract                     NOT STARTED
    2.2B — Good / Rejected Output & Learned Requirements      NOT STARTED
    2.2C — Effective Yield Selection & History Rules          NOT STARTED

2.3 — Recipe Requirement Synthesis
    2.3A — Fixed Recipe Item Contract & Material Roles        NOT STARTED
    2.3B — Effective Per-Piece Material Requirements          NOT STARTED
    2.3C — Material Cost Preview & Requirement Validation     NOT STARTED

2.4 — Safety Waste & Inventory-Limited Capacity
    2.4A — Safety Waste Policy                                NOT STARTED
    2.4B — Waste-Adjusted Production Requirements             NOT STARTED
    2.4C — Producible Pieces & Limiting Material              NOT STARTED

2.5 — Product / Yield / Production UI
    2.5A — Products & Mix Presets UI                          NOT STARTED
    2.5B — Yield Recording & History UI                       NOT STARTED
    2.5C — Production Estimate UI                             NOT STARTED

2.6 — Phase 2 Integration & Completion Gate
    2.6A — Integrated Product / Yield Workflow                NOT STARTED
    2.6B — Regression, Build & Completion Validation          NOT STARTED
```

### Phase 2 architecture result

The existing `Product`, `MixPreset`, `MoldYieldSample`, and recipe types in `src/domain/types.ts`, plus the simple yield helpers in `src/domain/costing.ts`, are treated as **prototype scaffolding** to refine rather than completed Phase 2 functionality.

Important Phase 2 decisions:

- mold volume remains optional;
- real batch evidence is authoritative;
- a yield sample records all actual material inputs, not just the primary material;
- learned material requirement is `total material consumed / good pieces`;
- rejected pieces are tracked separately and are not a second waste multiplier;
- safety waste is a separate planning reserve;
- latest valid yield sample is the initial effective-sample strategy;
- fixed per-product recipe materials remain separate from yield-derived materials;
- material cost preview is allowed in Phase 2, but selling price/profit remains Phase 4;
- nested products, vessels, molded components, and multi-component capacity remain Phase 3;
- Excel persistence remains Phase 5.

### Current active task

**2.1A — Product Contract & Category Rules**

Do not begin 2.1B until 2.1A is merged and post-merge `develop` CI is green.

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
