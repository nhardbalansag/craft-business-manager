# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Authoritative Phase 5 planning base:

```text
develop  1d9d93c265fcadd01c3f16318bfcf7c079a432a1
CI       34982462060 — SUCCESS
```

Phase 5 master-plan merge:

```text
develop  5cf12188b8ec2d727aa5debe6a131a10168244ab
CI       34984709583 — SUCCESS
```

## Live task map

```text
5.1 — Persisted Dataset & Workbook Contract Foundation   COMPLETE
    5.1A — Source Inventory & Dataset Completeness        COMPLETE
    5.1B — Workbook Schema / Sheet / Column Contracts     COMPLETE
    5.1C — Dataset Validation & Reference Integrity       COMPLETE

5.2 — XLSX Workbook Codec                                 IN PROGRESS
    5.2A — XLSX Library Evaluation & Codec Boundary       COMPLETE
    5.2B — Deterministic Dataset-to-XLSX Export           NEXT / NOT STARTED
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

---

## Locked Phase 5 decisions

- `.xlsx` is the authoritative Phase 5 workbook format; `.xls`, `.xlsm`, and CSV are not complete v1 database formats.
- Persist authoritative source evidence only. Derived costing, yield-learning, capacity, pricing, revenue, and profit outputs are recalculated after restore.
- `BusinessDataset` covers all nine current authoritative source repositories.
- Dataset schema version and workbook-format/layout version are distinct version concepts.
- Workbook v1 has 13 required normalized canonical sheets, including `MixPresetCategories`, `MixPresetLines`, and `YieldSampleInputs` child sheets.
- All canonical schema sheets are required even when source collections are empty.
- Unknown extra workbook sheets/columns are non-authoritative and must not be guessed as application source state.
- Child source arrays preserve order with workbook-only 1-based `categoryOrder`, `lineOrder`, and `inputOrder` fields.
- No Settings sheet is invented until a real authoritative Settings source model exists.
- Free text is literal source data; formulas/macros are never authoritative business logic.
- Formula-looking source text must remain literal; formula cells in authoritative source fields fail closed.
- Import validates a complete reconstructed candidate before any live repository mutation.
- Failed validation/import must leave current live state unchanged.
- Missing evidence remains distinct from explicit zero/null source values.
- Numeric source precision is not silently rounded and timestamps use deterministic ISO text semantics.
- Export sheet/column/row ordering must be deterministic.
- Workbook codec, dataset semantic validation, repository hydration, and filesystem transport are separate boundaries.
- React must use application persistence coordination rather than directly reading/writing spreadsheet cells or repositories.
- Native Tauri paths/dialogs/filesystem behavior remains Phase 6.
- Unsupported future versions fail closed; migrations are explicit.
- Round-trip validation must prove Phase 1–4 derived behavior remains equivalent after restore.
- **SheetJS Community Edition 0.20.3 is the selected Phase 5 XLSX byte-codec library.**
- The selected SheetJS package is pinned to the exact upstream tarball `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; do not substitute the stale public npm `xlsx` registry release.
- SheetJS is hidden behind the library-neutral `WorkbookCodec`; third-party workbook types must not leak into domain/application/React/StoragePort/Tauri contracts.
- The codec is in-memory only: `Uint8Array` output and `Uint8Array | ArrayBuffer` input.
- The codec refuses outbound formula objects and surfaces inbound formulas as neutral `WorkbookFormulaCell` metadata for later fail-closed schema validation.
- Reassess vendoring the pinned SheetJS tarball plus Apache-2.0 attribution before production packaging/distribution.
- Re-measure client bundle impact when persistence becomes reachable from the React application and prefer deferred/dynamic loading if useful.

---

## Phase 5.1 — Persisted Dataset & Workbook Contract Foundation

Status: **COMPLETE**

### 5.1A — Source Inventory & Dataset Completeness

Plan:
`docs/PHASE_5_1A_PERSISTED_DATASET_SOURCE_INVENTORY_CONTRACT_COMPLETENESS_PLAN.md`

Completion record:
`docs/PHASE_5_1A_PERSISTED_DATASET_SOURCE_INVENTORY_CONTRACT_COMPLETENESS.md`

Delivered the complete nine-collection, versioned `BusinessDataset`, added `materialCalibrations`, established completeness/clone/normalize helpers, and preserved missing-vs-zero/null source semantics.

Final closeout:

```text
develop  8a1fdc2bbc5a24c20689c933b9964903d380e37c
CI       34986791114 — SUCCESS
82 test files / 996 tests
```

### 5.1B — Workbook Schema / Sheet / Column Contracts

Plan:
`docs/PHASE_5_1B_WORKBOOK_SCHEMA_SHEET_COLUMN_CONTRACTS_PLAN.md`

Completion record:
`docs/PHASE_5_1B_WORKBOOK_SCHEMA_SHEET_COLUMN_CONTRACTS.md`

Delivered the library-independent 13-sheet workbook v1 schema, exact columns, normalized child relationships, canonical value representation, deterministic ordering, formula policy, and workbook-neutral structural diagnostics.

Final closeout:

```text
develop  656add851d6eeb6841f2f6e11816bbd52f5028c1
CI       34994087842 — SUCCESS
83 test files / 1018 tests
22 Phase 5.1B focused tests
```

### 5.1C — Dataset Validation & Reference Integrity

Plan:
`docs/PHASE_5_1C_DATASET_VALIDATION_REFERENCE_INTEGRITY_PLAN.md`

Completion record:
`docs/PHASE_5_1C_DATASET_VALIDATION_REFERENCE_INTEGRITY.md`

Delivered complete pre-hydration semantic validation across all nine collections, duplicate identity detection before repository construction, durable cross-references, Product graph integrity reuse, deterministic diagnostics, historical archived-state preservation, and no silent repair.

Final closeout:

```text
develop  7efef34fac309f9d9745631a54bc8a8ba404415f
CI       34998382050 — SUCCESS
84 test files / 1048 tests
30 Phase 5.1C focused tests
```

### Phase 5.1 completion result

```text
BusinessDataset contract
    9 authoritative source collections
    versioned complete source envelope

Workbook schema contract
    13 canonical normalized sheets
    exact sheet/column/representation rules

Dataset integrity contract
    complete pre-hydration source validation
    duplicate/reference/graph diagnostics
```

---

## Phase 5.2A — XLSX Library Evaluation & Codec Boundary

Status: **COMPLETE**

Plan:

`docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY_PLAN.md`

Completion record:

`docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY.md`

### Delivered

- selected **SheetJS Community Edition 0.20.3** after current maintenance/license/security/browser/byte/formula evaluation;
- pinned the exact maintained upstream release tarball in `package.json`;
- established `src/storage/workbookCodec.ts` as a library-neutral byte codec boundary;
- implemented `src/storage/sheetJsWorkbookCodec.ts` as the SheetJS-only adapter;
- proved fully in-memory XLSX encode/decode;
- proved `Uint8Array` output and `Uint8Array | ArrayBuffer` input;
- preserved worksheet order;
- preserved formula-looking user strings as literal text;
- prohibited authoritative formula writes;
- surfaced inbound XLSX formulas as neutral metadata without evaluating them;
- connected formula metadata to the existing `FORMULA_CELL_NOT_ALLOWED` workbook-schema policy;
- added controlled codec errors;
- introduced no filesystem/Tauri dependency;
- added 12 focused real-XLSX codec tests;
- left `BusinessDataset -> workbook` mapping, workbook reconstruction, and `ExcelStorage` runtime behavior for later tasks.

### Validation history

```text
Planning baseline               e5707cc297887a9817957c2ac658caeb18d42d21
Planning baseline CI            35001226969 — SUCCESS
Initial spike head              62feaef38bebbe52bc903f5b17da6572e5495550
Initial spike CI                35002241556 — FAILURE (strict TS callback typing only)
Corrected spike head            e1ae246b7d31c35330a2f1fb7d1624797700c004
Corrected spike CI              35002380964 — SUCCESS
Documented feature head         44a60d0032391ee99c6550fd4c6ae1b0d651ad94
Documented feature CI           35002575999 — SUCCESS
PR #140                         MERGED
PR CI                           35002720788 — SUCCESS
Implementation merge            8468edf288b014a00f4f1529442fa043084f1102
Post-merge develop CI           35002844064 — SUCCESS
85 test files / 1060 tests
12 Phase 5.2A focused tests
8 React workspace smoke tests
7 Phase 4.6A integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

The first 5.2A checkpoint failed only because one strict TypeScript callback parameter became implicit `any` after `Array.isArray` narrowing. The SheetJS package installation itself succeeded; typing was corrected without changing behavior.

### Current persistence boundary after 5.2A

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library selection                COMPLETE — SheetJS CE 0.20.3
Library-neutral workbook byte codec   COMPLETE
SheetJS in-memory byte adapter        COMPLETE
Dataset -> workbook export mapping    NOT STARTED — 5.2B
Workbook -> dataset reconstruction    NOT STARTED — 5.2C
ExcelStorage.load/save                placeholder
Repository snapshot/hydration         NOT STARTED — 5.3
Native filesystem                     Phase 6
```

---

## Current active task

**5.2B — Deterministic Dataset-to-XLSX Export — NEXT / NOT STARTED**

5.2B must begin separately from the exact final green 5.2A closeout baseline. Before implementation, perform its dedicated scope/decomposition review and create its development plan. Do not start 5.2B automatically as part of this closeout.
