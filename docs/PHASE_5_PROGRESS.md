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
    5.2C — Strict XLSX-to-Dataset Import & Diagnostics    PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED

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
- Current 5.2C import is current-version only; older-version migration remains 5.4A.
- Import must reject orphan child rows and invalid child order sequences rather than silently dropping or reordering source evidence.
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

Delivered deterministic, schema-driven `BusinessDataset -> WorkbookNeutralDocument -> Uint8Array XLSX` export with pre-export 5.1C validation, all 13 canonical sheets, normalized child rows, explicit metadata, self-validation, source fidelity, and real-XLSX safety.

Final closeout:

```text
Implementation PR #143          MERGED
Implementation merge            296960ee2f6e70999f4d279d59f977f4cf1c1d22
Post-merge develop CI           35007932757 — SUCCESS
Docs PR #144                    MERGED
Final closeout develop          39ee7541b7de93e39d9963e5e1be1e80dcd07644
Final closeout CI               35008520820 — SUCCESS
86 test files / 1073 tests
13 Phase 5.2B focused tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

## Phase 5.2C — Strict XLSX-to-Dataset Import & Diagnostics

Status: **PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Dedicated plan:

`docs/PHASE_5_2C_STRICT_XLSX_TO_DATASET_IMPORT_DIAGNOSTICS_PLAN.md`

Planning base:

```text
develop  39ee7541b7de93e39d9963e5e1be1e80dcd07644
CI       35008520820 — SUCCESS
```

### Split assessment

5.2C does **not** require deeper formal numbered sub-phases.

It remains one atomic fail-closed import gate with internal checkpoints for:

1. byte decode, workbook schema, and current metadata/version validation;
2. typed primary-sheet reconstruction;
3. normalized child-sheet grouping, orphan detection, and exact `1..N` order integrity;
4. Material source metadata and nullable pricing-policy reconstruction;
5. complete candidate dataset validation through 5.1C;
6. real-XLSX round-trip and deterministic malformed-workbook diagnostics.

### Locked planning decisions

- depend only on the library-neutral `WorkbookCodec`, not SheetJS APIs;
- convert codec failures into controlled import diagnostics;
- run the existing 5.1B workbook schema validator before typed reconstruction;
- 5.2C accepts only the current workbook and dataset schema versions; migration remains 5.4A;
- expose workbook metadata separately from BusinessDataset;
- treat optional blank cells as absence while preserving explicit `0` and `false`;
- rebuild Material.source only when at least one source metadata field is present;
- rebuild nullable Product pricing policy from the validated paired fields;
- reconstruct MixPreset categories/lines and YieldSample inputs by explicit 1-based order;
- use trim-aware case-insensitive parent identity matching without rewriting authoritative parent IDs;
- reject orphan child rows, duplicate order values, gaps, and sequences that do not start at one;
- let 5.1C remain the owner of domain duplicate/reference/graph semantics after reconstruction;
- never return an accepted dataset when any blocking codec/schema/metadata/reconstruction/dataset issue exists;
- never mutate live repositories or application session state;
- unknown extra sheets/columns remain non-authoritative and are ignored under the existing schema policy;
- full hostile-file resource-limit/recovery hardening remains 5.4C;
- successful 5.2B export -> real XLSX -> 5.2C import must be source-semantically equivalent.

### Stop point

This planning step contains no 5.2C source implementation.

A separate implementation feature branch may be created only after this planning PR is merged, exact post-merge `develop` CI is green, and the user separately says to proceed.

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE — SheetJS CE 0.20.3
Dataset -> workbook/XLSX export       COMPLETE
Workbook -> dataset reconstruction    PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED — 5.2C
ExcelStorage.load/save                placeholder
Repository snapshot/hydration         NOT STARTED — 5.3
Native filesystem                     Phase 6
```

## Current active task

**5.2C — Strict XLSX-to-Dataset Import & Diagnostics — PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED**

Do not begin 5.2C implementation until the dedicated planning PR is merged and exact post-merge `develop` CI is successful, followed by a separate user instruction to proceed.
