# Phase 3.6A — Integrated Multi-Component Workflow

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Authoritative implementation base:

`develop` @ `2920cf2deb80f9cc72232f7d572b7fee12ec6a8e`

Feature branch:

`feature/phase-3-6a-integrated-multi-component-workflow`

Development plan:

`docs/PHASE_3_6A_INTEGRATED_MULTI_COMPONENT_WORKFLOW_PLAN.md`

## Delivered integration suite

Added:

`src/application/phase3MultiComponentWorkflow.test.ts`

The suite creates isolated in-memory repositories and real application services matching the Phase 3 dependency graph in `src/application/session.ts`.

No application/domain production source change was required.

The suite validates the five authoritative 3.6A scenarios through real Phase 1/2/3 service composition.

## Scenario A — Purchased vessel candle

Fixture:

```text
Purchased Vessel Candle
├── wax 100 g
├── wick 1 pc
└── Glass Cup ×1 [Material-backed component]
```

Validated:

- Phase 2 direct cost = 21;
- Glass Cup component cost contribution = 20;
- component-aware total cost = 41;
- direct-material capacity = 10;
- Glass Cup component capacity = 6;
- overall assembly capacity = 6;
- final typed limiter is the Glass Cup `material-backed-component`.

This proves count-based Material inventory participates as a discrete component without being flattened into the Phase 2 direct recipe.

## Scenario B — Handmade pot candle

Fixture:

```text
Handmade Pot Candle
├── wax 100 g
├── wick 1 pc
└── Handmade Plaster Pot ×1 [Product-backed component]

Handmade Plaster Pot
└── plaster 200 g
```

Validated:

- child Handmade Pot unit cost = 20 from its own direct recipe;
- parent direct cost = 21;
- parent component-aware total cost = 41;
- explicit Handmade Pot ProductStock = 4 pc;
- parent direct-material capacity = 10;
- Product-backed component capacity = 4;
- overall assembly capacity = 4;
- final typed limiter is the Handmade Pot `product-backed-component`.

The test then changes ProductStock from 4 pc to 0 pc and confirms component-aware cost remains 41.

This proves ProductStock controls current assembly availability/capacity but does not participate in recursive cost mathematics.

## Scenario C — Multi-mold event set

Fixture:

```text
Multi-Mold Event Set
├── Glass Cup ×1
├── Mini Heart ×3
├── Mini Star ×2
└── Mini Flower ×4
```

Stock/capacity:

```text
Glass Cup   = 50 pc -> capacity 50
Mini Heart  = 30 pc -> capacity 10
Mini Star   = 20 pc -> capacity 10
Mini Flower = 40 pc -> capacity 10
```

Child Products each use a real fixed plaster recipe.

Validated:

- component-only parent preserves current 3.3C `partial` cost readiness;
- numeric component subtotal = 24;
- numeric `totalComponentAwareCost = 24` remains available as known partial evidence;
- direct-material dimension is neutral for assembly capacity;
- overall assembly capacity = 10;
- all three tied Product-backed child limiters are preserved:
  - Mini Heart;
  - Mini Star;
  - Mini Flower;
- Glass Cup is correctly excluded from the limiter set because its capacity is 50.

## Scenario D — Nested composition

Fixture:

```text
Gift Set
├── Gift Box Packaging ×1 [direct]
└── Nested Candle ×2
    ├── wax 100 g
    ├── wick 1 pc
    └── Nested Handmade Pot ×1
        └── plaster 200 g
```

Validated recursive cost:

```text
Nested Handmade Pot = 20
Nested Candle direct = 21
Nested Candle component = 20
Nested Candle total = 41
Gift Set direct packaging = 5
Gift Set Candle ×2 contribution = 82
Gift Set total = 87
```

Validated deterministic Product-backed paths:

```text
gift-set -> nested-candle
gift-set -> nested-candle -> nested-pot
```

The recursive breakdown is finite and uses the existing Phase 3.3B path guard.

## Scenario E — Invalid transitive cycle

Persisted valid relationships:

```text
A -> B
B -> C
```

Attempted:

```text
C -> A
```

Validated:

- `ProductComponentService.createComponent(...)` rejects with `ProductCompositionGraphError` code `CYCLE_DETECTED`;
- deterministic cycle path is `a -> b -> c -> a`;
- rejected `C -> A` line is not persisted;
- only the two valid relationships remain.

This proves the cycle is rejected through the normal application write boundary before persistence.

## Scope retained

3.6A introduced no:

- ProductComponent contract changes;
- ProductStock contract changes;
- new cost or capacity formulas;
- production posting/completion workflow;
- reservation/deduction/stock movement logic;
- recursive make-to-order manufacture;
- procurement automation;
- Phase 4 pricing/profit logic;
- Phase 5 Excel persistence;
- new React UI.

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

All five authoritative scenarios passed on the first full implementation run. No production-source defect fix was required.

## Completion gate state

Implementation-side gates passed:

- Scenario A purchased vessel integration passes;
- Scenario B Product-backed vessel integration passes;
- Scenario C tied multi-component limiter integration passes;
- Scenario D nested recursive cost integration passes;
- Scenario E transitive-cycle rejection passes before persistence;
- full Phase 1/2/3 regression suite passes;
- TypeScript typecheck passes;
- production build passes;
- no out-of-scope production behavior was introduced.

Remaining before 3.6A can be marked COMPLETE:

- final documented feature-head CI;
- implementation PR CI;
- merge to `develop`;
- exact post-merge `develop` CI;
- documentation-only closeout;
- advance 3.6B to NEXT / NOT STARTED;
- exact final closeout `develop` CI.

## Next task after closeout

**3.6B — Regression, Build & Phase 3 Completion — NEXT / NOT STARTED**

Do not begin 3.6B until 3.6A is fully merged/closed and a dedicated 3.6B development plan/scope review is established.