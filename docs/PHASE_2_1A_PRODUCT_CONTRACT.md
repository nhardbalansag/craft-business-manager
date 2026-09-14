# Phase 2.1A — Product Contract & Category Rules

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-2-1a-product-contract`

Base: corrected `develop` at `75f9b1f2c2babca68bfe9503f4661045a2255d34`.

## Objective

Establish the authoritative Phase 2 product identity/category contract before mix presets, recipes, yield evidence, capacity calculations, or Product UI are implemented.

## Authoritative Product source fields

```text
Product
- id
- name
- category
- optional mixPresetId
- safetyWasteRate
- optional notes
- isActive
```

The contract intentionally stores source inputs only. It does not store derived recipe cost, learned material usage, production capacity, selling price, profit, or other calculated outputs.

## Locked categories

- `paintable-art`
- `candle-pot`
- `candle`

Category guidance is centralized in `PRODUCT_CATEGORY_RULES`:

| Category | Production style | Typical mix basis | Yield learning |
| --- | --- | --- | --- |
| paintable-art | molded | volume | recommended |
| candle-pot | molded | volume | recommended |
| candle | poured | weight | supported |

These values are guidance for later domain layers. Phase 2.1A does not implement the mix-ratio engine or enforce material compatibility.

## Phase boundaries

The authoritative `Product` contract no longer embeds the old prototype fields for:

- fixed recipe items — Phase 2.3;
- product/component composition and vessels — Phase 3;
- pricing policy / selling price — Phase 4.

The old standalone scaffold types may remain temporarily for downstream helpers until their owning phases replace them, but they are no longer authoritative fields on `Product`.

## Validation

The product contract rejects:

- blank IDs;
- blank names;
- unsupported categories;
- blank `mixPresetId` when one is supplied;
- negative, NaN, or infinite safety-waste rates;
- non-boolean active state values at runtime boundaries.

A product may omit `mixPresetId`, which is required for cases such as products that are not yet configured or single-material products that will be modeled in later phases.

Duplicate ID/name policy is owned by the Product application service in Phase 2.1C, where repository state exists to perform the check.

## Files

- `src/domain/products.ts`
- `src/domain/products.test.ts`
- `src/domain/types.ts`

## Deferred work

- Mix-preset contract and ratio resolution: **2.1B**
- Product / Mix repositories and duplicate enforcement: **2.1C**
- Yield evidence: **2.2**
- Fixed recipe items: **2.3**
- Safety-waste calculations: **2.4**
- Product UI: **2.5**
- Components/vessels: **Phase 3**
- Pricing/profit policy: **Phase 4**

## Completion gate

2.1A may be marked complete after:

- TypeScript typecheck passes;
- product/category contract tests pass;
- full regression tests pass;
- production build passes;
- feature PR CI passes;
- PR merges into `develop`;
- post-merge `develop` CI passes.

Next task after completion: **2.1B — Mix Preset Contract & Ratio Engine**.
