# Plaster Mold Yield Automation — MY7 Cost / Capacity / Production Preview

## Status

```text
MY0 — Domain & Workflow Audit                       COMPLETE
MY1 — Plaster Mold Formula Foundation               COMPLETE
MY2 — Repository & Application Services             COMPLETE
MY3 — Physical Dataset v4 / Workbook Migration      COMPLETE
MY4 — Mold Yield Calculator Engine                  COMPLETE
MY5 — Mold Formula Configuration UI                 COMPLETE
MY6 — Yield Workspace Integration                   COMPLETE
MY7 — Cost / Capacity / Production Preview          COMPLETE
    MY7A — Formula Operational Preview Service      COMPLETE
    MY7B — Production Workspace Parallel Preview    COMPLETE
    MY7C — Regression / Responsive Gate             COMPLETE

MY8 — Regression & Completion Gate                  NEXT / NOT STARTED
```

## Purpose

MY7 makes the theoretical Mold Formula operationally useful before or beside real Yield evidence without inserting that formula into the existing authoritative Production chain.

The key architecture remains:

```text
Existing Production path
Effective Recipe Requirements
        ↓
Product Safety Waste
        ↓
Planned Batch Requirements
        ↓
Cost / Capacity / Financials

MY7 parallel path
Saved Mold Formula
        ↓
MY4 theoretical recipe
        ↓
Formula Material Cost
Formula Current-Stock Capacity
Formula Target Feasibility
```

The two paths are intentionally separate.

## MY7A — Formula Operational Preview Service

Implemented:

```text
PlasterMoldOperationalPreviewService
```

The service consumes the existing MY4 calculator result and reuses the existing Material costing and inventory-normalization engines.

It derives for Water, Plaster, and Glue:

- grams per complete Mold pour;
- theoretical grams per Mold-capacity piece;
- grams required for the requested target;
- cost per gram;
- cost per pour;
- cost per theoretical piece;
- target-batch formula material cost;
- normalized current stock in grams;
- complete-pour capacity from current stock;
- produced-piece capacity from current stock;
- target shortfall in grams;
- limiting formula Material.

Overall output includes:

- estimated formula material cost per pour;
- estimated formula material cost per piece;
- estimated target formula material cost;
- maximum complete pours from current stock;
- maximum Mold-capacity pieces from current stock;
- target feasibility;
- limiting Material IDs.

## Physical Pour Semantics

MY7 preserves the MY1/MY4 multi-cavity rule.

For:

```text
piecesPerPour      = 4
requestedQuantity  = 21
```

the operational target remains:

```text
requiredPours          = 6
producedCapacityPieces = 24
extraCapacityPieces    = 3
```

Costs and shortfalls are based on six complete physical pours, not on fractional theoretical material for exactly 21 cavities.

This means the operational target uses:

```text
Water      210 g
Plaster  157.5 g
Glue       10.5 g
```

## Costing

MY7 reuses the existing Material package-cost calculation:

```text
calculateMaterialPackageCosting(...)
```

Therefore existing conversion/calibration rules remain authoritative.

MY7 does not create a second cost-conversion system.

If one or more formula Materials cannot be costed, known inventory capacity may still be shown and the formula preview becomes partial.

## Inventory Capacity

MY7 reuses:

```text
normalizeMaterialOnHand(...)
```

for current-stock normalization.

For each positive formula Material requirement:

```text
completePourCapacity =
floor(normalizedOnHandGrams / gramsPerPour)
```

Overall formula stock capacity is the minimum complete-pour capacity across required Water, Plaster, and Glue.

Produced-piece capacity is:

```text
maxCompletePours × piecesPerPour
```

The preview does not reserve, deduct, or mutate stock.

## Target Feasibility

MY7 exposes one of:

```text
within-current-stock
insufficient-current-stock
capacity-unresolved
```

For a target batch, per-Material shortfall is:

```text
max(0, targetBatchGrams - normalizedOnHandGrams)
```

All values remain derived.

## Zero-Quantity Production Exploration

The existing Production workspace supports quantity `0` for cost exploration.

MY7 preserves that behavior.

For target quantity zero:

- required pours = 0;
- target formula grams = 0;
- target formula cost = 0;
- per-pour / per-piece formula cost remains visible;
- current stock capacity remains visible.

No artificial one-pour batch requirement is created.

## MY7B — Production Workspace Parallel Preview

The Production workspace now shows a separate panel when the selected Product has at least one active physical Mold with an active `PlasterMoldYieldProfile`:

```text
MOLD FORMULA ESTIMATE
Formula cost & stock preview
```

The panel includes:

- configured Mold selector;
- target Production quantity;
- formula material cost per pour;
- formula material cost per Mold-capacity piece;
- target formula material cost;
- formula current-stock piece capacity;
- required pours;
- produced Mold capacity;
- extra Mold capacity;
- Water / Plaster / Glue operational table;
- current stock;
- shortfall;
- limiting formula Material;
- target material cost.

## Existing Yield Authority

If the normal Production path is using a real effective Yield sample, MY7 explicitly says so.

Example:

```text
Current Production requirements use Yield sample YLD-0004.
This Mold Formula is shown only for comparison and pre-production estimation.
```

MY7 does not replace that sample or alter effective learning.

## Safety Waste Boundary

MY7 returns and displays formula quantities before Product planning waste.

Therefore:

```text
productSafetyWasteApplied = false
```

Product `safetyWasteRate` remains exclusively part of the existing Production requirement path.

It is not added to the Mold Formula quantities.

## Cost Boundary

The MY7 formula cost includes only:

- Water;
- Plaster;
- Glue.

It explicitly excludes:

- Product safety waste;
- discrete components;
- vessels;
- labor;
- overhead;
- selling price;
- profit;
- tiered pricing.

The existing Production/financial services remain authoritative for those broader business calculations.

## Source / Persistence Boundary

MY7 adds no new authoritative source record.

Operational preview values are never persisted:

- formula material costs;
- normalized formula inventory;
- shortfalls;
- limiting Materials;
- formula stock capacity;
- target feasibility.

They are always recalculated from current Material/profile sources.

## MY7C — Regressions

Coverage includes:

- canonical requested-quantity cost;
- per-pour/per-piece cost;
- full-pour physical target cost;
- current-stock capacity;
- limiting Material;
- target shortfall;
- partial costing with usable inventory;
- unresolved inventory with usable cost;
- zero-target Production exploration;
- no inventory mutation;
- shared-session wiring;
- Production workspace coexistence with existing Production output;
- responsive/accessibility CSS contract.

## Preserved Existing Production Contract

MY7 does **not** modify:

```text
Effective Recipe Requirements
Product Safety Waste
ProductionRequirementService
ProductionCapacityService
ComponentAwareProductCostService
PlannedBatchCapacityFeasibilityService
Production financials
```

The Mold Formula operational preview is parallel and explicitly labeled.

## Next Task

```text
MY8 — Regression & Completion Gate
NEXT / NOT STARTED
```

Do not start MY8 until MY7 is merged and exact post-merge `develop` CI is green.
