# Phase 2.1C — Product / Mix Repositories & Application Services

## Status

**COMPLETE**

Implementation branch: `feature/phase-2-1c-product-mix-services`

Implementation base: `develop` at `ef0faf9375a15ceaf2f54850da85e500641a9b41`.

Implementation PR: **#30**

Merge commit: `e5faa7f57adc0424b4ebf104700ca86d2882f171`

Post-merge CI run: `34830919088` — **SUCCESS**

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
- archived products may retain an archived preset for historical continuity, but category compatibility still remains valid.

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

## Validation evidence

The completion gate passed:

- TypeScript typecheck — PASS;
- Product/Mix service tests — PASS;
- defensive-clone tests — PASS;
- full regression suite — PASS;
- production build — PASS;
- feature PR #30 CI — PASS after one corrected test fixture;
- PR #30 merged into `develop`;
- post-merge CI run `34830919088` — PASS.

The initial CI failure was isolated to a test fixture that expected an archived product to accept a category-incompatible mix. The service rule was intentionally retained: archive status relaxes the active-preset requirement, not semantic category compatibility.

## Phase result

With 2.1A, 2.1B, and 2.1C complete, **2.1 — Product & Mix Foundation is COMPLETE**.

Next task: **2.2A — Yield Sample Evidence Contract**.
