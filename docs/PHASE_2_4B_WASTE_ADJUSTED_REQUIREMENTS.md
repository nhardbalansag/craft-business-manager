# Phase 2.4B — Waste-Adjusted Production Requirements

## Status

**IMPLEMENTED — VALIDATION / MERGE GATE**

Branch: `feature/phase-2-4b-waste-adjusted-requirements`

Base: corrected `develop` state before Phase 2.4B implementation.

## Objective

Apply the validated Phase 2.4A safety-waste planning reserve to the canonical per-product requirements from Phase 2.3B, then scale those adjusted requirements to a requested production quantity.

Phase 2.4B remains a derived planning view. It does not mutate recipe, yield, material, or product source records.

## Core formulas

Per finished product:

```text
waste-adjusted requirement
= effective requirement × safetyWasteMultiplier
```

where:

```text
safetyWasteMultiplier
= 1 + safetyWasteRate
```

Waste reserve alone:

```text
waste reserve
= waste-adjusted requirement - effective requirement
```

For planned quantity `Q`:

```text
planned batch requirement
= waste-adjusted requirement per product × Q
```

Example:

```text
Effective plaster requirement = 75 g / product
Safety waste                  = 5%
Multiplier                    = 1.05

Waste reserve                 = 3.75 g
Planned requirement/product   = 78.75 g

For 8 products:
planned batch plaster         = 630 g
```

## Planned production quantity contract

`plannedQuantity` represents finished product pieces.

Phase 2.4B accepts:

- `0` for a zero-quantity preview;
- positive whole numbers.

It rejects:

- negative values;
- non-finite values;
- fractional finished-product quantities.

Zero planned quantity keeps the per-piece adjusted requirement visible while producing zero batch quantity.

## Traceability

Every output material preserves:

- material ID;
- canonical base unit;
- effective requirement before safety waste;
- safety-waste rate and multiplier;
- reserve quantity per product;
- adjusted planned quantity per product;
- planned batch quantity;
- source mode (`yield`, `fixed`, `combined`);
- individual source contributions.

Each contribution is scaled by the same policy so combined requirements remain explainable.

Example:

```text
Effective plaster = 80 g
├── 75 g yield
└──  5 g fixed

At 5% safety waste:
planned plaster/product = 84 g
├── 78.75 g yield portion
└──  5.25 g fixed portion
```

## Readiness propagation

Phase 2.3B readiness remains authoritative.

- `ready` remains ready after quantity planning;
- `partial` keeps its valid requirements and issues while only those valid requirements are adjusted;
- `not-ready` produces an empty material plan rather than inventing requirements.

Phase 2.4B does not add inventory readiness. Inventory availability belongs to Phase 2.4C.

## Defect-rate separation

Observed yield defect rate is **not** added to the safety-waste multiplier.

Material consumed while making rejected pieces is already represented by yield learning:

```text
learned requirement = total consumed / good pieces
```

Therefore 2.4B applies only the explicit product safety-waste reserve from Phase 2.4A.

The result explicitly records:

```text
observedDefectRateIncluded = false
```

## Validation

Before scaling, 2.4B validates that:

- policy and requirement product IDs agree;
- planned quantity is a non-negative integer;
- every effective material requirement is finite and greater than zero;
- every source contribution is finite and greater than zero;
- contribution totals reconcile to the effective material requirement;
- all derived reserve/per-piece/batch quantities remain finite and non-negative.

## Application boundary

Added:

- `src/domain/productionRequirements.ts`
- `src/domain/productionRequirements.test.ts`
- `src/application/production/ProductionRequirementService.ts`
- `src/application/production/ProductionRequirementService.test.ts`
- shared-session wiring through `productionRequirementService`.

`ProductionRequirementService` combines:

1. `EffectiveRecipeRequirementService` from Phase 2.3B; and
2. `ProductService.getSafetyWastePolicy()` from Phase 2.4A.

## Explicitly deferred

Phase 2.4B does **not**:

- inspect on-hand inventory — Phase 2.4C;
- calculate producible pieces or limiting material — Phase 2.4C;
- introduce Product/Yield/Production UI — Phase 2.5;
- include vessels/nested components — Phase 3;
- add labor, overhead, selling price, margin, or profit policy.

## Completion gate

2.4B may be marked complete after:

- per-piece waste-adjustment tests pass;
- planned-batch scaling tests pass;
- zero planned quantity tests pass;
- invalid planned quantity tests pass;
- contribution traceability/reconciliation tests pass;
- ready/partial/not-ready application tests pass;
- observed defect rate remains explicitly excluded;
- full regression suite passes;
- TypeScript typecheck passes;
- production build passes;
- feature PR merges into `develop`;
- post-merge `develop` CI passes.

Next task after completion: **2.4C — Producible Pieces & Limiting Material**.
