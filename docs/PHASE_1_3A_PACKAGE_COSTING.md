# Phase 1.3A — Package Cost / Base-Unit Costing

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-3a-package-costing`

Base: `develop`

## Objective

Derive deterministic package conversion and cost-per-base-unit values from authoritative Material source inputs without persisting spreadsheet-style calculated fields.

## Formula

```text
package base quantity
= purchase quantity × effective base-units-per-purchase-unit

cost per base unit
= package cost ÷ package base quantity
```

Example:

```text
Purchase quantity: 1
Purchase unit: kg
Base unit: g
Package cost: ₱66

Standard conversion: 1 kg = 1,000 g
Effective conversion: 1,000 g/kg
Package base quantity: 1,000 g
Cost per base unit: ₱0.066/g
```

## Conversion precedence

The costing engine uses one explicit precedence rule:

```text
manual conversion
    ↓ when absent
standard same-dimension conversion
    ↓ when absent
controlled MISSING_PACKAGE_CONVERSION error
```

An explicitly entered manual conversion overrides a standard conversion.

Example:

```text
Purchase unit: kg
Base unit: g
Standard: 1 kg = 1,000 g
Manual:   1 kg = 950 g

Effective conversion = 950 g/kg
Source = manual
```

This supports real packaging or usable-content exceptions without changing the universal unit catalog.

## Non-standard package labels

Package labels such as:

- bag
- bottle
- box
- can
- jar
- pack
- pouch
- roll
- set
- sheet
- spool
- tube

have no universal measurement conversion.

Therefore a material such as:

```text
1 pack = 100 labels
```

must provide:

```text
manualBaseUnitsPerPurchaseUnit = 100
```

before package costing can be calculated or persisted through MaterialService.

## Derived result

`calculateMaterialPackageCosting()` returns:

- standard base units per purchase unit, or `null`
- manual base units per purchase unit, or `null`
- effective base units per purchase unit
- effective conversion source: `manual` or `standard`
- package base quantity
- cost per base unit

These are derived values and are not added to the authoritative `Material` record.

## Controlled errors

The domain exposes controlled errors for:

- non-finite purchase quantity
- zero/negative purchase quantity
- non-finite package cost
- negative package cost
- invalid manual conversion
- missing package conversion

This prevents divide-by-zero and silent package assumptions.

## MaterialService integration

Create/update operations now run both:

1. structural Material contract validation
2. package costing validation

This keeps conversion/costing rules below React and future Excel import/persistence boundaries.

## Materials UI

The Materials screen now visibly separates:

- Standard conversion
- Manual conversion
- Effective conversion
- Package base quantity
- Cost per base unit

The table also shows package price plus derived cost/base-unit for saved materials.

Manual conversion is visible for both standard units and package labels:

- standard unit: optional override
- package label: required conversion

## Out of scope

- on-hand quantity normalization (1.3B)
- inventory valuation (1.3C)
- dry cup-to-weight calibration (1.4)
- Excel persistence (Phase 5)

## Automated coverage

Tests cover:

- kg → g package costing
- fractional/multi-unit package quantities
- count-based pc costing
- non-standard package labels
- manual override precedence over standard conversion
- zero-cost valid packages
- zero/negative purchase quantity rejection
- non-finite inputs
- negative package cost rejection
- missing package conversion
- invalid manual conversion
- MaterialService persistence boundary

## Completion gate

Phase 1.3A is complete only after:

- TypeScript typecheck passes
- domain/application tests pass
- production build passes
- feature PR CI passes
- PR merges into `develop`
- post-merge `develop` CI passes

Next task after completion: **1.3B — On-Hand Quantity Normalization**.
