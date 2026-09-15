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
- advance phases only after feature CI, PR CI, merge, and exact post-merge `develop` CI succeed.

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

```text
PR #58 merged
e79303fdcad4fb298154be957f938584f164a61b
Post-merge CI 34908149932 — SUCCESS
38 test files / 349 tests
TypeScript typecheck passed
Production Vite build passed
```

---

## Phase 3 — Product Components, Vessels & Nested Molded Products

Status: **COMPLETE**

Planning baseline: `docs/PHASE_3_PRODUCT_COMPONENTS_VESSELS_PLAN.md`

Completion tracker: `docs/PHASE_3_PROGRESS.md`

Final completion record: `docs/PHASE_3_6B_REGRESSION_BUILD_COMPLETION.md`

```text
3.1 Composition Foundation
    3.1A Product Component Contract & Roles             COMPLETE
    3.1B Composition Graph Integrity & Cycle Prevention COMPLETE
    3.1C Component Repository & Application Services    COMPLETE

3.2 Finished Component Stock
    3.2A Product Stock Contract & Validation            COMPLETE
    3.2B Product Stock Repository & Services            COMPLETE
    3.2C Source Availability & Relationship Guards      COMPLETE

3.3 Component-Aware Cost Roll-Up
    3.3A Material-Backed Component Cost                 COMPLETE
    3.3B Recursive Product-Backed Component Cost        COMPLETE
    3.3C Total Product Cost & Readiness                  COMPLETE

3.4 Component-Limited Assembly Capacity
    3.4A Per-Component Availability & Capacity          COMPLETE
    3.4B Direct-Material + Component Capacity           COMPLETE
    3.4C Limiting Resource Trace & Readiness            COMPLETE

3.5 Component / Stock / Production UI
    3.5A Product Composition Editor                     COMPLETE
    3.5B Finished Component Stock UI                    COMPLETE
    3.5C Component-Aware Production Estimate UI         COMPLETE

3.6 Integration & Completion Gate
    3.6A Integrated Multi-Component Workflow            COMPLETE
    3.6B Regression / Build / Completion                COMPLETE
```

### Phase 3 delivered behavior

- typed ProductComponent relationships with `material` and `product` sources;
- structural component roles and positive whole-piece quantities;
- cycle-safe directed Product composition with direct and transitive cycle rejection;
- Material-backed purchased vessels/components using Phase 1 inventory/costing;
- Product-backed handmade vessels/components using explicit current finished ProductStock;
- missing ProductStock distinguished from explicit zero stock;
- source archive/dependency guards for active compositions;
- recursive Product-backed component cost roll-up;
- total component-aware Product cost/readiness;
- current per-component capacity;
- overall current assembly capacity synthesized from Phase 2 direct-material capacity plus immediate component availability;
- no hypothetical recursive manufacture of missing child stock during parent-capacity calculation;
- all tied limiting resources preserved with typed identity;
- Product Composition editor with cycle/error feedback and nested composition preview;
- Finished Component Stock editor;
- component-aware Production estimate with separate direct-material and discrete-component sections;
- nested component cost paths and readiness issues;
- real-service integration scenarios for purchased vessels, handmade vessels, multi-mold sets, nested composition, and cycle rejection.

### Phase 3 final gate

```text
3.6B PR #93 merged
Implementation merge ceef43e2181d8696e0408457860905da1b8e6b46
Post-merge develop CI 34930387721 — SUCCESS
55 test files / 628 tests
7 React smoke tests
5 dedicated 3.6A integration tests
TypeScript typecheck passed
Production Vite build passed
```

### Boundaries intentionally deferred after Phase 3

- labor and overhead costing — Phase 4;
- selling price, fixed profit, markup, target margin, revenue, and profit — Phase 4;
- Excel persistence/import/export — Phase 5;
- native Tauri filesystem integration — Phase 6;
- stock reservation, automatic stock deduction, stock transaction history, and production posting — not part of Phase 3 and require separate future planning.

---

## Phase 4 — Pricing & Production Planning

Status: **PLANNED — NEXT / NOT STARTED**

Planned:

- total unit cost using the completed component-aware Phase 3 cost input;
- fixed-profit pricing;
- markup percentage;
- target margin;
- selling price;
- planned batch cost;
- expected revenue and profit;
- production-capacity warnings.

Phase 4 requires a dedicated scope review/development plan before implementation begins.

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

## Current roadmap position

**Phase 3 is COMPLETE.**

Next planned phase:

**Phase 4 — Pricing & Production Planning — NEXT / NOT STARTED**

Do not begin Phase 4 implementation without a dedicated scope review/development plan.