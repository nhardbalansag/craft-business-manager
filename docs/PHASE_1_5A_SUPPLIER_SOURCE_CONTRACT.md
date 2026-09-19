# Phase 1.5A — Supplier / Source Contract

## Status

**COMPLETE**

Implementation PR: `#17`

Implementation merge commit: `00e37f44865a67ccc209d94f2edfa621cc704b05`

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

The model is deliberately embedded/lightweight. A standalone Supplier entity remains a future extension and is not required for Phase 1.

## Rules

- supplier/source metadata never participates in costing, calibration, stock normalization, or inventory valuation
- partial metadata is allowed
- all-blank metadata is normalized away
- purchase links must use `http` or `https`
- phone/social/source text stays free-form
- nested source records are deep-cloned across repository/service boundaries
- existing material search includes supplier/source text

## Validation evidence

PR #17 passed:

- dependency installation
- TypeScript typecheck
- supplier/source domain tests
- MaterialService source integration tests
- full regression test suite
- production build

Post-merge `develop` CI run `34824257561` passed on commit `00e37f44865a67ccc209d94f2edfa621cc704b05`.

## Next task

**1.5B — Materials UI Integration**
