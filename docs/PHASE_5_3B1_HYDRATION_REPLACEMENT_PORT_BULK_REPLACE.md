# Phase 5.3B1 — Hydration Replacement Port & Repository Bulk Replace

## Status

**COMPLETE**

Parent plan:

`docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION_PLAN.md`

Authoritative implementation base:

```text
develop  3552385ed84deab2500b69cf9e8fbd1538bde1a0
CI       35020396594 — SUCCESS
```

## Delivered

Added the persistence-only whole-collection replacement capability:

```ts
export interface CollectionReplacementPort<T> {
  replaceAll(records: readonly T[]): Promise<void>;
}
```

Location:

`src/application/persistence/CollectionReplacementPort.ts`

All nine authoritative in-memory repositories implement the capability:

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

Normal repository CRUD contracts remain unchanged.

## Replacement semantics

Each repository now:

1. treats the supplied records as the complete replacement collection;
2. prepares a new local `Map` before changing live state;
3. clones every incoming source record using its established clone boundary;
4. swaps the backing `Map` only after preparation succeeds;
5. removes stale records absent from the replacement;
6. clears the repository for an empty replacement collection;
7. preserves repository object identity;
8. preserves trim-aware/case-insensitive lookup semantics without rewriting source IDs;
9. invokes no business CRUD service, defaulting rule, or derived computation.

A preparation failure before the final `Map` swap leaves that repository unchanged.

## Source ownership and fidelity

Focused coverage confirms defensive ownership of nested source data including:

- `Material.source`;
- `MixPreset.compatibleCategories` and `lines`;
- `YieldSample.materialInputs`;
- `ProductFinancialProfile.pricingPolicy`.

Explicit zero/null/false and optional-source semantics remain governed by existing domain/clone contracts.

## Validation evidence

First implementation checkpoint:

```text
head  330d71ef8780460a7a6142b669500b30b3589960
CI    35021252337 — SUCCESS
```

Documented feature head:

```text
head  74e70a22b2a8b24cd1cb49f44f37502a1555b53b
CI    35021376680 — SUCCESS
```

Implementation PR and merge:

```text
PR #152                    MERGED
PR CI                      35021553326 — SUCCESS
Implementation merge       6abd24123c3593582fdc4767bd486b319fc2ce2c
Post-merge develop CI      35021692593 — SUCCESS
```

Regression state:

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

Existing non-blocking bundle warning:

```text
main JS ~538.78 kB minified
~136.34 kB gzip
```

## Explicitly not implemented

5.3B1 intentionally does not implement:

- complete candidate validation before writes;
- pre-hydration snapshot capture;
- nine-repository hydration sequencing;
- rollback after apply failure;
- rollback-failure diagnostics;
- hydration session composition;
- `ExcelStorage.load/save` wiring;
- backup/atomic filesystem replacement;
- persistence UI or Tauri filesystem behavior.

These remain 5.3B2, 5.3B3, 5.3C, 5.4+, and Phase 6 responsibilities.

## Completion result

5.3B now has the structural mutation primitive required for safe whole-dataset hydration without replacing repository instances or replaying business CRUD workflows.

**Next task: 5.3B2 — Validated Atomic Hydration + Rollback — NEXT / NOT STARTED.**
