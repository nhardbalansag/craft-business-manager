# Phase 4 — Pricing & Production Planning Master Development Plan

## Status

**MASTER PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning base:

`develop` @ `b963f2d35f19f219df040208c5718cd4b9f078a3`

Starting exact `develop` CI:

`34930800736 — SUCCESS`

Planning branch:

`docs/phase-4-master-plan`

## Objective

Extend the completed Phase 3 material/component costing and assembly-capacity foundation into transparent product-level unit economics and production financial planning.

Phase 4 must let the business owner answer, per Product:

- what does one sellable unit actually cost after material/component inputs, explicit labor, explicit overhead, and the Product's forward safety-waste reserve are considered;
- what selling price results from a fixed profit amount, markup percentage, or target margin;
- how much profit is expected per unit;
- what a requested physical production batch is expected to cost after real safety-waste and whole-piece rounding rules;
- what revenue and profit that batch is expected to generate;
- whether the requested batch exceeds current material/component assembly capacity and which resources are limiting it.

Phase 4 remains derived business planning. It must not post production, reserve inventory, deduct stock, create accounting journal entries, or persist Excel files.

---

# Planning Discovery

## Completed Phase 3 input

Phase 3 provides the authoritative material/component base cost and current assembly-capacity evidence:

- `ComponentAwareProductCostService` supplies direct-material cost evidence, Material-backed component cost, recursive Product-backed component material/component cost, readiness, and traceable component lines;
- `ProductionRequirementService` supplies the Product's safety-waste-adjusted direct-material requirements and physical planned-batch quantities;
- `AssemblyCapacityTraceService` supplies current overall assembly capacity plus all typed tied limiters;
- Product-backed component capacity uses explicit current `ProductStock` only;
- direct parent materials and discrete assembly components remain distinct concepts;
- parent safety waste applies to parent direct materials only and does not inflate discrete component counts.

Phase 4 must consume these contracts instead of duplicating Phase 1/2/3 conversion, cost, component, or capacity formulas.

## Existing pricing scaffold

The repository already contains a small pre-Phase-4 scaffold:

```text
PricingMethod = profit-amount | markup-percent | margin-percent
PricingPolicy { method, value }
```

and generic helpers in `src/domain/costing.ts` for:

- `totalUnitCost()`;
- `sellingPrice()`;
- `profitPerPiece()`;
- `plannedTotals()`.

These are **not automatically authoritative Phase 4 contracts**.

Phase 4 must review and harden them because:

- invalid target margin currently returns a fake `0` price instead of failing closed;
- generic cost helpers sanitize negative values rather than exposing invalid financial input;
- `plannedTotals(unitCost × quantity)` does not represent the physical Phase 2/3 production plan because it ignores direct-material safety waste and count-material final-batch rounding;
- no readiness contract currently connects pricing to Phase 3 cost readiness;
- no product-level labor/overhead source record currently exists.

## Product contract boundary

The authoritative `Product` record currently stores identity/category/mix/safety-waste/notes/active state only.

Phase 4 will **not** add pricing fields directly to `Product`.

Financial source configuration belongs to a separate product-keyed financial profile so recipe/composition identity remains clean and future Phase 5 persistence can map financial data independently.

---

# Locked Phase 4 Architecture Decisions

## 1. Product financial source profile

Introduce one source record per configured Product, conceptually:

```text
ProductFinancialProfile
- productId
- laborCostPerUnit
- overheadCostPerUnit
- pricingPolicy: PricingPolicy | null
- notes?                       optional
```

The exact field/interface name may be refined during 4.1A, but these semantics are locked.

### Missing versus explicit zero

Missing profile is **not** silently equivalent to zero labor/overhead.

```text
no profile        = financial configuration unresolved
profile with 0/0  = explicitly no labor/overhead cost
```

This follows the same evidence-first principle used for missing versus explicit-zero ProductStock.

### Labor baseline

Phase 4 v1 uses an explicit **labor cost per finished unit in PHP**.

It does not introduce:

- timesheets;
- payroll;
- employee wages;
- time-clock integration;
- labor-minute/hour tracking;
- labor allocation by work center.

Those require separate future planning.

### Overhead baseline

Phase 4 v1 uses an explicit **overhead cost per finished unit in PHP**.

It does not silently invent a percentage allocation or business-wide overhead allocator.

Rent/electricity/equipment depreciation/allocation models may be modeled later, but Phase 4 requires the owner to enter the per-unit overhead amount explicitly.

## 2. Pricing policy methods

Supported pricing methods remain:

```text
profit-amount
markup-percent
margin-percent
```

Canonical domain semantics:

### Fixed profit amount

```text
sellingPrice = totalUnitCost + profitAmount
```

### Markup percentage

```text
sellingPrice = totalUnitCost × (1 + markupRate)
```

Example:

```text
markupRate = 0.50 = 50%
```

### Target margin

```text
sellingPrice = totalUnitCost / (1 - targetMarginRate)
```

Example:

```text
targetMarginRate = 0.25 = 25%
```

Validation:

```text
profitAmount >= 0
markupRate >= 0
0 <= targetMarginRate < 1
all values finite
```

A target margin of 100% or more is invalid and must fail closed. It must never become a fake zero selling price.

UI percentage controls may display/accept human percentages such as `25`, but application/domain values use canonical decimal rates such as `0.25`.

## 3. Financial precision and rounding

Domain/application calculations retain full numeric precision.

Formatting to PHP currency (normally two decimal places) is a presentation concern.

Phase 4 does not introduce automatic charm pricing, `.99` endings, ceiling-to-nearest-peso rules, or manual price-rounding policy unless a later dedicated requirement explicitly adds one.

## 4. Pricing cost basis includes the explicit safety-waste reserve once

Phase 3's `totalComponentAwareCost` is the base material/component cost and does not apply the parent Product's forward safety-waste reserve.

Phase 4 unit economics must make the reserve visible rather than underpricing expected production.

For the current Product:

```text
pricingDirectMaterialCostPerUnit
= sum(
    Phase 2 waste-adjusted plannedBaseQuantityPerProduct
    × authoritative costPerBaseUnit
  )
```

Important:

- use precise `plannedBaseQuantityPerProduct` for standard per-unit economics;
- do **not** use final-batch `pc` rounding for the standard unit cost;
- observed rejected-output loss is not applied again because yield learning already includes consumed material per good piece;
- parent safety waste applies only to the parent's direct materials;
- Material-backed/Product-backed discrete components do not inherit the parent's safety-waste multiplier.

## 5. Handmade Product components need fully loaded recursive production cost

Phase 3 recursively rolls child Product material/component cost, but Phase 4 adds labor/overhead and pricing-aware production economics.

For a Product-backed component, the parent must consume the child's **fully loaded production cost**, not the child's retail/selling price.

Child profit/markup/margin is never rolled into the parent cost.

Conceptually:

```text
fullyLoadedUnitCost(Product P)
=
  P waste-adjusted direct-material cost
+ P Material-backed component cost
+ Σ(quantity P->Child × fullyLoadedUnitCost(Child))
+ P laborCostPerUnit
+ P overheadCostPerUnit
```

This means each child Product's own:

- direct-material safety-waste reserve;
- labor cost;
- overhead cost;
- nested child production costs

are respected exactly once.

The existing acyclic Product composition contract remains authoritative. Recursive Phase 4 readers must still keep a defensive path/cycle guard for corrupted/imported future data.

## 6. Pricing policy does not affect production cost roll-up

A child Product may have its own selling-price policy, but that policy is irrelevant when the child is used internally as a component.

Parent cost uses child production cost only.

Therefore:

- cost readiness and pricing readiness are related but distinct;
- a Product may have known labor/overhead cost while its pricing policy is still unconfigured;
- missing/invalid child selling-price policy must not make the parent's production cost unresolved if the child's cost profile itself is otherwise complete.

The 4.1A contract must support this separation cleanly.

## 7. Standard unit economics and physical batch economics are distinct

Standard total unit cost is a per-unit planning basis.

Physical planned batch cost must use the actual Phase 2/3 planned requirements because count materials can round only at the final batch boundary.

For requested quantity `Q`:

```text
plannedDirectMaterialCost
= Σ(plannedBatchBaseQuantity × costPerBaseUnit)
```

where `plannedBatchBaseQuantity` is the physical Phase 2 requirement including:

- safety waste;
- final-batch upward rounding for indivisible `pc` direct materials.

Discrete Material-backed component batch cost:

```text
materialComponentCostPerParent × Q
```

Product-backed component batch cost:

```text
fullyLoadedChildUnitCost × quantityPerParent × Q
```

Root labor/overhead:

```text
laborBatchCost    = laborCostPerUnit × Q
overheadBatchCost = overheadCostPerUnit × Q
```

Total:

```text
plannedProductionCost
= plannedDirectMaterialCost
+ plannedMaterialComponentCost
+ plannedProductComponentCost
+ laborBatchCost
+ overheadBatchCost
```

This is why the existing generic `plannedTotals(unitCost × quantity)` cannot become the authoritative Phase 4 production-plan cost.

## 8. Revenue and profit

When pricing and planned-cost evidence are ready:

```text
expectedRevenue = sellingPrice × Q
expectedProfit  = expectedRevenue - plannedProductionCost
```

For unit economics:

```text
profitPerUnit = sellingPrice - totalUnitCost
```

Derived diagnostic ratios:

```text
effectiveMarkup = profitPerUnit / totalUnitCost       when totalUnitCost > 0
effectiveMargin = profitPerUnit / sellingPrice        when sellingPrice > 0
```

Batch effective margin:

```text
batchMargin = expectedProfit / expectedRevenue        when expectedRevenue > 0
```

Zero denominators produce an explicit unavailable/null diagnostic rather than infinity or NaN.

## 9. Capacity feasibility is advisory, not auto-clamping

Phase 4 uses `AssemblyCapacityTraceService` as the authoritative current-capacity source.

The user's requested production quantity remains unchanged.

Status should distinguish at least:

```text
within-current-capacity
over-current-capacity
capacity-unresolved
```

If over capacity:

- financial projections may remain visible when their own cost/pricing evidence is complete;
- the plan must be visibly flagged as not currently feasible;
- all tied limiting resources from Phase 3 remain available for explanation.

Phase 4 must not silently reduce the requested quantity to capacity.

## 10. Readiness must fail closed

Phase 4 must use a controlled readiness model (`ready`, `partial`, `not-ready` or an equally explicit equivalent).

Examples:

- missing financial profile: no fully loaded authoritative total unit cost;
- profile present with labor/overhead explicitly `0`: those adders are known zero;
- Phase 3/Phase 2 input-cost evidence partial: preserve known subtotals/issues but do not publish an authoritative selling price based on incomplete cost;
- pricing policy missing: total unit cost may still be ready while selling price/revenue/profit is not ready;
- invalid pricing policy: fail validation; never sanitize to a misleading price;
- unresolved nested child cost: propagate the issue/path upward.

## 11. Source data versus derived values

Persisted/source data for future Phase 5:

- Product financial profile;
- labor cost per unit;
- overhead cost per unit;
- pricing policy method/value;
- optional notes.

Derived only — never authoritative cached source data:

- waste-adjusted direct cost;
- fully loaded total unit cost;
- selling price;
- profit per unit;
- markup/margin diagnostics;
- planned batch cost;
- expected revenue/profit;
- capacity feasibility/warnings.

`BusinessDataset` should gain the financial-profile source collection when the 4.1 contract is established so Phase 5 has an explicit future persistence shape.

---

# Phase 4 Breakdown

## 4.1 — Financial Profile & Pricing Policy Foundation

### 4.1A — Product Financial Profile Contract

Define the product-keyed source contract for:

- explicit labor cost per unit;
- explicit overhead cost per unit;
- optional pricing policy;
- optional notes;
- clone/validation helpers;
- missing-versus-explicit-zero semantics;
- Product identity/reference rules;
- future `BusinessDataset` inclusion.

Assess whether the old `PricingPolicy` scaffold should move from the generic `types.ts` module into a dedicated Phase 4 pricing domain while preserving any needed compatibility export.

Completion gate:

- valid financial profile contract exists;
- negative/non-finite monetary inputs are rejected;
- explicit zero labor/overhead is valid;
- pricing policy may be independently unconfigured without losing known cost adders;
- Product pricing fields are not added to the Phase 2 Product contract.

### 4.1B — Pricing Formula & Validation Engine

Harden/replace the existing generic pricing primitives with authoritative validated Phase 4 formulas.

Cover:

- fixed profit amount;
- markup rate;
- target margin rate;
- selling-price derivation;
- profit per unit;
- effective markup;
- effective margin;
- finite/non-negative validation;
- zero-denominator handling;
- no fake `0` sentinel for invalid margin.

Completion gate:

- invalid financial policy fails closed;
- all three pricing methods have deterministic tests;
- canonical decimal-rate semantics are explicit;
- domain math does not round for UI display.

### 4.1C — Financial Profile Repository & Application Services

Add storage-agnostic source management using the established repository/service pattern.

Expected behavior:

- one profile per Product identity;
- create/upsert/update/get/list as justified by existing repository conventions;
- reject missing Product references;
- preserve profile when Product is archived for historical inspection/editing where consistent with existing source-record policy;
- defensive cloning;
- shared session wiring;
- no Excel/Tauri implementation.

Completion gate:

- React will have an application service boundary for all future financial-profile writes;
- no UI directly mutates repositories/source arrays.

---

## 4.2 — Fully Loaded Product Unit Cost

### 4.2A — Waste-Adjusted Direct-Material Unit Cost

Create a derived service/view that combines:

- `ProductionRequirementService` at a one-unit planning basis for precise waste-adjusted direct requirements; and
- Phase 3 authoritative direct-material cost-per-base-unit evidence.

Use `plannedBaseQuantityPerProduct`, not the physical one-piece `plannedBatchBaseQuantity`, so indivisible count rounding remains a batch concern.

Deliver:

- base direct-material cost before safety reserve;
- safety-waste reserve cost;
- pricing direct-material cost per unit;
- per-material traceability;
- readiness/issues.

### 4.2B — Recursive Product-Backed Fully Loaded Cost Roll-Up

Extend the Phase 3 component graph cost semantics so Product-backed child components contribute their own fully loaded Phase 4 production cost.

Material-backed components continue to use Phase 3/Phase 1 authoritative purchased-component cost.

Product-backed components contribute:

```text
quantityPerParent × fullyLoadedUnitCost(child)
```

Child selling price/profit is explicitly excluded.

Deliver:

- deterministic nested breakdown;
- parent/child quantity multiplier;
- child labor/overhead visibility;
- child safety-waste direct-cost visibility;
- issue/readiness propagation;
- corruption-safe recursion guard.

### 4.2C — Total Fully Loaded Unit Cost & Readiness

Synthesize:

```text
waste-adjusted direct-material cost
+ Material-backed component cost
+ recursively fully loaded Product-backed component cost
+ own labor cost
+ own overhead cost
= total fully loaded unit cost
```

Deliver:

- input/material-component subtotal;
- labor subtotal;
- overhead subtotal;
- total unit cost;
- ready/partial/not-ready status;
- complete trace/issues.

This becomes the authoritative Phase 4 cost basis for product selling-price derivation.

---

## 4.3 — Selling Price & Unit Economics

### 4.3A — Selling Price Derivation

Combine the fully loaded cost from 4.2C with the Product's configured pricing policy.

If pricing policy is unconfigured:

- keep total unit cost visible when ready;
- selling price remains unresolved/null;
- do not invent a default markup or profit amount.

### 4.3B — Profit, Markup & Margin Metrics

For a ready selling price, derive:

- profit per unit;
- effective markup percentage;
- effective margin percentage;
- pricing method/value trace;
- cost-to-price reconciliation.

These are derived diagnostics only.

### 4.3C — Product Pricing Quote & Readiness Service

Provide one application-level product pricing view suitable for UI and later reporting.

Expected output includes:

```text
product identity
financial-profile evidence
fully loaded unit-cost result
pricing policy
selling price
profit per unit
effective markup
effective margin
status/issues
```

No derived quote is persisted as source data.

---

## 4.4 — Planned Batch Financials & Capacity

### 4.4A — Physical Planned Batch Production Cost

Create an application service for a requested whole finished-product quantity.

It must use physical production evidence rather than `unitCost × quantity`:

- Phase 2 direct-material safety waste;
- final-batch count-material rounding;
- Material-backed discrete component quantities;
- Product-backed child fully loaded cost;
- root labor/overhead × requested quantity.

Deliver all cost subtotals and traceability.

### 4.4B — Expected Revenue, Profit & Batch Margin

Using the authoritative Product selling price:

- expected revenue;
- expected profit;
- effective batch margin;
- optionally planned average cost per finished unit when quantity > 0;
- zero-quantity safe behavior;
- partial/not-ready propagation.

The result must make clear that batch profit can differ from `profitPerUnit × Q` because physical direct-material count rounding can change actual planned batch cost.

### 4.4C — Capacity Feasibility & Warning Synthesis

Join the planned financial view with `AssemblyCapacityTraceService`.

Deliver:

- requested quantity;
- current assembly capacity when authoritative;
- `within-current-capacity`, `over-current-capacity`, or `capacity-unresolved`;
- overage quantity when applicable;
- all typed tied limiting resources;
- actionable warning text/structured issues.

Do not reserve/deduct inventory or modify the requested quantity.

---

## 4.5 — Pricing & Production Planning UI

### 4.5A — Product Financial Profile Editor

Add a user-facing editor for each Product's financial source configuration.

The UI must support:

- Product selection;
- explicit labor cost per unit;
- explicit overhead cost per unit;
- pricing method selection;
- fixed profit amount or percentage value as appropriate;
- clear `%` versus PHP input labeling;
- optional unconfigured pricing policy if contract allows it;
- archived Product visibility consistent with application rules;
- validation/error feedback;
- service-backed writes only.

Recommended navigation target: a dedicated top-level **Pricing** workspace rather than adding financial source fields to the Products recipe/composition editor.

### 4.5B — Unit Economics / Pricing Calculator UI

Display the fully loaded quote with readable separation:

```text
Direct materials + safety reserve
Purchased components
Handmade Product components
Labor
Overhead
------------------------------
Total unit cost
Pricing policy
Selling price
Profit per unit
Effective markup
Effective margin
```

Nested handmade-component cost paths must remain inspectable/readable without turning the UI into an accounting ledger.

### 4.5C — Production Financial Summary & Capacity Warning UI

Extend the Production workspace to add financial planning without removing the existing Phase 3 input/capacity detail.

Display:

- physical planned production cost;
- expected revenue;
- expected profit;
- effective batch margin;
- current capacity feasibility;
- over-capacity warning and all limiting resources;
- readiness issues.

React must consume Phase 4 application results rather than reimplement authoritative financial formulas locally.

---

## 4.6 — Integration & Completion Gate

### 4.6A — Integrated Pricing & Production Workflow

Validate at least these real-service scenarios through isolated in-memory repositories.

#### Scenario A — Paintable art with fixed profit

Validate:

- learned/fixed material cost;
- safety-waste pricing reserve;
- explicit labor + overhead;
- fixed PHP profit per unit;
- selling price/profit reconciliation.

#### Scenario B — Purchased-vessel candle with markup

Validate:

- direct wax/fragrance cost with parent safety reserve;
- purchased cup component cost not inflated by parent safety waste;
- labor/overhead;
- markup-based selling price;
- unit economics reconciliation.

#### Scenario C — Handmade-pot candle with target margin

Validate:

- child Product fully loaded cost includes child's own safety reserve/labor/overhead;
- child selling price/profit is not rolled into parent cost;
- parent labor/overhead is added exactly once;
- target-margin price is correct;
- nested trace is finite/deterministic.

#### Scenario D — Multi-component event set

Validate:

- multiple discrete child quantities;
- fully loaded nested child costs;
- expected price/profit;
- tied component capacity limiters remain visible.

#### Scenario E — Physical batch rounding changes profit

Use at least one indivisible direct `pc` material whose final batch requirement rounds upward.

Verify:

- standard unit economics use precise per-unit planning quantity;
- planned batch cost uses physical rounded count;
- expected batch profit reflects the physical cost rather than naïve `unitCost × Q`.

#### Scenario F — Capacity warning without auto-clamp

Request more pieces than current assembly capacity.

Verify:

- requested quantity remains unchanged;
- financial projection remains available when financial evidence is ready;
- status is over-current-capacity;
- all tied limiting resources remain visible.

#### Scenario G — Fail-closed readiness

Validate at least:

- missing financial profile;
- explicit zero labor/overhead profile;
- missing pricing policy;
- invalid target margin rejected;
- unresolved nested child cost propagation.

### 4.6B — Regression, Build & Phase 4 Completion

Final gate:

- all Phase 1/2/3 regressions remain green;
- all Phase 4 domain/application/integration tests pass;
- React smoke coverage includes Pricing and financial Production paths;
- TypeScript typecheck passes;
- production build passes;
- exact merged `develop` CI passes;
- global roadmap/documentation is reconciled.

---

# Phase 4 Dependency Order

```text
4.1 Financial Profile & Pricing Policy Foundation
  ↓
4.2 Fully Loaded Product Unit Cost
  ↓
4.3 Selling Price & Unit Economics
  ↓
4.4 Planned Batch Financials & Capacity
  ↓
4.5 Pricing & Production Planning UI
  ↓
4.6 Integration & Completion Gate
```

Within each major phase, sub-phases are implemented in order unless a dedicated scope review proves a safer split is required.

Every sub-phase must receive its own scope review/development plan before implementation starts, following the repository's established Phase 2/3 lifecycle.

---

# Explicit Phase 4 Boundaries

Phase 4 DOES include:

- explicit per-Product labor cost per unit;
- explicit per-Product overhead cost per unit;
- fixed-profit pricing;
- markup pricing;
- target-margin pricing;
- safety-waste-aware standard unit economics;
- recursive fully loaded handmade Product component cost;
- total unit cost;
- selling price;
- profit per unit;
- effective markup/margin diagnostics;
- physical planned batch cost;
- expected revenue/profit;
- capacity feasibility warnings;
- Pricing UI and Production financial summary.

Phase 4 DOES NOT include:

- payroll/timekeeping or employee labor records;
- automatic labor-time measurement;
- business-wide overhead allocation engines;
- tax/VAT policy;
- discounts/coupons/promotions;
- marketplace/payment fees;
- shipping/customer delivery costing;
- wholesale/tiered/channel pricing;
- charm-price/price-ending optimization;
- accounting journal entries/COGS posting;
- production transaction posting;
- stock reservation or automatic deduction;
- procurement/reorder automation;
- Excel persistence/import/export — Phase 5;
- Tauri filesystem integration — Phase 6;
- dashboard/reporting expansion — Phase 7 unless explicitly pulled forward by a later approved plan.

These exclusions avoid inventing accounting/tax/business policies the owner has not configured.

---

# Expected Source Architecture

Names may be refined during dedicated sub-phase planning, but the expected dependency direction is:

```text
ProductFinancialProfile source
        ↓
FinancialProfileRepository / Service
        ↓
WasteAdjustedDirectUnitCostService
        ↓
FullyLoadedProductCostService
        ↓
ProductPricingQuoteService
        ↓
ProductionFinancialPlanService
        ↓
Pricing UI / Production financial UI
```

Reused authoritative dependencies:

```text
ProductionRequirementService
ComponentAwareProductCostService
ProductComponent repositories/services
Phase 3 component cost providers
AssemblyCapacityTraceService
ProductRepository
MaterialRepository
```

React must not become the source of truth for pricing math.

---

# Migration / Compatibility Notes

1. Existing `PricingPolicy` / pricing helpers are scaffolding and may be relocated/refactored during 4.1 while keeping imports compatible where useful.
2. Existing Phase 1/2/3 cost formulas must not be silently changed merely to fit Phase 4.
3. `ProductionPage` currently computes some planned input-cost presentation math locally. Phase 4.4/4.5 should centralize authoritative financial batch calculations into application services, then simplify React to presentation.
4. `BusinessDataset` should gain only Phase 4 **source** financial-profile records, not derived prices/totals.
5. All future Excel schema decisions remain Phase 5; Phase 4 defines the storage-agnostic domain shape only.

---

# Development Lifecycle Per Phase 4 Task

For each implementation task:

1. Verify exact authoritative `develop` SHA and CI state.
2. Recover this master-plan task contract plus prior completed Phase 4 records.
3. Inspect relevant architecture/services/tests.
4. Assess whether the task needs a deeper split.
5. Create a dedicated task development plan/scope review **before coding**.
6. Create feature branch from exact verified `develop`.
7. Implement with strict phase-boundary control.
8. Run focused tests plus complete CI.
9. Open PR to `develop` only after final feature-head CI passes.
10. Require independent PR CI on the unchanged expected head.
11. Merge with expected-head SHA protection.
12. Require exact post-merge `develop` CI.
13. Create documentation-only closeout when status/tracker reconciliation is needed.
14. Require closeout PR CI and exact final `develop` CI.
15. Advance tracker to the next task without starting it until explicitly authorized.

---

# Phase 4 Completion Target

```text
4.1 — Financial Profile & Pricing Policy Foundation      NOT STARTED
    4.1A — Product Financial Profile Contract             NEXT
    4.1B — Pricing Formula & Validation Engine            NOT STARTED
    4.1C — Profile Repository & Application Services      NOT STARTED

4.2 — Fully Loaded Product Unit Cost                      NOT STARTED
    4.2A — Waste-Adjusted Direct-Material Unit Cost       NOT STARTED
    4.2B — Recursive Fully Loaded Product Component Cost  NOT STARTED
    4.2C — Total Fully Loaded Unit Cost & Readiness       NOT STARTED

4.3 — Selling Price & Unit Economics                      NOT STARTED
    4.3A — Selling Price Derivation                       NOT STARTED
    4.3B — Profit / Markup / Margin Metrics               NOT STARTED
    4.3C — Product Pricing Quote & Readiness Service      NOT STARTED

4.4 — Planned Batch Financials & Capacity                 NOT STARTED
    4.4A — Physical Planned Batch Production Cost         NOT STARTED
    4.4B — Expected Revenue / Profit / Batch Margin       NOT STARTED
    4.4C — Capacity Feasibility & Warning Synthesis       NOT STARTED

4.5 — Pricing & Production Planning UI                    NOT STARTED
    4.5A — Product Financial Profile Editor               NOT STARTED
    4.5B — Unit Economics / Pricing Calculator UI         NOT STARTED
    4.5C — Production Financial Summary & Warnings UI     NOT STARTED

4.6 — Integration & Completion Gate                       NOT STARTED
    4.6A — Integrated Pricing / Production Workflow       NOT STARTED
    4.6B — Regression / Build / Completion                NOT STARTED
```

## Current next implementation task

**4.1A — Product Financial Profile Contract — NEXT / NOT STARTED**

Do not begin 4.1A implementation until its dedicated development plan/scope review has been created and the Phase 4 master-plan documentation is merged/validated on `develop`.
