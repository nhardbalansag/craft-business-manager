# Phase 3 — Product Components, Vessels & Nested Molded Products Progress

Status: **IN PROGRESS**

Planning baseline: `docs/PHASE_3_PRODUCT_COMPONENTS_VESSELS_PLAN.md`

```text
3.1 — Composition Foundation                              COMPLETE
    3.1A — Product Component Contract & Roles             COMPLETE
    3.1B — Composition Graph Integrity & Cycle Prevention COMPLETE
    3.1C — Component Repository & Application Services    COMPLETE

3.2 — Finished Component Stock                            COMPLETE
    3.2A — Product Stock Contract & Validation            COMPLETE
    3.2B — Product Stock Repository & Services            COMPLETE
    3.2C — Source Availability & Relationship Guards      COMPLETE

3.3 — Component-Aware Cost Roll-Up                        IN PROGRESS
    3.3A — Material-Backed Component Cost                 COMPLETE
    3.3B — Recursive Product-Backed Component Cost        IMPLEMENTED — MERGE GATE
    3.3C — Total Product Cost & Readiness                  NOT STARTED

3.4 — Component-Limited Assembly Capacity
    3.4A — Per-Component Availability & Capacity          NOT STARTED
    3.4B — Direct-Material + Component Capacity           NOT STARTED
    3.4C — Limiting Resource Trace & Readiness            NOT STARTED

3.5 — Component / Stock / Production UI
    3.5A — Product Composition Editor                     NOT STARTED
    3.5B — Finished Component Stock UI                    NOT STARTED
    3.5C — Component-Aware Production Estimate UI         NOT STARTED

3.6 — Integration & Completion Gate
    3.6A — Integrated Multi-Component Workflow            NOT STARTED
    3.6B — Regression / Build / Completion                NOT STARTED
```

## Locked planning decisions

- component sources are explicitly `material` or `product`;
- component quantities are positive whole `pc` counts;
- purchased/material-backed components use count-based Material inventory and Phase 1 material costing;
- handmade/product-backed components use explicit finished ProductStock for current assembly availability;
- nested Product cost is recursively derived while composition cycles are prohibited;
- Phase 3 baseline capacity is current **assembly capacity**, not hypothetical recursive manufacture of missing child stock;
- Phase 2 direct materials and Phase 3 discrete components stay distinct and are synthesized only in cost/capacity views;
- all tied limiting materials/components must remain visible;
- labor/overhead/selling price remains Phase 4;
- Excel persistence remains Phase 5;
- no stock reservations, automatic deductions, or stock transaction ledger are introduced in Phase 3.

## Completed

### 3.1A — Product Component Contract & Roles

- dedicated `src/domain/productComponents.ts` replaced the loose Phase 3 scaffold;
- authoritative fields: component ID, parent Product ID, source type/ID, structural role, whole-piece quantity, optional notes;
- source kinds: `material | product`;
- roles: `vessel`, `molded-component`, `decorative-component`, `insert`, `accessory`, `other`;
- finite, positive integer `quantityPerParent` enforced;
- deterministic normalization, clone, source-key, and duplicate-source equality helpers added;
- material-backed compatibility requires a matching count-based (`pc`) Material source;
- derived cost/capacity remains excluded.

Evidence:
- PR #61 merged;
- implementation merge commit `3b3206cd266bc2f55ae59c2d7dff6bd906af1652`;
- feature CI run `34909578128` passed;
- post-merge CI run `34909650244` passed.

Implementation record: `docs/PHASE_3_1A_PRODUCT_COMPONENT_CONTRACT.md`

### 3.1B — Composition Graph Integrity & Cycle Prevention

- dedicated `src/domain/productCompositionGraph.ts` adds the graph boundary;
- duplicate component-source identity is blocked per parent using the 3.1A source key;
- direct Product self-reference is rejected with `DIRECT_SELF_REFERENCE`;
- transitive cycles are rejected with `CYCLE_DETECTED` and a closed canonical cycle path;
- product IDs are trimmed/case-insensitive for graph identity;
- adjacency/traversal ordering is deterministic and locale-independent;
- material-backed components do not create Product graph edges;
- guarded depth-first descendant traversal is available for future recursive services;
- reachable corrupted cycles cannot recurse indefinitely;
- unrelated corrupted cycles do not block traversal of a safe root.

Evidence:
- PR #63 merged;
- implementation merge commit `5bcaa40d983c1838f6f3fd975ef3b78081e446cb`;
- feature CI run `34910508714` passed;
- post-merge CI run `34910649113` passed.

Implementation record: `docs/PHASE_3_1B_COMPOSITION_GRAPH_INTEGRITY.md`

### 3.1C — Component Repository & Application Services

- storage-agnostic `ProductComponentRepository` plus defensive in-memory implementation added;
- `ProductComponentService` provides create/update/get/list/list-by-parent/remove operations;
- save-time parent/source existence and active-state validation added;
- material-backed components resolve only to active count-based (`pc`) Material sources;
- all proposed saves pass the 3.1B duplicate/self/cycle graph gate before persistence;
- Product/Material archive and generic deactivation paths are protected from active component dependencies;
- active component Materials cannot be changed away from base unit `pc`;
- archived parent compositions are retained as historical source data;
- Product reactivation revalidates retained source relationships and graph integrity;
- `BusinessDataset.productComponents` added as authoritative source data;
- shared repository/service session wiring added;
- dedicated service suite adds 9 tests; full validation passes 41 files / 382 tests, typecheck, and build.

Evidence:
- PR #65 merged;
- implementation merge commit `230843ea813ab833eb85b7a1c487ec899d8ce84c`;
- feature CI run `34911576909` passed;
- PR CI run `34911698103` passed;
- post-merge CI run `34911755617` passed.

Implementation record: `docs/PHASE_3_1C_COMPONENT_REPOSITORY_SERVICES.md`

### 3.2A — Product Stock Contract & Validation

- dedicated `src/domain/productStock.ts` introduces authoritative finished Product/component stock source data;
- unit is implicit `pc` and is not user-selectable;
- zero stock is valid;
- fractional, negative, and non-finite quantities are rejected with typed domain errors;
- defensive clone helper added;
- `ProductStock` exported through the shared domain type surface.

Evidence:
- PR #67 merged;
- implementation merge commit `afc9ec9cac417b6f47a319174166abc048e86b40`;
- feature-head CI run `34912465333` passed;
- PR CI run `34912541378` passed;
- post-merge `develop` CI run `34912611385` passed.

Development plan: `docs/PHASE_3_2A_PRODUCT_STOCK_PLAN.md`

Implementation record: `docs/PHASE_3_2A_PRODUCT_STOCK_CONTRACT.md`

### 3.2B — Product Stock Repository & Services

- storage-agnostic `ProductStockRepository` added with list/find-by-Product/upsert operations;
- defensive in-memory repository enforces one record per normalized Product identity;
- `ProductStockService` provides set/get/list/filter behavior;
- all writes normalize/validate through 3.2A and resolve Product existence;
- archived Product stock remains inspectable/correctable;
- missing ProductStock remains distinguishable from explicit zero stock;
- `BusinessDataset.productStocks` added as authoritative source data;
- shared session wiring added;
- dedicated suite adds 10 tests;
- full validation passes 43 files / 404 tests, typecheck, and build.

Evidence:
- PR #69 merged;
- implementation merge commit `827217607ac53dc286c6f0e64110b5d93d8672fd`;
- feature CI run `34913228450` passed;
- PR CI run `34913387142` passed;
- post-merge `develop` CI run `34913435571` passed.

Development plan: `docs/PHASE_3_2B_PRODUCT_STOCK_REPOSITORY_SERVICES_PLAN.md`

Implementation record: `docs/PHASE_3_2B_PRODUCT_STOCK_REPOSITORY_SERVICES.md`

### 3.2C — Component Source Availability & Relationship Guards

- one `ComponentSourceAvailabilityService` resolves both `material` and `product` component sources;
- controlled readiness contract is `ready | partial | not-ready`;
- all resolved quantities use canonical `pc` units;
- explicit zero remains `ready`, while missing ProductStock is `partial`/unresolved;
- Material-backed availability uses Phase 1 on-hand normalization;
- Product-backed availability requires an active child Product and valid ProductStock;
- existing 3.1C dependency guards are reused and regression-tested;
- shared resolver/calibration-evidence session wiring added;
- dedicated suite adds 18 tests;
- full validation passes 44 files / 422 tests, typecheck, and build.

Evidence:
- PR #71 merged;
- implementation merge commit `8142820762885a4093574ccc7cb48f1f9d0b5661`;
- test-bearing feature CI run `34914060282` passed;
- final feature-head CI run `34914196908` passed;
- PR CI run `34914254157` passed;
- post-merge `develop` CI run `34914309862` passed.

Development plan: `docs/PHASE_3_2C_COMPONENT_SOURCE_AVAILABILITY_PLAN.md`

Implementation record: `docs/PHASE_3_2C_COMPONENT_SOURCE_AVAILABILITY.md`

## Phase 3.2 completion

**Phase 3.2 — Finished Component Stock is COMPLETE.**

### 3.3A — Material-Backed Component Cost

- `MaterialBackedComponentCostService` derives one purchased/material-backed component line cost;
- Phase 1 `calculateMaterialPackageCosting()` remains the sole package-cost engine;
- cost per `pc` and contribution (`costPerPc × quantityPerParent`) are derived and never persisted;
- source Material identity/name and package/conversion traceability are preserved;
- 3.2C source eligibility is reused rather than redefined;
- `not-ready` source relationships block costing, while `partial` stock availability does not block an otherwise valid cost basis;
- Product-backed recursive costing remains excluded for 3.3B;
- controlled issues preserve underlying ProductComponent, availability, MaterialCosting, and calibration codes;
- shared `materialBackedComponentCostService` is wired in `application/session.ts`;
- dedicated 3.3A suite adds 16 tests;
- full validation passes 45 test files / 438 tests, TypeScript typecheck, and production build.

Evidence:
- PR #73 merged;
- implementation merge commit `f4fa4c7e287f24e9732cc1e2055edea4142873f5`;
- test-bearing feature CI run `34915288037` passed;
- final feature-head CI run `34915430857` passed;
- PR CI run `34915488170` passed;
- post-merge `develop` CI run `34915579217` passed.

Development plan: `docs/PHASE_3_3A_MATERIAL_BACKED_COMPONENT_COST_PLAN.md`

Implementation record: `docs/PHASE_3_3A_MATERIAL_BACKED_COMPONENT_COST.md`

## Implementation awaiting merge gate

### 3.3B — Recursive Product-Backed Component Cost

- `ProductBackedComponentCostService` recursively derives Product-backed component cost;
- each child combines the authoritative Phase 2 direct-material cost preview with Phase 3 nested component contributions;
- material-backed nested lines delegate to 3.3A rather than duplicating Material costing;
- Product-backed nested lines recurse through the same 3.3B service;
- `ready | partial | not-ready` propagates through the tree while preserving known partial subtotals;
- authoritative zero cost remains distinguishable from missing cost evidence;
- Product IDs/names, canonical paths, edge quantities, direct-material evidence, and nested leaf costs remain inspectable;
- local active-path protection prevents infinite recursion from reachable corrupted cycles and reports a closed canonical cycle path;
- immediate reachable duplicate-source corruption is rejected without double counting;
- unrelated corruption elsewhere does not globally block a safe requested root;
- current ProductStock is intentionally excluded from Product cost dependencies;
- shared `productBackedComponentCostService` is wired in `application/session.ts`;
- dedicated 3.3B suite adds 26 tests;
- full feature validation passes 46 test files / 464 tests, TypeScript typecheck, and production build.

Feature evidence:
- branch `feature/phase-3-3b-recursive-product-component-cost`;
- authoritative base `develop` @ `e84be8cb15cf4bd7be3379ebd76302a4087376c9`;
- feature-head CI run `34917053692` passed.

Development plan: `docs/PHASE_3_3B_RECURSIVE_PRODUCT_COMPONENT_COST_PLAN.md`

Implementation record: `docs/PHASE_3_3B_RECURSIVE_PRODUCT_COMPONENT_COST.md`

## Current active task

**3.3B — Recursive Product-Backed Component Cost — merge/post-merge validation gate**

Do not begin 3.3C until 3.3B is merged, exact post-merge `develop` CI is green, and a dedicated 3.3C development plan/scope review is established.
