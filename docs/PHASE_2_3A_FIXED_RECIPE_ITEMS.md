# Phase 2.3A — Fixed Recipe Item Contract & Material Roles

## Status

**COMPLETE**

Implementation PR: **#38**

Implementation merge commit: `2fbe12437328d70f3aa155bde49a49603ddbf69a`

Post-merge CI run: `34835244976` — **SUCCESS**

## Objective

Represent materials consumed at a fixed amount per sellable product without storing derived canonical quantities as authoritative source data.

Examples:

- 1 wick per candle;
- 1 label per candle;
- 1 brush per paintable-art kit;
- 2 mL paint per kit;
- direct packaging material such as a label/box where it is a flat stocked material.

## Authoritative contract

```text
FixedRecipeItem
- id
- productId
- materialId
- quantityPerProduct
- unit
- role
- notes?
```

Derived base quantity is intentionally not persisted.

## Roles

```text
consumable
additive
finish
packaging
other
```

Role is descriptive. Material identity remains the key input used for requirement synthesis.

## Quantity and unit rules

- quantity must be finite and greater than zero;
- unit must be a supported Phase 1 measurement unit;
- package labels such as `pack`, `box`, or `bag` are not fixed-recipe measurement units;
- source quantity/unit remain unchanged;
- canonical quantity is derived through the shared Phase 1 material quantity normalizer.

Conversion behavior:

```text
same-dimension measurement -> standard conversion
cup -> g                  -> latest material calibration
cup -> g without sample   -> explicit manual g/cup fallback when configured
other cross-dimension     -> controlled error
```

The same normalizer is used by yield learning, preventing conversion-rule drift between yield and fixed recipe inputs.

## Duplicate policy

A product may have only one fixed recipe line for a given material.

```text
product + material -> unique
```

If the same material is used at multiple fixed steps, combine its fixed amount into one source line and use role/notes to explain intent.

This gives Phase 2.3B one deterministic fixed amount to combine with any yield-derived amount for the same material.

## Reference rules

Creating/updating a fixed recipe line requires:

- existing active product;
- existing active material;
- quantity/unit that can be normalized for that material.

Stored lines may still be read after a product/material is later archived; changes require active references.

## Phase 3 boundary

Materials classified as `container` are rejected from the fixed recipe contract.

Purchased vessels and molded/nested vessel components require Phase 3 component semantics, where component quantity and limiting capacity can be handled correctly.

Examples that belong to Phase 3 rather than 2.3A:

- glass candle vessel;
- stainless cup vessel;
- molded plaster pot used by a candle;
- nested molded child pieces.

Direct packaging consumables such as labels or simple stocked boxes may remain Phase 2 fixed recipe items when they do not require component semantics.

## Application boundary

Delivered:

- `FixedRecipeItemRepository`;
- `InMemoryFixedRecipeItemRepository`;
- `FixedRecipeItemService`;
- create/update/get/list/remove operations;
- duplicate ID protection;
- one-product/material-line protection;
- active product/material reference validation;
- canonical requirement derivation for a single fixed line;
- shared-session composition.

`BusinessDataset.recipeItems` replaces the old `ProductRecipeItem` prototype scaffold.

## Validation evidence

The final implementation passed:

- TypeScript typecheck;
- fixed recipe contract tests;
- standard and calibrated quantity normalization tests;
- duplicate product/material tests;
- active reference and Phase 3 vessel-boundary tests;
- the full existing regression suite;
- production build;
- feature PR merge into `develop`;
- post-merge `develop` CI.

## Deferred

- combining fixed and yield-derived requirements: **2.3B**;
- full recipe material-cost preview: **2.3C**;
- safety waste: **2.4**;
- recipe/product UI: **2.5**;
- vessels and nested components: **Phase 3**.

Next task: **2.3B — Effective Per-Piece Material Requirements**.
