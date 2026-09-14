# Phase 3.1A — Product Component Contract & Roles

## Status

**IMPLEMENTED — VALIDATION / MERGE GATE**

Feature branch: `feature/phase-3-1a-component-contract`

Authoritative base:

`develop` @ `fce7477dc23ef51ffb14d7cacdfabef3a243f4ea`

## Objective

Replace the loose Phase 3 `ProductComponent` scaffold with the authoritative storage-agnostic source contract for discrete product composition.

This phase defines component source facts only. Graph recursion/cycle rules remain 3.1B and repository/application relationship validation remains 3.1C.

## Authoritative contract

```text
ProductComponent
- id
- parentProductId
- sourceType: material | product
- sourceId
- role
- quantityPerParent
- notes?
```

No derived cost, availability, inventory capacity, or rolled-up totals are persisted on this contract.

## Source kinds

### `material`

Used for purchased/count-based physical components such as:

- glass candle vessels;
- plastic cups;
- stainless cups;
- other purchased discrete accessories/components.

A material-backed component must resolve to a Material whose canonical base unit is `pc`.

### `product`

Used for handmade or nested business products such as:

- plaster candle pots;
- mini molded hearts;
- mini stars;
- mini flowers;
- nested subassemblies.

Product identity existence, active-state relationships, direct self-reference, and transitive cycle validation are deliberately deferred to 3.1B/3.1C.

## Structural roles

Authoritative roles:

```text
vessel
molded-component
decorative-component
insert
accessory
other
```

Role is semantic/structural metadata and does not change costing mathematics by itself.

The old prototype values `decoration` and `packaging` are not part of the final Phase 3 component-role contract. Direct packaging material remains Phase 2 fixed-recipe territory unless it genuinely participates as a discrete composed component.

## Quantity rule

`quantityPerParent` represents physical piece count and must be:

- finite;
- an integer;
- greater than zero.

Examples:

```text
Glass cup × 1       valid
Mini heart × 3      valid
Mini flower × 4     valid
Mini star × 1.5     invalid
Mini star × 0       invalid
```

## Duplicate source identity policy

The Phase 3 baseline permits one composition line for the tuple:

```text
parentProductId + sourceType + sourceId
```

Identity comparison is case-insensitive after trimming IDs.

Role is intentionally excluded from duplicate identity. A physical source should be represented once per parent and its quantity combined rather than duplicated under several roles.

3.1A provides deterministic source-key/equality helpers. Collection-level duplicate enforcement is performed in the graph/service phases.

## Normalization

`normalizeProductComponent()`:

- trims component ID;
- trims parent product ID;
- trims source ID;
- trims notes;
- converts blank notes to `undefined`.

Application services in 3.1C will normalize before persistence.

## Material-backed compatibility helper

`validateMaterialBackedProductComponent()` validates that:

- the component is actually `material`-backed;
- the referenced source ID matches the supplied Material;
- the Material base unit is canonical `pc`.

This keeps wax/plaster/water/fragrance and other continuous consumables in the Phase 2 recipe/yield model instead of incorrectly treating them as discrete components.

## Explicit deferrals

Not implemented in 3.1A:

- direct self-reference rejection;
- transitive graph-cycle prevention;
- graph traversal/path reporting;
- component repositories/CRUD;
- Product/Material active-state relationship guards;
- archive dependency guards;
- `BusinessDataset.productComponents` persistence;
- finished component stock;
- recursive cost roll-up;
- component-aware capacity;
- React composition UI.

## Validation coverage

Tests cover:

- both valid source kinds;
- all authoritative structural roles;
- malformed IDs;
- unsupported source types/roles;
- finite/positive/whole-piece quantity rules;
- deterministic normalization and cloning;
- case-insensitive duplicate source identity;
- material source identity matching;
- rejection of non-count materials as discrete component sources.

## Completion gate

3.1A is complete only after:

- feature-head typecheck passes;
- complete regression tests pass;
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI succeeds.

## Next task after completion

**3.1B — Composition Graph Integrity & Cycle Prevention**
