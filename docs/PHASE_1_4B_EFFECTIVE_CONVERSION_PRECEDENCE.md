# Phase 1.4B — Effective Conversion Precedence

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-4b-effective-conversion-precedence`

Base: `develop`

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

Other incompatible combinations remain rejected, for example:

- L -> g
- mL -> g
- cup -> pc
- kg -> mL

## Package costing integration

`calculateMaterialPackageCosting(material, calibrationEvidence)` now reports:

- standard conversion when available
- manual conversion when supplied
- calibration conversion when applicable
- effective conversion
- effective conversion source
- effective calibration ID when calibration was used
- package base quantity
- cost per base unit

For dry cup purchases, calibration is applied before the manual fallback.

## On-hand normalization integration

`normalizeMaterialOnHand(material, calibrationEvidence)` now supports:

- compatible standard unit conversion
- calibrated cup-to-gram conversion
- manual g/cup fallback when `cup` is also the configured purchase unit
- purchase-package conversion

It reports the effective source as one of:

- `standard`
- `calibration`
- `manual`
- `purchase-package`

When a purchase package is reused for stock normalization, the underlying package conversion source is also reported.

## Inventory valuation integration

`calculateMaterialInventoryValuation(material, calibrationEvidence)` passes the same calibration evidence through both stock normalization and package costing.

Example:

```text
Purchase:
1 kg plaster = ₱66
cost per gram = ₱0.066

Calibration:
5 cups = 1,000 g
200 g/cup

On hand:
3 cups = 600 g

Inventory value:
600 × ₱0.066 = ₱39.60
```

## Controlled failure behavior

The system now distinguishes these cases:

- dry cup stock/costing with no calibration or manual fallback -> material calibration required
- unrelated cross-dimension unit -> unresolved cross-dimension error
- unrelated package label -> unresolved package error
- invalid manual conversion -> invalid manual conversion error
- invalid/foreign calibration sample -> calibration-domain error

There is still no universal `cup -> g` conversion in the shared unit engine.

## Application/UI boundary

Phase 1.4B establishes the domain precedence and calculation contract.

The existing Materials UI does not yet create/manage calibration records or offer calibrated cup input automatically. That wiring belongs to:

**Phase 1.4C — Calibration UI & Tests**

1.4C will provide calibration CRUD/session storage, select materials, save measurement evidence, and pass the effective calibration into material calculations.

## Automated coverage

Tests cover:

- structural acceptance of the `cup -> g` calibration bridge
- continued rejection of unrelated cross-dimension units
- standard package conversion
- manual-over-standard package precedence
- calibration-over-manual dry cup precedence
- manual g/cup fallback without calibration
- missing calibration failure
- calibrated cup stock normalization
- latest-valid-calibration selection during normalization
- manual cup stock fallback
- unresolved cross-dimension rejection
- calibrated inventory valuation

## Completion gate

Phase 1.4B is complete only after:

- TypeScript typecheck passes
- conversion-precedence tests pass
- all regression tests pass
- production build passes
- feature PR CI passes
- PR merges into `develop`
- post-merge `develop` CI passes

Next task after completion: **1.4C — Calibration UI & Tests**.
