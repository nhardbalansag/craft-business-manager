# Phase 3.4C — Limiting Resource Trace & Readiness

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-4c-limiting-resource-trace`

Authoritative implementation base:

`develop` @ `803287c9ef5cb6eca0a7c3466db3bd9063c2a0ff`

Development plan:

`docs/PHASE_3_4C_LIMITING_RESOURCE_TRACE_READINESS_PLAN.md`

## Implementation

Added:

`src/application/production/AssemblyCapacityTraceService.ts`

Primary operation:

```text
trace(productId)
```

The service wraps the completed Phase 3.4B `AssemblyCapacitySynthesisService` and explains which current parent inputs are tied at the authoritative final assembly-capacity minimum.

3.4C does not recompute capacity.

## Typed limiter contract

Implemented discriminated resource identities:

```text
material-requirement
material-backed-component
product-backed-component
```

### Material requirement

Preserves:

- Material ID/name;
- capacity pieces;
- base unit;
- normalized on-hand quantity;
- planned base quantity per parent Product;
- typed Product -> Material path.

The direct limiter list reuses Phase 2.4C `limitingMaterialIds` and validates each matching Material capacity line against the 3.4B final capacity.

### Material-backed component

Preserves:

- component ID;
- parent Product ID/name;
- component role;
- Material ID/name;
- current available quantity;
- quantity per parent;
- component capacity;
- typed Product -> Material path.

### Product-backed component

Preserves:

- component ID;
- parent Product ID/name;
- component role;
- child Product ID/name;
- current available finished ProductStock quantity;
- quantity per parent;
- component capacity;
- typed Product -> child Product path.

Product-backed capacity remains based only on explicit current ProductStock evidence supplied through 3.4A/3.4B.

## All-tie behavior

Every current parent input tied at `overallAssemblyCapacity` is returned.

This includes ties:

- between multiple direct Materials;
- between multiple Material-backed components;
- between multiple Product-backed components;
- across direct Material and component categories;
- across all three resource identity types;
- at authoritative zero capacity.

No first-limiter-only behavior is used.

## Deterministic ordering

Limiter results are ordered by:

1. `material-requirement`;
2. `material-backed-component`;
3. `product-backed-component`;
4. canonical source ID;
5. canonical component ID where applicable.

## Path semantics

Limiter paths use typed nodes:

```text
kind: product | material
id
name
```

Examples:

```text
Gift Box > Plaster
Gift Box > Glass Jar
Gift Box > Candle
```

The path ends at the current parent input whose capacity participates in 3.4B.

A nested child such as:

```text
Gift Box > Candle > Handmade Pot
```

is not reported as directly limiting `Gift Box` unless it is itself a current `Gift Box` input. Recursive composition/cost inspection remains separate Phase 3.3B evidence. This prevents accidental recursive-manufacture semantics.

## Readiness behavior

3.4C exposes:

```text
ready
partial
not-ready
```

### Ready

Requires:

- upstream 3.4B `ready`;
- valid finite non-negative integer final capacity;
- resolvable parent/source identity labels;
- all expected direct limiter IDs mapped to matching capacity lines;
- all returned limiter capacities equal to the final minimum;
- at least one typed limiting resource.

### Partial

Returned when meaningful upstream capacity exists but authoritative limiter trace is incomplete/inconsistent.

Examples:

- upstream 3.4B partial;
- missing parent/source label entity;
- missing direct limiter line;
- direct limiter capacity mismatch;
- invalid component availability/capacity evidence in an otherwise `ready` custom provider result;
- ready upstream result with no derivable limiter.

For partial trace:

```text
limitingResources = []
```

No incomplete limiter subset is published as authoritative.

### Not ready

Upstream 3.4B `not-ready` remains not-ready and publishes no limiter list.

## Controlled trace issues

Implemented:

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

The complete upstream 3.4B synthesis result remains nested in the trace result, so original capacity issues remain inspectable.

## Defensive behavior

3.4C guards inconsistent/corrupted custom provider results even though production 3.4B already validates capacity candidates.

If a `ready` upstream result cannot be traced consistently, 3.4C downgrades only the trace readiness to `partial` while preserving the authoritative upstream capacity snapshot.

Returned nested capacity/component/source-availability evidence is defensively copied.

No source object is mutated.

## Shared session wiring

`src/application/session.ts` now exports:

```text
assemblyCapacityTraceService
```

It reuses:

```text
assemblyCapacitySynthesisService
productRepository
materialRepository
```

The repositories are used only for identity/name enrichment. 3.4C does not read Material inventory or ProductStock directly.

## Focused validation

Added:

`src/application/production/AssemblyCapacityTraceService.test.ts`

Dedicated tests: **35**.

Coverage includes:

- direct Material limiter identity;
- multiple direct Material ties;
- Material-backed limiter;
- Product-backed limiter;
- cross-category ties;
- all-three-type ties;
- authoritative zero ties;
- non-limiters excluded;
- deterministic ordering;
- source names and typed paths;
- direct quantity/inventory evidence;
- component role/quantity/availability evidence;
- nested ProductStock evidence preservation;
- upstream partial/not-ready propagation;
- invalid final-capacity defense;
- missing parent/source defense;
- missing direct limiter-line defense;
- direct limiter mismatch defense;
- invalid component evidence defense;
- no-limiter ready-corruption defense;
- case-insensitive direct Material identity matching;
- archived parent activity preservation;
- source/upstream immutability;
- deep defensive cloning;
- immediate parent-input path semantics;
- explicit ProductStock-based zero limiter with no recursive manufacture augmentation.

## Validation evidence

Fully wired implementation head:

```text
ce30b1881c92cc8774ee60785c8132cd115799d5
```

CI:

```text
run 34921412641 — SUCCESS
51 test files passed
586 tests passed
35 dedicated 3.4C tests
TypeScript typecheck passed
production build passed
```

## Explicit deferrals

Not implemented in 3.4C:

- Product composition editor UI;
- ProductStock UI;
- component-aware Production estimate UI;
- recursive manufacture/buildable child-stock augmentation;
- stock reservations/deductions/transactions;
- labor/overhead/pricing;
- Excel persistence.

These remain Phase 3.5, Phase 4, and Phase 5 work.

## Completion gate state

Feature implementation gates passed:

- typed limiting-resource service exists;
- all tied direct/component resources are preserved;
- all three resource identities are distinct;
- zero/tied minima are supported;
- typed paths and names are present;
- 3.4B remains authoritative for the capacity minimum;
- partial/not-ready states do not publish misleading limiter subsets;
- inconsistent custom provider results fail closed;
- Product-backed capacity remains ProductStock-based only;
- no recursive manufacture semantics exist;
- no source mutation or derived-capacity persistence exists;
- shared session wiring exists;
- 51 test files / 586 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining before 3.4C / Phase 3.4 may be marked fully complete:

- final documented feature-head CI must remain green;
- implementation PR must pass its own CI and merge to `develop`;
- exact post-merge `develop` CI must pass;
- documentation-only closeout must mark 3.4C and Phase 3.4 COMPLETE and advance 3.5A to NEXT / NOT STARTED.

## Next task after closeout

**3.5A — Product Composition Editor**

Do not begin 3.5A until 3.4C and Phase 3.4 are formally closed and a dedicated 3.5A development plan/scope review is established.
