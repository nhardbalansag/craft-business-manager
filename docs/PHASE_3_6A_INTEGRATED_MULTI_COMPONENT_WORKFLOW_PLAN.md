# Phase 3.6A — Integrated Multi-Component Workflow Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `2920cf2deb80f9cc72232f7d572b7fee12ec6a8e`

Feature branch:

`feature/phase-3-6a-integrated-multi-component-workflow`

Implementation record:

`docs/PHASE_3_6A_INTEGRATED_MULTI_COMPONENT_WORKFLOW.md`

## Objective

Validate the completed Phase 3 composition, finished-stock, recursive-cost, assembly-capacity, limiter-trace, and cycle-prevention contracts together through deterministic end-to-end application workflows.

3.6A is an integration gate only. It introduces no new domain model, UI, persistence layer, production-posting workflow, or cost/capacity formula.

## Authoritative scenarios

The master plan requires five integrated scenarios:

1. **Purchased vessel candle** — direct candle recipe plus `Glass Cup ×1`; verify Material component cost/inventory integration and cup-limited capacity.
2. **Handmade pot candle** — direct candle recipe plus `Plaster Pot Product ×1`; verify recursive child Product cost, ProductStock capacity, and direct/component synthesis.
3. **Multi-mold event set** — `Glass Cup ×1`, `Mini Heart ×3`, `Mini Star ×2`, `Mini Flower ×4`; verify tied child limiters and total cost evidence.
4. **Nested composition** — `Gift Set > Candle > Handmade Pot`; verify recursive cost and finite cycle-safe traversal.
5. **Invalid cycle** — verify a relationship closing a transitive cycle is rejected before persistence.

## Split assessment

No deeper roadmap split was required.

All five scenarios validate one cohesive concern: whether the already-completed Phase 3 contracts operate correctly when composed through the real application service graph.

They are implemented in one dedicated integration suite using shared deterministic fixtures.

## Integration architecture

Added:

`src/application/phase3MultiComponentWorkflow.test.ts`

The suite follows the existing integration-test pattern from:

- `src/application/phase1MaterialsWorkflow.test.ts`
- `src/application/phase2ProductYieldWorkflow.test.ts`

Each test builds fresh in-memory repositories and the real services matching `src/application/session.ts`, including:

```text
ProductComponentService
ProductStockService
ComponentSourceAvailabilityService
ComponentCapacityService
MaterialBackedComponentCostService
ProductBackedComponentCostService
ComponentAwareProductCostService
ProductionRequirementService
ProductionCapacityService
AssemblyCapacitySynthesisService
AssemblyCapacityTraceService
```

Fixed-only Phase 2 recipes are used where practical so 3.6A validates integration without unrelated yield-history setup while still traversing the real completed Phase 2 requirement, costing, and capacity services.

No production source change was required.

## Scenario A — Purchased vessel candle

Fixture:

```text
Wax:       1000 g on hand, 0.20/g
Wick:      100 pc on hand, 1/pc
Glass Cup: 6 pc on hand, 20/pc

Purchased Vessel Candle
├── wax 100 g
├── wick 1 pc
└── Glass Cup ×1
```

Validated:

```text
direct cost = 21
Glass Cup contribution = 20
total component-aware cost = 41

direct capacity = 10
Glass Cup capacity = 6
overall assembly capacity = 6
limiter type = material-backed-component
```

## Scenario B — Handmade pot candle

Fixture:

```text
Handmade Plaster Pot
└── plaster 200 g = 20 cost
ProductStock = 4 pc

Handmade Pot Candle
├── wax 100 g
├── wick 1 pc
└── Handmade Plaster Pot ×1
```

Validated:

```text
parent direct cost = 21
child Product contribution = 20
parent total cost = 41
parent direct capacity = 10
child ProductStock capacity = 4
overall assembly capacity = 4
limiter type = product-backed-component
```

The test then changes child ProductStock to `0 pc` and confirms Product cost remains `41`, proving ProductStock controls assembly availability/capacity but not recursive cost mathematics.

## Scenario C — Multi-mold event set

Fixture:

```text
Glass Cup ×1      50 pc -> capacity 50
Mini Heart ×3     30 pc -> capacity 10
Mini Star ×2      20 pc -> capacity 10
Mini Flower ×4    40 pc -> capacity 10
```

Child Products use deterministic plaster recipes.

Validated:

```text
component subtotal = 24
totalComponentAwareCost = 24
cost status = partial
```

The `partial` status is the existing authoritative 3.3C behavior for a component-only parent whose direct Phase 2 cost has `NO_REQUIREMENTS`; 3.6A preserves rather than rewrites that contract.

Capacity validation:

```text
direct-material dimension = neutral
overall assembly capacity = 10
three tied limiters:
- Mini Heart
- Mini Star
- Mini Flower
```

All three are typed `product-backed-component`. Glass Cup is not a limiter at capacity 50.

## Scenario D — Nested composition

Fixture:

```text
Gift Set
├── direct Gift Box Packaging ×1
└── Nested Candle ×2
    ├── wax 100 g
    ├── wick 1 pc
    └── Nested Handmade Pot ×1
        └── plaster 200 g
```

Validated recursive totals:

```text
Nested Handmade Pot = 20
Nested Candle direct = 21
Nested Candle component = 20
Nested Candle total = 41
Gift Set direct packaging = 5
Gift Set Candle ×2 contribution = 82
Gift Set total = 87
```

Validated paths:

```text
gift-set -> nested-candle
gift-set -> nested-candle -> nested-pot
```

Traversal is finite and uses the existing Phase 3.3B cycle/path guard.

## Scenario E — Invalid transitive cycle

Persisted:

```text
A -> B
B -> C
```

Rejected:

```text
C -> A
```

Validated:

- error code `CYCLE_DETECTED`;
- cycle path `a -> b -> c -> a`;
- rejected line is not persisted;
- only the two valid lines remain.

## Scope retained

3.6A does not introduce:

- new ProductComponent or ProductStock rules;
- production completion/posting;
- stock reservation/deduction/transactions;
- recursive make-to-order manufacture;
- procurement automation;
- labor/overhead/selling price/markup/margin/profit;
- Excel persistence;
- Tauri integration;
- new React UI.

## Tests

Dedicated suite:

`src/application/phase3MultiComponentWorkflow.test.ts`

Dedicated tests: **5**.

All five authoritative scenarios passed on the first full implementation run.

## Validation evidence

Implementation head:

`c3e6f2af4a1171c7cad95682caf4d75d02624a24`

CI:

```text
34929198360 — SUCCESS
55 test files passed
628 tests passed
5 dedicated Phase 3.6A integration tests
7 React smoke tests
TypeScript typecheck passed
production build passed
```

No Phase 3 correctness defect or production-source fix was required.

## Merge/closeout gates remaining

Before 3.6A is marked COMPLETE:

- final documented feature-head CI must pass;
- implementation PR must pass independent PR CI;
- implementation PR must merge to `develop`;
- exact post-merge `develop` CI must pass;
- documentation-only closeout must mark 3.6A COMPLETE;
- tracker must advance 3.6B to NEXT / NOT STARTED;
- exact final closeout `develop` CI must pass.

## Next task after closeout

**3.6B — Regression, Build & Phase 3 Completion — NEXT / NOT STARTED**

Do not begin 3.6B until 3.6A is fully merged/closed and a dedicated 3.6B development plan/scope review is established.