# Phase 5.3B1 — Hydration Replacement Port & Repository Bulk Replace

## Status

**IMPLEMENTED — AWAITING PR / MERGE VALIDATION**

Parent plan:

`docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION_PLAN.md`

Authoritative implementation base:

```text
develop  3552385ed84deab2500b69cf9e8fbd1538bde1a0
CI       35020396594 — SUCCESS
```

Implementation branch:

`feature/phase-5-3b1-hydration-replacement-port`

## Delivered

Added the persistence-only capability:

```ts
export interface CollectionReplacementPort<T> {
  replaceAll(records: readonly T[]): Promise<void>;
}
```

Location:

`src/application/persistence/CollectionReplacementPort.ts`

All nine authoritative in-memory repositories now implement the compatible whole-collection replacement capability:

```text
InMemoryMaterialRepository
InMemoryCalibrationRepository
InMemoryMixPresetRepository
InMemoryProductRepository
InMemoryYieldSampleRepository
InMemoryFixedRecipeItemRepository
InMemoryProductComponentRepository
InMemoryProductStockRepository
InMemoryProductFinancialProfileRepository
```

Normal repository interfaces and business CRUD semantics remain unchanged.

## Replacement semantics

Each `replaceAll(...)` implementation:

1. treats the supplied records as the complete replacement collection;
2. constructs a new local Map before exposing any state;
3. clones every incoming source record using the same clone boundary already used by that repository;
4. swaps the repository backing Map only after full next-state preparation succeeds;
5. removes stale records absent from the replacement;
6. clears the repository when given an empty collection;
7. preserves repository object identity;
8. preserves trim-aware/case-insensitive repository key lookup while retaining source record text;
9. does not invoke business services, derive defaults, or compute derived outputs.

If replacement preparation fails before the final Map swap, that repository remains unchanged.

## Source ownership and fidelity

Focused coverage confirms replacement defensively owns source state rather than aliasing caller-owned data, including nested source structures where present:

- `Material.source`;
- `MixPreset.compatibleCategories` and `lines`;
- `YieldSample.materialInputs`;
- `ProductFinancialProfile.pricingPolicy`.

Explicit zero/null/false and optional source semantics remain governed by the existing clone/domain contracts.

## Focused validation

Implementation checkpoint:

```text
head  330d71ef8780460a7a6142b669500b30b3589960
CI    35021252337 — SUCCESS
```

Validation result:

```text
89 test files / 1105 tests
9 Phase 5.3B1 focused replacement tests
5 Phase 5.3A snapshot tests
18 Phase 5.2C import tests
13 Phase 5.2B export tests
12 Phase 5.2A codec tests
30 Phase 5.1C dataset validation tests
22 Phase 5.1B workbook schema tests
TypeScript typecheck passed
Production Vite build passed
119 modules transformed
```

Existing non-blocking chunk warning remains:

```text
main JS ~538.78 kB minified
~136.34 kB gzip
```

The change does not implement hydration orchestration or rollback.

## Explicitly not implemented

5.3B1 does not implement:

- complete candidate validation before writes;
- pre-hydration snapshot capture;
- nine-repository hydration sequencing;
- rollback after apply failure;
- rollback failure diagnostics;
- session composition for a hydration service;
- `ExcelStorage.load/save` wiring;
- file backup/atomic filesystem replacement;
- UI or Tauri filesystem behavior.

These remain 5.3B2, 5.3B3, 5.3C, 5.4+, and Phase 6 responsibilities.

## Merge gate

Before 5.3B1 may be marked complete:

1. this documented feature head must pass exact CI;
2. implementation PR CI must pass on the unchanged exact head;
3. guarded merge must use the exact expected feature head SHA;
4. exact post-merge `develop` CI must pass;
5. docs-only closeout must mark 5.3B1 COMPLETE and advance 5.3B2 to NEXT / NOT STARTED;
6. exact post-closeout `develop` CI must pass.
