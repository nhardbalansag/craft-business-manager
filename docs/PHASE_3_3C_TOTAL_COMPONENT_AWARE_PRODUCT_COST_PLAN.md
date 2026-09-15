# Phase 3.3C — Total Component-Aware Product Cost & Readiness Development Plan

## Status

**IN PROGRESS**

Authoritative base:

`develop` @ `cb62f446ef77b42d8f41b7ea6825704a2da09c0f`

Feature branch:

`feature/phase-3-3c-total-component-aware-product-cost`

## Objective

Create one derived Product-level cost view that synthesizes the already-authoritative Phase 2 direct-material cost and Phase 3 component contributions.

```text
Phase 2 direct-material cost
+
Phase 3 component contributions
=
component-aware Product material/component cost
```

The result must preserve readiness and diagnostic evidence from all contributing layers, remain storage-agnostic, and become the material/component cost input for Phase 4 pricing.

## Split assessment

No deeper formal split is required.

3.3C is one cohesive application-service synthesis task. Internal implementation order:

1. define the Product-level derived cost/readiness contract;
2. resolve and validate the root Product;
3. obtain the root Phase 2 direct-material cost preview;
4. enumerate the root Product's immediate Phase 3 components deterministically;
5. delegate Material-backed lines to 3.3A;
6. delegate Product-backed lines to 3.3B;
7. aggregate known component contributions without duplicating recursive logic;
8. derive `ready | partial | not-ready` from direct and component evidence;
9. preserve detailed direct/component diagnostics and known partial subtotals;
10. add shared application-session wiring and focused/full validation.

These are implementation steps, not new sub-phases.

## Scope boundary

3.3C is the final Phase 3 **cost synthesis** task only.

It does not:

- calculate component availability/capacity;
- calculate direct-material or overall assembly capacity;
- identify limiting resources;
- use ProductStock/current finished-stock quantity in cost mathematics;
- recursively manufacture missing child stock;
- reserve, deduct, or transact inventory;
- apply safety waste as a permanent cost markup;
- add labor, overhead, packaging overhead, selling price, markup, margin, or profit;
- add React UI;
- add Excel persistence or cached authoritative cost columns.

Capacity remains Phase 3.4. UI remains Phase 3.5. Labor/overhead/pricing remain Phase 4. Persistence remains Phase 5.

## Authoritative cost sources

3.3C must compose existing services and must not reimplement their mathematics.

### Root direct-material cost

Use:

`RecipeMaterialCostPreviewService.previewForProduct(productId)`

Preserve the complete result including:

- `status`;
- `requirementStatus`;
- material cost lines;
- total direct-material cost;
- requirement issues;
- cost issues;
- effective yield/calibration evidence already represented in the preview.

### Root Material-backed components

Use:

`MaterialBackedComponentCostService.costComponent(component)`

3.3A remains the sole source of Material-backed component cost and traceability.

### Root Product-backed components

Use:

`ProductBackedComponentCostService.costComponent(component)`

3.3B remains the sole recursive Product-backed component cost implementation and retains all nested breakdown/cycle/readiness evidence.

## Root Product contract

Primary public operation:

```text
costProduct(productId: string)
```

The requested Product must exist.

Recommended missing-Product behavior:

- throw one typed application error `PRODUCT_NOT_FOUND` because no valid Product-level result identity exists to return.

Archived/inactive Products remain inspectable as historical data, but current component-aware cost should surface their active state explicitly rather than silently pretending they are active.

Recommended output includes:

```text
productId
productName
productIsActive
status
```

An inactive root Product may still have a derived historical cost if its underlying evidence is available. Root inactive state by itself does not erase otherwise derivable historical cost; it should be exposed as identity/state metadata rather than a cost-readiness failure.

## Derived Product-level result contract

Recommended result:

```text
ComponentAwareProductCostResult
- productId
- productName
- productIsActive
- status: ready | partial | not-ready
- directMaterialCost: RecipeMaterialCostPreviewResult
- directMaterialCostSubtotal: number
- componentCostSubtotal: number
- totalComponentAwareCost: number | null
- componentLines: ComponentAwareProductCostLine[]
- issues: ComponentAwareProductCostIssue[]
```

Root component lines are a typed union:

```text
ComponentAwareProductCostLine
= material-backed 3.3A line
| product-backed 3.3B line
```

The full recursive Product-backed tree remains nested inside 3.3B lines rather than being flattened or rebuilt by 3.3C.

## Cost aggregation semantics

Known cost aggregation:

```text
known direct subtotal
= Phase 2 total when Phase 2 contains reliable cost lines
= 0 when no reliable direct cost evidence exists

known component subtotal
= sum of all non-null valid root component contributions

known total
= known direct subtotal + known component subtotal
```

A separate evidence flag must distinguish numeric zero from absence of evidence.

A returned numeric total is complete only when status is `ready`.

For `partial`, `totalComponentAwareCost` may contain the known current subtotal, but it must remain explicitly incomplete through status/issues.

For `not-ready`, `totalComponentAwareCost` is `null` when no reliable numeric cost evidence can be produced or aggregation is unsafe.

## Readiness contract

3.3C uses:

```text
ready
partial
not-ready
```

### `ready`

The Product has reliable Phase 2 direct-material cost evidence with Phase 2 status `ready`, and every required root Phase 3 component line is `ready`.

The complete component-aware Product material/component cost is known.

A Product with no component lines can still be `ready` when its Phase 2 direct-material cost is ready.

### `partial`

At least one reliable numeric cost contribution is known, but one or more required direct/component inputs are unresolved or partial.

Examples:

- Phase 2 direct-material preview is `partial` while some direct lines remain costable;
- Phase 2 is `not-ready`/has no derivable direct cost, but one or more component contributions are known;
- direct-material cost is ready but one Material-backed component is not-ready;
- direct-material cost is ready but one Product-backed component is partial or not-ready;
- a Product-backed component contains a reachable cyclic/corrupt branch while other evidence remains known;
- an invalid root component record cannot be costed while other cost evidence remains valid.

The numeric value is only the known current subtotal and must never be relabeled as a complete cost.

### `not-ready`

No reliable numeric Product cost evidence can currently be produced, or root component aggregation is structurally unsafe and no independent direct evidence remains.

Examples:

- Phase 2 direct cost has no derivable lines and there are no derivable component contributions;
- all root component lines are unresolved and Phase 2 has no cost evidence;
- a derived subtotal is non-finite/negative.

## Phase 2 `NO_REQUIREMENTS` policy

3.3C must remain consistent with the readiness semantics already established in Phase 2 and 3.3B.

If Phase 2 returns `not-ready` because no direct-material requirements are currently derivable, 3.3C must **not** silently reinterpret that as authoritative zero direct-material cost.

Therefore:

- no direct cost + no component cost evidence -> `not-ready`;
- no direct cost + valid component evidence -> `partial` with known component subtotal;
- later product-model work may introduce an explicit component-only Product policy, but 3.3C must not invent one outside the current contract.

## Component collection and deterministic ordering

Load the current ProductComponent collection once for the root Product synthesis.

Filter immediate root lines by normalized parent Product identity.

Process root components deterministically by:

1. source type;
2. normalized source ID;
3. normalized component ID.

Do not flatten nested Product components into the root list. Nested traversal belongs to 3.3B.

## Root component corruption handling

3.3C should defensively validate immediate root component-source uniqueness before aggregation using the existing 3.1B rule.

If immediate root composition is corrupted by duplicate source identity:

- do not double-count duplicated component lines;
- preserve any valid Phase 2 direct cost evidence;
- surface `COMPONENT_GRAPH_INVALID`/equivalent issue;
- return `partial` when independent direct cost evidence exists;
- return `not-ready` when no reliable independent evidence exists.

Full recursive graph/cycle handling remains delegated to 3.3B for Product-backed edges.

## Issue contract

Recommended Product-level summary codes:

```text
DIRECT_MATERIAL_COST_PARTIAL
DIRECT_MATERIAL_COST_NOT_READY
COMPONENT_GRAPH_INVALID
COMPONENT_COST_PARTIAL
COMPONENT_COST_NOT_READY
DERIVED_COST_INVALID
```

A typed service error is reserved for:

```text
PRODUCT_NOT_FOUND
```

Issue records should preserve where useful:

- Product ID;
- component ID;
- source type/source ID;
- underlying 3.1B/3.3A/3.3B issue code.

Detailed Phase 2 and component evidence remains attached to the result and must not be reduced to summary strings only.

## ProductStock exclusion

3.3C must not depend on ProductStock/current stock.

Cost and current assembly availability are separate concerns:

```text
cost -> Phase 3.3
capacity/availability -> Phase 3.4 using Phase 3.2C
```

A Product with zero or missing finished stock can still have a derivable cost.

## Derived-only rule

The Product-level result is derived at read time.

Do not add:

- cached `totalCost` fields to Product;
- cached component-aware cost to ProductComponent;
- BusinessDataset derived-cost collections;
- repository writes from the cost service.

Phase 4 should consume the 3.3C service/view instead of reading persisted cost snapshots.

## Application service

Add:

```text
ComponentAwareProductCostService
```

Recommended dependencies:

- `ProductRepository`;
- `ProductComponentRepository`;
- Phase 2 `RecipeMaterialCostPreviewService` provider;
- 3.3A Material-backed component cost provider;
- 3.3B Product-backed component cost provider.

Primary method:

```text
costProduct(productId: string): Promise<ComponentAwareProductCostResult>
```

## Shared application session

Add one shared instance:

```text
componentAwareProductCostService
```

Reuse:

```text
productRepository
productComponentRepository
recipeMaterialCostPreviewService
materialBackedComponentCostService
productBackedComponentCostService
```

No new repository or BusinessDataset source-data collection is introduced.

## Test plan

Focused tests must cover at minimum:

- ready direct-material-only Product;
- ready direct + one Material-backed component;
- ready direct + one Product-backed component;
- ready direct + mixed Material/Product components;
- component contribution quantities already reflected exactly once;
- recursive Product-backed tree preserved without flattening;
- deterministic root component ordering;
- ready zero-cost direct line remains numeric zero evidence;
- ready zero-cost component remains numeric zero evidence;
- Phase 2 partial + ready components -> partial known total;
- Phase 2 not-ready/no direct lines + ready components -> partial component-only known subtotal;
- Phase 2 not-ready/no direct lines + no components -> not-ready/null total;
- ready direct + one not-ready Material component -> partial known direct subtotal;
- ready direct + one partial Product component -> partial known subtotal;
- ready direct + one not-ready Product component -> partial known subtotal;
- all component evidence unresolved + no direct evidence -> not-ready;
- immediate duplicate root source corruption is not double-counted;
- unrelated nested corruption is handled through 3.3B without infinite recursion;
- missing Product -> typed `PRODUCT_NOT_FOUND`;
- inactive root Product identity/state is preserved while historical cost remains derivable;
- ProductStock/current stock does not influence cost;
- invalid/non-finite derived contributions are rejected safely;
- Product/ProductComponent source records are not mutated;
- no derived result is persisted.

## Completion gate

3.3C is complete only when:

- one Product-level derived view combines Phase 2 direct-material cost and Phase 3 root component contributions;
- root Material-backed lines delegate to 3.3A;
- root Product-backed lines delegate to 3.3B;
- recursive nested evidence remains inspectable;
- `ready | partial | not-ready` propagates deterministically;
- complete versus known-partial numeric totals are distinguishable;
- zero cost is distinguishable from absence of cost evidence;
- duplicate root component sources cannot be double-counted;
- ProductStock/current stock does not affect cost;
- the result is derived only and no authoritative cached cost is persisted;
- shared session wiring exists;
- focused tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.4A — Per-Component Availability & Capacity**

Do not begin 3.4A until 3.3C is merged, exact post-merge `develop` CI is green, Phase 3.3 is formally marked COMPLETE, and a dedicated 3.4A development plan/scope review is established.
