# Phase 2 — Product Recipes & Mold Yield Progress

Status: **COMPLETE**

Planning baseline: `docs/PHASE_2_PRODUCT_RECIPES_MOLD_YIELD_PLAN.md`

```text
2.1 — Product & Mix Foundation                         COMPLETE
    2.1A — Product Contract & Category Rules          COMPLETE
    2.1B — Mix Preset Contract & Ratio Engine         COMPLETE
    2.1C — Product / Mix Repositories & Services      COMPLETE

2.2 — Yield Evidence & Per-Good-Piece Learning        COMPLETE
    2.2A — Yield Sample Evidence Contract             COMPLETE
    2.2B — Good / Rejected Output & Learning          COMPLETE
    2.2C — Effective Yield Selection & History        COMPLETE

2.3 — Recipe Requirement Synthesis                    COMPLETE
    2.3A — Fixed Recipe Item Contract & Material Roles COMPLETE
    2.3B — Effective Per-Piece Material Requirements  COMPLETE
    2.3C — Material Cost Preview & Validation         COMPLETE

2.4 — Safety Waste & Inventory-Limited Capacity       COMPLETE
    2.4A — Safety Waste Policy                        COMPLETE
    2.4B — Waste-Adjusted Requirements                COMPLETE
    2.4C — Producible Pieces & Limiting Material      COMPLETE

2.5 — Product / Yield / Production UI                 COMPLETE
    2.5A — Products & Mix Presets UI                  COMPLETE
    2.5B — Yield Recording & History UI               COMPLETE
    2.5C — Production Estimate UI                     COMPLETE

2.6 — Phase 2 Integration & Completion Gate           COMPLETE
    2.6A — Integrated Phase 2 Workflow                COMPLETE
    2.6B — Regression / Build / Completion            COMPLETE
```

## Completed

### 2.1 — Product & Mix Foundation

Completed through PRs #26, #28, and #30.

### 2.2 — Yield Evidence & Per-Good-Piece Learning

Completed through PRs #32, #34, and #36.

### 2.3A — Fixed Recipe Item Contract & Material Roles

- authoritative `FixedRecipeItem` source contract;
- roles: consumable, additive, finish, packaging, other;
- source quantity/unit preserved while canonical quantity remains derived;
- reusable material quantity normalization shared with yield learning;
- standard, calibrated cup-to-gram, and explicit manual cup fallback supported;
- one fixed line per product/material enforced;
- active product/material reference validation;
- container/vessel materials rejected to preserve the Phase 3 component boundary;
- storage-agnostic repository + in-memory implementation;
- create/update/get/list/remove application service;
- `BusinessDataset.recipeItems` replaces the prototype recipe scaffold;
- shared application-session wiring.

Evidence:
- PR #38 merged;
- implementation merge commit `2fbe12437328d70f3aa155bde49a49603ddbf69a`;
- post-merge CI run `34835244976` passed.

### 2.3B — Effective Per-Piece Material Requirements

- combines the effective yield sample with fixed recipe lines into one derived canonical requirement set;
- supports yield-only, fixed-only, and combined products;
- combines duplicate materials only after both sources resolve to the same canonical base unit;
- preserves yield/fixed contribution traceability including source IDs, conversion source, fixed role, and calibration ID;
- keeps Phase 2.2C latest-valid yield selection authoritative;
- exposes `ready`, `partial`, and `not-ready` readiness states;
- reports unresolved yield history/fixed lines as controlled issues instead of silently dropping valid requirements;
- supports archived-product historical inspection without reactivation;
- keeps the effective requirement view derived rather than persisted.

Evidence:
- PR #40 merged;
- implementation merge commit `fe313ba7af5161137b1b80de74898836374a915d`;
- post-merge CI run `34837084144` passed.

### 2.3C — Material Cost Preview & Requirement Validation

- prices canonical 2.3B material requirements using the Phase 1 package-cost engine;
- preserves package-cost conversion source and costing calibration identity;
- derives contribution-level costs for yield/fixed sources while keeping one material total;
- validates material identity, canonical base unit, quantities, cost basis, and contribution reconciliation;
- carries 2.3B readiness forward and adds costing readiness;
- supports ready/partial/not-ready cost preview results;
- allows legitimate zero-cost materials while rejecting malformed/unresolvable cost bases;
- supports archived historical material/product inspection without reactivation;
- keeps all material cost totals derived rather than persisted.

Evidence:
- PR #42 merged;
- implementation merge commit `6c9b5f48e74f2771166761c7a2deaf708319f2a8`;
- post-merge CI run `34838146695` passed.

### 2.4A — Safety Waste Policy

- formalizes product safety waste as a forward-looking planning reserve;
- validates `0 <= safetyWasteRate < 1` through one shared policy domain;
- rejects negative, non-finite, and 100%+ values;
- derives percentage and multiplier without prematurely applying them to quantities;
- explicitly keeps safety waste separate from observed yield defect rate;
- exposes `ProductService.getSafetyWastePolicy()` for later production planning;
- supports archived-product historical/policy inspection.

Evidence:
- PR #44 merged;
- implementation merge commit `7b7ff441cc86f010211ffb93428ba13c8871cb1e`;
- post-merge CI run `34839447489` passed.

### 2.4B — Waste-Adjusted Production Requirements

- applies the validated product safety-waste multiplier to canonical 2.3B requirements;
- preserves effective quantity, explicit reserve quantity, adjusted per-piece quantity, and planned batch quantity;
- scales yield/fixed contribution traceability with the same multiplier;
- accepts zero or positive whole-number planned finished-product quantities;
- rejects negative, non-finite, and fractional production counts;
- propagates 2.3B ready/partial/not-ready status and issues;
- explicitly excludes observed defect rate from the multiplier;
- keeps all planning results derived rather than persisted;
- leaves inventory availability and capacity to 2.4C.

Evidence:
- PR #46 merged;
- implementation merge commit `34788e67913bbc3587dc1118797a34b892cd8df9`;
- post-merge CI run `34840488193` passed.

### 2.4C — Producible Pieces & Limiting Material

- combines waste-adjusted per-product requirements with current normalized Phase 1 inventory;
- calculates each direct material's capacity using floor division;
- publishes overall producible pieces only when the complete direct-material picture is reliable;
- reports every tied limiting material deterministically;
- preserves stock normalization source and calibration identity;
- supports standard, calibrated cup-to-weight, manual fallback, and purchase-package inventory normalization;
- treats zero stock as valid capacity zero;
- surfaces missing, archived, mismatched, negative, or unresolvable inventory as controlled readiness issues;
- returns diagnostic per-material capacities for partial states without publishing a misleading overall capacity;
- keeps purchased vessels, molded products, nested components, and component-limited capacity in Phase 3;
- wires `productionCapacityService` into the shared application session.

Evidence:
- PR #48 merged;
- implementation merge commit `e9a6bbffd36d6aed29d7660fabee8845252ab5fb`;
- post-merge CI run `34841719987` passed.

### 2.5A — Products & Mix Presets UI

- enables the Products top-level navigation workspace;
- adds Product create/edit/archive/search/category/status UI;
- exposes safety-waste percentage and category guidance;
- filters product mix choices by category compatibility and active state;
- adds Mix Preset create/edit/archive/search/basis/status UI;
- supports dynamic material ratio lines with primary/secondary/additive roles;
- exposes compatible-category controls and readable ratio summaries;
- keeps all saves behind ProductService/MixPresetService application validation;
- adds responsive styles and React smoke coverage;
- preserves Phase 3 vessel/component and later Phase 4 pricing boundaries.

Evidence:
- PR #50 merged;
- implementation merge commit `e5a6777efe5b40bbd2a7c1afa9af1c03f30ce694`;
- post-merge CI run `34843399968` passed.

### 2.5B — Yield Recording & History UI

- adds a top-level Yield workspace;
- records immutable multi-material production evidence through `YieldSampleEvidenceService`;
- supports active-product recording with optional compatible mix reference, actual material quantities/units, good/rejected outputs, timestamp, and notes;
- keeps archived products available for historical inspection while disabling new evidence entry;
- shows the latest currently derivable effective sample and learned canonical requirement per good piece;
- displays observed defect rate separately from safety waste;
- exposes newer history records skipped because they are currently not derivable;
- lists immutable batch evidence including original measured material quantities;
- routes correction deletion through `YieldHistoryService` so last-effective protection remains authoritative;
- adds responsive Yield styles and React smoke coverage.

Evidence:
- PR #52 merged;
- implementation merge commit `db0cc26fbe78ee076fd65dde90d4e66cea1480f1`;
- post-merge CI run `34844884088` passed.

### 2.5C — Production Estimate UI

- enables the Production top-level navigation workspace;
- combines `ProductionRequirementService`, `ProductionCapacityService`, and `RecipeMaterialCostPreviewService` without duplicating business calculations in React;
- accepts non-negative whole-number planned finished-product quantity, including zero for preview;
- displays effective, waste-reserve, waste-adjusted per-piece, and planned batch material quantities;
- displays normalized on-hand inventory, conversion source, per-material capacity, overall producible pieces, and all tied limiting materials;
- warns when requested production exceeds reliable current direct-material capacity;
- displays direct-material cost per product plus waste-adjusted per-piece and batch material cost;
- surfaces requirement, inventory, and costing readiness issues;
- exposes skipped invalid yield evidence when effective-yield fallback is in use;
- keeps vessels/nested components in Phase 3 and selling price/profit in Phase 4;
- adds responsive Production styles and React smoke coverage.

Evidence:
- PR #54 merged;
- implementation merge commit `d2c2c567d90cddfdf0fb7300294dc5f4f59f48ad`;
- post-merge CI run `34846437781` passed.

### 2.6A — Integrated Phase 2 Workflow

- validates the full application path from material/calibration setup through mix/product, real yield evidence, fixed recipe inputs, effective requirements, direct-material cost preview, safety-waste planning, and inventory-limited capacity;
- validates the calibrated plaster workflow from cups to canonical grams while retaining original production evidence;
- validates effective-yield fallback through downstream requirement, costing, planning, and capacity services when a newer calibration-dependent sample becomes non-derivable;
- finalizes indivisible count-material planning so precise per-product and source-contribution quantities are retained while only the final physical `pc` batch requirement is rounded upward;
- reconciles Production summary batch cost to the physical batch quantities so rounded count requirements cannot understate planned material cost;
- verifies deterministic limiting-material behavior, including tied limiting materials;
- preserves Phase 3 component/vessel and Phase 4 selling-price/profit boundaries.

Evidence:
- PR #56 merged;
- implementation merge commit `3557121019908949b6032e371581f452d9a19163`;
- post-merge CI run `34848952735` passed.

### 2.6B — Regression, Build & Phase 2 Completion Validation

- reran the complete Phase 1 + Phase 2 automated validation surface;
- verified 38 test files and 349 tests passing;
- verified TypeScript typecheck;
- verified React smoke coverage across Materials, Calibration, Products, Yield, and Production;
- verified the integrated Phase 2 product/yield/production workflow remains green;
- verified the production Vite build;
- confirmed no new Phase 2 business-rule defect at the final gate;
- confirmed Phase 3 component/vessel, Phase 4 pricing/profit, and Phase 5 persistence boundaries remain intact.

Evidence:
- PR #58 merged;
- completion merge commit `e79303fdcad4fb298154be957f938584f164a61b`;
- feature CI run `34908067484` passed;
- post-merge CI run `34908149932` passed.

## Phase 2 completion result

**Phase 2 — Product Recipes & Mold Yield is complete.**

The product/mix, yield evidence and learning, recipe synthesis, direct-material costing, safety-waste planning, inventory capacity, UI, integrated workflow, and final regression/build gates all passed.

## Next active task

**Phase 3 — Product Components, Vessels & Nested Molded Products — assessment and phase decomposition.**

Do not begin Phase 3 implementation until its scope has been assessed and split into explicit implementation phases/sub-phases.
