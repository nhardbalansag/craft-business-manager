# Phase 3 — Product Components, Vessels & Nested Molded Products Progress

Status: **IN PROGRESS**

Planning baseline: `docs/PHASE_3_PRODUCT_COMPONENTS_VESSELS_PLAN.md`

```text
3.1 — Composition Foundation                              COMPLETE
    3.1A — Product Component Contract & Roles             COMPLETE
    3.1B — Composition Graph Integrity & Cycle Prevention COMPLETE
    3.1C — Component Repository & Application Services    COMPLETE

3.2 — Finished Component Stock                            IN PROGRESS
    3.2A — Product Stock Contract & Validation            IMPLEMENTED — MERGE GATE
    3.2B — Product Stock Repository & Services            NOT STARTED
    3.2C — Source Availability & Relationship Guards      NOT STARTED

3.3 — Component-Aware Cost Roll-Up
    3.3A — Material-Backed Component Cost                 NOT STARTED
    3.3B — Recursive Product-Backed Component Cost        NOT STARTED
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
- guarded depth-first descendant traversal is available for future recursive cost/capacity services;
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
- shared `productComponentRepository` and `productComponentService` wired in `application/session.ts`;
- dedicated service suite adds 9 tests; full validation passes 41 files / 382 tests, typecheck, and build.

Evidence:
- PR #65 merged;
- implementation merge commit `230843ea813ab833eb85b7a1c487ec899d8ce84c`;
- feature CI run `34911576909` passed;
- PR CI run `34911698103` passed;
- post-merge CI run `34911755617` passed.

Implementation record: `docs/PHASE_3_1C_COMPONENT_REPOSITORY_SERVICES.md`

## Implementation awaiting merge gate

### 3.2A — Product Stock Contract & Validation

- dedicated `src/domain/productStock.ts` introduces authoritative finished Product/component stock source data;
- contract fields: Product ID, current on-hand whole-piece quantity, optional notes;
- unit is implicit `pc` and is not user-selectable;
- Product ID and notes are normalized;
- zero stock is valid;
- fractional, negative, and non-finite quantities are rejected with typed domain errors;
- defensive clone helper added;
- `ProductStock` exported through the shared domain type surface;
- Product existence lookup, uniqueness persistence enforcement, repositories/services, `BusinessDataset.productStocks`, and availability remain deferred to 3.2B/3.2C;
- dedicated focused tests cover zero/positive stock, normalization, cloning, malformed identity and invalid quantities.

Feature evidence:
- branch `feature/phase-3-2a-product-stock-contract`;
- authoritative base `develop` @ `bb2441390b6d833efe567369473358f19f7efdba`.

Development plan: `docs/PHASE_3_2A_PRODUCT_STOCK_PLAN.md`

Implementation record: `docs/PHASE_3_2A_PRODUCT_STOCK_CONTRACT.md`

## Current active task

**3.2A — Product Stock Contract & Validation — merge/post-merge validation gate**

Do not start 3.2B until 3.2A is merged and exact post-merge `develop` CI is green.
