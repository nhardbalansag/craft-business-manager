# Phase 5.2C — Strict XLSX-to-Dataset Import & Diagnostics

## Status

**IMPLEMENTED — AWAITING PR / MERGE VALIDATION**

Plan:

`docs/PHASE_5_2C_STRICT_XLSX_TO_DATASET_IMPORT_DIAGNOSTICS_PLAN.md`

Authoritative implementation base:

```text
develop  477a6057f9cd5af2dd57790db8ab288f64ad202e
CI       35010173946 — SUCCESS
```

Implementation branch:

`feature/phase-5-2c-strict-xlsx-dataset-import`

## Delivered

Added:

```text
src/storage/businessDatasetWorkbookImport.ts
src/storage/businessDatasetWorkbookImport.test.ts
```

Public import boundaries:

```ts
reconstructBusinessDatasetFromWorkbook(document)
importBusinessDatasetFromXlsx(bytes, codec)
```

The importer returns a discriminated success/failure result. It never returns an accepted dataset together with blocking issues.

### Import pipeline

```text
XLSX bytes
  -> WorkbookCodec.decode(...)
  -> validateWorkbookSchema(...)
  -> current metadata validation
  -> reconstruct all nine BusinessDataset source collections
  -> reconstruct normalized child arrays
  -> child orphan/order integrity
  -> validateBusinessDatasetIntegrity(...)
  -> accepted BusinessDataset + workbook metadata
```

### Structured diagnostics

Import diagnostics preserve an explicit stage:

```text
codec
schema
metadata
reconstruction
dataset
```

Issues may include sheet, row, Excel row, column, domain path, and safe input context. Ordering is deterministic by stage, canonical sheet order, row, location, code, and message.

Codec exceptions such as `XLSX_DECODE_FAILED` are converted to import issues rather than escaping as the only failure signal.

Existing Phase 5.1B schema issue codes and Phase 5.1C dataset issue codes are preserved where applicable.

### Metadata

Successful import returns workbook metadata separately from `BusinessDataset`:

```text
formatId
workbookFormatVersion
datasetSchemaVersion
exportedAt
applicationVersion?
```

`exportedAt` must be nonblank ISO-compatible text.

The importer is current-version only. Existing 5.1B structural validation enforces the current workbook format and dataset schema versions. Migration remains Phase 5.4A.

### Source reconstruction

Implemented reconstruction for all nine authoritative collections:

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

Source fidelity behavior:

- blank optional text reconstructs to absence;
- explicit numeric zero remains zero;
- explicit boolean false remains false;
- high-precision finite numbers are not rounded;
- timestamps remain text;
- missing ProductStock/profile rows stay missing;
- Material source metadata is rebuilt only when at least one source field exists;
- blank pricing method/value rebuild `pricingPolicy = null`;
- populated pricing method/value rebuild the explicit policy, including value `0`.

### Child reconstruction

Reconstructs:

```text
MixPresetCategories -> MixPreset.compatibleCategories
MixPresetLines      -> MixPreset.lines
YieldSampleInputs   -> YieldSample.materialInputs
```

Parent matching uses trim-aware case-insensitive identity while retaining the authoritative parent ID.

For each parent, child order must be the exact sequence:

```text
1, 2, 3, ... N
```

Controlled reconstruction issues include:

```text
ORPHAN_CHILD_ROW
DUPLICATE_CHILD_ORDER
INVALID_CHILD_ORDER_SEQUENCE
RECONSTRUCTION_FAILED
```

Physical worksheet row order does not define nested source order; explicit workbook-only order fields do.

### Final semantic gate

Every reconstructed candidate passes through:

```text
validateBusinessDatasetIntegrity(...)
```

The importer does not duplicate Phase 5.1C domain rules for duplicate identities, durable references, source-record contracts, or Product graph integrity.

No repository/session/hydration mutation exists in 5.2C.

## Focused validation

First implementation checkpoint:

```text
head  303b407e264ec044050ae83cd88f0765de57cb5b
CI    35011783520 — FAILURE
```

Cause:

- strict TypeScript inferred a test-created typed-array backing buffer slice as `ArrayBuffer | SharedArrayBuffer`;
- `WorkbookBinaryInput` intentionally remains `Uint8Array | ArrayBuffer`.

Fix:

- allocate an explicit `ArrayBuffer` in the focused ArrayBuffer-path test;
- no production import contract or validation rule changed.

Corrected implementation checkpoint:

```text
head  7be98fd98bf54fd16364b670122a1dd54925e9c0
CI    35011990682 — SUCCESS
```

Validation result:

```text
87 test files / 1091 tests
18 Phase 5.2C focused tests
13 Phase 5.2B export tests
12 Phase 5.2A real-XLSX codec tests
30 Phase 5.1C dataset validation tests
22 Phase 5.1B workbook schema tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

The existing non-blocking bundle warning remains approximately:

```text
537.95 kB minified
136.60 kB gzip
```

5.2C is not wired into the React application entry path or `ExcelStorage`, so the application bundle/module count remains unchanged.

## Focused test matrix

The 18 dedicated tests cover:

- full real-XLSX export/import semantic round-trip;
- `ArrayBuffer` input;
- controlled codec failure translation;
- real XLSX missing-sheet schema rejection;
- formula-cell rejection before reconstruction;
- invalid `exportedAt` metadata;
- Material source reconstruction and absence;
- explicit zero and null pricing policy semantics;
- physical child-row shuffling with explicit-order reconstruction;
- trim-aware case-insensitive child-parent matching;
- orphan child rejection;
- duplicate child order rejection;
- gapped order rejection;
- non-1-starting order rejection;
- final Phase 5.1C missing-reference diagnostics;
- one-sided pricing-field schema rejection;
- formula-looking literal text through real XLSX bytes;
- neutral-document non-mutation.

## Explicitly not implemented

5.2C does not implement:

- live repository hydration;
- `ExcelStorage.load/save` runtime wiring;
- repository snapshot orchestration;
- schema migration of older workbook versions;
- complete hostile-workbook byte/row/resource limits;
- backup/atomic replacement;
- browser persistence UI;
- Tauri filesystem/dialog behavior.

Those remain Phase 5.3+, 5.4, 5.5, and Phase 6 responsibilities.

## Merge gate

Before 5.2C may be marked complete:

1. this documented feature head must pass exact CI;
2. implementation PR CI must pass on the unchanged exact head;
3. guarded merge must use the exact expected feature head SHA;
4. exact post-merge `develop` CI must pass;
5. a docs-only closeout must mark 5.2C COMPLETE, close Phase 5.2, and advance 5.3A to NEXT / NOT STARTED;
6. exact post-closeout `develop` CI must pass.
