# Phase 2.5C — Production Estimate UI

## Status

**IMPLEMENTED — VALIDATION / MERGE GATE**

Feature branch: `feature/phase-2-5c-production-estimate-ui`

Implementation PR: **#54**

## Objective

Expose the completed Phase 2.4 production-planning and capacity services through React without creating a second calculation engine in the UI.

## Delivered workspace

The application now has an enabled top-level **Production** workspace.

The workspace supports:

- selecting an existing product;
- entering a non-negative whole-number planned finished-product quantity;
- using `0` as a per-piece preview;
- displaying recipe/readiness status;
- displaying the product safety-waste percentage;
- displaying waste-adjusted material requirement per product;
- displaying total planned batch requirement;
- displaying current normalized on-hand inventory;
- displaying per-material production capacity;
- displaying overall producible pieces when the complete direct-material inventory picture is reliable;
- displaying every tied limiting material;
- warning when the requested batch exceeds current direct-material capacity;
- displaying direct-material cost per product;
- displaying waste-adjusted direct-material cost per product and batch;
- surfacing requirement, inventory, and costing issues;
- displaying skipped invalid yield samples when effective-yield fallback is active.

## Authoritative service composition

The React workspace consumes:

- `ProductionRequirementService` for planned quantity and waste-adjusted direct-material requirements;
- `ProductionCapacityService` for normalized inventory, per-material capacity, overall capacity, and limiting materials;
- `RecipeMaterialCostPreviewService` for the direct-material cost basis.

React does not independently reimplement yield selection, safety-waste policy, unit normalization, calibration, inventory normalization, or capacity math.

## Planning flow

```text
product + planned finished quantity
        ↓
2.3B effective material requirements
        ↓
2.4A safety-waste policy
        ↓
2.4B waste-adjusted per-piece + batch requirements
        ↓
2.4C current normalized inventory + capacity
        ↓
Production workspace
```

## Batch requirements table

For each currently derivable direct material, the workspace exposes:

- effective base quantity per product;
- explicit safety-waste reserve per product;
- waste-adjusted planned base quantity per product;
- planned batch base quantity;
- normalized current on-hand inventory;
- original entered on-hand quantity/unit;
- inventory conversion source;
- per-material capacity pieces;
- limiting state when the overall capacity result is complete;
- planned batch material cost when the material cost basis is derivable.

## Capacity safety rule

The existing Phase 2.4C rule remains authoritative:

- known individual material capacities may be shown in a partial state;
- overall `produciblePieces` and final limiting materials are published only when every required direct-material inventory record is reliable.

The UI therefore does not treat unresolved inventory as zero and does not publish a misleading production ceiling.

## Cost behavior

Costing remains **direct materials only**.

The workspace shows:

```text
effective direct-material cost per product
× safety-waste multiplier
= waste-adjusted direct-material cost per product

waste-adjusted direct-material cost per product
× planned finished quantity
= planned batch direct-material cost
```

This phase does not add selling price, margin, markup, labor, overhead, or profit behavior.

## Scope boundaries

2.5C does **not** implement:

- inventory reservation or stock deduction;
- production orders / work orders;
- purchased vessels, molded-product vessels, or nested components — Phase 3;
- component-limited capacity — Phase 3;
- selling price, markup, margin, or profit — Phase 4;
- persistent production-estimate snapshots.

## React validation

The React smoke suite renders `ProductionPage` server-side and verifies the principal planning sections:

- Production estimate;
- planned finished pieces;
- producible-now summary;
- materials-to-prepare table;
- direct-material preview;
- readiness/issues section.

## Completion gate

2.5C may be marked complete after:

- TypeScript typecheck passes;
- all existing domain/application regression tests pass;
- Production workspace smoke validation passes;
- production build passes;
- PR #54 merges into `develop`;
- post-merge `develop` CI passes.

## Next task after completion

**2.6A — Integrated Phase 2 Product / Yield / Production Workflow**
