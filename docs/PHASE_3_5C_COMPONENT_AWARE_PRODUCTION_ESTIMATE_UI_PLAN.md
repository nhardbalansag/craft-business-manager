# Phase 3.5C — Component-Aware Production Estimate UI Development Plan

## Status

**IN PROGRESS — PLAN ESTABLISHED BEFORE IMPLEMENTATION**

Authoritative base:

`develop` @ `0a0a93e5b2d241e05575c1414200aa55a1636542`

Feature branch:

`feature/phase-3-5c-component-aware-production-ui`

## Objective

Extend the existing Production workspace from a Phase 2 direct-material estimate into the Phase 3 component-aware assembly estimate required by the authoritative master plan.

The screen must expose, without duplicating domain/application calculations:

- component-aware total cost;
- purchased/material-backed component requirements;
- child-Product component requirements;
- component stock/current availability;
- per-component capacity;
- overall direct-material + component assembly capacity;
- every tied limiting resource with typed identity;
- recursive/nested component cost path and breakdown;
- readiness issues;
- a visually explicit distinction between direct materials used to make the parent and discrete components used to assemble the parent.

## Authoritative 3.5C contract

The master plan requires Production to show:

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

The screen must clearly distinguish:

```text
Direct materials required to make the parent
vs
Discrete components required to assemble the parent
```

## Split assessment

No deeper formal roadmap split is required.

3.5C remains one cohesive UI integration phase with internal implementation slices:

1. define deterministic presentation/view-model helpers for component requirement rows and recursive cost breakdown;
2. replace direct-only Production summary capacity/cost cards with component-aware summaries;
3. preserve the current direct-material batch requirement table as the parent-making section;
4. add a separate discrete component assembly requirement table;
5. expose overall capacity and all typed limiting resources from Phase 3.4C;
6. expose recursive/nested cost paths from Phase 3.3C/3.3B;
7. aggregate readiness evidence without hiding upstream issues;
8. extend Production styling and smoke coverage;
9. run full regression/CI and complete the normal PR/merge/closeout lifecycle.

These are implementation slices, not separate sub-phases.

## Existing Production architecture

Current file:

`src/ui/production/ProductionPage.tsx`

The current page is Phase 2 direct-material only. It uses:

- `ProductionRequirementService` for planned direct-material quantities and safety waste;
- `ProductionCapacityService` for direct-material capacity;
- `RecipeMaterialCostPreviewService` for direct-material cost.

It currently labels its capacity and footer explicitly as direct-material-only.

3.5C must preserve the useful Phase 2 direct-material detail but make Phase 3 services authoritative for the cross-resource Product result.

## Authoritative services to reuse

### Parent direct-material batch requirements

`ProductionRequirementService`

Continues to own:

- effective direct material quantity per Product;
- safety waste reserve;
- planned direct quantity per Product;
- planned batch direct quantity;
- requirement readiness/issues.

3.5C must not reimplement Phase 2 recipe/yield mathematics.

### Component-aware Product cost

`ComponentAwareProductCostService`

Method:

```text
costProduct(productId)
```

Authoritative result includes:

```text
status: ready | partial | not-ready
directMaterialCostSubtotal
componentCostSubtotal
totalComponentAwareCost
componentLines[]
issues[]
```

Root component cost lines are typed:

```text
material
product
```

Product-backed lines preserve recursive child cost data and nested `breakdown` entries.

Important current 3.3C rule:

- a component-only Product with no Phase 2 direct-material cost remains `partial` under the current cost-readiness contract even when its component contribution is numeric;
- the UI must preserve that authoritative status rather than silently upgrading it to `ready`.

### Overall assembly capacity and typed limiting resources

`AssemblyCapacityTraceService`

Method:

```text
trace(productId)
```

Authoritative result includes:

```text
status: ready | partial | not-ready
overallAssemblyCapacity
capacitySynthesis.directMaterialApplicable
capacitySynthesis.directMaterialCapacity
capacitySynthesis.componentCapacities[]
limitingResources[]
issues[]
```

Typed limiting resource kinds:

```text
material-requirement
material-backed-component
product-backed-component
```

3.5C must display every limiter returned by this service. It must not independently recompute or choose a single limiter.

### Per-component current availability/capacity

Use `capacityTrace.capacitySynthesis.componentCapacities`.

Each row already exposes:

```text
componentId
role
sourceType
sourceId
quantityPerParent
status
availableQuantity
unit = pc
capacityPieces
sourceAvailability
issues[]
```

3.5C must not call a second custom component-capacity formula.

## Direct materials vs discrete components boundary

This is the primary presentation rule.

### Direct materials required to make the parent

Examples:

- wax;
- plaster;
- fragrance;
- water;
- paint;
- fixed recipe consumables.

These remain under the Phase 2 Production requirement table and may be adjusted by the parent Product safety-waste policy.

### Discrete components required to assemble the parent

Examples:

- purchased glass cup;
- plastic/stainless vessel;
- finished plaster pot Product;
- mini heart/star/flower Product;
- insert/accessory.

Component quantity is:

```text
planned component quantity
= quantityPerParent × planned finished pieces
```

Parent safety waste must **not** be applied to discrete component counts in 3.5C.

Any future component-specific waste/reserve policy would require a separate domain contract and is out of scope.

## Proposed pure UI helper

Add a presentation helper to keep Production JSX deterministic and testable:

`src/ui/production/componentAwareProductionView.ts`

This helper must not perform authoritative business calculations already owned by application services. It may only perform presentation-safe transformations such as:

- joining source names to component result rows;
- multiplying already-authoritative `quantityPerParent` by user-entered planned quantity for display;
- joining component capacity and component cost lines by canonical component identity;
- recursively flattening existing 3.3B cost breakdown into display rows;
- formatting/deduplicating issue summaries;
- deterministic ordering.

### Component requirement row

Recommended shape:

```text
ComponentRequirementRow
- componentId
- sourceType: material | product
- sourceId
- sourceName
- role
- quantityPerParent
- plannedQuantity
- availableQuantity: number | null
- availabilityStatus
- capacityPieces: number | null
- capacityStatus
- unit: pc
- unitCost: number | null
- costContributionPerParent: number | null
- plannedCostContribution: number | null
- costStatus
- issues[]
```

Name resolution precedence:

1. authoritative source name already preserved by 3.3A/3.3B cost line;
2. Product/Material catalog lookup;
3. raw source ID fallback.

Rows should follow the deterministic component order already returned by Phase 3 services where possible; if helper sorting is needed, use source type, canonical source ID, then component ID.

### Recursive cost breakdown row

Recommended display shape:

```text
ComponentCostBreakdownRow
- componentId
- sourceType
- sourceId
- sourceName
- role
- depth
- pathLabel
- quantityPerParent
- status
- unitCost: number | null
- contribution: number | null
- issues[]
```

For Product-backed components, recursively walk the existing `breakdown` tree.

Display readable paths such as:

```text
Gift Box > Candle > Handmade Pot
```

The helper must never recurse into Product repositories or recompute child cost; it only traverses the already-built 3.3B breakdown tree and must retain a local defensive path/visited guard against malformed view data.

## Production data loading

For a valid selected Product and planned whole quantity, request in parallel:

```text
productionRequirementService.plan(productId, plannedQuantity)
componentAwareProductCostService.costProduct(productId)
assemblyCapacityTraceService.trace(productId)
```

The previous direct `ProductionCapacityService` and direct `RecipeMaterialCostPreviewService` calls should no longer be the top-level Product summary sources because the Phase 3 services already include/preserve those upstream results.

The page may still read the nested direct-material preview/capacity from the Phase 3 results to populate the existing direct-material table.

## Summary cards

Recommended top summary:

### Production readiness

Show overall current assembly readiness based primarily on `AssemblyCapacityTraceResult.status`, with cost readiness shown explicitly as a separate small label rather than collapsed into one misleading state.

### Assembly capacity

Show:

```text
overallAssemblyCapacity
```

only when published by 3.4C/3.4B.

For partial/not-ready results, show `—` plus the authoritative readiness label.

### Limiting resources

Show **all** limiting resources returned by 3.4C, with readable typed labels, for example:

```text
Wax · Direct material
Glass Cup · Material component
Mini Heart · Product component
```

Do not show only the first limiter.

### Component-aware cost / Product

Show `totalComponentAwareCost` from 3.3C.

If cost status is `partial`, label the numeric value as a **known partial subtotal**, not a complete Product cost.

If total is null, show unresolved.

## Planned-batch cost presentation

The existing Production page already calculates the safety-waste-adjusted parent direct-material batch cost from the Phase 2 plan.

3.5C may display:

```text
planned direct-material cost
+
planned discrete-component contribution
```

where:

```text
planned component contribution
= authoritative componentCostContribution per parent × planned finished pieces
```

Rules:

- preserve known numeric subtotals when upstream cost is partial;
- do not label a partial subtotal as a complete planned batch cost;
- parent direct-material safety waste affects only the direct-material portion;
- do not add safety waste to discrete component counts/cost automatically;
- do not add labor, overhead, markup, margin, selling price, or profit.

If the UI publishes a combined planned input total, it must be explicitly marked complete only when the required upstream cost evidence is complete under current service contracts.

## Planned quantity vs capacity warning

Replace the old direct-material-only warning with overall assembly capacity logic:

```text
if trace.status == ready
and overallAssemblyCapacity != null
and plannedQuantity > overallAssemblyCapacity
=> warn that planned quantity exceeds current assembly capacity
```

The warning should direct the user to the listed limiting resources rather than assuming the blocker is a direct Material.

## Direct-material section

Keep the current parent direct-material table, but rename/reframe it so the distinction is explicit:

```text
DIRECT MATERIALS — MAKE THE PARENT
Direct materials to prepare
```

Use:

- `ProductionRequirementPlanResult.requirements` for quantities;
- `capacityTrace.capacitySynthesis.directMaterialCapacity.materials` for direct inventory/capacity;
- `componentAwareCost.directMaterialCost.lines` for direct cost basis.

If there are no derivable direct requirements but the Product is a valid component-only Product, use neutral copy such as:

```text
No direct materials are required for this parent Product.
Assembly depends on the discrete components below.
```

Do not tell the user to record yield evidence when Phase 3 evidence clearly shows a valid component-only Product.

If direct requirements are genuinely unresolved/broken, preserve the Phase 2 readiness guidance/issues.

## Discrete component section

Add a separate panel:

```text
DISCRETE COMPONENTS — ASSEMBLE THE PARENT
Components to prepare
```

Columns/fields should include:

- component source/name;
- source type and role;
- required per parent;
- required for planned batch;
- current available `pc`;
- current per-component capacity;
- cost per source unit where available;
- component cost contribution for the planned batch;
- readiness/issues.

Material-backed and Product-backed components must be visually identifiable without relying only on color.

Missing ProductStock must remain distinguishable from explicit `0 pc` because the nested availability result already preserves that difference.

No stock mutation occurs from Production.

## Limiting resource presentation

Add a dedicated limiter list or card group sourced only from `AssemblyCapacityTraceResult.limitingResources`.

Each limiter should show:

- readable source name;
- typed kind;
- capacity in parent pieces;
- immediate path;
- useful quantity evidence already present on the limiter contract.

Examples:

```text
Wax — Direct material — capacity 12
Glass Cup — Material component — capacity 10
Mini Heart — Product component — capacity 10
```

Ties must all be visible.

For partial/not-ready trace results, do not invent final limiter identity.

## Recursive cost presentation

Replace/extend the current direct-only cost preview with a component-aware cost panel.

Show:

1. parent direct-material subtotal;
2. root component subtotal;
3. total component-aware cost when available;
4. each root component line;
5. recursive Product-backed child breakdown/path.

For Product-backed nested paths, indent rows by depth and show `pathLabel`.

Material-backed nested child components should appear under the appropriate Product path.

Readiness/status must be visible for partial/not-ready lines.

Do not use ProductStock/current availability in cost mathematics.

## Readiness issues

The page should expose a readable issue list from authoritative sources without collapsing everything into a generic error.

At minimum include:

- Production requirement issues;
- component-aware cost issues;
- AssemblyCapacityTrace issues;
- synthesis/per-component issues when they add concrete source-level information not already visible in the row.

A presentation helper may deduplicate identical messages while preserving source labels.

Suggested source labels:

```text
Direct requirement
Cost
Assembly capacity
Component capacity
Availability
```

## Archived Product behavior

Archived Products remain selectable for historical inspection, consistent with the current Production and Phase 3 derived services.

The page is estimate/read-only with respect to Product source data, so inspecting an archived Product must not mutate composition or stock.

## Styling

Extend:

`src/ui/production/production.css`

Reuse current application visual language.

Likely additions:

- five/six-card responsive summary layout if needed;
- direct-material vs component section labels;
- component type/role pills;
- missing/zero/available state text;
- limiter list/cards;
- nested cost indentation/path styling;
- responsive component table behavior.

Do not add a new UI framework.

## Tests

### Pure view-model/helper tests

Add:

`src/ui/production/componentAwareProductionView.test.ts`

Cover at minimum:

- material-backed component row joining capacity + cost evidence;
- Product-backed component row joining capacity + cost evidence;
- planned component quantity equals whole `quantityPerParent × plannedQuantity`;
- parent safety waste is not applied to component quantity;
- missing ProductStock remains unresolved/null availability;
- explicit zero remains numeric zero;
- per-component capacity is preserved from 3.4A, not recomputed differently;
- material/Product source naming fallback order;
- all component rows remain deterministic;
- recursive Product cost breakdown produces readable nested path/depth;
- nested Material-backed component remains under its Product path;
- corrupted recursive display data cannot infinitely recurse;
- partial cost keeps numeric known subtotal labelled partial;
- issue deduplication is deterministic where implemented;
- limiter display metadata preserves all typed ties.

### React smoke coverage

Update `src/App.smoke.test.tsx` to verify the Production shell now exposes Phase 3 wording such as:

```text
Component-aware production estimate
Direct materials to prepare
Components to prepare
Assembly capacity
Limiting resources
Component-aware cost
Nested component cost
Issues to resolve
```

Server-render smoke tests should assert only initial/static shell content that genuinely exists before effects run.

No browser-testing dependency is required for 3.5C unless implementation proves static/helper coverage insufficient.

## Expected implementation files

Likely:

```text
src/ui/production/ProductionPage.tsx
src/ui/production/componentAwareProductionView.ts
src/ui/production/componentAwareProductionView.test.ts
src/ui/production/production.css
src/App.smoke.test.tsx
docs/PHASE_3_5C_COMPONENT_AWARE_PRODUCTION_ESTIMATE_UI.md
```

No domain/application source change is expected because all required Phase 3 services are already wired in `src/application/session.ts`.

Any domain/application change discovered during implementation must be justified as strictly necessary for UI integration before being introduced.

## Explicit non-goals

3.5C does not implement:

- new ProductComponent domain rules;
- ProductStock editing — completed in 3.5B;
- stock transaction history;
- stock reservation;
- automatic Material/ProductStock deduction;
- production completion posting;
- recursive manufacture of missing child Products;
- make-to-order planning;
- new cost formulas below 3.3C;
- new capacity formulas below 3.4C;
- component-specific waste policy;
- labor/overhead/pricing/profit — Phase 4;
- Excel persistence — Phase 5;
- Phase 3.6 end-to-end completion gate work beyond regression needed to validate 3.5C itself.

## Completion gate

3.5C is complete only when:

- Production uses `ComponentAwareProductCostService` for Product-level material/component cost;
- Production uses `AssemblyCapacityTraceService` for overall capacity and final typed limiter ties;
- direct parent materials and discrete assembly components are visibly separate;
- parent direct-material safety waste remains Phase 2-owned;
- component planned quantities remain whole discrete counts without parent waste inflation;
- purchased/material-backed component requirements are visible;
- child-Product component requirements are visible;
- component stock/current availability is visible;
- per-component capacity is visible;
- overall assembly capacity is visible only when authoritative;
- every final tied limiting resource is shown;
- recursive/nested cost paths/breakdown are inspectable;
- partial/not-ready cost and capacity states are not misrepresented as complete;
- missing ProductStock is not shown as zero;
- archived Product inspection remains safe;
- no inventory mutation/transaction/reservation/deduction behavior is introduced;
- focused view-model/UI tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR passes CI and merges to `develop`;
- exact post-merge `develop` CI passes;
- documentation-only closeout marks 3.5C COMPLETE and advances **3.6A — Integrated Multi-Component Workflow** to NEXT / NOT STARTED.

## Next task after closeout

**3.6A — Integrated Multi-Component Workflow**

Do not begin 3.6A until 3.5C is merged, exact post-merge CI is green, 3.5C is formally closed, and a dedicated 3.6A scope review/development plan is established.
