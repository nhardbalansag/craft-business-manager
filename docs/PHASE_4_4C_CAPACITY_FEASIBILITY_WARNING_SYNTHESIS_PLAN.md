# Phase 4.4C — Capacity Feasibility & Warning Synthesis Development Plan

## Status

**IMPLEMENTED — FEATURE VALIDATED — PR NOT YET MERGED**

Authoritative starting base:

`develop` @ `c2100da3c787784f83b1fc0408cfa05ef9c04327`

Starting exact `develop` CI:

`34955037015 — SUCCESS`

Feature branch:

`feature/phase-4-4c-capacity-feasibility-warning-synthesis`

Previous completed task:

`4.4B — Expected Revenue / Profit / Batch Margin — COMPLETE`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Provide the authoritative Phase 4 application-level feasibility view for a requested Product production batch by joining:

- completed 4.4B expected batch financials; and
- completed Phase 3.4C current assembly-capacity trace.

The result must answer, without changing the user's requested quantity:

```text
What quantity did the user request?
What is the current authoritative assembly capacity?
Is the request within capacity, over capacity, or currently unresolved?
If over capacity, by how many finished units?
Which typed tied resources are limiting current capacity?
What warning should the future UI show while preserving the financial projection?
```

Phase 4.4C is advisory planning synthesis only. It must not reserve stock, deduct inventory, create production orders, persist derived capacity, alter pricing/cost inputs, or silently reduce the requested quantity.

## Split assessment

No deeper roadmap split is required.

4.4C is one cohesive application-service/read-model capability because the two authoritative upstream boundaries already exist:

- `ExpectedBatchFinancialsService` owns the requested quantity and complete 4.4B financial projection/readiness;
- `AssemblyCapacityTraceService` owns current Phase 3 assembly capacity plus typed tied limiting-resource trace and readiness.

A deeper roadmap split would mostly separate consistency checks from a small feasibility comparison and warning projection, creating unnecessary intermediate contracts while increasing the risk of duplicated capacity logic.

Implementation may still use ordinary checkpoints for plan, service, tests/session wiring, and documentation, but these are not new roadmap phases.

## Authoritative upstream boundaries

Create one application service that consumes only compatible providers for:

```text
ExpectedBatchFinancialsService
AssemblyCapacityTraceService
```

The 4.4C service must not directly reopen:

- Material inventory repositories;
- ProductStock repositories;
- production requirement/yield/calibration repositories;
- component-capacity services;
- `AssemblyCapacitySynthesisService` directly;
- financial-profile repositories;
- pricing-policy services;
- unit-cost services;
- physical batch cost services below 4.4B.

All capacity mathematics remain owned by Phase 3. All financial mathematics remain owned by Phase 4.4B and its completed upstream services.

## Product identity and call order

Use 4.4B as the initial Product/quantity boundary.

Recommended call order:

1. call `projectBatch(requestedProductId, plannedQuantity)`;
2. use the returned canonical `productId` when requesting `AssemblyCapacityTraceService.trace(...)`;
3. validate Product identity and active-state consistency across both results before publishing combined top-level feasibility fields.

Known request-level errors from 4.4B should be translated to a controlled 4.4C service error while preserving:

- canonical/requested Product identity;
- planned quantity;
- underlying Phase 2/4.4A quantity or production-requirement code when present.

Unexpected provider/infrastructure errors must propagate unchanged.

## Requested quantity semantics

The requested quantity remains exactly the user's requested whole planned quantity from 4.4B.

4.4C must never replace it with capacity.

If:

```text
requestedQuantity = 100
currentAssemblyCapacity = 80
```

then the result remains:

```text
plannedQuantity = 100
feasibility = over-current-capacity
overageQuantity = 20
```

It must not return a silently adjusted requested quantity of `80`.

Quantity validation is delegated to 4.4B/4.4A. 4.4C does not invent a second quantity validation formula.

## Feasibility status

Expose exactly these planning classifications:

```text
within-current-capacity
over-current-capacity
capacity-unresolved
```

### Within current capacity

When current assembly capacity is authoritative and:

```text
plannedQuantity <= currentAssemblyCapacity
```

publish:

```text
feasibility = within-current-capacity
overageQuantity = 0
```

A zero requested quantity is valid and is within any authoritative non-negative current capacity, including zero.

### Over current capacity

When current assembly capacity is authoritative and:

```text
plannedQuantity > currentAssemblyCapacity
```

publish:

```text
feasibility = over-current-capacity
overageQuantity = plannedQuantity - currentAssemblyCapacity
```

This is an advisory business warning, not a calculation failure.

A ready financial projection remains visible and authoritative even when the requested batch is over current capacity.

### Capacity unresolved

Publish:

```text
feasibility = capacity-unresolved
currentAssemblyCapacity = null at the combined top level when no authoritative numeric capacity exists
overageQuantity = null
```

when Phase 3 does not provide a safe authoritative current capacity or cross-source contradictions make combination unsafe.

Nested Phase 3 trace evidence must remain available for diagnosis.

## Numeric capacity authority versus trace-label completeness

Phase 3.4C explicitly preserves Phase 3.4B capacity evidence even when limiter-name/path tracing is partial.

Therefore 4.4C must distinguish:

```text
numeric feasibility authority
from
complete limiting-resource explanation
```

Numeric feasibility may still be determined when:

- `capacityTrace.capacitySynthesis.status === 'ready'`;
- `overallAssemblyCapacity` is finite, non-negative, and an integer;
- Product identity/active-state evidence is consistent;

although `capacityTrace.status === 'partial'` because a limiter label/path could not be resolved.

In that case:

- preserve `within-current-capacity` or `over-current-capacity` as the numeric feasibility result;
- set the overall 4.4C readiness to `partial`;
- do not invent or expose a partial limiter subset;
- emit a structured warning that limiting-resource explanation is incomplete.

If Phase 3.4B synthesis itself is partial/not-ready, numeric feasibility is `capacity-unresolved`.

## Limiting resources

When the 3.4C trace is fully ready, preserve all typed tied limiting resources exactly as provided:

```text
material-requirement
material-backed-component
product-backed-component
```

Do not:

- select only one limiter;
- merge resource types;
- recursively manufacture Product-backed component capacity;
- recalculate capacity from availability/requirements;
- derive a new limiter ranking.

When trace status is partial/not-ready, preserve the nested trace result but publish no top-level authoritative limiter subset.

Returned top-level limiter evidence must be defensively cloned.

## Warning synthesis

Expose structured warnings separately from consistency/readiness issues.

At minimum synthesize:

```text
OVER_CURRENT_CAPACITY
CAPACITY_UNRESOLVED
LIMITING_RESOURCE_EXPLANATION_INCOMPLETE
```

### Over-capacity warning

For `over-current-capacity`, produce actionable text that states:

- requested quantity;
- current capacity;
- overage quantity;
- that the full requested batch is not currently feasible;
- that the owner may increase availability of the tied limiting resources or manually choose a lower requested quantity.

The warning must never say the system automatically reduced the request.

### Capacity-unresolved warning

When feasibility cannot be established, produce a warning that current capacity evidence must be completed/corrected before feasibility can be trusted.

### Incomplete limiter explanation warning

When numeric capacity is authoritative but the typed limiter trace is partial, preserve the numeric feasibility result while warning that the exact limiting-resource explanation is incomplete.

## Cross-source consistency guards

Fail closed instead of combining contradictory source evidence.

At minimum validate:

- 4.4B Product identity versus 3.4C Product identity;
- Product active-state agreement;
- 3.4C `capacitySynthesis.productId` agrees with 3.4C top-level `productId`;
- 3.4C `capacitySynthesis.productIsActive` agrees with 3.4C top-level active state;
- a Phase 3 synthesis status of `ready` has a finite, non-negative whole `overallAssemblyCapacity`;
- a Phase 3 trace status of `ready` also has ready synthesis evidence;
- a ready trace exposes at least one typed limiter;
- every ready-trace limiter reports `capacityPieces` equal to the authoritative overall capacity;
- all derived overage quantities are finite, non-negative whole numbers.

A contradiction must force:

```text
status = not-ready
feasibility = capacity-unresolved
currentAssemblyCapacity = null
overageQuantity = null
limitingResources = []
```

while preserving complete defensively cloned nested financial and capacity-trace evidence.

## Overall readiness model

Expose:

```text
ready
partial
not-ready
```

This readiness describes confidence/completeness of the joined 4.4C planning read model. It is separate from whether the plan is physically feasible.

### ready

All of the following hold:

- 4.4B financials are `ready`;
- 3.4C capacity trace is `ready`;
- Product/capacity evidence is consistent;
- numeric feasibility is authoritative.

Both of these may be `ready` planning evidence:

```text
ready + within-current-capacity
ready + over-current-capacity
```

Being over capacity is a valid, fully known business condition, not a readiness failure.

### partial

No contradiction exists and at least one required source is partial, while useful safe evidence remains available.

Examples:

- financials are ready but limiter trace is partial while Phase 3.4B numeric capacity is still authoritative;
- financials are partial while capacity trace is ready;
- financials are ready and capacity synthesis is partial, leaving `capacity-unresolved` but preserving financial projections.

### not-ready

Use `not-ready` when:

- 4.4B is not-ready;
- Phase 3 trace/synthesis is not-ready;
- cross-source Product/active-state evidence contradicts;
- authoritative capacity or derived overage is invalid/non-finite;
- a supposedly ready trace violates the completed Phase 3 contract.

Do not suppress nested valid evidence merely because the joined result is not-ready.

## Proposed application contract

Recommended names:

```text
PlannedBatchCapacityFeasibilityService
PlannedBatchCapacityFeasibilityResult
PlannedBatchCapacityFeasibilityStatus
CapacityFeasibilityStatus
PlannedBatchCapacityWarning
PlannedBatchCapacityFeasibilityIssue
```

Recommended result shape:

```text
productId
productName
productIsActive
status                         ready | partial | not-ready
plannedQuantity
financials                     full defensively-cloned 4.4B result
capacityTrace                  full defensively-cloned 3.4C result
feasibility                    within-current-capacity | over-current-capacity | capacity-unresolved
currentAssemblyCapacity        number | null
overageQuantity                number | null
limitingResources              all typed tied limiters only when authoritative
warnings                       structured advisory warnings
issues                         readiness/consistency issues
```

Do not add persisted source fields for 4.4C. All new values are derived read-model evidence.

## Shared session wiring

Expose one shared instance from:

`src/application/session.ts`

Conceptually:

```text
plannedBatchCapacityFeasibilityService
  -> expectedBatchFinancialsService
  -> assemblyCapacityTraceService
```

Do not create duplicate repository/service graphs.

## Test plan

Dedicated service tests must cover at least:

1. within-current-capacity with ready financials/trace;
2. exact-capacity boundary;
3. over-current-capacity with correct overage;
4. zero-capacity with positive requested quantity;
5. zero quantity with zero capacity;
6. financial projections remain unchanged/visible when over capacity;
7. all typed tied limiters preserved on a ready trace;
8. cross-category tied limiter preservation;
9. Phase 3 numeric capacity ready but limiter trace partial -> determinate feasibility + partial readiness + incomplete-explanation warning;
10. Phase 3 synthesis partial -> capacity-unresolved;
11. Phase 3 not-ready -> joined not-ready/capacity-unresolved;
12. 4.4B partial + capacity ready -> joined partial while feasibility remains determinate;
13. 4.4B not-ready + capacity ready -> joined not-ready while nested capacity remains available;
14. Product identity mismatch fails closed;
15. active-state mismatch fails closed;
16. trace/synthesis identity mismatch fails closed;
17. trace/synthesis active-state mismatch fails closed;
18. invalid/non-integer/non-finite authoritative capacity fails closed;
19. ready trace with no limiting resources fails closed;
20. ready limiter capacity mismatch fails closed;
21. non-finite/invalid derived overage fails closed;
22. archived Product inspectability;
23. controlled 4.4B Product-not-found error translation;
24. controlled invalid planned-quantity error translation with underlying code;
25. production-requirement error translation;
26. unexpected provider error propagation;
27. defensive cloning of financials/capacity trace/limiters/warnings/issues;
28. canonical Product identity from 4.4B is passed to capacity tracing;
29. shared-session wiring uses completed shared 4.4B + 3.4C services.

## Validation gates

Before implementation PR merge:

- dedicated 4.4C tests pass;
- existing Phase 3 capacity tests remain green;
- existing 4.4A/4.4B financial tests remain green;
- full repository test suite passes;
- TypeScript typecheck passes;
- production Vite build passes;
- final feature-head CI is green;
- PR CI is green.

After merge:

- exact merged `develop` CI must be green before documentation closeout;
- documentation closeout must preserve the full Phase 4 audit trail and advance the roadmap only after implementation evidence is verified.

## Implementation evidence

Implementation service:

`src/application/production/PlannedBatchCapacityFeasibilityService.ts`

Shared-session export:

`plannedBatchCapacityFeasibilityService`

Implementation record:

`docs/PHASE_4_4C_CAPACITY_FEASIBILITY_WARNING_SYNTHESIS.md`

Plan-before-code commit:

`ebc4a47ffb87c6ab318a583ee55cb90a607d893c`

Service implementation commit:

`61ea9a03b5621b277d0b016a10c95f5e15f2dc10`

Shared-session wiring commit:

`7c33ed1ff635185a8464392968d2f72786294b47`

Initial focused-test head:

`7d7e645700526644a84f641e70c49b04a286f92f`

Initial focused-test CI:

`34959784315 — FAILURE`

Failure classification:

```text
strict TypeScript fixture/clone typing only
no service behavior test executed before failure
no feasibility/capacity semantics weakened in the fix
```

Corrected validated checkpoint:

`aa294854e55289343683776d0607cc0ada2675d3`

Corrected checkpoint CI:

`34960081875 — SUCCESS`

Validated repository state:

```text
TypeScript typecheck passed
77 test files passed
941 tests passed
33 dedicated 4.4C service tests passed
1 dedicated 4.4C session-wiring test passed
production Vite build passed
109 modules transformed
```

Implementation-record commit:

`f37865be56c582c98f21b9b1107080210744ba93`

The remaining feature gate is green CI on the final documented feature head, followed by a green implementation PR, guarded merge, exact post-merge `develop` CI, and documentation closeout.

## Completion gate

4.4C is complete only when:

- requested quantity is preserved exactly and never auto-clamped;
- authoritative current assembly capacity is consumed from Phase 3 rather than recomputed;
- within/over/unresolved feasibility is deterministic;
- overage is correct and safe;
- over-capacity financial projections remain visible;
- all authoritative tied limiters are preserved;
- partial limiter tracing never leaks a misleading subset;
- actionable structured warnings exist;
- cross-source contradictions fail closed;
- nested 4.4B/3.4C evidence is defensively preserved;
- shared-session wiring exists;
- no inventory/source mutation or derived persistence exists;
- focused/full tests, typecheck, build, PR CI, and exact post-merge CI all pass.

## Next task after completion

`4.5A — Product Financial Profile Editor — NEXT / NOT STARTED`

Do not begin Phase 4.5 UI implementation until 4.4C is fully merged, post-merge validated, documentation-closeout complete, and the next UI task has its own scope/split assessment and development plan.
