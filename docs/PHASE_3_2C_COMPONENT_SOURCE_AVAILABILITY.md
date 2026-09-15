# Phase 3.2C — Component Source Availability & Relationship Guards

## Status

**COMPLETE**

Feature branch:

`feature/phase-3-2c-component-source-availability`

Authoritative implementation base:

`develop` @ `b9e7a03ed285486db50fb2c34ab9f3f82b58d41a`

Implementation PR:

`#71 — Phase 3.2C — Component Source Availability & Relationship Guards`

Implementation merge commit:

`8142820762885a4093574ccc7cb48f1f9d0b5661`

Development plan:

`docs/PHASE_3_2C_COMPONENT_SOURCE_AVAILABILITY_PLAN.md`

Validation evidence:

- test-bearing feature CI `34914060282` — SUCCESS;
- final feature-head CI `34914196908` — SUCCESS;
- PR CI `34914254157` — SUCCESS;
- exact post-merge `develop` CI `34914309862` — SUCCESS;
- 44 test files passed;
- 422 tests passed;
- dedicated 3.2C suite: 18 tests;
- TypeScript typecheck passed;
- production build passed.

## Objective

Provide one derived application resolver for current component-source availability across both Phase 3 source kinds while preserving source eligibility and lifecycle relationships.

The implementation does not persist readiness and does not mutate stock/inventory.

## Controlled readiness contract

`ComponentSourceAvailabilityService` exposes one shared status vocabulary:

```text
ready
partial
not-ready
```

Semantics:

- `ready` — source relationship is eligible and current `pc` availability is resolved;
- `partial` — source relationship is valid, but current availability evidence is unresolved/invalid;
- `not-ready` — source relationship itself is missing, inactive, or incompatible.

Every result carries source identity/type, status, `availableQuantity`, canonical `pc` unit, and stable issues. Material results may retain `MaterialOnHandNormalization`; Product results may retain ProductStock or explicit `null` when stock is missing.

This is a derived application view and is not stored in `BusinessDataset`.

## Material-backed availability

Material resolution:

1. resolves Material by identity;
2. requires the source to exist and be active;
3. requires canonical `baseUnit === 'pc'`;
4. retrieves Material calibration evidence;
5. normalizes on-hand quantity through Phase 1 `normalizeMaterialOnHand()`;
6. returns normalized base quantity as available `pc` units.

Successful results preserve full `MaterialOnHandNormalization` evidence, including conversion source/factor and package/calibration evidence where applicable.

Controlled `MaterialInventoryError` and `MaterialCostingError` failures become `partial` availability with underlying codes retained. Negative normalized inventory is treated as corrupted/unresolved `partial` availability.

No costing or inventory valuation is performed merely to answer availability.

## Product-backed availability

Product resolution:

1. resolves child Product by identity;
2. requires the Product to exist and be active;
3. retrieves current ProductStock;
4. validates persisted ProductStock through the 3.2A contract;
5. returns valid ProductStock on-hand quantity as available `pc` units.

Critical distinction:

```text
missing ProductStock -> partial / availableQuantity = null
explicit ProductStock zero -> ready / availableQuantity = 0
```

Archived ProductStock remains historical source data but cannot make an archived child Product eligible for active-parent availability. Corrupted ProductStock becomes controlled `partial` availability with the underlying 3.2A error code retained.

## Availability issue contract

Stable issue codes:

```text
SOURCE_MATERIAL_NOT_FOUND
SOURCE_MATERIAL_INACTIVE
SOURCE_MATERIAL_NOT_COUNT_BASED
SOURCE_MATERIAL_INVENTORY_UNRESOLVED
SOURCE_MATERIAL_NEGATIVE_ON_HAND
SOURCE_PRODUCT_NOT_FOUND
SOURCE_PRODUCT_INACTIVE
SOURCE_PRODUCT_STOCK_MISSING
SOURCE_PRODUCT_STOCK_INVALID
```

## Relationship guards

No duplicate lifecycle guard layer was introduced.

The Phase 3.1C cross-aggregate guard remains authoritative for Material/Product archive and active relationship protection. 3.2C adds regression coverage proving active Material and Product dependencies remain protected while archived-parent historical relationships do not create active guards.

The resolver independently enforces current source eligibility at read time, keeping read-side availability consistent with existing write-time lifecycle rules.

## Shared application session

`src/application/session.ts` now exports:

```text
componentSourceAvailabilityService
materialCalibrationEvidenceProvider
```

MaterialService and the new resolver reuse the same calibration-evidence provider.

## Validation coverage

The 18 dedicated tests cover direct/package/zero Material availability, malformed/inactive/missing Material sources, unresolved/negative inventory, positive/zero/missing/corrupt ProductStock, inactive/missing Product sources, ProductComponent delegation, both active dependency guard kinds, and archived-parent history.

Full validation:

```text
44 test files
422 tests
TypeScript typecheck
production build
```

## Explicit deferrals

Not implemented in 3.2C:

- per-component capacity division;
- assembly capacity calculation;
- limiting-resource selection;
- recursive manufacture assumptions;
- component cost roll-up;
- reservations/deductions/transactions;
- production history;
- UI;
- Excel persistence.

These remain later Phase 3 work or Phase 5.

## Completion gate

**PASSED.**

- implementation PR #71 merged;
- merge commit `8142820762885a4093574ccc7cb48f1f9d0b5661`;
- feature, PR, and exact post-merge `develop` CI are green;
- readiness contract is unified across source types;
- Material normalization evidence is preserved;
- ProductStock zero/missing semantics are preserved;
- active dependency guards remain correct across Material/Product sources.

## Next task

**3.3A — Material-Backed Component Cost — NEXT / NOT STARTED**

Phase 3.2 — Finished Component Stock is complete.