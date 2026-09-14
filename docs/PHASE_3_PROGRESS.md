# Phase 3 — Product Components, Vessels & Nested Molded Products Progress

Status: **PLANNED — IMPLEMENTATION NOT STARTED**

Planning baseline: `docs/PHASE_3_PRODUCT_COMPONENTS_VESSELS_PLAN.md`

```text
3.1 — Composition Foundation
    3.1A — Product Component Contract & Roles             NEXT
    3.1B — Composition Graph Integrity & Cycle Prevention NOT STARTED
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

## Current active task

**3.1A — Product Component Contract & Roles**

Do not start 3.1B until 3.1A is merged and post-merge `develop` CI is green.
