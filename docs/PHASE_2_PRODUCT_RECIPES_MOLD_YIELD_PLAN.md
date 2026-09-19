# Craft Business Manager — Phase 2 Product Recipes & Mold Yield Plan

## Status

**PLANNING COMPLETE — IMPLEMENTATION NOT STARTED**

Authoritative base branch at planning start:

`develop` @ `82d9cb76d9ef2ef1584623e31190c9b28620e346`

Phase 1 — Materials, Units & Calibration is complete and is the required foundation for this phase.

---

# Phase 2 Objective

Build the product-recipe and real-production learning layer that can answer these questions reliably:

- What kind of product are we making?
- Which material mix or ratio does the product use?
- What fixed materials are consumed by each finished piece?
- What materials were actually consumed in a real sample batch?
- How many good and rejected pieces did that batch produce?
- How much material is effectively required per good piece?
- How much safety waste should be reserved for a planned production run?
- Based on current material inventory, how many pieces can actually be produced?
- Which material is the limiting resource?

The system must continue to work even when mold volume is unknown.

**Real sample production evidence is authoritative. Mold volume is optional and is not a Phase 2 dependency.**

---

# Assessment of Existing Phase 2 Scaffolding

The repository already contains early/prototype contracts in `src/domain/types.ts`:

- `ProductCategory`
- `RatioBasis`
- `MixPreset`
- `MoldYieldSample`
- `ProductRecipeItem`
- `Product`

It also contains simple prototype helpers in `src/domain/costing.ts`:

- `baseQuantityPerGoodPiece()`
- `wasteAdjustedRequirement()`
- `produciblePieces()`
- `limitingCapacity()`

These are useful scaffolding, but they are **not considered completed Phase 2 behavior**.

The current prototype has several limitations that Phase 2 must correct:

1. `MoldYieldSample` tracks only one primary material, but a real batch may consume plaster + water, wax + fragrance, or other materials.
2. `ProductRecipeItem.baseQuantityPerProduct` stores a derived value directly rather than preserving a user-entered quantity/unit or production evidence.
3. Mix presets are limited to a primary/secondary shape and do not yet provide a reusable ratio-resolution engine.
4. Product and Phase 3 component concerns are currently bundled in the same generic `Product` interface.
5. Yield-sample selection/history rules are not defined.
6. The existing helpers do not yet combine learned usage, fixed recipe inputs, safety waste, and Phase 1 inventory into one capacity result.
7. There is no Product / Mix / Yield / Production Estimate UI yet.

Phase 2 should therefore refine these prototypes into dedicated domain modules rather than treating the current interfaces as stable persistence contracts.

---

# Recommended Phase 2 Breakdown

```text
Phase 2 — Product Recipes & Mold Yield
│
├── 2.1 — Product & Mix Foundation
│   ├── 2.1A — Product Contract & Category Rules
│   ├── 2.1B — Mix Preset Contract & Ratio Engine
│   └── 2.1C — Product / Mix Repositories & Application Services
│
├── 2.2 — Yield Evidence & Per-Good-Piece Learning
│   ├── 2.2A — Yield Sample Evidence Contract
│   ├── 2.2B — Good / Rejected Output & Learned Requirements
│   └── 2.2C — Effective Yield Selection & History Rules
│
├── 2.3 — Recipe Requirement Synthesis
│   ├── 2.3A — Fixed Recipe Item Contract & Material Roles
│   ├── 2.3B — Effective Per-Piece Material Requirements
│   └── 2.3C — Material Cost Preview & Requirement Validation
│
├── 2.4 — Safety Waste & Inventory-Limited Capacity
│   ├── 2.4A — Safety Waste Policy
│   ├── 2.4B — Waste-Adjusted Production Requirements
│   └── 2.4C — Producible Pieces & Limiting Material
│
├── 2.5 — Product / Yield / Production UI
│   ├── 2.5A — Products & Mix Presets UI
│   ├── 2.5B — Yield Recording & History UI
│   └── 2.5C — Production Estimate UI
│
└── 2.6 — Phase 2 Integration & Completion Gate
    ├── 2.6A — Integrated Product / Yield Workflow
    └── 2.6B — Regression, Build & Completion Validation
```

The split above is recommended. Further splitting is not currently necessary unless implementation exposes a new domain constraint.

---

# 2.1 — Product & Mix Foundation

## 2.1A — Product Contract & Category Rules

Create a dedicated product-domain contract instead of continuing to grow the generic `types.ts` prototype.

Initial product categories:

- `paintable-art`
- `candle-pot`
- `candle`

Recommended source fields:

- `id`
- `name`
- `category`
- optional `mixPresetId`
- `safetyWasteRate`
- optional notes
- active/inactive state

Do **not** make Phase 3 product components authoritative in Phase 2.

Phase 3 remains responsible for:

- purchased vessels as product components;
- molded child components;
- nested product/component composition;
- multi-vessel sets;
- component-limited capacity.

A Phase 2 product is therefore the sellable/production identity plus its material recipe/yield behavior.

### Category guidance

`paintable-art`

- typically plaster-based;
- may use a volume-basis plaster/water mix;
- usually benefits strongly from real yield samples;
- fixed items may include paint, brush, label, or packaging if directly consumed per sold item.

`candle-pot`

- typically molded plaster or similar material;
- follows the same sample-yield approach as paintable art;
- vessel use by another candle product is Phase 3.

`candle`

- typically wax-based;
- may use a weight-basis wax/fragrance ratio;
- may be wax-only for unscented candles;
- fixed items may include wick and label;
- purchased or molded vessel composition belongs to Phase 3.

### Completion gate

- product IDs/names have explicit validation and duplicate policy;
- category rules are centralized;
- product source fields do not contain derived costing/capacity values;
- Phase 3 component composition is not accidentally implemented here.

---

## 2.1B — Mix Preset Contract & Ratio Engine

The current primary/secondary prototype should be refined into a reusable mix-ratio model.

Recommended contract:

```text
MixPreset
- id
- name
- category compatibility
- basis: weight | volume
- lines[]
    - materialId
    - role
    - parts
- notes
- active/inactive
```

Recommended line roles:

- `primary`
- `secondary`
- `additive`

This permits both simple and slightly richer formulas without requiring a future breaking change.

Examples:

```text
Plaster mix
basis = volume
plaster = 2 parts
water   = 1 part
```

```text
Scented candle
basis = weight
wax       = 100 parts
fragrance = 8 parts
```

```text
Unscented candle
basis = weight
wax = 100 parts
```

### Ratio engine rule

A ratio is **relative**, not an absolute recipe quantity.

The engine should accept an anchor line/quantity and derive the other line quantities proportionally.

Example:

```text
Preset: plaster 2 : water 1
Anchor: plaster = 3 cups
Result: water = 1.5 cups
```

Example:

```text
Preset: wax 100 : fragrance 8
Anchor: wax = 500 g
Result: fragrance = 40 g
```

The ratio engine must use a common basis dimension:

- volume preset → volume units only;
- weight preset → weight units only.

When the resulting material input later needs to become a material canonical unit, Phase 1 conversion/calibration rules apply.

For example, a volume-basis plaster input measured in cups can become grams through the material-specific calibration from Phase 1.

### Important distinction

`1 cup = 240 mL` remains a universal volume conversion.

`cup -> grams of plaster` remains material-specific and must use the Phase 1 calibration engine.

### Completion gate

- preset validation is explicit;
- all parts are positive finite values;
- duplicate material lines are rejected;
- single-line presets are allowed;
- anchor-based ratio resolution is deterministic;
- weight and volume ratio dimensions cannot be mixed silently.

---

## 2.1C — Product / Mix Repositories & Application Services

Follow the established Phase 1 architecture:

```text
React UI
   ↓
Application Services
   ↓
Repository Ports
   ↓
In-memory repository now
Excel repository in Phase 5
SQLite-compatible contract later
```

Implement application operations for products:

- create;
- update;
- retrieve;
- list/search/filter;
- archive/deactivate;
- duplicate ID/name protection.

Implement application operations for mix presets:

- create;
- update;
- retrieve;
- list/search/filter;
- archive/deactivate;
- validate referenced materials;
- prevent invalid deletion/archive relationships where needed.

### Completion gate

- Product/Mix CRUD behavior is testable independently of React;
- repository clones protect nested mix-line arrays;
- no storage implementation leaks into domain/application logic.

---

# 2.2 — Yield Evidence & Per-Good-Piece Learning

## 2.2A — Yield Sample Evidence Contract

Replace the current one-material `MoldYieldSample` prototype with evidence that can represent the actual materials consumed by the batch.

Recommended contract:

```text
YieldSample
- id
- productId
- optional mixPresetId
- materialInputs[]
    - materialId
    - quantity
    - unit
- goodPieces
- rejectedPieces
- recordedAt
- notes
```

The record should preserve what was actually measured.

Derived canonical quantities must not replace the original evidence.

Example:

```text
Product: Small plaster star
Inputs:
- plaster = 3 cups
- water   = 1.5 cups
Result:
- good = 8
- rejected = 1
```

The Phase 1 conversion engine resolves the sample inputs to each material's canonical base unit.

### Historical-reference rule

Existing historical samples may continue referencing an archived material/product so evidence is not destroyed.

New samples should normally require active products/materials.

### Completion gate

- sample IDs are stable and unique;
- all quantities are finite and greater than zero;
- good pieces must be greater than zero for a usable learning sample;
- rejected pieces cannot be negative;
- duplicate material lines in one sample are rejected;
- referenced product/material identities are validated.

---

## 2.2B — Good / Rejected Output & Learned Requirements

For each material used in a valid yield sample:

```text
learned base quantity per good piece
= total material base quantity consumed / good pieces
```

Example:

```text
3 cups plaster
calibration = 200 g/cup
=> 600 g plaster used

good pieces = 8

learned plaster requirement
= 600 / 8
= 75 g per good piece
```

### Critical waste rule

Rejected pieces are tracked for diagnostics, but **do not go into the denominator** for material-per-good-piece learning.

The material consumed while producing rejected pieces is already included in total batch consumption.

Therefore:

```text
learned requirement = total consumed / good pieces
```

already absorbs observed defect loss from that sample.

Do not apply a second rejection-waste multiplier to the same sample.

### Defect metric

A separate diagnostic can be derived:

```text
defect rate
= rejected pieces / (good pieces + rejected pieces)
```

This metric is informative and must remain separate from `safetyWasteRate`.

### Completion gate

- per-good-piece material usage can be derived for every sample input;
- rejected-piece tracking is correct;
- observed sample loss is not double-counted;
- sample source evidence remains unchanged by calculations.

---

## 2.2C — Effective Yield Selection & History Rules

A product may have several valid yield samples over time.

Phase 2 baseline strategy:

```text
latest valid yield sample wins
```

Tie-breaking must be deterministic using `recordedAt` and then stable sample identity.

Examples:

```text
older sample: 80 g plaster / good piece
newer sample: 75 g plaster / good piece

effective learned requirement = newer sample
```

Do not average samples automatically in Phase 2.

Averaging, weighted averages, confidence scoring, or explicit preferred-sample controls may be added later if real production usage justifies them.

### Completion gate

- sample history is retained;
- effective sample selection is deterministic;
- deleting the final sample required by an active learned recipe cannot silently leave an invalid persisted state;
- derived results identify the sample that produced them.

---

# 2.3 — Recipe Requirement Synthesis

## 2.3A — Fixed Recipe Item Contract & Material Roles

Some inputs are consumed per sellable piece and do not need to be learned from mold yield.

Examples:

- 1 wick per candle;
- 1 label per candle;
- 1 brush per paintable-art kit;
- fixed paint quantity where appropriate;
- direct packaging material where it is simply a stocked material rather than a composite Phase 3 component.

Recommended fixed recipe item:

```text
RecipeItem
- id
- productId
- materialId
- quantityPerProduct
- unit
- role
- notes
```

Recommended roles:

- `consumable`
- `additive`
- `finish`
- `packaging`
- `other`

Do not use recipe items for nested products or molded/purchased vessels that require component semantics; those belong to Phase 3.

Store the entered quantity/unit as source data and derive canonical base quantity through Phase 1.

### Completion gate

- fixed recipe quantities validate through Phase 1 material conversion rules;
- duplicate/conflicting recipe lines are controlled;
- source quantity/unit is preserved;
- Phase 3 component semantics are excluded.

---

## 2.3B — Effective Per-Piece Material Requirements

Build one derived material requirement view for a product by combining:

1. yield-derived material requirements from the effective sample; and
2. fixed per-product recipe items.

Example:

```text
Learned from batch:
plaster = 75 g / good piece
water   = 45 mL / good piece

Fixed recipe:
paint = 2 mL / product
brush = 1 pc / product

Effective requirements:
plaster 75 g
water   45 mL
paint    2 mL
brush    1 pc
```

### Duplicate-material rule

If the same material appears in both yield-derived and fixed requirements, the system must use an explicit deterministic policy.

Recommended Phase 2 policy:

- combine quantities only when both resolve to the same canonical material base unit;
- preserve source labels explaining which portion came from yield and which came from fixed recipe;
- reject ambiguous duplicated intent rather than silently replacing one source with another.

### Completion gate

- effective requirements are derived, not persisted as an authoritative cache;
- every result identifies its source (`yield`, `fixed`, or combined);
- unit normalization uses Phase 1 rules;
- incomplete products return controlled readiness/validation results.

---

## 2.3C — Material Cost Preview & Requirement Validation

Phase 2 may calculate **material cost contribution**, but not selling price/profit policy.

For each material requirement:

```text
material cost per product
= required canonical base quantity × material cost per base unit
```

Then:

```text
recipe material cost
= sum(material cost contributions)
```

This is needed for recipe verification and later Phase 4 pricing.

Phase 4 remains responsible for:

- full unit cost policy;
- fixed profit;
- markup percentage;
- target margin;
- selling price;
- revenue/profit planning.

### Completion gate

- material cost contribution is traceable by material;
- unavailable/invalid material cost is surfaced explicitly;
- Phase 2 does not introduce selling-price behavior.

---

# 2.4 — Safety Waste & Inventory-Limited Capacity

## 2.4A — Safety Waste Policy

`safetyWasteRate` is a planning reserve applied on top of the learned/fixed requirement.

Formula:

```text
waste-adjusted requirement
= effective requirement × (1 + safetyWasteRate)
```

Examples:

```text
75 g plaster × 1.05
= 78.75 g planned plaster per piece
```

### Distinguish from observed defects

Observed rejected pieces are already represented in learned sample consumption.

Safety waste is an additional future-production buffer for:

- spills;
- residue in mixing tools;
- small measurement variation;
- handling loss;
- normal production uncertainty.

Do not automatically set safety waste equal to historical defect rate.

### Validation

Recommended range for Phase 2:

```text
0 <= safetyWasteRate < 1
```

The UI may present this as a percentage.

### Completion gate

- safety waste is explicit and independently configurable;
- negative or non-finite waste rates are rejected;
- safety waste is not confused with defect rate.

---

## 2.4B — Waste-Adjusted Production Requirements

Produce a per-product and planned-batch requirement breakdown.

Per product:

```text
planned material requirement per piece
= effective per-piece requirement × (1 + safetyWasteRate)
```

For planned quantity `Q`:

```text
planned material quantity
= planned per-piece requirement × Q
```

Results should be explainable by material and source.

### Completion gate

- every material requirement is traceable;
- quantity zero is handled safely;
- fractional base-unit quantities retain precision;
- display rounding never changes authoritative calculations.

---

## 2.4C — Producible Pieces & Limiting Material

Use the normalized on-hand inventory established in Phase 1.

For each required material:

```text
material capacity
= floor(normalized on-hand quantity / waste-adjusted per-piece requirement)
```

Overall capacity:

```text
producible pieces
= minimum capacity across all required materials
```

Example:

```text
plaster capacity = 12
water capacity   = 50
paint capacity   = 20
brush capacity   = 8

product capacity = 8
limiting material = brush
```

The result should identify all tied limiting materials when capacities are equal.

### Important scope boundary

This Phase 2 capacity calculation considers direct material requirements only.

Phase 3 will extend capacity with:

- purchased vessels;
- molded product components;
- nested components;
- multiple vessel/component quantities per product.

### Completion gate

- capacity is based on current normalized Phase 1 inventory;
- missing required material inventory produces a controlled result;
- capacity never becomes negative;
- limiting material(s) are reported explicitly;
- component capacity is deferred to Phase 3.

---

# 2.5 — Product / Yield / Production UI

## 2.5A — Products & Mix Presets UI

Enable the currently disabled `Products` application section.

Product UI should support:

- list/search/filter products;
- add/edit/archive product;
- category selector;
- safety-waste percentage;
- assign optional mix preset;
- manage fixed recipe materials;
- readiness indicators when required material data is incomplete.

Mix preset UI should support:

- create/edit/archive presets;
- choose weight/volume basis;
- add/remove ratio lines;
- select materials;
- define ratio parts;
- preview ratio resolution from an anchor amount.

### Completion gate

- valid product and preset records can be managed entirely through UI;
- invalid ratios/recipe material references cannot be silently saved.

---

## 2.5B — Yield Recording & History UI

Workflow:

1. select product;
2. optionally select the mix preset used;
3. enter actual material quantities consumed;
4. enter each quantity in a user-friendly supported unit;
5. enter good pieces;
6. enter rejected pieces;
7. optionally enter notes/date;
8. preview canonical consumption and learned per-good-piece values;
9. save sample;
10. display history and identify the effective/latest sample.

For plaster measured by cups, the UI must reuse Phase 1 calibration and identify the conversion source.

### Completion gate

- real sample evidence can be recorded without mold volume;
- derived learned requirements are visible before/after save;
- sample history is retained;
- effective sample is visibly identified.

---

## 2.5C — Production Estimate UI

Enable the production-estimate workflow using current material inventory.

Display:

- effective yield sample;
- fixed recipe inputs;
- effective material requirement per product;
- safety-waste adjustment;
- current normalized stock by material;
- capacity per material;
- overall producible pieces;
- limiting material(s);
- estimated material cost per product;
- planned material needs for a requested quantity.

Do not add selling-price/profit UI yet; that belongs to Phase 4.

### Completion gate

- user can understand *why* production is limited;
- calculations identify all conversion/yield sources;
- no hidden fallback uses mold volume.

---

# 2.6 — Phase 2 Integration & Completion Gate

## 2.6A — Integrated Product / Yield Workflow

### Plaster art example

```text
Create product:
Small Star — paintable-art

Assign mix preset:
plaster : water = 2 : 1 by volume

Record real sample:
plaster = 3 cups
water = 1.5 cups
good = 8
rejected = 1

Material calibration:
plaster = 200 g/cup

Derived learned usage:
plaster = 600 g / 8 = 75 g/good piece
water = 360 mL / 8 = 45 mL/good piece

Fixed recipe:
paint = 2 mL
brush = 1 pc

Safety waste:
5%

Planned requirements per piece:
plaster = 78.75 g
water = 47.25 mL
paint = 2.10 mL
brush = 1.05 pc policy must be handled correctly for count materials
```

### Count-material note

For indivisible count materials such as brushes/wicks, waste-adjusted count requirements need an explicit Phase 2 policy.

Recommended policy:

- keep precise mathematical requirement internally;
- when converting to a purchasable/required count for a planned batch, round the total required count upward;
- do not round every per-piece count prematurely if doing so would overstate waste drastically.

Example:

```text
1 brush/piece × 10 pieces × 1.05
= 10.5 brushes
=> planned batch requires 11 brushes
```

Capacity calculation for count materials must use a safe formulation that cannot claim production requiring a fractional physical piece that does not exist.

This policy should be finalized and tested in 2.4.

### Candle example

```text
Create product:
Scented Event Candle

Mix preset:
wax : fragrance = 100 : 8 by weight

Real sample or learned batch:
wax = 500 g
fragrance = 40 g
good candles = 10

Learned:
wax = 50 g/candle
fragrance = 4 g/candle

Fixed recipe:
wick = 1 pc/candle
label = 1 pc/candle

Capacity is the minimum material capacity.
```

The vessel/container is intentionally excluded until Phase 3 component composition.

---

## 2.6B — Regression, Build & Completion Validation

Phase 2 is complete only when:

- product contract/category tests pass;
- mix-ratio tests pass;
- repository/application service tests pass;
- yield evidence/selection tests pass;
- learned per-good-piece calculations pass;
- fixed recipe requirement tests pass;
- material cost contribution tests pass;
- safety-waste tests pass;
- capacity/limiting-material tests pass;
- plaster integrated workflow passes;
- candle integrated workflow passes;
- Product/Yield/Production UI smoke coverage passes;
- TypeScript typecheck passes;
- complete automated tests pass;
- production build passes;
- feature PR CI passes;
- post-merge `develop` CI passes.

---

# Locked Phase 2 Design Decisions

1. Phase 1 remains the authority for units, material calibration, material cost/base-unit, and normalized inventory.
2. Mold volume is optional and is not required by Phase 2.
3. Real sample batches are authoritative production evidence.
4. A yield sample stores **all actual material inputs**, not only the primary material.
5. Per-good-piece material requirements are derived from sample evidence; they are not authoritative persisted cache values.
6. `goodPieces` is the denominator for learned material usage.
7. Rejected pieces are tracked separately for defect diagnostics; their consumed material is already included in total sample input and must not be double-counted as another waste multiplier.
8. Safety waste is a planning buffer separate from observed defect rate.
9. Latest valid yield sample is the Phase 2 effective-sample strategy; automatic averaging is deferred.
10. Fixed per-product material inputs remain separate from yield-derived material consumption.
11. Recipe source quantity/unit is preserved; canonical quantities are derived through Phase 1.
12. Product material cost may be calculated in Phase 2, but selling price/profit policy remains Phase 4.
13. Nested products, purchased vessels, molded components, multi-vessel sets, and component capacity remain Phase 3.
14. Excel persistence remains Phase 5.
15. React components must continue to call application services rather than owning business rules.

---

# Dependency Order

```text
Phase 1 COMPLETE
   ↓
2.1 Product & Mix Foundation
   ↓
2.2 Yield Evidence & Learning
   ↓
2.3 Recipe Requirement Synthesis
   ↓
2.4 Safety Waste & Capacity
   ↓
2.5 Product / Yield / Production UI
   ↓
2.6 Integration & Completion Gate
   ↓
Phase 3 — Multi-Vessel / Multi-Component Products
```

---

# Recommended Branch / PR Sequence

Use small feature branches targeting `develop`.

Recommended implementation sequence:

```text
feature/phase-2-1a-product-contract
feature/phase-2-1b-mix-ratio-engine
feature/phase-2-1c-product-mix-services

feature/phase-2-2a-yield-evidence
feature/phase-2-2b-yield-learning
feature/phase-2-2c-yield-selection

feature/phase-2-3a-fixed-recipe-items
feature/phase-2-3b-effective-requirements
feature/phase-2-3c-recipe-cost-preview

feature/phase-2-4a-safety-waste
feature/phase-2-4b-planned-requirements
feature/phase-2-4c-production-capacity

feature/phase-2-5a-products-mix-ui
feature/phase-2-5b-yield-ui
feature/phase-2-5c-production-estimate-ui

feature/phase-2-6a-integrated-workflow
feature/phase-2-6b-regression-completion
```

Do not start the next implementation unit until the prior unit is merged and `develop` CI is green, unless a later unit is explicitly proven independent.

---

# Next Active Task

**2.1A — Product Contract & Category Rules**

Status:

```text
PLANNED
NOT STARTED
```

No Phase 2 implementation code was intentionally added as part of this planning task.
