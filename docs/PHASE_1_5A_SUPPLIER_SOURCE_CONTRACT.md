# Phase 1.5A — Supplier / Source Contract

## Status

**FEATURE CI PASSED — MERGE GATE**

Branch: `feature/phase-1-5a-supplier-source-contract`

Base: `develop`

PR: `#17`

## Objective

Give every material an optional, lightweight way to remember where it was sourced and how to buy it again, without introducing a full supplier-management module or coupling supplier details to costing.

## Contract

A material may carry optional `source` metadata with these fields:

- `vendorName` — store, seller, or supplier name
- `source` — branch, marketplace shop, platform, contact person, or other source detail
- `purchaseLink` — direct product/re-order URL
- `contactNumber` — phone or messaging number
- `socialPage` — social page URL, handle, or page name
- `notes` — buying notes, preferred variant, minimum order, delivery detail, etc.

Example:

```ts
source: {
  vendorName: 'Divisoria Craft Supply',
  source: '168 Mall branch',
  purchaseLink: 'https://example.com/plaster',
  contactNumber: '0917 555 0101',
  socialPage: '@divisoriacrafts',
  notes: 'Ask for wholesale price',
}
```

## Design decisions

### Lightweight embedded metadata

Phase 1 deliberately does **not** create a standalone `Supplier` entity, supplier repository, or supplier CRUD screen.

The metadata is embedded in the material source record so the system can answer a practical question immediately:

> Where did I buy this material and how do I buy it again?

The contract is isolated in `src/domain/materialSource.ts`, so a later migration to a dedicated Supplier entity can be introduced without changing package costing, calibration, or inventory formulas.

### Costing independence

Supplier/source metadata does not participate in package conversion, cost per base unit, calibration, on-hand normalization, or inventory valuation. Changing a vendor name or purchase URL cannot change material costing results.

### Partial information is allowed

A user does not need every supplier field. Any meaningful field is sufficient, for example only vendor name, purchase link, or contact number. An all-empty metadata object is normalized away rather than stored.

### Purchase-link safety

`purchaseLink` must be a valid `http` or `https` URL. Other source fields remain free-form because phone numbers, social handles, marketplace names, and branch descriptions vary by country and platform.

## Application integration

`MaterialService` now trims supplier/source values, removes blank fields, validates purchase links, includes source/vendor fields in material search, and returns deep-cloned source metadata.

`InMemoryMaterialRepository` also deep-clones the nested source object so returned records cannot mutate stored supplier metadata by reference.

## Automated coverage

Tests cover valid/partial metadata, normalization, empty metadata collapse, non-text runtime inputs, purchase-link schemes, persistence, supplier-aware search, invalid source rejection, and nested mutation isolation.

## Feature validation evidence

PR #17 feature CI passed:

- dependency installation
- TypeScript typecheck
- supplier/source domain tests
- MaterialService source integration tests
- full regression test suite
- production build

## Out of scope

Visible supplier/source fields in the Materials form/table belong to **1.5B — Materials UI Integration**.

## Remaining completion gate

- final PR-head CI after status update
- merge PR #17 into `develop`
- post-merge `develop` CI

Next task after completion: **1.5B — Materials UI Integration**.
