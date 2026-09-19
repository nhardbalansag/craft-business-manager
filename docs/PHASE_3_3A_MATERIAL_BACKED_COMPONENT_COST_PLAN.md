# Phase 3.3A — Material-Backed Component Cost Development Plan

## Status

**COMPLETE**

Authoritative base:

`develop` @ `403146275dfe4d6eee2a61c16de00c7a93c17f79`

Feature branch:

`feature/phase-3-3a-material-backed-component-cost`

Implementation PR:

`#73`

Implementation merge commit:

`f4fa4c7e287f24e9732cc1e2055edea4142873f5`

Implementation record:

`docs/PHASE_3_3A_MATERIAL_BACKED_COMPONENT_COST.md`

## Objective

Derive the current cost of one material-backed ProductComponent line by reusing the authoritative Phase 1 Material package-cost engine.

Per line, 3.3A provides:

- source Material identity/name;
- quantity required per parent;
- cost per canonical `pc`;
- component cost contribution per parent;
- package/conversion traceability;
- controlled cost readiness/issues.

The result is derived application data only. No derived cost is persisted.

## Split assessment

No deeper formal split was required. 3.3A remained one cohesive task.

## Scope boundary

3.3A is **material-backed component line costing only**.

Explicitly excluded:

- Product-backed recursive cost;
- child Product cost trees;
- total Product component cost aggregation;
- Phase 2 + Phase 3 cost synthesis;
- assembly capacity and limiting-resource math;
- reservations/deductions/stock transactions;
- labor, overhead, selling price, markup, margin, profit;
- UI;
- Excel persistence.

These remain 3.3B+, 3.4+, Phase 4, 3.5, or Phase 5.

## Source eligibility and 3.2C reuse

`ComponentSourceAvailabilityService` remains the canonical read-time source-eligibility resolver.

Implemented policy:

- `not-ready` availability blocks costing because the Material source is missing, inactive, or non-count-based;
- `ready` availability permits costing;
- `partial` availability also permits costing to continue because stock/on-hand readiness is distinct from cost-basis readiness.

This prevents current stock quantity or damaged on-hand evidence from incorrectly changing an otherwise valid purchase-cost basis.

## Cost mathematics

```text
component unit cost
= Phase 1 Material cost per canonical base pc

component contribution per parent
= component unit cost × ProductComponent.quantityPerParent
```

Phase 1 `calculateMaterialPackageCosting()` is the sole Material package-cost engine. 3.3A does not reimplement conversion precedence.

## Derived result

Implemented:

```text
MaterialBackedComponentCostLine
- componentId
- parentProductId
- role
- sourceMaterialId
- sourceMaterialName: string | null
- quantityPerParent
- status: ready | not-ready
- costPerPc: number | null
- componentCostContribution: number | null
- costingTrace: MaterialBackedComponentCostTrace | null
- sourceAvailability
- issues[]
```

A single line is either costable (`ready`) or not costable (`not-ready`). Product-level `partial` aggregation remains 3.3C.

## Traceability

Ready lines preserve Phase 1 package-cost evidence, including package source inputs, standard/manual/calibration factors, effective conversion, package base quantity, and calibration ID.

## Controlled issues

Implemented stable issue codes:

```text
INVALID_COMPONENT
NOT_MATERIAL_BACKED_COMPONENT
SOURCE_MATERIAL_NOT_READY
SOURCE_MATERIAL_NOT_FOUND
MATERIAL_COST_NOT_DERIVABLE
DERIVED_COST_INVALID
```

Underlying ProductComponent, availability, MaterialCosting, or calibration codes are retained when available.

## Application/session implementation

Added:

`src/application/productComponents/MaterialBackedComponentCostService.ts`

Shared session instance:

`materialBackedComponentCostService`

Reuses:

- `materialRepository`;
- `componentSourceAvailabilityService`;
- `materialCalibrationEvidenceProvider`.

No repository or BusinessDataset source collection was added.

## Validation

Dedicated suite: **16 tests**.

Final validation evidence:

```text
Test-bearing feature CI: 34915288037 — SUCCESS
Final feature-head CI:    34915430857 — SUCCESS
PR #73 CI:                34915488170 — SUCCESS
Post-merge develop CI:    34915579217 — SUCCESS

45 test files passed
438 tests passed
TypeScript typecheck passed
production build passed
```

## Completion gate

All planning and implementation gates passed:

- Phase 1 costing is the sole Material cost engine;
- source identity/name, quantity, cost per pc, and contribution are exposed;
- package/conversion traceability is preserved;
- 3.2C eligibility is reused;
- partial stock availability does not incorrectly block cost readiness;
- Product-backed components remain out of scope;
- unresolved cost basis produces controlled issues;
- no derived cost is persisted;
- shared application-session wiring exists;
- focused/full tests, TypeScript typecheck, and build pass;
- PR #73 merged to `develop`;
- exact post-merge CI `34915579217` passed on `f4fa4c7e287f24e9732cc1e2055edea4142873f5`.

## Next task

**3.3B — Recursive Product-Backed Component Cost — NEXT / NOT STARTED**

Do not begin 3.3B until its own dedicated development plan/scope review is established.
