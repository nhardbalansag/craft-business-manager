# Phase 4 — Pricing & Production Planning Progress

Status: **IN PROGRESS**

Planning baseline: `docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Authoritative planning merge:

`develop` @ `691651f15156c1258a6f1ef75b43d53b6836a426`

Planning post-merge CI:

`34931938705 — SUCCESS`

```text
4.1 — Financial Profile & Pricing Policy Foundation      COMPLETE
    4.1A — Product Financial Profile Contract             COMPLETE
    4.1B — Pricing Formula & Validation Engine            COMPLETE
    4.1C — Profile Repository & Application Services      COMPLETE

4.2 — Fully Loaded Product Unit Cost                      COMPLETE
    4.2A — Waste-Adjusted Direct-Material Unit Cost       COMPLETE
    4.2B — Recursive Fully Loaded Product Component Cost  COMPLETE
    4.2C — Total Fully Loaded Unit Cost & Readiness       COMPLETE

4.3 — Selling Price & Unit Economics                      IN PROGRESS
    4.3A — Selling Price Derivation                       NEXT
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

## Locked Phase 4 decisions

- Phase 4 financial source configuration is separate from the Phase 2/3 Product recipe/composition contract.
- One configured Product financial profile carries explicit labor cost per unit, explicit overhead cost per unit, and independently configurable pricing policy.
- Missing financial profile is unresolved; explicit zero labor/overhead is known zero.
- `pricingPolicy: null` explicitly represents unconfigured pricing while known cost adders remain valid source evidence.
- Pricing methods are fixed profit amount, markup percentage, and target margin.
- Internal percentage rates use canonical decimals; UI may later present human percentages.
- Target margin must satisfy `0 <= rate < 1`; 4.1B enforces this fail-closed.
- Financial-profile writes pass through the 4.1C repository/application-service boundary and validate both 4.1A source rules and configured 4.1B pricing policy.
- Product financial-profile identity is Product-keyed, case-insensitive for lookup, and canonicalized to Product repository identity.
- Archived Products retain readable/editable financial profiles.
- No profile delete/reset contract exists; missing profile remains meaningful unresolved evidence.
- Standard unit economics include direct-material safety waste exactly once.
- 4.2A derives standard direct-material pricing cost from precise `plannedBaseQuantityPerProduct`, not physical `plannedBatchBaseQuantity`.
- Base direct-material cost and forward safety-reserve cost remain separately traceable and reconcile to pricing direct-material cost.
- Direct-material cost-per-base-unit evidence is reused from the existing authoritative cost engine; package conversion/calibration costing is not duplicated in Phase 4.
- Existing `NO_REQUIREMENTS / not-ready` direct-material semantics remain intact in 4.2A.
- 4.2B provides controlled component-aware neutral direct-material interpretation for genuine component-only child Products; broken/partial direct evidence is never neutralized.
- Product-backed child components roll up fully loaded production cost, never child retail selling price or profit.
- Each recursive child includes its own 4.2A waste-adjusted direct material, Material-backed component costs, nested Product-backed fully loaded costs, labor, and overhead exactly once.
- Child `pricingPolicy` does not participate in recursive production-cost roll-up.
- Missing or invalid child labor/overhead evidence blocks an authoritative fully loaded child total while preserving known partial cost evidence.
- Partial known recursive cost is exposed separately from authoritative `childFullyLoadedUnitCost` / `componentCostContribution`.
- 4.2C now provides the authoritative root Product fully loaded unit-cost synthesis from 4.2A direct materials, Phase 3 Material-backed components, 4.2B Product-backed components, root labor, and root overhead.
- Root `pricingPolicy` does not participate in 4.2C production-cost math or readiness.
- Genuine component-only root Products can use the controlled neutral-direct interpretation; no-direct/no-component roots remain unresolved.
- Missing/invalid root financial profile or unresolved component/direct evidence preserves known subtotal but blocks authoritative `totalFullyLoadedUnitCost`.
- `totalFullyLoadedUnitCost` is the authoritative cost basis for Phase 4.3 only when 4.2C status is `ready`.
- Recursive and root component costing remains independent of ProductStock/current availability.
- Observed yield defects are not re-applied.
- Parent safety waste does not inflate discrete component counts.
- Unit financial math retains full precision; currency formatting is presentation-only.
- Physical batch cost uses Phase 2 final-batch count rounding and may differ from unit cost × quantity.
- Expected batch profit uses physical planned production cost.
- Capacity feasibility uses Phase 3 AssemblyCapacityTraceService and never silently clamps the requested quantity.
- Derived cost/price/revenue/profit is not authoritative persisted source data.
- Phase 4 excludes payroll/timekeeping, global overhead allocation, tax/VAT, discounts, marketplace fees, accounting posting, stock reservation/deduction, Excel persistence, and Tauri integration.

## Completed phase records

### 4.1A — Product Financial Profile Contract

**COMPLETE**

```text
Corrected implementation head 79c3f51f27b957721219a80a08078f603d7be214
Implementation CI              34932357351 — SUCCESS
Final feature head             8162732a7bbee01e92ce952c8c5d83a8b0d8041a
Final feature-head CI          34932475789 — SUCCESS
PR #96                         MERGED
PR CI                          34932585076 — SUCCESS
Implementation merge           cd520f581d96dbd0a3ed48d88a95e9b22f881af0
Post-merge develop CI          34932640993 — SUCCESS
57 test files / 649 tests
```

Plan: `docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT_PLAN.md`

Record: `docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT.md`

### 4.1B — Pricing Formula & Validation Engine

**COMPLETE**

```text
Implementation head            d699f1ac11794a47a026290aa3ef2e963d84f2f4
Implementation CI              34934079592 — SUCCESS
Final feature head             e4252a4d6c4939cc4d32cd7ba0ad74b9a9701c49
Final feature-head CI          34934177928 — SUCCESS
PR #98                         MERGED
PR CI                          34934241244 — SUCCESS
Implementation merge           408398a01c7a9002849694db504df7e25309c138
Post-merge develop CI          34934307289 — SUCCESS
57 test files / 698 tests
```

Plan: `docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE_PLAN.md`

Record: `docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE.md`

### 4.1C — Financial Profile Repository & Application Services

**COMPLETE**

```text
Implementation head            29be0d69fcfc81867704a6d3b8878b923facb285
Implementation CI              34935572837 — SUCCESS
Final feature head             c8a7152b5cbd44f2e47d50ed1ea828c1277f2c57
Final feature-head CI          34935732585 — SUCCESS
PR #100                        MERGED
PR CI                          34935817685 — SUCCESS
Implementation merge           ebf3ebfbd3e3279c1f108effd50ac936fe057d8f
Post-merge develop CI          34935914716 — SUCCESS
59 test files / 715 tests
16 repository/service tests
1 shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production build passed
```

Plan: `docs/PHASE_4_1C_FINANCIAL_PROFILE_REPOSITORY_SERVICES_PLAN.md`

Record: `docs/PHASE_4_1C_FINANCIAL_PROFILE_REPOSITORY_SERVICES.md`

### 4.2A — Waste-Adjusted Direct-Material Unit Cost

**COMPLETE**

```text
Initial implementation head    720cf61af18a597111c1e509888f828893c7b1c8
Initial CI                     34936904329 — FAILURE (test fixture "ml" vs canonical "mL")
Corrected implementation head  6cd4579d6599e459b591c6f15ba8dc7a63850fc1
Corrected implementation CI    34937058854 — SUCCESS
Final feature head             565e519b034a53edec525440f56b6996f17097d3
Final feature-head CI          34937207673 — SUCCESS
PR #102                        MERGED
PR CI                          34937298973 — SUCCESS
Implementation merge           5603fac7d8263e4b242a7d5a7bc76a8a9da84de3
Post-merge develop CI          34937447317 — SUCCESS
61 test files / 730 tests
14 WasteAdjustedDirectMaterialCostService tests
1 4.2A shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production build passed
```

Plan: `docs/PHASE_4_2A_WASTE_ADJUSTED_DIRECT_MATERIAL_UNIT_COST_PLAN.md`

Record: `docs/PHASE_4_2A_WASTE_ADJUSTED_DIRECT_MATERIAL_UNIT_COST.md`

### 4.2B — Recursive Fully Loaded Product Component Cost

**COMPLETE**

```text
Plan commit                     06bb9aa4cffde4da050fda8be4c1faa17dc3d9f1
Implementation head             fbf804234896d92a18c7721dfe53470d801f89fd
Implementation CI               34938739599 — SUCCESS
Final feature head              df0e6b406c0ef82763b6870b81e8d01aac34c10c
Final feature-head CI           34938953338 — SUCCESS
PR #104                         MERGED
PR CI                           34939051807 — SUCCESS
Implementation merge            43248152960681afb23d3c56f08712918ae58d06
Post-merge develop CI           34939144860 — SUCCESS
63 test files / 754 tests
23 RecursiveFullyLoadedProductComponentCostService tests
1 4.2B shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production build passed
102 modules transformed
```

Plan: `docs/PHASE_4_2B_RECURSIVE_FULLY_LOADED_PRODUCT_COMPONENT_COST_PLAN.md`

Record: `docs/PHASE_4_2B_RECURSIVE_FULLY_LOADED_PRODUCT_COMPONENT_COST.md`

### 4.2C — Total Fully Loaded Unit Cost & Readiness

**COMPLETE**

Delivered:

- authoritative root Product fully loaded unit-cost service;
- 4.2A waste-adjusted direct material included exactly once;
- Phase 3 Material-backed component costs;
- 4.2B Product-backed fully loaded component costs;
- root labor and overhead;
- known partial subtotal kept distinct from authoritative total;
- component-only root neutral-direct semantics;
- financial-profile fail-closed readiness;
- pricing-policy independence;
- immediate component source-uniqueness guard;
- deterministic component trace;
- archived-root inspectability;
- defensive cloning;
- shared application-session wiring.

Evidence:

```text
Plan commit                     f1fdf1957e3b17a07bc8ca756135c35d48b6d22c
Initial implementation head     6a52451b7db593563cd747f7926dceeed82c4f76
Initial CI                      34940513808 — FAILURE (Material-backed status type mismatch)
Corrected type-contract head    4e5a186d3eb47a4d92d6070c98572c124d75b77d
Corrected CI                    34940692457 — FAILURE (test-only duplicate-source fixture)
Green implementation head       3f048062ccc76787b38d6eeddb8b8c2372c503df
Implementation CI               34940853079 — SUCCESS
Final feature head              3ba9a3f7f7d1e5fb088b1318354032ffdcac4b5d
Final feature-head CI           34941112509 — SUCCESS
PR #106                         MERGED
PR CI                           34941214080 — SUCCESS
Implementation merge            ecc361cee6ed4f9e45389c00e4c1b672a0bbf632
Post-merge develop CI           34941302219 — SUCCESS
65 test files / 779 tests
24 FullyLoadedProductUnitCostService tests
1 4.2C shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production build passed
103 modules transformed
```

Plan: `docs/PHASE_4_2C_TOTAL_FULLY_LOADED_UNIT_COST_READINESS_PLAN.md`

Record: `docs/PHASE_4_2C_TOTAL_FULLY_LOADED_UNIT_COST_READINESS.md`

## Current active task

**4.3A — Selling Price Derivation — NEXT / NOT STARTED**

Do not begin 4.3A until:

1. the 4.2C documentation-only closeout is merged to `develop`;
2. exact final closeout `develop` CI is green;
3. a dedicated 4.3A development plan/scope review is established before implementation.
