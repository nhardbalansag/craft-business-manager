# Phase 5.1A — Persisted Dataset Source Inventory & Contract Completeness

## Status

**IMPLEMENTED + FEATURE-HEAD VALIDATED — PR PENDING**

## Authoritative starting point

```text
develop     5cf12188b8ec2d727aa5debe6a131a10168244ab
CI          34984709583 — SUCCESS
```

Dedicated plan:

`docs/PHASE_5_1A_PERSISTED_DATASET_SOURCE_INVENTORY_CONTRACT_COMPLETENESS_PLAN.md`

Plan-before-code commit:

`26ef1a887c75cd1cd648c1884cc1d24be968ddcd`

Feature branch:

`feature/phase-5-1a-dataset-source-completeness`

## Delivered contract

### Complete authoritative persisted source inventory

`BusinessDataset` now contains all nine authoritative Phase 1–4 source collections:

```text
materials
materialCalibrations
mixPresets
products
yieldSamples
recipeItems
productComponents
productStocks
productFinancialProfiles
```

The previously omitted `CalibrationRepository` source evidence is now represented as:

```ts
materialCalibrations: MaterialCalibrationEvidence[]
```

`MaterialCalibrationEvidence` is also re-exported through the shared domain type surface.

No Settings collection was invented because no authoritative Settings source model currently exists.

### Dataset v1 semantics

Added:

```text
CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1
```

Version 1 is the first formally specified complete persisted business-source dataset. There was no released authoritative workbook before Phase 5, so the calibration addition establishes the complete v1 contract rather than migrating an earlier persisted workbook schema.

### Formal source-collection inventory

Added the ordered constant:

```text
BUSINESS_DATASET_SOURCE_COLLECTION_KEYS
```

covering exactly the nine authoritative source collections above.

Derived calculations remain intentionally outside the persisted dataset, including material costing/valuation, learned yield, production requirements, component/fully-loaded costs, capacity, pricing, revenue, and profit.

### Controlled top-level completeness validation

Added `assertBusinessDatasetCompleteness(...)` with controlled `BusinessDatasetCompletenessError` diagnostics for:

```text
INVALID_DATASET
INVALID_SCHEMA_VERSION
UNSUPPORTED_SCHEMA_VERSION
MISSING_SOURCE_COLLECTION
INVALID_SOURCE_COLLECTION
```

5.1A validates only the complete persisted-dataset envelope. It deliberately does not perform source-row domain validation, duplicate identity/reference validation, or Product graph/cycle validation; those remain 5.1C responsibilities.

### Canonical empty dataset

Added `createEmptyBusinessDataset()` returning current schema v1 with all nine source arrays present and empty.

It does not synthesize placeholder ProductStock, ProductFinancialProfile, calibration, or other source records.

### Defensive cloning and normalization

Added:

```text
cloneBusinessDataset(...)
normalizeBusinessDataset(...)
```

The clone boundary creates independent ownership for:

- every top-level collection;
- Material source metadata;
- material calibration evidence;
- MixPreset compatible categories and lines;
- YieldSample material inputs;
- ProductFinancialProfile pricing policy;
- all remaining source records.

`normalizeBusinessDataset(...)` means complete-envelope validation plus defensive cloning only. It does not trim/repair source-row values or invent defaults.

### Missing versus explicit zero preservation

Focused tests prove:

- missing ProductStock remains no row;
- explicit `onHandQuantity: 0` remains an explicit source row;
- missing ProductFinancialProfile remains no row;
- explicit zero labor/overhead remains an explicit configured profile;
- `pricingPolicy: null` remains explicitly unconfigured;
- calibration evidence survives dataset normalization/cloning.

## Test coverage

New focused suite:

`src/domain/businessDataset.test.ts`

Coverage includes:

1. exact nine-source inventory;
2. complete empty dataset;
3. complete dataset with calibration evidence;
4. missing calibration collection rejection;
5. non-array collection rejection;
6. invalid/unsupported schema versions;
7. nested defensive cloning;
8. no silent source-row repair;
9. missing evidence preservation;
10. explicit-zero/null-policy preservation.

An existing `ProductFinancialProfile` BusinessDataset fixture was updated to include `materialCalibrations: []`, reflecting the new complete compile-time contract.

## Validation history

### First implementation checkpoint — failed as designed

Feature head:

`61728a3e62d58afa291b57e02fa288836801fda3`

CI:

`34985582449 — FAILURE`

TypeScript correctly identified one existing test fixture that still instantiated the old eight-collection `BusinessDataset`:

```text
src/domain/productFinancialProfile.test.ts
Property 'materialCalibrations' is missing ... but required in type 'BusinessDataset'.
```

No tests/build ran after the typecheck failure.

Correction:

- updated that historical fixture with `materialCalibrations: []`;
- no runtime/domain/application behavior was weakened.

### Corrected validated feature head

```text
head        d9a87c7714e69dc0584a86dbb20f282dbeadaa4d
CI          34985739279 — SUCCESS
```

Exact CI evidence:

```text
TypeScript typecheck PASS
82 test files PASS
996 tests PASS
10 Phase 5.1A BusinessDataset tests PASS
8 React workspace smoke tests remain PASS
7 Phase 4.6A integration tests remain PASS
production Vite build PASS
117 modules transformed
```

Existing non-blocking build note remains:

```text
main JS chunk ~537.87 kB after minification (>500 kB warning)
```

This remains a later performance/code-splitting concern and is unrelated to 5.1A correctness.

## Files changed by implementation

```text
docs/PHASE_5_1A_PERSISTED_DATASET_SOURCE_INVENTORY_CONTRACT_COMPLETENESS_PLAN.md
src/domain/types.ts
src/domain/businessDataset.ts
src/domain/businessDataset.test.ts
src/domain/productFinancialProfile.test.ts
```

This implementation record is added after feature-head validation.

## Explicit exclusions confirmed

5.1A introduced no:

- XLSX dependency;
- workbook sheet/column schema;
- XLSX encoder/decoder;
- workbook parser;
- repository snapshot/hydration coordinator;
- backup/atomic transport;
- persistence UI;
- Tauri filesystem/dialog behavior;
- changes to Phase 1–4 calculation formulas.

## Completion state

The 5.1A implementation itself satisfies the feature-level acceptance criteria and is ready for PR validation.

It must not be marked roadmap-complete until:

1. this documented feature head passes CI;
2. the PR to `develop` passes dedicated PR CI;
3. the exact feature head is guarded-merged;
4. exact merged `develop` CI passes;
5. the Phase 5 progress tracker is reconciled in a documentation-only closeout.

After those gates, **5.1B — Workbook Schema / Sheet / Column Contracts** may become NEXT, but must not start automatically.
