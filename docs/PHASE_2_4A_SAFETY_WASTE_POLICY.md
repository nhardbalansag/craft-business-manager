# Phase 2.4A — Safety Waste Policy

## Status

**IMPLEMENTED — VALIDATION / MERGE GATE**

Branch: `feature/phase-2-4a-safety-waste-policy`

Base: `develop` at `6cfc927404bcdb70da4e295acb481586fba4c777`.

## Objective

Formalize `Product.safetyWasteRate` as an explicit forward-looking production planning reserve while keeping it separate from observed yield defects.

Phase 2.4A defines and validates the policy only. Applying the multiplier to recipe requirements belongs to Phase 2.4B.

## Authoritative source

The source value remains:

```text
Product.safetyWasteRate
```

Example:

```text
safetyWasteRate = 0.05
```

means:

```text
5% planning reserve
multiplier = 1.05
```

The derived policy object is not persisted as authoritative data.

## Validation contract

Phase 2 accepts:

```text
0 <= safetyWasteRate < 1
```

Therefore:

- `0` is valid;
- `0.05` is valid;
- values below `1` are valid;
- negative values are rejected;
- `1` / 100% and higher are rejected;
- `NaN` / infinities are rejected.

The Product contract now delegates rate validation to the shared safety-waste policy domain, so create/update flows enforce the same rule.

## Derived policy descriptor

`deriveProductSafetyWastePolicy()` produces:

```text
productId
rate
percentage
multiplier
purpose = planning-reserve
observedDefectRateIncluded = false
```

Example:

```text
Product ART-001
rate       = 0.05
percentage = 5
multiplier = 1.05
```

`ProductService.getSafetyWastePolicy()` exposes the validated derived policy to later application workflows.

## Distinction from observed defects

Observed rejected-piece defect rate from Phase 2.2 is diagnostic evidence:

```text
defect rate = rejected / (good + rejected)
```

The learned per-good-piece requirement already uses total consumed divided by good pieces, so observed rejected-output material loss is already represented in learned consumption.

Safety waste is a separate future-production reserve for normal uncertainty such as:

- spills;
- mixing-tool residue;
- measurement variation;
- handling loss;
- small normal production uncertainty.

The system must not automatically copy, infer, or synchronize safety waste from historical defect rate.

## Explicitly deferred

Phase 2.4A does **not**:

- multiply material requirements by the policy — Phase 2.4B;
- compute planned batch requirements — Phase 2.4B;
- compute inventory-limited capacity — Phase 2.4C;
- alter yield learning or defect rate;
- introduce UI percentage controls — Phase 2.5.

## Application boundary

Added/updated:

- `src/domain/safetyWastePolicy.ts`
- `src/domain/safetyWastePolicy.test.ts`
- `src/domain/products.ts`
- `src/domain/products.test.ts`
- `ProductService.getSafetyWastePolicy()`
- application regression coverage for policy lookup.

## Completion gate

2.4A may be marked complete after:

- valid boundary-rate tests pass;
- negative / non-finite / >= 1 rejection tests pass;
- product create/update contract uses the shared policy range;
- policy percentage/multiplier derivation tests pass;
- defect-rate separation is explicit in contract/tests/documentation;
- application lookup tests pass;
- full regression suite passes;
- TypeScript typecheck passes;
- production build passes;
- feature PR merges into `develop`;
- post-merge `develop` CI passes.

Next task after completion: **2.4B — Waste-Adjusted Production Requirements**.
