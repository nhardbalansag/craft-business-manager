# Tiered Pricing TP8 — Quantity-Aware Selection Semantics Decision

## Status

```text
TP8A — Selection Semantics Decision
COMPLETE — DECISION / PLANNING ONLY
NO RESOLVER OR PRODUCTION BEHAVIOR IMPLEMENTED
```

Repository baseline used for this decision:

```text
Repository: nhardbalansag/craft-business-manager
Integration branch: develop
Baseline SHA: 29ff8226a93680d1d15f8aa5f011a06087704518
Previous phase: TP7 — Pricing Quote Integration — COMPLETE
```

This document is the required gate before quantity-aware tier resolution can be implemented.

---

## 1. Purpose

TP8 must answer one question safely:

> Given a Product, an order quantity, and optionally an explicitly chosen saved tier, which pricing source is valid for that quantity?

TP8 does **not** answer:

> Which price should the business automatically choose?

That distinction is intentional.

The current system already has:

- authoritative Default / Single pricing from `ProductPricingQuoteService`;
- saved Package / Bulk / Custom tier sources;
- tier economics and below-cost diagnostics;
- the TP7 integrated quote exposing Default / Single plus tier alternatives.

The missing capability is quantity-aware **eligibility and explicit resolution**.

---

## 2. Decision Summary

The authoritative TP8 policy is:

1. **Default / Single remains the fallback and default selection.**
2. **No tier is automatically selected merely because quantity makes it eligible.**
3. **A tier affects resolved pricing only when its stable tier ID is explicitly selected.**
4. **Only active tiers are selectable.**
5. **Minimum order quantity is measured in finished Product units.**
6. **Per-unit tiers are quantity-eligible when quantity is at least the minimum.**
7. **Per-offer tiers additionally require exact divisibility by `unitsPerOffer`.**
8. **Mixed package + Default / Single remainder pricing is not supported in TP8.**
9. **Overlapping eligible tiers remain separate alternatives; TP8 does not rank or choose among them.**
10. **“Cheapest eligible tier wins” is explicitly prohibited.**
11. **Custom tiers are always explicit/manual choices.**
12. **Customer/channel targeting is not inferred because the current source model has no customer/channel identity fields.**
13. **Below-cost tiers may remain technically eligible, but their existing below-cost warning must remain visible in resolved evidence.**
14. **Production financial projections remain on Default / Single unless a future, separately scoped integration explicitly supplies a selected tier. TP8 itself does not silently rewire Production.**

---

## 3. Existing Source Contract Constraints

The current `ProductPriceTier` source contract already establishes:

- `kind = package | bulk | custom`;
- `priceBasis = per-unit | per-offer`;
- `unitsPerOffer`;
- `minimumOrderQuantity`;
- stable tier ID;
- active/archive state;
- per-offer minimum quantity must be at least one offer;
- per-offer minimum quantity must already be a whole multiple of offer size;
- per-unit tiers use exactly one Product unit per offer.

TP8 must consume these rules rather than inventing alternate quantity semantics.

---

## 4. Resolution Request Contract

The planned resolver request is conceptually:

```ts
interface ProductPriceResolutionRequest {
  productId: string;
  quantity: number;
  selectedTierId?: string;
}
```

### Quantity rules

For TP8 resolution:

- quantity represents finished Product units;
- quantity must be finite;
- quantity must be an integer;
- quantity must be greater than zero.

Zero-quantity batch-planning semantics elsewhere in the application do not redefine order-pricing quantity semantics.

### Selection rules

If `selectedTierId` is omitted:

```text
resolved source = Default / Single
```

If `selectedTierId` is provided:

```text
resolve only that exact stable tier ID
```

There is no implicit tier lookup such as:

- cheapest;
- highest discount;
- highest margin;
- highest minimum threshold;
- most specific kind;
- most recently created.

---

## 5. Quantity Eligibility Rules

### 5.1 Default / Single

Default / Single has no tier minimum-order gate.

For any valid positive whole-unit quantity:

```text
Default / Single is structurally eligible.
```

Its actual resolved readiness still depends on the existing Default / Single quote being usable.

### 5.2 Active-state rule

A saved tier is selectable only when:

```text
tier.isActive === true
```

Archived tiers remain visible for historical/source review but are not selectable for a new resolved price.

### 5.3 Minimum order rule

For every active tier:

```text
quantity >= tier.minimumOrderQuantity
```

is required.

A quantity below the threshold makes the tier ineligible.

### 5.4 Per-unit tier rule

For:

```text
priceBasis = per-unit
```

eligibility requires only:

```text
quantity >= minimumOrderQuantity
```

Because the domain contract already forces:

```text
unitsPerOffer = 1
```

every whole Product quantity above the threshold can be priced.

### 5.5 Per-offer tier rule

For:

```text
priceBasis = per-offer
```

eligibility requires both:

```text
quantity >= minimumOrderQuantity
quantity % unitsPerOffer === 0
```

The quantity must consist entirely of complete offers.

Example:

```text
Package:
unitsPerOffer = 6
minimumOrderQuantity = 6

quantity 6  -> eligible
quantity 12 -> eligible
quantity 18 -> eligible
quantity 7  -> ineligible
quantity 13 -> ineligible
```

### 5.6 Kind does not override structural pricing basis

`kind` describes business intent.

Quantity arithmetic is driven by:

- `priceBasis`;
- `unitsPerOffer`;
- `minimumOrderQuantity`.

Therefore a valid but unusual Bulk + per-offer tier follows the same per-offer divisibility rule.

The existing TP6 warnings remain appropriate, but TP8 does not reinterpret valid saved source data.

---

## 6. Package Divisibility Decision

For TP8:

> Package/per-offer pricing requires exact offer divisibility.

A request for seven units against a six-unit Package is **not** automatically decomposed into:

```text
1 package of 6
+
1 Default / Single unit
```

That would create a mixed-pricing algorithm not represented by the current tier source model.

Such a future feature would need its own explicit order-composition contract.

---

## 7. Mixed Package + Single Remainder Decision

TP8 does not support mixed remainder pricing.

The following are out of scope:

- package + Default remainder;
- package + another tier remainder;
- multiple different package tiers within one request;
- optimization across package combinations.

For a per-offer tier, non-divisible quantity is simply ineligible.

This keeps resolved evidence deterministic and auditable.

---

## 8. Overlapping Eligible Tiers Decision

Multiple tiers may legitimately be eligible for the same quantity.

Example:

```text
Bulk 10+  -> PHP 45/unit
Bulk 20+  -> PHP 40/unit
Custom    -> PHP 42/unit
quantity 25
```

TP8 will expose all eligible alternatives.

It will not choose one automatically.

If the caller wants a tier applied, the caller must explicitly provide its stable tier ID.

---

## 9. Cheapest-Tier Decision

Automatic cheapest-tier selection is prohibited in TP8.

Reasons:

- cheapest selling price is not necessarily the intended commercial offer;
- Custom tiers may be customer/event/channel-specific in business meaning even though the current schema cannot encode that target;
- below-cost tiers can exist intentionally or accidentally;
- overlapping tiers may represent distinct sales agreements;
- automatically changing price based only on quantity could silently reduce revenue.

TP8 may expose comparison values already derived elsewhere, but comparison does not imply automatic selection.

---

## 10. Custom Tier Decision

Custom tiers are always manual/explicit.

Quantity eligibility still applies:

- quantity must meet the minimum;
- if per-offer, quantity must be exactly divisible by offer size.

However, TP8 will never infer that a Custom tier applies from quantity alone.

---

## 11. Customer / Channel Targeting Decision

The current `ProductPriceTier` source contract contains no authoritative fields for:

- customer ID;
- customer group;
- sales channel;
- event;
- campaign;
- contract;
- geographic market.

Therefore TP8 must not infer targeting from:

- tier name;
- notes;
- `kind = custom`;
- price.

If customer/channel-aware pricing is later required, it needs a separate source-domain extension and persistence migration.

---

## 12. Economics / Readiness Decision

Quantity eligibility and economic readiness are separate concepts.

A tier can be structurally quantity-eligible but still lack usable economics because upstream cost evidence is unavailable.

TP8 should distinguish:

```text
structurally eligible
economically resolvable
selected
```

A tier can be selected only when:

- Product identity matches;
- tier is active;
- quantity is structurally eligible;
- required tier economics are available.

Default-comparison readiness is not required merely to use a tier's own selling price.

For example, if tier economics are available but Default / Single comparison is partial, the tier may still be resolvable; only the discount comparison remains unavailable.

---

## 13. Below-Cost Decision

Existing TP3C behavior deliberately treats below-cost pricing as valid source evidence with a warning.

TP8 preserves that rule.

A below-cost tier:

- is not automatically rejected solely because it is below cost;
- remains manually selectable if all structural/readiness rules pass;
- must carry the existing `BELOW_COST` warning into resolved evidence.

The resolver must never silently hide that warning.

---

## 14. Planned Resolution Result

The implementation should expose enough evidence to explain exactly why a price was resolved.

Conceptually:

```ts
interface ProductPriceResolutionResult {
  productId: string;
  quantity: number;

  mode: 'default' | 'explicit-tier';
  selectedTierId: string | null;

  status: 'ready' | 'not-ready';

  offerCount: number | null;
  unitSellingPrice: number | null;
  totalSellingPrice: number | null;

  defaultQuote: ProductPricingQuoteResult;
  selectedTier: ProductPriceTierQuoteLine | null;

  eligibleTierIds: string[];
  ineligibleTiers: QuantityEligibilityDiagnostic[];

  warnings: ...;
  issues: ...;
}
```

Exact TypeScript names belong to implementation, but these semantics are fixed by this decision.

### Price-total formulas

Default / Single:

```text
unitSellingPrice  = Default / Single selling price
totalSellingPrice = unitSellingPrice × quantity
offerCount        = quantity
```

Explicit per-unit tier:

```text
unitSellingPrice  = tier effective unit selling price
totalSellingPrice = unitSellingPrice × quantity
offerCount        = quantity
```

Explicit per-offer tier:

```text
offerCount        = quantity / unitsPerOffer
totalSellingPrice = offerSellingPrice × offerCount
unitSellingPrice  = totalSellingPrice / quantity
```

`additionalCostPerOffer` remains a cost input for profitability and is not added again to customer selling price.

---

## 15. Failure / Diagnostic Semantics

The resolver must fail closed for contradictory evidence.

Expected diagnostic categories include:

- invalid quantity;
- selected tier not found;
- selected tier belongs to another Product;
- selected tier archived;
- quantity below minimum;
- quantity not divisible by offer size;
- tier economics unavailable;
- Default / Single quote unavailable when Default is requested;
- integrated quote Product mismatch.

An ineligible selected tier must not silently fall back to another tier.

The caller may explicitly choose Default / Single after receiving the ineligibility result.

---

## 16. Production Boundary Decision

TP8 does not automatically modify `ExpectedBatchFinancialsService`.

The authoritative rule remains:

```text
No explicit selected tier
    -> Production uses Default / Single
```

A future Production integration, if desired, must be a separately scoped change that accepts explicit resolved pricing evidence.

No Production service may inspect quantity and silently pick an eligible tier.

---

## 17. TP8 Implementation Split

TP8 is now split as follows.

### TP8A — Selection Semantics Decision — COMPLETE

Deliverables:

- this decision document;
- manual-vs-automatic rule;
- quantity contract;
- package divisibility rule;
- overlap rule;
- cheapest-tier prohibition;
- Custom-tier rule;
- channel/customer non-inference rule;
- mixed-remainder rule;
- Production safety boundary.

No production code.

### TP8B — Quantity Eligibility Domain Contract — COMPLETE

Implemented as the pure domain boundary:

`src/domain/productPriceTierQuantityEligibility.ts`

The contract:

- validates quantity as finite, integer, and greater than zero;
- reuses `validateProductPriceTierContract` for source integrity;
- rejects archived tiers for new resolution;
- enforces minimum-order quantity;
- treats per-unit tiers as whole-unit offers with no extra divisibility rule;
- requires exact per-offer divisibility;
- returns exact `offerCount` only for eligible quantities;
- emits deterministic typed diagnostics for ineligible quantities;
- does not inspect price, economics, discount, margin, or tier ranking;
- does not select a tier.

Regression coverage lives in:

`src/domain/productPriceTierQuantityEligibility.test.ts`

### TP8C — Explicit Tier Resolution Service — COMPLETE

Implemented as:

`src/application/pricing/ProductPriceResolutionService.ts`

The service:

- consumes one TP7 integrated pricing quote;
- reuses TP8B quantity validation and structural tier eligibility;
- resolves Default / Single when no tier ID is supplied;
- resolves exactly the explicitly supplied stable tier ID otherwise;
- never auto-ranks or auto-selects eligible tiers;
- fails explicit selection closed for blank/missing/mismatched/ineligible/unresolvable tiers;
- permits tier economics when the tier line is partial solely because Default comparison is unavailable;
- computes per-unit and per-offer order totals according to this decision;
- preserves selected-tier warnings, including BELOW_COST;
- exposes structurally eligible tier IDs in source order as alternatives only;
- returns defensive integrated/resolved evidence;
- is wired into the shared application session;
- does not modify ExpectedBatchFinancials or Production behavior.

TP8C also exposes the shared TP8B quantity validator from
`productPriceTierQuantityEligibility.ts` so Default / Single and explicit-tier
resolution use the exact same positive whole-unit quantity rule.

Regression coverage lives in:

`src/application/pricing/ProductPriceResolutionService.test.ts`

### TP8D — Pricing Workspace Quantity Preview / Manual Selection — NEXT / NOT STARTED

Expose the resolver in the Pricing workspace.

Scope:

- quantity input;
- Default / Single as default selected source;
- eligible/ineligible alternative visibility;
- explicit tier selection;
- exact-divisibility messaging;
- resolved total price preview;
- below-cost warning retention.

No Production mutation.

### TP8E — Regression & Completion Gate — NOT STARTED

Must prove:

- omitted tier selection preserves Default / Single;
- quantity below minimum cannot select the tier;
- per-unit threshold eligibility;
- exact package divisibility;
- non-divisible package rejection;
- no mixed remainder pricing;
- overlapping tiers remain alternatives;
- cheapest tier is not automatically chosen;
- Custom tier never auto-selects;
- archived tier cannot be selected;
- below-cost warning survives explicit selection;
- Product identity contradictions fail closed;
- Production remains unchanged;
- full typecheck/tests/build green.

---

## 18. TP8A Completion Gate

TP8A is complete when:

- every selection-semantics question from TP0 has an explicit answer;
- resolver inputs and conceptual outputs are defined;
- automatic cheapest selection is prohibited;
- package divisibility and remainders are unambiguous;
- overlapping tiers are non-ranking alternatives;
- Custom targeting is not inferred;
- Production safety boundary remains explicit;
- TP8 is split into implementation-sized subphases.

All conditions are satisfied by this document.

---

## 19. Exact Next Task

```text
TP8D — Pricing Workspace Quantity Preview / Manual Selection
NEXT / NOT STARTED
```

TP8C is complete. Do not start TP8E, TP9, or Phase 6 automatically.
