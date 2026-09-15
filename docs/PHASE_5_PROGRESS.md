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
    5.3A — Complete Source Snapshot Service               PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED
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
- Complete reconstructed candidates validate before any live repository mutation.
- Workbook codec, dataset validation, repository hydration, and filesystem transport remain separate boundaries.
- SheetJS Community Edition 0.20.3 is the selected XLSX byte-codec library and remains hidden behind `WorkbookCodec`.
- Export determinism is canonical workbook semantic determinism, not unconditional ZIP-byte identity.
- 5.2C import is current-version only; older-version migration remains Phase 5.4A.
- Import rejects orphan child rows, duplicate child order, gaps, and non-1-starting sequences.
- 5.3A snapshots all nine live source repositories through one application-level read-only boundary.
- 5.3A uses the centralized dataset schema version and existing deep dataset clone boundary rather than duplicating persistence ownership logic.
- 5.3A canonicalizes top-level source collection ordering without importing storage/workbook code into the application layer.
- 5.3A does not hydrate, save, load, mutate repositories, or persist derived business results.
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

The codec/mapping layer is now bidirectional and fail-closed. Repository snapshot, hydration, and load/save lifecycle remain intentionally outside Phase 5.2.

## Phase 5.3A — Complete Source Snapshot Service

Status: **PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Dedicated plan:

`docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE_PLAN.md`

Planning base:

```text
develop  5109c7f045835ca4835349d49eff5ff3681cc8fc
CI       35012885175 — SUCCESS
```

### Split assessment

5.3A does **not** require deeper formal numbered sub-phases.

It remains one cohesive read-only application boundary with internal checkpoints for:

1. the nine-repository dependency contract;
2. complete source collection reads with no derived-service calls;
3. deterministic top-level source ordering;
4. current schema-version assignment and deep defensive snapshot ownership;
5. shared session composition without React repository enumeration;
6. complete/empty/deterministic/non-mutating/failure regression tests.

### Locked planning decisions

- depend on the nine repository interfaces, not concrete in-memory repository classes;
- populate exactly the nine current `BusinessDataset` source collections;
- use `CURRENT_BUSINESS_DATASET_SCHEMA_VERSION` centrally;
- reuse `cloneBusinessDataset(...)` as the final deep defensive ownership boundary;
- canonicalize top-level repository collections by durable identity while preserving nested source-array representation;
- do not import workbook/export/storage ordering code into the application layer;
- perform no repository write operation and no source repair/default synthesis;
- preserve no-row vs explicit zero/null/false source semantics;
- reject the snapshot operation if any repository read fails rather than return partial data;
- expose one shared `completeSourceSnapshotService`-style boundary from `session.ts`;
- keep full candidate semantic/reference/graph validation owned by the existing 5.1C validator rather than duplicating those rules;
- keep hydration/atomic replacement in 5.3B;
- keep load/save orchestration and user-facing persistence diagnostics in 5.3C;
- keep workbook codecs, browser/native filesystem behavior, and persistence UI outside 5.3A.

### Stop point

This planning step contains no 5.3A runtime/source implementation.

A separate implementation feature branch may be created only after this planning PR is merged, exact post-merge `develop` CI is green, and the user separately says to proceed.

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE — SheetJS CE 0.20.3
Dataset -> workbook/XLSX export       COMPLETE
Workbook -> dataset reconstruction    COMPLETE
Repository snapshot service           PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED — 5.3A
Validated repository hydration        NOT STARTED — 5.3B
Persistence coordinator/load-save     NOT STARTED — 5.3C
ExcelStorage.load/save                placeholder
Native filesystem                     Phase 6
```

## Current active task

**5.3A — Complete Source Snapshot Service — PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED**

Do not begin 5.3A implementation until the dedicated planning PR is merged and exact post-merge `develop` CI is successful, followed by a separate user instruction to proceed.
