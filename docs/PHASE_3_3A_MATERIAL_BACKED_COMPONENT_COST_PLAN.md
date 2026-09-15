# Phase 3.3A — Material-Backed Component Cost Development Plan

## Status

**IN PROGRESS**

Authoritative base:

`develop` @ `403146275dfe4d6eee2a61c16de00c7a93c17f79`

Feature branch:

`feature/phase-3-3a-material-backed-component-cost`

## Objective

Derive the current cost of one material-backed ProductComponent line by reusing the authoritative Phase 1 Material package-cost engine.

3.3A must answer, for a purchased discrete component such as a glass cup or packaging insert:

- which Material supplies the component;
- how many pieces are required by one parent Product;
- what one piece currently costs;
- what the component contributes to one parent Product;
- which package/conversion evidence produced that cost;
- whether the cost basis is ready or unresolved.

The result is derived application data only. No cost value is persisted on ProductComponent, Product, or BusinessDataset.

## Split assessment

No deeper formal split is required.

3.3A is cohesive enough to implement as one task. Internal implementation order:

1. define the material-backed component cost result/issue contract;
2. reuse 3.2C source eligibility for material-backed relationships;
3. resolve the authoritative Material record;
4. derive cost per `pc` through Phase 1 `calculateMaterialPackageCosting()`;
5. calculate the line contribution from `costPerPc × quantityPerParent`;
6. preserve package/conversion traceability;
7. add shared application-session wiring;
8. add focused tests and full repository validation.

These are implementation steps, not new sub-phases.

## Scope boundary

3.3A is **material-backed component line costing only**.

It does not:

- recurse into Product-backed components;
- calculate child Product cost;
- aggregate total component cost for a Product;
- combine Phase 2 direct-material cost with Phase 3 component cost;
- calculate assembly capacity;
- divide stock by quantity-per-parent;
- determine limiting resources;
- reserve, deduct, or mutate inventory;
- add labor, overhead, markup, selling price, margin, or profit;
- add React UI;
- add Excel persistence.

Those remain 3.3B, 3.3C, 3.4+, 3.5, Phase 4, or Phase 5.

## Source eligibility and 3.2C reuse

The 3.2C `ComponentSourceAvailabilityService` remains the canonical read-time source-eligibility resolver.

3.3A will call it for the material-backed component and use its result as follows:

- `not-ready` source availability means the component cost line is `not-ready` because the source is missing, inactive, or not canonical count-based Material inventory;
- `ready` source availability permits costing;
- `partial` source availability **also permits costing to continue** because stock/on-hand readiness is not the same as cost-basis readiness.

This distinction is required.

Example:

- a Material may have unresolved current on-hand package conversion but still have a fully resolvable purchase/package cost basis;
- conversely, current on-hand may be ready while package cost conversion is unresolved.

Therefore 3.3A must not make component cost depend on current stock quantity or current inventory availability.

The 3.2C result is retained in the cost result for diagnostic traceability, but only `not-ready` relationship eligibility blocks costing.

## Cost mathematics

For a valid material-backed component:

```text
component unit cost
= Material cost per canonical base pc

component contribution per parent
= component unit cost × ProductComponent.quantityPerParent
```

Phase 1 `calculateMaterialPackageCosting()` is authoritative for deriving cost per base unit.

Because material-backed components must use canonical Material `baseUnit = pc`, the returned Phase 1 `costPerBaseUnit` is the authoritative `costPerPc`.

3.3A must not reimplement package conversion precedence.

## Derived result contract

Recommended line result:

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

### `ready`

The material-backed source relationship is eligible and the current Material cost basis is derivable.

Both `costPerPc` and `componentCostContribution` are finite, non-negative numbers.

A legitimate zero package cost produces:

```text
costPerPc = 0
componentCostContribution = 0
status = ready
```

### `not-ready`

The component cannot currently produce a reliable material-backed cost line.

Baseline causes:

- component record is invalid;
- component is Product-backed rather than Material-backed;
- source relationship is `not-ready` according to 3.2C;
- Material cannot be resolved after eligibility lookup;
- current Material package cost basis cannot be derived by Phase 1 costing.

`costPerPc` and `componentCostContribution` are `null`.

No `partial` line status is introduced in 3.3A because a single cost line is either costable or not costable. Product-level partial aggregation belongs to 3.3C.

## Costing trace contract

A ready line preserves enough evidence to explain the cost without recomputing or parsing prose:

```text
MaterialBackedComponentCostTrace
- packageCost
- purchaseQuantity
- purchaseUnit
- baseUnit: pc
- standardBaseUnitsPerPurchaseUnit
- manualBaseUnitsPerPurchaseUnit
- calibrationBaseUnitsPerPurchaseUnit
- effectiveBaseUnitsPerPurchaseUnit
- packageBaseQuantity
- packageConversionSource: manual | standard | calibration
- costingCalibrationId: string | null
```

This mirrors the authoritative Phase 1 Material package-cost result and source inputs.

The trace is derived only and is not persisted.

## Issue contract

Baseline stable issue codes:

```text
INVALID_COMPONENT
NOT_MATERIAL_BACKED_COMPONENT
SOURCE_MATERIAL_NOT_READY
SOURCE_MATERIAL_NOT_FOUND
MATERIAL_COST_NOT_DERIVABLE
```

Issue records may preserve:

- underlying ProductComponent validation code;
- underlying 3.2C source-availability issue code;
- underlying Phase 1 MaterialCostingError code;
- underlying Phase 1 MaterialCalibrationError code.

Downstream 3.3C/UI code must not need to parse exception text.

## Application service

Add:

```text
MaterialBackedComponentCostService
```

Primary operation:

```text
costComponent(component: ProductComponent)
```

The service accepts a source ProductComponent line so 3.3B/3.3C can later compose it without requiring UI or persistence concerns.

Dependencies:

- `MaterialRepository`;
- `ComponentSourceAvailabilityService` or compatible availability provider;
- shared `materialCalibrationEvidenceProvider`.

The service does not require ProductStock and does not inspect Product-backed component cost.

## Shared application session

Add one shared instance:

```text
materialBackedComponentCostService
```

Reuse the existing:

```text
materialRepository
componentSourceAvailabilityService
materialCalibrationEvidenceProvider
```

No new repository or BusinessDataset collection is introduced.

## Test plan

Focused tests must cover at minimum:

- direct `pc` purchase unit -> standard cost-per-pc trace;
- packaged count Material with manual conversion -> correct cost per pc;
- quantity-per-parent multiplication -> correct contribution;
- zero package cost -> ready zero cost/contribution;
- manual conversion precedence over standard conversion where Phase 1 allows both;
- source Material name/identity preserved;
- source availability `partial` does not block otherwise resolvable cost;
- missing/inactive/non-count source eligibility from 3.2C -> not-ready;
- Product-backed component -> controlled not-ready;
- invalid ProductComponent contract -> controlled not-ready with underlying code;
- unresolved Material package conversion -> not-ready with Phase 1 costing error code;
- invalid package cost/purchase quantity -> not-ready with Phase 1 costing error code;
- returned trace/result objects are derived and do not mutate source records.

## Completion gate

3.3A is complete only when:

- Phase 1 costing is reused as the sole Material cost engine;
- valid Material-backed component lines expose source identity/name, quantity, cost per pc, and contribution;
- package/conversion source traceability is preserved;
- 3.2C source eligibility is reused rather than independently redefined;
- partial stock availability does not incorrectly block cost readiness;
- Product-backed components remain out of scope;
- unresolved Material cost basis produces controlled `not-ready` output with stable issues;
- no derived cost is persisted;
- shared application-session wiring exists;
- focused tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.3B — Recursive Product-Backed Component Cost**

Do not begin 3.3B until 3.3A is merged, exact post-merge `develop` CI is green, and a dedicated 3.3B development plan/scope review has been established.
