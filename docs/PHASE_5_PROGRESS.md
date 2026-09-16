# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

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

5.3 — Snapshot, Hydration & Persistence Coordination      COMPLETE
    5.3A — Complete Source Snapshot Service               COMPLETE
    5.3B — Validated Atomic Dataset Hydration             COMPLETE
        5.3B1 — Hydration Replacement Port & Bulk Replace COMPLETE
        5.3B2 — Validated Atomic Hydration + Rollback     COMPLETE
        5.3B3 — Session/Fault Injection/Completion Gate   COMPLETE
    5.3C — Persistence Coordinator / Load-Save Lifecycle  COMPLETE
        5.3C1 — Persistence Lifecycle & Workbook Transport Contract  COMPLETE
        5.3C2 — Snapshot-to-XLSX Export / Save Orchestration         COMPLETE
        5.3C3 — XLSX Load / Import / Hydrate & Completion Gate       COMPLETE

5.4 — Version Compatibility, Backup & Recovery Safety     NEXT / NOT STARTED
    5.4A — Schema Migration & Compatibility Framework     NEXT / NOT STARTED
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
- Persist authoritative source evidence only; derived outputs are recalculated after restore.
- `BusinessDataset` covers all nine authoritative source repositories.
- Dataset schema version and workbook format version remain separate.
- Workbook v1 has 13 normalized canonical sheets.
- Missing evidence stays distinct from explicit zero/null/false.
- Formula cells are not authoritative source values; formula-looking text stays literal.
- SheetJS CE 0.20.3 is hidden behind the library-neutral `WorkbookCodec`.
- Import/export mapping is bidirectional, current-version-only, and fail-closed.
- Complete reconstructed candidates validate before any live repository mutation.
- 5.3A snapshots all nine source repositories through one application-level read boundary.
- 5.3B treats a candidate `BusinessDataset` as complete replacement state, never a patch/merge.
- 5.3B validates with `validateBusinessDatasetIntegrity(...)` before writes and uses the 5.3A snapshot as rollback evidence.
- 5.3B uses persistence-only whole-collection replacement instead of replaying ordinary business CRUD workflows.
- 5.3B1 established `CollectionReplacementPort<T>` across all nine in-memory repositories with staged cloned `Map` replacement, stale-row removal, empty clearing, preserved repository identity, and pre-swap failure safety.
- 5.3B2 coordinates all nine replacements through `ValidatedAtomicDatasetHydrationService`, restores the complete pre-hydration snapshot when apply fails, and distinguishes snapshot, restored-apply, and rollback-failure diagnostics.
- 5.3B3 wires one shared hydration boundary into the application session and proves the parent atomicity contract with controlled failures at all nine replacement boundaries.
- Optional source-field absence is source evidence: clone/hydration boundaries may not synthesize an own property merely with `undefined` when the source field was absent.
- Rollback failure remains a distinct severe diagnostic and may never be reported as successful hydration.
- 5.3C is formally split into C1 lifecycle/transport contract, C2 export/save orchestration, and C3 load/import/hydrate completion.
- 5.3C transport is workbook-byte oriented; it must not expose a second dataset-level `load(): BusinessDataset` / `save(dataset)` persistence path.
- 5.3C1 removed the obsolete `StoragePort` / placeholder `ExcelStorage` scaffold and established `WorkbookTransport` over defensive workbook-byte ownership.
- 5.3C1 defines only neutral backup request/receipt semantics; detailed backup creation, staged writes, atomic replacement, cleanup, and recovery remain 5.4B.
- 5.3C1 defines stable lifecycle stages/codes and preserves structured import rejection plus distinct severe rollback-failure context.
- 5.3C2 establishes one application-level `PersistenceCoordinator` for the non-destructive snapshot -> XLSX export -> optional transport-save lifecycle.
- 5.3C2 obtains `exportedAt` through an injectable clock, keeps `applicationVersion` optional, preserves lower-level export/codec causes, and maps snapshot/export/transport-save operational stages without mutating live state.
- 5.3C2 forwards only neutral backup intent/receipt and does not claim detailed backup or atomic-write semantics.
- 5.3C3 routes both caller-provided and transport-loaded workbook bytes through the same strict 5.2C import boundary and the same 5.3B validated atomic hydration service.
- Expected invalid workbooks remain structured import rejections and never call hydration.
- Hydration snapshot failure, restored apply failure, and rollback failure map to distinct coordinator codes while retaining the original `DatasetHydrationError` context.
- One shared `persistenceCoordinator` is wired into the application session over the existing shared snapshot/hydration boundaries and concrete SheetJS codec.
- Complete lifecycle regression proves save A -> mutate B -> load -> exact A restore, existing-service observation, zero-write rejection paths, rollback guarantees, source-fidelity semantics, defensive byte ownership, and exclusion of derived outputs.
- 5.3C owns load/save lifecycle orchestration; 5.4B owns backup/atomic filesystem transport; Phase 6 owns native Tauri filesystem behavior.

## Completed persistence foundation

### Phase 5.1 — COMPLETE

```text
5.1A final develop  8a1fdc2bbc5a24c20689c933b9964903d380e37c
5.1A CI             34986791114 — SUCCESS
5.1B final develop  656add851d6eeb6841f2f6e11816bbd52f5028c1
5.1B CI             34994087842 — SUCCESS
5.1C final develop  7efef34fac309f9d9745631a54bc8a8ba404415f
5.1C CI             34998382050 — SUCCESS
```

### Phase 5.2 — COMPLETE

```text
5.2A implementation PR #140   MERGED
5.2A final CI                 35003583148 — SUCCESS
5.2B implementation PR #143   MERGED
5.2B final CI                 35008520820 — SUCCESS
5.2C implementation PR #146   MERGED
5.2C implementation merge     3cd2bb280ef463b2267cafbbd28b9b9aba1fb656
5.2C post-merge CI            35012385953 — SUCCESS
87 test files / 1091 tests after 5.2C
```

5.2 provides complete fail-closed bidirectional mapping:

```text
BusinessDataset -> canonical workbook -> XLSX bytes   COMPLETE
XLSX bytes -> canonical workbook -> BusinessDataset   COMPLETE
```

### Phase 5.3A — COMPLETE

Plan: `docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE_PLAN.md`  
Completion: `docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE.md`

```text
Planning PR #148             MERGED
Planning CI                  35018499386 — SUCCESS
Implementation PR #149       MERGED
Implementation merge         2d475f0eded6acafeb03830cba768b3d84cb078d
Post-merge CI                35019082343 — SUCCESS
5 focused snapshot tests
```

Delivered complete deterministic deep-cloned snapshots over all nine repositories with current dataset schema version and all-or-nothing read behavior.

## Phase 5.3B — Validated Atomic Dataset Hydration — COMPLETE

Parent plan:

`docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION_PLAN.md`

Parent completion record:

`docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION.md`

Planning closeout baseline before B1:

```text
develop  3552385ed84deab2500b69cf9e8fbd1538bde1a0
CI       35020396594 — SUCCESS
```

### 5.3B1 — Hydration Replacement Port & Repository Bulk Replace

Status: **COMPLETE**

Completion record:

`docs/PHASE_5_3B1_HYDRATION_REPLACEMENT_PORT_BULK_REPLACE.md`

```text
Feature head               74e70a22b2a8b24cd1cb49f44f37502a1555b53b
Feature CI                 35021376680 — SUCCESS
Implementation PR #152     MERGED
PR CI                      35021553326 — SUCCESS
Implementation merge       6abd24123c3593582fdc4767bd486b319fc2ce2c
Post-merge develop CI      35021692593 — SUCCESS
89 test files / 1105 tests
9 focused 5.3B1 replacement tests
TypeScript typecheck passed
Production Vite build passed
119 modules transformed
```

Delivered generic persistence-only whole-collection replacement over all nine source repositories with staged cloned state, stale-row removal, empty clearing, defensive ownership, repository identity preservation, and pre-swap failure safety.

### 5.3B2 — Validated Atomic Hydration + Rollback

Status: **COMPLETE**

Completion record:

`docs/PHASE_5_3B2_VALIDATED_ATOMIC_HYDRATION_ROLLBACK.md`

```text
Feature head               55604886406403055a06badeb7d8f5e74e155da2
Implementation PR #154     MERGED
PR CI                      35033331003 — SUCCESS
Implementation merge       73f1bf3b28c5632a53d8958a7517d19e0eedb195
Post-merge develop CI      35033404012 — SUCCESS
90 test files / 1110 tests
5 focused 5.3B2 hydration tests
TypeScript typecheck passed
Production Vite build passed
119 modules transformed
```

Delivered validation-before-write, hydration-owned cloning, pre-hydration rollback snapshotting, deterministic nine-repository replacement, automatic rollback, and controlled `SNAPSHOT_FAILED`, `APPLY_FAILED_RESTORED`, and `ROLLBACK_FAILED` diagnostics.

### 5.3B3 — Session Integration, Fault Injection & Completion Gate

Status: **COMPLETE**

```text
Authoritative baseline     7ff9d51b0965add105e1c58943a2852f61d11145
Baseline CI                35033683723 — SUCCESS
Initial feature head       b7e207f714172e690d787b3f46f3902be6817cd9
Initial CI                 35034071494 — FAILURE
Corrected feature head     929f09049d9e24857ee2389688e8a64d9e24a70c
Implementation PR #156     MERGED
PR CI                      35034176226 — SUCCESS
Implementation merge       50d0ae082095e4c3f397bee5a8b8d276ace93a26
Post-merge develop CI      35034304286 — SUCCESS
91 test files / 1128 tests
18 focused 5.3B3 completion tests
TypeScript typecheck passed
Production Vite build passed
121 modules transformed
```

Delivered:

- one shared `validatedAtomicDatasetHydrationService` in the application session;
- exhaustive forward failure injection at all nine replacement boundaries;
- exact previous-state restoration proof after every tested apply failure;
- zero-write proof for invalid candidates and pre-write snapshot failure;
- distinct rollback-failure context proof;
- complete replacement, stale-row removal, and empty-dataset clearing proof;
- missing versus explicit zero/null source-fidelity proof;
- defensive ownership proof;
- preservation of truly absent optional Material source metadata;
- already-wired service observation after hydration without rebuilding repositories/services;
- UI boundary verification showing editing views continue through application services rather than persistence replacement ports.

The initial B3 CI failure identified a real fidelity defect in `cloneMaterial(...)`: absent `source` metadata became an own property with value `undefined`. The clone boundary was corrected; the assertion was retained and the corrected head passed the complete suite.

### Phase 5.3B parent closeout

```text
Closeout PR                #157 — MERGED
Final develop              8e6935d4abcebd3c31e8c1237fc71995130793fa
Final CI                   35034624914 — SUCCESS
```

## Phase 5.3C — Persistence Coordinator / Load-Save Lifecycle — COMPLETE

Dedicated plan:

`docs/PHASE_5_3C_PERSISTENCE_COORDINATOR_LOAD_SAVE_LIFECYCLE_PLAN.md`

Parent completion record:

`docs/PHASE_5_3C_PERSISTENCE_COORDINATOR_LOAD_SAVE_LIFECYCLE.md`

Planning baseline:

```text
develop  8e6935d4abcebd3c31e8c1237fc71995130793fa
CI       35034624914 — SUCCESS
Planning PR #158            MERGED
Planning merge              a9eae16a2439fc8fbb458b4e370d858674ac087d
Planning post-merge CI      35035328007 — SUCCESS
```

Locked decomposition:

```text
5.3C1 — Persistence Lifecycle & Workbook Transport Contract  COMPLETE
5.3C2 — Snapshot-to-XLSX Export / Save Orchestration         COMPLETE
5.3C3 — XLSX Load / Import / Hydrate & Completion Gate       COMPLETE
```

### 5.3C1 — Persistence Lifecycle & Workbook Transport Contract

Status: **COMPLETE**

Completion record:

`docs/PHASE_5_3C1_PERSISTENCE_LIFECYCLE_WORKBOOK_TRANSPORT.md`

```text
Authoritative baseline     a9eae16a2439fc8fbb458b4e370d858674ac087d
Baseline CI                35035328007 — SUCCESS
Feature head               b3bbb9b2a524289f73940ab951cbd96d61d9bc6c
Implementation PR #159     MERGED
PR CI                      35036181681 — SUCCESS
Implementation merge       5f37670d0b1865ceb691980c6c6f6864771ca07c
Post-merge develop CI      35036255261 — SUCCESS
93 test files / 1140 tests
12 focused 5.3C1 tests
TypeScript typecheck passed
Production Vite build passed
121 modules transformed
```

Delivered:

- byte-only `WorkbookTransport` contract;
- defensive workbook-byte ownership helper;
- neutral backup request/receipt vocabulary without implementing Phase 5.4B semantics;
- reusable `InMemoryWorkbookTransport` for later coordinator integration tests;
- stable persistence lifecycle stages and operational codes;
- structured workbook-import and hydration rejection result vocabulary;
- distinct severe hydration rollback-failure code;
- removal of obsolete dataset-level `StoragePort` and placeholder `ExcelStorage`;
- regression proof that the removed scaffold had no active compile-time consumers.

### 5.3C2 — Snapshot-to-XLSX Export / Save Orchestration

Status: **COMPLETE**

Completion record:

`docs/PHASE_5_3C2_SNAPSHOT_XLSX_EXPORT_SAVE_ORCHESTRATION.md`

```text
Authoritative baseline     1deddb42ff0b451fe0d5cbdbf1563e43767f31f0
Baseline CI                35036482810 — SUCCESS
Feature head               9781330de883d21537969e4649be8d6c37eb5dad
Implementation PR #161     MERGED
PR CI                      35036820512 — SUCCESS
Implementation merge       78f0444029905db801a53427e8c9b3bb3d119d69
Post-merge develop CI      35036895766 — SUCCESS
94 test files / 1147 tests
7 focused 5.3C2 coordinator tests
TypeScript typecheck passed
Production Vite build passed
121 modules transformed
```

Delivered:

- one application-level `PersistenceCoordinator` for current source export/save;
- complete 5.3A snapshot reuse rather than direct repository enumeration;
- deterministic injectable export clock and optional application-version metadata;
- direct `exportCurrentWorkbook()` returning caller-owned XLSX bytes and metadata;
- transport-backed `saveCurrentWorkbook()` using the C1 byte transport;
- forwarding of neutral backup intent and receipt without implementing backup internals;
- distinct snapshot, export/encode, and transport-save failure stages/codes;
- retained lower-level exporter/codec/transport causes;
- regression proof that failed export/save does not mutate source state.

### 5.3C3 — XLSX Load / Import / Hydrate & Completion Gate

Status: **COMPLETE**

```text
Authoritative baseline     beb97dbac0325425a21cdfaaaf4cb7cca45b0666
Baseline CI                35037111736 — SUCCESS
Initial feature head       c9a196cbdd75d8ea8ee4036c348374c33f1e51d3
Initial CI                 35038280781 — FAILURE (test fixture typecheck)
Intermediate head          4c5efd4cd156fe14c7d7a3c1adc3b8fbec5bd1b6
Intermediate CI            35038384023 — FAILURE (over-specific rejection-stage assertion)
Corrected feature head     486f7bf6032a56bc8d98a99f9e182dc907801109
Corrected branch CI        35038527004 — SUCCESS
Implementation PR #163     MERGED
Implementation merge       3c14b209737f69b32cb746c667affac518d306f2
Post-merge develop CI      35038755032 — SUCCESS
96 test files / 1168 tests
10 full lifecycle completion tests
2 shared-session persistence coordinator tests
TypeScript typecheck passed
Production Vite build passed
130 modules transformed
```

Delivered:

- direct bytes `importAndApplyWorkbook(...)` through the strict existing importer;
- transport-backed `loadCurrentWorkbook(...)` through the same import/apply path;
- structured invalid-workbook rejection before hydration;
- valid candidate application only through `ValidatedAtomicDatasetHydrationService`;
- distinct hydration snapshot/restored-apply/rollback-failure coordinator diagnostics retaining original hydration error context;
- one shared `persistenceCoordinator` in the application session;
- end-to-end save A -> mutate B -> load -> exact A restoration proof;
- zero-write invalid-workbook and transport-load failure proof;
- real apply-failure rollback and severe rollback-failure proof;
- valid empty-workbook clearing across all nine source repositories;
- missing-vs-zero/null and true optional-source-absence fidelity proof;
- caller workbook buffer ownership proof;
- source-only workbook proof excluding derived calculations;
- existing shared services observe restored state without reconstruction.

### Phase 5.3C / Phase 5.3 completion gate

All C1, C2, and C3 responsibilities are complete. The complete persisted source lifecycle is now coordinated behind one application API while preserving the separate workbook codec, strict importer, snapshot, hydration, and byte-transport responsibilities.

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE
Dataset -> XLSX export                COMPLETE
XLSX -> dataset reconstruction        COMPLETE
Repository snapshot service           COMPLETE — 5.3A
Repository bulk replacement primitive COMPLETE — 5.3B1
Validated atomic hydration/rollback   COMPLETE — 5.3B2
Hydration session completion gate     COMPLETE — 5.3B3
Persistence coordinator lifecycle     COMPLETE — 5.3C
Workbook transport/lifecycle contract COMPLETE — 5.3C1
Export/save orchestration             COMPLETE — 5.3C2
Load/import/hydrate orchestration     COMPLETE — 5.3C3
Schema compatibility/migration        NEXT / NOT STARTED — 5.4A
Detailed backup/atomic write          NOT STARTED — 5.4B
Native filesystem                     Phase 6
```

## Current active task

**5.4A — Schema Migration & Compatibility Framework — NEXT / NOT STARTED**

Do not begin 5.4A implementation until the Phase 5.3C parent closeout PR is merged, exact final `develop` CI is green, and the user separately says to proceed.
