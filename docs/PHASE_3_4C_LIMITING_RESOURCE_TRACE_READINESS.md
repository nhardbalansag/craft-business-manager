# Phase 3.4C — Limiting Resource Trace & Readiness

## Status

**COMPLETE**

Implementation PR: **#83**

Feature branch:

`feature/phase-3-4c-limiting-resource-trace`

Authoritative implementation base:

`develop` @ `803287c9ef5cb6eca0a7c3466db3bd9063c2a0ff`

Implementation merge:

`2abd09b743cc88f4db06dc52916eb39b2bc9a52e`

Development plan:

`docs/PHASE_3_4C_LIMITING_RESOURCE_TRACE_READINESS_PLAN.md`

## Implementation outcome

Added:

`src/application/production/AssemblyCapacityTraceService.ts`

Primary operation:

```text
trace(productId)
```

The service wraps Phase 3.4B `AssemblyCapacitySynthesisService` and explains every current parent input tied at the authoritative final assembly-capacity minimum. It does not recompute capacity.

## Typed limiting resources

Implemented three distinct resource identities:

```text
material-requirement
material-backed-component
product-backed-component
```

Direct Material limiters preserve Material identity/name, capacity, base unit, normalized on-hand quantity, planned per-Product requirement, and Product -> Material path.

Material-backed component limiters preserve component identity/role, parent Product, Material identity/name, current availability, quantity per parent, component capacity, and Product -> Material path.

Product-backed component limiters preserve component identity/role, parent Product, child Product identity/name, explicit current finished ProductStock availability, quantity per parent, component capacity, and Product -> child Product path.

## All-tie semantics

Every resource tied at `overallAssemblyCapacity` is returned, including:

- multiple direct Materials;
- multiple Material-backed components;
- multiple Product-backed components;
- cross-category ties;
- ties across all three resource types;
- authoritative zero-capacity ties.

Limiter ordering is deterministic by resource type, canonical source ID, then canonical component ID where applicable.

## Path boundary

Capacity paths terminate at the immediate current parent input whose capacity participates in Phase 3.4B.

Examples:

```text
Gift Box > Plaster
Gift Box > Glass Jar
Gift Box > Candle
```

A deeper composition path such as `Gift Box > Candle > Handmade Pot` remains separate composition/cost inspection evidence and does not imply recursive make-to-order capacity. Product-backed current assembly capacity continues to use explicit ProductStock only.

## Readiness

3.4C exposes:

```text
ready
partial
not-ready
```

A trace is `ready` only when the upstream 3.4B result is ready, the final capacity is valid, every expected limiter can be resolved consistently, all returned limiter capacities equal the final minimum, and at least one typed limiter exists.

If meaningful capacity exists but the trace is incomplete or inconsistent, the trace becomes `partial`, preserves the upstream synthesis evidence, and returns no authoritative limiter subset.

An upstream 3.4B `not-ready` result remains `not-ready` and returns no limiter list.

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

## Defensive behavior

The service guards inconsistent/custom upstream results without changing 3.4B's authoritative capacity. Returned nested capacity, component, source-availability, and ProductStock evidence is defensively cloned. No source data is mutated or persisted.

## Shared session wiring

`src/application/session.ts` exports:

```text
assemblyCapacityTraceService
```

It reuses:

```text
assemblyCapacitySynthesisService
productRepository
materialRepository
```

Repositories are used only for identity/name enrichment. 3.4C does not read Material inventory or ProductStock directly for capacity calculation.

## Validation

Dedicated test file:

`src/application/production/AssemblyCapacityTraceService.test.ts`

Dedicated tests: **35**

Repository validation:

```text
51 test files passed
586 tests passed
35 dedicated 3.4C tests
TypeScript typecheck passed
production build passed
```

CI evidence:

```text
Fully wired feature CI     34921412641 — SUCCESS
Final feature-head CI      34921498304 — SUCCESS
PR #83 CI                  34921565665 — SUCCESS
Post-merge develop CI      34921631005 — SUCCESS
Implementation merge       2abd09b743cc88f4db06dc52916eb39b2bc9a52e
```

## Completion gate

All 3.4C implementation gates passed:

- typed limiter trace exists;
- every tied limiter is reported;
- all three resource identities remain distinct;
- zero and cross-category ties are supported;
- deterministic typed paths/names are preserved;
- 3.4B remains authoritative for capacity and overall minimum;
- partial/not-ready states never publish misleading limiter subsets;
- corrupted trace evidence fails closed;
- Product-backed capacity remains ProductStock-based only;
- no recursive manufacture semantics were introduced;
- no inventory/stock mutation or derived-capacity persistence exists;
- shared session wiring exists;
- focused/full tests, typecheck, build, PR CI, and exact post-merge CI all passed.

## Phase outcome

With 3.4C complete, **Phase 3.4 — Component-Limited Assembly Capacity is COMPLETE**.

## Next task

**3.5A — Product Composition Editor — NEXT / NOT STARTED**

Do not begin 3.5A until its dedicated development plan/scope review is established.
