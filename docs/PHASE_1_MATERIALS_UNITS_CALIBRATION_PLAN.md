# Craft Business Manager — Phase 1 Materials, Units & Calibration

## Status

**COMPLETE**

Authoritative integration branch: `develop`

Final Phase 1 implementation merge commit:

`ee6953c9e1d132325c77e23cd9e07c859b469dbb`

Final implementation post-merge CI:

`34827137558` — **SUCCESS**

---

## Phase 1 Objective

Build a storage-agnostic materials foundation that can answer reliably:

- what material is being purchased and in what package/unit;
- what the real cost per canonical base unit is;
- how much stock is currently available;
- how standard units convert;
- when a conversion is universal versus material-specific;
- how many grams are in one cup of a specific dry material such as plaster;
- which conversion source is effective when standard, manual, or calibrated values exist;
- what the current inventory value is;
- where a material was sourced and how to buy it again.

Phase 1 deliberately remains independent of Excel cell coordinates and Tauri filesystem APIs. Persistence is deferred to Phase 5.

---

# Completed Phase 1 Breakdown

```text
Phase 1 — Materials, Units & Calibration                 COMPLETE
│
├── 1.1 — Measurement & Conversion Foundation           COMPLETE
│   ├── 1.1A — Unit Catalog & Dimensional Rules         COMPLETE
│   ├── 1.1B — Standard Conversion Engine              COMPLETE
│   └── 1.1C — Conversion Validation & Tests           COMPLETE
│
├── 1.2 — Material Master Domain                        COMPLETE
│   ├── 1.2A — Material Contract & Classification      COMPLETE
│   ├── 1.2B — Material Application CRUD Services      COMPLETE
│   └── 1.2C — Materials UI                            COMPLETE
│
├── 1.3 — Purchase Costing & Inventory Quantity         COMPLETE
│   ├── 1.3A — Package Cost / Base-Unit Costing         COMPLETE
│   ├── 1.3B — On-Hand Quantity Normalization           COMPLETE
│   └── 1.3C — Inventory Valuation & Validation         COMPLETE
│
├── 1.4 — Material-Specific Calibration                 COMPLETE
│   ├── 1.4A — Cup-to-Weight Calibration Model         COMPLETE
│   ├── 1.4B — Effective Conversion Precedence         COMPLETE
│   └── 1.4C — Calibration UI & Tests                  COMPLETE
│
├── 1.5 — Supplier & Source Metadata                    COMPLETE
│   ├── 1.5A — Supplier / Source Contract              COMPLETE
│   └── 1.5B — Materials UI Integration                COMPLETE
│
└── 1.6 — Phase 1 Integration & Completion Gate         COMPLETE
    ├── 1.6A — Integrated Materials Workflow           COMPLETE
    └── 1.6B — Regression, Build & Completion          COMPLETE
```

---

# Locked Design Decisions

These rules were established during Phase 1 and remain authoritative for later phases.

1. Canonical internal units are:
   - weight → `g`
   - volume → `mL`
   - count → `pc`
2. Supported user-facing standard units are:
   - weight: `g`, `kg`, `oz`, `lb`
   - volume: `mL`, `L`, `cup`, `tbsp`, `tsp`, `fl-oz`
   - count: `pc`
3. Standard reference conversions include:
   - 1 kg = 1,000 g
   - 1 oz = 28.3495 g
   - 1 lb = 453.592 g
   - 1 L = 1,000 mL
   - 1 cup = 240 mL
   - 1 tbsp = 15 mL
   - 1 tsp = 5 mL
   - 1 US fl oz = 29.5735 mL
   - 1 pc = 1 pc
4. Standard conversion never silently crosses dimensions.
5. `cup -> g` for dry materials is material-specific and is never treated as a universal rule.
6. Mold volume is not required by the material foundation.
7. Source facts are authoritative; derived values are recalculated rather than persisted as stale cache fields.
8. Excel-specific mapping remains deferred to Phase 5.
9. React components do not read or write spreadsheet cells directly.
10. Supplier/source metadata is informational and cannot alter costing or inventory valuation.

---

# 1.1 — Measurement & Conversion Foundation

## Delivered

The application now has one authoritative unit catalog and conversion engine.

Capabilities include:

- explicit unit dimensions;
- canonical base-unit lookup;
- same-dimension conversion factors;
- quantity conversion;
- canonical normalization;
- runtime unit validation;
- controlled conversion errors;
- explicit rounding behavior;
- exhaustive pair/matrix and regression coverage.

Examples:

```text
2.5 kg -> 2,500 g
1.5 L  -> 1,500 mL
3 tbsp -> 45 mL
1 cup  -> 240 mL
```

Invalid universal conversion remains rejected:

```text
cup -> g   INVALID without material calibration
mL  -> g   INVALID without material-specific data
pc  -> mL  INVALID
```

---

# 1.2 — Material Master Domain

## Delivered

The authoritative `Material` contract represents purchased/stocked source facts rather than spreadsheet-derived values.

Material data includes:

- stable material ID;
- material name;
- classification/group;
- canonical base unit;
- purchase quantity and purchase unit/package;
- package cost;
- optional manual package conversion;
- on-hand quantity and entered unit;
- supplier/source metadata;
- notes;
- active/archive state.

The application layer supports:

- create;
- update;
- retrieve;
- list/filter/search;
- archive/deactivate;
- case-insensitive duplicate ID/name protection.

The visible Materials workspace exposes the material workflow through React while keeping validation in the application/domain layer.

---

# 1.3 — Purchase Costing & Inventory Quantity

## Package costing

```text
package base quantity
= purchase quantity × effective package conversion

cost per base unit
= package cost ÷ package base quantity
```

Example:

```text
1 kg plaster = ₱66
1 kg = 1,000 g
cost per gram = ₱66 / 1,000 = ₱0.066/g
```

Count-package example:

```text
1 pack = 100 labels
package cost = ₱120
cost per label = ₱1.20/pc
```

## On-hand normalization

Examples:

```text
2.5 kg plaster -> 2,500 g
1.5 L liquid   -> 1,500 mL
40 wicks       -> 40 pc
0.5 pack × 100 pc/pack -> 50 pc
```

## Inventory valuation

```text
inventory value
= normalized on-hand base quantity × cost per base unit
```

Example:

```text
600 g plaster × ₱0.066/g = ₱39.60
```

Negative inventory, invalid/missing conversions, negative package costs, and unresolved stock units are rejected explicitly.

---

# 1.4 — Material-Specific Calibration

## Calibration evidence

Dry `cup -> g` relationships belong to a specific material.

Example:

```text
Material: Plaster Brand A
Measured volume: 5 cups
Known weight: 1 kg = 1,000 g
Derived: 200 g/cup
```

The source evidence retains:

- calibration ID;
- material ID;
- measured volume and volume unit;
- known weight and weight unit;
- recorded date/time;
- optional notes.

Derived values such as measured cups, normalized grams, and grams per cup are calculated rather than treated as authoritative source fields.

## Effective calibration strategy

When several calibration samples exist, the deterministic Phase 1 rule is:

```text
latest valid calibration wins
```

A stable ID tie-breaker is used when timestamps are equal.

## Effective conversion precedence

Ordinary package conversion:

```text
manual conversion
    ↓ if absent
standard same-dimension conversion
    ↓ if absent
controlled error
```

Dry cup-to-weight conversion:

```text
material calibration
    ↓ if absent
manual g/cup fallback when explicitly supported
    ↓ if absent
controlled error
```

The application reports the effective conversion source instead of silently guessing.

## Calibration workspace

The React Calibration workspace supports:

- selecting an active gram-based material;
- entering measured volume;
- entering known weight;
- live derived `g/cup` preview;
- saving calibration evidence;
- calibration history;
- effective/latest sample display;
- removal of incorrect evidence when safe.

An integration safeguard prevents deleting the final calibration required by a currently saved cup-based material state.

---

# 1.5 — Supplier & Source Metadata

## Delivered metadata

Materials may optionally retain:

- vendor/supplier name;
- branch/platform/source detail;
- purchase/re-order URL;
- contact number;
- social page/handle;
- supplier buying notes.

Supplier/source metadata is normalized, purchase URLs are validated, and source information participates in material search.

It remains financially isolated from:

- package costing;
- calibration;
- normalized stock;
- inventory valuation.

The Materials UI includes a Supplier / source form section, source summary column, and direct re-order link when available.

---

# 1.6 — Integration & Completion Gate

## 1.6A integrated workflow

The final integrated material workflow validates scenarios including:

### Calibrated plaster

```text
Purchase: 1 kg for ₱66
Cost per gram: ₱0.066
Calibration: 5 cups = 1 kg
Effective calibration: 200 g/cup
On hand: 3 cups
Normalized stock: 600 g
Inventory value: ₱39.60
```

### Count/package material

```text
1 pack = 100 pc
Package cost = ₱120
On hand = 0.5 pack
Normalized stock = 50 pc
Cost = ₱1.20/pc
Inventory value = ₱60.00
```

### Standard liquid material

```text
1 L = ₱400
On hand = 250 mL
Cost = ₱0.40/mL
Inventory value = ₱100.00
```

The integrated workflow also verifies supplier/source search, archive filtering, financial isolation of supplier edits, and calibration-deletion safety.

## 1.6B final regression/build gate

The final gate validates:

- all unit conversion tests;
- material contract and CRUD/application tests;
- costing and inventory tests;
- calibration tests;
- supplier/source tests;
- integrated Phase 1 workflow tests;
- React Materials render smoke test;
- React Calibration render smoke test;
- TypeScript typecheck;
- complete automated test suite;
- production build;
- feature PR CI;
- post-merge `develop` CI.

Validation evidence:

```text
PR #23
Feature CI:          34826926034  SUCCESS
Final PR-head CI:    34827053087  SUCCESS
Merge commit:        ee6953c9e1d132325c77e23cd9e07c859b469dbb
Post-merge CI:       34827137558  SUCCESS
```

---

# Storage Boundary

Phase 1 remains storage-agnostic:

```text
React UI
    ↓
Application Services
    ↓
Domain Models / Calculation Engines
    ↓
Repository / Storage Abstractions
```

Current interactive data is session-scoped through in-memory repositories.

Planned persistence path:

```text
StoragePort
├── ExcelStorage     Phase 5
└── SQLiteStorage    future option
```

---

# Phase 1 Completion Result

**Phase 1 — Materials, Units & Calibration is complete.**

The application now has a validated material foundation for later product recipes, mold-yield learning, multi-component products, production planning, Excel persistence, and desktop packaging.

There are no known Phase 1 blockers remaining at the completion gate.

---

# Next Active Phase

**Phase 2 — Product Recipes & Mold Yield**

Before Phase 2 implementation begins, assess the phase for appropriate implementation subphases and dependencies, then continue using dedicated feature branches, PRs, feature CI, merge validation, and post-merge `develop` CI.
