# Phase 3.4B — Direct-Material + Component Capacity Synthesis

## Status

**COMPLETE**

Implementation PR: **#81 — MERGED**

Implementation merge commit:

`c598eb81b1521e63773c163f6aef1a3004cafbdb`

Development plan:

`docs/PHASE_3_4B_DIRECT_MATERIAL_COMPONENT_CAPACITY_SYNTHESIS_PLAN.md`

## Completed implementation

`AssemblyCapacitySynthesisService` now provides the Product-level current assembly-capacity synthesis boundary.

It combines:

1. authoritative Phase 2.4C direct-material capacity; and
2. every immediate Phase 3.4A component capacity.

When every actually-required capacity source is reliable:

```text
overall assembly capacity
= min(direct-material capacity, all component capacities)
```

No upstream capacity formula is duplicated.

## Supported Product shapes

- direct-material-only Products use ready Phase 2.4C capacity;
- component-only Products are supported when Phase 2 reports only the neutral `NO_REQUIREMENTS` state;
- mixed Products synthesize direct and component capacities;
- Products with no direct or component resources remain `not-ready`.

Authoritative zero is retained and participates normally in the minimum.

## Readiness and diagnostics

The service exposes deterministic:

```text
ready
partial
not-ready
```

If any required resource is unresolved, known Phase 2/3.4A diagnostic capacities remain inspectable but `overallAssemblyCapacity` is not published.

The complete Phase 2.4C `ProductionCapacityResult` and each complete Phase 3.4A `ComponentCapacityResult` are preserved defensively.

## Direct-material applicability

Direct materials are neutral/not applicable only when Phase 2 reports exactly one `UPSTREAM_REQUIREMENT_ISSUE` with source code `NO_REQUIREMENTS`, no Material capacity lines, and no overall direct capacity.

Broken yield/fixed requirements, missing/inactive Materials, unit mismatches, and unresolved inventory remain blocking.

## Integrity guards

Immediate component lines use the existing `validateProductComponentSourceUniqueness()` guard before synthesis so duplicate/corrupted component sources cannot overstate capacity.

Ready direct/component candidates are also defensively required to be finite non-negative integers.

## Session wiring

Shared application session now exports:

`assemblyCapacitySynthesisService`

It reuses:

- `productionCapacityService`;
- `productComponentService`;
- `componentCapacityService`.

No new repository or source-data persistence was introduced.

## Validation

Dedicated 3.4B tests:

```text
AssemblyCapacitySynthesisService.test.ts — 27 tests
```

Repository validation:

```text
50 test files passed
551 tests passed
TypeScript typecheck passed
production build passed
```

CI evidence:

```text
Fully wired feature CI      34920239411 — SUCCESS
Final feature-head CI       34920325840 — SUCCESS
PR #81 CI                   34920392445 — SUCCESS
Post-merge develop CI       34920455875 — SUCCESS
```

Post-merge CI was validated on exact implementation merge:

`c598eb81b1521e63773c163f6aef1a3004cafbdb`

## Explicit deferrals

3.4B does not implement:

- typed overall limiting-resource identities;
- tied limiting-resource synthesis;
- overall nested limiter path trace;
- recursive manufacture of missing ProductStock;
- inventory/stock reservation, deduction, or transaction history;
- pricing;
- UI;
- Excel persistence.

These remain 3.4C and later phases.

## Completion gate

All 3.4B gates are complete:

- Product-level direct/component capacity synthesis exists;
- Phase 2.4C and 3.4A are reused without duplicated formulas;
- direct-only, component-only, and mixed Products are supported;
- strict neutral `NO_REQUIREMENTS` handling is enforced;
- unresolved required resources suppress final capacity while retaining diagnostics;
- duplicate component corruption is guarded;
- zero capacity remains authoritative;
- no 3.4C typed limiting-resource synthesis leaked into 3.4B;
- tests, typecheck, build, implementation PR, and exact post-merge CI all passed.

## Next task

**3.4C — Limiting Resource Trace & Readiness — NEXT / NOT STARTED**

Do not begin 3.4C until its dedicated development plan/scope review is established.
