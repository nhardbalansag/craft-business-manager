# Phase 3 — Product Components, Vessels & Nested Molded Products Progress

Status: **IN PROGRESS**

Planning baseline: `docs/PHASE_3_PRODUCT_COMPONENTS_VESSELS_PLAN.md`

```text
3.1 — Composition Foundation                              IN PROGRESS
    3.1A — Product Component Contract & Roles             COMPLETE
    3.1B — Composition Graph Integrity & Cycle Prevention VALIDATION / MERGE GATE
    3.1C — Component Repository & Application Services    NOT STARTED

3.2 — Finished Component Stock
    3.2A — Product Stock Contract & Validation            NOT STARTED
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
- derived cost/capacity remains excluded;
- graph self/cycle validation remains 3.1B;
- repositories, active-reference validation, archive guards, and `BusinessDataset.productComponents` remain 3.1C.

Evidence:
- PR #61 merged;
- implementation merge commit `3b3206cd266bc2f55ae59c2d7dff6bd906af1652`;
- feature CI run `34909578128` passed;
- post-merge CI run `34909650244` passed.

Implementation record: `docs/PHASE_3_1A_PRODUCT_COMPONENT_CONTRACT.md`

## 3.1B implementation at validation gate

- dedicated `src/domain/productCompositionGraph.ts` adds the composition graph boundary;
- all source records are contract-validated before graph use;
- duplicate component-source identity is blocked per parent using the 3.1A source key;
- direct Product self-reference is rejected with `DIRECT_SELF_REFERENCE`;
- transitive cycles are rejected with `CYCLE_DETECTED` and a closed canonical cycle path;
- product IDs are trimmed/case-insensitive for graph identity;
- adjacency/traversal ordering is deterministic and locale-independent;
- material-backed components do not create graph edges;
- guarded depth-first descendant traversal is available for future recursive cost/capacity services;
- traversal detects reachable corrupted cycles without allowing infinite recursion;
- unrelated corrupted cycles do not block traversal of a safe root;
- repositories, source existence/active-state checks, archive guards, and `BusinessDataset.productComponents` remain 3.1C.

Implementation record: `docs/PHASE_3_1B_COMPOSITION_GRAPH_INTEGRITY.md`

## Current active task

**3.1B — Composition Graph Integrity & Cycle Prevention — validation / merge gate**

Do not start 3.1C until 3.1B is merged and post-merge `develop` CI is green.
