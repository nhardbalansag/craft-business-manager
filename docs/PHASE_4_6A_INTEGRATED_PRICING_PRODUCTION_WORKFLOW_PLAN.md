# Phase 4.6A — Integrated Pricing / Production Workflow Plan

Status: **PLANNED — IMPLEMENTATION NOT STARTED**

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

Implementation should therefore remain one Phase 4.6A feature branch with one dedicated integration workflow test module and ordinary internal commits/checkpoints.

## 2. Goal

Prove that the completed Phase 4 services work together through **real service instances backed by isolated in-memory repositories**, without using the shared singleton session as the test fixture and without mocking authoritative business mathematics.

The integration suite must exercise the actual dependency chain:

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

Expected production-code changes: **none**.

Primary implementation file:

`src/application/phase4PricingProductionWorkflow.test.ts`

The test module will construct its own complete in-memory workflow graph for each scenario or scenario group.

If the integration suite exposes a real defect in completed Phase 4 production code, fix only the smallest proven defect, document the reason, and add regression coverage. Do not broaden 4.6A into feature development.

## 4. Isolated workflow fixture

The local test workflow will instantiate fresh repositories for:

- Materials;
- Calibrations;
- Mix Presets;
- Products;
- Product Components;
- Product Stock;
- Product Financial Profiles;
- Yield Samples;
- Fixed Recipe Items.

It will wire the same real application-service graph used by the shared session, including:

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

## 5. Required scenarios

### Scenario A — Paintable art with fixed profit

Validate a paintable-art Product using real recipe/yield evidence plus a fixed recipe input.

Required assertions:

- learned and/or fixed material requirement evidence reaches authoritative cost;
- base direct-material cost is visible;
- safety-waste reserve is separately visible and included exactly once;
- labor and overhead are added explicitly;
- fixed PHP profit policy is preserved;
- selling price equals fully loaded unit cost plus configured profit;
- profit-per-unit and price reconciliation are exact within numeric tolerance.

### Scenario B — Purchased-vessel candle with markup

Validate a candle with direct wax/fragrance-style material requirements plus a Material-backed purchased vessel component.

Required assertions:

- parent direct-material safety reserve applies to direct parent-making requirements;
- purchased vessel quantity/cost is **not** inflated by parent safety waste;
- purchased component contribution appears separately from direct materials;
- labor and overhead are included exactly once;
- markup-based selling price is authoritative;
- profit, effective markup, and effective margin reconcile to the completed pricing services.

### Scenario C — Handmade-pot candle with target margin

Validate a Product-backed handmade vessel child used by a parent candle.

Required assertions:

- child fully loaded cost includes child direct-material safety reserve, child labor, and child overhead;
- child pricing policy / selling price / profit do not roll into parent production cost;
- parent labor and parent overhead are added exactly once;
- target-margin selling price is correct;
- recursive path/evidence remains finite and deterministic.

### Scenario D — Multi-component event set

Validate a parent Product with multiple discrete component quantities and at least tied limiting component resources.

Required assertions:

- multiple component quantities scale correctly;
- nested Product-backed component costs remain fully loaded;
- parent price/profit is authoritative;
- tied component capacity limiters are all retained rather than collapsed to one winner;
- limiter resource types and identities are preserved.

### Scenario E — Physical batch rounding changes profit

Use an indivisible direct `pc` requirement whose final requested batch quantity rounds upward.

Required assertions:

- standard unit economics retain the precise per-unit planned quantity;
- physical batch direct requirement uses final-batch count rounding;
- authoritative physical planned batch cost differs from naïve `standardUnitCost × Q` when rounding requires it;
- expected batch profit uses the physical planned production cost;
- physical-vs-standard and/or physical-vs-unit-profit diagnostics expose the difference.

### Scenario F — Capacity warning without auto-clamp

Request more finished pieces than current authoritative assembly capacity.

Required assertions:

- requested quantity remains unchanged;
- financial projection remains available when its own evidence is ready;
- feasibility is `over-current-capacity`;
- overage is exact;
- all tied authoritative limiting resources remain visible;
- warning structure is published;
- no stock reservation, deduction, or requested-quantity mutation occurs.

### Scenario G — Fail-closed readiness

Validate at least these source/readiness states:

1. missing financial profile;
2. explicit zero labor/overhead profile;
3. missing pricing policy;
4. invalid target margin rejected by the write/domain boundary;
5. unresolved nested child cost propagates upward and blocks authoritative downstream pricing.

Required semantics:

- missing evidence never becomes fake zero;
- explicit zero remains known zero;
- unconfigured pricing can leave authoritative cost visible while price/profit stay unresolved;
- invalid margin is rejected rather than sanitized;
- unresolved nested Product cost remains traceable and prevents a misleading ready parent quote.

## 6. Numeric assertion strategy

Use deliberately simple fixture costs where practical so expected values can be asserted directly.

Rules:

- use `toBeCloseTo(...)` for floating-point financial calculations;
- assert exact status/issue/warning/resource codes and exact requested quantities where appropriate;
- never duplicate a full production formula inside a helper merely to reproduce service output;
- hand-computed fixture expectations should remain small and transparent;
- do not round service values for assertions except where presentation is explicitly under test (presentation is not the purpose of 4.6A).

## 7. Regression protections

The integration suite must specifically protect these already locked Phase 4 decisions:

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

## 8. Validation gates

Before PR:

1. strict TypeScript typecheck passes;
2. dedicated Phase 4.6A integration tests pass;
3. full repository test suite passes;
4. production Vite build passes;
5. no unrelated production behavior changes;
6. implementation record documents exact scenario coverage and CI evidence.

PR/merge gates:

1. compare branch against the exact starting `develop` baseline;
2. implementation PR targets `develop`;
3. PR CI must complete successfully on the exact expected head;
4. merge guarded by expected head SHA;
5. exact post-merge `develop` CI must be successful.

Closeout gates:

1. documentation-only closeout branch starts from the exact implementation merge;
2. record/plan/progress tracker are reconciled without erasing historical evidence;
3. closeout PR CI passes;
4. guarded closeout merge completes;
5. exact final `develop` CI passes;
6. tracker is re-read from exact final `develop`.

## 9. Phase boundary

4.6A does **not** itself complete Phase 4.

After successful 4.6A closeout, roadmap state should be:

```text
4.6 — Integration & Completion Gate                       IN PROGRESS
    4.6A — Integrated Pricing / Production Workflow       COMPLETE
    4.6B — Regression / Build / Completion                NEXT
```

No 4.6B implementation or final Phase 4 completion declaration belongs in this task.
