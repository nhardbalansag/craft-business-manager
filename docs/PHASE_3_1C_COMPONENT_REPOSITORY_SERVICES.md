# Phase 3.1C — Component Repository & Application Services

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch: `feature/phase-3-1c-component-services`

Authoritative implementation base:

`develop` @ `046c359ea264a08cb5fc55cda61f666122bf6c04`

Feature validation evidence:

- CI run `34911576909` — SUCCESS;
- 41 test files passed;
- 382 tests passed;
- TypeScript typecheck passed;
- production build passed.

## Objective

Add the storage-agnostic repository and application-service boundary for Phase 3 product composition while preserving the domain rules established by 3.1A and 3.1B.

3.1C makes component CRUD usable without React and protects active Product/Material relationships from lifecycle changes that would silently invalidate an active composition.

## Repository boundary

Added:

```text
src/application/productComponents/ProductComponentRepository.ts
src/application/productComponents/InMemoryProductComponentRepository.ts
```

The repository contract supports:

- list;
- find by component ID;
- insert;
- replace;
- delete.

The in-memory implementation normalizes lookup identity through trimmed, case-insensitive IDs and defensively clones records on seed, read, insert, and replace.

No Excel/spreadsheet cells or filesystem concepts leak into the repository/service boundary.

## Application service

Added:

```text
src/application/productComponents/ProductComponentService.ts
```

Operations include:

- `createComponent()`;
- `updateComponent()`;
- `getComponent()`;
- `listComponents()`;
- `listComponentsByParent()`;
- `removeComponent()`.

Filtering supports parent Product, source type, source ID, structural role, and text query.

Returned component records are defensively cloned.

## Save-time validation sequence

Create/update operations enforce the following boundary before persistence:

1. normalize the authoritative `ProductComponent` source record;
2. validate the 3.1A component contract;
3. resolve the parent Product;
4. require the writable parent Product to be active;
5. resolve the Material/Product source;
6. require the source to be active for an active parent;
7. require material-backed components to resolve to count-based (`pc`) Material sources;
8. reject duplicate component IDs;
9. validate the proposed complete composition graph through the 3.1B duplicate-source/self/cycle gate;
10. persist only after all checks pass.

Product-backed source graph identity remains the responsibility of the 3.1B graph validator, so direct and transitive cycles cannot be introduced through the service.

## Historical archived-parent policy

An archived Product retains its existing component lines for inspection/history.

3.1C does not allow new/changed component lines on an archived parent. After a parent is archived, its retained source Product/Material may subsequently be archived because the relationship is no longer an active-parent dependency.

Reactivating the parent is guarded: all retained component sources must again exist and be active, material-backed sources must still be `pc`, and the full graph must remain valid.

## Archive and lifecycle dependency guards

Added:

```text
src/application/productComponents/ProductComponentRelationshipGuard.ts
```

`ProductComponentService` implements the guard and is injected into `MaterialService` and `ProductService`.

Protected lifecycle paths include:

- `MaterialService.archiveMaterial()`;
- `MaterialService.updateMaterial(..., { isActive: false })`;
- material updates that would change a required discrete source away from base unit `pc`;
- `ProductService.archiveProduct()`;
- `ProductService.updateProduct(..., { isActive: false })`;
- Product reactivation when retained component sources are invalid or archived.

A source Material/Product cannot be archived while at least one active parent Product depends on it.

Archiving the parent Product itself remains valid when that parent is not required as a component by another active Product; its composition lines are retained as historical data.

## BusinessDataset source data

`BusinessDataset` now includes:

```text
productComponents: ProductComponent[]
```

This is authoritative composition source data.

No derived component cost, stock availability, production capacity, or pricing data is stored on this array.

Excel mapping remains deferred to Phase 5 exactly as planned.

## Shared application session

`src/application/session.ts` now exposes and wires:

```text
productComponentRepository
productComponentService
```

The same shared component service is used as the lifecycle relationship guard by Product and Material application services.

This keeps Product/Material lifecycle enforcement aligned with the same component repository used for composition CRUD.

## Error contract

3.1C application errors include:

```text
COMPONENT_NOT_FOUND
DUPLICATE_COMPONENT_ID
PARENT_PRODUCT_NOT_FOUND
PARENT_PRODUCT_INACTIVE
SOURCE_MATERIAL_NOT_FOUND
SOURCE_MATERIAL_INACTIVE
SOURCE_PRODUCT_NOT_FOUND
SOURCE_PRODUCT_INACTIVE
ACTIVE_PARENT_DEPENDS_ON_MATERIAL
ACTIVE_PARENT_DEPENDS_ON_PRODUCT
ACTIVE_PARENT_REQUIRES_COUNT_MATERIAL
```

Existing 3.1A `ProductComponentError` and 3.1B `ProductCompositionGraphError` remain authoritative for component-shape/count-source and duplicate/cycle failures respectively.

## Validation coverage

The dedicated 3.1C service suite covers:

- create normalization;
- parent listing;
- repository/service defensive cloning;
- update;
- filter/search;
- remove;
- missing/archived parent rejection;
- archived material rejection;
- non-count material rejection;
- duplicate component ID rejection;
- duplicate parent/source identity rejection;
- transitive cycle rejection;
- Material archive protection;
- generic Material deactivation protection;
- active component Material `pc` invariant protection;
- Product child archive protection;
- generic Product deactivation protection;
- archived-parent historical reference retention;
- Product reactivation protection;
- typed missing-component removal error.

## Explicit deferrals

Not implemented in 3.1C:

- ProductStock;
- finished component availability;
- component cost roll-up;
- recursive cost services;
- component-limited assembly capacity;
- inventory reservations/deductions/transactions;
- React composition editor;
- Excel persistence.

Those remain in Phase 3.2+ and Phase 5 according to the locked roadmap.

## Completion gate state

Feature-head gates passed:

- component CRUD testable without React;
- active parents cannot save invalid/archived source relationships;
- source archive/update paths cannot silently break active parent compositions;
- storage technology remains outside domain/application logic;
- complete typecheck/tests/build are green.

Remaining before 3.1C may be marked fully complete:

- merge implementation PR to `develop`;
- verify exact post-merge `develop` CI is green.

## Next task after closeout

**3.2A — Product Stock Contract & Validation**

Do not begin 3.2A until the 3.1C merge and post-merge `develop` CI gate are green.
