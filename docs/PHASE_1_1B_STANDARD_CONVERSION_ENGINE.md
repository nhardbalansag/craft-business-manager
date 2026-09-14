# Phase 1.1B — Standard Conversion Engine

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-1b-standard-conversion`

Base: `develop`

## Scope

Phase 1.1B turns the unit catalog from Phase 1.1A into a pure domain conversion engine for standard same-dimension conversions.

The engine does not perform material-specific density or calibration conversions. Dry volume-to-weight conversions such as plaster cups to grams remain deferred to Phase 1.4.

## Supported capabilities

### Conversion factor lookup

`getStandardConversionFactor(from, to)` derives a factor through the canonical unit for the dimension.

Examples:

```text
kg -> g = 1000
g -> kg = 0.001
cup -> tbsp = 16
pc -> pc = 1
```

### Quantity conversion

`convertQuantity(quantity, from, to)` converts finite values when both units share the same dimension.

Examples:

```text
2.5 kg -> 2500 g
1.5 L -> 1500 mL
2 cups -> 480 mL
3 tbsp -> 45 mL
36 pc -> 36 pc
```

### Canonical normalization

`toCanonicalQuantity(quantity, unit)` normalizes user-entered values to:

- weight -> `g`
- volume -> `mL`
- count -> `pc`

Examples:

```text
2.5 kg -> 2500 g
1.5 L -> 1500 mL
36 pc -> 36 pc
```

### Canonical to display/input conversion

`fromCanonicalQuantity(quantity, targetUnit)` converts canonical values back to a compatible user-facing unit.

Examples:

```text
2500 g -> 2.5 kg
1500 mL -> 1.5 L
36 pc -> 36 pc
```

## Controlled errors

Standard conversion failures use `UnitConversionError` with explicit codes:

- `INCOMPATIBLE_UNITS`
- `NON_FINITE_QUANTITY`
- `INVALID_DECIMAL_PLACES`

This lets application/UI layers distinguish domain failures without parsing generic error strings.

### Cross-dimension rule

These remain invalid standard conversions:

```text
cup -> g
mL -> g
kg -> mL
pc -> mL
```

A material-specific calibration or density rule is required for those scenarios.

## Quantity policy

The conversion engine is mathematically pure.

It therefore:

- accepts zero
- accepts fractional values
- preserves negative values
- rejects `NaN`
- rejects positive/negative infinity

Whether a negative business value is allowed is a higher-level concern. For example, Phase 1.3 inventory validation will reject negative on-hand stock, while the generic conversion engine itself remains reusable.

## Rounding policy

Conversions do **not** silently round.

`roundQuantity(quantity, decimalPlaces)` is an explicit helper intended for display/export boundaries.

Default precision is 6 decimal places. Supported precision is 0 through 12 decimal places.

This avoids losing precision inside costing and inventory calculations while still giving UI/report code one consistent rounding helper.

## Implementation

Primary module:

`src/domain/units.ts`

Added domain capabilities:

- `UnitConversionError`
- `getStandardConversionFactor`
- `convertQuantity`
- `toCanonicalQuantity`
- `fromCanonicalQuantity`
- `roundQuantity`

## Automated coverage

`src/domain/units.test.ts` now covers:

- weight conversions
- volume conversions
- count conversion
- conversion factor derivation
- normalization to canonical units
- conversion from canonical units
- zero values
- fractional values
- negative mathematical values
- non-finite input rejection
- cross-dimension rejection
- explicit rounding
- invalid rounding precision

## Explicitly deferred

Not part of Phase 1.1B:

- dry cup-to-gram conversion
- density-based conversion
- material calibration
- inventory/business validation
- material CRUD
- UI conversion controls
- Excel persistence

## Completion gate

Phase 1.1B is complete only after:

- TypeScript typecheck passes
- automated tests pass
- production build passes
- feature PR CI passes
- PR is merged to `develop`
- post-merge `develop` CI passes

Next task after completion: **1.1C — Conversion Validation & Tests**.
