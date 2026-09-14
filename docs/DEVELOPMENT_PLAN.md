# Craft Business Manager — Development Plan

## Objective

Build a desktop-first tool for material costing, real-production yield learning, inventory-based production estimates, multi-vessel / multi-component craft products, and selling-price / profit planning.

The domain and application layers must remain storage-agnostic so Excel persistence can later move to SQLite without rewriting business rules.

## Delivery principles

- preserve user-entered/source evidence and derive normalized values;
- use canonical internal units (`g`, `mL`, `pc`);
- keep material-specific cross-dimension conversion behind calibration/manual evidence;
- keep React behind application services rather than duplicating business rules in UI code;
- keep production estimates derived rather than persisted as stale authoritative totals;
- advance phases only after feature CI, merge, and post-merge `develop` CI succeed.

---

## Phase 0 — Repository & Architecture Foundation

Status: **COMPLETE**

Delivered React + TypeScript + Vite, branch strategy, storage abstraction, domain/application layering, Vitest, and GitHub Actions CI.

---

## Phase 1 — Materials, Units & Calibration

Status: **COMPLETE**

Dedicated plan: `docs/PHASE_1_MATERIALS_UNITS_CALIBRATION_PLAN.md`

```text
1.1 Measurement & Conversion Foundation         COMPLETE
1.2 Material Master Domain                      COMPLETE
1.3 Purchase Costing & Inventory Quantity       COMPLETE
1.4 Material-Specific Calibration               COMPLETE
1.5 Supplier & Source Metadata                  COMPLETE
1.6 Integration & Completion Gate               COMPLETE
```

Phase 1 established:

- canonical weight/volume/count units and validated same-dimension conversions;
- material master CRUD/search/archive and source metadata;
- package-cost conversion and cost per canonical base unit;
- current inventory normalization and valuation;
- material-specific `cup -> g` calibration/manual fallback;
- effective conversion precedence;
- Materials and Calibration React workspaces;
- integrated regression/build validation.

Completion detail: `docs/PHASE_1_6B_REGRESSION_BUILD_COMPLETION.md`.

---

## Phase 2 — Product Recipes & Mold Yield

Status: **COMPLETE**

Planning baseline: `docs/PHASE_2_PRODUCT_RECIPES_MOLD_YIELD_PLAN.md`

Live completion tracker: `docs/PHASE_2_PROGRESS.md`

Final completion record: `docs/PHASE_2_6B_REGRESSION_BUILD_COMPLETION.md`

```text
2.1 Product & Mix Foundation                    COMPLETE
    2.1A Product Contract & Category Rules      COMPLETE
    2.1B Mix Preset Contract & Ratio Engine     COMPLETE
    2.1C Product / Mix Services                 COMPLETE

2.2 Yield Evidence & Per-Good-Piece Learning    COMPLETE
    2.2A Yield Sample Evidence Contract         COMPLETE
    2.2B Good / Rejected Output & Learning      COMPLETE
    2.2C Effective Yield Selection & History    COMPLETE

2.3 Recipe Requirement Synthesis                COMPLETE
    2.3A Fixed Recipe Items & Roles             COMPLETE
    2.3B Effective Per-Piece Requirements       COMPLETE
    2.3C Material Cost Preview                  COMPLETE

2.4 Safety Waste & Inventory Capacity           COMPLETE
    2.4A Safety Waste Policy                    COMPLETE
    2.4B Waste-Adjusted Requirements            COMPLETE
    2.4C Producible Pieces & Limiting Material  COMPLETE

2.5 Product / Yield / Production UI             COMPLETE
    2.5A Products & Mix Presets UI              COMPLETE
    2.5B Yield Recording & History UI           COMPLETE
    2.5C Production Estimate UI                 COMPLETE

2.6 Integration & Completion Gate               COMPLETE
    2.6A Integrated Phase 2 Workflow            COMPLETE
    2.6B Regression / Build / Completion        COMPLETE
```

### Phase 2 delivered behavior

- product categories for paintable art, candle pots, and candles;
- reusable weight/volume mix presets and anchor-based ratio resolution;
- immutable multi-material real-production yield evidence;
- learned material usage based on total consumed divided by good pieces;
- separate rejected-piece diagnostic rate without double-counting waste;
- deterministic latest-derivable yield selection with safe fallback;
- fixed per-product recipe materials with roles and source-unit preservation;
- derived yield + fixed canonical material requirements with traceability;
- direct-material cost preview using Phase 1 purchase costing;
- explicit product safety-waste planning reserve;
- waste-adjusted per-piece and planned-batch requirements;
- physical whole-count batch rounding for indivisible `pc` materials only at final batch total;
- current-stock producible-piece capacity and all tied limiting materials;
- Products, Mix Presets, Yield, and Production Estimate React workflows;
- end-to-end Phase 2 integration regression coverage.

### Phase 2 final gate

PR #58 merged as:

`e79303fdcad4fb298154be957f938584f164a61b`

Post-merge CI run `34908149932` passed.

Final observed automated surface:

```text
38 test files passed
349 tests passed
TypeScript typecheck passed
Production Vite build passed
```

### Boundaries intentionally deferred after Phase 2

- purchased vessels and container/component semantics — Phase 3;
- molded/nested child products and multi-component capacity — Phase 3;
- selling price, markup, target margin, revenue, and profit — Phase 4;
- Excel persistence/import/export — Phase 5;
- native Tauri filesystem integration — Phase 6.

---

## Phase 3 — Product Components, Vessels & Nested Molded Products

Status: **PLANNED — IMPLEMENTATION NOT STARTED**

Dedicated plan: `docs/PHASE_3_PRODUCT_COMPONENTS_VESSELS_PLAN.md`

Live tracker: `docs/PHASE_3_PROGRESS.md`

Phase 3 extends Phase 2 direct-material products into typed sellable compositions containing purchased vessels/components and handmade child Products.

```text
3.1 Composition Foundation
    3.1A Product Component Contract & Roles             NEXT
    3.1B Composition Graph Integrity & Cycle Prevention NOT STARTED
    3.1C Component Repository & Application Services    NOT STARTED

3.2 Finished Component Stock
    3.2A Product Stock Contract & Validation            NOT STARTED
    3.2B Product Stock Repository & Services            NOT STARTED
    3.2C Source Availability & Relationship Guards      NOT STARTED

3.3 Component-Aware Cost Roll-Up
    3.3A Material-Backed Component Cost                 NOT STARTED
    3.3B Recursive Product-Backed Component Cost        NOT STARTED
    3.3C Total Product Cost & Readiness                  NOT STARTED

3.4 Component-Limited Assembly Capacity
    3.4A Per-Component Availability & Capacity          NOT STARTED
    3.4B Direct-Material + Component Capacity           NOT STARTED
    3.4C Limiting Resource Trace & Readiness            NOT STARTED

3.5 Component / Stock / Production UI
    3.5A Product Composition Editor                     NOT STARTED
    3.5B Finished Component Stock UI                    NOT STARTED
    3.5C Component-Aware Production Estimate UI         NOT STARTED

3.6 Integration & Completion Gate
    3.6A Integrated Multi-Component Workflow            NOT STARTED
    3.6B Regression / Build / Completion                NOT STARTED
```

### Phase 3 architecture decisions

- component sources are explicitly typed as Material-backed or Product-backed;
- component quantities are discrete positive whole-piece counts;
- purchased material-backed components use Phase 1 count inventory/costing;
- handmade Product-backed components use explicit finished Product stock for current assembly availability;
- nested Product composition forms an acyclic directed graph;
- direct and transitive composition cycles are prohibited;
- child Product cost is recursively derived from its Phase 2 direct materials plus its own Phase 3 components;
- current parent assembly capacity uses parent direct-material capacity plus current component availability;
- parent capacity does not silently include hypothetical manufacture of missing child stock from shared raw materials;
- all tied limiting resources remain visible with typed identity;
- derived component cost/capacity is not persisted as source data;
- labor/overhead/selling price remains Phase 4;
- Excel persistence remains Phase 5;
- stock reservations, automatic deductions, and movement history remain outside Phase 3.

### Phase 3 required business scenarios

- candle using one purchased glass/plastic/stainless vessel;
- candle using one handmade plaster-pot Product as its vessel;
- product containing several molded child products in different quantities;
- nested composition such as gift set -> candle -> handmade pot;
- tied limiting components;
- safe rejection of direct and transitive cycles.

### Current Phase 3 task

**3.1A — Product Component Contract & Roles**

Do not begin 3.1B until 3.1A is merged and post-merge `develop` CI is green.

---

## Phase 4 — Pricing & Production Planning

Status: **PLANNED**

Planned:

- total unit cost;
- fixed-profit pricing;
- markup percentage;
- target margin;
- selling price;
- planned batch cost;
- expected revenue and profit;
- production-capacity warnings.

---

## Phase 5 — Excel Persistence

Status: **PLANNED**

Planned:

- workbook schema/versioning;
- load/save `.xlsx` through the storage adapter;
- workbook validation;
- atomic save strategy;
- timestamped backups;
- import existing workbook data where feasible.

Proposed sheets include Materials, Calibrations, MixPresets, Products, RecipeItems, ProductComponents, ProductStocks, YieldSamples, and Settings.

---

## Phase 6 — Tauri Desktop Integration

Status: **PLANNED**

Planned native file dialogs, application-data directory, backup folder, safe write/replace flow, and desktop packaging.

---

## Phase 7 — Reporting & Operational Polish

Status: **PLANNED**

Planned dashboard, inventory valuation, profitability, material requirements, low-stock indicators, production history, and Excel report export.

---

## Storage migration path

```text
React UI
   ↓
Application Services
   ↓
Domain
   ↓
StoragePort
   ├── ExcelStorage (v1)
   └── SQLiteStorage (future)
```

No React component should read or write spreadsheet cells directly.

## Current active task

**Phase 3.1A — Product Component Contract & Roles**
