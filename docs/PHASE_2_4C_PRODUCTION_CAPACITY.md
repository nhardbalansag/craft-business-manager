# Phase 2.4C — Producible Pieces & Limiting Material

## Status

**COMPLETE — MERGED + POST-MERGE CI PASSED**

Implementation PR: **#48**

Implementation merge commit: `e9a6bbffd36d6aed29d7660fabee8845252ab5fb`

Post-merge CI: **34841719987 — SUCCESS**

## Objective

Combine Phase 2.4B waste-adjusted per-product material requirements with current normalized Phase 1 inventory to determine how many finished products can be produced from direct materials and which material(s) limit production.

## Core formula

For each required material:

```text
material capacity
= floor(normalized on-hand base quantity / waste-adjusted base quantity per product)
```

Overall direct-material capacity:

```text
producible pieces
= minimum material capacity across all required materials
```

Every material tied at the minimum is reported as limiting.

Example:

```text
plaster capacity = 12
water capacity   = 10
brush capacity   = 8

producible pieces = 8
limiting material = brush
```

Tie example:

```text
plaster capacity = 8
brush capacity   = 8
water capacity   = 10

producible pieces = 8
limiting materials = plaster, brush
```

## Inventory source

2.4C reuses Phase 1 `normalizeMaterialOnHand()` as the authoritative inventory normalization path.

Current stock may resolve through:

- standard same-dimension conversion;
- material calibration for dry `cup -> g`;
- manual cup-to-weight fallback where explicitly configured;
- configured purchase-package conversion.

The capacity result preserves the inventory conversion source and calibration identity where applicable.

## Readiness policy

The service exposes `ready`, `partial`, and `not-ready` states.

### Ready

A final capacity is published only when:

- upstream Phase 2.4B requirements are `ready`;
- every required material exists;
- active products do not depend on archived required materials;
- every required material's current inventory can be normalized;
- material base units agree with the production requirements.

### Partial

When at least one required material can be evaluated but another required inventory/upstream requirement is unresolved:

- known per-material capacities may be shown for diagnosis;
- `produciblePieces` is `null`;
- no material is labeled as the final limiter.

This prevents a partial inventory picture from being mistaken for a reliable production ceiling.

### Not ready

When no usable requirement/capacity line exists, capacity is not published.

## Inventory edge cases

- zero stock is valid and produces capacity `0`;
- negative normalized stock is rejected as a controlled inventory issue;
- missing material records produce a controlled issue;
- unresolved cup/package conversion produces a controlled issue;
- fractional base-unit inventory retains precision before floor division;
- capacity never becomes negative.

## Deterministic limiting-material behavior

The pure domain engine:

- rejects duplicate material capacity inputs;
- calculates integer capacity by floor division;
- selects the minimum capacity;
- marks every material tied at that minimum;
- sorts limiting material IDs deterministically.

## Application boundary

Delivered:

- `src/domain/productionCapacity.ts`
- `src/domain/productionCapacity.test.ts`
- `src/application/production/ProductionCapacityService.ts`
- `src/application/production/ProductionCapacityService.test.ts`
- shared-session wiring through `productionCapacityService`.

`ProductionCapacityService` combines:

1. Phase 2.4B `ProductionRequirementService` using a zero-quantity plan to obtain waste-adjusted per-product requirements;
2. Phase 1 `MaterialRepository` current material records;
3. Phase 1 `CalibrationRepository` evidence;
4. Phase 1 `normalizeMaterialOnHand()`.

## Important Phase 3 boundary

Phase 2.4C calculates **direct-material capacity only**.

Phase 3 remains responsible for extending the limiting-capacity calculation with:

- purchased vessels;
- molded product components;
- nested components;
- multiple vessel/component quantities per finished product.

## Validation evidence

The completion gate passed:

- standard inventory capacity tests;
- calibrated cup-stock capacity tests;
- zero-stock tests;
- tied limiting-material tests;
- missing/unresolvable inventory readiness tests;
- partial upstream requirement protection;
- active-product/archived-material protection;
- Phase 3 component scope exclusion;
- full regression suite;
- TypeScript typecheck;
- production build;
- feature PR merge;
- post-merge `develop` CI.

## Explicitly deferred

2.4C does **not**:

- add Product/Yield/Production UI — Phase 2.5;
- include vessel/component capacity — Phase 3;
- alter inventory quantities;
- reserve stock or create production orders;
- introduce selling-price/profit behavior.

## Next task

**2.5A — Products & Mix Presets UI**
