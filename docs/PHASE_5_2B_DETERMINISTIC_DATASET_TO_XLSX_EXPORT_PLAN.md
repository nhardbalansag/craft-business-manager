# Phase 5.2B — Deterministic Dataset-to-XLSX Export — Development Plan

## Status

**PLAN ONLY — IMPLEMENTATION NOT STARTED**

Repository:

`nhardbalansag/craft-business-manager`

Authoritative planning base:

```text
develop  c03cee3cacbf9ed5f6a7726d380df9b461725356
CI       35003583148 — SUCCESS
```

Parent phase:

**5.2 — XLSX Workbook Codec**

Previous completed task:

**5.2A — XLSX Library Evaluation & Codec Boundary — COMPLETE**

Selected XLSX library:

**SheetJS Community Edition 0.20.3**

---

## 1. Purpose

Phase 5.2B implements the authoritative **export direction** of Phase 5 persistence:

```text
BusinessDataset
    -> canonical WorkbookNeutralDocument
    -> WorkbookCodec
    -> XLSX bytes
```

The task converts one complete, valid source dataset into the exact 13-sheet workbook v1 contract established by Phase 5.1B, then uses the library-neutral codec established by Phase 5.2A to produce `.xlsx` bytes.

5.2B must persist source evidence only. It must not write derived costing, yield-learning, capacity, pricing-output, revenue, profit, or other recalculable outputs into authoritative workbook columns.

---

## 2. Split assessment

### Decision

**5.2B does not require deeper formal numbered sub-phases.**

Reason:

- Phase 5.2A already owns the XLSX byte codec.
- Phase 5.1B already owns the workbook schema contract.
- Phase 5.1C already owns complete-dataset semantic validation.
- 5.2B therefore has one cohesive deliverable: a complete deterministic exporter that produces a valid workbook from a valid dataset.
- A partial implementation that exports only some canonical sheets is not a valid Phase 5 workbook and would not create a useful independently releasable boundary.

Implementation should use internal checkpoints rather than new roadmap phases:

```text
Checkpoint A — Export metadata contract and failure boundary
Checkpoint B — Primary source-sheet row mapping
Checkpoint C — Normalized child-sheet row mapping
Checkpoint D — Canonical deterministic row ordering
Checkpoint E — Workbook-schema self-validation
Checkpoint F — Real XLSX byte export through WorkbookCodec
Checkpoint G — Full fixture / shuffled-order / source-semantics regression
```

If one checkpoint reveals a materially larger architectural concern, stop and revise this plan before implementation expands scope.

---

## 3. Existing authoritative foundation

### 3.1 Complete source dataset

`BusinessDataset` already covers the nine authoritative source collections:

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

Dataset schema version:

```text
CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1
```

### 3.2 Complete dataset semantic gate

Phase 5.1C provides:

```text
validateBusinessDatasetIntegrity(input)
```

It validates:

- complete dataset envelope/version;
- all source-record contracts;
- duplicate identities;
- durable cross-references;
- Product composition source uniqueness and cycle integrity;
- deterministic structured issues.

5.2B must use this gate before export. It must not serialize a candidate that is already known to violate the authoritative source contract.

### 3.3 Workbook schema contract

Phase 5.1B defines the canonical 13-sheet v1 workbook:

```text
_Meta
Materials
Calibrations
MixPresets
MixPresetCategories
MixPresetLines
Products
YieldSamples
YieldSampleInputs
RecipeItems
ProductComponents
ProductStocks
ProductFinancialProfiles
```

It also owns:

- exact column order;
- required/optional primitive rules;
- canonical enum/unit tokens;
- source-path ownership;
- parent/child normalization relationships;
- workbook-only child order columns;
- formula policy;
- deterministic row-order metadata;
- workbook-neutral schema validation.

5.2B must consume these contracts rather than redefine sheet or column order independently.

### 3.4 XLSX codec boundary

Phase 5.2A provides:

```text
WorkbookCodec
├── encode(WorkbookNeutralDocument) -> Uint8Array
└── decode(Uint8Array | ArrayBuffer) -> WorkbookNeutralDocument
```

and the selected adapter:

```text
SheetJsWorkbookCodec
```

The exporter must depend on `WorkbookCodec`, not on SheetJS types.

---

## 4. Locked exporter architecture

The target flow is:

```text
BusinessDataset input
    |
    v
validateBusinessDatasetIntegrity(...)
    |
    | valid only
    v
create canonical WorkbookNeutralDocument
    |
    v
assertWorkbookSchema(...)
    |
    v
WorkbookCodec.encode(...)
    |
    v
Uint8Array XLSX bytes
```

No repository, React component, browser file picker, filesystem path, Tauri API, or live storage mutation belongs in this pipeline.

### 4.1 Pure mapping boundary

Implementation should expose a pure mapping function with semantics similar to:

```ts
createBusinessDatasetWorkbookDocument(
  dataset: BusinessDataset,
  metadata: WorkbookExportMetadata,
): WorkbookNeutralDocument
```

Exact names may be refined, but the pure mapping boundary is required.

### 4.2 Byte-export boundary

A second operation may compose the mapper with the generic codec:

```ts
exportBusinessDatasetToXlsx(
  dataset: BusinessDataset,
  metadata: WorkbookExportMetadata,
  codec: WorkbookCodec,
): Uint8Array
```

The exporter must not directly construct SheetJS workbook objects.

---

## 5. Export metadata contract

The `_Meta` sheet is authoritative workbook metadata and must be written first.

Required v1 row values:

```text
formatId               craft-business-manager
workbookFormatVersion  1
datasetSchemaVersion   dataset.schemaVersion
exportedAt              explicitly supplied ISO-compatible text
applicationVersion      optional supplied text
```

### 5.1 No hidden clock in the pure mapper

`exportedAt` must be passed explicitly into the mapping/export operation.

Do **not** call `Date.now()`, `new Date()` with no explicit input, or another ambient clock inside the pure dataset-to-workbook mapper.

Reason:

- deterministic tests require fixed metadata;
- the same dataset and same metadata should map to the same neutral workbook regardless of runtime time;
- the later persistence coordinator can own creation of the current export timestamp.

5.2B may validate that `exportedAt` is nonblank ISO-compatible text, but it must not convert source timestamps or rely on locale-specific Excel date serials.

### 5.2 `applicationVersion`

`applicationVersion` remains optional workbook metadata.

The low-level exporter should receive it explicitly rather than importing UI/build/package state into the storage mapper.

---

## 6. Sheet mapping contract

Every canonical sheet must be present even when its source collection has zero rows.

Canonical column order must come from `WORKBOOK_SHEETS` / `WORKBOOK_SCHEMA_BY_NAME`.

### 6.1 `_Meta`

Exactly one row, using the metadata contract above.

### 6.2 `Materials`

One row per `Material`.

Direct values:

```text
id
name
group
baseUnit
purchaseQuantity
purchaseUnit
packageCost
manualBaseUnitsPerPurchaseUnit
onHandQuantity
onHandUnit
notes
isActive
```

Flatten optional one-to-one source metadata:

```text
sourceVendorName       <- source?.vendorName
sourceDetail           <- source?.source
sourcePurchaseLink     <- source?.purchaseLink
sourceContactNumber    <- source?.contactNumber
sourceSocialPage       <- source?.socialPage
sourceNotes            <- source?.notes
```

If `source` is absent, optional source cells remain absent/blank. Do not synthesize an empty source object or placeholder strings.

### 6.3 `Calibrations`

One row per `MaterialCalibrationEvidence`:

```text
id
materialId
measuredVolume
volumeUnit
knownWeight
weightUnit
recordedAt
notes
```

Do not export derived grams-per-cup or normalized conversion outputs.

### 6.4 `MixPresets`

One parent row per `MixPreset`:

```text
id
name
basis
notes
isActive
```

Do not encode repeated arrays in cells.

### 6.5 `MixPresetCategories`

One row per `MixPreset.compatibleCategories` entry:

```text
mixPresetId
categoryOrder
category
```

`categoryOrder` is 1-based and reproduces the original source-array position.

### 6.6 `MixPresetLines`

One row per `MixPreset.lines` entry:

```text
mixPresetId
lineOrder
materialId
role
parts
```

`lineOrder` is 1-based and reproduces the original source-array position.

### 6.7 `Products`

One row per `Product`:

```text
id
name
category
mixPresetId
safetyWasteRate
notes
isActive
```

`safetyWasteRate` stays its canonical decimal numeric source value.

### 6.8 `YieldSamples`

One parent row per `YieldSample`:

```text
id
productId
mixPresetId
goodPieces
rejectedPieces
recordedAt
notes
```

`materialInputs` are not encoded in the parent row.

### 6.9 `YieldSampleInputs`

One row per `YieldSample.materialInputs` entry:

```text
yieldSampleId
inputOrder
materialId
quantity
unit
```

`inputOrder` is 1-based and preserves the original source-array order.

### 6.10 `RecipeItems`

One row per `FixedRecipeItem`:

```text
id
productId
materialId
quantityPerProduct
unit
role
notes
```

### 6.11 `ProductComponents`

One row per `ProductComponent`:

```text
id
parentProductId
sourceType
sourceId
role
quantityPerParent
notes
```

No derived component cost/capacity/trace output is persisted.

### 6.12 `ProductStocks`

One row per persisted `ProductStock`:

```text
productId
onHandQuantity
notes
```

No row means missing stock evidence. A row with `onHandQuantity = 0` is explicit zero and must be exported.

### 6.13 `ProductFinancialProfiles`

One row per persisted profile:

```text
productId
laborCostPerUnit
overheadCostPerUnit
pricingMethod
pricingValue
notes
```

Flatten `pricingPolicy`:

```text
pricingPolicy === null
    -> pricingMethod absent
    -> pricingValue absent

pricingPolicy !== null
    -> pricingMethod = pricingPolicy.method
    -> pricingValue = pricingPolicy.value
```

Explicit numeric `0` remains a number and must not be treated as blank.

---

## 7. Optional, zero, false, and blank semantics

The exporter must preserve source evidence exactly.

Rules:

- optional `undefined` source values become absent/blank workbook cells;
- explicit numeric `0` remains numeric zero;
- explicit boolean `false` remains boolean false;
- `pricingPolicy = null` becomes both flattened pricing cells blank;
- missing ProductStock row stays missing rather than generating a `0` row;
- missing ProductFinancialProfile row stays missing rather than generating a zero-cost profile;
- optional Material source object absence does not create empty metadata values as authoritative evidence;
- no source value is defaulted merely to make a workbook look populated.

Where practical, neutral row objects should omit absent optional keys rather than populate arbitrary empty-string placeholders.

---

## 8. Deterministic ordering

Deterministic ordering is a correctness requirement.

### 8.1 Sheet order

Use the exact canonical order from `WORKBOOK_SHEETS`.

Never depend on object-property iteration or source repository enumeration order to choose sheet sequence.

### 8.2 Primary row order

Use the row-order metadata already declared by Phase 5.1B:

```text
Materials                 id
Calibrations              materialId, recordedAt, id
MixPresets                id
Products                  id
YieldSamples              productId, recordedAt, id
RecipeItems               productId, id
ProductComponents         parentProductId, id
ProductStocks             productId
ProductFinancialProfiles  productId
```

### 8.3 Child row order

```text
MixPresetCategories       mixPresetId, categoryOrder
MixPresetLines            mixPresetId, lineOrder
YieldSampleInputs          yieldSampleId, inputOrder
```

Parents are canonicalized by parent identity; source-array order inside each parent is preserved through the explicit 1-based order column.

### 8.4 `text-ci-exact` comparator

For identity-oriented ordering:

1. primary compare: trim-aware case-insensitive text;
2. stable tie-break: exact source string;
3. if required for total ordering, retain original index only as a final non-semantic tie-break for values that are exactly identical.

Valid complete datasets should already reject duplicate canonical identities where identity uniqueness is required.

### 8.5 Timestamp ordering

Canonical ISO-compatible timestamps should sort by timestamp semantics without locale dependence.

Do not use local date display formatting to determine row order.

### 8.6 What “deterministic export” means

For the same valid source dataset and the same explicit export metadata:

- generated neutral workbook sheet order is identical;
- generated column order is identical;
- generated row order is identical;
- generated primitive source values are identical.

This must remain true even if top-level source arrays are shuffled before export.

The business contract is **deterministic workbook semantics**, not unconditional byte-for-byte ZIP identity. `.xlsx` container metadata/compression details are not authoritative source data unless the selected codec is proven to make exact bytes stable.

Tests should compare canonical neutral workbook semantics after decoding bytes rather than make byte identity a required contract.

---

## 9. Formula-looking text safety

Every source text value stays a literal string.

Representative values beginning with:

```text
=
+
-
@
```

must pass through the exporter as strings and survive real XLSX encode/decode as literal strings.

The exporter must never construct `WorkbookFormulaCell` values.

The existing `SheetJsWorkbookCodec` already refuses outbound formula objects. 5.2B must prove real source fields such as notes/source text remain literal through the complete dataset export path.

---

## 10. Numeric and timestamp fidelity

### 10.1 Numeric precision

Do not apply business display rounding before export.

Persist the source numeric values supplied by the dataset:

- material/package quantities and costs;
- inventory quantities;
- calibration measurements;
- mix parts;
- yield counts/quantities;
- recipe quantities;
- safety-waste decimal rate;
- component quantities;
- stock quantities;
- labor/overhead/pricing values.

`NaN`, `Infinity`, and `-Infinity` should already fail source validation and must never reach XLSX encoding.

### 10.2 Timestamps

Persist source `recordedAt` values as text exactly according to the current source contract.

Do not convert them into Excel serial dates.

`_Meta.exportedAt` is also text.

---

## 11. Source validation and export failure model

5.2B must fail before byte encoding if the dataset is invalid.

Recommended boundary:

```text
validateBusinessDatasetIntegrity(dataset)
    invalid -> controlled export error carrying structured dataset issues
    valid   -> continue
```

A focused export error type may be introduced, for example:

```text
BusinessDatasetWorkbookExportError
```

with stable categories such as:

```text
INVALID_DATASET
INVALID_EXPORT_METADATA
INVALID_GENERATED_WORKBOOK
```

Exact names may be refined during implementation, but failures must remain controlled and inspectable.

Do not swallow dataset validation issues into one generic “could not export” message.

---

## 12. Workbook self-validation before encode

The generated `WorkbookNeutralDocument` must pass:

```text
assertWorkbookSchema(...)
```

before `WorkbookCodec.encode(...)` is invoked.

This is an internal correctness gate that protects against mapper/schema drift.

The generated workbook must therefore prove:

- all 13 canonical sheets exist;
- `_Meta` has exactly one row;
- exact canonical columns exist in canonical order;
- required primitive cells are present;
- optional values remain optional;
- child order fields are positive 1-based integers;
- pricing fields are both blank or both populated;
- no formula objects are present in authoritative fields.

If self-validation fails, that is an exporter implementation error, not a reason to silently repair the generated workbook.

---

## 13. Readable workbook presentation

Business semantics and presentation must stay separate.

5.2B must at minimum produce:

- canonical text headers in every sheet;
- stable column order;
- readable workbook sheet names;
- all source values as their authoritative primitive types.

A **small library-neutral column-width hint** may be added if the implementation can do so without leaking SheetJS types into the schema/domain/application layers.

Do not introduce locale currency symbols, locale date formats, percentage transformations, or number formats that alter source values.

Presentation metadata is non-authoritative and must not affect import semantics.

If adding width hints would materially expand the codec abstraction, keep 5.2B focused on canonical headers/order and record richer workbook styling as a later polish concern rather than compromising persistence boundaries.

---

## 14. Implementation surface

Expected primary code surface:

```text
src/storage/businessDatasetWorkbookExport.ts
src/storage/businessDatasetWorkbookExport.test.ts
```

Possible supporting changes:

```text
src/storage/workbookSchema.ts
    only if a reusable canonical row comparator/helper is justified

src/storage/workbookCodec.ts
src/storage/sheetJsWorkbookCodec.ts
    only if minimal non-authoritative presentation metadata is added
```

No change to `StoragePort` is required for 5.2B.

`ExcelStorage.load/save` remains unimplemented.

A completion/evidence document should be added after implementation validation:

`docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT.md`

---

## 15. Focused test matrix

5.2B implementation must cover at least the following.

### Dataset / metadata gates

1. valid complete dataset exports;
2. invalid dataset fails before codec invocation and preserves structured validation issues;
3. `_Meta` is the first sheet and contains the exact format/workbook/dataset versions;
4. fixed explicit `exportedAt` is emitted exactly and no hidden ambient clock affects the neutral workbook;
5. optional `applicationVersion` can be present or absent without inventing a value.

### Canonical workbook shape

6. all 13 required sheets are emitted even when collections/child arrays are empty;
7. every sheet uses the exact canonical column order from the schema registry;
8. the generated neutral workbook passes `validateWorkbookSchema` / `assertWorkbookSchema`;
9. no derived business output columns are emitted.

### Source mapping

10. full Material source metadata flattens correctly;
11. absent Material source metadata remains absent rather than becoming an empty authoritative object;
12. calibration rows map source values/timestamps only;
13. MixPreset parent rows exclude nested arrays;
14. MixPreset categories and lines normalize to child sheets with correct 1-based order;
15. YieldSample inputs normalize to child rows with correct 1-based order;
16. Product optional `mixPresetId` remains absent when absent;
17. ProductStock absence differs from an explicit zero row;
18. ProductFinancialProfile absence differs from an explicit zero-cost row;
19. `pricingPolicy = null` produces both pricing cells blank;
20. populated pricing policy produces both cells, including explicit zero value if valid.

### Determinism

21. shuffled top-level source arrays generate an identical neutral workbook when dataset semantics and export metadata are the same;
22. canonical case-insensitive/exact identity ordering is stable;
23. calibration and yield evidence ordering is deterministic by parent/timestamp/id;
24. child source-array order survives parent canonicalization.

### Fidelity / safety

25. high-precision finite numeric values survive neutral mapping and real XLSX encode/decode without business rounding;
26. source ISO timestamp text survives unchanged;
27. formula-looking source text survives the complete export path as literal text;
28. explicit `false` remains boolean false;
29. explicit numeric zero remains numeric zero;
30. export does not mutate the input dataset or nested source arrays.

### Real XLSX bytes

31. complete fixture dataset exports through `SheetJsWorkbookCodec` to non-empty `Uint8Array` XLSX bytes;
32. decoding those bytes returns workbook semantics equivalent to the canonical neutral document;
33. decoded real XLSX output still passes workbook schema validation;
34. exact byte identity is not required unless separately proven stable by the codec.

The final focused-test count may exceed this matrix where useful.

---

## 16. Explicit exclusions

Do **not** pull these tasks into 5.2B:

- XLSX-to-dataset reconstruction;
- import diagnostics for malformed external workbook child rows;
- orphan/duplicate child reconstruction handling;
- format-version migration;
- unknown future workbook version migration;
- repository snapshot service;
- repository hydration;
- atomic live-state replacement;
- `ExcelStorage.load/save` runtime wiring;
- browser open/save dialogs;
- backup/atomic replacement transport;
- Tauri filesystem paths or dialogs;
- user-facing import/export status UI;
- derived report/dashboard exports;
- business-output formulas inside Excel;
- macros.

Those remain assigned to 5.2C, 5.3, 5.4, 5.5, Phase 6, or later reporting work.

---

## 17. Implementation sequence

When implementation is separately authorized:

1. reverify exact green `develop` baseline;
2. create `feature/phase-5-2b-deterministic-dataset-xlsx-export` from that exact SHA;
3. implement the explicit export metadata and controlled error boundary;
4. implement pure dataset-to-neutral-workbook mapping;
5. implement normalized child rows and canonical ordering;
6. self-validate generated workbook against the 5.1B schema;
7. compose with the generic `WorkbookCodec` for actual bytes;
8. add focused tests including real SheetJS bytes;
9. run exact feature CI: typecheck + full tests + build;
10. add the implementation evidence record;
11. rerun exact documented-head CI;
12. audit diff against the exact base;
13. open PR to `develop`;
14. require exact PR-head CI success;
15. guarded-merge using exact expected head SHA;
16. require exact post-merge `develop` CI success;
17. perform docs-only 5.2B closeout;
18. advance 5.2C to NEXT / NOT STARTED only after closeout merge and exact final CI.

---

## 18. Completion gate

5.2B is complete only when all of the following are true:

- one valid complete `BusinessDataset` maps to all 13 canonical sheets;
- all primary and child source evidence is represented exactly once in its authoritative workbook destination;
- source validation occurs before export;
- generated workbook self-validates against the 5.1B schema;
- missing/zero/null/false semantics are preserved;
- child source-array order survives normalization;
- top-level source-array order does not affect canonical workbook semantics;
- formula-looking source text remains literal through real XLSX bytes;
- finite numeric precision and ISO text semantics are preserved;
- no derived business output is written as authoritative source data;
- real `.xlsx` bytes are emitted through `WorkbookCodec` without filesystem APIs;
- focused tests, full regression, typecheck, and production build pass;
- implementation PR and exact post-merge `develop` CI are green;
- docs closeout is merged and final `develop` CI is green.

---

## 19. Stop point

This document is the **planning gate only**.

Do not implement 5.2B code as part of this planning branch.

After this plan is merged and its exact post-merge `develop` CI is green, 5.2B implementation may begin only after a separate user instruction to proceed.
