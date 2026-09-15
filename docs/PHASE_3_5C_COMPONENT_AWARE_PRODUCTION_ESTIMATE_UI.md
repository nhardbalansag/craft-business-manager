# Phase 3.5C — Component-Aware Production Estimate UI

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-5c-component-aware-production-ui`

Authoritative implementation base:

`develop` @ `0a0a93e5b2d241e05575c1414200aa55a1636542`

Development plan:

`docs/PHASE_3_5C_COMPONENT_AWARE_PRODUCTION_ESTIMATE_UI_PLAN.md`

## Implementation summary

Phase 3.5C upgrades the existing Production workspace from a Phase 2 direct-material-only estimate into the Phase 3 component-aware current assembly estimate.

The UI now integrates the already-completed authoritative application services rather than creating a new calculation engine:

```text
ProductionRequirementService
-> parent direct-material batch quantities + safety waste

ComponentAwareProductCostService
-> direct + recursive component input cost/readiness

AssemblyCapacityTraceService
-> direct + component assembly capacity + every typed limiter
```

No domain or application service was changed for 3.5C.

## Production data loading

Updated:

`src/ui/production/ProductionPage.tsx`

For a valid selected Product and non-negative whole planned quantity, Production now loads in parallel:

```text
productionRequirementService.plan(productId, plannedQuantity)
componentAwareProductCostService.costProduct(productId)
assemblyCapacityTraceService.trace(productId)
```

The old direct calls to `ProductionCapacityService` and `RecipeMaterialCostPreviewService` are no longer top-level Product summary sources.

Their direct-material evidence is consumed through the authoritative nested Phase 3 results where needed.

## Explicit input separation

The screen now makes the core Phase 3 boundary visible.

### Direct materials — make the parent

Panel label:

```text
DIRECT MATERIALS · MAKE THE PARENT
Direct materials to prepare
```

This section retains Phase 2 Production planning for consumable inputs such as wax, plaster, fragrance, water, paint, and fixed recipe items.

It uses:

- `ProductionRequirementPlanResult.requirements` for effective/waste-adjusted/planned quantities;
- `AssemblyCapacityTraceResult.capacitySynthesis.directMaterialCapacity.materials` for normalized stock/direct capacity evidence;
- `ComponentAwareProductCostResult.directMaterialCost.lines` for direct-material price evidence.

Parent Product safety waste continues to apply only to this section.

When the Product is a valid component-only Product, the UI now uses neutral wording instead of incorrectly telling the user to record yield evidence:

```text
No direct materials required for this parent
Assembly depends on the discrete components in the next section.
```

### Discrete components — assemble the parent

New panel label:

```text
DISCRETE COMPONENTS · ASSEMBLE THE PARENT
Components to prepare
```

Each component row exposes:

- source/name;
- Material component vs Product component identity;
- structural role;
- whole-piece quantity per parent;
- planned whole-piece batch quantity;
- current available quantity;
- missing-vs-explicit-zero availability state;
- authoritative per-component capacity;
- unit/input cost where derivable;
- planned component cost contribution;
- capacity and cost readiness/issues.

The UI calculation for planned component quantity is presentation-only:

```text
quantityPerParent × planned finished pieces
```

No parent safety-waste multiplier is applied to discrete component counts.

No stock mutation, reservation, or deduction is performed from Production.

## Pure presentation helper

Added:

`src/ui/production/componentAwareProductionView.ts`

The helper performs only presentation transformations over authoritative service results.

### Component requirement rows

`buildComponentRequirementRows(...)` joins root component capacity and cost evidence by canonical component identity.

It preserves:

- source type/ID/name;
- role;
- quantity per parent;
- planned display quantity;
- current availability;
- missing / zero / available / unresolved state;
- 3.4A `capacityPieces` exactly as returned;
- cost contribution/readiness;
- source-level issues.

Name precedence is:

```text
authoritative name in 3.3A/3.3B result
-> Product/Material catalog name
-> raw source ID
```

Rows are deterministic by source type, normalized source ID, then component ID.

### Missing ProductStock vs zero ProductStock

The helper preserves the existing 3.2C semantic distinction:

```text
missing ProductStock
-> availableQuantity = null
-> availabilityState = missing
-> unresolved current availability

explicit zero ProductStock
-> availableQuantity = 0
-> availabilityState = zero
-> authoritative known zero
```

The Production table renders these as distinct states.

### Recursive cost display

`buildComponentCostBreakdownRows(...)` flattens the already-derived 3.3B recursive breakdown for display only.

It produces readable paths such as:

```text
Gift Box > Candle
Gift Box > Candle > Handmade Pot
Gift Box > Candle > Box Insert
```

Rows retain depth, source type, role, quantity, unit cost, contribution, status, and issues.

A local object-reference guard stops malformed circular display data without performing repository traversal or recomputing recursive cost.

### Limiting resource display

`buildLimitingResourceRows(...)` maps only the authoritative 3.4C limiter union.

It preserves all returned ties and distinguishes:

```text
material-requirement       -> Direct material
material-backed-component  -> Material component
product-backed-component   -> Product component
```

For partial/not-ready trace results it returns no invented final limiter list.

### Readiness issue aggregation

`buildProductionIssueRows(...)` collects and deterministically deduplicates readable issue evidence from:

- direct Production requirements;
- component-aware cost;
- overall assembly-capacity trace;
- per-component capacity;
- source availability.

Source labels remain visible rather than collapsing everything into a generic error.

## Summary cards

The old direct-material-only Production summary is replaced with Phase 3 summary cards for:

### Production readiness

Primary current assembly readiness comes from 3.4C.

Cost readiness is shown separately so a `partial` cost result is not silently presented as complete.

### Assembly capacity

Displays only authoritative:

`AssemblyCapacityTraceResult.overallAssemblyCapacity`

when trace status is `ready`.

Partial/not-ready results show no misleading final capacity.

### Limiting resources

The summary displays all typed resource names tied at the final minimum rather than only one direct Material.

A separate limiter panel shows each tied resource's:

- type;
- source name;
- capacity;
- quantity evidence;
- immediate current-assembly path.

### Component-aware cost / Product

Displays `ComponentAwareProductCostResult.totalComponentAwareCost` when numeric.

A partial numeric result is explicitly labelled as a known subtotal rather than a complete Product cost.

### Planned input cost

The page combines currently known:

```text
waste-adjusted parent direct-material batch cost
+
planned discrete-component contribution
```

A combined value is labelled complete only when the authoritative cost result and all required display inputs are ready.

Partial known evidence remains visibly labelled as a partial subtotal.

Labor, overhead, markup, margin, selling price, and profit are still excluded.

## Planned quantity warning

The previous direct-material-only warning was replaced.

Production now warns only when:

```text
trace.status = ready
overallAssemblyCapacity != null
plannedQuantity > overallAssemblyCapacity
```

The warning refers the user to the current limiting resources rather than assuming a direct Material is the blocker.

## Component-aware cost panel

The Production cost detail now shows:

- parent direct-material subtotal / Product;
- root discrete-component subtotal / Product;
- known component-aware total / Product;
- authoritative cost readiness.

The separate **Nested component cost** panel shows the recursive 3.3B breakdown paths.

ProductStock/current component availability is never included in cost mathematics.

## Styling

Updated:

`src/ui/production/production.css`

Added responsive styling for:

- five-card Phase 3 summary;
- explicit direct-material/component section markers;
- component source/role pills;
- missing ProductStock callout;
- tied limiter cards;
- component-aware cost summary;
- nested cost rows/path indentation;
- responsive Production layouts.

No new CSS/UI framework was added.

## React smoke coverage

Updated:

`src/App.smoke.test.tsx`

Static Production smoke coverage now verifies:

```text
Component-aware production estimate
Planned finished pieces
Assembly capacity
Direct materials to prepare
Components to prepare
Limiting resources
Component-aware cost
Nested component cost
Issues to resolve
```

The existing smoke suite remains **7 tests**.

## Dedicated 3.5C helper tests

Added:

`src/ui/production/componentAwareProductionView.test.ts`

Dedicated tests: **15**.

Coverage includes:

- Material-backed component cost/capacity joining;
- Product-backed component cost/capacity joining;
- planned component quantity scaling;
- no parent safety-waste application to discrete component counts;
- missing ProductStock preservation;
- explicit zero preservation;
- exact upstream per-component capacity preservation;
- authoritative/catalog/raw source-name fallback order;
- deterministic component ordering;
- planned component contribution scaling;
- numeric evidence retained with unresolved cost status;
- readable recursive Product/Material paths and depth;
- malformed circular display-data guard;
- all typed tied limiters preserved;
- no limiter invention on partial trace;
- deterministic issue deduplication.

## Validation evidence

Current validated implementation head:

`282b1bef97127f7ef2e030008c728acc374cf74e`

CI:

```text
34928129692 — SUCCESS
54 test files passed
623 tests passed
15 dedicated componentAwareProductionView tests
7 React workspace smoke tests
TypeScript typecheck passed
production build passed
```

Earlier intermediate feature-head runs are not completion evidence because they occurred before the final smoke/UI commit. The completion gate uses the exact validated head above and later final documented-head/PR/post-merge gates.

## Scope retained

3.5C does **not** introduce:

- new ProductComponent domain rules;
- ProductStock editing;
- component-specific waste policy;
- recursive manufacture of missing child stock;
- stock reservation;
- automatic Material/ProductStock deduction;
- stock transactions or production posting;
- new cost/capacity formulas;
- persistence of derived estimates;
- labor, overhead, selling price, markup, margin, or profit;
- Excel persistence.

## Completion gate state

Implementation-side gates passed:

- Production uses Phase 3 cost/capacity/trace application services;
- direct materials and discrete assembly components are clearly separated;
- purchased Material components are visible;
- child Product components are visible;
- current component availability/stock is visible;
- missing ProductStock remains distinct from zero;
- authoritative per-component capacity is visible;
- final direct + component assembly capacity is visible only when ready;
- all typed tied limiting resources are visible;
- recursive/nested cost paths are visible;
- readiness issues are visible;
- planned component counts do not inherit parent safety waste;
- no stock mutation/recursive manufacture/pricing/persistence scope leaked in;
- 15 dedicated UI helper tests pass;
- 54 full test files / 623 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining before 3.5C can be marked fully complete:

- final documented feature-head CI must pass;
- implementation PR must pass independent PR CI;
- implementation PR must merge to `develop`;
- exact post-merge `develop` CI must pass;
- documentation-only closeout must mark 3.5C COMPLETE and Phase 3.5 COMPLETE;
- closeout must advance 3.6A to NEXT / NOT STARTED;
- exact final closeout `develop` CI must pass.

## Next task after closeout

**3.6A — Integrated Multi-Component Workflow — NEXT / NOT STARTED**

Do not begin 3.6A until 3.5C is fully merged/closed and a dedicated 3.6A development plan/scope review is established.
