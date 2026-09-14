# Phase 2.1B — Mix Preset Contract & Ratio Engine

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-2-1b-mix-preset-ratio-engine`

Base: `develop` at `29d9d8a96e9447bc6c93c244744f938f81d4d101`.

## Objective

Replace the old primary/secondary mix scaffold with a reusable source contract and deterministic ratio engine that supports plaster, candles, single-material mixes, and richer formulas without storing absolute batch quantities.

## Authoritative contract

```text
MixPreset
- id
- name
- compatibleCategories[]
- basis: weight | volume
- lines[]
    - materialId
    - role: primary | secondary | additive
    - parts
- notes?
- isActive
```

Locked rules:

- at least one compatible product category;
- compatible categories must be valid and unique;
- at least one material line;
- exactly one `primary` line;
- `secondary` and `additive` lines are optional;
- every material may appear only once, case-insensitively;
- all `parts` values must be positive finite numbers;
- single-line presets are valid;
- referenced material existence/activity is deferred to 2.1C application services.

## Ratio resolution

Ratios are relative. An anchor specifies:

```text
materialId
quantity
unit
```

The engine calculates:

```text
quantityPerPart = anchor quantity / anchor line parts
resolved line quantity = line parts × quantityPerPart
```

Example:

```text
Plaster preset: plaster 2 : water 1
Anchor: plaster = 3 cup

quantityPerPart = 3 / 2 = 1.5 cup

Resolved:
plaster = 3 cup
water   = 1.5 cup
```

Example:

```text
Candle preset: wax 100 : fragrance 8
Anchor: wax = 500 g

quantityPerPart = 500 / 100 = 5 g

Resolved:
wax       = 500 g
fragrance = 40 g
```

The anchor may be any preset line, not only the primary line.

## Unit/basis boundary

- `weight` presets require a weight anchor unit;
- `volume` presets require a volume anchor unit;
- count units are invalid for mix-ratio anchors;
- the ratio engine does not normalize material quantities to canonical units;
- Phase 1 remains responsible for material-specific normalization/calibration after resolution.

This keeps the important distinction intact:

```text
1 cup = 240 mL               universal volume conversion
cup -> grams of plaster      material-specific Phase 1 calibration
```

## Product compatibility

A preset may explicitly support one or more Phase 2 product categories through `compatibleCategories`.

Compatibility is metadata at this domain level. Product-to-preset reference validation and active-state checks belong to 2.1C where repositories are available.

## Files

- `src/domain/mixPresets.ts`
- `src/domain/mixPresets.test.ts`
- `src/domain/types.ts`

## Deferred work

- Product/Mix repositories, duplicate ID/name rules, material-reference validation: **2.1C**
- Yield evidence and learned requirements: **2.2**
- Fixed recipe synthesis: **2.3**
- Safety-waste/capacity calculations: **2.4**
- Product/Mix UI: **2.5**

## Completion gate

2.1B may be marked complete after:

- TypeScript typecheck passes;
- mix contract and ratio-resolution tests pass;
- full regression tests pass;
- production build passes;
- feature PR CI passes;
- PR merges into `develop`;
- post-merge `develop` CI passes.

Next task after completion: **2.1C — Product / Mix Repositories & Application Services**.
