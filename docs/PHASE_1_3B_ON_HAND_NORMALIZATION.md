# Phase 1.3B — On-Hand Quantity Normalization

## Status

**FEATURE CI PASSED — MERGE GATE**

Branch: `feature/phase-1-3b-on-hand-normalization`

Base: `develop`

PR: `#11`

## Objective

Convert user-entered current stock into the material's canonical base unit while preserving the entered quantity/unit as source data.

Canonical units remain:

- weight → `g`
- volume → `mL`
- count → `pc`

## Standard-unit normalization

Standard same-dimension units use the shared conversion engine.

Examples:

```text
2.5 kg plaster → 2,500 g
1.5 L water → 1,500 mL
40 pc wicks → 40 pc
```

The normalization formula is:

```text
normalized base quantity
= entered on-hand quantity × base-units-per-on-hand-unit
```

## Package-label normalization

A package label such as `pack`, `box`, `bag`, or `bottle` is not a universal measurement unit.

An on-hand package label is therefore accepted only when it is the same configured purchase package for the material and has an authoritative effective package conversion.

Example:

```text
Purchase unit: pack
Manual conversion: 100 pc / pack
On hand: 0.5 pack

Normalized on hand = 0.5 × 100 = 50 pc
```

The system does not guess between unrelated package labels.

Example rejected state:

```text
Purchase unit: pack
On-hand unit: box
```

unless a future model explicitly defines a box conversion.

## Conversion source

`normalizeMaterialOnHand()` returns:

- entered quantity
- entered unit
- canonical base unit
- base units per entered on-hand unit
- normalized base quantity
- conversion source: `standard` or `purchase-package`

The normalized value is derived and is not persisted as the authoritative stock source value.

## Service boundary

`MaterialService` create/update now validates:

1. material structural contract
2. package costing/conversion
3. on-hand normalization

This prevents invalid stock-unit states from being saved by React or future import/persistence clients.

## UI behavior

The Materials UI now:

- limits stock-unit choices to compatible standard units
- additionally allows the configured purchase package when that package is a non-standard label
- displays entered stock separately from normalized stock
- shows the stock conversion factor and source
- displays normalized stock in the materials table

## Negative quantity rule

The normalization engine deliberately preserves negative finite quantities mathematically.

The business rule that inventory cannot be negative belongs to **Phase 1.3C — Inventory Valuation & Validation**, as defined in the Phase 1 plan. The current UI already prevents negative entry through its number-input minimum.

## Dry volume-to-weight rule

Dry cross-dimension conversion such as:

```text
cup plaster → g
```

is still unavailable here.

That requires **Phase 1.4 — Material-Specific Calibration**. The system must not silently use `240 g/cup`; the standard cup value is `240 mL/cup` only.

## Automated coverage

Tests cover:

- kg → g stock normalization
- L → mL stock normalization
- pc → pc stock normalization
- fractional quantities
- matching package-label normalization
- rejection of unrelated package labels
- non-finite stock rejection
- negative quantity preservation for later validation
- MaterialService persistence boundary

## Feature validation evidence

- dependency installation passed
- TypeScript typecheck passed
- normalization/domain tests passed
- application boundary tests passed
- full automated test suite passed
- production build passed
- feature PR CI passed

## Remaining completion gate

- final PR-head CI after this documentation update
- merge PR `#11` into `develop`
- post-merge `develop` CI passes

Next task after completion: **1.3C — Inventory Valuation & Validation**.
