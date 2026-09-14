# Phase 1.3C — Inventory Valuation & Validation

## Status

**FEATURE CI PASSED — MERGE GATE**

Branch: `feature/phase-1-3c-inventory-valuation`

Base: `develop`

PR: `#12`

## Objective

Calculate the current value of each material's inventory from authoritative source inputs and formally enforce inventory-validity rules before material records can be persisted.

## Formula

```text
inventory value
= normalized on-hand base quantity × cost per base unit
```

Example:

```text
Material: Plaster of Paris
Purchase: 1 kg for ₱66
Cost per g: ₱0.066
On hand: 0.6 kg
Normalized on hand: 600 g

Inventory value = 600 × ₱0.066 = ₱39.60
```

Count-based example:

```text
100 wicks purchased for ₱80
Cost per wick = ₱0.80
On hand = 40 pc
Inventory value = ₱32.00
```

## Validation boundary

`calculateMaterialInventoryValuation()` composes the existing Phase 1.3 capabilities:

1. package costing / effective package conversion
2. on-hand normalization
3. inventory business validation
4. current inventory valuation

The lower-level normalization function still preserves negative finite quantities mathematically, but valuation/persistence rejects negative inventory with a controlled `NEGATIVE_ON_HAND_QUANTITY` domain error.

This keeps conversion logic reusable while making the actual material inventory state business-safe.

## Existing validation reused

Inventory valuation intentionally reuses existing controlled errors rather than duplicating rules:

- invalid or missing purchase-package conversion → package-costing error
- negative package cost → package-costing error
- non-finite stock → inventory-normalization error
- unresolved package stock unit → inventory-normalization error
- incompatible standard unit → material contract error
- negative stock → inventory-valuation error

Dry cross-dimension stock such as plaster entered in `cup` with base unit `g` remains unavailable until Phase 1.4 material-specific calibration.

## Derived result

`calculateMaterialInventoryValuation()` returns:

- normalized base quantity
- canonical base unit
- cost per base unit
- current inventory value

These are derived values and are not stored as authoritative Material fields.

## MaterialService integration

Create/update operations now validate:

1. Material structural contract
2. composed inventory valuation

The valuation call transitively validates package costing and stock normalization, then applies the negative-stock business rule.

This keeps invalid states out of current in-memory storage and future Excel/import persistence boundaries.

## Materials UI

The Materials screen now displays:

- entered stock
- normalized stock
- stock conversion factor/source
- cost per base unit
- current inventory value

The material table also shows each material's derived inventory value.

## Automated coverage

Tests cover:

- weight inventory valuation
- count inventory valuation
- package-label stock valuation
- zero stock
- negative stock rejection
- missing package conversion propagation
- negative package cost propagation
- MaterialService create/update negative-inventory rejection

## Feature validation evidence

- dependency installation passed
- TypeScript typecheck passed
- inventory valuation domain tests passed
- MaterialService inventory-boundary tests passed
- full regression test suite passed
- production build passed
- PR #12 feature CI passed

## Remaining completion gate

Phase 1.3C is complete only after:

- final PR-head CI passes after documentation update
- PR #12 merges into `develop`
- post-merge `develop` CI passes

When this gate passes, **Phase 1.3 — Purchase Costing & Inventory Quantity** is fully complete.

Next task after completion: **1.4A — Cup-to-Weight Calibration Model**.
