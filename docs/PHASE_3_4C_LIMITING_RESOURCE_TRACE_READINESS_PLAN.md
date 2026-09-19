# Phase 3.4C — Limiting Resource Trace & Readiness Development Plan

## Status

**COMPLETE**

Authoritative implementation base:

`develop` @ `803287c9ef5cb6eca0a7c3466db3bd9063c2a0ff`

Feature branch:

`feature/phase-3-4c-limiting-resource-trace`

Implementation PR:

**#83 — Phase 3.4C — Limiting Resource Trace & Readiness**

Implementation merge:

`2abd09b743cc88f4db06dc52916eb39b2bc9a52e`

## Objective completed

3.4C adds a typed deterministic trace over Phase 3.4B and reports every current parent input tied at the authoritative final assembly-capacity minimum as:

```text
material-requirement
material-backed-component
product-backed-component
```

The service preserves identity, name, capacity evidence, component metadata where relevant, and typed path information without recomputing capacity.

## Split assessment

No deeper formal split was required. 3.4C remained one cohesive trace/readiness task built over 3.4B.

## Locked implementation boundaries

- 3.4B remains authoritative for `overallAssemblyCapacity`;
- direct Material limiter identities reuse Phase 2.4C limiter evidence;
- component limiters reuse Phase 3.4A capacity evidence;
- all tied resources are returned, including zero-capacity ties;
- Product-backed capacity remains based on explicit current ProductStock only;
- limiter paths terminate at the immediate current parent input used by 3.4B;
- recursive child manufacture/buildable-stock augmentation is excluded;
- no inventory/stock mutation, reservation, deduction, or transaction history is introduced;
- no UI, pricing, or Excel persistence is introduced.

## Public application boundary

Implemented:

`AssemblyCapacityTraceService`

Primary operation:

```text
trace(productId: string): Promise<AssemblyCapacityTraceResult>
```

Dependencies:

```text
AssemblyCapacitySynthesisService-compatible provider
ProductRepository
MaterialRepository
```

Shared application session instance:

```text
assemblyCapacityTraceService
```

## Readiness contract

`ready` requires complete trustworthy typed limiter evidence over a ready 3.4B result.

`partial` preserves upstream capacity diagnostics but returns no authoritative limiter list when trace evidence is incomplete/inconsistent.

`not-ready` preserves an upstream 3.4B not-ready state and returns no limiter list.

## Validation completed

Focused coverage:

```text
AssemblyCapacityTraceService.test.ts — 35 tests
```

Full repository validation:

```text
51 test files passed
586 tests passed
TypeScript typecheck passed
production build passed
```

CI / merge evidence:

```text
Fully wired feature CI     34921412641 — SUCCESS
Final feature-head CI      34921498304 — SUCCESS
PR #83 CI                  34921565665 — SUCCESS
Implementation merge       2abd09b743cc88f4db06dc52916eb39b2bc9a52e
Post-merge develop CI      34921631005 — SUCCESS
```

## Completion gate

All implementation gates passed:

- typed limiter service exists;
- every limiter tied at the final minimum is preserved;
- direct Material, Material-backed component, and Product-backed component identities are distinct;
- all tie combinations including zero are supported;
- readable deterministic typed paths are preserved;
- 3.4B remains authoritative for capacity/readiness/minimum;
- incomplete traces fail closed without misleading limiter subsets;
- Product-backed limiter capacity remains ProductStock-based only;
- no recursive manufacturing semantics leaked in;
- no source mutation or derived persistence exists;
- shared session wiring exists;
- focused/full tests, typecheck, build, PR CI, and exact post-merge CI passed.

## Phase completion

3.4C completion closes:

**3.4 — Component-Limited Assembly Capacity — COMPLETE**

## Next task

**3.5A — Product Composition Editor — NEXT / NOT STARTED**

A dedicated 3.5A development plan/scope review must be established before implementation begins.
