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

5.2 — XLSX Workbook Codec                                 COMPLETE
    5.2A — XLSX Library Evaluation & Codec Boundary       COMPLETE
    5.2B — Deterministic Dataset-to-XLSX Export           COMPLETE
    5.2C — Strict XLSX-to-Dataset Import & Diagnostics    COMPLETE

5.3 — Snapshot, Hydration & Persistence Coordination      IN PROGRESS
    5.3A — Complete Source Snapshot Service               COMPLETE
    5.3B — Validated Atomic Dataset Hydration             PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED
        5.3B1 — Hydration Replacement Port & Bulk Replace NEXT / NOT STARTED
        5.3B2 — Validated Atomic Hydration + Rollback     NOT STARTED
        5.3B3 — Session/Fault Injection/Completion Gate   NOT STARTED
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
- Complete reconstructed candidates validate before any live repository mutation.
- Workbook codec, dataset validation, repository hydration, and filesystem transport remain separate boundaries.
- SheetJS Community Edition 0.20.3 is the selected XLSX byte-codec library and remains hidden behind `WorkbookCodec`.
- Export determinism is canonical workbook semantic determinism, not unconditional ZIP-byte identity.
- 5.2C import is current-version only; older-version migration remains Phase 5.4A.
- Import rejects orphan child rows, duplicate child order, gaps, and non-1-starting sequences.
- 5.3A snapshots all nine live source repositories through one application-level read-only boundary.
- 5.3A uses the centralized dataset schema version and existing deep dataset clone boundary rather than duplicating persistence ownership logic.
- 5.3A canonicalizes top-level source collection ordering without importing storage/workbook code into the application layer.
- 5.3A preserves no-row vs explicit zero/null source semantics and does not synthesize missing evidence.
- 5.3A rejects the whole snapshot when any source read fails and never performs repository writes.
- 5.3B treats an accepted `BusinessDataset` as complete replacement state, never as a patch/merge.
- 5.3B reuses the 5.1C validator before writes and the 5.3A snapshot service for rollback evidence.
- 5.3B requires a persistence-only whole-collection replacement capability for all nine live repositories because current CRUD APIs cannot remove every stale source row safely.
- 5.3B preserves repository object identity so already-wired Phase 1–4 services observe hydrated state without service-graph reconstruction.
- 5.3B must automatically restore the pre-hydration snapshot when a replacement fails; rollback failure is a distinct severe diagnostic and is never reported as success.
- Hydration does not replay ordinary business service create/update/delete workflows and does not synthesize defaults or derived outputs.
- Tauri filesystem/dialog behavior remains Phase 6.

## Phase 5.1 — Persisted Dataset & Workbook Contract Foundation

Status: **COMPLETE**

```text
5.1A final develop  8a1fdc2bbc5a24c20689c933b9964903d380e37c
5.1A CI             34986791114 — SUCCESS

5.1B final develop  656add851d6eeb6841f2f6e11816bbd52f5028c1
5.1B CI             34994087842 — SUCCESS

5.1C final develop  7efef34fac309f9d9745631a54bc8a8ba404415f
5.1C CI             34998382050 — SUCCESS
```

Phase 5.1 established the complete nine-collection source dataset contract, 13-sheet workbook schema contract, and pre-hydration semantic/reference/graph validation boundary.

## Phase 5.2A — XLSX Library Evaluation & Codec Boundary

Status: **COMPLETE**

Plan: `docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY_PLAN.md`  
Completion record: `docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY.md`

```text
Implementation PR #140           MERGED
Implementation merge             8468edf288b014a00f4f1529442fa043084f1102
Post-merge CI                    35002844064 — SUCCESS
Docs PR #141                     MERGED
Final closeout develop           c03cee3cacbf9ed5f6a7726d380df9b461725356
Final closeout CI                35003583148 — SUCCESS
85 test files / 1060 tests
12 Phase 5.2A focused tests
```

Delivered SheetJS CE 0.20.3 selection, the library-neutral `WorkbookCodec`, in-memory encode/decode, formula-write protection, inbound formula metadata detection, and real-XLSX tests.

## Phase 5.2B — Deterministic Dataset-to-XLSX Export

Status: **COMPLETE**

Plan: `docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT_PLAN.md`  
Completion record: `docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT.md`

```text
Implementation PR #143          MERGED
Implementation merge            296960ee2f6e70999f4d279d59f977f4cf1c1d22
Post-merge CI                   35007932757 — SUCCESS
Docs PR #144                    MERGED
Final closeout develop          39ee7541b7de93e39d9963e5e1be1e80dcd07644
Final closeout CI               35008520820 — SUCCESS
86 test files / 1073 tests
13 Phase 5.2B focused tests
```

Delivered deterministic, schema-driven `BusinessDataset -> WorkbookNeutralDocument -> Uint8Array XLSX` export with all 13 sheets, normalized child rows, explicit metadata, schema self-validation, and source-fidelity guarantees.

## Phase 5.2C — Strict XLSX-to-Dataset Import & Diagnostics

Status: **COMPLETE**

Plan: `docs/PHASE_5_2C_STRICT_XLSX_TO_DATASET_IMPORT_DIAGNOSTICS_PLAN.md`  
Completion record: `docs/PHASE_5_2C_STRICT_XLSX_TO_DATASET_IMPORT_DIAGNOSTICS.md`

Delivered:

- library-neutral `WorkbookCodec` decode boundary;
- structured codec/schema/metadata/reconstruction/dataset diagnostics;
- current workbook/dataset version validation;
- reconstruction of all nine authoritative source collections;
- separate imported workbook metadata;
- Material source metadata and nullable pricing-policy reconstruction;
- MixPreset category/line and YieldSample input child reconstruction;
- trim-aware case-insensitive child-parent matching;
- orphan child and exact `1..N` order integrity rejection;
- final Phase 5.1C candidate validation;
- real XLSX 5.2B export -> 5.2C import semantic round-trip;
- no repository/session mutation.

Validation evidence:

```text
First feature head             303b407e264ec044050ae83cd88f0765de57cb5b
First CI                       35011783520 — FAILURE (test typing only)
Corrected head                 7be98fd98bf54fd16364b670122a1dd54925e9c0
Corrected CI                   35011990682 — SUCCESS
Documented feature head        5a7a75c3a29f010876c8bf305e9461e109278cff
Documented feature CI          35012125040 — SUCCESS
Implementation PR #146        MERGED
PR CI                          35012225167 — SUCCESS
Implementation merge          3cd2bb280ef463b2267cafbbd28b9b9aba1fb656
Post-merge develop CI         35012385953 — SUCCESS
87 test files / 1091 tests
18 Phase 5.2C focused tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

## Phase 5.2 completion result

```text
BusinessDataset -> canonical workbook -> XLSX bytes   COMPLETE
XLSX bytes -> canonical workbook -> BusinessDataset   COMPLETE
```

The codec/mapping layer is bidirectional and fail-closed. Repository snapshot, hydration, and load/save lifecycle remain separate application responsibilities.

## Phase 5.3A — Complete Source Snapshot Service

Status: **COMPLETE**

Plan: `docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE_PLAN.md`  
Completion record: `docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE.md`

Delivered:

- application-level `CompleteSourceSnapshotService` over all nine authoritative repository interfaces;
- centralized `CURRENT_BUSINESS_DATASET_SCHEMA_VERSION` assignment;
- deterministic top-level source collection ordering by durable identity;
- final deep defensive ownership through `cloneBusinessDataset(...)`;
- preservation of nested source representation and explicit zero/null/absence semantics;
- all-or-nothing behavior when any repository read fails;
- no repository writes, source repair, or derived business outputs;
- shared `completeSourceSnapshotService` session composition;
- focused empty/complete/order/isolation/evidence/failure regression coverage.

Validation evidence:

```text
Planning PR #148              MERGED
Planning merge                e395166246cff04cdefcecf1a5f9c0477e97b437
Planning post-merge CI        35018499386 — SUCCESS
Implementation head           73b67db22da2287c74fb57cd8f3e62f38b32a1a9
Implementation PR #149        MERGED
Feature/PR CI                  35018972923 — SUCCESS
Implementation merge          2d475f0eded6acafeb03830cba768b3d84cb078d
Post-merge develop CI         35019082343 — SUCCESS
5 focused Phase 5.3A tests
TypeScript typecheck passed
Full test suite passed
Production Vite build passed
```

## Phase 5.3B — Validated Atomic Dataset Hydration

Status: **PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Dedicated plan:

`docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION_PLAN.md`

Planning base:

```text
develop  37eae3f97ae44bc439d90d215a199debcf933b4c
CI       35019405824 — SUCCESS
```

### Split assessment

5.3B requires three formal implementation sub-phases:

```text
5.3B1 — Hydration Replacement Port & Repository Bulk Replace
5.3B2 — Validated Atomic Hydration Service & Rollback
5.3B3 — Session Integration, Fault Injection & Completion Gate
```

The split is required because the existing repository CRUD APIs cannot express complete replacement safely. Some repositories cannot delete stale records, some intentionally omit normal update behavior, and none currently expose a whole-collection transactional hydration capability.

### Locked planning decisions

- the candidate is a complete replacement dataset, not a patch;
- validate with `validateBusinessDatasetIntegrity(...)` before any write;
- use a dedicated persistence-only `CollectionReplacementPort<T>`-style capability rather than teaching React to call repository CRUD directly;
- every repository replacement must stage/clone its complete next collection before exposing it as live state;
- stale rows absent from the candidate must be removed;
- empty candidate collections clear their repositories;
- use `cloneBusinessDataset(...)` for hydration-owned candidate state;
- use `CompleteSourceSnapshotService` for the pre-hydration rollback dataset;
- preserve repository object identity so existing services remain wired correctly;
- do not replay business service create/update/delete workflows during hydration;
- preserve missing-vs-zero/null/false semantics;
- on apply failure, automatically restore the previous complete snapshot;
- distinguish safe restored apply failure from rollback failure;
- do not report rollback failure as successful hydration;
- keep load/save lifecycle orchestration in 5.3C and file backup/atomic transport in 5.4B.

### Stop point

This planning step contains no 5.3B runtime implementation.

After the planning PR is merged and its exact post-merge `develop` CI is green, a separate implementation feature branch may begin with 5.3B1 only after a separate user instruction to proceed.

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE — SheetJS CE 0.20.3
Dataset -> workbook/XLSX export       COMPLETE
Workbook -> dataset reconstruction    COMPLETE
Repository snapshot service           COMPLETE — 5.3A
Validated repository hydration        PLAN ESTABLISHED — 5.3B / 5.3B1 NEXT
Persistence coordinator/load-save     NOT STARTED — 5.3C
ExcelStorage.load/save                placeholder
Native filesystem                     Phase 6
```

## Current active task

**5.3B1 — Hydration Replacement Port & Repository Bulk Replace — NEXT / NOT STARTED**

Do not begin 5.3B1 implementation until the dedicated 5.3B planning PR is merged and the exact post-merge `develop` CI is successful, followed by a separate user instruction to proceed.
