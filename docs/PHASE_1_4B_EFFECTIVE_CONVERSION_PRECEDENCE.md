# Phase 1.4B — Effective Conversion Precedence

## Status

**FEATURE CI PASSED — MERGE GATE**

Branch: `feature/phase-1-4b-effective-conversion-precedence`

Base: `develop`

PR: `#14`

## Objective

Integrate material-specific cup-to-weight calibration into package costing and on-hand stock normalization using one explicit, explainable precedence model.

The system must never silently treat a dry-material cup as grams.

## Locked precedence rules

### Ordinary purchase/package conversion

For compatible same-dimension measurement units and non-standard package labels:

```text
manual package conversion
    ↓ if absent
standard same-dimension conversion
    ↓ if absent
controlled error
```

Example:

```text
1 kg plaster
standard = 1,000 g/kg
manual override = 950 g/kg

effective = 950 g/kg
source = manual
```

### Dry cup-to-weight conversion

For a weight-based material (`baseUnit = g`) using `cup`:

```text
latest valid material calibration
    ↓ if absent
explicit manual g/cup fallback
    ↓ if absent
controlled error
```

Example:

```text
Calibration evidence:
5 cups = 1,000 g

Derived:
200 g/cup

On hand:
3 cups

Normalized:
600 g
source = calibration
```

Calibration intentionally outranks a manual g/cup fallback because it represents material-specific measured evidence.

## Material contract bridge

The structural Material contract now permits one explicit cross-dimension source combination:

```text
cup -> g
```

This does **not** mean the contract knows how to convert it. It only permits the record to reach the Phase 1.4 resolver.

Other incompatible combinations remain rejected, including `L -> g`, `mL -> g`, `cup -> pc`, and `kg -> mL`.

## Package costing integration

`calculateMaterialPackageCosting(material, calibrationEvidence)` now reports the standard, manual, calibration, and effective conversion values; the effective source; calibration ID when used; package base quantity; and cost per base unit.

For dry cup purchases, calibration is applied before the manual fallback.

## On-hand normalization integration

`normalizeMaterialOnHand(material, calibrationEvidence)` supports compatible standard conversion, calibrated cup-to-gram conversion, manual g/cup fallback when cup is also the configured purchase unit, and configured purchase-package conversion.

It reports the source as `standard`, `calibration`, `manual`, or `purchase-package`. For purchase-package stock, the underlying package conversion source is also exposed.

## Inventory valuation integration

`calculateMaterialInventoryValuation(material, calibrationEvidence)` passes the same calibration evidence through stock normalization and package costing.

```text
Purchase: 1 kg plaster = ₱66
Cost per gram = ₱0.066
Calibration: 5 cups = 1,000 g = 200 g/cup
On hand: 3 cups = 600 g
Inventory value: 600 × ₱0.066 = ₱39.60
```

## Controlled failure behavior

- dry cup stock/costing with no calibration or manual fallback -> material calibration required
- unrelated cross-dimension unit -> unresolved cross-dimension error
- unrelated package label -> unresolved package error
- invalid manual conversion -> invalid manual conversion error
- invalid/foreign calibration sample -> calibration-domain error

There is still no universal `cup -> g` conversion in the shared unit engine.

## Application/UI boundary

Phase 1.4B establishes the domain precedence and calculation contract. The existing Materials UI does not yet create/manage calibration records or automatically offer calibrated cup input.

That wiring belongs to **Phase 1.4C — Calibration UI & Tests**, which will provide calibration CRUD/session storage, material selection, measurement entry, saved evidence, and application/UI use of the effective calibration.

## Automated coverage

Tests cover structural acceptance of the `cup -> g` bridge, rejection of unrelated cross-dimension units, standard conversion, manual-over-standard package precedence, calibration-over-manual dry-cup precedence, manual g/cup fallback, missing-calibration failure, calibrated stock normalization, latest-calibration selection, unresolved conversions, and calibrated inventory valuation.

## Feature validation evidence

PR `#14` feature CI passed:

- dependency installation passed
- TypeScript typecheck passed
- conversion-precedence tests passed
- full regression test suite passed
- production build passed

## Remaining completion gate

- final PR-head CI after this documentation update
- merge PR `#14` into `develop`
- confirm post-merge `develop` CI

Next task after completion: **1.4C — Calibration UI & Tests**.
