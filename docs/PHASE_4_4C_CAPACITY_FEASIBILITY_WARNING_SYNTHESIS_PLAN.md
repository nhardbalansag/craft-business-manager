# Phase 4.4C — Capacity Feasibility & Warning Synthesis Development Plan

## Status

**COMPLETE — IMPLEMENTED, MERGED, AND POST-MERGE VALIDATED**

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

The result answers, without changing the user's requested quantity:

```text
What quantity did the user request?
What is the current authoritative assembly capacity?
Is the request within capacity, over capacity, or currently unresolved?
If over capacity, by how many finished units?
Which typed tied resources are limiting current capacity?
What warning should the future UI show while preserving the financial projection?
```

Phase 4.4C is advisory planning synthesis only. It does not reserve stock, deduct inventory, create production orders, persist derived capacity, alter pricing/cost inputs, or silently reduce the requested quantity.

## Split assessment

No deeper roadmap split was required.

4.4C was kept as one cohesive application-service/read-model capability because the two authoritative upstream boundaries already existed:

- `ExpectedBatchFinancialsService` owns the requested quantity and complete 4.4B financial projection/readiness;
- `AssemblyCapacityTraceService` owns current Phase 3 assembly capacity plus typed tied limiting-resource trace and readiness.

A deeper roadmap split would have separated consistency checks from a small feasibility comparison/warning projection and increased the risk of duplicating capacity logic.

## Authoritative upstream boundaries

The implementation consumes only compatible providers for:

```text
ExpectedBatchFinancialsService
AssemblyCapacityTraceService
```

4.4C does not directly reopen:

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

4.4B is the initial Product/quantity boundary.

Implemented call order:

1. call `projectBatch(requestedProductId, plannedQuantity)`;
2. use the returned canonical `productId` for `AssemblyCapacityTraceService.trace(...)`;
3. validate Product identity and active-state consistency across both results before publishing combined top-level feasibility fields.

Known request-level errors from 4.4B are translated to a controlled 4.4C service error while preserving Product identity, planned quantity, and the underlying Phase 2/4.4A quantity or production-requirement code when present. Unexpected provider/infrastructure errors propagate unchanged.

## Requested quantity semantics

The requested quantity remains exactly the user's requested whole planned quantity from 4.4B.

4.4C never replaces it with capacity.

Example:

```text
requestedQuantity = 100
currentAssemblyCapacity = 80
plannedQuantity = 100
feasibility = over-current-capacity
overageQuantity = 20
```

It never silently returns a requested quantity of `80`.

Quantity validation is delegated to 4.4B/4.4A. 4.4C does not invent a second quantity validation formula.

## Feasibility status

Implemented planning classifications:

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

This is an advisory business warning, not a calculation failure. A ready financial projection remains visible and authoritative even when the requested batch is over current capacity.

### Capacity unresolved

Publish:

```text
feasibility = capacity-unresolved
currentAssemblyCapacity = null
overageQuantity = null
```

when Phase 3 does not provide a safe authoritative current capacity or cross-source contradictions make combination unsafe. Nested Phase 3 trace evidence remains available for diagnosis.

## Numeric capacity authority versus trace-label completeness

Phase 3.4C preserves Phase 3.4B numeric capacity evidence even when limiter-name/path tracing is partial. 4.4C therefore distinguishes numeric feasibility authority from complete limiting-resource explanation.

Numeric feasibility may still be determined when:

- `capacityTrace.capacitySynthesis.status === 'ready'`;
- `overallAssemblyCapacity` is finite, non-negative, and an integer;
- Product identity/active-state evidence is consistent;

although `capacityTrace.status === 'partial'` because a limiter label/path could not be resolved.

In that case:

- preserve `within-current-capacity` or `over-current-capacity` as the numeric feasibility result;
- set overall 4.4C readiness to `partial`;
- do not invent or expose a partial limiter subset;
- emit `LIMITING_RESOURCE_EXPLANATION_INCOMPLETE`.

If Phase 3.4B synthesis itself is partial/not-ready, numeric feasibility is `capacity-unresolved`.

## Limiting resources

When the 3.4C trace is fully ready, preserve all typed tied limiting resources exactly as provided:

```text
material-requirement
material-backed-component
product-backed-component
```

4.4C does not select only one limiter, merge resource types, recursively manufacture Product-backed component capacity, recalculate capacity from availability/requirements, or derive a new limiter ranking.

When trace status is partial/not-ready, preserve the nested trace result but publish no top-level authoritative limiter subset. Returned top-level limiter evidence is defensively cloned.

## Warning synthesis

Implemented structured warnings:

```text
OVER_CURRENT_CAPACITY
CAPACITY_UNRESOLVED
LIMITING_RESOURCE_EXPLANATION_INCOMPLETE
```

For `over-current-capacity`, warning text states requested quantity, current capacity, overage quantity, that the full requested batch is not currently feasible, and that the owner may increase availability of tied limiting resources or manually choose a lower requested quantity. It explicitly states that the request was not automatically reduced.

When feasibility cannot be established, `CAPACITY_UNRESOLVED` states that current capacity evidence must be completed/corrected before feasibility can be trusted.

When numeric capacity is authoritative but typed limiter trace is partial, numeric feasibility remains while `LIMITING_RESOURCE_EXPLANATION_INCOMPLETE` warns that exact limiting-resource explanation is incomplete.

## Cross-source consistency guards

4.4C fails closed instead of combining contradictory evidence. Guards include:

- 4.4B Product identity versus 3.4C Product identity;
- Product active-state agreement;
- 3.4C `capacitySynthesis.productId` versus 3.4C top-level `productId`;
- 3.4C synthesis active state versus trace active state;
- ready synthesis must expose finite, non-negative whole `overallAssemblyCapacity`;
- ready trace must have ready synthesis evidence;
- ready trace must expose at least one typed limiter;
- every ready-trace limiter `capacityPieces` must equal authoritative overall capacity;
- derived overage must be finite, non-negative, and whole.

A contradiction forces:

```text
status = not-ready
feasibility = capacity-unresolved
currentAssemblyCapacity = null
overageQuantity = null
limitingResources = []
```

while preserving complete defensively cloned nested financial and capacity-trace evidence.

## Overall readiness model

4.4C exposes:

```text
ready
partial
not-ready
```

Readiness describes confidence/completeness of the joined planning read model and is separate from physical feasibility.

Both of these are valid fully ready outcomes:

```text
ready + within-current-capacity
ready + over-current-capacity
```

Being over capacity is a valid, fully known business condition, not a readiness failure.

`partial` is used when no contradiction exists and at least one required source is partial while useful safe evidence remains. This includes ready financials + partial limiter trace with authoritative numeric capacity, partial financials + ready capacity trace, or ready financials + partial capacity synthesis yielding unresolved capacity while preserving financial projections.

`not-ready` is used when 4.4B is not-ready, Phase 3 trace/synthesis is not-ready, cross-source Product/active-state evidence contradicts, authoritative capacity or overage is invalid/non-finite, or a supposedly ready trace violates the completed Phase 3 contract.

Nested valid evidence is not suppressed merely because the joined result is not-ready.

## Application contract

Implemented names:

```text
PlannedBatchCapacityFeasibilityService
PlannedBatchCapacityFeasibilityResult
PlannedBatchCapacityFeasibilityStatus
CapacityFeasibilityStatus
PlannedBatchCapacityWarning
PlannedBatchCapacityFeasibilityIssue
```

Result shape:

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

No persisted source fields were added for 4.4C. All new values are derived read-model evidence.

## Shared session wiring

`src/application/session.ts` exposes:

```text
plannedBatchCapacityFeasibilityService
  -> expectedBatchFinancialsService
  -> assemblyCapacityTraceService
```

No duplicate repository/service graph is created.

## Test plan and completed coverage

Dedicated service/session coverage includes:

1. within-current-capacity with ready financials/trace;
2. exact-capacity boundary;
3. over-current-capacity with correct overage;
4. zero capacity with positive requested quantity;
5. zero quantity with zero capacity;
6. financial projection remains unchanged/visible when over capacity;
7. all typed tied limiters preserved on a ready trace;
8. cross-category tied limiter preservation;
9. ready numeric capacity + partial limiter trace -> determinate feasibility + partial readiness + incomplete-explanation warning;
10. partial synthesis -> capacity-unresolved;
11. not-ready Phase 3 -> joined not-ready/capacity-unresolved;
12. partial 4.4B + ready capacity -> joined partial with determinate feasibility;
13. not-ready 4.4B + ready capacity -> joined not-ready while safe nested capacity remains;
14. Product identity mismatch fail-closed;
15. active-state mismatch fail-closed;
16. trace/synthesis identity mismatch fail-closed;
17. trace/synthesis active-state mismatch fail-closed;
18. invalid/noninteger/nonfinite authoritative capacity fail-closed;
19. ready trace with no limiting resources fail-closed;
20. ready limiter capacity mismatch fail-closed;
21. invalid derived overage fail-closed;
22. archived Product inspectability;
23. Product-not-found error translation;
24. invalid planned-quantity translation with underlying code;
25. production-requirement error translation;
26. unexpected provider error propagation;
27. defensive cloning of financials/capacity trace/limiters/warnings/issues;
28. canonical Product identity from 4.4B passed to capacity tracing;
29. shared-session wiring uses completed shared 4.4B + 3.4C services.

Final dedicated inventory:

```text
33 PlannedBatchCapacityFeasibilityService tests
1 Phase 4.4C shared-session wiring test
```

## Validation gates and final evidence

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

Implementation record commit:

`f37865be56c582c98f21b9b1107080210744ba93`

Final documented feature head:

`efb0d9f7bd61e9db1ef4464d38a2cfc1d5bdd02c`

Final feature-head CI:

`34960280693 — SUCCESS`

Implementation PR:

`#118 — MERGED`

PR CI:

`34960379820 — SUCCESS`

Implementation merge:

`06f6b8bead020d88e332052583d462126c45b988`

Exact post-merge `develop` CI:

`34960524805 — SUCCESS`

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

All implementation validation gates are satisfied. Documentation closeout is the only remaining administrative gate before the roadmap may advance.

## Completion gate

4.4C implementation satisfies the planned completion requirements:

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
- focused/full tests, typecheck, build, feature-head CI, PR CI, and exact post-merge CI pass.

## Next task after closeout

`4.5A — Product Financial Profile Editor — NEXT / NOT STARTED`

Do not begin Phase 4.5A implementation until this documentation-only closeout is merged, exact final closeout `develop` CI is green, and 4.5A receives its own scope/split assessment and dedicated development plan.
