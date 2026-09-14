# Phase 2.3C — Material Cost Preview & Requirement Validation

## Status

**IMPLEMENTED — VALIDATION / MERGE GATE**

Branch: `feature/phase-2-3c-material-cost-preview`

Base: `develop` at `1867aa6529742bad4f5bdf3be3dcb48899e7fbb8`.

## Objective

Turn the canonical per-product material requirements from Phase 2.3B into a traceable material-cost preview using the authoritative Phase 1 purchase/package-cost engine.

This remains a derived preview. No cost totals are persisted as source data.

## Core formula

```text
material cost per product
= canonical base quantity per product
× cost per base unit
```

Example:

```text
Plaster requirement = 80 g / product
1 kg plaster costs   = ₱66
cost per gram        = ₱0.066

plaster cost/product = 80 × 0.066
                     = ₱5.28
```

## Cost basis

Each material is priced using Phase 1 `calculateMaterialPackageCosting()`.

That preserves existing conversion precedence:

```text
ordinary package:
manual -> standard -> error

dry cup -> gram purchase:
calibration -> manual g/cup fallback -> error
```

The preview records:

- material ID;
- canonical base unit;
- canonical quantity per product;
- cost per base unit;
- material cost per product;
- source mode (`yield`, `fixed`, `combined`);
- package cost;
- package base quantity;
- package conversion source;
- costing calibration ID when applicable.

## Contribution-level traceability

When a material requirement is combined, each source contribution receives its own derived cost using the same material cost per base unit.

Example:

```text
Plaster total = 80 g
├── 75 g yield contribution -> ₱4.95
└──  5 g fixed contribution -> ₱0.33

Total plaster cost          -> ₱5.28
```

The contribution costs remain derived and do not replace the underlying yield/fixed source records.

## Requirement validation

Before a requirement is priced, 2.3C validates that:

- requirement material identity matches the cost basis;
- requirement base unit matches the material base unit;
- requirement quantity is finite and greater than zero;
- cost per base unit is finite and non-negative;
- package base quantity is finite and greater than zero;
- contribution quantities reconcile to the effective material requirement;
- derived material/contribution costs remain finite and non-negative.

A zero-cost material is valid. A missing or malformed cost basis is not guessed.

## Readiness model

2.3C preserves the 2.3B readiness result and adds costing readiness.

### ready

- 2.3B requirement result is ready;
- every effective material requirement is successfully priced;
- no costing issues exist.

### partial

At least one material is successfully priced, but either:

- 2.3B was already partial; or
- one or more effective material requirements cannot currently be priced.

The valid priced lines and total for those lines remain available together with issues.

### not-ready

No effective material requirement can currently be priced.

The total material cost is `0` only as an empty preview result, not as a claim that the recipe genuinely costs zero.

## Historical behavior

Archived material/product records may still be priced for historical/reporting inspection when their stored costing inputs remain valid.

This does not reactivate them for production.

## Application boundary

Added:

- `src/domain/recipeMaterialCostPreview.ts`
- `src/domain/recipeMaterialCostPreview.test.ts`
- `src/application/recipeCosts/RecipeMaterialCostPreviewService.ts`
- `src/application/recipeCosts/RecipeMaterialCostPreviewService.test.ts`
- shared-session wiring through `recipeMaterialCostPreviewService`.

## Explicitly deferred

2.3C does **not** add:

- safety-waste adjustment — Phase 2.4;
- inventory-limited producible pieces — Phase 2.4;
- vessels/nested components — Phase 3;
- labor or overhead — later costing phases;
- selling price, markup, margin, or profit — later pricing phase;
- React costing/production UI — Phase 2.5.

## Completion gate

2.3C may be marked complete after:

- combined/yield/fixed cost-preview tests pass;
- contribution-cost reconciliation tests pass;
- package-cost conversion source/calibration tests pass;
- zero-cost-material tests pass;
- partial/not-ready costing tests pass;
- requirement-validation tests pass;
- full regression suite passes;
- TypeScript typecheck passes;
- production build passes;
- feature PR merges into `develop`;
- post-merge `develop` CI passes.

Next task after completion: **2.4A — Safety Waste Policy**.
