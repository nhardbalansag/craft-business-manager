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

3.3 — Component-Aware Cost Roll-Up                        COMPLETE
    3.3A — Material-Backed Component Cost                 COMPLETE
    3.3B — Recursive Product-Backed Component Cost        COMPLETE
    3.3C — Total Product Cost & Readiness                  COMPLETE

3.4 — Component-Limited Assembly Capacity                 IN PROGRESS
    3.4A — Per-Component Availability & Capacity          COMPLETE
    3.4B — Direct-Material + Component Capacity           COMPLETE
    3.4C — Limiting Resource Trace & Readiness            NEXT

3.5 — Component / Stock / Production UI                   NOT STARTED
    3.5A — Product Composition Editor                     NOT STARTED
    3.5B — Finished Component Stock UI                    NOT STARTED
    3.5C — Component-Aware Production Estimate UI         NOT STARTED

3.6 — Integration & Completion Gate                       NOT STARTED
    3.6A — Integrated Multi-Component Workflow            NOT STARTED
    3.6B — Regression / Build / Completion                NOT STARTED
```

## Locked planning decisions

- component sources are explicitly `material` or `product`;
- component quantities are positive whole `pc` counts;
- purchased/material-backed components use count-based Material inventory and Phase 1 material costing;
- handmade/product-backed components use explicit finished ProductStock for current assembly availability;
- nested Product cost is recursively derived while composition cycles are prohibited;
- Phase 3 baseline capacity is current assembly capacity, not hypothetical recursive manufacture of missing child stock;
- Product-backed assembly capacity uses explicit current ProductStock only;
- Phase 2 direct materials and Phase 3 discrete components remain distinct until derived synthesis views combine them;
- a true Phase 2 `NO_REQUIREMENTS` direct side may be neutral for a valid component-only Product;
- broken/unresolved direct-material requirements remain blocking;
- unresolved required resources must not be silently treated as zero;
- all tied limiting resources must remain visible when 3.4C limiting-resource synthesis is implemented;
- labor, overhead, and selling price remain Phase 4;
- Excel persistence remains Phase 5;
- no stock reservation, automatic deduction, or stock transaction ledger is introduced in Phase 3.

## Completed phase records

### 3.1 — Composition Foundation

**COMPLETE**

Implementation records:

- `docs/PHASE_3_1A_PRODUCT_COMPONENT_CONTRACT.md`
- `docs/PHASE_3_1B_COMPOSITION_GRAPH_INTEGRITY.md`
- `docs/PHASE_3_1C_COMPONENT_REPOSITORY_SERVICES.md`

### 3.2 — Finished Component Stock

**COMPLETE**

Implementation records:

- `docs/PHASE_3_2A_PRODUCT_STOCK_CONTRACT.md`
- `docs/PHASE_3_2B_PRODUCT_STOCK_REPOSITORY_SERVICES.md`
- `docs/PHASE_3_2C_COMPONENT_SOURCE_AVAILABILITY.md`

### 3.3 — Component-Aware Cost Roll-Up

**COMPLETE**

Implementation records:

- `docs/PHASE_3_3A_MATERIAL_BACKED_COMPONENT_COST.md`
- `docs/PHASE_3_3B_RECURSIVE_PRODUCT_COMPONENT_COST.md`
- `docs/PHASE_3_3C_TOTAL_COMPONENT_AWARE_PRODUCT_COST.md`

Latest completion evidence:

```text
3.3C PR #77 merged
implementation merge 742dd4d2e0882fc1d8f32904adad25a154082167
post-merge CI 34918526564 — SUCCESS
47 test files / 489 tests
```

### 3.4A — Per-Component Availability & Capacity

**COMPLETE**

- one component line derives `floor(availableQuantity / quantityPerParent)`;
- Material/Product availability delegates to Phase 3.2C;
- Product-backed availability uses explicit ProductStock only;
- explicit zero is ready zero capacity;
- unresolved quantity remains null;
- no Product-level synthesis or limiter logic is included.

Evidence:

```text
PR #79 merged
implementation merge 3c2e788935baebf5154fb3080534baba9ff3f94a
post-merge develop CI 34919538278 — SUCCESS
49 test files / 524 tests
```

Development plan: `docs/PHASE_3_4A_PER_COMPONENT_CAPACITY_PLAN.md`

Implementation record: `docs/PHASE_3_4A_PER_COMPONENT_CAPACITY.md`

### 3.4B — Direct-Material + Component Capacity Synthesis

**COMPLETE**

- `AssemblyCapacitySynthesisService` synthesizes authoritative Phase 2.4C direct capacity with every immediate Phase 3.4A component capacity;
- direct-material-only, component-only, and mixed Products are supported;
- a sole Phase 2 `NO_REQUIREMENTS` state is neutral for legitimate component-only composition;
- unresolved/broken direct requirements remain blocking;
- final assembly capacity is published only when every actually-required resource is reliable;
- final capacity is the minimum of all applicable reliable candidates;
- authoritative zero participates normally;
- known diagnostics are retained for partial/not-ready results;
- duplicate root component sources are guarded before synthesis;
- no typed overall limiting-resource/tie synthesis is included yet;
- no inventory/stock mutation or derived-capacity persistence is introduced;
- shared `assemblyCapacitySynthesisService` is wired in the application session.

Evidence:

```text
PR #81 merged
implementation merge c598eb81b1521e63773c163f6aef1a3004cafbdb
Fully wired feature CI 34920239411 — SUCCESS
Final feature-head CI  34920325840 — SUCCESS
PR CI                  34920392445 — SUCCESS
Post-merge develop CI  34920455875 — SUCCESS
50 test files / 551 tests
27 dedicated 3.4B tests
TypeScript typecheck passed
production build passed
```

Development plan: `docs/PHASE_3_4B_DIRECT_MATERIAL_COMPONENT_CAPACITY_SYNTHESIS_PLAN.md`

Implementation record: `docs/PHASE_3_4B_DIRECT_MATERIAL_COMPONENT_CAPACITY_SYNTHESIS.md`

## Current active task

**3.4C — Limiting Resource Trace & Readiness — NEXT / NOT STARTED**

Do not begin 3.4C until a dedicated development plan/scope review is established for that task.
