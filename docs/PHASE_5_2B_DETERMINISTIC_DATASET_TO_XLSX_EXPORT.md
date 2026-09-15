# Phase 5.2B — Deterministic Dataset-to-XLSX Export

## Status

**IMPLEMENTED — AWAITING PR / MERGE VALIDATION**

Plan:

`docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT_PLAN.md`

Authoritative implementation base:

```text
develop  3ab084e0370d2f2e26ee14a0a70a79bd21b69042
CI       35004610846 — SUCCESS
```

Implementation branch:

`feature/phase-5-2b-deterministic-dataset-xlsx-export`

## Delivered

Added:

```text
src/storage/businessDatasetWorkbookExport.ts
src/storage/businessDatasetWorkbookExport.test.ts
```

The exporter now provides:

```ts
createBusinessDatasetWorkbookDocument(dataset, metadata)
exportBusinessDatasetToXlsx(dataset, metadata, codec)
```

### Export pipeline

```text
BusinessDataset
  -> validateBusinessDatasetIntegrity(...)
  -> canonical WorkbookNeutralDocument
  -> assertWorkbookSchema(...)
  -> WorkbookCodec.encode(...)
  -> Uint8Array XLSX bytes
```

### Source-data behavior

The exporter writes all 13 canonical workbook sheets and persists authoritative source evidence only.

It maps:

- Materials including flattened optional supplier/source metadata;
- Material calibration evidence;
- MixPreset parent rows;
- MixPreset categories and lines into normalized child sheets;
- Products;
- YieldSample parent rows;
- YieldSample material inputs into normalized child rows;
- fixed recipe items;
- Product components;
- explicit ProductStock rows;
- ProductFinancialProfiles with flattened nullable pricing policy.

Derived costs, conversion outputs, learned yield outputs, capacity, selling prices, profit, revenue, and other recalculable results are not exported.

### Metadata

`_Meta` is always first and contains:

```text
formatId               craft-business-manager
workbookFormatVersion  1
datasetSchemaVersion   dataset.schemaVersion
exportedAt              explicitly supplied ISO-compatible text
applicationVersion      optional explicitly supplied text
```

The exporter contains no ambient clock. `exportedAt` is provided by the caller.

### Deterministic ordering

Sheet/column order comes directly from the Phase 5.1B workbook schema registry.

Row ordering consumes each sheet's existing `rowOrder` metadata and supports:

- trim-aware case-insensitive identity ordering with exact-string tie-break;
- exact text ordering;
- numeric ordering;
- timestamp ordering without locale display formatting.

Top-level source arrays may arrive in different orders and still map to the same canonical neutral workbook.

Child source-array order remains authoritative and is represented by 1-based:

```text
categoryOrder
lineOrder
inputOrder
```

### Controlled failure boundary

Added `BusinessDatasetWorkbookExportError` with stable categories:

```text
INVALID_DATASET
INVALID_EXPORT_METADATA
INVALID_GENERATED_WORKBOOK
```

Invalid datasets fail before the codec is invoked and preserve the structured Phase 5.1C dataset issues.

Generated neutral workbooks are self-validated with `assertWorkbookSchema(...)` before XLSX byte encoding.

### Fidelity and safety

Verified:

- explicit numeric zero survives;
- explicit boolean false survives;
- missing ProductStock/profile rows remain missing;
- `pricingPolicy = null` produces blank flattened pricing fields;
- high-precision finite source numbers are not business-rounded;
- source ISO timestamps remain text;
- formula-looking source text remains literal through real SheetJS XLSX encode/decode;
- the exporter does not mutate the input dataset or nested source arrays.

## Focused validation

First implementation checkpoint:

```text
head       a1811b499dd065d9c4f7783708f1c74abd92699d
CI         35007528923 — SUCCESS
```

Exact validation result:

```text
86 test files / 1073 tests
13 Phase 5.2B focused tests
12 Phase 5.2A real-XLSX codec tests
30 Phase 5.1C dataset validation tests
22 Phase 5.1B workbook schema tests
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

The existing non-blocking main-chunk warning remains unchanged at approximately:

```text
537.95 kB minified
136.60 kB gzip
```

The 5.2B exporter is not currently reachable from the React application path, so this phase did not increase the production application chunk count/module count.

## Explicitly not implemented

5.2B does not implement:

- workbook-to-dataset reconstruction;
- malformed external workbook import diagnostics;
- orphan/duplicate child reconstruction handling;
- migrations;
- repository snapshot/hydration;
- `ExcelStorage.load/save` runtime wiring;
- browser open/save dialogs;
- backup/atomic replacement;
- Tauri filesystem behavior;
- persistence UI.

Those remain assigned to 5.2C and later Phase 5/6 tasks.

## Merge gate

Before 5.2B may be marked complete:

1. this documented feature head must pass exact CI;
2. implementation PR CI must pass on the unchanged exact head;
3. guarded merge must use that exact expected head SHA;
4. exact post-merge `develop` CI must pass;
5. a docs-only closeout must mark 5.2B COMPLETE and advance 5.2C to NEXT / NOT STARTED;
6. exact post-closeout `develop` CI must pass.
