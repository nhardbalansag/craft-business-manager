# Phase 3.4C — Limiting Resource Trace & Readiness Development Plan

## Status

**IN PROGRESS — PLAN ESTABLISHED BEFORE IMPLEMENTATION**

Authoritative base:

`develop` @ `803287c9ef5cb6eca0a7c3466db3bd9063c2a0ff`

Feature branch:

`feature/phase-3-4c-limiting-resource-trace`

## Objective

Complete Phase 3.4 by adding a typed, deterministic limiting-resource trace over the authoritative Phase 3.4B assembly-capacity synthesis.

When Phase 3.4B publishes a reliable final assembly capacity, 3.4C must report **every current parent input tied at that minimum** and identify each limiter as one of:

```text
material-requirement
material-backed-component
product-backed-component
```

The result must preserve enough identity and path evidence for the Phase 3.5 production UI to explain what currently limits assembly.

## Authoritative master-plan contract

The Phase 3 master plan requires 3.4C to:

- report every resource tied at the minimum;
- use typed resource identity rather than only a Material ID;
- distinguish direct material requirements, Material-backed components, and Product-backed components;
- preserve a readable component path for composition inspection;
- keep overall capacity based on the parent's **current assembly inputs**, not hypothetical recursive manufacture of missing child stock.

## Split assessment

No deeper formal split is required.

3.4C is one cohesive enrichment/trace task:

1. consume the authoritative 3.4B result;
2. preserve 3.4B readiness and diagnostics;
3. when 3.4B is ready, identify all direct Material limiters tied at the final minimum;
4. identify all immediate Material-backed component limiters tied at the same minimum;
5. identify all immediate Product-backed component limiters tied at the same minimum;
6. resolve stable human-readable source names without recomputing capacity;
7. construct deterministic typed path evidence;
8. validate trace completeness defensively;
9. expose one shared application-session service;
10. add focused regression coverage and complete the Phase 3.4 gate.

These are implementation steps, not separate sub-phases.

## Scope boundary

3.4C owns limiting-resource identity, ties, trace, and trace readiness only.

It does **not**:

- recalculate direct-material requirements or capacity;
- normalize Material inventory;
- recalculate component availability/capacity;
- recursively manufacture missing Product-backed components;
- add child buildable quantity to ProductStock;
- mutate/reserve/deduct Material inventory or ProductStock;
- add stock transactions or production history;
- change component-aware cost;
- add labor, overhead, markup, selling price, margin, or profit;
- add React/UI work;
- add Excel persistence.

3.5 owns UI. Phase 4 owns pricing. Phase 5 owns persistence.

## Authoritative upstream provider

Phase 3.4B remains authoritative through:

`AssemblyCapacitySynthesisService.estimate(productId)`

3.4C must never recompute its minimum.

The complete `AssemblyCapacitySynthesisResult` is preserved as nested evidence, including:

- Product identity/activity;
- `ready | partial | not-ready` capacity status;
- direct-material applicability;
- full Phase 2.4C direct-material capacity result;
- every Phase 3.4A component capacity result;
- overall assembly capacity;
- synthesis issues.

## Trace readiness contract

3.4C exposes:

```text
ready
partial
not-ready
```

### Ready

Trace status is `ready` only when:

- upstream 3.4B status is `ready`;
- `overallAssemblyCapacity` is a finite non-negative integer;
- at least one typed limiting resource can be derived;
- every expected direct-material limiter can be mapped to its Material capacity evidence;
- every source name needed for the limiter trace resolves consistently;
- every returned limiter capacity exactly equals the final overall capacity.

### Partial

Trace status is `partial` when meaningful capacity evidence exists but a final authoritative limiter trace cannot be published.

Examples:

- upstream 3.4B is `partial`;
- upstream 3.4B is `ready` but a referenced limiter entity disappeared/cannot be resolved;
- upstream says the direct side is limiting but its direct `limitingMaterialIds` cannot be matched to Material capacity lines;
- a candidate limiter has inconsistent/corrupted capacity metadata.

For `partial`, preserve the full upstream synthesis result and diagnostics, but return:

```text
limitingResources = []
```

Do not publish a partial limiter list as authoritative.

### Not ready

Trace status is `not-ready` when upstream 3.4B is `not-ready` or no reliable final capacity exists.

Return no authoritative limiter list.

## Typed limiting-resource contract

Use one discriminated union.

### Direct Material requirement

```text
MaterialRequirementLimitingResource
- resourceType: material-requirement
- capacityPieces
- materialId
- materialName
- baseUnit
- normalizedOnHandBaseQuantity
- plannedBaseQuantityPerProduct
- path[]
```

The direct Material limiter must reuse Phase 2.4C `limitingMaterialIds` plus the corresponding Material capacity result.

Do not re-run the direct-capacity formula.

### Material-backed component

```text
MaterialComponentLimitingResource
- resourceType: material-backed-component
- capacityPieces
- componentId
- parentProductId
- parentProductName
- role
- materialId
- materialName
- availableQuantity
- quantityPerParent
- path[]
```

A Material-backed component is limiting when its ready 3.4A `capacityPieces` equals the 3.4B final minimum.

### Product-backed component

```text
ProductComponentLimitingResource
- resourceType: product-backed-component
- capacityPieces
- componentId
- parentProductId
- parentProductName
- role
- productId
- productName
- availableQuantity
- quantityPerParent
- path[]
```

A Product-backed component is limiting when its ready 3.4A `capacityPieces` equals the 3.4B final minimum.

Its capacity remains based on current explicit ProductStock only.

## Path contract

Represent paths as typed nodes rather than display-only strings:

```text
LimitingResourcePathNode
- kind: product | material
- id
- name
```

Examples:

Direct Material requirement:

```text
Gift Box > Plaster
```

Material-backed component:

```text
Gift Box > Glass Jar
```

Product-backed component:

```text
Gift Box > Candle
```

### Nested path boundary

The master plan also gives a composition-inspection example such as:

```text
Gift Box > Candle > Handmade Pot
```

3.4C must not imply that `Handmade Pot` directly limits `Gift Box` when `Gift Box` currently requires only finished `Candle` stock. The authoritative parent assembly limiter remains the immediate current input `Candle`.

Therefore:

- limiter paths in 3.4C terminate at the **current parent input actually used in 3.4B capacity**;
- recursive Product composition/cost paths already owned by Phase 3.3B remain separate evidence;
- Phase 3.5 may present both the immediate capacity path and recursive composition/cost inspection together without changing the capacity formula.

This preserves the master plan's nested inspection goal without introducing forbidden recursive manufacture semantics.

## Tie handling

Every current parent input tied at `overallAssemblyCapacity` must be reported.

Example:

```text
overallAssemblyCapacity = 10

direct material Plaster capacity = 10
Mini Heart Product component capacity = 10
Mini Star Product component capacity = 10
Mini Flower Product component capacity = 10
```

All four resources are returned.

Do not select only the first limiter.

Zero-capacity ties are valid and must all be reported.

## Direct-material limiter selection

If:

```text
directMaterialApplicable = true
directMaterialCapacity.status = ready
directMaterialCapacity.produciblePieces = overallAssemblyCapacity
```

then each `directMaterialCapacity.limitingMaterialIds` entry is an expected direct limiter.

For every ID:

- locate the matching `materials[]` capacity line case-insensitively;
- verify its `capacityPieces` equals `overallAssemblyCapacity`;
- resolve the Material name from `MaterialRepository`;
- construct a typed `material-requirement` limiter.

If the direct side is ready but not tied at the final overall minimum, no direct-material limiter is added.

## Component limiter selection

For every immediate 3.4A component result:

- require `status === ready`;
- require finite non-negative integer `capacityPieces`;
- include it when `capacityPieces === overallAssemblyCapacity`;
- classify by `sourceType`:
  - `material` -> `material-backed-component`;
  - `product` -> `product-backed-component`;
- resolve the corresponding source name from the existing repository boundary;
- preserve component ID, role, quantity-per-parent, available quantity, and source identity.

Do not traverse child raw materials to augment Product-backed capacity.

## Trace consistency guards

A 3.4B `ready` result should be internally coherent. 3.4C still guards corrupted/custom provider data.

Controlled trace problems include:

```text
UPSTREAM_CAPACITY_PARTIAL
UPSTREAM_CAPACITY_NOT_READY
OVERALL_CAPACITY_INVALID
PARENT_PRODUCT_NOT_FOUND
DIRECT_LIMITER_LINE_MISSING
DIRECT_LIMITER_CAPACITY_MISMATCH
LIMITER_SOURCE_NOT_FOUND
LIMITER_CAPACITY_INVALID
NO_LIMITING_RESOURCES
```

If a ready upstream result cannot produce a complete trustworthy trace, downgrade the 3.4C result to `partial`, preserve the upstream capacity, return no authoritative limiter list, and report controlled issues.

## Result contract

Recommended public result:

```text
AssemblyCapacityTraceResult
- productId
- productName
- productIsActive
- status: ready | partial | not-ready
- overallAssemblyCapacity: number | null
- capacitySynthesis: AssemblyCapacitySynthesisResult
- limitingResources: LimitingResource[]
- issues[]
```

`overallAssemblyCapacity` mirrors the upstream 3.4B value; 3.4C does not recompute it.

For upstream partial/not-ready results, preserve the upstream value exactly (normally null) and do not synthesize limiter identities.

## Deterministic ordering

Return limiters in stable order:

1. `material-requirement`;
2. `material-backed-component`;
3. `product-backed-component`;
4. canonical source ID;
5. canonical component ID where applicable.

This ensures stable tests and Phase 3.5 rendering.

## Source-name resolution

3.4C may use:

- `ProductRepository` for parent/Product-backed names;
- `MaterialRepository` for direct Material and Material-backed component names.

These repositories are used for identity/label enrichment only.

Do not read inventory or ProductStock directly in 3.4C.

## Application service

Add:

`AssemblyCapacityTraceService`

Primary operation:

```text
trace(productId: string): Promise<AssemblyCapacityTraceResult>
```

Recommended dependencies:

```text
AssemblyCapacitySynthesisService-compatible provider
ProductRepository
MaterialRepository
```

No new repository or source-data collection is introduced.

## Shared application session

Add one shared instance:

```text
assemblyCapacityTraceService
```

Reuse:

```text
assemblyCapacitySynthesisService
productRepository
materialRepository
```

## Defensive cloning / mutation rule

The returned `capacitySynthesis` evidence must be defensively copied deeply enough that callers cannot mutate provider-owned nested Material/component/source-availability evidence through the trace result.

3.4C never mutates source data or upstream result objects.

## Focused test plan

Cover at minimum:

- direct-material-only limiter;
- one direct Material tied limiter;
- multiple direct Material ties preserved;
- Material-backed component limiter;
- Product-backed component limiter;
- direct Material + component cross-category tie;
- multiple component ties;
- three-way resource-type tie;
- zero-capacity direct limiter;
- zero-capacity component limiter;
- zero-capacity cross-category ties;
- non-limiting direct Material excluded;
- non-limiting components excluded;
- deterministic limiter ordering;
- parent/source names and typed paths;
- Material requirement evidence preserved;
- component role/quantity/availability preserved;
- ProductStock-based Product component trace preserved through nested 3.4A evidence;
- upstream partial -> partial/no limiter list;
- upstream not-ready -> not-ready/no limiter list;
- invalid ready overall capacity -> partial/no limiter list;
- missing parent Product -> partial/no limiter list;
- missing direct limiter capacity line -> partial/no limiter list;
- direct limiter capacity mismatch -> partial/no limiter list;
- missing Material limiter source -> partial/no limiter list;
- missing Product limiter source -> partial/no limiter list;
- corrupted component limiter capacity -> partial/no limiter list;
- ready upstream with no derivable limiters -> partial/no limiter list;
- upstream synthesis evidence is preserved;
- upstream/source objects are not mutated;
- no recursive child manufacture is attempted.

## Completion gate

3.4C is complete only when:

- one typed limiting-resource trace service exists;
- every limiter tied at the final minimum is reported;
- direct Material, Material-backed component, and Product-backed component identities are distinct;
- all tie combinations, including zero, are supported;
- readable typed paths are preserved;
- 3.4B remains authoritative for capacity/readiness inputs and overall minimum;
- partial/not-ready upstream results never publish misleading authoritative limiter lists;
- corrupt/inconsistent ready provider data is downgraded safely;
- Product-backed limiter capacity remains current ProductStock-based only;
- no recursive manufacture semantics are introduced;
- no inventory/stock mutation or derived persistence is introduced;
- shared application-session wiring exists;
- focused tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI passes;
- documentation-only closeout marks 3.4C and Phase 3.4 COMPLETE;
- tracker advances to 3.5A without starting UI implementation.

## Next task after closeout

**3.5A — Product Composition Editor**

Do not begin 3.5A until 3.4C is merged, exact post-merge `develop` CI is green, 3.4C/Phase 3.4 are formally closed, and a dedicated 3.5A scope review/development plan is established.
