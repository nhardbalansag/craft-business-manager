# Phase 2 — Product Recipes & Mold Yield Progress

Status: **IN PROGRESS**

Planning baseline: `docs/PHASE_2_PRODUCT_RECIPES_MOLD_YIELD_PLAN.md`

```text
2.1 — Product & Mix Foundation                         COMPLETE
    2.1A — Product Contract & Category Rules          COMPLETE
    2.1B — Mix Preset Contract & Ratio Engine         COMPLETE
    2.1C — Product / Mix Repositories & Services      COMPLETE

2.2 — Yield Evidence & Per-Good-Piece Learning        COMPLETE
    2.2A — Yield Sample Evidence Contract             COMPLETE
    2.2B — Good / Rejected Output & Learning          COMPLETE
    2.2C — Effective Yield Selection & History        COMPLETE

2.3 — Recipe Requirement Synthesis                    COMPLETE
    2.3A — Fixed Recipe Item Contract & Material Roles COMPLETE
    2.3B — Effective Per-Piece Material Requirements  COMPLETE
    2.3C — Material Cost Preview & Validation         COMPLETE

2.4 — Safety Waste & Inventory-Limited Capacity       IN PROGRESS
    2.4A — Safety Waste Policy                        NEXT
    2.4B — Waste-Adjusted Requirements                NOT STARTED
    2.4C — Producible Pieces & Limiting Material      NOT STARTED

2.5 — Product / Yield / Production UI                 NOT STARTED
2.6 — Phase 2 Integration & Completion Gate           NOT STARTED
```

## Completed

### 2.1 — Product & Mix Foundation

Completed through PRs #26, #28, and #30.

### 2.2 — Yield Evidence & Per-Good-Piece Learning

Completed through PRs #32, #34, and #36.

### 2.3A — Fixed Recipe Item Contract & Material Roles

- authoritative `FixedRecipeItem` source contract;
- roles: consumable, additive, finish, packaging, other;
- source quantity/unit preserved while canonical quantity remains derived;
- reusable material quantity normalization shared with yield learning;
- standard, calibrated cup-to-gram, and explicit manual cup fallback supported;
- one fixed line per product/material enforced;
- active product/material reference validation;
- container/vessel materials rejected to preserve the Phase 3 component boundary;
- storage-agnostic repository + in-memory implementation;
- create/update/get/list/remove application service;
- `BusinessDataset.recipeItems` replaces the prototype recipe scaffold;
- shared application-session wiring.

Evidence:
- PR #38 merged;
- implementation merge commit `2fbe12437328d70f3aa155bde49a49603ddbf69a`;
- post-merge CI run `34835244976` passed.

### 2.3B — Effective Per-Piece Material Requirements

- combines the effective yield sample with fixed recipe lines into one derived canonical requirement set;
- supports yield-only, fixed-only, and combined products;
- combines duplicate materials only after both sources resolve to the same canonical base unit;
- preserves yield/fixed contribution traceability including source IDs, conversion source, fixed role, and calibration ID;
- keeps Phase 2.2C latest-valid yield selection authoritative;
- exposes `ready`, `partial`, and `not-ready` readiness states;
- reports unresolved yield history/fixed lines as controlled issues instead of silently dropping valid requirements;
- supports archived-product historical inspection without reactivation;
- keeps the effective requirement view derived rather than persisted.

Evidence:
- PR #40 merged;
- implementation merge commit `fe313ba7af5161137b1b80de74898836374a915d`;
- post-merge CI run `34837084144` passed.

### 2.3C — Material Cost Preview & Requirement Validation

- prices canonical 2.3B material requirements using the Phase 1 package-cost engine;
- preserves package-cost conversion source and costing calibration identity;
- derives contribution-level costs for yield/fixed sources while keeping one material total;
- validates material identity, canonical base unit, quantities, cost basis, and contribution reconciliation;
- carries 2.3B readiness forward and adds costing readiness;
- supports ready/partial/not-ready cost preview results;
- allows legitimate zero-cost materials while rejecting malformed/unresolvable cost bases;
- supports archived historical material/product inspection without reactivation;
- keeps all material cost totals derived rather than persisted.

Evidence:
- PR #42 merged;
- implementation merge commit `6c9b5f48e74f2771166761c7a2deaf708319f2a8`;
- post-merge CI run `34838146695` passed.

## Current active task

**2.4A — Safety Waste Policy**
