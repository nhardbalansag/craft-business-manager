# TP0 — Tiered Pricing Domain & Compatibility Audit

Status: **PLANNING / AUDIT COMPLETE — NO PRODUCTION IMPLEMENTATION**

Repository: `nhardbalansag/craft-business-manager`

Authoritative audit baseline:

`e2057a063544f56088177e8211e03b96c21ef7e1`

This document defines the compatibility contract and implementation boundaries for adding Single / Package / Bulk / Custom pricing without changing existing Product pricing or existing workbook records.

---

## 1. Goal

Add multiple sell-price offers for one Product while preserving the existing authoritative unit-cost and default pricing pipeline.

Examples:

- Default / Single: PHP 50 per piece
- 6-piece Package: PHP 270 per package
- Bulk 20+: PHP 40 per piece
- Custom Party Pack: PHP 500 for 12 pieces

The enhancement must support independent profit, markup, margin, and below-cost diagnostics for every tier.

---

## 2. Current Architecture Findings

### 2.1 Existing financial source is one-to-one

`ProductFinancialProfile` is currently one record per Product and contains:

- `productId`
- `laborCostPerUnit`
- `overheadCostPerUnit`
- one optional `pricingPolicy`
- `notes`

The in-memory repository is keyed by Product ID. Therefore the existing model is deliberately one financial profile / one default pricing policy per Product.

### 2.2 Existing price pipeline assumes one authoritative selling price

Current flow:

```text
FullyLoadedProductUnitCostService
  -> SellingPriceDerivationService
  -> ProfitMarkupMarginMetricsService
  -> ProductPricingQuoteService
  -> ExpectedBatchFinancialsService
```

`ExpectedBatchFinancialsService` currently derives revenue as:

```text
default selling price × planned quantity
```

That assumption must remain unchanged until quantity-aware tier selection is introduced explicitly.

### 2.3 Existing pricing policy remains valuable

The current policy supports:

- fixed profit amount
- markup percentage
- target margin percentage

It derives the current default selling price from authoritative fully loaded unit cost.

This must NOT be replaced by tier pricing.

### 2.4 Persistence currently has no one-to-many price source

Current persisted source includes `ProductFinancialProfiles`, one row per Product.

There is no `ProductPriceTiers` collection or workbook sheet.

### 2.5 Persistence version state is already split

Current core source:

- BusinessDataset schema: v1
- Core workbook: workbook v2 / dataset v1

Current physical source:

- PhysicalBusinessDataset schema: v2
- Physical workbook: workbook v2 / dataset v2

The physical v2/dataset-v2 shape already existed before Preferred Yield. Compatibility normalization from PR #250 must continue to work.

This version overlap means tier pricing must use an explicit next-version migration. It must not silently reuse the current v2 shapes.

---

## 3. Locked Compatibility Rules

These are non-negotiable implementation rules.

### C1 — Existing default pricing is untouched

`ProductFinancialProfile.pricingPolicy` remains the authoritative **Default / Single** pricing source.

No existing profile is rewritten into a tier.

### C2 — No automatic conversion of old prices

When an existing workbook is upgraded:

```text
existing ProductFinancialProfiles -> unchanged
new ProductPriceTiers            -> []
```

Therefore every existing Product calculates exactly as it did before the enhancement.

### C3 — Tier pricing is additive

A Product may have zero or more price tiers.

Zero tiers means the application behaves exactly as it behaves today.

### C4 — Existing price pipeline stays backward compatible

The current fields remain:

- `sellingPrice`
- `profitPerUnit`
- `effectiveMarkup`
- `effectiveMargin`

They continue to represent the existing Default / Single quote.

New tier quote data must be additive rather than replacing these fields.

### C5 — No automatic order-tier selection in the domain foundation

Package, bulk, and custom tiers can overlap intentionally.

TP1–TP7 must not guess which tier should apply to an arbitrary order quantity.

Automatic quantity matching belongs to TP8 and must use a separately tested deterministic resolver.

### C6 — Old XLSX and Google Sheets data must migrate in memory

Migration must never require the user to manually edit an existing Excel or published Google Sheet before import.

Existing IDs, Products, Yield samples, Preferred Yield, recipes, components, stocks, financial profiles, Molds, StorageLocations, notes, and relationships must remain unchanged.

---

## 4. Proposed Authoritative Domain

New source entity:

```ts
ProductPriceTier {
  id: string
  productId: string
  name: string
  kind: 'package' | 'bulk' | 'custom'
  priceBasis: 'per-unit' | 'per-offer'
  priceAmount: number
  unitsPerOffer: number
  minimumOrderQuantity: number
  additionalCostPerOffer: number
  notes?: string
  isActive: boolean
}
```

### 4.1 Why there is no persisted `single` tier

Default / Single remains the existing `ProductFinancialProfile.pricingPolicy`.

This avoids two competing authoritative Single prices.

The Pricing UI may visually present:

```text
Default / Single
Package
Bulk
Custom
```

but only Package / Bulk / Custom are new tier records.

### 4.2 Tier ID format

Normal UI creation should use the existing stable sequential-ID helper:

```text
TIER-0001
TIER-0002
TIER-0003
...
```

Existing/imported explicit IDs remain accepted by repository/import boundaries for migration compatibility.

### 4.3 Field semantics

#### `priceBasis`

`per-unit`
- `priceAmount` is the selling price for one Product unit.
- Typical use: Bulk 20+ at PHP 40 / piece.

`per-offer`
- `priceAmount` is the price for one complete offer.
- `unitsPerOffer` defines how many Product units are inside the offer.
- Typical use: 6-piece Package at PHP 270.

#### `unitsPerOffer`

Positive integer.

Examples:

- Bulk per-unit: 1
- 6-piece Package: 6
- 12-piece Party Pack: 12

#### `minimumOrderQuantity`

Positive integer representing the minimum finished-Product quantity required before the tier can be offered.

Examples:

- 6-piece Package: 6
- Bulk 20+: 20
- Distributor 100+: 100

For a per-offer tier, the minimum quantity must be compatible with `unitsPerOffer`.

#### `additionalCostPerOffer`

Non-negative PHP amount for costs that occur once per offer/package rather than once per Product unit.

Examples:

- box
- ribbon
- package label
- gift bag
- event packaging labor

It defaults to zero.

This value is intentionally a financial source amount in the initial tier model. Materialized package recipes can be a later enhancement.

---

## 5. Domain Validation Contract

TP1 must enforce:

- ID required.
- Product ID required.
- Name required.
- Supported kind only.
- Supported price basis only.
- `priceAmount` finite and non-negative.
- `unitsPerOffer` positive integer.
- `minimumOrderQuantity` positive integer.
- `additionalCostPerOffer` finite and non-negative.
- Product reference must exist.
- Tier IDs globally unique.
- Archived Products may retain historical tier records.
- Normal creation for an archived Product is disallowed at application-service level.
- A per-offer tier must represent a coherent package quantity.

### Deliberate non-rule: price may be below cost

The source contract must not reject a tier merely because its selling price is below current cost.

Costs can change after the price was configured, and intentional promotions may exist.

Instead, the economics/quote layer must produce an explicit below-cost warning.

### Deliberate non-rule: overlapping tiers are allowed

Examples:

- Bulk 20+ PHP 40
- Event Partner 20+ PHP 38
- Distributor 50+ PHP 35

These can coexist.

TP8 must not silently resolve overlaps without an explicit deterministic selection policy.

---

## 6. Tier Economics Contract

The tier economics engine must consume the same authoritative fully loaded unit cost used by existing pricing.

For one tier:

```text
baseOfferCost
  = fullyLoadedUnitCost × unitsPerOffer

totalOfferCost
  = baseOfferCost + additionalCostPerOffer

offerSellingPrice
  = priceBasis == per-offer
      ? priceAmount
      : priceAmount × unitsPerOffer

effectiveUnitSellingPrice
  = offerSellingPrice / unitsPerOffer

profitPerOffer
  = offerSellingPrice - totalOfferCost

effectiveProfitPerUnit
  = profitPerOffer / unitsPerOffer

effectiveMarkup
  = profitPerOffer / totalOfferCost
    when totalOfferCost != 0

effectiveMargin
  = profitPerOffer / offerSellingPrice
    when offerSellingPrice != 0
```

No domain-level monetary rounding.

### Default-price comparison

When the existing Default / Single selling price is ready:

```text
defaultEquivalentOfferPrice
  = defaultSellingPrice × unitsPerOffer

discountAmountVsDefault
  = defaultEquivalentOfferPrice - offerSellingPrice

discountRateVsDefault
  = discountAmountVsDefault / defaultEquivalentOfferPrice
    when defaultEquivalentOfferPrice != 0
```

A negative discount means the tier is more expensive than the Default / Single equivalent.

### Required diagnostics

Each tier quote must expose at least:

- ready / partial / not-ready status
- base authoritative fully loaded unit cost
- offer quantity
- base offer cost
- additional offer cost
- total offer cost
- offer selling price
- effective unit selling price
- profit per offer
- effective profit per unit
- markup
- margin
- discount vs Default / Single
- below-cost warning
- inactive-tier state

---

## 7. Application Architecture

New layers should mirror existing source-service patterns.

### Repository

`ProductPriceTierRepository`

Expected operations:

- `list()`
- `findById(id)`
- `replaceAll(records)`
- create/update/upsert behavior through service boundary

### Service

`ProductPriceTierService`

Responsibilities:

- normalize source data
- validate domain contract
- verify Product relationship
- prevent normal creation against missing/archived Product
- keep historical archived tier records loadable
- list/filter by Product
- archive/restore tier
- automatic normal-UI ID allocation using `TIER-`

### Tier quote service

Recommended independent service:

`ProductPriceTierQuoteService`

It should depend on:

- `FullyLoadedProductUnitCostService`
- existing Default / Single pricing quote/economics provider
- `ProductPriceTierRepository` or service

It must not change the semantics of `ProductPricingQuoteService`.

---

## 8. Downstream Impact Audit

### 8.1 SellingPriceDerivationService

Current meaning remains Default / Single.

No tier logic should be inserted into this service.

### 8.2 ProfitMarkupMarginMetricsService

Current result remains Default / Single metrics.

Tier metrics are separate additive results.

### 8.3 ProductPricingQuoteService

Keep existing quote contract valid.

Later extension may add:

```ts
tierQuotes?: ProductPriceTierQuoteResult[]
```

or expose tiers through a dedicated service/UI call.

Do not change existing `sellingPrice` meaning.

### 8.4 ExpectedBatchFinancialsService

Current behavior:

```text
expectedRevenue = defaultSellingPrice × plannedQuantity
```

This remains unchanged through TP7.

Quantity-aware tier revenue belongs to TP8.

This prevents existing Production calculations from changing simply because tier records were added.

### 8.5 Production and capacity

Capacity calculations are quantity/material/component based and do not need tier-pricing changes.

Only financial projection paths that consume selling price require later tier integration.

---

## 9. Persistence Impact

A new authoritative collection means persistence boundaries must include:

- `BusinessDataset.productPriceTiers`
- dataset completeness
- clone/normalize
- source snapshot
- atomic hydration
- session repository wiring
- dataset validation
- duplicate ID validation
- Product reference validation
- workbook export
- workbook import/reconstruction
- source-collection-to-sheet diagnostics
- physical dataset conversion
- recovery/rollback tests

New canonical workbook sheet:

```text
ProductPriceTiers
```

Proposed columns:

```text
id
productId
name
kind
priceBasis
priceAmount
unitsPerOffer
minimumOrderQuantity
additionalCostPerOffer
notes
isActive
```

---

## 10. Version / Migration Strategy

### Current versions

```text
Legacy core                     v1 / dataset 1
Current core after Preferred    v2 / dataset 1
Current physical                v2 / dataset 2
```

### Proposed tier-pricing versions

Because `productPriceTiers` is a new authoritative source collection:

```text
New core                         workbook v3 / dataset 2
New physical                     workbook v3 / dataset 3
```

The exact constants must be implemented only in TP5 after regression fixtures are prepared.

### Required migration paths

#### Core v2 / dataset 1 -> Core v3 / dataset 2

- retain every current sheet and row
- add empty `ProductPriceTiers`
- update authoritative metadata
- no existing price conversion

#### Core v1 / dataset 1 -> Core v3 / dataset 2

- first apply the existing v1 -> v2 Preferred-Yield migration
- then apply v2/1 -> v3/2 tier migration

#### Physical v2 / dataset 2 -> Physical v3 / dataset 3

- preserve all core records
- preserve StorageLocations
- preserve Molds
- add empty `ProductPriceTiers`
- retain PR #250 legacy Products normalization for pre-Preferred-Yield physical workbooks

### Google Sheets

Published Google Sheets import downloads XLSX and delegates to the same PersistenceCoordinator/import boundary.

Therefore no separate business migration algorithm should exist for Google Sheets.

Required Google Sheets regression:

- publish/export-compatible old physical v2/dataset-v2 snapshot
- no `ProductPriceTiers` sheet
- no Preferred Yield column if testing the oldest recognized v2 shape
- import succeeds
- all existing source records remain identical
- tier collection becomes empty
- Default / Single pricing remains unchanged

---

## 11. UI Plan

Pricing workspace should remain recognizable.

### Default / Single section

Existing financial-profile controls remain authoritative:

- labor
- overhead
- pricing policy
- existing unit economics

Label existing price clearly as:

```text
Default / Single price
```

### Price Tiers section

Add a separate section after the default quote:

- Package
- Bulk
- Custom

Each tier card should show:

- tier name/type
- minimum quantity
- units per offer
- offer or unit price
- equivalent unit price
- additional package cost
- profit
- markup
- margin
- discount vs Default / Single
- below-cost warning
- active/archived state

Do not hide the Default / Single quote when tiers exist.

---

## 12. Follow-on Development Plan

### TP0 — Tiered Pricing Domain & Compatibility Audit

**COMPLETE by this document**

Deliverables:

- existing architecture audit
- compatibility contract
- proposed domain contract
- pricing/economics formulas
- persistence/version strategy
- downstream impact map
- regression matrix
- implementation sequence

No production behavior changes.

### TP1 — Product Price Tier Domain Foundation

Recommended split:

#### TP1A — Domain Contract & Validation — COMPLETE
- `ProductPriceTier`
- Package / Bulk / Custom enums
- per-unit / per-offer basis enums
- normalization/clone
- typed validation/error codes
- package quantity coherence
- zero/negative/non-finite source-value coverage
- unit tests

#### TP1B — Stable Tier ID Foundation — COMPLETE
- reuses `nextSequentialId` through `nextProductPriceTierId`
- `TIER-0001` normal creation convention
- legacy/custom explicit IDs remain accepted at lower boundaries
- mixed old/custom/new ID regressions added

Stop after TP1. Do not start TP2 automatically.

### TP2 — Repository & Application Services

Recommended split:

#### TP2A — Repository contract + in-memory implementation — COMPLETE
- `ProductPriceTierRepository` contract
- defensive-cloning, case-insensitive in-memory implementation
- repository regressions for normal and legacy/custom IDs

#### TP2B — ProductPriceTierService CRUD/archive/list/reference rules — COMPLETE
- normal creation allocates global `TIER-####` IDs
- Product existence and archived-Product creation rules
- historical archived-Product tier records remain loadable/correctable
- update, get, list/filter/search, archive, and guarded restore
- relationship moves require an existing active Product
- typed application errors and service regressions

#### TP2C — Session wiring + service regressions — COMPLETE
- shared `productPriceTierRepository` session instance
- shared `productPriceTierService` wired to the authoritative Product repository
- shared-session create/read/archive/restore regression
- no persistence/dataset wiring introduced

### TP3 — Tier Economics Engine

Recommended split:

#### TP3A — Pure tier economics formulas — COMPLETE
- authoritative fully loaded unit cost × offer quantity
- additional offer-cost handling
- per-unit and per-offer selling-price normalization
- profit per offer and effective profit per unit
- effective markup / margin with zero-denominator null semantics
- full precision with no domain monetary rounding
- below-cost values remain valid economics inputs

#### TP3B — ProductPriceTierQuoteService — COMPLETE
- orchestrates authoritative fully loaded unit cost with Product price tiers
- ready/partial/not-ready quote states
- computes TP3A economics only from ready authoritative cost
- preserves archived tiers as historical/inactive quote records
- fail-closed Product/tier identity consistency checks
- shared application-session wiring
- no Default / Single comparison or below-cost warning yet

#### TP3C — Default-price comparison + below-cost diagnostics — COMPLETE
- consumes existing Default / Single quote as additive comparison evidence
- default-equivalent offer price
- discount amount and discount rate vs Default / Single
- negative discount preserved when a tier is more expensive than Default
- null discount rate when the Default equivalent denominator is zero
- explicit below-cost flag and `BELOW_COST` warning
- ready tier economics remain available when Default comparison is partial/not-ready
- mismatched or invalid ready Default evidence fails closed
- existing `ProductPricingQuoteService` semantics remain unchanged

### TP4 — Default Pricing Compatibility Layer — COMPLETE

- existing Default / Single semantics explicitly preserved
- no-tier Product pricing quote remains unchanged
- adding Package / Bulk tiers does not alter existing ProductPricingQuote fields
- cheaper tier existence does not change ExpectedBatchFinancials revenue
- ExpectedBatchFinancials continues using Default / Single selling price through TP7
- no production pricing-service behavior was modified; compatibility is enforced by regressions

### TP5 — Workbook / Dataset Persistence & Migration

This is a high-risk phase and should be split further before implementation.

Minimum subphases:

#### TP5A — BusinessDataset v2 source collection — COMPLETE
- explicit schema v2 domain contract
- tenth authoritative source collection: `productPriceTiers`
- canonical empty v2 dataset
- completeness, defensive clone, and normalization boundary
- tier row/domain validation
- globally unique trim-aware tier IDs
- Product reference validation while preserving archived-Product history
- existing v1 BusinessDataset validation guarantees reused unchanged
- v1 workbook/physical formats deliberately remain untouched until TP5B–TP5D

#### TP5B — Core workbook v3 sheet/export/import — COMPLETE
- explicit core workbook format v3 / dataset schema v2 contract
- canonical `ProductPriceTiers` sheet with 11 source columns
- deterministic tier row ordering
- full-precision numeric export
- real XLSX v3 round-trip
- schema rejection for missing sheet, invalid column order, invalid enum tokens, and formula cells
- reconstructed tier dataset passes BusinessDataset v2 integrity validation
- binary and neutral workbook resource-limit guards
- existing v2/v1 workbook path remains intact until TP5C promotes v3 through migration compatibility

#### TP5C — Core v1/v2 migration chain — COMPLETE
- explicit v1/dataset-1 -> v2/dataset-1 -> v3/dataset-2 chain
- reuses the existing Preferred Yield v1 -> v2 migration
- v2 -> v3 updates only authoritative metadata and appends empty `ProductPriceTiers`
- existing sheets and source rows are retained
- existing `ProductFinancialProfiles` remain unchanged; no old price is converted into tiers
- real XLSX regression coverage for both v1 and v2 inputs
- already-current v3 workbooks remain unmigrated and preserve tier rows
- reserved `ProductPriceTiers` collision in a legacy workbook fails closed
- v3 importer is compatibility-aware while the existing legacy application importer remains callable until TP5G

#### TP5D — Physical workbook v3/dataset-v3 migration — COMPLETE
- explicit `PhysicalBusinessDatasetV3` contract
- physical workbook v3 / dataset-v3 target
- canonical core v3 sheets plus StorageLocations and Molds
- ProductPriceTiers persists alongside physical identification sources
- explicit physical v2/dataset-2 -> v3/dataset-3 migration edge
- current physical v2 core records are preserved
- StorageLocations and Molds are preserved
- legacy physical v2 receives an empty ProductPriceTiers collection
- ProductFinancialProfiles remain unchanged; no tier inference from old prices
- current physical v3 round-trips through real XLSX bytes
- reserved ProductPriceTiers collision fails closed
- pre-Preferred physical-v2 regression remains intentionally deferred to TP5E

#### TP5E — Legacy pre-Preferred physical-v2 regression — COMPLETE
- retains PR #250 recognition of the exact seven-column legacy Products shape
- inserts preferredYieldSampleId immediately after mixPresetId in memory
- migrated Preferred Yield values remain undefined; no historical evidence is invented
- real XLSX pre-Preferred physical-v2 -> physical-v3 regression
- Product records and notes remain unchanged
- ProductFinancialProfiles / Default / Single pricing remain unchanged
- StorageLocations and Molds remain unchanged
- ProductPriceTiers becomes an empty authoritative collection
- unknown/incomplete legacy Products column shapes remain fail-closed
- reserved ProductPriceTiers collisions remain fail-closed

#### TP5F — Google Sheets import compatibility — COMPLETE
- public Google Sheets remains transport-only and adds no separate migration algorithm
- Published-to-the-web XLSX bytes are forwarded unchanged to the shared importAndApplyWorkbook boundary
- real published-snapshot regression uses the oldest recognized pre-Preferred physical-v2 shape
- physical-v2/dataset-2 snapshot migrates through the existing physical-v3 importer
- Product records and notes remain unchanged
- ProductFinancialProfiles / Default / Single pricing remain unchanged
- StorageLocations and Molds remain unchanged
- ProductPriceTiers becomes an empty authoritative collection
- Preferred Yield remains undefined for pre-Preferred records
- no live hydration/session cutover is introduced before TP5G

#### TP5G — Atomic hydration/rollback/recovery completion gate — COMPLETE
- ProductPriceTier repository supports complete defensive collection replacement
- BusinessDataset v2 source snapshot includes deterministic ProductPriceTiers
- BusinessDataset v2 atomic hydration replaces all ten authoritative core collections
- failed tier replacement restores the previous base collections and previous tiers
- failed tier rollback surfaces the distinct ROLLBACK_FAILED outcome
- PhysicalBusinessDataset v3 snapshot includes core tiers plus StorageLocations and Molds
- physical v3 hydration restores the previous core+tier state when a later physical replacement fails
- PersistenceCoordinator supports tier-aware core v3/dataset-v2 and physical v3/dataset-v3 modes
- live tier-aware coordinator retains legacy core and physical import migration compatibility
- core v3 is emitted when no physical records exist; physical v3 is emitted when StorageLocations or Molds exist
- importing an old workbook clears ProductPriceTiers rather than synthesizing tiers from Default / Single pricing
- application session is cut over to the tier-aware snapshot/hydration graph
- shared-session regression proves exported tiers return to the same ProductPriceTierService repository — NEXT / NOT STARTED

### TP6 — Pricing UI

Recommended split:

#### TP6A — Tier catalog/read-only economics — COMPLETE
- selected Product loads ProductPriceTierQuoteService alongside the existing Default / Single quote
- read-only catalog includes active and archived tier source records
- catalog exposes source price basis, price amount, units per offer, minimum order quantity, and additional cost per offer
- ready lines expose offer cost, offer selling price, effective unit price, profit per offer/unit, markup, and margin
- Default / Single equivalent comparison is displayed when authoritative comparison evidence is ready
- unresolved cost/default evidence remains explicit rather than substituted
- existing below-cost/readiness diagnostics are surfaced without adding new pricing formulas
- unsaved financial-profile edits are explicitly excluded from authoritative tier economics
- catalog contains no Create/Edit/Archive mutation controls
- no automatic tier selection is introduced

#### TP6B — Create/edit/archive tier form — NEXT / NOT STARTED
#### TP6C — Package/bulk/custom UX and warnings
#### TP6D — Responsive/accessibility regression

### TP7 — Pricing Quote Integration

- additive tier quote exposure
- keep existing quote fields backward compatible
- show default + alternatives together
- no implicit production/order selection yet

### TP8 — Quantity-Aware Tier Resolution

Do not begin until a separate decision document defines selection semantics.

Questions to resolve in TP8:

- manual tier vs automatic tier
- package divisibility
- quantities that do not fit a package
- overlapping eligible tiers
- channel/customer-specific tiers
- whether “cheapest” is ever allowed as an automatic choice
- mixed package + single remainder behavior

Default safety rule before TP8: **manual explicit tier selection only**.

### TP9 — Integrated Validation & Completion Gate

Must prove:

- no-tier Product behaves exactly as before
- Default / Single pricing remains unchanged
- package economics correct
- bulk economics correct
- custom tier correct
- below-cost tier warns
- archived records survive
- old core workbook imports
- old physical workbook imports
- pre-Preferred physical workbook imports
- Google Sheets old snapshot imports
- workbook round-trip retains tiers
- rollback restores tiers
- Production default financial projections remain unchanged unless TP8 explicitly opts into a tier
- full application typecheck/tests/build green

---

## 13. Regression Matrix

| Area | Existing data | With tiers | Required guarantee |
|---|---|---|---|
| ProductFinancialProfile | unchanged | unchanged | Default / Single remains authoritative |
| SellingPriceDerivation | unchanged | unchanged | still default price |
| Profit/markup/margin | unchanged | tier service adds alternatives | existing metrics stay valid |
| ProductPricingQuote | unchanged | additive tier data only | existing fields keep meaning |
| ExpectedBatchFinancials | unchanged | unchanged through TP7 | no silent revenue changes |
| Core workbook v2/1 | migrates | v3/2 | empty tiers on old files |
| Core workbook v1/1 | chained migration | v3/2 | Preferred Yield migration retained |
| Physical workbook v2/2 | migrates | v3/3 | Storage/Molds preserved |
| Pre-Preferred physical v2/2 | normalized + migrates | v3/3 | PR #250 compatibility retained |
| Google Sheets | same import boundary | same | old published snapshots work |
| Existing IDs | unchanged | new TIER IDs additive | no renumbering |

---

## 14. Risks

### R1 — Breaking old workbook imports

Highest risk.

Mitigation:
- explicit migration graph
- old core and physical fixtures
- Google Sheets regression
- fail closed for unknown shapes

### R2 — Accidentally changing Default / Single price

Mitigation:
- do not move current pricing policy
- no automatic tier conversion
- compatibility tests on quote outputs

### R3 — Production silently using bulk price

Mitigation:
- ExpectedBatchFinancials remains on default quote through TP7
- quantity-aware pricing isolated to TP8

### R4 — Package price ignores package-specific costs

Mitigation:
- `additionalCostPerOffer`
- show base cost and additional cost separately

### R5 — Ambiguous overlapping tiers

Mitigation:
- overlaps allowed as source data
- no implicit resolver before TP8
- manual selection remains safe default

### R6 — Tier price becomes below cost after material price changes

Mitigation:
- do not invalidate source record
- recalculate economics live
- display explicit below-cost warning

---

## 15. TP0 Completion Gate

TP0 is complete when:

- current default pricing ownership is documented
- current one-price downstream assumptions are mapped
- tier domain shape is defined
- Default / Single backward-compatibility rule is fixed
- workbook/dataset version collision is identified
- migration paths for core/physical/Google Sheets are defined
- implementation is split into guarded follow-on phases
- no production behavior has changed

All conditions are satisfied by this audit.

---

## 16. Exact Next Task

**TP6B — Create / Edit / Archive Tier Form — NEXT / NOT STARTED**

TP6A is complete. The Pricing workspace now exposes a read-only Product price-tier catalog backed by ProductPriceTierQuoteService, including saved source terms, authoritative economics, Default / Single comparison, archived tiers, and existing readiness diagnostics.

Tier mutation remains deliberately deferred. Stop after TP6A. Do not start TP6B automatically.
