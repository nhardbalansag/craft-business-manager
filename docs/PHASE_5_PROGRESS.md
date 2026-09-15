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
    5.2B — Deterministic Dataset-to-XLSX Export           PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED
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

Delivered SheetJS CE 0.20.3 selection, the library-neutral `WorkbookCodec`, the in-memory SheetJS adapter, formula-write protection, inbound formula metadata detection, and 12 focused real-XLSX codec tests.

Final closeout:

```text
Implementation PR #140           MERGED
Implementation merge             8468edf288b014a00f4f1529442fa043084f1102
Post-merge CI                    35002844064 — SUCCESS
Docs PR #141                     MERGED
Final closeout develop           c03cee3cacbf9ed5f6a7726d380df9b461725356
Final closeout CI                35003583148 — SUCCESS
85 test files / 1060 tests
12 Phase 5.2A focused tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

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

## Phase 5.2B — Deterministic Dataset-to-XLSX Export

Status: **PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Dedicated plan:

`docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT_PLAN.md`

Planning base:

```text
develop  c03cee3cacbf9ed5f6a7726d380df9b461725356
CI       35003583148 — SUCCESS
```

### Split assessment

5.2B does **not** require deeper formal numbered sub-phases.

It remains one complete exporter gate with internal checkpoints for:

1. explicit export metadata and controlled failure boundary;
2. primary source-sheet mapping;
3. normalized child-sheet mapping;
4. canonical deterministic ordering;
5. workbook-schema self-validation;
6. real XLSX byte export through `WorkbookCodec`;
7. shuffled-order and source-semantics regression.

### Locked planning decisions

- validate the complete dataset with 5.1C before serialization;
- generate all 13 canonical sheets, including empty required sheets;
- use Phase 5.1B schema metadata as the owner of sheet/column order;
- normalize MixPreset categories/lines and YieldSample inputs into child sheets with 1-based workbook-only order fields;
- preserve missing/zero/null/false semantics exactly;
- flatten Material source metadata and Product pricing policy without inventing source evidence;
- require `exportedAt` to be explicitly injected into the pure mapper rather than reading an ambient clock;
- canonicalize top-level dataset array ordering while preserving child-array order through order columns;
- define determinism as identical canonical workbook semantics for identical dataset + metadata, not unconditional byte-for-byte ZIP identity;
- pass the generated neutral workbook through `assertWorkbookSchema(...)` before byte encoding;
- depend only on the library-neutral `WorkbookCodec` from the exporter;
- preserve formula-looking free text as literal text through real XLSX bytes;
- preserve full source numeric precision and source ISO timestamp text;
- do not export derived business outputs as authoritative source columns;
- do not implement workbook import/reconstruction, repository hydration, `ExcelStorage` runtime wiring, UI, backup, or Tauri filesystem behavior.

### Stop point

This planning step contains no 5.2B source implementation.

Implementation may begin only after the planning PR is merged to `develop`, exact post-merge CI is green, and the user separately says to proceed.

---

## Current active task

**5.2B — Deterministic Dataset-to-XLSX Export — PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED**

Do not begin 5.2B implementation until this dedicated planning PR is merged and exact post-merge `develop` CI is successful, followed by a separate user instruction to proceed.
