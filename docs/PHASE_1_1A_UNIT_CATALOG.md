# Phase 1.1A — Unit Catalog & Dimensional Rules

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-1a-unit-catalog`

Base: `develop`

## Scope

This task establishes the authoritative measurement vocabulary for the craft business domain. It does not implement quantity conversion yet; the conversion engine remains Phase 1.1B.

## Dimensions

The system recognizes exactly three standard dimensions:

- `weight`
- `volume`
- `count`

## Canonical units

- weight → `g`
- volume → `mL`
- count → `pc`

## Supported units

Weight:

- `g`
- `kg`
- `oz`
- `lb`

Volume:

- `mL`
- `L`
- `cup`
- `tbsp`
- `tsp`
- `fl-oz`

Count:

- `pc`

## Standard reference factors

The unit catalog owns the standard factor from each unit to its canonical unit:

- 1 g = 1 g
- 1 kg = 1,000 g
- 1 oz = 28.3495 g
- 1 lb = 453.592 g
- 1 mL = 1 mL
- 1 L = 1,000 mL
- 1 cup = 240 mL
- 1 tbsp = 15 mL
- 1 tsp = 5 mL
- 1 US fl oz = 29.5735 mL
- 1 pc = 1 pc

These constants are metadata for the Phase 1.1B conversion engine. Business calculations must not duplicate them.

## Dimensional rule

Standard conversion is valid only when the source and destination units belong to the same dimension.

Allowed examples:

```text
kg → g
lb → g
cup → mL
L → cup
pc → pc
```

Rejected examples:

```text
cup → g
mL → g
kg → mL
pc → mL
```

A cross-dimension conversion requires material-specific evidence such as a calibration or density rule introduced in later phases.

## Important dry-material rule

`1 cup = 240 mL` is a volume definition only.

It does **not** mean:

```text
1 cup plaster = 240 g
```

A dry material such as plaster will need a material-specific calibration, for example:

```text
5 cups plaster = 1,000 g
therefore 1 cup = 200 g for that specific material
```

That logic belongs to Phase 1.4 and is intentionally absent from the standard unit catalog.

## Implementation

Primary domain module:

`src/domain/units.ts`

It defines:

- unit dimensions
- weight, volume, and count unit types
- canonical/base unit types
- `UNIT_CATALOG`
- supported unit list
- canonical unit by dimension
- unit metadata lookup
- dimension lookup
- compatibility checks
- explicit rejection of incompatible standard conversions

`src/domain/types.ts` now sources `BaseUnit` and `InputUnit` from this catalog so material inputs cannot maintain a separate unit definition.

## Automated coverage

`src/domain/units.test.ts` validates:

- canonical units
- the complete supported unit set
- dimension classification
- canonical-unit mapping
- standard reference factors
- compatible same-dimension pairs
- rejected cross-dimension pairs
- the absence of universal cup-to-gram conversion

## Completion gate

This task is complete only after:

- TypeScript typecheck passes
- automated tests pass
- production build passes
- PR CI passes
- the PR is merged into `develop`
- post-merge `develop` CI passes

## Explicitly deferred

Not part of Phase 1.1A:

- quantity conversion calculations
- rounding policy
- material-specific grams-per-cup
- density-based conversion
- material CRUD
- inventory normalization
- Excel persistence

Next task after completion: **1.1B — Standard Conversion Engine**.
