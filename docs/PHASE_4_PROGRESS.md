# Phase 4 — Pricing & Production Planning Progress

Status: **MASTER PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Planning baseline: `docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Authoritative planning base:

`develop` @ `b963f2d35f19f219df040208c5718cd4b9f078a3`

Starting exact `develop` CI:

`34930800736 — SUCCESS`

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

## Locked Phase 4 decisions

- Phase 4 financial source configuration is separate from the Phase 2/3 `Product` recipe/composition contract.
- One configured Product financial profile carries explicit labor cost per unit, explicit overhead cost per unit, and an independently configurable pricing policy.
- Missing financial profile is unresolved; a profile containing explicit `0` labor/overhead is known zero.
- Pricing methods are fixed profit amount, markup percentage, and target margin.
- Internal percentage rates are canonical decimals; UI may present human percentages.
- Target margin must satisfy `0 <= rate < 1`; invalid margin fails closed and never becomes a fake zero selling price.
- Standard unit economics include the Product's explicit direct-material safety-waste planning reserve exactly once.
- Observed yield defects are not re-applied in Phase 4.
- Parent safety waste does not inflate discrete component quantities.
- Handmade Product components contribute their recursively fully loaded production cost, including their own direct safety reserve/labor/overhead, but never their retail selling price/profit.
- Unit financial math retains full precision; PHP currency rounding is presentation-only.
- Physical planned batch cost uses Phase 2 final-batch count rounding and therefore can differ from `totalUnitCost × quantity`.
- Expected batch profit is based on physical planned production cost, not the generic historical `plannedTotals()` shortcut.
- Capacity feasibility uses Phase 3 `AssemblyCapacityTraceService`; requested quantity is never silently auto-clamped.
- Derived prices/costs/revenue/profit are not persisted as authoritative source data.
- Phase 4 introduces no payroll/timekeeping, global overhead allocator, tax/VAT, discounts, marketplace fees, accounting journal entries, stock reservation/deduction, Excel persistence, or Tauri integration.

## Planning discovery notes

Existing reusable contracts:

- `ProductionRequirementService` — safety-waste-adjusted direct production requirements and physical batch quantities;
- `ComponentAwareProductCostService` — authoritative Phase 3 material/component cost evidence and recursive component trace;
- `AssemblyCapacityTraceService` — current final assembly capacity and all typed tied limiters;
- existing `PricingMethod`/`PricingPolicy` and generic `costing.ts` pricing helpers — scaffold only; must be validated/hardened in 4.1B before being treated as authoritative.

Existing gap requiring Phase 4:

- no product financial profile source record;
- no explicit labor/overhead source data;
- no readiness-aware fully loaded cost service;
- no authoritative selling-price quote service;
- no application-level physical batch financial plan;
- no Pricing workspace;
- current Production UI has no revenue/profit layer.

## Current active task

**4.1A — Product Financial Profile Contract — NEXT / NOT STARTED**

Do not begin 4.1A until:

1. Phase 4 master plan/progress documentation is merged to `develop`;
2. exact post-merge `develop` CI is green;
3. a dedicated 4.1A development plan/scope review is created.
