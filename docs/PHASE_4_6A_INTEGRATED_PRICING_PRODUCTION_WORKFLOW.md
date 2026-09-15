# Phase 4.6A — Integrated Pricing / Production Workflow

Status: **IMPLEMENTED — VALIDATED — AWAITING MERGE**

Repository: `nhardbalansag/craft-business-manager`

Feature branch:

`feature/phase-4-6a-integrated-pricing-production-workflow`

Starting `develop`:

`f74579ce155a2462c1edb8ba9478536fae9fa3ef`

Starting CI:

`34969616141 — SUCCESS`

Plan-before-code commit:

`365ab7233694b3aa31047bf9de40f3bc53efe8d1`

Validated implementation head:

`094fe4a631cb3ed8478798f8cc1bad0b93c39e72`

Implementation CI:

`34974785642 — SUCCESS`

## Delivered

Phase 4.6A adds one dedicated real-service integration suite:

`src/application/phase4PricingProductionWorkflow.test.ts`

The suite creates fresh isolated in-memory repositories per scenario and wires the completed source → costing → pricing → batch financial → capacity-feasibility service graph directly.

No authoritative business formula is mocked or reimplemented in the integration fixture.

No production/domain/application behavior change was required.

## Scenario coverage

### Scenario A — Paintable art with fixed profit

Validated:

- real learned yield evidence plus fixed recipe inputs;
- calibration-backed plaster conversion;
- base material cost;
- separately visible safety-waste pricing reserve;
- explicit labor and overhead;
- fixed PHP profit policy;
- fully loaded unit cost / selling price / profit reconciliation.

Verified fixture economics:

```text
base direct material cost      9.85
safety reserve                 0.4925
pricing direct material cost  10.3425
labor                          4.00
overhead                       1.50
fully loaded unit cost        15.8425
fixed profit                   6.00
selling price                 21.8425
```

### Scenario B — Purchased-vessel candle with markup

Validated:

- wax/fragrance parent direct cost;
- parent safety reserve applied to direct materials;
- purchased Glass Cup remains a discrete Material-backed component;
- parent safety waste does not inflate purchased component quantity/cost;
- labor/overhead added once;
- 50% markup selling-price derivation;
- effective markup/margin reconciliation.

Verified key economics:

```text
direct base cost              25.00
safety reserve                 2.50
direct cost                   27.50
purchased vessel              10.00
labor + overhead               7.00
total unit cost               44.50
selling price                 66.75
profit                        22.25
effective markup               50%
effective margin              33.333...%
```

### Scenario C — Handmade-pot candle with target margin

Validated:

- child handmade pot direct material, own safety reserve, own labor, and own overhead;
- child fully loaded unit cost of 30;
- child retail selling price of 100 is deliberately excluded from parent cost roll-up;
- parent receives only the child production-cost contribution of 30;
- parent direct safety-adjusted wax cost, labor, and overhead are each added once;
- parent fully loaded cost is 60;
- 25% target-margin selling price is 80;
- nested Product path is deterministic.

### Scenario D — Multi-component event set

Validated:

- component-only parent neutral direct-material mode;
- two different Product-backed children;
- quantity multipliers 2 and 3;
- fully loaded contributions 14 and 12;
- authoritative parent cost/price/profit;
- ProductStock capacities 4/2 and 6/3 both resolve to 2 parent sets;
- both tied Product-backed limiting resources remain published.

### Scenario E — Physical batch rounding changes profit

Validated with an indivisible direct count material:

```text
standard planned quantity      0.4 pc / unit
requested quantity             3
precise batch quantity         1.2 pc
physical batch quantity        2 pc
standard unit cost            12
standard cost × Q             36
physical batch cost           44
physical difference            8
selling price / unit          17
unit profit × Q               15
physical expected profit       7
physical-vs-unit profit diff  -8
```

This proves authoritative batch profit uses physical final-batch cost rather than naïve unit cost × quantity.

### Scenario F — Capacity warning without auto-clamp

Validated:

- requested quantity 7 remains 7;
- authoritative current capacity is 5;
- feasibility is `over-current-capacity`;
- exact overage is 2;
- financial projections remain available;
- structured `OVER_CURRENT_CAPACITY` warning is published;
- tied direct Material and Material-backed component limiters are both retained;
- Material inventory source records are byte-for-byte semantically unchanged before/after assessment.

### Scenario G — Fail-closed readiness

Validated:

- missing financial profile remains missing and blocks authoritative total/price;
- missing evidence is not converted to zero;
- explicit zero labor/overhead remains known zero;
- unconfigured pricing policy preserves ready unit cost while selling price/profit stay null;
- invalid target margin (`1.0`) is rejected by the existing `PricingError` boundary;
- unresolved nested Product child with no financial profile propagates `FINANCIAL_PROFILE_MISSING` through the recursive line;
- parent authoritative total and selling price remain unavailable;
- root cost synthesis reports Product-component partial readiness rather than publishing misleading ready pricing.

## Integration architecture proven

The suite exercises real instances of:

- Material / calibration / mix / Product source services;
- yield evidence and fixed recipe requirements;
- Product component and Product stock services;
- Product financial-profile service;
- waste-adjusted direct-material cost;
- Material-backed component cost;
- recursive Product-backed fully loaded cost;
- root fully loaded Product unit cost;
- selling-price derivation;
- profit/markup/margin metrics;
- Product pricing quote;
- physical planned-batch production cost;
- expected batch financials;
- direct and component capacity synthesis;
- assembly capacity trace;
- planned-batch capacity feasibility/warnings.

## Validation evidence

Exact validated implementation head:

`094fe4a631cb3ed8478798f8cc1bad0b93c39e72`

CI:

`34974785642 — SUCCESS`

Validation summary:

```text
TypeScript typecheck                  PASS
81 test files                         PASS
986 tests                             PASS
7 Phase 4.6A integration tests        PASS
8 React workspace smoke tests         PASS
production Vite build                 PASS
117 modules transformed
```

No failed implementation checkpoint occurred.

## Scope result

Production files changed by 4.6A implementation: **0**.

The implementation adds integration validation and documentation only.

No Phase 4.6B regression/completion work is included.

## Next gate

Before Phase 4.6A can be declared complete:

1. the documented feature head must receive exact green CI;
2. implementation PR must target `develop` and pass PR CI;
3. exact guarded implementation merge must pass post-merge `develop` CI;
4. documentation-only closeout must be merged and validated;
5. final tracker must advance only `4.6B — Regression / Build / Completion` to NEXT / NOT STARTED.
