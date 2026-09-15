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

4.3 — Selling Price & Unit Economics                      COMPLETE
    4.3A — Selling Price Derivation                       COMPLETE
    4.3B — Profit / Markup / Margin Metrics               COMPLETE
    4.3C — Product Pricing Quote & Readiness Service      COMPLETE

4.4 — Planned Batch Financials & Capacity                 COMPLETE
    4.4A — Physical Planned Batch Production Cost         COMPLETE
    4.4B — Expected Revenue / Profit / Batch Margin       COMPLETE
    4.4C — Capacity Feasibility & Warning Synthesis       COMPLETE

4.5 — Pricing & Production Planning UI                    IN PROGRESS
    4.5A — Product Financial Profile Editor               COMPLETE
    4.5B — Unit Economics / Pricing Calculator UI         COMPLETE
    4.5C — Production Financial Summary & Warnings UI     NEXT

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
- 4.2C provides the authoritative root Product fully loaded unit-cost synthesis from 4.2A direct materials, Phase 3 Material-backed components, 4.2B Product-backed components, root labor, and root overhead.
- Root `pricingPolicy` does not participate in 4.2C production-cost math or readiness.
- Genuine component-only root Products can use the controlled neutral-direct interpretation; no-direct/no-component roots remain unresolved.
- Missing/invalid root financial profile or unresolved component/direct evidence preserves known subtotal but blocks authoritative `totalFullyLoadedUnitCost`.
- `totalFullyLoadedUnitCost` is the authoritative cost basis for Phase 4.3 only when 4.2C status is `ready`.
- 4.3A derives selling price only from ready 4.2C `totalFullyLoadedUnitCost`; `knownFullyLoadedUnitCostSubtotal` is never a price basis.
- 4.3A uses the Product's configured 4.1C pricing policy and delegates all pricing formulas/validation to the authoritative 4.1B pricing engine.
- A ready unit cost with `pricingPolicy = null` remains visible while selling price stays unresolved; no default markup/profit/margin is invented.
- Partial or not-ready unit-cost evidence is never priced, even when a valid pricing policy exists.
- Invalid/corrupted pricing policy or contradictory cost/profile identity fails closed with controlled issues.
- Selling-price derivation retains full numeric precision; presentation rounding remains a UI concern.
- Archived root Products remain inspectable/priceable when cost and pricing evidence are otherwise valid.
- 4.3B consumes the authoritative 4.3A selling-price result and does not re-derive selling price or directly reload lower-level financial/cost sources.
- 4.3B delegates profit, effective-markup, and effective-margin formulas to the authoritative 4.1B pricing domain.
- A zero unit-cost denominator yields `effectiveMarkup = null`; a zero selling-price denominator yields `effectiveMargin = null`; both remain explicit diagnostics rather than Infinity/NaN.
- 4.3B preserves the configured pricing method/value trace and exposes deterministic cost-to-price reconciliation.
- Partial/not-ready or internally contradictory 4.3A evidence never publishes authoritative 4.3B metrics.
- Unit-economics diagnostics remain derived, full-precision, non-persisted evidence; presentation percentage/currency formatting remains a UI concern.
- 4.3C is an orchestration/read-model boundary only; it does not duplicate cost, selling-price, profit, markup, or margin formulas.
- 4.3C retains complete defensively cloned financial-profile evidence, the complete 4.2C cost result, and the complete 4.3B unit-economics result for UI/reporting inspection.
- 4.3C validates Product identity, cost status, authoritative total cost, known subtotal, and configured pricing-policy consistency across independently retrieved sources and fails closed on contradictions.
- 4.3C quote readiness is `ready`, `partial`, or `not-ready`; zero-denominator diagnostics inherited from 4.3B do not downgrade an otherwise ready quote.
- 4.3C top-level cost/price/profit/markup/margin fields are convenience mirrors of authoritative nested evidence and remain non-persisted derived data.
- 4.4A physical batch cost uses Phase 2 Q-specific `plannedBatchBaseQuantity`; it is not derived from standard unit cost multiplied by quantity.
- Final-batch upward rounding for direct `pc` materials remains visible through precise quantity, physical quantity, rounding delta, and rounding-cost trace.
- 4.4A reuses completed 4.2C cost-per-base-unit, component, labor, and overhead evidence instead of reopening lower-level costing repositories.
- Material-backed and Product-backed component production cost scales by requested quantity without applying parent safety waste to discrete component counts.
- Product-backed child retail selling price, profit, and pricing policy never participate in physical production-cost planning.
- Genuine component-only Products retain the controlled `neutral-component-only` direct-material interpretation only when the current Phase 2 physical plan consistently reports no direct requirements.
- 4.4A preserves known physical cost subtotals for partial evidence but publishes `plannedProductionCost` only when the complete physical batch cost is authoritative.
- Non-null invalid/non-finite physical cost evidence is unsafe and fails closed to `not-ready`; it is not treated as merely incomplete evidence.
- `standardUnitCostTimesQuantity` and `physicalVsStandardCostDifference` are trace diagnostics only and are not alternate pricing or production-cost bases.
- 4.4B is an orchestration/read-model boundary over completed 4.3C pricing and 4.4A physical planned production cost; it does not reopen lower-level cost or pricing repositories.
- 4.4B expected revenue is authoritative selling price multiplied by requested quantity and may remain visible when pricing is ready but physical cost is incomplete.
- 4.4B expected profit uses `expectedRevenue - plannedProductionCost`; partial known physical cost is never mislabeled as final profit evidence.
- Finite negative physical batch profit and batch margin are valid business outcomes and are not sanitized to zero.
- Zero expected revenue yields `batchMargin = null` with an explicit diagnostic rather than Infinity/NaN; zero quantity similarly yields no average physical cost per finished unit.
- `profitPerUnit × Q` and `physicalVsUnitProfitDifference` are diagnostics only; physical planned production cost remains the authoritative batch-profit basis.
- 4.4B validates Product identity, active state, requested quantity, unit-cost status, standard fully loaded unit cost, and authoritative numeric evidence across 4.3C/4.4A and fails closed on contradictions.
- Complete 4.3C and 4.4A evidence is retained defensively for downstream inspection; derived 4.4B revenue/profit/margin values remain non-persisted.
- 4.4C is an orchestration/read-model boundary over completed 4.4B financials and completed Phase 3.4C assembly-capacity trace; it does not recompute financial or capacity mathematics.
- 4.4C preserves the requested planned quantity exactly and never silently clamps it to current capacity.
- A fully known over-capacity request is valid ready planning evidence; physical feasibility and joined-readiness are separate concepts.
- When Phase 3 synthesis capacity is ready but limiter trace labeling/path evidence is partial, 4.4C preserves authoritative numeric within/over feasibility, marks joined readiness partial, publishes no misleading partial top-level limiter subset, and emits an incomplete-limiter-explanation warning.
- Fully ready limiter evidence preserves every tied typed limiting resource across direct Material requirements, Material-backed components, and Product-backed components without choosing a single winner.
- 4.4C validates Product identity, active state, trace/synthesis identity and status, authoritative numeric capacity, and limiter-capacity consistency and fails closed on contradictions.
- Capacity warnings are advisory only; 4.4C does not reserve/deduct inventory, create production orders, or persist derived capacity/feasibility data.
- 4.5A is a dedicated top-level Pricing workspace; financial source fields are not mixed into the Product recipe/composition editor.
- 4.5A consumes existing `productService` and `productFinancialProfileService` boundaries and sends all financial-profile writes through `ProductFinancialProfileService.upsertProfile(...)`; no repository/source array is mutated directly by the UI.
- 4.5A keeps missing financial profiles visually distinct from explicit zero labor/overhead profiles; blank source inputs are never silently converted to known zero.
- Archived Products remain selectable/editable in 4.5A because the completed 4.1C source contract keeps their financial profiles inspectable.
- 4.5A presents fixed-profit values as PHP amounts and markup/target-margin values as human percentages while converting percentages to canonical decimal rates only at the UI boundary.
- An unconfigured pricing policy remains an explicit supported UI state mapped to `pricingPolicy = null`; there is still no profile-delete/reset contract.
- 4.5A validates required form text without clamping invalid source values; authoritative financial-profile/pricing domain validation remains the final write gate.
- 4.5A reloads the authoritative Product financial profile after a successful save and introduces no unit-economics, batch-financial, or capacity-warning calculations that belong to 4.5B/4.5C.
- 4.5B is a read-only presentation layer over `ProductPricingQuoteService`; React does not recompute authoritative cost, selling price, profit, markup, or margin.
- 4.5B shares the existing 4.5A Product selection context and refreshes the quote after Product selection changes and successful financial-profile saves.
- 4.5B uses a request-version guard so stale asynchronous quote responses cannot overwrite the currently selected Product's quote.
- 4.5B keeps direct material base cost and safety reserve separately visible and separates Material-backed purchased components from Product-backed handmade components.
- 4.5B preserves nested Product-component paths and issues for readable inspection without turning the UI into a separate accounting ledger.
- 4.5B never substitutes `knownFullyLoadedUnitCostSubtotal` for an unavailable authoritative `totalFullyLoadedUnitCost` and never converts null/unresolved evidence into fake zero.
- 4.5B displays the configured pricing policy, selling price, profit per unit, effective markup, effective margin, readiness, and issues directly from authoritative 4.3C evidence.
- 4.5B intentionally excludes requested batch quantity, physical batch cost, expected batch revenue/profit, batch margin, capacity feasibility, and over-capacity warnings; those remain 4.5C.
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

### 4.3A — Selling Price Derivation

**COMPLETE**

Delivered:

- authoritative Product-level selling-price derivation service;
- ready Phase 4.2C `totalFullyLoadedUnitCost` as the only priceable cost basis;
- configured Product pricing policy from 4.1C;
- all formulas/validation delegated to the 4.1B pricing engine;
- fixed-profit, markup, and target-margin support;
- unconfigured policy preserves ready cost but leaves selling price unresolved;
- partial/not-ready cost is never priced;
- no default pricing policy;
- Product/profile identity guards and corrupted-policy fail-closed behavior;
- full precision with no presentation rounding;
- archived Product inspectability/priceability;
- defensive policy cloning;
- shared application-session wiring;
- no 4.3B+ leakage.

Evidence:

```text
Plan-before-code commit         4ae338331cf4f28d6ec6f997ab94339af9b4d056
Implementation head             3cded1826b18aa46195e9d87e60cafcafc1d9cd6
Implementation CI               34942368270 — SUCCESS
Final feature head              258eca03d64325631e04b776ab9d1a42d377e87b
Final feature-head CI           34942557415 — SUCCESS
PR #108                         MERGED
PR CI                           34942666927 — SUCCESS
Implementation merge            4a2d28ef7be757a2fe4f4f2e037ad4a6abef11fd
Post-merge develop CI           34942765862 — SUCCESS
67 test files / 807 tests
27 SellingPriceDerivationService tests
1 4.3A shared-session wiring test
50 pricing-domain tests
24 Phase 4.2C cost tests
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
104 modules transformed
```

Plan: `docs/PHASE_4_3A_SELLING_PRICE_DERIVATION_PLAN.md`

Record: `docs/PHASE_4_3A_SELLING_PRICE_DERIVATION.md`

### 4.3B — Profit / Markup / Margin Metrics

**COMPLETE**

Delivered:

- authoritative Product-level profit-per-unit diagnostics over the completed 4.3A selling-price result;
- effective markup and effective margin through the completed 4.1B pricing-domain formulas;
- pricing method/value trace without presentation conversion;
- deterministic cost-to-price reconciliation;
- explicit zero-denominator ratio diagnostics instead of Infinity/NaN;
- partial/not-ready upstream propagation without authoritative metrics;
- Product identity and contradictory-ready-evidence fail-closed guards;
- archived Product inspectability;
- defensive pricing-policy and upstream-issue cloning;
- full precision with no presentation rounding;
- shared application-session wiring;
- no 4.3C+ leakage.

Evidence:

```text
Starting develop                57f0e339c88f2bb2a1a5ffbdc142e1a5a1c996e9
Starting develop CI             34943235932 — SUCCESS
Plan-before-code commit         5b3c3544e97d5f24df1c91b28b898ff97aeface3
Implementation head             1801ae8f0ee03c012205163bd7870992c0be383c
Implementation CI               34944416475 — SUCCESS
Final feature head              f2c94d5e81e02c5ee8de4b220b7c7674e684dea9
Final feature-head CI           34944553827 — SUCCESS
PR #110                         MERGED
PR CI                           34944661918 — SUCCESS
Implementation merge            c6f7611a24c798cfa12ef28d4603f2c36b59a729
Post-merge develop CI           34944765414 — SUCCESS
69 test files / 827 tests
19 ProfitMarkupMarginMetricsService tests
1 4.3B shared-session wiring test
TypeScript typecheck passed
production Vite build passed
```

Plan: `docs/PHASE_4_3B_PROFIT_MARKUP_MARGIN_METRICS_PLAN.md`

Record: `docs/PHASE_4_3B_PROFIT_MARKUP_MARGIN_METRICS.md`

### 4.3C — Product Pricing Quote & Readiness Service

**COMPLETE**

Delivered:

- consolidated Product pricing quote/readiness read model over existing Phase 4 boundaries;
- complete Product financial-profile evidence;
- complete nested 4.2C fully loaded cost evidence;
- complete nested 4.3B unit-economics evidence carrying 4.3A selling-price semantics;
- top-level convenience mirrors for cost, policy, price, profit, markup, and margin;
- deterministic ready/partial/not-ready quote status;
- fail-closed cross-source Product identity, status, cost, subtotal, and pricing-policy consistency checks;
- Product-not-found error translation;
- defensive cloning of nested evidence;
- shared application-session wiring;
- no 4.4+ leakage.

Evidence:

```text
Starting develop                c19307ba99b18b35e1edbc46b3dede159700714e
Starting develop CI             34945306955 — SUCCESS
Plan-before-code commit         f0101386aee8162110e62350f2f4831720eb2469
Implementation head             bc55598cce76d8c28a8fc50ad4aab114f073b4cd
Implementation CI               34948566213 — SUCCESS
Final feature head              d5edb5f1e939d132cb1ef5b88a939ddce9e53e75
Final feature-head CI           34948683874 — SUCCESS
PR #112                         MERGED
PR CI                           34948784081 — SUCCESS
Implementation merge            43d2caeea2b8192f306d4ffb5cd0b13805bfea07
Post-merge develop CI           34948917659 — SUCCESS
71 test files / 853 tests
25 ProductPricingQuoteService tests
1 4.3C shared-session wiring test
TypeScript typecheck passed
production Vite build passed
```

Plan: `docs/PHASE_4_3C_PRODUCT_PRICING_QUOTE_READINESS_PLAN.md`

Record: `docs/PHASE_4_3C_PRODUCT_PRICING_QUOTE_READINESS.md`

### 4.4A — Physical Planned Batch Production Cost

**COMPLETE**

Delivered:

- authoritative Q-specific physical production-cost service;
- Phase 2 final-batch direct-material quantities as the physical direct-material cost basis;
- explicit `pc` count-rounding quantity and cost trace;
- completed 4.2C cost-per-base-unit evidence reuse;
- Material-backed component quantity/cost scaling by requested quantity;
- Product-backed child fully loaded production-cost scaling by requested quantity;
- root labor and overhead batch scaling;
- controlled component-only neutral direct-material semantics;
- ready/partial/not-ready readiness with known physical subtotal preservation;
- fail-closed Product, quantity, material-set, base-unit, and numeric consistency guards;
- diagnostic standard unit-cost comparison without changing the physical production-cost basis;
- planned-quantity and Product-not-found error translation;
- defensive cloning of retained Phase 2/4.2C evidence;
- shared application-session wiring;
- no 4.4B+ leakage.

Evidence:

```text
Starting develop                1a7629385c0e6dd84255ab014a3f3ec0210bfa68
Starting develop CI             34949575060 — SUCCESS
Plan-before-code commit         5fa6327d72766680b47b1ea95426e50ffc1f2c08
Compile/wiring checkpoint       f286189dc9bbca1736f545fb75e60b80323b4a79
Checkpoint CI                   34951009176 — SUCCESS
Initial focused-test head       4145fb51eb84111804cb5ec3d394326579fce360
Focused-test CI                 34951294935 — FAILURE (invalid-cost readiness classification corrected)
Corrected implementation head   1306cc169d112049fc5fdc635c7ce0c68db44338
Corrected CI                    34951713527 — SUCCESS
Final feature head              a246b2f086da1a798dee09dbe319356e6561c834
Final feature-head CI           34951843605 — SUCCESS
PR #114                         MERGED
PR CI                           34951946653 — SUCCESS
Implementation merge            eec44812067740cc26f440f6751f4e34c5bd4f4e
Post-merge develop CI           34952186409 — SUCCESS
73 test files / 884 tests
30 PhysicalPlannedBatchProductionCostService tests
1 4.4A shared-session wiring test
TypeScript typecheck passed
production Vite build passed
107 modules transformed
```

Plan: `docs/PHASE_4_4A_PHYSICAL_PLANNED_BATCH_PRODUCTION_COST_PLAN.md`

Record: `docs/PHASE_4_4A_PHYSICAL_PLANNED_BATCH_PRODUCTION_COST.md`

### 4.4B — Expected Revenue / Profit / Batch Margin

**COMPLETE**

Delivered:

- authoritative expected revenue from completed 4.3C selling-price evidence and requested quantity;
- authoritative expected profit from expected revenue minus completed 4.4A physical planned production cost;
- effective batch margin with explicit zero-revenue denominator diagnostics;
- planned average physical cost per finished unit with explicit zero-quantity diagnostics;
- standard `profitPerUnit × Q` comparison and physical-vs-unit-profit difference trace;
- valid finite negative physical batch profit/margin preservation;
- ready/partial/not-ready propagation while preserving independent authoritative expected revenue where valid;
- fail-closed Product identity, active-state, requested-quantity, cost-status, standard-unit-cost, and numeric consistency guards;
- controlled Product-not-found and 4.4A quantity/production-requirement error translation;
- defensive cloning of complete retained 4.3C and 4.4A evidence;
- shared application-session wiring;
- no 4.4C+ leakage.

Evidence:

```text
Starting develop                b634689bfc5b43071ff2426d3b4cb24d09e0b5aa
Starting develop CI             34953319607 — SUCCESS
Plan-before-code commit         8f19b98bcfc6c0a5f20c2459cc0d19bc0ec21463
Service implementation          3283328c21c36f25cfafa739aaa0e235001ec603
Session/wiring checkpoint       d6eaf6abd464306ea9eed0fd02c35588af9696f6
Checkpoint CI                   34953761406 — SUCCESS
Focused service-test commit     4d26032126c00df78973fcd1294b0ec42b4b710f
Initial focused-test head       1a1a31a35b448f8ff64739d178e7208adc216ea5
Initial focused-test CI         34953949082 — FAILURE (test fixture typing only: notes null vs optional string)
Corrected validation head       d8ca649aee3f4c782a74c707b000025145f5f0e9
Corrected validation CI         34954110739 — SUCCESS
Implementation record commit    bef3c09fcaa1b9cb8f13a23fea9c10239210a59f
Final feature head              578fc3412c53f01d7c70ad5104288faeb110666b
Final feature-head CI           34954391569 — SUCCESS
PR #116                         MERGED
PR CI                           34954486934 — SUCCESS
Implementation merge            d12f336a9e64a32e8bd0ffbecba0b6522006b67c
Post-merge develop CI           34954576204 — SUCCESS
75 test files / 907 tests
22 ExpectedBatchFinancialsService tests
1 4.4B shared-session wiring test
TypeScript typecheck passed
production Vite build passed
108 modules transformed
```

Plan: `docs/PHASE_4_4B_EXPECTED_REVENUE_PROFIT_BATCH_MARGIN_PLAN.md`

Record: `docs/PHASE_4_4B_EXPECTED_REVENUE_PROFIT_BATCH_MARGIN.md`

### 4.4C — Capacity Feasibility & Warning Synthesis

**COMPLETE**

Delivered:

- authoritative planned-batch feasibility synthesis over completed 4.4B financials and Phase 3.4C capacity trace;
- unchanged requested quantity with no silent auto-clamping;
- deterministic `within-current-capacity`, `over-current-capacity`, and `capacity-unresolved` classifications;
- exact overage quantity when a requested batch exceeds current authoritative capacity;
- preservation of financial projections even when a fully known request is over current capacity;
- preservation of every authoritative tied limiter across direct Material, Material-backed component, and Product-backed component resource types;
- explicit distinction between authoritative numeric capacity and incomplete limiter-label/path explanation;
- structured `OVER_CURRENT_CAPACITY`, `CAPACITY_UNRESOLVED`, and `LIMITING_RESOURCE_EXPLANATION_INCOMPLETE` warnings;
- fail-closed Product identity, active-state, trace/synthesis status, capacity, and limiter consistency guards;
- controlled 4.4B request-error translation;
- defensive cloning of complete 4.4B and Phase 3.4C evidence;
- shared application-session wiring;
- no stock reservation/deduction, production-order mutation, or derived persistence;
- no Phase 4.5 UI leakage.

Evidence:

```text
Starting develop                c2100da3c787784f83b1fc0408cfa05ef9c04327
Starting develop CI             34955037015 — SUCCESS
Plan-before-code commit         ebc4a47ffb87c6ab318a583ee55cb90a607d893c
Service implementation          61ea9a03b5621b277d0b016a10c95f5e15f2dc10
Session/wiring commit           7c33ed1ff635185a8464392968d2f72786294b47
Initial focused-test head       7d7e645700526644a84f641e70c49b04a286f92f
Initial focused-test CI         34959784315 — FAILURE (strict TypeScript fixture/clone typing only)
Corrected validation head       aa294854e55289343683776d0607cc0ada2675d3
Corrected validation CI         34960081875 — SUCCESS
Implementation record commit    f37865be56c582c98f21b9b1107080210744ba93
Final feature head              efb0d9f7bd61e9db1ef4464d38a2cfc1d5bdd02c
Final feature-head CI           34960280693 — SUCCESS
PR #118                         MERGED
PR CI                           34960379820 — SUCCESS
Implementation merge            06f6b8bead020d88e332052583d462126c45b988
Post-merge develop CI           34960524805 — SUCCESS
77 test files / 941 tests
33 PlannedBatchCapacityFeasibilityService tests
1 4.4C shared-session wiring test
TypeScript typecheck passed
production Vite build passed
109 modules transformed
```

Plan: `docs/PHASE_4_4C_CAPACITY_FEASIBILITY_WARNING_SYNTHESIS_PLAN.md`

Record: `docs/PHASE_4_4C_CAPACITY_FEASIBILITY_WARNING_SYNTHESIS.md`

### 4.5A — Product Financial Profile Editor

**COMPLETE**

Delivered:

- dedicated top-level Pricing workspace separated from Product recipe/composition editing;
- service-backed Product financial-profile source editing;
- active / archived / all Product catalog filtering and name/ID search;
- archived Product financial-profile inspection/editing;
- explicit missing-profile versus known-zero labor/overhead presentation;
- unconfigured, fixed-profit, markup-percentage, and target-margin-percentage policy controls;
- explicit PHP labels for labor, overhead, and fixed profit;
- human `%` presentation with canonical decimal-rate conversion at the UI boundary;
- authoritative save/reload flow through `ProductFinancialProfileService`;
- textual validation/success feedback without silent clamping;
- responsive catalog/editor layout;
- dedicated pure form-mapping regression tests and updated App smoke coverage;
- no 4.5B unit-economics or 4.5C production-financial/capacity-warning leakage;
- no application/domain/storage contract changes.

Evidence:

```text
Starting develop                b9a0f67a4184c7dcb9552e319b032bc8a94ec3bf
Starting develop CI             34961231327 — SUCCESS
Plan-before-code commit         3a9c60eec6cac706d3a12d229791d72684810489
Form-mapping helper commit      654adc19c491b6a51b8f287e1016a98a987d9318
Focused form-test commit        080467876e1b86dd941a1b29bffd6e96d71a11fa
PricingPage commit              e53d5ca6bd49c96b9e43b6c24c4b24d9559d6634
Pricing styling commit          f2125f19bb5fa00508eb02f92d9034f4f7782ca5
App navigation commit           7fe68c50912bfbe6082ffd5f9a33712e6b9d756d
Editor-shell refinement         69f2830f475fea64b3241ddb26270448ba5eca6a
Validated implementation head   8e8cdf8ac3cbede360b0212ac50421e398dce975
Implementation CI               34962216103 — SUCCESS
Implementation record commit    ff1e9b335d7e462d279daacc85f7b7b44b7fae6c
Final feature head              bf458d9057e8045957c5612cbec997b19ba8ea50
Final feature-head CI           34962405867 — SUCCESS
PR #120                         MERGED
PR CI                           34962602159 — SUCCESS
Implementation merge            86268804911f3fc6a8f39adadf8ac16164f0e332
Post-merge develop CI           34962679838 — SUCCESS
78 test files / 955 tests
13 Phase 4.5A form-mapping tests
8 React workspace smoke tests
TypeScript typecheck passed
production Vite build passed
112 modules transformed
```

Plan: `docs/PHASE_4_5A_PRODUCT_FINANCIAL_PROFILE_EDITOR_PLAN.md`

Record: `docs/PHASE_4_5A_PRODUCT_FINANCIAL_PROFILE_EDITOR.md`

### 4.5B — Unit Economics / Pricing Calculator UI

**COMPLETE**

Delivered:

- authoritative read-only unit-economics presentation over `ProductPricingQuoteService`;
- shared Product selection with the 4.5A financial-profile editor;
- quote refresh on Product selection and after successful profile save;
- stale async quote-response protection through request versioning;
- readable direct-material base cost and safety-reserve separation;
- purchased Material-backed component presentation;
- handmade Product-backed component presentation with recursive path inspection;
- explicit labor and overhead presentation;
- known subtotal kept distinct from authoritative total unit cost;
- pricing policy, selling price, profit per unit, effective markup, and effective margin directly from 4.3C evidence;
- ready / partial / not-ready state and issue visibility;
- null/unresolved evidence preserved as unavailable rather than fake zero;
- no duplicated financial formulas in React;
- no 4.5C batch-financial or capacity-warning leakage;
- no application/domain/storage contract changes.

Evidence:

```text
Starting develop                4003c5caa02e1bd2f19ac058548bc279d4dcd6fb
Starting develop CI             34963245375 — SUCCESS
Validated implementation head   1a66120dfa6a67cbccfa5e6fe48c7bdc59de4d67
Implementation CI               34964259080 — SUCCESS
Documented feature head         142eb69dff7df915a6a5122ac17350e6bc218777
Documented feature-head CI      34964395439 — SUCCESS
PR #122                         MERGED
PR CI                           34966397391 — SUCCESS
Implementation merge            965d3682e2b863751c08aa2a0a975fe1e4cb2d87
Post-merge develop CI           34966516678 — SUCCESS
79 test files / 967 tests
12 Phase 4.5B quote-view tests
13 Phase 4.5A form-mapping tests
8 React workspace smoke tests
TypeScript typecheck passed
production Vite build passed
114 modules transformed
```

Plan: `docs/PHASE_4_5B_UNIT_ECONOMICS_PRICING_CALCULATOR_UI_PLAN.md`

Record: `docs/PHASE_4_5B_UNIT_ECONOMICS_PRICING_CALCULATOR_UI.md`

Closeout: `docs/PHASE_4_5B_CLOSEOUT.md`

## Current active task

**4.5C — Production Financial Summary & Warnings UI — NEXT / NOT STARTED**

Do not begin 4.5C implementation until:

1. this 4.5B documentation-only closeout is merged to `develop`;
2. exact final closeout `develop` CI is green;
3. a dedicated 4.5C scope/split assessment and development plan are established before implementation.