# Plaster Mold Yield Automation — MY1A Formula / Result Domain Contract

## Status

```text
MY0  — Domain & Workflow Audit                       COMPLETE
MY1  — Plaster Mold Formula Foundation               ACTIVE
MY1A — Formula / Result Domain Contract              COMPLETE
MY1B — Mold Yield Profile Source Contract            NEXT / NOT STARTED
MY1C — Mold / Material Referential Validation        NOT STARTED
```

MY1A is intentionally domain-only. It does not introduce persistence, repositories, workbook migration, UI, costing, Production integration, or Yield Sample writes.

## Purpose

Define one deterministic, weight-based formula contract for plaster mold recipe estimates derived from measured physical mold water capacity.

The source business rule remains:

```text
Adjusted Water = measuredWater × (1 - waterAdjustmentRate)
Plaster        = Adjusted Water × plasterFactor
Glue           = Adjusted Water × glueFactor
Total Mixture  = Adjusted Water + Plaster + Glue
```

Default business values from MY0 remain configuration inputs rather than hard-coded policy:

```text
waterAdjustmentRate = 0.30
plasterFactor        = 0.75
glueFactor           = 0.05
```

## Domain API

Implemented in:

`src/domain/plasterMoldFormula.ts`

Primary input:

```ts
PlasterMoldFormulaInput {
  waterFillWeightGrams: number;
  waterAdjustmentRate: number;
  plasterFactor: number;
  glueFactor: number;
  piecesPerPour: number;
  requestedQuantity?: number;
}
```

Primary result:

```ts
PlasterMoldFormulaResult {
  unit: 'g';
  perPour: PlasterMoldFormulaQuantities;
  perPiece: PlasterMoldFormulaQuantities;
  requestedQuantityEstimate?: PlasterMoldRequestedQuantityEstimate;
}
```

All formula outputs are derived. MY1A persists nothing.

## Validation Contract

MY1A rejects:

- non-finite or non-positive `waterFillWeightGrams`;
- `waterAdjustmentRate < 0` or `>= 1`;
- non-finite or negative `plasterFactor`;
- non-finite or negative `glueFactor`;
- non-positive or non-integer `piecesPerPour`;
- non-positive or non-integer optional `requestedQuantity`;
- non-finite derived arithmetic.

Zero plaster/glue factors remain valid because MY0 defines them as non-negative.

## Canonical Example

For:

```text
waterFillWeightGrams = 50
waterAdjustmentRate  = 0.30
plasterFactor        = 0.75
glueFactor           = 0.05
piecesPerPour         = 1
```

the result is:

```text
Adjusted Water = 35 g
Plaster        = 26.25 g
Glue           = 1.75 g
Total Mixture  = 63 g
```

Glue remains additional material; it does not replace adjusted water.

## Multi-Cavity / Requested Quantity Semantics

For:

```text
piecesPerPour     = 4
requestedQuantity = 21
```

MY1A derives:

```text
requiredPours          = ceil(21 / 4) = 6
producedCapacityPieces = 24
extraCapacityPieces    = 3
```

Using the canonical one-pour recipe, six pours derive:

```text
Water         = 210 g
Plaster       = 157.5 g
Glue          = 10.5 g
Total Mixture = 378 g
```

Per-piece theoretical quantities for four cavities are also derived from one-pour values.

## Boundary Rules Preserved

```text
Mold Formula Estimate != Product Safety Waste
Mold Formula Estimate != Yield Evidence
```

MY1A does not read or apply `Product.safetyWasteRate`.

MY1A does not create, update, or replace a `YieldSample`. Real production evidence remains authoritative and must continue recording actual material consumption.

The formula remains explicitly weight-based in grams. No generic weight-to-volume conversion is introduced.

## Tests

Implemented in:

`src/domain/plasterMoldFormula.test.ts`

Coverage includes:

- canonical 50 g calculation;
- input validation/error codes;
- multi-cavity per-piece math;
- 21-piece / 4-cavity required-pour estimate;
- glue-as-additional-material semantics;
- no Product safety-waste or Yield evidence leakage;
- deterministic no-hidden-rounding arithmetic;
- overflow rejection.

## Explicitly Deferred

The following are not part of MY1A:

- `PlasterMoldYieldProfile` persisted source contract — MY1B;
- Mold/Material reference and weight-compatibility validation — MY1C;
- repositories/application services — MY2;
- PhysicalBusinessDatasetV4/workbook migration — MY3;
- calculator orchestration — MY4;
- configuration UI — MY5;
- Yield workspace draft integration — MY6;
- costing/capacity/production preview integration — MY7.

## Next Task

```text
MY1B — Mold Yield Profile Source Contract
NEXT / NOT STARTED
```

Do not start MY1B until MY1A is merged and post-merge `develop` CI is green.
