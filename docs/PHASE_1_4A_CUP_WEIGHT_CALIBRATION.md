# Phase 1.4A — Cup-to-Weight Calibration Model

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-4a-cup-weight-calibration`

Base: `develop`

## Objective

Create a material-specific calibration model that can derive a dry material's grams-per-cup relationship from real measurements without introducing any global `cup -> g` conversion.

## Core rule

A cup remains a volume unit:

```text
1 cup = 240 mL
```

A dry-material weight relationship is separate and belongs to one specific material:

```text
Material: Plaster Brand A
Measured volume: 5 cups
Known weight: 1 kg

5 cups = 1,000 g
1 cup = 200 g
```

The system must never infer that every material weighs 200 g/cup or 240 g/cup.

## Source evidence model

`MaterialCalibrationEvidence` stores the facts the user actually measured:

- calibration ID
- material ID
- measured volume
- volume unit
- known weight
- weight unit
- recorded date/time
- optional notes

Derived values are not authoritative source fields.

## Derived calibration

`deriveMaterialCupWeightCalibration()` validates the evidence and calculates:

- measured volume normalized to cups
- known weight normalized to grams
- grams per cup

Formula:

```text
grams per cup
= known weight in grams / measured volume in cups
```

Example:

```text
5 cups = 1 kg
1 kg = 1,000 g

1,000 / 5 = 200 g/cup
```

The function also supports equivalent measurement inputs such as:

```text
120 mL = 100 g
120 mL = 0.5 cup
100 / 0.5 = 200 g/cup
```

## Material ownership

A calibration belongs to exactly one material.

Calibration evidence is rejected when its `materialId` does not match the target material.

Cup-to-weight calibration is limited to materials whose canonical base unit is `g`. A volume-based material such as water with base unit `mL` does not require this dry weight calibration model.

## Validation

Controlled errors cover:

- missing calibration ID
- missing material ID
- calibration/material mismatch
- non-weight-based target material
- non-finite measured volume
- zero or negative measured volume
- invalid/non-volume measurement unit
- non-finite known weight
- zero or negative known weight
- invalid/non-weight known-weight unit
- invalid recorded timestamp
- no calibration samples available for selection

## Multiple calibration samples

Phase 1 uses a deterministic first strategy:

```text
latest valid calibration wins
```

`selectLatestMaterialCupWeightCalibration()` validates all supplied evidence records for the target material and selects the most recent `recordedAt` value.

If two samples have the same timestamp, calibration ID is used as a stable tie-breaker so storage ordering cannot change the result.

Invalid or foreign samples are not silently skipped.

Averaging multiple samples is intentionally deferred until there is a demonstrated business need.

## Architectural boundary

Phase 1.4A only establishes calibration evidence, derivation, validation, and sample selection.

It does **not** yet change package costing or stock normalization.

That integration belongs to:

**Phase 1.4B — Effective Conversion Precedence**

1.4B will define when material calibration is used for dry `cup -> g` conversion and how the conversion source is reported.

## Automated coverage

Tests cover:

- 5 cups = 1 kg -> 200 g/cup
- standard volume and weight normalization before derivation
- fractional cup measurements
- material ownership mismatch
- non-weight-based material rejection
- zero/negative/non-finite measurements
- runtime dimension validation for measurement units
- calibration identity/timestamp validation
- latest-calibration selection
- deterministic equal-timestamp tie-breaking
- empty calibration collection
- invalid/foreign sample rejection

## Completion gate

Phase 1.4A is complete only after:

- TypeScript typecheck passes
- calibration domain tests pass
- all existing regression tests pass
- production build passes
- feature PR CI passes
- PR merges into `develop`
- post-merge `develop` CI passes

Next task after completion: **1.4B — Effective Conversion Precedence**.
