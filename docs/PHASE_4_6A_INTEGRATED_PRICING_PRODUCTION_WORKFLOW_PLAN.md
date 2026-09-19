# Phase 4.6A — Integrated Pricing / Production Workflow Plan

Status: **COMPLETE — IMPLEMENTED, MERGED, AND POST-MERGE VALIDATED**

Repository: `nhardbalansag/craft-business-manager`

Integration branch: `develop`

Verified starting `develop`:

`f74579ce155a2462c1edb8ba9478536fae9fa3ef`

Verified starting CI:

`34969616141 — SUCCESS`

Feature branch:

`feature/phase-4-6a-integrated-pricing-production-workflow`

Authoritative scope:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## 1. Scope assessment

Phase 4.6A does **not** need another numbered roadmap split.

The authoritative task is one cohesive integration-validation gate over the already completed Phase 4 source, cost, pricing, batch-financial, capacity, and UI-supporting application boundaries. The required A–G scenarios are internal checkpoints of the same integration test matrix rather than separately deployable capabilities.

Creating 4.6A.1 / 4.6A.2 sub-phases would add administrative fragmentation without creating a safer architectural boundary.

Implementation therefore remained one Phase 4.6A feature branch with one dedicated integration workflow test module and ordinary internal checkpoints.

## 2. Goal

Prove that the completed Phase 4 services work together through **real service instances backed by isolated in-memory repositories**, without using the shared singleton session as the test fixture and without mocking authoritative business mathematics.

The integration suite exercised the actual dependency chain:

```text
Product / Material / Recipe / Yield / Component / Stock source records
        ↓
Effective requirements + direct material costing
        ↓
Waste-adjusted direct-material unit cost
        ↓
Recursive Product-backed component fully loaded cost
        ↓
Fully loaded root Product unit cost
        ↓
Selling price + profit/markup/margin
        ↓
Product pricing quote
        ↓
Physical planned batch production cost
        ↓
Expected batch financials
        ↓
Assembly capacity trace
        ↓
Planned-batch capacity feasibility / warnings
```

## 3. Implementation boundary

Production-code changes: **none**.

Implementation file:

`src/application/phase4PricingProductionWorkflow.test.ts`

The test module constructs its own complete in-memory workflow graph for each scenario.

The integration suite exposed no production defect requiring correction.

## 4. Isolated workflow fixture

The local test workflow instantiates fresh repositories for:

- Materials;
- Calibrations;
- Mix Presets;
- Products;
- Product Components;
- Product Stock;
- Product Financial Profiles;
- Yield Samples;
- Fixed Recipe Items.

It wires the same real application-service graph used by the shared session, including:

- `MaterialService`;
- `ProductService`;
- `ProductComponentService`;
- `ProductStockService`;
- `ProductFinancialProfileService`;
- `YieldSampleEvidenceService`;
- `YieldHistoryService`;
- `FixedRecipeItemService`;
- `EffectiveRecipeRequirementService`;
- `RecipeMaterialCostPreviewService`;
- `WasteAdjustedDirectMaterialCostService`;
- `MaterialBackedComponentCostService`;
- `RecursiveFullyLoadedProductComponentCostService`;
- `FullyLoadedProductUnitCostService`;
- `SellingPriceDerivationService`;
- `ProfitMarkupMarginMetricsService`;
- `ProductPricingQuoteService`;
- `PhysicalPlannedBatchProductionCostService`;
- `ExpectedBatchFinancialsService`;
- `ProductionRequirementService`;
- `ProductionCapacityService`;
- `ComponentSourceAvailabilityService`;
- `ComponentCapacityService`;
- `AssemblyCapacitySynthesisService`;
- `AssemblyCapacityTraceService`;
- `PlannedBatchCapacityFeasibilityService`.

Every test starts from fresh isolated in-memory state so scenario data cannot leak across cases.

## 5. Required scenarios — completion result

### Scenario A — Paintable art with fixed profit — PASS

Validated:

- learned and fixed material requirement evidence reaches authoritative cost;
- base direct-material cost is visible;
- safety-waste reserve is separately visible and included exactly once;
- labor and overhead are added explicitly;
- fixed PHP profit policy is preserved;
- selling price equals fully loaded unit cost plus configured profit;
- profit-per-unit and price reconciliation are exact within numeric tolerance.

### Scenario B — Purchased-vessel candle with markup — PASS

Validated:

- parent direct-material safety reserve applies to direct parent-making requirements;
- purchased vessel quantity/cost is not inflated by parent safety waste;
- purchased component contribution appears separately from direct materials;
- labor and overhead are included exactly once;
- markup-based selling price is authoritative;
- profit, effective markup, and effective margin reconcile to completed pricing services.

### Scenario C — Handmade-pot candle with target margin — PASS

Validated:

- child fully loaded cost includes child direct-material safety reserve, child labor, and child overhead;
- child pricing policy / selling price / profit do not roll into parent production cost;
- parent labor and parent overhead are added exactly once;
- target-margin selling price is correct;
- recursive path/evidence is finite and deterministic.

### Scenario D — Multi-component event set — PASS

Validated:

- multiple component quantities scale correctly;
- nested Product-backed component costs remain fully loaded;
- parent price/profit is authoritative;
- tied component capacity limiters are all retained rather than collapsed to one winner;
- limiter resource types and identities are preserved.

### Scenario E — Physical batch rounding changes profit — PASS

Validated:

- standard unit economics retain precise per-unit planned quantity;
- physical batch direct requirement uses final-batch count rounding;
- physical planned batch cost differs from `standardUnitCost × Q` when rounding requires it;
- expected batch profit uses physical planned production cost;
- physical-vs-standard and physical-vs-unit-profit diagnostics expose the difference.

### Scenario F — Capacity warning without auto-clamp — PASS

Validated:

- requested quantity remains unchanged;
- financial projection remains available when its own evidence is ready;
- feasibility is `over-current-capacity`;
- overage is exact;
- all tied authoritative limiting resources remain visible;
- warning structure is published;
- no stock reservation, deduction, or requested-quantity mutation occurs.

### Scenario G — Fail-closed readiness — PASS

Validated:

1. missing financial profile;
2. explicit zero labor/overhead profile;
3. missing pricing policy;
4. invalid target margin rejected by the write/domain boundary;
5. unresolved nested child cost propagates upward and blocks authoritative downstream pricing.

Confirmed semantics:

- missing evidence never becomes fake zero;
- explicit zero remains known zero;
- unconfigured pricing leaves authoritative cost visible while price/profit stay unresolved;
- invalid margin is rejected rather than sanitized;
- unresolved nested Product cost remains traceable and prevents misleading ready parent pricing.

## 6. Numeric assertion strategy

The completed suite uses deliberately simple fixture costs where practical so expected values are directly inspectable.

Rules retained:

- `toBeCloseTo(...)` for floating-point financial calculations;
- exact status/issue/warning/resource codes and exact requested quantities where appropriate;
- no duplicated production formula helper used merely to reproduce service output;
- small and transparent hand-computed fixture expectations;
- no presentation rounding in service-level assertions.

## 7. Regression protections proven

The suite now protects these locked Phase 4 decisions:

- parent safety waste never inflates discrete component counts;
- Product-backed child retail price/profit never enters parent cost;
- standard unit cost and physical planned batch cost remain distinct concepts;
- physical batch profit uses physical planned production cost;
- missing financial profile differs from explicit zero labor/overhead;
- unconfigured pricing policy does not invent a selling price;
- target margin validation remains fail-closed;
- capacity feasibility never silently clamps the request;
- every tied limiter remains visible when authoritative;
- derived prices/costs/profits are not persisted as source data.

## 8. Final validation evidence

```text
Starting develop                       f74579ce155a2462c1edb8ba9478536fae9fa3ef
Starting develop CI                    34969616141 — SUCCESS
Plan-before-code commit                365ab7233694b3aa31047bf9de40f3bc53efe8d1
Validated implementation head          094fe4a631cb3ed8478798f8cc1bad0b93c39e72
Implementation CI                      34974785642 — SUCCESS
Documented feature head                5d162a3f17abb14b1a7369d7cb102ca0f2c16db2
Documented feature-head CI             34974955372 — SUCCESS
PR #126                                MERGED
PR CI                                  34975093313 — SUCCESS
Implementation merge                   89e2f458be8e787dfe1f864d9dd9a998436ea0a5
Post-merge develop CI                  34975300493 — SUCCESS
81 test files / 986 tests
7 Phase 4.6A integration tests
8 React workspace smoke tests
TypeScript typecheck passed
production Vite build passed
117 modules transformed
```

All implementation, PR, merge, and exact post-merge validation gates passed.

## 9. Phase boundary

4.6A does **not** itself complete Phase 4.

After the 4.6A documentation closeout is merged and exact final `develop` CI is green, roadmap state is:

```text
4.6 — Integration & Completion Gate                       IN PROGRESS
    4.6A — Integrated Pricing / Production Workflow       COMPLETE
    4.6B — Regression / Build / Completion                NEXT
```

No 4.6B implementation or final Phase 4 completion declaration is included in 4.6A.

The next task must begin with its own scope/split assessment and dedicated development plan before any 4.6B implementation.
