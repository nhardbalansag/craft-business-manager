# Phase 2.2A — Yield Sample Evidence Contract

## Status

**COMPLETE**

Implementation branch: `feature/phase-2-2a-yield-sample-evidence`

Implementation base: `develop` at `3ba2f7d496b30094613eb344eda2a39e05acb015`.

Implementation PR: **#32**

Merge commit: `84c435d1beaea26eeeab5eb908b3218e75dadaea`

Final feature CI run: `34832157588` — **SUCCESS**

Post-merge develop CI run: `34832272913` — **SUCCESS**

## Objective

Replace the old one-material mold-yield scaffold with immutable source evidence that can represent the actual materials consumed by a real sample batch.

The authoritative record is:

```text
YieldSample
- id
- productId
- optional mixPresetId
- materialInputs[]
    - materialId
    - quantity
    - unit
- goodPieces
- rejectedPieces
- recordedAt
- notes?
```

The contract preserves what was actually measured. It does not store canonicalized quantities, per-good-piece requirements, defect rate, cost, or capacity.

## Evidence rules

- sample ID and product ID are required;
- optional mix preset ID cannot be blank;
- at least one material input is required;
- each material ID must be non-blank;
- quantities must be positive finite values;
- units must be supported standard measurement units;
- duplicate material inputs are rejected case-insensitively;
- good pieces must be a positive integer;
- rejected pieces must be a non-negative integer;
- recordedAt must be a valid date/time value;
- notes and identity strings are normalized without changing measured quantities.

## Recording/application boundary

`YieldSampleEvidenceService` records new evidence through a storage-agnostic `YieldSampleRepository`.

For a new sample:

- the product must exist and be active;
- every referenced material must exist and be active;
- an optional mix preset must exist, be active, and support the product category;
- every material input unit must be normalizable to that material's base dimension;
- the existing material-specific `cup -> g` bridge is accepted for gram-based materials without requiring calibration to exist at record time;
- sample IDs are reserved case-insensitively.

Existing evidence remains readable after referenced products, materials, or mixes are later archived. This preserves production history.

## Evidence immutability

2.2A provides record/get/list behavior but no update operation. Production evidence is append-oriented rather than silently rewritten.

Repository reads return defensive deep clones of `materialInputs[]`.

Correction/deletion/history-selection rules are deferred to 2.2C.

## BusinessDataset change

The prototype `MoldYieldSample` and `moldYieldSamples` dataset field are replaced by the authoritative `YieldSample` / `yieldSamples` contract.

The old costing primitive was decoupled from `MoldYieldSample` and now accepts canonical numeric quantity plus good-piece count. Canonicalizing each evidence line remains the responsibility of 2.2B.

## Files

- `src/domain/yieldSamples.ts`
- `src/domain/yieldSamples.test.ts`
- `src/application/yieldSamples/YieldSampleRepository.ts`
- `src/application/yieldSamples/InMemoryYieldSampleRepository.ts`
- `src/application/yieldSamples/YieldSampleEvidenceService.ts`
- `src/application/yieldSamples/YieldSampleEvidenceService.test.ts`
- `src/domain/types.ts`
- `src/domain/costing.ts`
- `src/domain/costing.test.ts`
- `src/application/session.ts`

## Validation evidence

The completion gate passed:

- TypeScript typecheck — PASS;
- domain contract tests — PASS;
- evidence repository/service tests — PASS;
- full regression suite — PASS;
- production build — PASS;
- PR #32 merged into `develop`;
- post-merge CI run `34832272913` — PASS.

## Deferred work

- canonical material consumption and learned per-good-piece requirements: **2.2B**
- defect-rate derivation: **2.2B**
- effective sample selection/history/deletion rules: **2.2C**
- fixed recipe synthesis: **2.3**
- production/yield UI: **2.5**

Next task: **2.2B — Good / Rejected Output & Learned Requirements**.
