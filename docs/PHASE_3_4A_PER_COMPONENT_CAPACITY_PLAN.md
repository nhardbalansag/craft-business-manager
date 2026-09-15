# Phase 3.4A — Per-Component Availability & Capacity Development Plan

## Status

**IN PROGRESS**

Authoritative base:

`develop` @ `7889846430ce672de232c8b9942ff7ce5bde7ffb`

Feature branch:

`feature/phase-3-4a-per-component-capacity`

## Objective

Derive current assembly capacity for one Phase 3 ProductComponent line from its authoritative current availability.

```text
component parent capacity
= floor(available component quantity / quantityPerParent)
```

Material-backed availability comes from normalized Material inventory through Phase 3.2C.

Product-backed availability comes from ProductStock through Phase 3.2C.

The result must preserve source identity, current available quantity, quantity per parent, derived parent capacity, readiness, and underlying availability evidence.

## Split assessment

No deeper formal split is required.

3.4A is one cohesive per-line capacity task:

1. validate the ProductComponent contract;
2. delegate source availability to 3.2C;
3. validate the resolved availability before arithmetic;
4. derive `floor(available / quantityPerParent)` when reliable;
5. preserve source/readiness/trace evidence;
6. expose controlled issues rather than inventing zero for unresolved data;
7. add shared session wiring and focused/full validation.

These are implementation steps, not new sub-phases.

## Scope boundary

3.4A calculates capacity for **one component requirement line only**.

It does not:

- aggregate multiple component capacities into a Product-level capacity;
- combine direct-material capacity with component capacity;
- calculate overall assembly capacity;
- identify or mark limiting resources;
- recursively manufacture missing Product-backed components;
- add child raw-material buildable capacity to ProductStock;
- reserve, deduct, or transact Material/ProductStock inventory;
- mutate ProductComponent, Material, Product, or ProductStock source data;
- calculate cost, labor, overhead, selling price, markup, margin, or profit;
- add UI;
- add Excel persistence.

Product-level synthesis remains 3.4B. Limiting-resource trace remains 3.4C. UI remains 3.5. Pricing remains Phase 4. Persistence remains Phase 5.

## Authoritative source availability

3.4A must delegate current source resolution to:

`ComponentSourceAvailabilityService.resolveComponent(component)`

Do not read Material on-hand or ProductStock directly in the capacity service.

3.2C remains authoritative for:

- Material/Product existence and active state;
- count-based Material compatibility;
- Material on-hand normalization and conversion/calibration evidence;
- ProductStock existence and validation;
- explicit zero stock versus missing stock;
- `ready | partial | not-ready` source availability.

## Component contract

3.4A accepts one `ProductComponent`.

Before capacity arithmetic, validate the existing ProductComponent contract so that:

- component ID is valid;
- parent Product ID is valid;
- source type/ID is valid;
- role is valid;
- `quantityPerParent` is a finite positive whole-piece count.

No new component source data is introduced.

## Derived capacity contract

Recommended result:

```text
ComponentCapacityResult
- componentId
- parentProductId
- role
- sourceType
- sourceId
- quantityPerParent
- status: ready | partial | not-ready
- availableQuantity: number | null
- unit: pc
- capacityPieces: number | null
- sourceAvailability: ComponentSourceAvailability | null
- issues[]
```

`capacityPieces` means how many parent Products can currently be assembled from this component line alone.

## Capacity mathematics

When source availability is reliable:

```text
capacityPieces
= floor(availableQuantity / quantityPerParent)
```

Examples:

```text
available 10 pc, requires 2 pc -> capacity 5
available 10 pc, requires 3 pc -> capacity 3
available 0 pc,  requires 4 pc -> capacity 0
```

No safety-waste factor is applied to discrete Phase 3 component quantities.

No recursive make-to-order quantity is added to Product-backed stock.

## Readiness contract

3.4A uses:

```text
ready
partial
not-ready
```

### Ready

A line is `ready` when:

- ProductComponent validation passes;
- 3.2C availability is `ready`;
- `availableQuantity` is finite and non-negative;
- the derived capacity is a finite non-negative integer.

Explicit zero availability is a valid ready state:

```text
availableQuantity = 0
capacityPieces = 0
status = ready
```

### Partial

A line is `partial` when the source relationship is otherwise recognized but current quantity is unresolved.

Examples inherited from 3.2C:

- Product source exists and is active but ProductStock is missing;
- ProductStock exists but is invalid;
- Material source exists but on-hand normalization cannot currently be derived;
- Material normalized on-hand is invalid/negative and therefore unusable.

For partial availability:

```text
capacityPieces = null
```

Do not silently convert unresolved quantity to zero.

### Not ready

A line is `not-ready` when the component/source relationship itself cannot validly participate in current assembly-capacity calculation.

Examples:

- invalid ProductComponent contract;
- source Material/Product not found;
- source Material/Product inactive;
- Material-backed source is not count-based.

For not-ready lines:

```text
capacityPieces = null
```

## Source traceability

Return the complete 3.2C `ComponentSourceAvailability` result so callers can inspect:

- normalized Material inventory evidence;
- Material conversion/calibration source;
- ProductStock record when available;
- current source readiness issues;
- explicit zero versus missing quantity.

3.4A should add summary capacity issues without discarding lower-level evidence.

## Controlled issues

Recommended summary codes:

```text
INVALID_COMPONENT
SOURCE_AVAILABILITY_PARTIAL
SOURCE_AVAILABILITY_NOT_READY
AVAILABLE_QUANTITY_INVALID
DERIVED_CAPACITY_INVALID
```

Where useful, preserve the underlying ProductComponent or 3.2C issue code.

## Pure capacity helper

To stay consistent with existing Phase 2 capacity architecture, add a small pure domain helper for the arithmetic boundary.

Recommended domain contract:

```text
ComponentCapacityInput
- availableQuantity
- quantityPerParent

ComponentCapacityMathResult
- availableQuantity
- quantityPerParent
- capacityPieces
```

The helper validates finite/non-negative available quantity and finite positive whole quantity per parent, then applies the floor formula.

The application service remains responsible for source availability/readiness and traceability.

## Application service

Add:

`ComponentCapacityService`

Primary operation:

```text
capacityForComponent(component: ProductComponent): Promise<ComponentCapacityResult>
```

Recommended dependency:

- `ComponentSourceAvailabilityProvider` compatible with the shared 3.2C resolver.

No MaterialRepository, ProductRepository, or ProductStockRepository dependency should be required by 3.4A itself.

## Shared application session

Add one shared instance:

```text
componentCapacityService
```

Reuse:

```text
componentSourceAvailabilityService
```

No new repository or BusinessDataset source-data collection is introduced.

## Test plan

Focused tests must cover at minimum:

- Material-backed ready availability and exact capacity;
- Product-backed ready ProductStock and exact capacity;
- floor behavior with remainder;
- quantity per parent greater than availability -> zero capacity;
- explicit zero Material availability -> ready zero capacity;
- explicit zero ProductStock -> ready zero capacity;
- missing ProductStock -> partial/null capacity;
- invalid ProductStock -> partial/null capacity;
- unresolved Material inventory conversion -> partial/null capacity;
- negative Material normalized availability -> partial/null capacity;
- missing Material -> not-ready/null capacity;
- inactive Material -> not-ready/null capacity;
- non-count Material -> not-ready/null capacity;
- missing Product -> not-ready/null capacity;
- inactive Product -> not-ready/null capacity;
- malformed ProductComponent -> controlled invalid-component result;
- exact source type/ID, parent ID, role, quantity, and `pc` unit preserved;
- complete 3.2C availability evidence preserved;
- invalid/non-finite available quantity rejected defensively even if a provider is corrupted;
- invalid derived capacity rejected defensively;
- source ProductComponent/availability evidence not mutated;
- no ProductStock recursive buildable quantity is introduced;
- no overall Product capacity or limiting-resource output leaks into 3.4A.

## Completion gate

3.4A is complete only when:

- one component-line capacity view exists;
- Material-backed availability delegates to 3.2C;
- Product-backed availability delegates to 3.2C/ProductStock semantics;
- capacity uses `floor(available / quantityPerParent)` exactly once;
- explicit zero produces ready zero capacity;
- unresolved quantity remains null rather than silent zero;
- `ready | partial | not-ready` is deterministic;
- source identity and availability traceability are preserved;
- ProductStock is not recursively augmented from raw-material buildability;
- no Product-level capacity synthesis or limiting-resource logic is introduced;
- no source data is mutated or derived capacity persisted;
- shared session wiring exists;
- focused tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.4B — Direct-Material + Component Capacity Synthesis**

Do not begin 3.4B until 3.4A is merged, exact post-merge `develop` CI is green, 3.4A is formally marked COMPLETE, and a dedicated 3.4B development plan/scope review is established.
