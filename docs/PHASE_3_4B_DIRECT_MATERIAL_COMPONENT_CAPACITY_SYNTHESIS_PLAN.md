# Phase 3.4B — Direct-Material + Component Capacity Synthesis Development Plan

## Status

**IN PROGRESS**

Authoritative base:

`develop` @ `b8ff28922219e5c9ddbc1d5e2dcd244e6eda3119`

Feature branch:

`feature/phase-3-4b-capacity-synthesis`

## Objective

Create one Product-level current assembly-capacity synthesis that combines:

1. Phase 2.4C direct-material capacity; and
2. all immediate Phase 3.4A component-line capacities.

When every actually-required resource is reliable:

```text
overall assembly capacity
= min(direct-material capacity, all component capacities)
```

A valid component-only Product may still be ready even when Phase 2.4C reports no direct-material requirements.

If any required resource is unresolved, retain diagnostic known capacity evidence but do not publish a misleading final overall capacity.

## Split assessment

No deeper formal split is required.

3.4B is one cohesive Product-level synthesis task:

1. obtain the authoritative Phase 2.4C direct-material capacity result;
2. obtain the Product's immediate component lines;
3. protect against corrupted duplicate component sources;
4. delegate each component line to Phase 3.4A;
5. distinguish a truly absent direct-material side from an unresolved direct-material side;
6. preserve all upstream diagnostics;
7. publish a final minimum only when every required capacity source is reliable;
8. expose deterministic readiness and shared session wiring.

These are implementation steps, not separate sub-phases.

## Scope boundary

3.4B owns Product-level capacity synthesis only.

It does not:

- recalculate Material inventory normalization;
- recalculate per-material direct capacity;
- recalculate per-component capacity;
- recursively manufacture missing Product-backed components;
- add raw-material buildable child quantity to ProductStock;
- create typed overall limiting-resource identity/tie output;
- mutate, reserve, deduct, or transact inventory/stock;
- persist derived capacity;
- change cost/pricing logic;
- add UI;
- add Excel persistence.

Typed limiting-resource trace belongs to 3.4C. UI belongs to 3.5. Pricing belongs to Phase 4. Persistence belongs to Phase 5.

## Authoritative upstream providers

### Direct materials

Phase 2.4C remains authoritative through:

`ProductionCapacityService.estimate(productId)`

3.4B must preserve the complete `ProductionCapacityResult`, including:

- Product identity/activity;
- direct-material readiness;
- normalized Material capacity lines;
- safety-waste metadata;
- per-material diagnostic capacities;
- direct-material issues;
- Phase 2 limiting Material IDs as upstream evidence only.

3.4B does not recompute direct-material inventory or requirements.

### Components

Phase 3.4A remains authoritative through:

`ComponentCapacityService.capacityForComponent(component)`

3.4B must preserve each complete `ComponentCapacityResult`, including:

- component/source identity;
- current available quantity;
- quantity per parent;
- per-component capacity;
- readiness;
- 3.2C inventory/ProductStock evidence;
- issues.

3.4B does not read Material inventory or ProductStock directly.

### Component enumeration

Use the existing component application boundary:

`ProductComponentService.listComponentsByParent(productId)`

or a compatible provider interface.

Do not introduce another repository/source-data collection.

## Direct-material applicability contract

Phase 2.4C currently reports `not-ready` when no direct-material requirements exist.

3.4B must distinguish two cases.

### Legitimate no-direct-material composition

Treat the direct-material side as **not applicable / neutral** only when all of the following are true:

- `materials.length === 0`;
- `produciblePieces === null`;
- `requirementStatus === 'not-ready'`;
- the only Phase 2 capacity issue is an `UPSTREAM_REQUIREMENT_ISSUE` whose `sourceCode` is `NO_REQUIREMENTS`.

This permits a Product whose capacity is entirely component-backed to become ready.

### Unresolved direct-material requirements

The direct side is still required/unresolved when there is evidence of a broken or non-derivable direct-material path, including:

- `YIELD_HISTORY_NOT_DERIVABLE`;
- `FIXED_ITEM_NOT_DERIVABLE`;
- missing/inactive Material;
- base-unit mismatch;
- unresolved/negative inventory;
- any other Phase 2 capacity issue beyond the sole neutral `NO_REQUIREMENTS` condition.

A Product must not become `ready` merely because its components are ready when its direct-material path is unresolved.

## Component collection integrity

Before per-line capacity synthesis, validate immediate root component source uniqueness with the existing Phase 3 composition guard.

Use:

`validateProductComponentSourceUniqueness()`

This protects imported/corrupted data from producing an overstated capacity when the same source is stored in duplicate lines that should have been combined.

Do not reimplement graph validation.

## Result contract

Recommended Product-level result:

```text
AssemblyCapacitySynthesisResult
- productId
- productIsActive
- status: ready | partial | not-ready
- directMaterialApplicable: boolean
- directMaterialCapacity: ProductionCapacityResult
- componentCapacities: ComponentCapacityResult[]
- overallAssemblyCapacity: number | null
- issues[]
```

`overallAssemblyCapacity` is published only when every actually-required source category/line is reliable.

## Capacity candidate rules

### Direct-material candidate

Include `directMaterialCapacity.produciblePieces` only when:

- the direct-material side is applicable; and
- Phase 2.4C status is `ready`; and
- `produciblePieces` is a finite non-negative integer.

If direct materials are neutral/not-applicable, they contribute no candidate and do not block readiness.

### Component candidates

Include one candidate for every immediate component line only when its 3.4A result is `ready` with a finite non-negative integer `capacityPieces`.

Every component line is required. A partial/not-ready component therefore blocks publication of the final overall capacity.

### Final minimum

When all required candidates are reliable:

```text
overallAssemblyCapacity
= min(all applicable capacity candidates)
```

Zero is authoritative and participates normally in the minimum.

## Supported Product shapes

### Direct-material-only Product

If Phase 2.4C is ready and there are no component lines:

```text
status = ready
overallAssemblyCapacity = direct-material capacity
```

### Component-only Product

If the direct side is neutral `NO_REQUIREMENTS` and all component lines are ready:

```text
status = ready
overallAssemblyCapacity = min(component capacities)
```

### Mixed Product

If direct materials and all components are ready:

```text
status = ready
overallAssemblyCapacity = min(direct capacity, component capacities)
```

### Product with no capacity resources

If the direct side is neutral and there are no component lines:

```text
status = not-ready
overallAssemblyCapacity = null
```

Return a controlled `NO_CAPACITY_RESOURCES` issue.

## Readiness contract

3.4B uses:

```text
ready
partial
not-ready
```

### Ready

`ready` requires:

- component collection integrity is valid;
- every applicable direct-material requirement is fully ready;
- every component line is ready;
- at least one applicable capacity source exists;
- every candidate is finite and non-negative;
- final minimum is finite and non-negative.

### Partial

Use `partial` when the Product has meaningful known capacity evidence but at least one required resource is unresolved.

Examples:

- direct-material capacity is ready but one component is partial/not-ready;
- one or more components are ready while another component is unresolved;
- Phase 2.4C is partial and preserves known per-material capacity diagnostics;
- direct materials are unresolved while ready component capacities remain available for diagnosis;
- duplicate/corrupted component structure exists while reliable direct capacity remains known.

Do not publish `overallAssemblyCapacity` for partial results.

### Not ready

Use `not-ready` when no reliable capacity evidence can be produced.

Examples:

- no direct-material or component capacity resources exist;
- all required components are unresolved and the direct side is neutral/absent;
- direct-material capacity is not-ready with no known material-capacity diagnostics and there are no ready component capacities;
- corrupted component structure exists and no reliable direct capacity evidence remains.

## Diagnostic evidence rule

Known capacity evidence includes:

- a ready direct-material `produciblePieces` value;
- any Phase 2 material line with a valid diagnostic `capacityPieces` value;
- any ready 3.4A component `capacityPieces` value.

This evidence may justify `partial`, but it must never be promoted into a final overall capacity unless all required resources are reliable.

## Controlled issues

Recommended synthesis issue codes:

```text
DIRECT_MATERIAL_CAPACITY_PARTIAL
DIRECT_MATERIAL_CAPACITY_NOT_READY
COMPONENT_GRAPH_INVALID
COMPONENT_CAPACITY_PARTIAL
COMPONENT_CAPACITY_NOT_READY
CAPACITY_CANDIDATE_INVALID
NO_CAPACITY_RESOURCES
```

Preserve upstream source/underlying codes and component/source IDs where useful.

A neutral direct-material `NO_REQUIREMENTS` condition must not be emitted as a blocking issue when valid components exist.

## Deterministic ordering

Component results must be deterministic, ordered by:

1. source type;
2. canonical source ID;
3. canonical component ID.

This keeps diagnostics and future UI stable.

## 3.4C boundary

3.4B may preserve Phase 2 `limitingMaterialIds` inside the untouched direct-material result, but it must not produce the final typed overall limiting-resource list.

Do not add:

```text
material requirement
material-backed component
product-backed component
```

limiting identities or tie synthesis in 3.4B.

That is the dedicated responsibility of 3.4C.

## Application service

Add:

`AssemblyCapacitySynthesisService`

Primary operation:

```text
estimate(productId: string): Promise<AssemblyCapacitySynthesisResult>
```

Recommended dependencies:

- direct-material capacity provider compatible with `ProductionCapacityService`;
- component list provider compatible with `ProductComponentService`;
- component capacity provider compatible with `ComponentCapacityService`.

No direct MaterialRepository, ProductStockRepository, CalibrationRepository, or cost-service dependency should be introduced.

## Shared application session

Add one shared instance:

```text
assemblyCapacitySynthesisService
```

Reuse:

```text
productionCapacityService
productComponentService
componentCapacityService
```

No new source-data persistence is introduced.

## Test plan

Focused tests must cover at minimum:

- direct-material-only ready Product;
- component-only ready Product with neutral Phase 2 `NO_REQUIREMENTS`;
- mixed Product where direct materials limit;
- mixed Product where a Material-backed component limits;
- mixed Product where a Product-backed component limits;
- zero direct-material capacity -> ready zero overall;
- zero component capacity -> ready zero overall;
- multiple component capacities -> minimum selected;
- deterministic component ordering;
- no direct materials + no components -> not-ready/no capacity resources;
- direct Phase 2 partial + ready components -> partial/null overall;
- direct Phase 2 not-ready/unresolved + ready components -> partial/null overall when diagnostic component evidence exists;
- direct Phase 2 not-ready/unresolved + no ready component evidence -> not-ready;
- ready direct + partial component -> partial/null overall;
- ready direct + not-ready component -> partial/null overall;
- component-only with one ready and one partial component -> partial/null overall;
- component-only with all unresolved components -> not-ready/null overall;
- duplicate component source corruption -> no final overall capacity;
- malformed component corruption surfaced through graph validation;
- invalid/non-finite direct candidate rejected defensively;
- invalid/non-finite component candidate rejected defensively;
- complete Phase 2 result preserved;
- complete 3.4A component result preserved;
- no source result mutation;
- no typed overall limiting-resource output exists;
- no recursive manufacture/ProductStock augmentation occurs.

## Completion gate

3.4B is complete only when:

- one Product-level synthesis service exists;
- Phase 2.4C direct capacity is reused without recomputation;
- all immediate component capacities delegate to 3.4A;
- component-only Products are supported through strict neutral `NO_REQUIREMENTS` detection;
- unresolved direct requirements remain blocking;
- duplicate component corruption cannot overstate capacity;
- direct-only, component-only, and mixed Products are supported;
- overall capacity is the minimum of all reliable applicable candidates;
- zero remains authoritative;
- unresolved required resources retain diagnostics but suppress final overall capacity;
- `ready | partial | not-ready` is deterministic;
- no 3.4C typed limiting-resource synthesis is introduced;
- no inventory/stock mutation or derived-capacity persistence is introduced;
- shared session wiring exists;
- focused tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.4C — Limiting Resource Trace & Readiness**

Do not begin 3.4C until 3.4B is merged, exact post-merge `develop` CI is green, 3.4B is formally marked COMPLETE, and a dedicated 3.4C development plan/scope review is established.
