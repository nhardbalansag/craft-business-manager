# Phase 4.4C — Capacity Feasibility & Warning Synthesis

## Status

**COMPLETE — MERGED — POST-MERGE VALIDATED**

Feature branch:

`feature/phase-4-4c-capacity-feasibility-warning-synthesis`

Authoritative implementation base:

`develop` @ `c2100da3c787784f83b1fc0408cfa05ef9c04327`

Starting base CI:

`34955037015 — SUCCESS`

Development plan:

`docs/PHASE_4_4C_CAPACITY_FEASIBILITY_WARNING_SYNTHESIS_PLAN.md`

## Implementation outcome

Added:

`src/application/production/PlannedBatchCapacityFeasibilityService.ts`

Primary operation:

```text
assessBatch(productId, plannedQuantity)
```

The service joins the completed Phase 4.4B expected-batch financial projection with the completed Phase 3.4C assembly-capacity trace. It does not recompute financials or capacity.

## Authoritative upstream boundaries

The implementation consumes only:

```text
ExpectedBatchFinancialsService-compatible provider
AssemblyCapacityTraceService-compatible provider
```

Call order:

```text
4.4B projectBatch(requestedProductId, Q)
  -> canonical Product identity
  -> 3.4C trace(canonicalProductId)
```

No lower Material inventory, ProductStock, calibration/yield, component-capacity, financial-profile, pricing-policy, unit-cost, or physical-batch repository/service boundary is reopened by 4.4C.

## Result contract

`PlannedBatchCapacityFeasibilityResult` exposes:

```text
productId
productName
productIsActive
status
plannedQuantity
financials
capacityTrace
feasibility
currentAssemblyCapacity
overageQuantity
limitingResources
warnings
issues
```

The complete 4.4B financial result and Phase 3.4C capacity trace are defensively cloned and retained for diagnosis.

## Feasibility contract

Implemented exactly:

```text
within-current-capacity
over-current-capacity
capacity-unresolved
```

### Within current capacity

When numeric current capacity is authoritative and:

```text
plannedQuantity <= currentAssemblyCapacity
```

then:

```text
feasibility = within-current-capacity
overageQuantity = 0
```

This includes `Q = 0` against authoritative zero capacity.

### Over current capacity

When:

```text
plannedQuantity > currentAssemblyCapacity
```

then:

```text
feasibility = over-current-capacity
overageQuantity = plannedQuantity - currentAssemblyCapacity
```

The requested quantity is preserved unchanged. The service never auto-clamps the requested batch to current capacity.

A ready 4.4B financial projection remains visible when the requested batch is over current capacity.

### Capacity unresolved

When no safe authoritative current capacity exists or a cross-source contradiction is detected:

```text
feasibility = capacity-unresolved
currentAssemblyCapacity = null
overageQuantity = null
```

Nested Phase 3 evidence remains available for diagnosis.

## Numeric capacity versus limiter explanation

The implementation preserves the completed Phase 3 distinction between authoritative numeric assembly capacity and complete typed limiter explanation.

When:

```text
capacityTrace.capacitySynthesis.status = ready
```

and the retained/top-level capacity values are valid and consistent, numeric feasibility remains available even if:

```text
capacityTrace.status = partial
```

because limiter labeling/path resolution is incomplete.

In that case:

- `within-current-capacity` or `over-current-capacity` remains available;
- overall 4.4C readiness becomes `partial`;
- no top-level partial limiter subset is published;
- `LIMITING_RESOURCE_EXPLANATION_INCOMPLETE` is emitted.

If the authoritative Phase 3 synthesis itself is partial/not-ready, capacity feasibility remains unresolved.

## Limiting-resource preservation

When Phase 3.4C trace is fully ready, all tied typed resources are retained without selecting a single winner:

```text
material-requirement
material-backed-component
product-backed-component
```

4.4C does not:

- merge limiter resource types;
- rank a new winner;
- recursively manufacture Product-backed sources;
- recalculate capacity from availability evidence;
- expose an incomplete limiter subset when trace readiness is partial/not-ready.

## Structured advisory warnings

Implemented:

```text
OVER_CURRENT_CAPACITY
CAPACITY_UNRESOLVED
LIMITING_RESOURCE_EXPLANATION_INCOMPLETE
```

`OVER_CURRENT_CAPACITY` reports requested quantity, current capacity, overage quantity, and explicitly states that the request was not changed automatically. It directs the caller toward increasing availability of tied limiting resources or manually choosing a lower requested quantity.

Warnings are advisory read-model evidence only. No inventory reservation, deduction, production-order creation, or persistence occurs.

## Cross-source consistency guards

The service fails closed on inconsistent/custom provider evidence, including:

```text
FINANCIAL_CAPACITY_PRODUCT_MISMATCH
PRODUCT_ACTIVE_STATE_MISMATCH
TRACE_SYNTHESIS_PRODUCT_MISMATCH
TRACE_SYNTHESIS_ACTIVE_STATE_MISMATCH
TRACE_SYNTHESIS_STATUS_MISMATCH
TRACE_SYNTHESIS_CAPACITY_MISMATCH
CURRENT_CAPACITY_INVALID
READY_TRACE_LIMITERS_MISSING
LIMITER_CAPACITY_MISMATCH
DERIVED_OVERAGE_INVALID
READY_STATE_INCONSISTENT
```

It also records upstream readiness diagnostics:

```text
FINANCIALS_PARTIAL
FINANCIALS_NOT_READY
CAPACITY_TRACE_PARTIAL
CAPACITY_TRACE_NOT_READY
CAPACITY_SYNTHESIS_PARTIAL
CAPACITY_SYNTHESIS_NOT_READY
```

On contradiction, combined top-level capacity evidence is suppressed:

```text
status = not-ready
feasibility = capacity-unresolved
currentAssemblyCapacity = null
overageQuantity = null
limitingResources = []
```

while nested 4.4B and Phase 3.4C evidence remains retained.

## Readiness semantics

4.4C exposes:

```text
ready
partial
not-ready
```

Readiness is deliberately separate from physical feasibility.

Both are valid ready outcomes:

```text
ready + within-current-capacity
ready + over-current-capacity
```

Being over capacity is a fully known business condition, not a readiness failure.

`partial` preserves safe useful evidence when one upstream source is partial and no contradiction exists.

`not-ready` is used for required upstream not-ready states or unsafe/inconsistent combined evidence.

## Controlled request errors

`PlannedBatchCapacityFeasibilityServiceError` translates completed 4.4B controlled request errors:

```text
PRODUCT_NOT_FOUND
INVALID_PLANNED_QUANTITY
PRODUCTION_REQUIREMENT_INVALID
```

It preserves:

```text
productId
plannedQuantity
underlyingCode when available
```

Unexpected provider/infrastructure errors propagate unchanged.

## Shared session wiring

`src/application/session.ts` exports:

```text
plannedBatchCapacityFeasibilityService
```

wired over the existing shared instances:

```text
expectedBatchFinancialsService
assemblyCapacityTraceService
```

No duplicate repository/service graph is created.

## Validation

Dedicated test files:

```text
src/application/production/PlannedBatchCapacityFeasibilityService.test.ts
src/application/production/PlannedBatchCapacityFeasibilitySession.test.ts
```

Focused 4.4C inventory:

```text
33 service tests
1 shared-session wiring test
```

Coverage includes:

- within, exact-boundary, over, zero-capacity, and zero-quantity feasibility;
- requested quantity preservation/no auto-clamp;
- over-capacity financial projection preservation;
- all three typed limiter identities and cross-category ties;
- authoritative numeric capacity with partial limiter explanation;
- partial/not-ready synthesis propagation;
- partial/not-ready financial propagation;
- Product/active-state/trace/synthesis/capacity consistency guards;
- invalid/nonfinite/noninteger capacity rejection;
- missing/mismatched ready limiters;
- archived Product inspectability;
- controlled request-error translation;
- unexpected provider-error propagation;
- canonical Product identity handoff;
- defensive cloning;
- shared-session wiring.

## CI and merge evidence

Initial focused-test head:

`7d7e645700526644a84f641e70c49b04a286f92f`

Initial focused-test CI:

`34959784315 — FAILURE`

The failure occurred during TypeScript typecheck before tests executed and contained two strict-typing defects only:

1. the limiter clone helper attempted to assign a cloned `readonly LimitingResource[]` to a mutable result array;
2. a test fixture widened the literal `false` for `observedDefectRateIncluded` to `boolean` instead of preserving the source contract's literal `false` type.

No financial, feasibility, capacity, warning, or readiness behavior was weakened to resolve these issues.

Corrected validated feature checkpoint:

`aa294854e55289343683776d0607cc0ada2675d3`

Corrected CI:

`34960081875 — SUCCESS`

Implementation record commit:

`f37865be56c582c98f21b9b1107080210744ba93`

Final documented feature head:

`efb0d9f7bd61e9db1ef4464d38a2cfc1d5bdd02c`

Final feature-head CI:

`34960280693 — SUCCESS`

Implementation PR:

`#118 — Phase 4.4C — Capacity Feasibility & Warning Synthesis`

PR CI:

`34960379820 — SUCCESS`

Guarded implementation merge:

`06f6b8bead020d88e332052583d462126c45b988`

Exact post-merge `develop` CI:

`34960524805 — SUCCESS`

Validated repository state:

```text
TypeScript typecheck passed
77 test files passed
941 tests passed
33 dedicated 4.4C service tests passed
1 dedicated 4.4C session test passed
production Vite build passed
109 modules transformed
```

## Completion state

All Phase 4.4C implementation completion gates are satisfied:

- requested quantity remains explicit and is never auto-clamped;
- current capacity is consumed from completed Phase 3 rather than recomputed;
- within/over/unresolved feasibility is deterministic;
- overage is correct and fail-closed;
- over-capacity financial projections remain visible;
- all authoritative tied limiters are preserved;
- partial limiter tracing does not leak a misleading subset;
- actionable structured warnings are exposed;
- cross-source contradictions fail closed;
- nested 4.4B/3.4C evidence is defensively preserved;
- shared-session wiring exists;
- no inventory/source mutation or derived persistence was added;
- focused/full tests, typecheck, build, feature-head CI, PR CI, and exact post-merge `develop` CI pass.

The documentation-only closeout branch records this completion and advances the roadmap without starting Phase 4.5 implementation.

## Next task

`4.5A — Product Financial Profile Editor — NEXT / NOT STARTED`

Do not begin Phase 4.5A implementation until its own scope/split assessment and dedicated development plan are established after this documentation closeout is merged and the exact final closeout `develop` CI is green.
