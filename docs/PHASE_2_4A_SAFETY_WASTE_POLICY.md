# Phase 2.4A — Safety Waste Policy

## Status

**COMPLETE**

Implementation PR: **#44**

Implementation merge commit: `7b7ff441cc86f010211ffb93428ba13c8871cb1e`

Post-merge CI run: `34839447489` — **SUCCESS**

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

The Product contract delegates rate validation to the shared safety-waste policy domain, so create/update flows enforce the same rule.

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

The system does not automatically copy, infer, or synchronize safety waste from historical defect rate.

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

## Completion evidence

- valid boundary-rate tests passed;
- negative / non-finite / >= 1 rejection tests passed;
- product create/update contract uses the shared policy range;
- policy percentage/multiplier derivation tests passed;
- defect-rate separation is explicit in contract/tests/documentation;
- application lookup tests passed;
- full regression suite passed;
- TypeScript typecheck passed;
- production build passed;
- PR #44 merged into `develop`;
- post-merge CI run `34839447489` passed on `7b7ff441cc86f010211ffb93428ba13c8871cb1e`.

Next task: **2.4B — Waste-Adjusted Production Requirements**.
