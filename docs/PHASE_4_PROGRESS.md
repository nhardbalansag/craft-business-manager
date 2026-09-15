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

4.2 — Fully Loaded Product Unit Cost                      IN PROGRESS
    4.2A — Waste-Adjusted Direct-Material Unit Cost       NEXT
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
- Target margin must satisfy `0 <= rate < 1`; 4.1B enforces this fail-closed.
- Financial-profile writes now pass through the 4.1C repository/application-service boundary and validate both 4.1A source rules and configured 4.1B pricing policy.
- Product financial-profile identity is Product-keyed, case-insensitive for lookup, and canonicalized to Product repository identity.
- Archived Products retain readable/editable financial profiles.
- No profile delete/reset contract exists; missing profile remains meaningful unresolved evidence.
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
```

Plan: `docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT_PLAN.md`

Record: `docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT.md`

### 4.1B — Pricing Formula & Validation Engine

**COMPLETE**

Evidence:

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

Delivered:

- storage-agnostic ProductFinancialProfile repository boundary;
- defensive in-memory Product-keyed repository;
- one profile per Product identity via upsert;
- ProductFinancialProfileService upsert/get/list API;
- Product reference validation and canonical identity;
- 4.1A profile validation + 4.1B configured-policy validation on writes;
- explicit missing-profile versus zero-profile semantics;
- archived Product profile preservation/editability;
- deterministic filter/search/sort;
- nested defensive cloning;
- shared session repository/service wiring;
- no React, persistence, delete/reset, or 4.2 leakage.

Evidence:

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

## Current active task

**4.2A — Waste-Adjusted Direct-Material Unit Cost — NEXT / NOT STARTED**

Do not begin 4.2A until:

1. the 4.1C documentation-only closeout is merged to `develop`;
2. exact final closeout `develop` CI is green;
3. a dedicated 4.2A development plan/scope review is established.
