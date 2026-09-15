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
    5.2B — Deterministic Dataset-to-XLSX Export           COMPLETE
    5.2C — Strict XLSX-to-Dataset Import & Diagnostics    NEXT / NOT STARTED

5.3 — Snapshot, Hydration & Persistence Coordination      NOT STARTED
    5.3A — Complete Source Snapshot Service               NOT STARTED
    5.3B — Validated Atomic Dataset Hydration             NOT STARTED
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

- `.xlsx` is the authoritative Phase 5 workbook format.
- Persist authoritative source evidence only; derived business outputs are recalculated after restore.
- `BusinessDataset` covers all nine authoritative source repositories.
- Dataset schema version and workbook-format version are separate concepts.
- Workbook v1 has 13 required normalized canonical sheets.
- Child arrays use normalized child sheets with 1-based workbook-only order fields.
- Missing evidence remains distinct from explicit zero/null/false source values.
- Source numbers retain precision; source timestamps stay deterministic ISO text.
- Formula-looking text is literal source data; formula cells are not authoritative source values.
- Complete reconstructed candidates must validate before any live repository mutation.
- Workbook codec, dataset validation, repository hydration, and filesystem transport remain separate boundaries.
- SheetJS Community Edition 0.20.3 is the selected Phase 5 XLSX byte-codec library, pinned to the exact upstream tarball.
- SheetJS remains hidden behind the library-neutral `WorkbookCodec`.
- Export determinism is canonical workbook semantic determinism for identical dataset + explicit metadata; exact ZIP-byte identity is not the business contract.
- Tauri filesystem/dialog behavior remains Phase 6.

## Phase 5.1 — Persisted Dataset & Workbook Contract Foundation

Status: **COMPLETE**

### 5.1A — Source Inventory & Dataset Completeness

Final closeout:

```text
develop  8a1fdc2bbc5a24c20689c933b9964903d380e37c
CI       34986791114 — SUCCESS
82 test files / 996 tests
```

### 5.1B — Workbook Schema / Sheet / Column Contracts

Final closeout:

```text
develop  656add851d6eeb6841f2f6e11816bbd52f5028c1
CI       34994087842 — SUCCESS
83 test files / 1018 tests
22 Phase 5.1B focused tests
```

### 5.1C — Dataset Validation & Reference Integrity

Final closeout:

```text
develop  7efef34fac309f9d9745631a54bc8a8ba404415f
CI       34998382050 — SUCCESS
84 test files / 1048 tests
30 Phase 5.1C focused tests
```

Phase 5.1 established the complete source dataset contract, 13-sheet workbook schema contract, and complete pre-hydration semantic/reference/graph validation boundary.

## Phase 5.2A — XLSX Library Evaluation & Codec Boundary

Status: **COMPLETE**

Plan:
`docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY_PLAN.md`

Completion record:
`docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY.md`

Delivered SheetJS CE 0.20.3 selection, the library-neutral `WorkbookCodec`, in-memory SheetJS encode/decode, formula-write protection, inbound formula metadata detection, and 12 focused real-XLSX tests.

Final closeout:

```text
Implementation PR #140           MERGED
Implementation merge             8468edf288b014a00f4f1529442fa043084f1102
Post-merge CI                    35002844064 — SUCCESS
Docs PR #141                     MERGED
Final closeout develop           c03cee3cacbf9ed5f6a7726d380df9b461725356
Final closeout CI                35003583148 — SUCCESS
85 test files / 1060 tests
```

## Phase 5.2B — Deterministic Dataset-to-XLSX Export

Status: **COMPLETE**

Plan:
`docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT_PLAN.md`

Completion record:
`docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT.md`

Delivered:

- pure `BusinessDataset -> WorkbookNeutralDocument` mapping;
- codec-composed `BusinessDataset -> Uint8Array XLSX` export;
- pre-export Phase 5.1C dataset validation;
- all 13 canonical sheets with schema-owned column order;
- explicit `_Meta.exportedAt` injection with no hidden clock;
- flattened Material source metadata and nullable pricing policy;
- normalized MixPreset category/line and YieldSample input child sheets;
- deterministic schema-driven primary/child row ordering;
- generated-workbook schema self-validation before encoding;
- exact missing/zero/null/false semantics;
- high-precision numeric and ISO text fidelity;
- formula-looking source text preserved as literal text through real SheetJS XLSX bytes;
- controlled export errors without input mutation.

Validation evidence:

```text
First implementation head       a1811b499dd065d9c4f7783708f1c74abd92699d
First implementation CI         35007528923 — SUCCESS
Documented feature head         172f49c2a7e08c25a874593372953aab768c2885
Documented feature CI           35007663915 — SUCCESS
Implementation PR #143          MERGED
PR CI                            35007802172 — SUCCESS
Implementation merge            296960ee2f6e70999f4d279d59f977f4cf1c1d22
Post-merge develop CI           35007932757 — SUCCESS
86 test files / 1073 tests
13 Phase 5.2B focused tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE — SheetJS CE 0.20.3
Dataset -> workbook/XLSX export       COMPLETE
Workbook -> dataset reconstruction    NOT STARTED — 5.2C
ExcelStorage.load/save                placeholder
Repository snapshot/hydration         NOT STARTED — 5.3
Native filesystem                     Phase 6
```

## Current active task

**5.2C — Strict XLSX-to-Dataset Import & Diagnostics — NEXT / NOT STARTED**

5.2C must begin with its own dedicated scope/decomposition review and development plan from the exact final green 5.2B closeout baseline. Do not start 5.2C automatically as part of the 5.2B closeout.
