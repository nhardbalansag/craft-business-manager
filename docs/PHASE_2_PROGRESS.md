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
    2.3A — Fixed Recipe Item Contract & Material Roles VALIDATION / MERGE GATE
    2.3B — Effective Per-Piece Material Requirements  NOT STARTED
    2.3C — Material Cost Preview & Validation         NOT STARTED

2.4 — Safety Waste & Inventory-Limited Capacity       NOT STARTED
2.5 — Product / Yield / Production UI                 NOT STARTED
2.6 — Phase 2 Integration & Completion Gate           NOT STARTED
```

## Completed

### 2.1 — Product & Mix Foundation

Completed through PRs #26, #28, and #30.

### 2.2A — Yield Sample Evidence Contract

- immutable multi-material production evidence;
- append-oriented recording service;
- active-reference validation for new evidence;
- historical evidence retention.

Evidence:
- PR #32 merged;
- implementation merge commit `84c435d1beaea26eeeab5eb908b3218e75dadaea`;
- post-merge CI run `34832272913` passed.

### 2.2B — Good / Rejected Output & Learned Requirements

- canonicalizes every recorded material input through Phase 1 conversion/calibration rules;
- derives normalized batch consumption per material;
- derives learned base quantity per good piece as total consumption / good pieces;
- keeps rejected pieces out of the denominator to avoid double-counting observed defect loss;
- derives defect rate separately from safety waste;
- reports conversion source and calibration identity for traceability;
- exposes learning through `YieldLearningService` and the shared application session.

Evidence:
- PR #34 merged;
- implementation merge commit `f36322c434cacbf0f3c7486a1b4bb4e2c394183d`;
- post-merge CI run `34833286721` passed.

### 2.2C — Effective Yield Selection & History Rules

- deterministic newest-first history ordering by `recordedAt` then stable sample identity;
- latest currently derivable sample becomes effective;
- newer invalid samples remain historical evidence and do not hide an older valid sample;
- effective learning identifies the source sample and skipped invalid samples;
- active products cannot delete their current effective sample unless another valid sample can immediately take over;
- archived products may remove final historical evidence;
- evidence remains immutable: insert + controlled delete, no replace/update.

Evidence:
- PR #36 merged;
- implementation merge commit `20757f540afb9d08a3ecd505521fc8af64013bb5`;
- post-merge CI run `34834211687` passed.

## Current active task

**2.3A — Fixed Recipe Item Contract & Material Roles**

Implementation is complete on `feature/phase-2-3a-fixed-recipe` and is awaiting CI / merge validation.
