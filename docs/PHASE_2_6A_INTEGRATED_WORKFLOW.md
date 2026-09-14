# Phase 2.6A — Integrated Product / Yield / Production Workflow

## Status

**IMPLEMENTED — VALIDATION / MERGE GATE**

Feature branch: `feature/phase-2-6a-integrated-workflow`

Implementation PR: **#56**

## Objective

Validate the complete Phase 2 direct-material workflow as one application path rather than as isolated domain/service features.

The integration gate covers:

```text
material + calibration masters
        ↓
mix preset + product
        ↓
real yield evidence
        ↓
latest derivable yield learning
        ↓
fixed recipe items
        ↓
effective canonical requirements
        ↓
direct-material cost preview
        ↓
safety-waste planning
        ↓
planned batch requirements
        ↓
current inventory capacity + limiting materials
```

## Integrated plaster-art scenario

The regression suite builds the planned Phase 2 plaster-art example from scratch:

```text
Product
Small Paintable Star — paintable-art
Safety waste = 5%

Mix preset
plaster : water = 2 : 1 by volume

Calibration
5 cups plaster = 1 kg
=> 200 g/cup

Real sample
plaster = 3 cups
water = 1.5 cups
good = 8
rejected = 1

Fixed recipe
paint = 2 mL / product
brush = 1 pc / product
```

Derived effective requirements are verified as:

```text
plaster = 75 g / product
water   = 45 mL / product
paint   = 2 mL / product
brush   = 1 pc / product
```

The direct-material cost preview is verified against Phase 1 purchase costing, and current inventory is then used to derive per-material and overall production capacity.

## Integration gap found and fixed — indivisible count materials

The original Phase 2 planning specification explicitly required a safe policy for indivisible count materials such as brushes and wicks.

Before 2.6A, the waste-adjusted planning engine preserved the correct mathematical result but could expose a fractional physical batch requirement:

```text
1 brush / product
× 1.05 safety-waste multiplier
× 8 products
= 8.4 brushes
```

A real batch cannot prepare `8.4` brushes.

### Finalized policy

Phase 2 now applies this rule:

- preserve the precise mathematical per-product requirement;
- preserve precise source-contribution quantities;
- do **not** round every per-product count;
- round **only the final total physical batch requirement upward** for base unit `pc`.

Therefore:

```text
planned per product = 1.05 pc
precise contribution for 8 products = 8.4 pc
physical batch requirement = 9 pc
```

Weight and volume quantities remain continuous and are not rounded by this rule.

This preserves the safety-waste policy without drastically overstating count-material waste.

## Production cost reconciliation hardening

The Production workspace previously calculated its summary batch cost by multiplying the mathematical waste-adjusted per-product cost by the planned quantity.

That would understate a batch containing rounded indivisible count materials.

2.6A now calculates the displayed physical batch material cost from each material's actual `plannedBatchBaseQuantity × costPerBaseUnit`.

The batch-cost summary is published only when the full requirement set has a ready cost basis.

For the integrated 8-piece plaster-art example:

```text
plaster = 630 g
water   = 378 mL
paint   = 16.8 mL
brush   = 9 pc
```

The physical direct-material batch cost is therefore based on all four physical batch quantities, including 9 whole brushes.

## Capacity verification

The integration scenario uses current inventory:

```text
plaster = 700 g
water   = 1000 mL
paint   = 100 mL
brush   = 10 pc
```

With the 5% safety reserve, the verified capacities are:

```text
plaster = 8 products
water   = 21 products
paint   = 47 products
brush   = 9 products
```

Therefore:

```text
producible pieces = 8
limiting material = plaster
```

## Effective-yield fallback verification

The integration suite also validates Phase 2.2C through the downstream production stack.

Scenario:

1. an older calibration-dependent cup sample exists;
2. a newer sample recorded in canonical units is valid without calibration;
3. an even newer cup sample becomes non-derivable after the plaster calibration is removed;
4. the system selects the latest older derivable sample instead of failing or averaging history.

The downstream requirement, cost, planning, and capacity services remain ready and identify:

```text
effective sample = YS-STAR-002
skipped invalid newer sample = YS-STAR-003
```

The resulting capacity test also verifies deterministic tied limiting materials.

## Safety boundaries retained

2.6A does not add:

- purchased vessels or molded/nested product components — Phase 3;
- component-limited production capacity — Phase 3;
- selling price, markup, margin, or profit — Phase 4;
- inventory reservation or stock deduction;
- persisted production estimates.

## Validation coverage

Feature validation requires:

- TypeScript typecheck;
- all existing Phase 1/2 domain/application regressions;
- dedicated Phase 2 integrated workflow tests;
- React smoke tests including Production;
- production build;
- PR #56 merge;
- post-merge `develop` CI.

Initial feature-head CI passed before this documentation update.

## Next task after completion

**2.6B — Regression, Build & Phase 2 Completion Validation**
