# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Planning baseline: `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Authoritative planning base:

`develop` @ `1d9d93c265fcadd01c3f16318bfcf7c079a432a1`

Starting exact Phase 5 planning CI:

`34982462060 — SUCCESS`

Phase 5 master-plan merge:

`develop` @ `5cf12188b8ec2d727aa5debe6a131a10168244ab`

Master-plan post-merge CI:

`34984709583 — SUCCESS`

```text
5.1 — Persisted Dataset & Workbook Contract Foundation   IN PROGRESS
    5.1A — Source Inventory & Dataset Completeness        COMPLETE
    5.1B — Workbook Schema / Sheet / Column Contracts     COMPLETE
    5.1C — Dataset Validation & Reference Integrity       NEXT / NOT STARTED

5.2 — XLSX Workbook Codec                                 NOT STARTED
    5.2A — XLSX Library Evaluation & Codec Boundary       NOT STARTED
    5.2B — Deterministic Dataset-to-XLSX Export           NOT STARTED
    5.2C — Strict XLSX-to-Dataset Import & Diagnostics    NOT STARTED

5.3 — Snapshot, Hydration & Persistence Coordination      NOT STARTED
    5.3A — Complete Source Snapshot Service               NOT STARTED
    5.3B — Validated Atomic Dataset Hydration              NOT STARTED
    5.3C — Persistence Coordinator / Load-Save Lifecycle  NOT STARTED

5.4 — Version Compatibility, Backup & Recovery Safety     NOT STARTED
    5.4A — Schema Migration & Compatibility Framework     NOT STARTED
    5.4B — Backup & Atomic-Write Transport Contract       NOT STARTED
    5.4C — Corruption, Limits & Recovery Diagnostics      NOT STARTED

5.5 — Excel Persistence UI                                NOT STARTED
    5.5A — Import / Open Workbook Workflow                NOT STARTED
    5.5B — Export / Save & Backup Workflow                NOT STARTED
    5.5C — Persistence Status / Validation / Recovery UX  NOT STARTED

5.6 — Integration & Completion Gate                       NOT STARTED
    5.6A — Integrated Excel Round-Trip Workflow           NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Locked Phase 5 decisions

- `.xlsx` is the authoritative Phase 5 workbook format; legacy `.xls`, macro-enabled `.xlsm`, and CSV are not complete database formats for v1.
- Persist authoritative source evidence only; derived costing, yield-learning, capacity, pricing, revenue, and profit outputs are recalculated.
- The persisted dataset covers every live authoritative source repository.
- **5.1A resolved the source-inventory gap:** `BusinessDataset` includes `MaterialCalibrationEvidence[]` as `materialCalibrations` and formally covers all nine current authoritative source repositories.
- Dataset schema version and workbook-format/layout version are distinct version concepts.
- **5.1B established the workbook v1 contract:** 13 authoritative schema sheets including `MixPresetCategories` for `MixPreset.compatibleCategories[]`.
- Normalized workbook sheets are used; nested authoritative arrays are not hidden as JSON blobs or delimiter-packed values in cells.
- All canonical schema sheets are required even when they contain zero source rows; a missing sheet is not equivalent to an empty source collection.
- Unknown extra user worksheets/columns are non-authoritative and may be ignored rather than guessed as source state.
- Child source arrays preserve order through required 1-based workbook-only order columns: `categoryOrder`, `lineOrder`, and `inputOrder`.
- Do not invent a `Settings` sheet until the application has a real authoritative Settings source contract.
- Free-text is literal data; spreadsheet formulas/macros are not authoritative business logic.
- Formula-looking text must export safely as text, and formula-typed cells in authoritative input fields must fail closed.
- Import validates the entire candidate dataset before any live repository mutation.
- Failed import must leave current live state unchanged.
- Cross-reference, duplicate-identity, relationship, and Product composition-cycle validation are required before hydration and remain Phase 5.1C concerns.
- Missing source evidence remains different from explicit zero after round-trip.
- Numeric source precision is not silently rounded for display.
- Source timestamps preserve deterministic ISO text semantics.
- Workbook parsing must be controlled and resource-bounded.
- Export row/column ordering must be deterministic.
- XLSX codec and storage transport are separate boundaries.
- React must use an application persistence coordinator rather than reading/writing spreadsheet cells or repositories directly.
- Snapshot/hydration operates over the complete source dataset, not individual ad hoc sheets.
- Backup/atomic-replacement sequencing belongs behind the persistence/transport boundary.
- Phase 5 tests backup/atomic semantics with an abstract/fake transport; concrete native Tauri filesystem behavior remains Phase 6.
- Browser-compatible import/export/download is Phase 5; native path/file-dialog behavior is Phase 6.
- Version migrations are explicit; unsupported future versions fail closed.
- Round-trip validation must prove Phase 1–4 service-derived behavior remains equivalent after restore.
- The concrete XLSX library is deliberately not locked before 5.2A; that task must assess maintenance, license, security, browser/Tauri compatibility, formula handling, bundle size, and testability before selection.

## Phase 5.1A — Source Inventory & Dataset Completeness

Status: **COMPLETE**

Plan:

`docs/PHASE_5_1A_PERSISTED_DATASET_SOURCE_INVENTORY_CONTRACT_COMPLETENESS_PLAN.md`

Completion record:

`docs/PHASE_5_1A_PERSISTED_DATASET_SOURCE_INVENTORY_CONTRACT_COMPLETENESS.md`

### Delivered

- `BusinessDataset` represents all nine authoritative Phase 1–4 source collections;
- calibration evidence persists as `materialCalibrations: MaterialCalibrationEvidence[]`;
- `CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1` establishes the first formally complete persisted source schema;
- `BUSINESS_DATASET_SOURCE_COLLECTION_KEYS` formalizes the complete collection inventory;
- controlled top-level completeness diagnostics fail closed on malformed/unsupported dataset envelopes;
- `createEmptyBusinessDataset()`, `cloneBusinessDataset(...)`, and `normalizeBusinessDataset(...)` establish canonical defensive source ownership;
- nested source data is defensively cloned;
- source rows are not silently repaired or defaulted;
- missing ProductStock/profile evidence remains distinct from explicit zero/null-policy evidence;
- row-level/reference/cycle validation remains intentionally deferred to 5.1C;
- no XLSX/workbook/transport/UI/Tauri behavior was introduced.

### Validation evidence

```text
Starting develop                 5cf12188b8ec2d727aa5debe6a131a10168244ab
Starting develop CI              34984709583 — SUCCESS
Plan-before-code                 26ef1a887c75cd1cd648c1884cc1d24be968ddcd
First implementation checkpoint  61728a3e62d58afa291b57e02fa288836801fda3
First checkpoint CI              34985582449 — FAILURE
Corrected implementation head    d9a87c7714e69dc0584a86dbb20f282dbeadaa4d
Implementation CI                34985739279 — SUCCESS
Documented feature head          b03313fe3260d7b293241b291b836f962e49b07c
Documented feature-head CI       34985914438 — SUCCESS
PR #131                          MERGED
PR CI                            34986078428 — SUCCESS
Implementation merge             467341eafe36e37812eb65f4cd4683dd9153868b
Post-merge develop CI            34986286733 — SUCCESS
Final closeout develop           8a1fdc2bbc5a24c20689c933b9964903d380e37c
Final closeout CI                34986791114 — SUCCESS
82 test files / 996 tests
10 Phase 5.1A tests
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

The first checkpoint failure was an expected compile-time completeness catch: one historical test fixture still constructed the old eight-collection `BusinessDataset`. Adding `materialCalibrations: []` to that fixture resolved the contract mismatch without weakening behavior.

## Phase 5.1B — Workbook Schema / Sheet / Column Contracts

Status: **COMPLETE**

Plan:

`docs/PHASE_5_1B_WORKBOOK_SCHEMA_SHEET_COLUMN_CONTRACTS_PLAN.md`

Completion record:

`docs/PHASE_5_1B_WORKBOOK_SCHEMA_SHEET_COLUMN_CONTRACTS.md`

### Delivered

- library-independent workbook contract under `src/storage`;
- format ID `craft-business-manager` and workbook format version `1`, distinct from dataset schema version `1`;
- exact 13-sheet canonical registry:
  `_Meta`, `Materials`, `Calibrations`, `MixPresets`, `MixPresetCategories`, `MixPresetLines`, `Products`, `YieldSamples`, `YieldSampleInputs`, `RecipeItems`, `ProductComponents`, `ProductStocks`, `ProductFinancialProfiles`;
- every authoritative source collection maps to an explicit primary sheet;
- exact ordered columns and source semantic mappings for all canonical sheets;
- `MixPresetCategories`, `MixPresetLines`, and `YieldSampleInputs` preserve repeated source arrays without JSON/delimiter packing;
- `categoryOrder`, `lineOrder`, and `inputOrder` preserve child array order as 1-based workbook-only metadata;
- Material supplier/source metadata is flattened into explicit one-to-one columns;
- Product pricing policy uses paired `pricingMethod` / `pricingValue` columns and preserves `pricingPolicy: null` versus explicit numeric zero;
- canonical enum/unit tokens, raw finite numeric values, canonical decimal rates, and ISO text timestamps are locked;
- authoritative text is literal-only and formula-typed authoritative cells fail closed;
- deterministic sheet/row ordering metadata is defined;
- controlled workbook structural diagnostics are implemented;
- unknown extra worksheets/columns remain non-authoritative;
- no XLSX dependency was added and `ExcelStorage` remains an intentional placeholder;
- duplicate identity, cross-reference, relationship, and Product composition-cycle validation remain 5.1C.

### Validation evidence

```text
Starting develop                 ad11e171ab7a49ea978372a3879222db8f6b112e
Starting develop CI              34988367766 — SUCCESS
First implementation checkpoint  1416c41ae0a97e74ad8b152706906514d7f85c0c
First checkpoint CI              34993126608 — FAILURE
Corrected implementation head    7782d0ad7e77c6d52db928164ba9ae1facff4d55
Corrected implementation CI      34993382846 — SUCCESS
Documented feature head          fd45db3a23bf7d00fc51e65fd36c354d61f2c5a4
Documented feature-head CI       34993513561 — SUCCESS
PR #134                          MERGED
Implementation merge             9b5ca56f8574f922218fafa18540e7b11606d4b9
Post-merge develop CI            34993623712 — SUCCESS
83 test files / 1018 tests
22 Phase 5.1B focused tests
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

The first checkpoint failed only because TypeScript could not prove the complete `WORKBOOK_SCHEMA_BY_NAME` record from an `Object.fromEntries(...)` cast. The correction used explicit typed registry construction without changing or weakening workbook behavior.

The existing Vite warning for the minified main JavaScript chunk being slightly above 500 kB remains non-blocking and unrelated to Phase 5.1B correctness.

## Current persistence foundation after 5.1B

Complete authoritative source dataset:

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

Workbook contract:

```text
13 canonical sheets
versioned workbook metadata
exact ordered columns
normalized child-array sheets
workbook-neutral structural validation
```

Current storage port remains:

```text
load() -> BusinessDataset
save(BusinessDataset)
optional createBackup(BusinessDataset)
```

Current Excel adapter remains intentionally unimplemented:

```text
ExcelStorage.load/save are placeholders and throw.
```

No `.xlsx` codec dependency is installed yet.

## Current active task

**5.1C — Dataset Validation & Reference Integrity — NEXT / NOT STARTED**

5.1C must begin with its own dedicated scope/decomposition review and development plan from the exact final green 5.1B closeout `develop` baseline.

Do **not** begin 5.1C implementation automatically as part of the 5.1B closeout.
