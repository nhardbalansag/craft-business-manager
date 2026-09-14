# Phase 1.1C — Conversion Validation & Tests

## Status

**COMPLETE — FEATURE CI PASSED; POST-MERGE DEVELOP CONFIRMATION REQUIRED**

Branch: `feature/phase-1-1c-conversion-validation`

Base: `develop`

PR: `#6`

## Objective

Close Phase 1.1 by validating the unit catalog and standard conversion engine as a complete measurement foundation before material-domain development begins.

This task does not introduce material-specific conversion. Dry volume-to-weight conversion such as plaster cups to grams remains Phase 1.4.

## Runtime unit validation

TypeScript protects compiled application code, but future values loaded from forms, Excel workbooks, imports, or other external sources are untyped at runtime.

Phase 1.1C therefore adds:

- `isSupportedUnit(value)` — runtime type guard
- `parseUnit(value)` — validates and returns a supported `Unit`
- `UNSUPPORTED_UNIT` — controlled `UnitConversionError` code

Examples:

```text
parseUnit('kg')     -> 'kg'
parseUnit('cup')    -> 'cup'
parseUnit('grams')  -> UNSUPPORTED_UNIT
parseUnit('box')    -> UNSUPPORTED_UNIT
parseUnit(null)     -> UNSUPPORTED_UNIT
```

The unit vocabulary remains intentionally strict. Aliases or package units such as `box` or `pack` are not silently interpreted as standard measurement units. Manual package conversions are handled later in Phase 1.3.

## Validation matrix

The automated suite now verifies the complete supported unit set rather than only selected examples.

For every supported unit:

- catalog symbol matches its key
- conversion factor is finite and positive
- canonical unit belongs to the same dimension
- canonical unit is actually canonical
- canonical definitions use factor `1`
- identity conversion returns the original quantity

For every same-dimension unit pair:

- a conversion factor exists
- conversion succeeds
- converting to the target and back round-trips to the original value within floating-point tolerance

For every cross-dimension unit pair:

- standard conversion is rejected
- error code is `INCOMPATIBLE_UNITS`
- source and target unit context is preserved

## Required reference cases

Explicit regression coverage includes:

```text
1 kg    = 1000 g
1 oz    = 28.3495 g
1 lb    = 453.592 g
1 L     = 1000 mL
1 cup   = 240 mL
1 tbsp  = 15 mL
1 tsp   = 5 mL
1 fl-oz = 29.5735 mL
1 pc    = 1 pc
```

Coverage also includes:

- zero quantities
- fractional quantities
- negative mathematical quantities
- non-finite values
- rounding-sensitive values
- canonical normalization and restoration
- explicit display rounding
- invalid rounding precision
- unsupported runtime unit values

## Precision rule

Conversions remain unrounded internally.

Rounding is still explicit through `roundQuantity()` at display/export boundaries. The 1.1C tests confirm that rounding does not mutate or change the raw conversion behavior.

## Cross-dimension rule remains locked

These are still invalid standard conversions:

```text
cup -> g
mL  -> g
kg  -> mL
pc  -> mL
```

In particular:

```text
1 cup = 240 mL
```

is only a volume conversion. It does not imply any gram weight for plaster, wax, or another material.

## Validation evidence

Feature PR validation passed:

- dependency installation passed
- TypeScript typecheck passed
- exhaustive automated tests passed
- production build passed
- PR CI passed

Final integration confirmation is the post-merge `develop` CI run on the merge commit.

## Completion gate

Phase 1.1C requires:

- TypeScript typecheck passes ✅
- all unit/conversion tests pass ✅
- production build passes ✅
- feature PR CI passes ✅
- PR is merged into `develop`
- post-merge `develop` CI passes

After the final two integration checks, **Phase 1.1 — Measurement & Conversion Foundation is fully complete**.

## Next task

After final post-merge confirmation, proceed to:

**Phase 1.2A — Material Contract & Classification**
