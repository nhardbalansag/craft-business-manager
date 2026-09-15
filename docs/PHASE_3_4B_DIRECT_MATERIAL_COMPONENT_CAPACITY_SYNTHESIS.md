# Phase 3.4B — Direct-Material + Component Capacity Synthesis

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-4b-capacity-synthesis`

Authoritative implementation base:

`develop` @ `b8ff28922219e5c9ddbc1d5e2dcd244e6eda3119`

Development plan:

`docs/PHASE_3_4B_DIRECT_MATERIAL_COMPONENT_CAPACITY_SYNTHESIS_PLAN.md`

## Implementation

Added Product-level synthesis service:

`src/application/production/AssemblyCapacitySynthesisService.ts`

Primary operation:

```text
estimate(productId)
```

The service combines the existing Phase 2.4C direct-material capacity result with all immediate Phase 3.4A component capacity results.

## Capacity formula

When every actually-required resource is reliable:

```text
overall assembly capacity
= min(direct-material capacity, all component capacities)
```

No upstream formula is duplicated.

- direct-material capacity remains owned by `ProductionCapacityService`;
- per-component capacity remains owned by `ComponentCapacityService`;
- 3.4B performs only Product-level synthesis/readiness.

## Direct-material applicability

A Phase 2.4C `not-ready` result is treated as neutral/no-direct-materials only when:

```text
materials.length = 0
produciblePieces = null
requirementStatus = not-ready
issues = exactly one UPSTREAM_REQUIREMENT_ISSUE(NO_REQUIREMENTS)
```

That permits a valid component-only Product to become ready.

Any additional/broken direct-material evidence remains blocking. Examples include non-derivable yield history, broken fixed requirements, missing/inactive Material, base-unit mismatch, or unresolved inventory.

## Supported Product shapes

### Direct-material only

Ready Phase 2.4C capacity with no component lines publishes the direct-material capacity as the overall assembly capacity.

### Component only

Neutral direct `NO_REQUIREMENTS` plus ready component lines publishes the minimum component capacity.

### Mixed

Ready Phase 2.4C capacity plus ready component lines publishes the minimum across both categories.

### No capacity resources

Neutral direct `NO_REQUIREMENTS` plus no component lines returns:

```text
status = not-ready
overallAssemblyCapacity = null
NO_CAPACITY_RESOURCES
```

## Readiness behavior

3.4B exposes:

```text
ready
partial
not-ready
```

### Ready

Every applicable resource is reliable and at least one valid capacity candidate exists.

### Partial

Known diagnostic capacity evidence exists, but at least one required resource is unresolved or structurally invalid.

The final overall capacity remains `null`.

### Not ready

No reliable capacity evidence can be produced.

The final overall capacity remains `null`.

## Diagnostic preservation

The result preserves the complete Phase 2.4C `ProductionCapacityResult`, including per-Material diagnostic capacities and upstream `limitingMaterialIds`.

It also preserves every complete 3.4A `ComponentCapacityResult`, including 3.2C Material/ProductStock availability evidence.

Known diagnostics are retained even when unresolved resources prevent publication of the final overall capacity.

## Duplicate/corruption protection

Before component arithmetic, immediate component lines are validated with:

`validateProductComponentSourceUniqueness()`

This prevents duplicate source corruption from overstating capacity by treating duplicate component lines as independent requirements.

Malformed component contracts are surfaced through the same existing composition validation boundary.

## Deterministic ordering

Component capacity lines are ordered by:

1. source type;
2. canonical source ID;
3. canonical component ID.

This stabilizes diagnostics and future UI use.

## Controlled issues

Implemented synthesis issue codes:

```text
DIRECT_MATERIAL_CAPACITY_PARTIAL
DIRECT_MATERIAL_CAPACITY_NOT_READY
COMPONENT_GRAPH_INVALID
COMPONENT_CAPACITY_PARTIAL
COMPONENT_CAPACITY_NOT_READY
CAPACITY_CANDIDATE_INVALID
NO_CAPACITY_RESOURCES
```

The neutral sole `NO_REQUIREMENTS` condition is intentionally not emitted as a blocking issue when valid component capacity exists.

## Defensive capacity validation

Ready direct/component candidates are accepted only when they are finite non-negative integers.

A corrupted ready provider cannot cause an invalid final capacity to be published.

Authoritative zero is preserved and participates normally in the minimum.

## 3.4C boundary

3.4B does not synthesize typed overall limiting resources or ties.

The nested Phase 2 result still preserves its own direct-material `limitingMaterialIds`, but no final cross-category:

```text
material requirement
material-backed component
product-backed component
```

limiting-resource output is introduced here.

That remains Phase 3.4C.

## Shared session wiring

`src/application/session.ts` now exports:

```text
assemblyCapacitySynthesisService
```

It reuses:

```text
productionCapacityService
productComponentService
componentCapacityService
```

No new repository or `BusinessDataset` collection is introduced.

## Validation coverage

Added:

`src/application/production/AssemblyCapacitySynthesisService.test.ts`

Dedicated tests: **27**.

Coverage includes:

- direct-material-only capacity;
- component-only capacity;
- mixed direct/component capacity;
- Material-backed and Product-backed component minima;
- zero direct/component capacity;
- multiple-component minimum;
- deterministic ordering;
- strict neutral `NO_REQUIREMENTS` handling;
- broken direct requirements remaining blocking;
- Phase 2 partial/not-ready propagation;
- component partial/not-ready propagation;
- component-only partial/not-ready behavior;
- duplicate source corruption;
- malformed component corruption;
- invalid direct/component candidate defense;
- Phase 2 diagnostic preservation;
- 3.4A/3.2C trace preservation;
- source-result immutability;
- archived Product activity preservation;
- canonical Product identity use;
- explicit absence of 3.4C typed overall limiter output.

Fully wired feature CI:

```text
run 34920239411 — SUCCESS
50 test files passed
551 tests passed
TypeScript typecheck passed
production build passed
```

## Explicit deferrals

Not implemented in 3.4B:

- typed overall limiting-resource identities;
- limiting-resource tie synthesis;
- nested component-path limiter trace;
- recursive manufacture/buildable child quantity;
- inventory/stock reservation, deduction, or transactions;
- cost/pricing changes;
- UI;
- Excel persistence.

These remain 3.4C, later Phase 3, Phase 4, and Phase 5 work.

## Completion gate state

Feature implementation gates passed:

- Product-level synthesis service exists;
- Phase 2.4C direct capacity is reused without recomputation;
- all immediate component capacities delegate to 3.4A;
- strict neutral `NO_REQUIREMENTS` supports valid component-only Products;
- unresolved direct requirements remain blocking;
- duplicate component corruption cannot overstate capacity;
- direct-only, component-only, and mixed Products are supported;
- final capacity is the minimum of all reliable applicable candidates;
- zero is preserved as authoritative;
- unresolved resources retain diagnostics while suppressing final overall capacity;
- readiness is deterministic;
- no 3.4C typed limiting-resource synthesis leaked into 3.4B;
- no source mutation or derived-capacity persistence exists;
- shared session wiring exists;
- 50 test files / 551 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining before 3.4B may be marked fully complete:

- implementation PR must merge to `develop`;
- exact post-merge `develop` CI must pass.

## Next task after closeout

**3.4C — Limiting Resource Trace & Readiness**

Do not begin 3.4C until 3.4B is merged, exact post-merge `develop` CI is green, and a dedicated 3.4C development plan/scope review is established.
