# Phase 2.1C — Product / Mix Repositories & Application Services

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-2-1c-product-mix-services`

Base: `develop` at `ef0faf9375a15ceaf2f54850da85e500641a9b41`.

## Objective

Make Phase 2 products and mix presets operational through application services while preserving the repository/storage boundary established in Phase 1.

```text
Future React UI
    ↓
ProductService / MixPresetService
    ↓
ProductRepository / MixPresetRepository
    ↓
In-memory repositories now
Excel-backed repositories in Phase 5
SQLite-compatible implementations later
```

## Product operations

`ProductService` supports:

- create;
- update;
- retrieve;
- list/search/filter by category/active state;
- archive/deactivate;
- case-insensitive duplicate ID protection;
- case-insensitive duplicate name protection;
- product-to-mix reference validation.

### Product / mix integrity

When a product references a mix preset:

- the preset must exist;
- its compatible categories must include the product category;
- an active product requires an active preset;
- archived products may retain an archived preset for historical continuity.

## Mix-preset operations

`MixPresetService` supports:

- create;
- update;
- retrieve;
- list/search/filter by basis/category/active state;
- archive/deactivate;
- case-insensitive duplicate ID/name protection;
- referenced-material validation;
- active-product dependency protection.

### Material-reference rule

Every mix line must reference an existing material.

An active mix may reference only active materials. An archived mix may retain archived-material references so historical definitions are not destroyed.

### Reverse relationship rule

An active product protects its referenced mix from changes that would invalidate the product.

Therefore a mix cannot be:

- archived while an active product uses it; or
- updated so the active product category is no longer compatible.

After dependent products are archived or moved to another valid preset, the mix may be archived.

## Repository rules

Both repositories:

- are storage-agnostic ports;
- currently have in-memory implementations;
- use case-insensitive identity keys;
- return defensive clones;
- never expose mutable stored references.

`InMemoryMixPresetRepository` deep-clones both:

- `compatibleCategories[]`;
- nested `lines[]`.

This prevents callers from mutating stored mix definitions by reference.

## Session composition

The shared application session now exposes:

- `productRepository`;
- `mixPresetRepository`;
- `productService`;
- `mixPresetService`.

No React Product/Mix UI is introduced in 2.1C; UI remains Phase 2.5A.

## Files

- `src/application/products/ProductRepository.ts`
- `src/application/products/InMemoryProductRepository.ts`
- `src/application/products/ProductService.ts`
- `src/application/mixPresets/MixPresetRepository.ts`
- `src/application/mixPresets/InMemoryMixPresetRepository.ts`
- `src/application/mixPresets/MixPresetService.ts`
- `src/application/productMixServices.test.ts`
- `src/application/session.ts`

## Completion gate

2.1C may be marked complete after:

- TypeScript typecheck passes;
- Product/Mix service tests pass;
- defensive-clone tests pass;
- full regression suite passes;
- production build passes;
- feature PR CI passes;
- PR merges into `develop`;
- post-merge `develop` CI passes.

After completion, **2.1 — Product & Mix Foundation** is complete.

Next task: **2.2A — Yield Sample Evidence Contract**.
