# Phase 1.2A — Material Contract & Classification

## Status

**COMPLETE**

Branch: `feature/phase-1-2a-material-contract`

Base: `develop`

## Objective

Establish the authoritative source-data contract for purchased and stocked craft materials before CRUD services, UI, costing, inventory normalization, calibration, supplier metadata, and Excel persistence are added.

## Material groups

The system recognizes:

- `plaster`
- `wax`
- `liquid`
- `fragrance`
- `colorant`
- `wick`
- `container`
- `paint`
- `packaging`
- `accessory`
- `other`

Runtime parsing/validation is available through `isMaterialGroup()` and `parseMaterialGroup()`.

## Material source-data contract

A material record stores source inputs:

- stable `id`
- `name`
- `group`
- canonical `baseUnit` (`g`, `mL`, or `pc`)
- purchase quantity
- purchase unit
- package cost
- optional manual base-units-per-purchase-unit input
- user-entered on-hand quantity
- user-entered on-hand unit
- optional notes
- active/inactive state

## Standard units vs package labels

Standard measurement units continue to come from the Phase 1.1 unit catalog.

Phase 1.2A also introduces package labels for purchased materials:

- `bag`
- `bottle`
- `box`
- `can`
- `jar`
- `pack`
- `pouch`
- `roll`
- `set`
- `sheet`
- `spool`
- `tube`

A purchase/on-hand unit can therefore be either a standard measurement unit or one of these package labels.

Package labels do not receive invented universal conversions. Phase 1.3 will decide when a manual package conversion is required and how standard/manual conversion precedence works.

## Derived values removed from authoritative Material data

The previous provisional `Material` interface stored:

- `baseUnitsPerPurchaseUnit`
- `onHandBaseQuantity`
- `gramsPerCup`

These are removed from the authoritative material record because they are derived values.

Later phases calculate them from source inputs:

- Phase 1.3 calculates package conversion, cost per base unit, and normalized inventory
- Phase 1.4 calculates material-specific cup-to-weight calibration such as grams per cup

This prevents stale spreadsheet-style cached values from becoming the source of truth.

## Structural validation

`validateMaterialContract()` enforces contract/classification rules:

- material ID is present
- material name is present
- material group is supported
- base unit is canonical
- purchase and on-hand units are recognized
- standard purchase/on-hand units match the material base-unit dimension

Numeric costing/inventory rules are intentionally deferred to their own phases. Package cost validation, negative stock rules, missing manual package conversion, and effective conversion calculation belong to Phase 1.3.

## Examples

Weight material:

```text
Plaster of Paris
base unit: g
purchase: 1 kg
package cost: ₱66
on hand: 0.5 kg
```

Count material:

```text
Cotton Wick
base unit: pc
purchase: 100 pc
package cost: ₱80
on hand: 40 pc
```

Manual package source input:

```text
Product Label
base unit: pc
purchase: 1 pack
manual conversion source input: 100 pc / pack
```

Phase 1.3 will use that input to calculate effective conversion and cost per piece.

## Validation evidence

- TypeScript typecheck passed
- material-domain tests passed
- full automated test suite passed
- production build passed
- feature PR CI passed

Final integration gate: merge PR #7 to `develop` and confirm post-merge `develop` CI.

## Out of scope

- CRUD services
- React materials screen
- effective conversion precedence
- package/base-unit costing
- normalized stock calculation
- inventory valuation
- calibration/density
- supplier/source metadata model
- Excel persistence

## Next task

After final post-merge validation, proceed to **1.2B — Material Application CRUD Services**.
