# Phase 3.6A — Integrated Multi-Component Workflow Development Plan

## Status

**IN PROGRESS — PLAN ESTABLISHED BEFORE IMPLEMENTATION**

Authoritative base:

`develop` @ `2920cf2deb80f9cc72232f7d572b7fee12ec6a8e`

Feature branch:

`feature/phase-3-6a-integrated-multi-component-workflow`

## Objective

Validate the completed Phase 3 composition, finished-stock, recursive-cost, assembly-capacity, limiter-trace, and cycle-prevention contracts together through deterministic end-to-end application workflows.

3.6A is an integration gate. It is not a new domain model, UI surface, persistence layer, or production-posting workflow.

The authoritative master plan requires at least five scenarios:

1. purchased vessel candle;
2. handmade pot candle;
3. multi-mold event set;
4. nested composition;
5. invalid transitive cycle.

## Authoritative master-plan contract

### Scenario A — Purchased vessel candle

```text
Candle direct recipe + Glass Cup ×1
```

Verify:

- glass inventory/cost integration;
- total cost roll-up;
- parent capacity limited by cup stock when appropriate.

### Scenario B — Handmade pot candle

```text
Candle + Plaster Pot Product ×1
```

Verify:

- child Product cost roll-up;
- child ProductStock capacity;
- parent direct materials and child stock combine correctly.

### Scenario C — Multi-mold event set

```text
Glass Cup ×1
Mini Heart ×3
Mini Star ×2
Mini Flower ×4
```

Verify:

- tied limiting child components;
- component-aware total cost evidence.

### Scenario D — Nested composition

```text
Gift Set > Candle > Handmade Pot
```

Verify:

- recursive cost roll-up;
- deterministic nested path/breakdown;
- cycle-safe traversal.

### Scenario E — Invalid cycle

Verify a proposed relationship that closes a transitive Product composition cycle is rejected before persistence.

## Split assessment

No deeper formal roadmap split is required.

The five scenarios exercise one cohesive integration concern: whether the already-completed Phase 3 contracts work correctly when composed through the real application services.

They should therefore live in one dedicated integration suite with shared deterministic fixtures rather than becoming separate sub-phases.

Internal test slices are:

1. build a fresh real-service/in-memory-repository harness matching `src/application/session.ts`;
2. seed deterministic Materials, Products, fixed recipes, ProductComponents, and ProductStock;
3. validate Scenario A;
4. validate Scenario B;
5. validate Scenario C;
6. validate Scenario D;
7. validate Scenario E;
8. run full Phase 1/2/3 regression, typecheck, and production build;
9. complete the normal PR/merge/closeout lifecycle.

These are test implementation slices only.

## Existing integration-test architecture

Existing application integration tests establish the repository pattern:

- `src/application/phase1MaterialsWorkflow.test.ts`
- `src/application/phase2ProductYieldWorkflow.test.ts`

Those tests instantiate fresh in-memory repositories and real application services rather than mocking derived services.

3.6A should follow the same approach.

The shared session wiring in `src/application/session.ts` confirms the complete Phase 3 service graph:

```text
MaterialRepository
CalibrationRepository
MixPresetRepository
ProductRepository
ProductComponentRepository
ProductStockRepository
YieldSampleRepository
FixedRecipeItemRepository

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

The integration test must instantiate the same real dependency chain using isolated in-memory repositories per test/workflow.

## Expected implementation file

Primary implementation:

`src/application/phase3MultiComponentWorkflow.test.ts`

No application/domain source change is expected.

Implementation record:

`docs/PHASE_3_6A_INTEGRATED_MULTI_COMPONENT_WORKFLOW.md`

If an integration scenario exposes a genuine Phase 3 correctness defect, any production-source fix must be narrowly scoped, documented, and covered by a focused regression test before the 3.6A gate can pass. Test expectations must not be weakened merely to accommodate incorrect behavior.

## Fixture strategy

Use deterministic fixed-only Phase 2 recipes where practical so 3.6A exercises the integration boundary without introducing unrelated yield-history complexity.

This still goes through the real completed Phase 2 services:

```text
FixedRecipeItemService
-> EffectiveRecipeRequirementService
-> RecipeMaterialCostPreviewService
-> ProductionRequirementService
-> ProductionCapacityService
```

Product-backed recursive cost must go through:

```text
ProductBackedComponentCostService
-> ComponentAwareProductCostService
```

Component availability/capacity must go through:

```text
ComponentSourceAvailabilityService
-> ComponentCapacityService
-> AssemblyCapacitySynthesisService
-> AssemblyCapacityTraceService
```

Composition writes and cycle prevention must go through:

`ProductComponentService`

Product-backed current assembly stock must be written through:

`ProductStockService`

## Scenario A fixture — Purchased vessel candle

Recommended deterministic values:

```text
Wax
- base unit g
- package: 1000 g
- package cost: 200
- on hand: 1000 g
- cost: 0.20/g

Wick
- base unit pc
- package: 100 pc
- package cost: 100
- on hand: 100 pc
- cost: 1/pc

Glass Cup
- base unit pc
- package: 10 pc
- package cost: 200
- on hand: 6 pc
- cost: 20/pc

Purchased Vessel Candle direct recipe
- wax 100 g
- wick 1 pc
- safety waste 0

Component
- Glass Cup ×1
```

Expected integration result:

```text
direct cost = 21
component contribution = 20
total component-aware cost = 41

direct-material capacity = 10
glass component capacity = 6
overall assembly capacity = 6
limiting resource = Glass Cup, material-backed-component
```

Assertions should verify source identity, readiness, cost, per-component capacity, final capacity, and typed limiter evidence.

## Scenario B fixture — Handmade pot candle

Recommended deterministic values:

```text
Plaster
- base unit g
- package: 1000 g
- package cost: 100
- enough on hand for direct-capacity not to be the parent limiter
- cost: 0.10/g

Plaster Pot Product direct recipe
- plaster 200 g
- child unit cost = 20

Plaster Pot ProductStock
- 4 pc

Handmade Pot Candle direct recipe
- wax 100 g
- wick 1 pc
- direct cost = 21
- direct capacity = 10

Component
- Plaster Pot Product ×1
```

Expected integration result:

```text
child Product component contribution = 20
parent total component-aware cost = 41
child ProductStock capacity = 4
overall assembly capacity = 4
limiting resource = Plaster Pot, product-backed-component
```

Assertions must prove ProductStock controls current assembly capacity while recursive child Product cost comes from the child Product's recipe rather than ProductStock.

## Scenario C fixture — Multi-mold event set

Use the exact Phase 3 multi-component shape:

```text
Glass Cup ×1
Mini Heart ×3
Mini Star ×2
Mini Flower ×4
```

Recommended current stock:

```text
Glass Cup   = 50 pc -> capacity 50
Mini Heart  = 30 pc -> capacity 10
Mini Star   = 20 pc -> capacity 10
Mini Flower = 40 pc -> capacity 10
```

Give each child Product a simple deterministic fixed direct recipe so recursive child cost is real and numeric.

Example child costs with Plaster at 0.10/g:

```text
Mini Heart 10 g  -> 1.00 each; ×3 -> 3.00
Mini Star  15 g  -> 1.50 each; ×2 -> 3.00
Mini Flower 20 g -> 2.00 each; ×4 -> 8.00
Glass Cup                  ×1 -> 10.00
component subtotal             = 24.00
```

The parent may intentionally remain component-only.

Current 3.3C semantics for a component-only parent are authoritative:

- direct Phase 2 cost has no requirements;
- numeric component cost evidence may still produce `totalComponentAwareCost = 24`;
- overall cost status remains `partial` because the direct-material cost contract is not `ready`.

The integration test must preserve that existing contract rather than silently upgrading it.

Expected capacity result:

```text
overall assembly capacity = 10
limiting resources:
- Mini Heart — product-backed-component
- Mini Star — product-backed-component
- Mini Flower — product-backed-component
```

Glass Cup must not appear as a tied limiter at capacity 50.

## Scenario D fixture — Nested composition

Recommended hierarchy:

```text
Gift Set
├── direct packaging Material ×1
└── Candle Product ×2
    ├── wax 100 g
    ├── wick 1 pc
    └── Handmade Pot Product ×1
        └── plaster 200 g
```

Use deterministic costs such as:

```text
Handmade Pot unit cost = 20
Candle direct cost     = 21
Candle component cost  = 20
Candle total cost      = 41
Gift Set direct package cost = 5
Gift Set Candle ×2 contribution = 82
Gift Set total component-aware cost = 87
```

Assertions should verify:

- top-level cost is ready and equals the recursive expected total;
- root Product-backed line preserves the child Product identity/name and quantity multiplier;
- recursive breakdown contains the nested Handmade Pot line beneath Candle;
- the Product-backed path is deterministic and finite;
- no repository recursion or make-to-order stock logic is introduced by the test.

Capacity is not the primary requirement of Scenario D; recursive cost/traversal correctness is.

## Scenario E fixture — Invalid transitive cycle

Create active Products:

```text
A
B
C
```

Persist valid relationships:

```text
A -> B
B -> C
```

Then attempt:

```text
C -> A
```

Expected result:

- `ProductComponentService.createComponent(...)` rejects with `ProductCompositionGraphError` code `CYCLE_DETECTED`;
- deterministic `cyclePath` is preserved;
- the rejected line is not persisted;
- only the two valid component relationships remain in the repository.

This verifies rejection occurs before persistence through the normal application write boundary.

## Integration assertions beyond scenario-specific values

Where applicable, assert:

- `ready | partial | not-ready` states are the actual authoritative service states;
- missing ProductStock is never silently treated as zero;
- material-backed availability uses normalized Material inventory;
- Product-backed availability uses explicit ProductStock only;
- Phase 2 direct requirements remain separate from Phase 3 component lines;
- all tied limiting resources are preserved;
- typed limiter identity is correct;
- Product-backed assembly capacity does not recursively manufacture missing child stock;
- recursive cost does not use ProductStock quantity in cost mathematics;
- no source records are mutated by derived cost/capacity reads.

## Scope boundaries

3.6A does **not** implement:

- new ProductComponent rules;
- new ProductStock rules;
- a production completion/posting workflow;
- stock reservation;
- automatic Material or ProductStock deduction;
- stock transactions/movement history;
- recursive make-to-order manufacture of missing child Products;
- procurement/reorder automation;
- labor or overhead costing;
- selling price, markup, margin, revenue, or profit;
- Excel persistence/import/export;
- Tauri filesystem integration;
- new React UI.

3.6A validates the contracts already delivered in 3.1 through 3.5.

## Test strategy

Dedicated suite:

`src/application/phase3MultiComponentWorkflow.test.ts`

Minimum dedicated tests:

1. purchased vessel candle integrates Material component cost/inventory and cup-limited capacity;
2. handmade pot candle integrates recursive child Product cost and ProductStock-limited capacity;
3. multi-mold event set preserves three tied Product-backed limiters and numeric component-aware cost evidence;
4. nested Gift Set recursively rolls child cost through Candle -> Handmade Pot with finite deterministic breakdown;
5. proposed transitive cycle is rejected before persistence.

Additional assertions may remain within those tests rather than multiplying cases artificially, because each case is explicitly end-to-end.

## Validation gates

Before implementation PR:

- dedicated 3.6A integration suite passes;
- all existing Phase 1/2/3 tests pass;
- TypeScript typecheck passes;
- production build passes;
- feature branch remains based on the verified 3.5C closeout `develop` history;
- diff is limited to 3.6A integration validation and its documentation unless a genuine defect fix is required.

Then follow the standard lifecycle:

1. feature-head CI;
2. implementation PR to `develop`;
3. independent PR CI;
4. merge with exact expected head SHA;
5. exact post-merge `develop` CI;
6. documentation-only closeout branch/PR;
7. mark 3.6A COMPLETE and advance 3.6B to NEXT / NOT STARTED;
8. exact final closeout `develop` CI.

## Completion gate

3.6A is complete only when all five authoritative scenarios pass through the real application service graph and the implementation/PR/post-merge/closeout CI chain is green.

At completion:

```text
3.6 — Integration & Completion Gate          IN PROGRESS
    3.6A — Integrated Multi-Component Workflow COMPLETE
    3.6B — Regression / Build / Completion     NEXT
```

Phase 3 remains IN PROGRESS until 3.6B completes.

## Next task after closeout

**3.6B — Regression, Build & Phase 3 Completion — NEXT / NOT STARTED**

Do not begin 3.6B until 3.6A is fully merged/closed and a dedicated 3.6B plan/scope review is established.