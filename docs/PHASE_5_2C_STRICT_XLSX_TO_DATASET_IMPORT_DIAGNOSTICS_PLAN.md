# Phase 5.2C — Strict XLSX-to-Dataset Import & Diagnostics Plan

## Status

**PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning base:

```text
develop  39ee7541b7de93e39d9963e5e1be1e80dcd07644
CI       35008520820 — SUCCESS
```

Predecessors:

```text
5.1A  Persisted Dataset Source Inventory & Contract Completeness   COMPLETE
5.1B  Workbook Schema / Sheet / Column Contracts                   COMPLETE
5.1C  Dataset Validation & Reference Integrity                     COMPLETE
5.2A  XLSX Library Evaluation & Codec Boundary                     COMPLETE
5.2B  Deterministic Dataset-to-XLSX Export                         COMPLETE
```

This document plans 5.2C only. It does not start implementation.

---

## 1. Objective

Implement the strict reverse persistence boundary:

```text
XLSX bytes
    |
    v
WorkbookCodec.decode(...)
    |
    v
WorkbookNeutralDocument
    |
    v
workbook schema / metadata validation
    |
    v
reconstruct complete candidate BusinessDataset
    |
    v
validateBusinessDatasetIntegrity(...)
    |
    +-- invalid -> structured deterministic diagnostics, no dataset accepted
    |
    `-- valid   -> complete candidate BusinessDataset
```

The importer must never mutate live repositories. 5.2C produces a candidate dataset only. Repository hydration remains Phase 5.3B.

---

## 2. Split assessment

5.2C does **not** require deeper formal numbered sub-phases.

Reason:

- decoding bytes without reconstruction is already owned by 5.2A;
- workbook structural validation is already owned by 5.1B;
- complete dataset semantic/reference/graph validation is already owned by 5.1C;
- the unique responsibility of 5.2C is the single reconstruction/diagnostic bridge between those established boundaries;
- a partially implemented importer is not a useful persistence boundary because import must remain all-or-nothing at the candidate-dataset level.

Implementation will use internal checkpoints instead:

1. byte decode, schema, and metadata gate;
2. typed primary-sheet row reconstruction;
3. normalized child-sheet grouping and order integrity;
4. nested/nullable source-object reconstruction;
5. complete 5.1C dataset semantic validation and issue translation;
6. real-XLSX round-trip and malformed-workbook regression.

---

## 3. Existing authoritative boundaries to reuse

### 3.1 Workbook byte codec

Phase 5.2A provides:

```ts
interface WorkbookCodec {
  encode(document: WorkbookNeutralDocument): Uint8Array;
  decode(bytes: Uint8Array | ArrayBuffer): WorkbookNeutralDocument;
}
```

and the selected production adapter:

```text
SheetJsWorkbookCodec — SheetJS CE 0.20.3
```

The importer depends on `WorkbookCodec`; SheetJS workbook/cell types must not leak into the importer.

Codec failures such as `XLSX_DECODE_FAILED` and `INVALID_HEADER_CELL` must be converted into controlled import diagnostics rather than escaping as the only user-facing failure.

### 3.2 Workbook schema contract

Phase 5.1B already owns:

- exact 13 canonical sheet names;
- exact canonical column order;
- required/optional primitive cell rules;
- enum/unit tokens;
- formula rejection;
- paired pricing fields;
- positive 1-based child order cell shape;
- workbook format identity/version;
- dataset schema-version shape;
- unknown extra sheet/column policy.

5.2C must call the existing workbook schema validator before reconstruction. It must not duplicate those structural rules in a second schema registry.

### 3.3 Dataset integrity contract

Phase 5.1C provides:

```text
validateBusinessDatasetIntegrity(candidate)
```

This remains the final semantic acceptance gate after reconstruction.

It owns:

- complete dataset envelope/version;
- source-record domain contracts;
- duplicate identities;
- durable cross-references;
- Product component source uniqueness;
- Product composition self/cycle integrity;
- deterministic structured issues.

The importer must not reimplement those domain rules.

### 3.4 Export symmetry

Phase 5.2B provides the authoritative forward mapping. Import reconstruction must be the semantic inverse of that mapping for current workbook v1.

This includes:

- flattened Material source metadata;
- normalized MixPreset categories/lines;
- normalized YieldSample inputs;
- flattened nullable Product pricing policy;
- missing-vs-zero/null/false semantics;
- ISO source timestamp text;
- all nine BusinessDataset source collections.

---

## 4. Locked import architecture

Recommended public boundary:

```ts
importBusinessDatasetFromXlsx(
  bytes: Uint8Array | ArrayBuffer,
  codec: WorkbookCodec,
): BusinessDatasetWorkbookImportResult
```

A lower-level neutral-document operation should also exist for focused tests and separation of concerns, with semantics similar to:

```ts
reconstructBusinessDatasetFromWorkbook(
  document: WorkbookNeutralDocument,
): BusinessDatasetWorkbookImportResult
```

Exact names may be refined during implementation, but both conceptual boundaries are required:

```text
bytes -> neutral workbook
neutral workbook -> candidate dataset
```

No React component, repository, StoragePort implementation, browser picker, native filesystem API, or Tauri API belongs in either operation.

---

## 5. Import result and diagnostic contract

Import must favor structured aggregated diagnostics over generic exceptions.

Recommended shape:

```ts
type BusinessDatasetWorkbookImportResult =
  | {
      ok: true;
      dataset: BusinessDataset;
      metadata: ImportedWorkbookMetadata;
    }
  | {
      ok: false;
      issues: readonly BusinessDatasetWorkbookImportIssue[];
    };
```

Recommended metadata returned on success:

```ts
interface ImportedWorkbookMetadata {
  formatId: string;
  workbookFormatVersion: number;
  datasetSchemaVersion: number;
  exportedAt: string;
  applicationVersion?: string;
}
```

Recommended issue fields:

```ts
interface BusinessDatasetWorkbookImportIssue {
  stage: 'codec' | 'schema' | 'metadata' | 'reconstruction' | 'dataset';
  code: string;
  message: string;
  sheetName?: string;
  rowIndex?: number;   // zero-based data-row index, excluding header
  excelRow?: number;   // when derivable, rowIndex + 2
  column?: string;
  path?: string;
}
```

Exact TypeScript names may be refined, but diagnostics must remain deterministic, inspectable, and location-aware where possible.

Do not emit a partially reconstructed dataset when any blocking issue exists.

---

## 6. Stage ordering and fail-closed behavior

The importer must use a strict staged gate.

### Stage 1 — Codec decode

```text
bytes
-> codec.decode(...)
```

If decoding fails:

- return controlled codec-stage issue(s);
- preserve the codec error code/message where safe;
- do not attempt workbook schema validation or reconstruction.

### Stage 2 — Workbook schema validation

Run the existing 5.1B validator on the decoded neutral document.

If structural issues exist:

- return all deterministic schema issues;
- do not reconstruct typed domain rows from structurally invalid cells;
- do not run 5.1C on an invented partial dataset.

### Stage 3 — Current metadata/version gate

For v1 importer implementation, require:

```text
formatId              == craft-business-manager
workbookFormatVersion == CURRENT_WORKBOOK_FORMAT_VERSION

datasetSchemaVersion == CURRENT_BUSINESS_DATASET_SCHEMA_VERSION
```

Also require `exportedAt` to remain nonblank ISO-compatible text.

`applicationVersion` remains optional metadata and does not affect source semantics.

5.2C is a **current-version importer only**. Older-version migration and broader compatibility belong to 5.4A. Unsupported older/future versions fail closed with controlled diagnostics rather than being guessed.

### Stage 4 — Reconstruction integrity

Build all nine BusinessDataset collections only after structural/meta success.

Collect reconstruction-specific child relationship/order issues. If any exist, reject before 5.1C.

### Stage 5 — Dataset semantic validation

Run:

```text
validateBusinessDatasetIntegrity(candidate)
```

If invalid:

- translate/preserve all 5.1C issues into the import result;
- do not return the candidate as accepted data.

Only a complete dataset that passes this stage is a successful import.

---

## 7. Blank, missing, zero, null, and false semantics

Import must preserve the workbook contract established by 5.1B/5.2B.

### 7.1 Blank optional cells

For optional source fields, workbook blank values reconstruct to absence:

```text
undefined / null / blank optional text -> undefined source field
```

Whitespace-only optional text may be treated as blank/absent because the workbook contract defines blank optional cells as absence, not authoritative empty source evidence.

### 7.2 Required source values

Required values are never defaulted.

Examples:

- missing required number does not become `0`;
- missing required boolean does not become `false`;
- missing required text does not become an empty ID/name;
- malformed numeric strings are not coerced into numbers.

Structural validation must reject them before reconstruction.

### 7.3 Explicit values

Preserve exactly:

- numeric `0` as zero;
- boolean `false` as false;
- valid high-precision finite numbers as numbers;
- source timestamp strings as text;
- formula-looking literal strings as strings.

No business rounding or locale conversion occurs during import.

---

## 8. Primary-sheet reconstruction

After schema validation, each canonical primary sheet reconstructs its corresponding source collection.

### `Materials`

Reconstruct one `Material` per row.

Flattened source columns:

```text
sourceVendorName
sourceDetail
sourcePurchaseLink
sourceContactNumber
sourceSocialPage
sourceNotes
```

must rebuild:

```ts
Material.source
```

Rules:

- if all source metadata cells are blank/absent -> `source: undefined`;
- if at least one is present -> construct one source object containing only present fields;
- do not construct an empty source object.

### `Calibrations`

Reconstruct `MaterialCalibrationEvidence[]` from source fields only. Preserve `recordedAt` as text.

### `MixPresets`

Reconstruct parent fields first with empty child arrays temporarily. Child sheets then supply `compatibleCategories` and `lines`.

### `Products`

Optional blank `mixPresetId` reconstructs to `undefined`.

### `YieldSamples`

Reconstruct parent fields first with empty `materialInputs`; `YieldSampleInputs` supplies the nested inputs.

### `RecipeItems`

Reconstruct `FixedRecipeItem[]` directly.

### `ProductComponents`

Reconstruct `ProductComponent[]` directly.

### `ProductStocks`

Only rows that exist create stock records. No row means missing stock evidence. A row containing `onHandQuantity = 0` is an explicit zero-stock record.

### `ProductFinancialProfiles`

Pricing pair reconstruction:

```text
pricingMethod blank + pricingValue blank
    -> pricingPolicy = null

pricingMethod populated + pricingValue populated
    -> pricingPolicy = { method, value }
```

The existing workbook schema validator already rejects one-sided pairs. Explicit `pricingValue = 0` must remain zero.

---

## 9. Child-sheet relationship reconstruction

Child sheets are the main importer-specific integrity boundary.

Relationships:

```text
MixPresets.id
  <- MixPresetCategories.mixPresetId
  <- MixPresetLines.mixPresetId

YieldSamples.id
  <- YieldSampleInputs.yieldSampleId
```

### 9.1 Parent lookup semantics

Parent identity lookup must follow the application's established trim-aware, case-insensitive identity semantics.

A child foreign key may match a parent by canonical identity without rewriting the parent source ID.

The reconstructed nested object uses the parent row's authoritative parent ID; the workbook-only child foreign key is not persisted independently after reconstruction.

### 9.2 Orphan child rows

A child row whose canonical parent identity does not exist is a blocking reconstruction issue.

Do not silently drop orphan rows.

### 9.3 Order values

The existing schema validator proves each order cell is a positive integer. 5.2C additionally owns **relationship-local sequence integrity**.

For each canonical parent identity, require:

```text
1, 2, 3, ... N
```

Reject:

- duplicate order values;
- gaps such as `1, 3`;
- order sequences that do not start at `1`.

Rows may appear physically in any worksheet order; reconstruction sorts each parent's children by the explicit order column.

### 9.4 Duplicate child source semantics

Importer-specific duplicate order conflicts are rejected at reconstruction.

Domain-level duplicate content rules remain owned by 5.1C. Examples:

- duplicate MixPreset material line semantics;
- invalid primary-line count;
- duplicate YieldSample material inputs;

Do not duplicate those semantic checks in the reconstruction layer.

---

## 10. Current-version metadata contract

`_Meta` must contain exactly one structurally valid row as already required by the schema contract.

5.2C should expose imported metadata separately from `BusinessDataset` because:

- `exportedAt` is workbook metadata, not business source evidence;
- `applicationVersion` is workbook metadata, not business source evidence;
- workbook format version is separate from dataset schema version.

No metadata row is copied into a business collection.

---

## 11. Extra sheets and columns

Preserve the established 5.1B policy:

- unknown extra worksheets are non-authoritative and ignored after structural resource checks;
- unknown extra columns on canonical sheets are non-authoritative and ignored;
- canonical required sheets/columns must still exist exactly under the canonical contract;
- duplicate canonical column names remain invalid;
- the importer must never guess that an unknown column is business source data.

---

## 12. Formula and text safety

Formula cells in authoritative source fields must fail closed.

The SheetJS adapter already decodes a real formula into neutral `WorkbookFormulaCell` metadata. The 5.1B schema gate rejects that metadata.

The importer must not:

- evaluate formulas;
- use cached formula results as source values;
- strip a formula marker and accept the cached primitive;
- reinterpret formula-looking literal text such as `=1+1` as a formula.

Literal strings beginning with `=`, `+`, `-`, or `@` remain ordinary source text when the codec decoded them as strings.

---

## 13. Dataset acceptance and source fidelity

Successful reconstruction must produce a complete `BusinessDataset` with:

```text
schemaVersion
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

No derived fields may be invented.

Import must not persist:

- material cost per base unit;
- inventory valuation;
- derived calibration ratios;
- learned per-piece requirements;
- recipe-cost previews;
- production requirements/capacity;
- component cost roll-ups;
- fully loaded cost;
- selling price/profit/margin;
- planned-batch financial outputs.

All such values are recalculated after later hydration.

---

## 14. Deterministic diagnostics

Diagnostics must be deterministic for the same workbook semantics.

Recommended ordering:

1. stage order: codec -> schema -> metadata -> reconstruction -> dataset;
2. canonical sheet order;
3. data row index;
4. column/path;
5. stable issue code/message tie-break.

The importer should preserve existing structured schema and 5.1C issue information rather than flattening everything to one message.

A malformed workbook must never be accepted merely because another row could still be reconstructed.

---

## 15. Resource-limit boundary

5.2C must not accidentally claim to finish the full hostile-file hardening assigned to 5.4C.

In 5.2C:

- keep reconstruction algorithms bounded and non-recursive where practical;
- avoid repeated whole-workbook scans when indexed grouping suffices;
- do not add native filesystem reads;
- if a minimal workbook-neutral row-count guard is required to make reconstruction safe, keep it library-neutral and document it.

Phase 5.4C remains responsible for the complete corruption/resource-limit/recovery hardening policy, including byte-size and practical hostile workbook limits.

---

## 16. Round-trip contract with 5.2B

The critical acceptance test is:

```text
valid BusinessDataset
  -> 5.2B export
  -> real SheetJS XLSX bytes
  -> 5.2C import
  -> semantically equivalent BusinessDataset
```

Equivalence is source-semantic equality, not necessarily original top-level array order, because 5.2B canonicalizes top-level ordering.

Child-array order **is** authoritative and must survive through explicit order columns.

The round trip must prove:

- all nine collections survive;
- Material source metadata survives;
- calibrations survive;
- MixPreset categories/lines survive in order;
- YieldSample inputs survive in order;
- Product optional references survive;
- ProductStock missing vs explicit zero survives;
- ProductFinancialProfile missing vs explicit zero survives;
- `pricingPolicy = null` survives;
- explicit zero pricing value survives;
- false active state survives;
- formula-looking literal text survives;
- numeric precision and ISO timestamp text survive.

---

## 17. Controlled malformed-workbook cases

5.2C focused tests must include failures for at least:

- invalid/corrupt XLSX bytes -> controlled codec-stage issue;
- missing `_Meta`;
- multiple/invalid `_Meta` rows;
- wrong format ID;
- unsupported workbook format version;
- unsupported dataset schema version;
- invalid/non-ISO `exportedAt`;
- missing canonical sheet;
- missing canonical column;
- duplicate canonical column;
- canonical columns out of order;
- wrong primitive type;
- invalid enum token;
- invalid unit token;
- formula cell in authoritative field;
- one-sided pricing method/value pair;
- orphan MixPreset category row;
- orphan MixPreset line row;
- orphan YieldSample input row;
- duplicate child order;
- child order gap;
- child order sequence not starting at one;
- reconstructed dataset duplicate identity;
- reconstructed dataset missing Material/Product/MixPreset references;
- reconstructed Product composition cycle;
- domain-invalid source row that is structurally workbook-valid.

Every failure must return no accepted dataset.

---

## 18. Focused test matrix

Implementation should cover at least the following groups.

### Decode / metadata

1. valid real XLSX bytes decode and import;
2. invalid bytes produce controlled codec diagnostic;
3. current format/workbook/dataset versions accepted;
4. wrong format ID rejected;
5. unsupported workbook version rejected;
6. unsupported dataset schema version rejected;
7. invalid exportedAt rejected;
8. optional applicationVersion preserved separately from business data.

### Workbook structure

9. all canonical required sheets accepted;
10. unknown extra sheet ignored as non-authoritative;
11. unknown extra column ignored as non-authoritative;
12. missing sheet rejected;
13. missing column rejected;
14. duplicate column rejected;
15. wrong column order rejected;
16. formula cell rejected;
17. malformed primitive/enum/unit rejected;
18. explicit zero and false accepted.

### Primary reconstruction

19. Materials map all source fields;
20. all-blank Material source fields reconstruct `source: undefined`;
21. partially populated Material source reconstructs only present metadata fields;
22. calibrations preserve source timestamps/text;
23. Products preserve optional mixPresetId absence;
24. recipe items/components map source fields only;
25. missing ProductStock row remains missing;
26. explicit zero ProductStock row survives;
27. missing ProductFinancialProfile remains missing;
28. explicit zero-cost profile survives;
29. null pricing pair reconstructs `pricingPolicy = null`;
30. populated pricing pair reconstructs policy including valid zero value.

### Child reconstruction

31. MixPreset categories reconstruct by categoryOrder;
32. MixPreset lines reconstruct by lineOrder;
33. YieldSample inputs reconstruct by inputOrder;
34. physical worksheet child-row order may be shuffled without changing reconstructed child order;
35. canonical case-insensitive parent matching works;
36. orphan child rejected;
37. duplicate child order rejected;
38. child order gap rejected;
39. child order not starting at one rejected.

### Semantic acceptance

40. reconstructed candidate is passed through 5.1C;
41. duplicate entity identity rejected through 5.1C;
42. missing durable reference rejected through 5.1C;
43. Product composition cycle rejected through 5.1C;
44. archived/historical relationships that 5.1C permits remain importable;
45. no live repository/session mutation occurs.

### Real round trip / fidelity

46. complete fixture `dataset -> export -> real XLSX -> import` is semantically equivalent;
47. empty valid dataset round-trips;
48. high-precision finite numbers round-trip without business rounding;
49. ISO source timestamps round-trip as text;
50. formula-looking literal source text round-trips as text;
51. explicit false round-trips;
52. explicit numeric zero round-trips;
53. input bytes/neutral document are not mutated by import.

The final focused test count may exceed this minimum matrix.

---

## 19. Expected implementation surface

Primary expected files:

```text
src/storage/businessDatasetWorkbookImport.ts
src/storage/businessDatasetWorkbookImport.test.ts
```

Possible small support changes:

```text
src/storage/workbookSchema.ts
```

only if a library-neutral reusable helper for canonical sheet lookup/blank-cell semantics/diagnostic ordering is genuinely justified.

Avoid changing:

```text
src/storage/ExcelStorage.ts
src/storage/StoragePort.ts
```

in 5.2C. Runtime load/save coordination belongs later.

No new XLSX library should be added.

The importer must not directly import SheetJS APIs.

---

## 20. Explicit exclusions

Do **not** pull these tasks into 5.2C:

- repository snapshot service — 5.3A;
- repository/session hydration — 5.3B;
- atomic live-state replacement — 5.3B;
- persistence coordinator/load-save lifecycle — 5.3C;
- schema migration of older workbook/dataset versions — 5.4A;
- full hostile/corrupt workbook size-limit policy — 5.4C;
- backup/atomic filesystem transport — 5.4B;
- `ExcelStorage.load/save` runtime wiring — later Phase 5 composition;
- browser file picker/download UI — 5.5;
- persistence status/recovery UX — 5.5C;
- native Tauri filesystem/dialogs — Phase 6;
- report/dashboard spreadsheet export — Phase 7;
- derived business formulas/macros inside Excel.

---

## 21. Implementation sequence

After this planning PR is merged and exact post-merge `develop` CI is green, a separate implementation instruction should perform:

1. verify the exact final green planning baseline;
2. create `feature/phase-5-2c-strict-xlsx-dataset-import` from that exact SHA;
3. implement import result/diagnostic types and byte/neutral boundaries;
4. reuse the existing workbook schema validator as the first neutral-document gate;
5. implement current metadata/version validation;
6. implement primary-sheet typed reconstruction;
7. implement indexed child grouping, orphan detection, and exact `1..N` order validation;
8. reconstruct Material source metadata and nullable pricing policy;
9. build the complete candidate BusinessDataset;
10. pass it through `validateBusinessDatasetIntegrity(...)`;
11. add the focused malformed-workbook and real round-trip test matrix;
12. run typecheck/full tests/build through GitHub Actions;
13. add `docs/PHASE_5_2C_STRICT_XLSX_TO_DATASET_IMPORT_DIAGNOSTICS.md` implementation evidence;
14. rerun CI on the documented feature head;
15. open implementation PR to `develop`;
16. require dedicated PR CI on the unchanged exact head;
17. guarded-merge using exact `expected_head_sha`;
18. require exact push CI on the implementation merge;
19. use a separate docs-only closeout PR to mark 5.2C COMPLETE;
20. after final closeout CI, advance to Phase 5.3A only as NEXT / NOT STARTED.

---

## 22. Completion gate

5.2C is complete only when all of the following are true:

- real XLSX bytes from the current exporter import to a semantically equivalent BusinessDataset;
- current workbook/dataset metadata versions are validated explicitly;
- all 13 canonical sheets are structurally validated before typed reconstruction;
- child rows reconstruct deterministically with orphan/duplicate/gap checks;
- missing/zero/null/false source semantics survive;
- formulas remain fail-closed;
- malformed workbook cases produce deterministic structured diagnostics;
- reconstructed candidate passes 5.1C before acceptance;
- no live repository mutation occurs;
- no migration, hydration, filesystem, or UI scope is introduced;
- focused tests, full regression, TypeScript, and production build are green;
- implementation PR and exact post-merge `develop` CI are green;
- docs-only closeout is merged and exact final `develop` CI is green.

---

## 23. Stop point

This task is **planning only**.

Do not create `businessDatasetWorkbookImport.ts`, modify runtime storage behavior, or begin 5.3A as part of this planning step.
