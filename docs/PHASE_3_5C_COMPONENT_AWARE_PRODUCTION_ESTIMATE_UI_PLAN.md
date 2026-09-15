# Phase 3.5C — Component-Aware Production Estimate UI Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `0a0a93e5b2d241e05575c1414200aa55a1636542`

Feature branch:

`feature/phase-3-5c-component-aware-production-ui`

Implementation record:

`docs/PHASE_3_5C_COMPONENT_AWARE_PRODUCTION_ESTIMATE_UI.md`

## Objective

Extend the Production workspace from Phase 2 direct-material-only planning into the Phase 3 component-aware current assembly estimate while reusing completed application services as the sole authorities for cost, availability, capacity, limiter identity, and readiness.

The delivered UI exposes:

- component-aware total input cost;
- purchased/Material-backed component requirements;
- child-Product component requirements;
- current component stock/availability;
- per-component capacity;
- overall direct-material + component assembly capacity;
- every tied limiting resource;
- nested Product/component cost paths;
- readiness issues;
- a clear separation between parent-making direct materials and assembly components.

## Authoritative master-plan contract

3.5C must show:

```text
component-aware total cost
purchased/material component requirements
child-product component requirements
component stock/availability
per-component capacity
overall direct-material + component assembly capacity
all limiting resources
nested cost path/breakdown
readiness issues
```

The screen must distinguish:

```text
Direct materials required to make the parent
vs
Discrete components required to assemble the parent
```

## Split assessment

No deeper formal roadmap split was required.

3.5C remained one cohesive UI integration phase implemented through:

1. deterministic component-aware presentation helpers;
2. Phase 3 summary cards;
3. retained/reframed Phase 2 direct-material batch section;
4. separate discrete-component assembly section;
5. overall capacity + typed limiter presentation;
6. recursive cost-path presentation;
7. aggregated readiness evidence;
8. Production styling and smoke coverage;
9. full regression/CI.

These are implementation slices, not separate roadmap sub-phases.

## Authoritative services reused

### ProductionRequirementService

Continues to own parent direct-material quantities and safety waste:

```text
effective direct requirement / Product
waste reserve
planned direct requirement / Product
planned batch direct requirement
requirement readiness/issues
```

3.5C does not reimplement Phase 2 recipe/yield mathematics.

### ComponentAwareProductCostService

`costProduct(productId)` remains authoritative for:

```text
status: ready | partial | not-ready
directMaterialCostSubtotal
componentCostSubtotal
totalComponentAwareCost
componentLines[]
issues[]
```

Material-backed component cost remains 3.3A.

Recursive Product-backed component cost/breakdown remains 3.3B.

The UI preserves the existing 3.3C rule that a numeric partial subtotal is not silently upgraded to a complete ready cost.

### AssemblyCapacityTraceService

`trace(productId)` remains authoritative for:

```text
status: ready | partial | not-ready
overallAssemblyCapacity
capacitySynthesis.directMaterialApplicable
capacitySynthesis.directMaterialCapacity
capacitySynthesis.componentCapacities[]
limitingResources[]
issues[]
```

Typed limiter identities remain:

```text
material-requirement
material-backed-component
product-backed-component
```

3.5C displays all returned ties and never recomputes the minimum or selects one limiter independently.

## Production loading contract

For a valid selected Product and planned non-negative whole quantity, Production now loads in parallel:

```text
productionRequirementService.plan(productId, plannedQuantity)
componentAwareProductCostService.costProduct(productId)
assemblyCapacityTraceService.trace(productId)
```

The old direct `ProductionCapacityService` and `RecipeMaterialCostPreviewService` calls are no longer top-level Product summary sources.

Their direct-material evidence is consumed from the nested Phase 3 results when rendering direct-material detail.

## Direct materials vs discrete components

### Direct materials — make the parent

Examples:

- wax;
- plaster;
- fragrance;
- water;
- paint;
- fixed recipe consumables.

The delivered section is explicitly labelled:

```text
DIRECT MATERIALS · MAKE THE PARENT
Direct materials to prepare
```

It uses:

- `ProductionRequirementPlanResult.requirements` for batch quantities;
- `capacityTrace.capacitySynthesis.directMaterialCapacity.materials` for direct inventory/capacity;
- `componentAwareCost.directMaterialCost.lines` for direct cost evidence.

Parent Product safety waste continues to apply here.

If Phase 3 proves a valid component-only Product, empty direct requirements use neutral wording rather than incorrectly demanding yield evidence.

### Discrete components — assemble the parent

Examples:

- glass/plastic/stainless vessels;
- finished plaster pot Products;
- molded heart/star/flower Products;
- inserts/accessories.

The delivered section is explicitly labelled:

```text
DISCRETE COMPONENTS · ASSEMBLE THE PARENT
Components to prepare
```

Planned display quantity is:

```text
quantityPerParent × planned finished pieces
```

Parent safety waste is deliberately not applied to discrete component counts.

No component-specific reserve/waste contract is introduced.

## Presentation helper

Implemented:

`src/ui/production/componentAwareProductionView.ts`

The helper performs presentation-safe transformations only.

It does not recompute authoritative cost, source availability, per-component capacity, overall capacity, or limiting resources.

### ComponentRequirementRow

Rows preserve/join:

```text
componentId
sourceType
sourceId
sourceName
role
quantityPerParent
plannedQuantity
availableQuantity
availabilityState
availabilityStatus
capacityPieces
capacityStatus
unit = pc
unitCost
costContributionPerParent
plannedCostContribution
costStatus
issues[]
```

Name resolution order:

```text
authoritative 3.3A/3.3B name
-> Product/Material catalog name
-> raw source ID
```

Rows are deterministic by source type, normalized source ID, then component ID.

### Missing ProductStock vs zero

The helper preserves:

```text
missing ProductStock
-> null availability
-> missing state
-> unresolved

explicit zero ProductStock
-> numeric 0
-> zero state
-> known zero
```

The UI does not collapse missing stock to zero.

### Per-component capacity

`capacityPieces` is copied from 3.4A evidence carried by 3.4C.

The UI does not independently perform `floor(available / required)`.

### Recursive cost paths

`buildComponentCostBreakdownRows(...)` walks the already-derived 3.3B breakdown tree for display.

It supports readable paths such as:

```text
Gift Box > Candle
Gift Box > Candle > Handmade Pot
Gift Box > Candle > Box Insert
```

A local object-reference guard prevents malformed circular display data from infinitely recursing.

No repository recursion or cost recomputation occurs.

### Limiting resources

`buildLimitingResourceRows(...)` transforms only 3.4C's authoritative limiter union.

All ties are preserved.

For partial/not-ready trace results, no final limiter list is invented.

### Readiness issues

`buildProductionIssueRows(...)` aggregates/deduplicates readable evidence from:

- direct requirements;
- component-aware cost;
- assembly-capacity trace;
- component capacity;
- source availability.

Source labels remain explicit.

## Summary cards

Production now shows:

### Production readiness

Assembly readiness from 3.4C with cost readiness separately identified.

### Assembly capacity

Only `overallAssemblyCapacity` from 3.4C/3.4B when authoritative trace status is ready.

### Limiting resources

All names tied at the final assembly minimum, plus a dedicated typed limiter panel.

### Component-aware cost / Product

`totalComponentAwareCost` from 3.3C.

Partial numeric values are visibly labelled known partial subtotals.

### Planned input cost

Known planned direct-material batch cost plus known planned discrete-component contributions.

A combined value is marked complete only when the authoritative cost/readiness inputs are complete.

Safety waste affects only parent direct materials.

Labor, overhead, markup, margin, selling price, and profit are not included.

## Capacity warning

The old direct-material-only warning was replaced with:

```text
trace.status == ready
overallAssemblyCapacity != null
plannedQuantity > overallAssemblyCapacity
```

The user is directed to the final limiting resources instead of assuming a direct Material shortage.

## Limiter panel

Each authoritative limiter displays:

- readable source name;
- typed kind;
- capacity in parent pieces;
- quantity evidence;
- current parent-input path.

Tied direct materials, Material-backed components, and Product-backed components can all appear together.

## Cost breakdown

Production now shows:

```text
parent direct-material subtotal / Product
root component subtotal / Product
known component-aware total / Product
recursive nested component cost lines
```

Nested Product-backed paths are indented/readable and preserve ready/partial/not-ready evidence.

ProductStock/current availability never changes cost mathematics.

## Archived Product behavior

Archived Products remain selectable for historical estimate inspection, consistent with the existing Production behavior and derived Phase 3 services.

Production remains read-only with respect to Product, composition, Material inventory, and ProductStock source data.

## Styling

Updated:

`src/ui/production/production.css`

Delivered responsive styles for:

- Phase 3 summary cards;
- direct-material/component section markers;
- source/role pills;
- missing ProductStock text;
- typed limiter cards;
- component-aware cost summary;
- nested cost rows/path indentation.

No new UI framework was added.

## Tests

### Pure helper suite

Added:

`src/ui/production/componentAwareProductionView.test.ts`

Dedicated tests: **15**.

Coverage includes:

- Material-backed capacity/cost joining;
- Product-backed capacity/cost joining;
- planned component quantity scaling;
- no safety-waste inflation of component counts;
- missing ProductStock;
- explicit zero ProductStock;
- exact upstream capacity preservation;
- source-name precedence;
- deterministic ordering;
- planned component contribution scaling;
- partial numeric cost evidence;
- nested Product/Material readable paths;
- circular display-data guard;
- all typed limiter ties;
- no limiter invention on partial trace;
- deterministic issue deduplication.

### React smoke

Updated:

`src/App.smoke.test.tsx`

The existing 7-test smoke suite now verifies the Production shell exposes:

```text
Component-aware production estimate
Assembly capacity
Direct materials to prepare
Components to prepare
Limiting resources
Component-aware cost
Nested component cost
Issues to resolve
```

No browser-testing dependency was added.

## Validation evidence

Validated implementation head:

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

## Explicit non-goals retained

3.5C does not implement:

- new ProductComponent contracts/rules;
- ProductStock editing;
- stock transaction history;
- reservations;
- automatic inventory/ProductStock deduction;
- production completion posting;
- recursive manufacture of missing child Products;
- new component cost/capacity formulas;
- component-specific safety waste;
- persistence of derived Production estimates;
- labor/overhead/selling price/markup/margin/profit — Phase 4;
- Excel persistence — Phase 5.

## Merge/closeout gates remaining

Implementation-side gates are satisfied. Before 3.5C is marked COMPLETE:

- final documented feature-head CI must pass;
- implementation PR must pass independent PR CI;
- implementation PR must merge to `develop`;
- exact implementation merge `develop` CI must pass;
- documentation-only closeout must mark 3.5C COMPLETE and Phase 3.5 COMPLETE;
- closeout must advance 3.6A to NEXT / NOT STARTED;
- exact final closeout `develop` CI must pass.

## Next task after closeout

**3.6A — Integrated Multi-Component Workflow**

Do not begin 3.6A until 3.5C is fully merged/closed and a dedicated 3.6A scope review/development plan is established.
