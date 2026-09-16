# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Current authoritative green implementation baseline after Phase 5.5C2:

```text
develop  0603ef10575f5f08c27170cb174bf23b8c675b21
CI       35134221363 — SUCCESS
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

5.3 — Snapshot, Hydration & Persistence Coordination      COMPLETE
    5.3A — Complete Source Snapshot Service               COMPLETE
    5.3B — Validated Atomic Dataset Hydration             COMPLETE
    5.3C — Persistence Coordinator / Load-Save Lifecycle  COMPLETE

5.4 — Version Compatibility, Backup & Recovery Safety     COMPLETE
    5.4A — Schema Migration & Compatibility Framework     COMPLETE
    5.4B — Backup & Atomic-Write Transport Contract       COMPLETE
    5.4C — Corruption, Limits & Recovery Diagnostics      COMPLETE

5.5 — Excel Persistence UI                                IN PROGRESS
    5.5A — Import / Open Workbook Workflow                COMPLETE
        5.5A1 — Browser File Selection & Import Command Boundary  COMPLETE
        5.5A2 — React Open/Replace Workflow & Workspace Refresh   COMPLETE
        5.5A3 — Browser Import Regression & 5.5A Completion Gate  COMPLETE
    5.5B — Export / Save & Backup Workflow                COMPLETE
        5.5B1 — Browser Workbook Export & Download Command Boundary      COMPLETE
        5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness COMPLETE
        5.5B3 — Browser Export Regression & 5.5B Completion Gate        COMPLETE
    5.5C — Persistence Status / Validation / Recovery UX              IN PROGRESS
        5.5C1 — Persistence Session Status & Workbook Identity        COMPLETE
        5.5C2 — Validation Detail & Recovery Guidance UX              COMPLETE
        5.5C3 — Persistence UX Regression & Phase 5.5 Completion Gate NEXT / NOT STARTED

5.6 — Integration & Completion Gate                       NOT STARTED
    5.6A — Integrated Excel Round-Trip Workflow           NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Locked Phase 5 decisions

### Persisted source and workbook

- `.xlsx` remains the authoritative Phase 5 workbook format.
- Persist authoritative source evidence only; derived costing/yield/capacity/pricing outputs are recalculated after restore.
- `BusinessDataset` covers all nine authoritative source repositories.
- Dataset schema version and workbook format version remain separate.
- Workbook v1 has 13 normalized canonical sheets.
- Missing evidence remains distinct from explicit zero/null/false.
- Formula cells are not authoritative source values; formula-looking text remains literal.
- SheetJS remains behind the library-neutral `WorkbookCodec`.

### Snapshot, hydration and coordinator

- 5.3A owns complete deterministic source snapshots.
- 5.3B owns validation-before-write, whole-dataset replacement, rollback, and stable repository/service identity.
- 5.3C owns the application-level persistence lifecycle over workbook bytes.
- Expected import rejection never reaches hydration.
- React and workbook adapters do not enumerate repositories directly.

### Compatibility, safe save and recovery

- Workbook-format and dataset-schema versions remain separate exact axes.
- Public versions remain v1/v1; production migration registry stays empty until a real predecessor exists.
- Future versions fail closed.
- `WorkbookTransport` remains byte-only and reports backup/replacement capabilities truthfully.
- Required backup cannot proceed when unsupported or when creation fails.
- Pre-commit save failures preserve the previous primary workbook.
- Native filesystem durability, locking, rename atomicity and `fsync` remain Phase 6.
- Import is resource-bounded before decode, during SheetJS expansion, and after neutral-document reconstruction.
- Raw importer issues remain authoritative; recovery summaries are derived/advisory.
- Expected import rejection leaves the prior authoritative source state unchanged.

## Phase 5.5A — Browser import/open workflow — COMPLETE

Plan:

`docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW_PLAN.md`

Parent completion record:

`docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW.md`

Delivered across 5.5A1–A3:

- browser-compatible `.xlsx` file selection and owned-byte acquisition;
- non-destructive pending selection;
- explicit destructive replacement confirmation;
- delegation through `PersistenceCoordinator.importAndApplyWorkbook(...)`;
- success/rejection/operational-failure separation;
- success-only workspace revision/remount;
- active navigation preservation;
- real XLSX browser import regression;
- rejected imports preserving prior live source state;
- full regression/typecheck/build completion gate.

Final 5.5A evidence:

```text
Parent closeout PR #194      MERGED
Final 5.5A closeout develop  088d0b7d6d5bd6114e3887293dca757140e4eaa5
Final 5.5A CI                35064547341 — SUCCESS
```

## Phase 5.5B — Export / Save & Backup Workflow — COMPLETE

Plan:

`docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW_PLAN.md`

Parent completion record:

`docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW.md`

Completed decomposition:

```text
5.5B1 — Browser Workbook Export & Download Command Boundary      COMPLETE
5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness COMPLETE
5.5B3 — Browser Export Regression & 5.5B Completion Gate        COMPLETE
```

### 5.5B1 — Browser export command boundary — COMPLETE

Completion record:

`docs/PHASE_5_5B1_BROWSER_WORKBOOK_EXPORT_DOWNLOAD_COMMAND.md`

Established:

- `BrowserWorkbookExportCommand` as the browser-facing application boundary;
- canonical bytes only through `PersistenceCoordinator.exportCurrentWorkbook()`;
- defensive byte ownership;
- deterministic UTC `.xlsx` filename guidance;
- official XLSX MIME type;
- injectable Blob/object-URL/download/revoke behavior;
- one explicit command -> one current export -> one download dispatch;
- object-URL cleanup after success and dispatch failure;
- controlled preparation, dispatch, and cleanup errors;
- no transport receipt, native path, pre-save backup, atomic replacement, or durability claim.

Evidence:

```text
Corrected feature head  f8663c5ef353672a297ca16e544af32b7b32d4ea
Branch CI               35078325763 — SUCCESS
Implementation PR #196  MERGED
PR CI                   35078451640 — SUCCESS
Implementation merge    d4d1b3a19b2e7e1c55058e40a3f3e103787097c7
Post-merge CI           35078559069 — SUCCESS
118 test files / 1372 tests
13 focused B1 tests
```

### 5.5B2 — React export/save-copy workflow — COMPLETE

Completion record:

`docs/PHASE_5_5B2_REACT_EXPORT_SAVE_COPY_WORKFLOW.md`

Established:

- `WorkbookExportPanel` in the app shell;
- explicit **Download workbook** action;
- no implicit export during render;
- pending state and duplicate-submit protection;
- copy-oriented success and controlled failure feedback;
- retry after failure;
- no `workspaceRevision` advance/remount on export;
- stable active navigation;
- existing import workflow remains functional beside export;
- browser wording explicitly says a new `.xlsx` copy is created;
- no overwrite, native path, pre-save backup, atomic replacement, or filesystem-durability claim.

Evidence:

```text
Baseline develop        b6df113ec56aee3797487faedd286b097310ca80
Baseline CI             35122229988 — SUCCESS
Feature head            dd452d7df246a3b89f019b85c0d9fe1820df6f0e
Feature CI              35125924365 — SUCCESS
Implementation PR #199  MERGED
PR CI                   35126070074 — SUCCESS
Implementation merge    156ba5619857ea470f845818d6d22a39cfa85d75
Post-merge CI           35126194178 — SUCCESS
121 test files / 1395 tests
6 focused panel tests
2 focused app-shell tests
```

### 5.5B3 — Browser export regression & completion gate — COMPLETE

B3 added a tests-only real-stack completion gate.

Proven end to end:

- representative data across all nine source collections exports through the React workflow;
- actual captured browser download bytes decode/import through the production codec/importer;
- reconstructed source data equals the authoritative source snapshot;
- export leaves live repositories unchanged;
- deterministic filename and official MIME type reach the browser boundary;
- object URLs are revoked;
- sequential exports after source changes contain fresh data rather than stale bytes;
- source snapshot failure produces no false success/download and retry succeeds;
- injected workbook encoding failure produces no false success/download and retry succeeds;
- Blob preparation failure produces no false success/download and retry succeeds;
- dispatch failure cleans the temporary URL and retry succeeds;
- B1/B2 tests retain duplicate-submit and save/backup truthfulness proof;
- Phase 5.4B safe-save suites and 5.5A browser import regression remain green.

Evidence:

```text
Baseline develop        014f40e5d1e50752abb504d89f1c759df5a2d7c3
Baseline CI             35126766679 — SUCCESS
Feature head            6f61fe1ae9e80b8a7c5592b3d38261a7874f34e1
Feature CI              35129097293 — SUCCESS
Implementation PR #201  MERGED
PR CI                   35129252003 — SUCCESS
Implementation merge    68a34802d4768438cd67fe0cdab42b95145ecbe1
Post-merge CI           35129363820 — SUCCESS
122 test files / 1401 tests
6 focused B3 real-stack regression tests
Typecheck PASS
Production build PASS
143 modules transformed
```

### Parent 5.5B completion result

The complete browser export workflow satisfies all locked gates: explicit current workbook download, coordinator-owned canonical XLSX export, deterministic filename/MIME, safe object-URL cleanup, duplicate-submit protection, no source mutation/remount, and truthful copy-only semantics with no manufactured native backup/path/atomicity/durability claim.

Parent closeout:

```text
Parent closeout PR #202      MERGED
Final 5.5B develop           a1c175176ce4df9fe1c3ae8ec91afd5151dd1e59
Final 5.5B CI                35129979872 — SUCCESS
```

Therefore `5.5B — Export / Save & Backup Workflow` is **COMPLETE**.

## Phase 5.5C — Persistence Status / Validation / Recovery UX — IN PROGRESS

Dedicated plan:

`docs/PHASE_5_5C_PERSISTENCE_STATUS_VALIDATION_RECOVERY_UX_PLAN.md`

Decomposition:

```text
5.5C1 — Persistence Session Status & Workbook Identity           COMPLETE
5.5C2 — Validation Detail & Recovery Guidance UX                 COMPLETE
5.5C3 — Persistence UX Regression & Phase 5.5 Completion Gate    NEXT / NOT STARTED
```

### Locked 5.5C decisions

- persistence status is browser-session UI state, not authoritative workbook/business data;
- current workbook-format and dataset-schema versions come from existing constants, not duplicated UI numbers;
- active imported workbook identity is the browser-selected filename/metadata when known, never a managed native path;
- last successful import/export timestamps are session-observed operation timestamps and remain distinct from workbook `exportedAt` metadata;
- rejected/failed operations must not overwrite last-successful status;
- raw importer issues remain authoritative technical evidence and recovery guidance is derived through the existing recovery summary boundary;
- browser backup/restore guidance means selecting a known-good workbook copy the user possesses; it must not claim a Phase 5.4B transport backup was created;
- dirty/clean state is deliberately not introduced because there is no complete mutation-tracking contract across all business edits.

### 5.5C1 — Persistence Session Status & Workbook Identity — COMPLETE

Completion record:

`docs/PHASE_5_5C1_PERSISTENCE_SESSION_STATUS_WORKBOOK_IDENTITY.md`

C1 established:

- an immutable browser-session persistence status model;
- current format ID, workbook version, and dataset schema version sourced from existing constants;
- truthful empty state before successful import/export activity;
- browser-known successful imported filename/size and returned workbook metadata;
- session-observed import time kept distinct from workbook `exportedAt`;
- last successful downloaded-copy filename/size and export metadata;
- session-observed download-dispatch time kept distinct from workbook `exportedAt`;
- rejected/failed imports preserve the previous successful imported identity;
- failed exports preserve the previous successful export identity;
- exporting a copy does not replace the active imported workbook identity;
- successful import continues to advance `workspaceRevision` exactly once;
- export status does not remount the workspace or change active navigation;
- browser filenames are explicitly identity labels, not managed native paths;
- no dirty/clean synchronization claim is introduced.

Evidence:

```text
Planning PR #203                 MERGED
Planning head                    82e7a168443688b28262d1c666adae94a902ef68
Planning PR CI                   35131606179 — SUCCESS
C1 baseline                      f37529c3886ad52bc53347b1b275c8142b15d093
C1 baseline CI                   35131746177 — SUCCESS
Initial feature head             5ac1220d3f535aa9476d30e482f333f65a2c3a9d
Initial feature CI               35132299736 — FAILURE (test-harness typing only)
Corrected feature head           8ec0ec92c122ed72084a4274a5a26e300f72c586
Corrected branch CI              35132491552 — SUCCESS
Implementation PR #204           MERGED
PR CI                            35132643889 — SUCCESS
Implementation merge             0a3a68c78a93824da1c01644cfa24723fbfaf8e5
Post-merge CI                    35132771870 — SUCCESS
125 test files / 1413 tests
12 focused C1 tests
Typecheck PASS
Production build PASS
146 modules transformed
```

The initial feature failure was isolated to a new test mock whose inferred zero-argument signature did not match the real import command `(bytes) => Promise<...>` signature. Production code was not implicated; the test harness was corrected and all gates then passed.

### 5.5C2 — Validation Detail & Recovery Guidance UX — COMPLETE

Completion record:

`docs/PHASE_5_5C2_VALIDATION_DETAIL_RECOVERY_GUIDANCE_UX.md`

C2 established:

- complete raw workbook import issue evidence remains visible and authoritative;
- deterministic recovery category/actions are derived through `summarizeWorkbookImportRecovery(...)` rather than duplicated in React;
- available sheet, row, column, path, code, message, version, and resource-limit details are presented;
- specific guidance exists for future/incompatible versions, corrupt/unreadable workbooks, resource limits, structure/value problems, and invalid business data;
- defensive hydration rejection remains distinct and preserves raw dataset-validation issues;
- operational exceptions remain separate from expected rejection diagnostics;
- browser restore guidance means selecting a known-good workbook copy already possessed by the user, not a browser-managed Phase 5.4B backup;
- stale rejection detail clears on a new selection/new attempt or later successful import;
- existing live-state preservation and C1 last-successful status behavior remain green.

Evidence:

```text
C2 baseline                      cb10db016d8f85321ca744675ae97b465db08387
C2 baseline CI                   35133267611 — SUCCESS
Feature head                     6c3aa4ea0264570bd5a9d66e813fc8cff7964473
Feature branch CI                35133930153 — SUCCESS
Implementation PR #206           MERGED
PR CI                            35134074959 — SUCCESS
Implementation merge             0603ef10575f5f08c27170cb174bf23b8c675b21
Post-merge CI                    35134221363 — SUCCESS
127 test files / 1423 tests
10 focused C2 tests
Typecheck PASS
Production build PASS
149 modules transformed
```

### 5.5C3 — Persistence UX Regression & Phase 5.5 Completion Gate — NEXT / NOT STARTED

C3 will prove the complete browser persistence UI across import, export, status, validation, and recovery, then close parent Phase 5.5 and advance exactly to `5.6A — Integrated Excel Round-Trip Workflow — NEXT / NOT STARTED`.

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / codec                   COMPLETE
Dataset <-> XLSX round-trip            COMPLETE
Snapshot / hydration                   COMPLETE — 5.3
Persistence coordinator lifecycle     COMPLETE — 5.3C
Schema compatibility / migration      COMPLETE — 5.4A
Backup / atomic-write safety          COMPLETE — 5.4B
Corruption / resource / recovery      COMPLETE — 5.4C
Browser import/open workflow          COMPLETE — 5.5A
Browser export command boundary       COMPLETE — 5.5B1
React browser export/save-copy UX     COMPLETE — 5.5B2
Browser export completion regression  COMPLETE — 5.5B3
Export / Save & Backup parent         COMPLETE — 5.5B
Persistence session status            COMPLETE — 5.5C1
Validation/recovery UX                COMPLETE — 5.5C2
Persistence UX completion regression  NEXT — 5.5C3
Native filesystem                     Phase 6
```

## Current active task

**5.5C3 — Persistence UX Regression & Phase 5.5 Completion Gate — NEXT / NOT STARTED**

Do not begin 5.5C3 until the 5.5C2 docs-only closeout is merged into `develop`, the exact resulting `develop` CI is green, and the user separately says to proceed.