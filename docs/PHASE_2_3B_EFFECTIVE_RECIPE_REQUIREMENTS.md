# Phase 2.3B — Effective Per-Piece Material Requirements

## Status

**IMPLEMENTED — VALIDATION / MERGE GATE**

Branch: `feature/phase-2-3b-effective-requirements`

Base: `develop` at `1efc58d67ec6676650f9defb668c24e54146b415`.

## Objective

Create one derived canonical material-requirement view for each product by combining:

1. learned per-good-piece requirements from the effective yield sample; and
2. fixed per-product recipe requirements from Phase 2.3A.

No combined requirement is persisted as authoritative source data.

## Source modes

A product may be:

- `yield` only;
- `fixed` only;
- `combined` when the same material has both yield-derived and fixed contributions.

Example:

```text
Yield-derived plaster = 75 g / product
Fixed plaster top-up  = 5 g / product

Effective plaster     = 80 g / product
Source                 = combined
```

## Canonical merge rule

Requirements are merged by material identity only after each source has already been normalized through Phase 1 rules.

When the same material occurs in both yield and fixed sources:

- both must resolve to the same canonical material base unit;
- the canonical quantities are added;
- the final requirement is marked `combined`;
- individual contribution records are preserved.

Conflicting base units for the same material are rejected rather than silently coerced.

## Traceability

Every effective material requirement preserves contribution metadata.

Yield contribution:

```text
source = yield
sourceId = effective yield sample ID
base quantity per product
conversion source
calibration ID when applicable
```

Fixed contribution:

```text
source = fixed
sourceId = fixed recipe item ID
role
base quantity per product
conversion source
calibration ID when applicable
```

This allows later costing and production screens to explain exactly where a requirement came from.

## Readiness model

The application service returns:

```text
ready
partial
not-ready
```

### ready

At least one effective material requirement exists and all available sources are currently derivable.

A product may be valid as:

- yield-only;
- fixed-only;
- yield + fixed.

No yield history by itself is not an error because some products may be intentionally fixed-only.

### partial

Usable requirements exist, but one source cannot currently be derived.

Examples:

- yield history exists but all samples currently require missing calibration;
- a stored fixed recipe item references missing/corrupt material data.

Valid requirements are returned together with controlled readiness issues.

### not-ready

No currently derivable material requirement exists.

The result includes a `NO_REQUIREMENTS` issue instead of returning an empty successful recipe silently.

## Effective yield integration

Phase 2.2C remains authoritative for yield selection:

```text
latest currently derivable yield sample wins
```

The effective recipe service consumes that selection and preserves:

- effective yield sample ID;
- skipped newer invalid sample IDs;
- learned material contributions.

It does not introduce averaging or another yield-selection policy.

## Historical inspection

Archived products may still have their effective requirements derived for historical/reporting use when their stored evidence/material identities remain resolvable.

This does not reactivate them for production.

## Application boundary

Added:

- `src/domain/effectiveRecipeRequirements.ts`
- `src/domain/effectiveRecipeRequirements.test.ts`
- `src/application/recipeRequirements/EffectiveRecipeRequirementService.ts`
- `src/application/recipeRequirements/EffectiveRecipeRequirementService.test.ts`
- shared-session wiring through `effectiveRecipeRequirementService`.

## Deferred

- material cost contribution and recipe total cost: **2.3C**;
- safety-waste planning: **2.4**;
- inventory-limited capacity: **2.4C**;
- product/yield/production UI: **2.5**;
- vessels and nested product components: **Phase 3**.

## Completion gate

2.3B may be marked complete after:

- yield-only synthesis tests pass;
- fixed-only synthesis tests pass;
- combined-material canonical merge tests pass;
- contribution traceability tests pass;
- base-unit conflict protection tests pass;
- readiness-state tests pass;
- full regression suite passes;
- TypeScript typecheck passes;
- production build passes;
- feature PR merges into `develop`;
- post-merge `develop` CI passes.

Next task after completion: **2.3C — Material Cost Preview & Requirement Validation**.
