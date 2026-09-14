# Phase 1.5A — Supplier / Source Contract

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-5a-supplier-source-contract`

Base: `develop`

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

Supplier/source metadata does not participate in:

- package conversion
- cost per base unit
- calibration
- on-hand normalization
- inventory valuation

Changing a vendor name or purchase URL cannot change material costing results.

### Partial information is allowed

A user does not need every supplier field. Any meaningful field is sufficient, for example only:

- vendor name, or
- purchase link, or
- contact number.

An all-empty metadata object is normalized away rather than stored.

### Purchase-link safety

`purchaseLink` must be a valid `http` or `https` URL.

Other source fields remain free-form. This is intentional because phone numbers, social handles, marketplace names, and branch descriptions vary substantially by country and platform.

## Application integration

`MaterialService` now:

- trims supplier/source values before persistence
- removes blank optional values
- validates purchase links
- includes source/vendor fields in existing material search
- returns deep-cloned source metadata

`InMemoryMaterialRepository` now deep-clones the nested source object so callers cannot mutate stored supplier metadata through a returned object reference.

## Automated coverage

Tests cover:

- valid full supplier/source metadata
- partial metadata
- whitespace normalization
- all-empty metadata collapse
- runtime rejection of non-text fields
- purchase-link scheme validation
- MaterialService source persistence
- supplier/source search
- invalid source rejection before persistence
- nested source mutation isolation

## Out of scope

Phase 1.5A does not add visible supplier fields to the Materials form/table.

That belongs to:

**1.5B — Materials UI Integration**

## Completion gate

Phase 1.5A is complete only after:

- TypeScript typecheck passes
- supplier/source domain tests pass
- MaterialService integration tests pass
- all regression tests pass
- production build passes
- feature PR CI passes
- PR merges into `develop`
- post-merge `develop` CI passes

Next task after completion: **1.5B — Materials UI Integration**.
