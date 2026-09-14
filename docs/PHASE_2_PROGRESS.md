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

2.3 — Recipe Requirement Synthesis                    IN PROGRESS
    2.3A — Fixed Recipe Item Contract & Material Roles COMPLETE
    2.3B — Effective Per-Piece Material Requirements  NEXT
    2.3C — Material Cost Preview & Validation         NOT STARTED

2.4 — Safety Waste & Inventory-Limited Capacity       NOT STARTED
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

## Current active task

**2.3B — Effective Per-Piece Material Requirements**
