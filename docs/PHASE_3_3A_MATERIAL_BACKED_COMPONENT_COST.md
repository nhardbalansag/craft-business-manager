# Phase 3.3A — Material-Backed Component Cost

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-3a-material-backed-component-cost`

Authoritative implementation base:

`develop` @ `403146275dfe4d6eee2a61c16de00c7a93c17f79`

Development plan:

`docs/PHASE_3_3A_MATERIAL_BACKED_COMPONENT_COST_PLAN.md`

## Implementation

Added:

`src/application/productComponents/MaterialBackedComponentCostService.ts`

The service derives one material-backed ProductComponent cost line without mutating or persisting source data.

### Cost mathematics

```text
cost per pc
= Phase 1 Material cost per canonical base unit

component contribution per parent
= cost per pc × quantityPerParent
```

The implementation delegates package conversion and cost derivation to the existing Phase 1 `calculateMaterialPackageCosting()` engine. No duplicate conversion precedence was introduced.

## 3.2C eligibility reuse

The service consumes the existing `ComponentSourceAvailabilityService` as the canonical source-eligibility view.

Policy:

- `not-ready` availability blocks material-backed costing because the Material source is missing, inactive, or not canonical `pc` inventory;
- `ready` availability permits costing;
- `partial` availability also permits costing to continue because current stock/on-hand readiness is distinct from package-cost readiness.

This prevents stock quantity or damaged on-hand evidence from incorrectly changing the price/cost basis of a purchased component.

The complete 3.2C availability result remains attached to the derived line for diagnostics.

## Derived line contract

Each result preserves:

```text
componentId
parentProductId
role
sourceMaterialId
sourceMaterialName
quantityPerParent
status: ready | not-ready
costPerPc
componentCostContribution
costingTrace
sourceAvailability
issues[]
```

A single 3.3A line does not use `partial` cost status. It is either currently costable (`ready`) or not costable (`not-ready`). Product-level partial aggregation remains 3.3C.

## Cost traceability

Ready lines preserve the Phase 1 package-cost evidence:

```text
packageCost
purchaseQuantity
purchaseUnit
baseUnit = pc
standardBaseUnitsPerPurchaseUnit
manualBaseUnitsPerPurchaseUnit
calibrationBaseUnitsPerPurchaseUnit
effectiveBaseUnitsPerPurchaseUnit
packageBaseQuantity
packageConversionSource
costingCalibrationId
```

This evidence is derived only and is not added to BusinessDataset.

## Controlled issues

Stable issue codes:

```text
INVALID_COMPONENT
NOT_MATERIAL_BACKED_COMPONENT
SOURCE_MATERIAL_NOT_READY
SOURCE_MATERIAL_NOT_FOUND
MATERIAL_COST_NOT_DERIVABLE
DERIVED_COST_INVALID
```

Issues preserve underlying ProductComponent, 3.2C availability, Phase 1 MaterialCosting, or MaterialCalibration codes when available.

Product-backed components are explicitly rejected from this service rather than entering recursive costing. Recursive Product-backed cost remains 3.3B.

## Shared session wiring

`src/application/session.ts` now exports:

```text
materialBackedComponentCostService
```

It reuses:

```text
materialRepository
componentSourceAvailabilityService
materialCalibrationEvidenceProvider
```

No new repository or source-data collection was introduced.

## Validation coverage

Added:

`src/application/productComponents/MaterialBackedComponentCostService.test.ts`

Dedicated 3.3A suite: **16 tests**.

Coverage includes:

- direct `pc` package costing;
- manual package conversion;
- quantity-per-parent contribution multiplication;
- legitimate zero package cost;
- Phase 1 manual-over-standard conversion precedence;
- canonical Material identity/name;
- partial stock availability with still-ready cost basis;
- missing Material source;
- inactive Material source;
- non-count Material source;
- Product-backed component exclusion;
- invalid ProductComponent contract;
- unresolved package conversion;
- invalid package cost;
- invalid purchase quantity;
- source immutability.

Feature-head CI:

```text
run 34915288037 — SUCCESS
45 test files passed
438 tests passed
TypeScript typecheck passed
production build passed
```

## Explicit deferrals

Not implemented in 3.3A:

- recursive Product-backed component cost;
- child Product cost tree/traversal;
- parent Product component subtotal;
- Phase 2 + Phase 3 total cost synthesis;
- assembly capacity or limiting-resource logic;
- reservations, deductions, or transactions;
- labor/overhead/pricing/margin/profit;
- React UI;
- Excel persistence.

These remain 3.3B+, 3.4+, Phase 4, 3.5, or Phase 5.

## Completion gate state

Feature implementation gates passed:

- Phase 1 costing is reused as the sole Material cost engine;
- source Material identity/name and quantity are preserved;
- cost per pc and contribution are derived correctly;
- conversion/cost traceability is explicit;
- 3.2C source eligibility is reused;
- partial stock readiness does not incorrectly block cost readiness;
- Product-backed recursion remains excluded;
- unresolved cost basis returns controlled not-ready issues;
- derived cost is not persisted;
- shared session wiring exists;
- 45 test files / 438 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining before 3.3A may be marked fully complete:

- implementation PR must merge to `develop`;
- exact post-merge `develop` CI must pass.

## Next task after closeout

**3.3B — Recursive Product-Backed Component Cost**

Do not begin 3.3B until 3.3A is merged, exact post-merge `develop` CI is green, and a dedicated 3.3B plan/scope review is established.
