# Phase 4.3A — Selling Price Derivation Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative base:

`develop` @ `11a32dd4bf035465f4100c1c5146589040dda8d4`

Starting exact `develop` CI:

`34941662149 — SUCCESS`

Feature branch:

`feature/phase-4-3a-selling-price-derivation`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Previous completed prerequisites:

- `4.1B — Pricing Formula & Validation Engine — COMPLETE`
- `4.1C — Financial Profile Repository & Application Services — COMPLETE`
- `4.2C — Total Fully Loaded Unit Cost & Readiness — COMPLETE`

## Objective

Create the authoritative Product-level selling-price derivation boundary for Phase 4.

For Product `P`, 4.3A must combine:

```text
4.2C authoritative totalFullyLoadedUnitCost(P)
+
P configured pricingPolicy
↓
4.1B deriveSellingPrice(...)
↓
authoritative derived sellingPrice(P)
```

4.3A must fail closed. It may expose a ready fully loaded cost while selling price remains unresolved, but it must never invent a default pricing method/value and must never derive price from a partial/not-ready cost basis.

## Authoritative master-plan contract

Phase 4.3A says:

> Combine the fully loaded cost from 4.2C with the Product's configured pricing policy.

If pricing policy is unconfigured:

- keep total unit cost visible when ready;
- selling price remains unresolved/null;
- do not invent a default markup or profit amount.

Phase 4.3B separately owns:

- profit per unit;
- effective markup;
- effective margin;
- policy trace reconciliation.

Phase 4.3C separately owns the consolidated Product pricing quote/readiness view.

Therefore 4.3A must remain deliberately narrow.

## Split assessment

No deeper formal roadmap split is required.

4.3A is one cohesive derivation capability. Internal implementation slices are:

1. obtain authoritative 4.2C cost evidence;
2. preserve canonical Product identity from that evidence;
3. read the Product financial profile through 4.1C;
4. distinguish missing profile from unconfigured pricing policy;
5. defensively verify profile Product identity;
6. validate configured pricing policy using 4.1B;
7. derive selling price only from a ready authoritative 4.2C total;
8. map controlled readiness/issues;
9. preserve full numeric precision/no presentation rounding;
10. shared session wiring;
11. focused tests and full regression validation.

No separate 4.3A.1/4.3A.2 split is justified.

## Existing architecture reviewed

### 4.2C — authoritative cost basis

Use:

`FullyLoadedProductUnitCostService.costProduct(productId)`

Authoritative priceable cost field:

`totalFullyLoadedUnitCost`

Locked rule:

```text
status = ready
=> totalFullyLoadedUnitCost is the only authoritative cost basis for 4.3A
```

`knownFullyLoadedUnitCostSubtotal` is diagnostic partial evidence only. It must never be used to derive an authoritative selling price.

If 4.2C is `partial` or `not-ready`, selling price remains `null` even if a pricing policy exists.

### 4.1C — pricing-policy source

Use:

`ProductFinancialProfileService.getProfile(productId)`

Source field:

`pricingPolicy: PricingPolicy | null`

Semantics:

```text
profile missing       = financial source configuration unresolved
pricingPolicy = null  = cost source may be complete, pricing is intentionally unconfigured
```

4.3A must not mutate or synthesize the financial profile.

### 4.1B — authoritative pricing engine

Use the existing `src/domain/pricing.ts` contract.

Supported methods:

```text
profit-amount
markup-percent
margin-percent
```

Canonical formulas:

```text
profit-amount:
sellingPrice = unitCost + profitAmount

markup-percent:
sellingPrice = unitCost × (1 + markupRate)

margin-percent:
sellingPrice = unitCost / (1 - marginRate)
```

Use:

- `validatePricingPolicy()` for defensive source validation;
- `deriveSellingPrice()` for authoritative full-precision price derivation.

Do not duplicate formulas in the application service.

## Proposed application service

Add:

`src/application/pricing/SellingPriceDerivationService.ts`

Public boundary:

```ts
deriveForProduct(productId: string): Promise<SellingPriceDerivationResult>
```

Expected dependencies:

```text
FullyLoadedProductUnitCostService/provider
ProductFinancialProfileService/provider
```

A Product repository dependency is not required because 4.2C already owns Product existence/canonical identity.

A root Product-not-found error from 4.2C may propagate as its existing typed service error.

## Proposed result contract

Readiness:

```ts
type SellingPriceDerivationStatus = 'ready' | 'partial' | 'not-ready';
```

Expected fields:

```text
productId
productName
productIsActive
status

costStatus
totalFullyLoadedUnitCost
knownFullyLoadedUnitCostSubtotal

pricingPolicy
sellingPrice
issues[]
```

`pricingPolicy` is cloned source evidence when valid/configured; otherwise `null`.

`sellingPrice` is non-null only when:

1. 4.2C status is `ready`;
2. `totalFullyLoadedUnitCost` is finite and non-negative;
3. the Product financial profile exists and belongs to the same Product;
4. `pricingPolicy` is configured;
5. `pricingPolicy` passes 4.1B validation;
6. `deriveSellingPrice()` returns a finite non-negative result.

## Readiness semantics

### ready

Requires:

```text
4.2C status = ready
pricing policy configured + valid
derived selling price valid
```

Then:

```text
sellingPrice != null
```

### partial

Use when meaningful authoritative/partial cost evidence exists but price cannot be published yet.

Examples:

- 4.2C cost is ready but `pricingPolicy = null`;
- 4.2C cost is ready but profile/policy evidence is corrupt or invalid;
- 4.2C status is partial and known cost evidence exists;
- pricing policy is valid but cost basis is partial.

Keep `sellingPrice = null`.

### not-ready

Use when 4.2C itself is not ready and no authoritative priceable cost basis exists.

A configured pricing policy alone does not make selling-price readiness partial/ready when production cost has no meaningful authoritative basis.

## Cost-basis safety

4.3A must never calculate price from:

- `knownFullyLoadedUnitCostSubtotal`;
- Phase 3 `totalComponentAwareCost`;
- 4.2A direct material cost only;
- a child Product selling price;
- a manually invented default unit cost.

Only 4.2C `totalFullyLoadedUnitCost` with `status = ready` is priceable.

If a defensive provider returns `status = ready` with a null/non-finite/negative total, fail closed with a controlled issue.

## Pricing-policy semantics

### Unconfigured policy

For `pricingPolicy = null`:

```text
sellingPrice = null
```

If cost is ready, status becomes `partial` because authoritative cost is visible while price configuration is incomplete.

No default 20%, 30%, fixed peso profit, or other policy is allowed.

### Invalid/corrupted policy

Although 4.1C validates writes, future imported/corrupted data must still fail closed.

Use 4.1B validation and preserve the underlying `PricingError.code` in the 4.3A issue trace.

Do not sanitize:

- negative profit amount;
- negative markup;
- margin >= 1;
- non-finite policy value;
- unsupported method.

### Zero-value policies

These are valid:

```text
profit-amount 0
markup-percent 0
margin-percent 0
```

For a ready cost, they should derive selling price equal to unit cost.

### Full precision

4.3A performs no currency rounding or charm pricing.

Presentation/UI formatting belongs to 4.5.

## Defensive identity checks

Use the canonical Product identity returned by 4.2C when retrieving the financial profile.

If a provider returns a profile whose `productId` does not case-insensitively match the cost result Product:

- do not trust its pricing policy;
- return a controlled mismatch issue;
- do not derive selling price.

If a defensive cost provider returns a Product identity that does not match the requested Product identity case-insensitively:

- fail closed;
- do not read/apply another Product's policy;
- return a controlled cost-evidence mismatch issue.

## Controlled issue categories

Expected 4.3A issue codes include at least:

```text
COST_PARTIAL
COST_NOT_READY
COST_PRODUCT_MISMATCH
COST_TOTAL_INVALID
FINANCIAL_PROFILE_MISSING
FINANCIAL_PROFILE_PRODUCT_MISMATCH
PRICING_POLICY_MISSING
PRICING_POLICY_INVALID
SELLING_PRICE_DERIVATION_FAILED
```

Where useful, include the underlying 4.1B `PricingError.code`.

4.2C retains its own detailed nested cost issues; 4.3A only summarizes why price derivation is blocked.

## Archived Product semantics

4.2C already keeps archived root Products inspectable.

4.3A preserves:

`productIsActive`

and may derive historical/planning selling price for an archived root Product when cost and pricing policy are otherwise valid.

4.3A must not mutate active state.

## Scope boundaries

4.3A must not implement:

- profit per unit;
- effective markup;
- effective margin;
- consolidated Product pricing quote/readiness service;
- batch production cost;
- expected batch revenue/profit;
- batch margin;
- capacity feasibility/warnings;
- React pricing UI;
- source-profile editing;
- stock reservation/deduction;
- production posting;
- Excel/Tauri persistence;
- tax/VAT/discount/marketplace-fee logic;
- charm-price or currency-rounding policy.

Those remain in 4.3B+, 4.4+, 4.5+, or later work.

## Shared session wiring

Update:

`src/application/session.ts`

Add shared:

```text
sellingPriceDerivationService
```

constructed from existing shared:

```text
fullyLoadedProductUnitCostService
productFinancialProfileService
```

No React changes belong to 4.3A.

## Focused test matrix

Cover at least:

1. fixed-profit selling-price derivation from ready 4.2C cost;
2. markup-rate selling-price derivation;
3. target-margin selling-price derivation;
4. full precision retained for repeating margin result;
5. zero fixed-profit policy;
6. zero markup policy;
7. zero margin policy;
8. zero ready unit cost where formula remains valid;
9. pricing policy null with ready cost -> partial/null price;
10. missing financial profile -> fail closed;
11. financial-profile Product mismatch -> fail closed;
12. invalid negative profit/markup policy -> fail closed;
13. invalid margin >= 1 -> fail closed;
14. non-finite policy value -> fail closed;
15. 4.2C partial cost -> no selling price, known subtotal preserved;
16. 4.2C not-ready cost -> no selling price;
17. 4.2C ready result with invalid/null total -> fail closed;
18. requested Product/cost Product mismatch -> fail closed before policy use;
19. 4.2C authoritative total is used rather than known partial subtotal;
20. changing pricing policy changes price without changing cost evidence;
21. archived Product remains inspectable/priceable;
22. source pricing policy is defensively cloned;
23. shared session wiring;
24. full repository typecheck/tests/build.

## Planned files

Expected additions:

```text
src/application/pricing/SellingPriceDerivationService.ts
src/application/pricing/SellingPriceDerivationService.test.ts
src/application/pricing/SellingPriceDerivationSession.test.ts
docs/PHASE_4_3A_SELLING_PRICE_DERIVATION.md
```

Expected updates:

```text
src/application/session.ts
docs/PHASE_4_3A_SELLING_PRICE_DERIVATION_PLAN.md
```

Closeout later updates:

```text
docs/PHASE_4_PROGRESS.md
```

No other file is expected unless implementation evidence proves a tightly related 4.3A correction is necessary.

## Lifecycle

1. verify exact authoritative `develop`;
2. establish this dedicated plan before implementation;
3. implement selling-price derivation service;
4. add focused tests and shared session wiring;
5. run full typecheck/tests/build;
6. create implementation record;
7. require clean CI on exact documented feature head;
8. compare exact scope against starting `develop`;
9. open implementation PR to `develop`;
10. require independent PR CI;
11. merge with expected-head protection;
12. require exact post-merge `develop` CI;
13. create documentation-only closeout;
14. mark `4.3A COMPLETE`;
15. advance `4.3B — Profit / Markup / Margin Metrics` to `NEXT / NOT STARTED`;
16. require closeout PR CI and exact final `develop` CI.

## Completion gate

4.3A is complete only when implementation and closeout gates pass and the tracker advances to:

```text
4.3 — Selling Price & Unit Economics                 IN PROGRESS
    4.3A — Selling Price Derivation                       COMPLETE
    4.3B — Profit / Markup / Margin Metrics               NEXT
    4.3C — Product Pricing Quote & Readiness Service      NOT STARTED
```

## Next task after completion

**4.3B — Profit / Markup / Margin Metrics — NEXT / NOT STARTED**

Do not begin 4.3B until 4.3A implementation and documentation closeout are merged and the exact final `develop` CI is green.
