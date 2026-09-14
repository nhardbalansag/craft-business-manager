# Phase 2 — Product Recipes & Mold Yield Progress

Status: **IN PROGRESS**

Planning baseline: `docs/PHASE_2_PRODUCT_RECIPES_MOLD_YIELD_PLAN.md`

```text
2.1 — Product & Mix Foundation
    2.1A — Product Contract & Category Rules        COMPLETE
    2.1B — Mix Preset Contract & Ratio Engine       COMPLETE
    2.1C — Product / Mix Repositories & Services    VALIDATION / MERGE GATE

2.2 — Yield Evidence & Per-Good-Piece Learning      NOT STARTED
2.3 — Recipe Requirement Synthesis                  NOT STARTED
2.4 — Safety Waste & Inventory-Limited Capacity     NOT STARTED
2.5 — Product / Yield / Production UI               NOT STARTED
2.6 — Phase 2 Integration & Completion Gate         NOT STARTED
```

## Completed

### 2.1A — Product Contract & Category Rules

- dedicated `Product` domain contract;
- locked categories: paintable art, candle pot, candle;
- centralized production/mix/yield category guidance;
- runtime validation and controlled contract errors;
- old recipe/component/pricing fields removed from the authoritative Product shape;
- Phase 3 component composition and Phase 4 pricing remain deferred.

Evidence:

- PR #26 merged;
- implementation merge commit `fbb31b315b68ee3d4e3b77ce29b153893cff7cdc`;
- post-merge CI run `34828814552` passed.

### 2.1B — Mix Preset Contract & Ratio Engine

- dedicated reusable `MixPreset` domain contract;
- explicit compatible product categories;
- weight/volume ratio bases;
- primary, secondary, and additive material-line roles;
- single-line and richer multi-line formulas supported;
- positive finite ratio parts and case-insensitive duplicate-material protection;
- exactly one primary line required;
- deterministic anchor-based ratio resolution from any preset line;
- anchor unit is preserved for all resolved lines;
- incompatible/count/unsupported units reject with controlled errors;
- Phase 1 remains authoritative for material normalization/calibration.

Evidence:

- PR #28 merged;
- implementation merge commit `176b548e5c2e35cbdc067fe5c3dafe7280c1f557`;
- post-merge CI run `34829821545` passed.

## Current active task

**2.1C — Product / Mix Repositories & Application Services**

Implementation is complete on `feature/phase-2-1c-product-mix-services` and is awaiting feature CI / merge validation.
