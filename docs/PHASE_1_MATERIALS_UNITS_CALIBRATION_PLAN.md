# Craft Business Manager — Phase 1 Materials, Units & Calibration Plan

## Status

**PLANNING COMPLETE — DEVELOPMENT NOT STARTED**

Authoritative base branch: `develop`

Phase 0 is complete. Phase 1 establishes the material, measurement, costing, calibration, and stock foundation required before product recipes, mold-yield learning, multi-vessel candle composition, and Excel persistence can be implemented safely.

---

## Phase 1 Objective

Build a storage-agnostic materials foundation that can answer these questions reliably:

- What material do I buy and in what package/unit?
- What is the real cost per base unit?
- How much stock do I currently have?
- How do standard units convert?
- When is a conversion universal versus material-specific?
- How many grams are in one cup of a specific dry material such as plaster?
- Which conversion should be used when a manual override or calibration exists?

This phase must **not** depend on Excel sheet coordinates or Tauri filesystem APIs. Phase 5 will persist these domain objects to Excel.

---

# Phase 1 Breakdown

```text
Phase 1 — Materials, Units & Calibration
│
├── 1.1 — Measurement & Conversion Foundation
│   ├── 1.1A — Unit Catalog & Dimensional Rules
│   ├── 1.1B — Standard Conversion Engine
│   └── 1.1C — Conversion Validation & Tests
│
├── 1.2 — Material Master Domain
│   ├── 1.2A — Material Contract & Classification
│   ├── 1.2B — Material Application CRUD Services
│   └── 1.2C — Materials UI
│
├── 1.3 — Purchase Costing & Inventory Quantity
│   ├── 1.3A — Package Cost / Base-Unit Costing
│   ├── 1.3B — On-Hand Quantity Normalization
│   └── 1.3C — Inventory Valuation & Validation
│
├── 1.4 — Material-Specific Calibration
│   ├── 1.4A — Cup-to-Weight Calibration Model
│   ├── 1.4B — Effective Conversion Precedence
│   └── 1.4C — Calibration UI & Tests
│
├── 1.5 — Supplier & Source Metadata
│   ├── 1.5A — Supplier / Source Contract
│   └── 1.5B — Materials UI Integration
│
└── 1.6 — Phase 1 Integration & Completion Gate
    ├── 1.6A — Integrated Materials Workflow
    └── 1.6B — Regression, Build & Completion Validation
```

All six subphases are intentionally small enough to implement and review independently. The sub-splits above are the recommended development units; further splitting is not required unless implementation reveals a new domain constraint.

---

# 1.1 — Measurement & Conversion Foundation

## Why this comes first

Every later costing, stock, recipe, mold-yield, and candle calculation depends on predictable unit behavior. Unit conversion must therefore be a pure domain capability and not UI logic.

## 1.1A — Unit Catalog & Dimensional Rules

Define the supported units and their dimensions.

### Canonical base units

- weight → `g`
- volume → `mL`
- count → `pc`

### Supported user-facing units

Weight:

- `g`
- `kg`
- `oz`
- `lb`

Volume:

- `mL`
- `L`
- `cup`
- `tbsp`
- `tsp`
- `fl-oz`

Count:

- `pc`

### Standard reference conversions

- 1 kg = 1,000 g
- 1 oz = 28.3495 g
- 1 lb = 453.592 g
- 1 L = 1,000 mL
- 1 cup = 240 mL
- 1 tbsp = 15 mL
- 1 tsp = 5 mL
- 1 US fl oz = 29.5735 mL
- 1 pc = 1 pc

### Dimensional rule

Standard conversion is allowed only inside the same dimension.

Examples:

- kg → g: allowed
- cup → mL: allowed
- pc → pc: allowed
- cup → g: **not universally allowed**
- mL → g: **not universally allowed**

Cross-dimension conversion requires material-specific calibration or density data.

### Completion gate

- unit type system is explicit
- base units are canonical
- incompatible unit conversions are rejected
- no business calculation duplicates conversion constants

---

## 1.1B — Standard Conversion Engine

Create pure functions for:

- input quantity → canonical base quantity
- canonical base quantity → display quantity where useful
- unit compatibility checks
- conversion factor lookup
- standardized rounding behavior

Do not put material-specific grams-per-cup logic here; that belongs to Phase 1.4.

### Completion gate

- all standard conversions resolve through one engine
- invalid conversions return a controlled domain error/result
- zero and negative quantities are handled consistently

---

## 1.1C — Conversion Validation & Tests

Automated coverage should include:

- kg/g
- oz/g
- lb/g
- L/mL
- cup/mL
- tbsp/mL
- tsp/mL
- fl oz/mL
- pc/pc
- incompatible dimensions
- zero values
- fractional values
- rounding-sensitive values

### Completion gate

- typecheck passes
- unit tests pass
- production build passes

---

# 1.2 — Material Master Domain

## 1.2A — Material Contract & Classification

Refine the current `Material` contract so it represents purchased/stocked resources without embedding product-specific behavior.

Recommended fields:

- `id`
- `name`
- `group`
- `baseUnit`
- purchase package quantity
- purchase unit
- package cost
- optional manual package conversion
- on-hand quantity and entered unit
- vendor/source metadata reference or fields
- notes
- active/inactive status

Recommended material groups:

- plaster
- wax
- liquid
- fragrance
- colorant
- wick
- container
- paint
- packaging
- accessory
- other

### Important design rule

Do not store derived values such as cost-per-gram as authoritative data when they can be recalculated from package cost and conversion inputs.

### Completion gate

- material model contains source inputs, not spreadsheet-derived cache values
- validation rules are explicit
- material IDs are stable and unique

---

## 1.2B — Material Application CRUD Services

Implement application-level operations for:

- create material
- update material
- archive/deactivate material
- retrieve material
- list/filter materials
- validate duplicate IDs/names according to the chosen policy

These services should work against a repository/storage abstraction rather than Excel directly.

### Completion gate

- CRUD behavior is testable without React
- UI is not responsible for business validation

---

## 1.2C — Materials UI

Create the first real business screen with:

- material list/table
- add material form
- edit material form
- material group selector
- base-unit selector
- purchase quantity/unit inputs
- package cost
- current stock input
- vendor/source fields
- notes

The screen should visibly distinguish entered values from calculated values.

### Completion gate

- a user can create and edit a valid material entirely through the UI
- invalid conversion combinations cannot be saved silently

---

# 1.3 — Purchase Costing & Inventory Quantity

## 1.3A — Package Cost / Base-Unit Costing

Formula:

```text
package base quantity
= purchase quantity × effective package conversion

cost per base unit
= package cost ÷ package base quantity
```

Example:

```text
1 kg plaster package = 1,000 g
package cost = ₱66
cost per gram = ₱66 / 1,000 = ₱0.066
```

Manual package conversion must support non-standard packaging such as:

```text
1 box = 50 pcs
1 pack = 100 labels
```

A manual conversion takes precedence over a standard package conversion when explicitly supplied.

### Completion gate

- cost/base-unit is deterministic
- manual package conversion is covered by tests
- divide-by-zero and missing conversion cases are controlled

---

## 1.3B — On-Hand Quantity Normalization

Allow stock to be entered in a convenient compatible unit while storing/working with canonical base quantity.

Examples:

- 2.5 kg plaster → 2,500 g
- 1.5 L water → 1,500 mL
- 36 wicks → 36 pc

For dry material entered as cups, base weight normalization requires Phase 1.4 calibration.

### Completion gate

- stock quantities have one canonical representation
- entered/display unit can remain user-friendly
- incompatible units are rejected

---

## 1.3C — Inventory Valuation & Validation

Formula:

```text
inventory value
= on-hand base quantity × cost per base unit
```

Add validation for:

- negative stock
- missing package conversion
- package cost below zero
- on-hand cup quantity without a dry-material calibration

### Completion gate

- current material inventory value is calculable
- invalid stock states are surfaced explicitly

---

# 1.4 — Material-Specific Calibration

This subphase is essential for your mold workflow because the system must work even when the mold volume is unknown and you measure plaster by cups.

## 1.4A — Cup-to-Weight Calibration Model

Do not treat `1 cup = X grams` as a universal conversion.

Store material-specific calibration evidence such as:

```text
Material: Plaster Brand A
Cups measured: 5 cups
Known weight: 1,000 g
Derived calibration: 200 g/cup
```

Recommended calibration record:

- `id`
- `materialId`
- `measuredVolume`
- `volumeUnit`
- `knownWeightGrams`
- `gramsPerCup`
- `recordedAt`
- optional notes

Prefer a separate `MaterialCalibration` record rather than making one `gramsPerCup` field the only source of truth. This preserves evidence and allows future recalibration.

### Multiple calibration samples

Phase 1 should support at least a deterministic effective calibration strategy:

- latest valid calibration, or
- explicit preferred calibration

Averaging several samples can be added later if useful; it is not required for the first implementation.

### Completion gate

- a known weight plus cup measurement can derive grams-per-cup
- calibration belongs to a specific material
- invalid zero measurements are rejected

---

## 1.4B — Effective Conversion Precedence

Define one explicit precedence rule so the UI and calculations cannot disagree.

Recommended package conversion precedence:

```text
manual package conversion
    ↓ if absent
standard same-dimension conversion
```

Recommended dry cup-to-weight precedence:

```text
explicit material calibration
    ↓ if absent
material manual grams-per-cup override (if supported)
    ↓ if absent
unavailable / validation error
```

Never silently assume 240 g for one cup of plaster. `240 mL/cup` is a volume conversion only.

### Completion gate

- effective conversion source can be identified/explained
- no hidden fallback converts dry cup volume to grams incorrectly

---

## 1.4C — Calibration UI & Tests

UI workflow:

1. select material
2. enter cups measured
3. enter known weight and unit
4. system converts known weight to grams
5. system displays calculated grams/cup
6. save calibration
7. material stock/cost calculations can use the effective calibration

Test cases:

- 5 cups = 1 kg → 200 g/cup
- 1 cup = known gram weight
- fractional cups
- zero cups rejected
- invalid material base dimension rejected
- stock entered in cups becomes grams after calibration

### Completion gate

- calibration can be created through UI
- affected material calculations update consistently
- tests and build pass

---

# 1.5 — Supplier & Source Metadata

## 1.5A — Supplier / Source Contract

For Phase 1, supplier data can stay lightweight rather than introducing a full supplier-management module.

Fields may include:

- vendor name
- source/contact
- purchase link
- optional contact number / social page reference
- notes

Keep this extensible so a dedicated Supplier entity can be introduced later without changing costing logic.

## 1.5B — Materials UI Integration

Display/edit vendor and source metadata alongside the material package record.

### Completion gate

- a material can retain where it was sourced and how to buy it again
- supplier metadata does not participate in costing calculations

---

# 1.6 — Phase 1 Integration & Completion Gate

## 1.6A — Integrated Materials Workflow

End-to-end scenario to support:

```text
Create Plaster of Paris
↓
Purchase package: 1 kg for ₱66
↓
Cost per gram: ₱0.066
↓
Calibrate: 5 cups from 1 kg
↓
Effective calibration: 200 g/cup
↓
Enter current stock: 3 cups
↓
Normalized stock: 600 g
↓
Inventory value: ₱39.60
```

A count-based example must also pass:

```text
100 wicks purchased for ₱80
cost per wick = ₱0.80
on hand = 40 pc
inventory value = ₱32.00
```

## 1.6B — Regression, Build & Completion Validation

Phase 1 is complete only when:

- all unit conversion tests pass
- material CRUD service tests pass
- costing tests pass
- calibration tests pass
- integrated React workflow works
- TypeScript typecheck passes
- automated tests pass
- production build passes
- GitHub Actions CI passes on the feature PR
- post-merge `develop` CI passes

---

# Dependency Order

```text
1.1 Measurement & Conversion Foundation
       ↓
1.2 Material Master Domain
       ↓
1.3 Purchase Costing & Inventory Quantity
       ↓
1.4 Material-Specific Calibration
       ↓
1.5 Supplier & Source Metadata
       ↓
1.6 Integration & Completion Gate
       ↓
Phase 2 — Product Recipes & Mold Yield
```

Some UI work in 1.2 and supplier metadata in 1.5 can overlap after the underlying contracts are stable, but the recommended implementation sequence remains serial for easier review and regression control.

---

# Recommended Branch / PR Sequence

Use a separate feature branch and PR for each implementation unit:

```text
feature/phase-1-1-measurement-conversion
feature/phase-1-2-material-master
feature/phase-1-3-costing-inventory
feature/phase-1-4-material-calibration
feature/phase-1-5-supplier-metadata
feature/phase-1-6-integration-gate
```

Each PR targets `develop`.

Do not start a later subphase until the prior subphase is merged and `develop` CI is green, except for explicitly independent documentation/UI preparation.

---

# Decisions Locked by This Plan

1. Internal canonical units are `g`, `mL`, and `pc`.
2. User-facing standard units include g, kg, oz, lb, mL, L, cup, tbsp, tsp, US fl oz, and pc.
3. One standard measuring cup is 240 mL.
4. Standard conversions never silently cross weight and volume dimensions.
5. Dry cup-to-weight conversion is material-specific.
6. Mold volume is not required by Phase 1 and will not be introduced as a dependency.
7. Derived costs/normalized quantities are calculated from source data rather than treated as authoritative persisted values.
8. Excel-specific mapping remains deferred to Phase 5.
9. Phase 1 development has **not started** as part of this planning task.

---

# Next Active Task After Planning

**Phase 1.1 — Measurement & Conversion Foundation**

Before implementation, begin with **1.1A — Unit Catalog & Dimensional Rules** on its dedicated feature branch.