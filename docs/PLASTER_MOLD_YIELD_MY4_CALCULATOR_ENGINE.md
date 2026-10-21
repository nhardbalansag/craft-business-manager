# Plaster Mold Yield Automation — MY4 Mold Yield Calculator Engine

## Status

```text
MY0 — Domain & Workflow Audit                       COMPLETE
MY1 — Plaster Mold Formula Foundation               COMPLETE
MY2 — Repository & Application Services             COMPLETE
MY3 — Physical Dataset v4 / Workbook Migration      COMPLETE
MY4 — Mold Yield Calculator Engine                  COMPLETE

MY5 — Mold Formula Configuration UI                 NEXT / NOT STARTED
```

## Purpose

MY4 turns the previously separate domain and source contracts into one application-level calculation workflow.

The engine accepts:

```text
moldId
requestedQuantity? 
```

and resolves:

```text
Mold
  ↓
active PlasterMoldYieldProfile
  ↓
Water / Plaster / Glue Materials
  ↓
MY1A pure formula
  ↓
theoretical Mold Formula Estimate
```

## Implementation

Implemented in:

```text
src/application/plasterMoldYieldProfiles/PlasterMoldYieldCalculatorService.ts
```

Shared-session service:

```text
plasterMoldYieldCalculatorService
```

## Availability Rule

The calculator is available because:

```text
Mold has an active PlasterMoldYieldProfile
```

Product category is not consulted.

This preserves the MY0 rule that plaster behavior must not be inferred from labels such as `paintable-art` or `candle-pot`.

## Calculation Source

MY4 does not duplicate formula arithmetic.

It delegates to:

```text
calculatePlasterMoldFormula(...)
```

from MY1A.

The active profile supplies:

```text
waterFillWeightGrams
waterAdjustmentRate
plasterFactor
glueFactor
piecesPerPour
```

The optional requested quantity is supplied at calculation time and is never persisted to the profile.

## Result Contract

The result includes:

- Mold identity;
- the authoritative active profile snapshot;
- lightweight Water / Plaster / Glue Material identities;
- MY1A formula result;
- explicit theoretical-estimate labeling.

Material identity output deliberately excludes:

- package cost;
- inventory/on-hand quantity;
- costing/calibration output.

Those belong to MY7.

## Defensive Source Validation

Although MY2 and MY3 already enforce source integrity, MY4 validates its live inputs again before calculating.

The engine fails closed for:

- missing Mold;
- archived Mold;
- no active profile;
- profile/Mold contradiction;
- invalid profile fields;
- missing/archived Material references;
- non-weight-compatible formula Materials;
- duplicate Material roles.

Requested-quantity validation remains owned by the MY1A formula contract.

## Multi-Cavity Behavior

For:

```text
waterFillWeightGrams = 50
waterAdjustmentRate  = 0.30
plasterFactor        = 0.75
glueFactor           = 0.05
piecesPerPour         = 4
requestedQuantity    = 21
```

MY4 returns the MY1A canonical estimate:

```text
per pour
Water       35 g
Plaster     26.25 g
Glue        1.75 g
Total       63 g

per piece
Water       8.75 g
Plaster     6.5625 g
Glue        0.4375 g
Total       15.75 g

requested quantity
Required pours       6
Produced capacity   24
Extra capacity       3
Water total        210 g
Plaster total      157.5 g
Glue total          10.5 g
Mixture total      378 g
```

No hidden rounding is introduced.

## Safety Waste Boundary

MY4 returns:

```text
productSafetyWasteApplied = false
```

The Mold water adjustment remains separate from Product `safetyWasteRate`.

## Yield Evidence Boundary

MY4 returns:

```text
yieldEvidenceCreated = false
```

A Mold Formula Estimate is theoretical guidance only.

It does not create, modify, or supersede a `YieldSample`.

MY6 may later use this result to pre-fill a Yield Sample draft, but saving actual evidence remains an explicit user action.

## Cost / Capacity Boundary

MY4 does not inspect:

- material cost;
- material inventory;
- package costing;
- production capacity;
- selling price;
- profit.

Those belong to MY7.

## Tests

Coverage includes:

- canonical 50 g formula;
- four-cavity / requested-21 estimate;
- calculation without requested quantity;
- category-independent availability;
- missing/inactive Mold;
- missing active profile;
- profile/Mold contradiction;
- Material reference/weight validation;
- requested-quantity validation delegation;
- defensive result copying;
- no cost/inventory leakage;
- no safety-waste application;
- no Yield evidence creation.

## Next Task

```text
MY5 — Mold Formula Configuration UI
NEXT / NOT STARTED
```

Do not start MY5 until MY4 is merged and exact post-merge `develop` CI is green.
