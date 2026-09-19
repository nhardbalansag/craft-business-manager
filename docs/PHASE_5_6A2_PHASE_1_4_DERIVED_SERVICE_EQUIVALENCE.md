# Phase 5.6A2 — Phase 1–4 Derived Service Equivalence

## Status

**COMPLETE**

Parent phase:

```text
5.6A — Integrated Excel Round-Trip Workflow — IN PROGRESS
```

Next exact task:

```text
5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate — NEXT / NOT STARTED
```

Do not begin 5.6A3 until this closeout is merged into `develop`, the exact resulting `develop` CI is green, and the user separately says to proceed.

---

## Objective

Prove that canonical XLSX persistence preserves the **business meaning** consumed by the existing Phase 1–4 application services, not only the persisted source rows.

The completed integration path is:

```text
stable singleton source repositories/services
-> derive Phase 1–4 business results
-> PersistenceCoordinator.exportCurrentWorkbook()
-> real XLSX bytes
-> clear all live authoritative source state
-> PersistenceCoordinator.importAndApplyWorkbook(bytes)
-> validated atomic hydration
-> invoke the same already-wired service objects
-> compare business-semantic results
```

No derived costing, yield, capacity, pricing, or production result is persisted as source truth.

---

## Master-plan scenarios completed

```text
B — Calibration-dependent material                    COMPLETE
C — Yield + recipe Product                            COMPLETE
D — Nested components and ProductStock                COMPLETE
F — Phase 4 pricing / production equivalence          COMPLETE
```

Implementation test:

`src/application/persistence/Phase56A2DerivedServiceEquivalence.test.ts`

The implementation is tests-only. No runtime/domain/schema/coordinator/transport/UI/native-filesystem behavior changed.

---

## Scenario B — Calibration-dependent material — COMPLETE

The representative source fixture persists a plaster material whose authoritative purchase and on-hand unit is `cup` while its base unit is `g`.

Two real calibration samples are persisted:

```text
cal-plaster-old  -> 200 g/cup
cal-plaster-new  -> 210 g/cup
```

The normal `CalibrationService` selects `cal-plaster-new` as the effective evidence.

The normal requirement and material-cost paths prove before and after XLSX hydration:

- effective calibration identity remains `cal-plaster-new`;
- effective conversion remains `210 g/cup`;
- a fixed recipe input of `0.5 cup` remains `105 g` canonical requirement;
- package conversion source remains `calibration`;
- costing calibration ID remains `cal-plaster-new`;
- one purchased cup remains `210 g` package base quantity;
- cost per base gram remains `0.4`;
- material cost per product remains `42`.

The test does not manually reproduce conversion/cost formulas. It consumes the existing calibration, effective-requirement, and material-cost-preview application services.

---

## Scenario C — Yield + recipe Product — COMPLETE

The representative child Product persists and reloads:

- a real mix preset;
- yield sample evidence;
- normalized yield sample material inputs;
- a fixed recipe line.

The existing service graph proves equivalent pre/post-hydration behavior for:

- `EffectiveRecipeRequirementService`;
- `RecipeMaterialCostPreviewService`.

Representative semantics remain:

```text
mat-wax   50 g / Product   source = yield
mat-wick   1 pc / Product  source = fixed
```

The same effective yield sample remains selected and the same ready material-cost preview is produced after the real XLSX round-trip.

---

## Scenario D — Nested components + ProductStock — COMPLETE

The representative parent Product contains an acyclic component graph with both source kinds:

- Material-backed component: `mat-box`;
- Product-backed component: `product-child`, quantity `2` per parent.

Explicit ProductStock is persisted for the child Product:

```text
product-child -> 10 pc
```

Before and after hydration, the same existing services prove equivalent:

- parent component relationships;
- Material-backed source availability (`20 pc`);
- Product-backed source availability (`10 pc`);
- explicit ProductStock evidence;
- recursive Product-backed component cost;
- parent fully loaded unit cost;
- non-zero Material-component and Product-component cost subtotals.

This proves XLSX persistence retains both component topology and the ProductStock availability semantics consumed by Phase 3/4 services.

---

## Scenario F — Phase 4 pricing / production equivalence — COMPLETE

For `product-parent`, the integration suite captures the normal Phase 4 outputs before persistence, performs a real XLSX export -> clear -> import/hydrate cycle, then invokes the same services again.

Compared services/results:

- `FullyLoadedProductUnitCostService.costProduct(...)`;
- `ProductPricingQuoteService.quoteProduct(...)`;
- `PhysicalPlannedBatchProductionCostService.costPlannedBatch(...)`;
- `ExpectedBatchFinancialsService.projectBatch(...)`;
- `AssemblyCapacityTraceService.trace(...)`;
- `PlannedBatchCapacityFeasibilityService.assessBatch(...)`.

For requested batch quantity `6`, the derived meaning remains unchanged:

```text
current assembly capacity  5
limiting resource          Product-backed product-child
requested quantity         6
feasibility                over-current-capacity
overage                    1
```

Pricing, unit cost, physical batch cost, expected financials, capacity trace, limiting-resource evidence, and feasibility results are equal before vs. after hydration.

No derived result is written into the workbook as authoritative source data.

---

## Stable service graph proof

The A2 suite uses the live singleton graph from `src/application/session.ts`.

Representative service identities are captured before persistence and the same objects remain wired after hydration, including:

- calibration;
- effective recipe requirement;
- material cost preview;
- component availability;
- recursive and fully loaded Product costing;
- pricing quote;
- physical production cost;
- expected batch financials;
- assembly capacity trace;
- planned-batch capacity feasibility.

The result therefore demonstrates that atomic source replacement is sufficient for the existing application graph to recalculate equivalent business behavior; service reconstruction is not required.

---

## Implementation evidence

Authoritative baseline:

```text
develop  f1d403bc6b8fe5196d8837ed790a3959aae01466
CI       35140571447 — SUCCESS
```

Feature branch:

```text
feature/phase-5-6a2-derived-service-equivalence
```

Feature head:

```text
1dfef553a4741de760321ebd936a90cc43dec1e1
```

Feature CI:

```text
35141355473 — SUCCESS
```

Implementation PR:

```text
#213 — Implement Phase 5.6A2 derived service equivalence — MERGED
```

PR CI:

```text
35141515815 — SUCCESS
```

Implementation merge:

```text
3555a8e02dc4fafe5c3a32e6ecccd3ab7f88eab5
```

Post-implementation `develop` CI:

```text
35141650499 — SUCCESS
```

Validation gate:

```text
130 test files passed
1434 tests passed
4 focused A2 integration tests passed
Typecheck PASS
Production build PASS
149 modules transformed
```

Effective implementation diff:

```text
1 commit ahead / 0 behind
1 test file added
455 additions / 0 deletions
no production application changes
```

---

## Completion decision

Phase 5.6A2 satisfies its planned completion gate:

1. Scenario B proves calibration-dependent conversion/costing equivalence through real XLSX persistence.
2. Scenario C proves yield + fixed-recipe requirement/cost-preview equivalence.
3. Scenario D proves nested Material/Product component relationships, ProductStock availability, and recursive cost equivalence.
4. Scenario F proves Phase 4 costing, pricing, physical production, expected financials, capacity trace, bottleneck meaning, and feasibility equivalence.
5. Real `SheetJsWorkbookCodec` XLSX bytes cross the production persistence boundary.
6. Live authoritative state is explicitly cleared before import so stale state cannot satisfy the assertions.
7. The same stable session service graph is reused after hydration.
8. All prior regression suites, typecheck, and production build remain green.
9. No derived output is persisted as authoritative source truth.
10. No Phase 6 native-filesystem scope and no 5.6A3 behavior were introduced.

Therefore:

```text
5.6A2 — Phase 1–4 Derived Service Equivalence — COMPLETE
```

The parent remains:

```text
5.6A — Integrated Excel Round-Trip Workflow — IN PROGRESS
```

and the next exact task is:

```text
5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate — NEXT / NOT STARTED
```
