# Phase 3.3A — Material-Backed Component Cost Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `403146275dfe4d6eee2a61c16de00c7a93c17f79`

Feature branch:

`feature/phase-3-3a-material-backed-component-cost`

Implementation record:

`docs/PHASE_3_3A_MATERIAL_BACKED_COMPONENT_COST.md`

## Objective

Derive the current cost of one material-backed ProductComponent line by reusing the authoritative Phase 1 Material package-cost engine.

Per line, 3.3A provides:

- source Material identity/name;
- quantity required per parent;
- cost per canonical `pc`;
- component cost contribution per parent;
- package/conversion traceability;
- controlled cost readiness/issues.

The result is derived application data only. No derived cost is persisted.

## Split assessment

No deeper formal split was required.

3.3A remained one cohesive task:

1. define the line cost/readiness contract;
2. reuse 3.2C source eligibility;
3. derive cost through Phase 1 costing;
4. preserve traceability;
5. wire the shared session;
6. validate with focused/full tests.

## Scope boundary

3.3A is **material-backed component line costing only**.

Explicitly excluded:

- Product-backed recursive cost;
- child Product cost trees;
- total Product component cost aggregation;
- Phase 2 + Phase 3 cost synthesis;
- assembly capacity and limiting-resource math;
- reservations/deductions/stock transactions;
- labor, overhead, selling price, markup, margin, profit;
- UI;
- Excel persistence.

These remain 3.3B+, 3.4+, Phase 4, 3.5, or Phase 5.

## Source eligibility and 3.2C reuse

`ComponentSourceAvailabilityService` remains the canonical read-time source-eligibility resolver.

Implemented policy:

- `not-ready` availability blocks costing because the Material source is missing, inactive, or non-count-based;
- `ready` availability permits costing;
- `partial` availability also permits costing to continue because stock/on-hand readiness is distinct from cost-basis readiness.

The 3.2C result is retained on the derived cost line for diagnostics.

This prevents current stock quantity or damaged on-hand evidence from incorrectly changing an otherwise valid purchase-cost basis.

## Cost mathematics

```text
component unit cost
= Phase 1 Material cost per canonical base pc

component contribution per parent
= component unit cost × ProductComponent.quantityPerParent
```

Phase 1 `calculateMaterialPackageCosting()` is the sole Material package-cost engine. 3.3A does not reimplement conversion precedence.

## Derived result contract

Implemented line result:

```text
MaterialBackedComponentCostLine
- componentId
- parentProductId
- role
- sourceMaterialId
- sourceMaterialName: string | null
- quantityPerParent
- status: ready | not-ready
- costPerPc: number | null
- componentCostContribution: number | null
- costingTrace: MaterialBackedComponentCostTrace | null
- sourceAvailability
- issues[]
```

A single line is either costable (`ready`) or not costable (`not-ready`). Product-level `partial` aggregation remains 3.3C.

Legitimate zero package cost remains a ready zero-cost line.

## Cost traceability

Ready lines preserve:

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

This mirrors Phase 1 costing output plus authoritative Material source inputs.

## Controlled issues

Implemented stable issue codes:

```text
INVALID_COMPONENT
NOT_MATERIAL_BACKED_COMPONENT
SOURCE_MATERIAL_NOT_READY
SOURCE_MATERIAL_NOT_FOUND
MATERIAL_COST_NOT_DERIVABLE
DERIVED_COST_INVALID
```

Issues preserve underlying ProductComponent, 3.2C availability, Phase 1 MaterialCosting, or MaterialCalibration codes where available.

## Application service

Added:

`src/application/productComponents/MaterialBackedComponentCostService.ts`

Primary operation:

```text
costComponent(component: ProductComponent)
```

Dependencies:

- MaterialRepository;
- 3.2C availability provider;
- shared Material calibration-evidence provider.

ProductStock and Product-backed recursive costing are intentionally not part of this service.

## Shared session

Added shared:

```text
materialBackedComponentCostService
```

Reuses:

```text
materialRepository
componentSourceAvailabilityService
materialCalibrationEvidenceProvider
```

No repository or BusinessDataset source collection was added.

## Validation result

Dedicated test file:

`src/application/productComponents/MaterialBackedComponentCostService.test.ts`

Focused suite: **16 tests**.

Feature-head CI:

```text
run 34915288037 — SUCCESS
45 test files passed
438 tests passed
TypeScript typecheck passed
production build passed
```

Coverage includes direct `pc` costing, packaged/manual conversion, quantity multiplication, zero cost, manual conversion precedence, canonical identity/name, partial availability with ready cost basis, source eligibility failures, Product-backed exclusion, invalid component input, unresolved package conversion, invalid cost/purchase quantity, and source immutability.

## Completion gate

Implemented feature gates passed:

- Phase 1 costing is reused as the sole Material cost engine;
- source identity/name, quantity, cost per pc, and contribution are exposed;
- package/conversion traceability is preserved;
- 3.2C eligibility is reused;
- partial stock availability does not incorrectly block cost readiness;
- Product-backed components remain out of scope;
- unresolved cost basis produces controlled not-ready issues;
- no derived cost is persisted;
- session wiring exists;
- focused/full tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining gate:

- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.3B — Recursive Product-Backed Component Cost**

Do not begin 3.3B until 3.3A is merged, exact post-merge `develop` CI is green, and a dedicated 3.3B plan/scope review is established.
