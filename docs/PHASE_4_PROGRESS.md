# Phase 4 — Pricing & Production Planning Progress

Status: **IN PROGRESS**

Planning baseline: `docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Authoritative planning merge:

`develop` @ `691651f15156c1258a6f1ef75b43d53b6836a426`

Planning post-merge CI:

`34931938705 — SUCCESS`

```text
4.1 — Financial Profile & Pricing Policy Foundation      IN PROGRESS
    4.1A — Product Financial Profile Contract             COMPLETE
    4.1B — Pricing Formula & Validation Engine            NEXT
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

## Locked Phase 4 decisions

- Phase 4 financial source configuration is separate from the Phase 2/3 Product recipe/composition contract.
- One configured Product financial profile carries explicit labor cost per unit, explicit overhead cost per unit, and independently configurable pricing policy.
- Missing financial profile is unresolved; explicit zero labor/overhead is known zero.
- `pricingPolicy: null` explicitly represents unconfigured pricing while known cost adders remain valid source evidence.
- Pricing methods are fixed profit amount, markup percentage, and target margin.
- Internal percentage rates use canonical decimals; UI may later present human percentages.
- Target margin must satisfy `0 <= rate < 1`; authoritative numeric validation belongs to 4.1B.
- Standard unit economics include direct-material safety waste exactly once.
- Observed yield defects are not re-applied.
- Parent safety waste does not inflate discrete component counts.
- Handmade Product components roll up fully loaded production cost, never child retail profit.
- Unit financial math retains full precision; currency formatting is presentation-only.
- Physical batch cost uses Phase 2 final-batch count rounding and may differ from unit cost × quantity.
- Expected batch profit uses physical planned production cost.
- Capacity feasibility uses Phase 3 AssemblyCapacityTraceService and never silently clamps the requested quantity.
- Derived cost/price/revenue/profit is not authoritative persisted source data.
- Phase 4 excludes payroll/timekeeping, global overhead allocation, tax/VAT, discounts, marketplace fees, accounting posting, stock reservation/deduction, Excel persistence, and Tauri integration.

## Completed phase records

### 4.1A — Product Financial Profile Contract

**COMPLETE**

Delivered:

- dedicated pricing source types and supported-method guard;
- ProductFinancialProfile source contract;
- explicit labor and overhead per-unit source values;
- explicit configured/unconfigured pricing policy state;
- missing-profile versus explicit-zero semantics;
- validation/normalization/deep cloning;
- BusinessDataset financial-profile collection;
- no Product contract contamination;
- no 4.1B formula/range implementation leakage.

Evidence:

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
18 ProductFinancialProfile tests
3 pricing source-type tests
7 React smoke tests
TypeScript typecheck passed
production build passed
```

Development plan:

`docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT_PLAN.md`

Implementation record:

`docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT.md`

## Current active task

**4.1B — Pricing Formula & Validation Engine — NEXT / NOT STARTED**

Do not begin 4.1B until a dedicated 4.1B development plan/scope review is established after the 4.1A closeout is merged and exact final `develop` CI is green.
