# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Current authoritative implementation baseline after Phase 5.5B2:

```text
develop  156ba5619857ea470f845818d6d22a39cfa85d75
CI       35126194178 — SUCCESS
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
    5.5B — Export / Save & Backup Workflow                IN PROGRESS
        5.5B1 — Browser Workbook Export & Download Command Boundary      COMPLETE
        5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness COMPLETE
        5.5B3 — Browser Export Regression & 5.5B Completion Gate        NEXT / NOT STARTED
    5.5C — Persistence Status / Validation / Recovery UX  NOT STARTED

5.6 — Integration & Completion Gate                       NOT STARTED
    5.6A — Integrated Excel Round-Trip Workflow           NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Locked Phase 5 decisions

### Persisted source and workbook

- `.xlsx` is the authoritative Phase 5 workbook format.
- Persist authoritative source evidence only; derived costing/yield/capacity/pricing outputs are recalculated after restore.
- `BusinessDataset` covers all nine authoritative source repositories.
- Dataset schema version and workbook format version remain separate.
- Workbook v1 has 13 normalized canonical sheets.
- Missing evidence remains distinct from explicit zero/null/false.
- Formula cells are not authoritative source values; formula-looking text remains literal.
- SheetJS remains hidden behind the library-neutral `WorkbookCodec`.

### Snapshot, hydration and coordinator

- 5.3A owns complete deterministic source snapshots.
- 5.3B owns validation-before-write, whole-dataset replacement, rollback, and stable repository/service identity.
- 5.3C owns the single application-level persistence lifecycle over workbook bytes.
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
- real XLSX end-to-end browser regression;
- rejected imports preserving prior live source state;
- full regression/typecheck/build completion gate.

Final parent closeout:

```text
Parent closeout PR #194      MERGED
Final 5.5A closeout develop  088d0b7d6d5bd6114e3887293dca757140e4eaa5
Final 5.5A CI                35064547341 — SUCCESS
```

## Phase 5.5B — Export / Save & Backup Workflow — IN PROGRESS

Plan:

`docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW_PLAN.md`

Decomposition:

```text
5.5B1 — Browser Workbook Export & Download Command Boundary      COMPLETE
5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness COMPLETE
5.5B3 — Browser Export Regression & 5.5B Completion Gate        NEXT / NOT STARTED
```

### 5.5B1 — COMPLETE

Completion record:

`docs/PHASE_5_5B1_BROWSER_WORKBOOK_EXPORT_DOWNLOAD_COMMAND.md`

5.5B1 established:

- `BrowserWorkbookExportCommand` as the browser-facing application boundary;
- canonical workbook bytes obtained only through `PersistenceCoordinator.exportCurrentWorkbook()`;
- defensive ownership of exported bytes;
- deterministic UTC filename guidance in `craft-business-manager-YYYY-MM-DD-HHmmss.xlsx` format;
- the official XLSX MIME type;
- injectable Blob/object-URL/download/revoke behavior outside React;
- one explicit command -> one coordinator export -> one browser download dispatch;
- object-URL cleanup after success and dispatch failure;
- controlled preparation, dispatch, and cleanup workflow failures;
- preservation of coordinator snapshot/export operational errors;
- no `WorkbookTransport` receipt, native path, Phase 5.4B pre-save backup, atomic-replacement, or durability claim.

Browser export therefore means **download/save a new copy**. It does not mean native in-place save.

Implementation evidence:

```text
Planning baseline             892661ca6885f9897f05aa03b1d4ed446c90bfaa
Planning baseline CI          35077613877 — SUCCESS
Initial feature CI            35078151129 — FAILURE (new test fixture metadata shape only)
Corrected feature head        f8663c5ef353672a297ca16e544af32b7b32d4ea
Corrected branch CI           35078325763 — SUCCESS
Implementation PR #196        MERGED
PR CI                         35078451640 — SUCCESS
Implementation merge          d4d1b3a19b2e7e1c55058e40a3f3e103787097c7
Post-merge CI                 35078559069 — SUCCESS
118 test files / 1372 tests
13 focused BrowserWorkbookExportCommand tests
Typecheck PASS
Production build PASS
138 modules transformed
```

The initial feature failure was isolated to the test fixture: it incorrectly placed workbook identity/version fields in `WorkbookExportMetadata`. Production code was unchanged; the fixture was corrected to the actual metadata contract.

### 5.5B2 — COMPLETE

Completion record:

`docs/PHASE_5_5B2_REACT_EXPORT_SAVE_COPY_WORKFLOW.md`

5.5B2 established:

- `WorkbookExportPanel` as the React browser export/save-copy surface;
- default `BrowserWorkbookExportCommand(persistenceCoordinator)` wiring in the app shell;
- explicit **Download workbook** action with no implicit export during render;
- `Preparing download…` pending state;
- duplicate-submit protection using both disabled UI state and an in-flight ref guard;
- copy-oriented success feedback that includes the generated filename;
- controlled export/browser-download failure feedback and retry support;
- export does not advance `workspaceRevision` or remount the repository-backed workspace;
- active navigation remains stable across export;
- existing 5.5A import/replace workflow remains functional beside export;
- user-facing language explicitly states browser export creates a new `.xlsx` copy;
- browser mode does not claim overwrite, native path, Phase 5.4B pre-save backup, atomic replacement, or durable filesystem persistence.

Native Save / Save As and managed filesystem backups remain Phase 6.

Implementation evidence:

```text
Baseline develop          b6df113ec56aee3797487faedd286b097310ca80
Baseline CI               35122229988 — SUCCESS
Feature head              dd452d7df246a3b89f019b85c0d9fe1820df6f0e
Feature CI                35125924365 — SUCCESS
Implementation PR #199    MERGED
PR CI                     35126070074 — SUCCESS
Implementation merge      156ba5619857ea470f845818d6d22a39cfa85d75
Post-merge CI             35126194178 — SUCCESS
121 test files / 1395 tests
6 focused WorkbookExportPanel tests
2 focused app-shell B2 tests
Typecheck PASS
Production build PASS
143 modules transformed
```

### 5.5B3 — NEXT / NOT STARTED

5.5B3 will prove and close the complete browser export workflow against the real Phase 5 persistence stack.

Required scope remains:

- export representative live authoritative source data through the user-facing React workflow;
- capture the actual downloaded XLSX bytes through the browser boundary;
- decode/import those real XLSX bytes through the production codec/import stack;
- prove exported source data is equivalent to the authoritative source snapshot;
- prove export never mutates live repositories;
- prove repeated exports use fresh source data rather than stale bytes;
- prove filename/MIME/object-URL lifecycle and retry/failure behavior end to end;
- prove browser mode never manufactures backup receipts, atomic replacement, native paths, overwrite claims, or durability guarantees;
- keep 5.4B transport safe-save tests and 5.5A browser import regression green;
- close parent 5.5B only after full regression/typecheck/build succeeds.

Rich recovery/history UX remains 5.5C. Native Save/Save As, managed filesystem paths, real pre-save backups, atomic filesystem replacement, locks, `fsync`, and crash consistency remain Phase 6.

Do not begin 5.5B3 until the 5.5B2 docs-only closeout is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.

## Completion evidence index

### Phase 5.3 — COMPLETE

```text
Parent closeout PR #164 — MERGED
Final develop  0624863f59929d645acd5f6539ab311afdfcb5bd
Final CI       35039111549 — SUCCESS
```

### Phase 5.4 — COMPLETE

```text
Parent 5.4 closeout PR #185 — MERGED
Final Phase 5.4 develop      b8584d8681e95676c209c2e5a9dde0ee6278b71a
Final Phase 5.4 CI           35055715946 — SUCCESS
```

### Phase 5.5A — COMPLETE

```text
Parent closeout PR #194      MERGED
Final 5.5A closeout develop  088d0b7d6d5bd6114e3887293dca757140e4eaa5
Final 5.5A CI                35064547341 — SUCCESS
```

### Phase 5.5B planning

```text
Planning PR #195       MERGED
Planning merge         892661ca6885f9897f05aa03b1d4ed446c90bfaa
Post-merge CI          35077613877 — SUCCESS
```

### Phase 5.5B1 — COMPLETE

```text
Initial feature CI      35078151129 — FAILURE (test fixture typing only)
Corrected feature head  f8663c5ef353672a297ca16e544af32b7b32d4ea
Corrected branch CI     35078325763 — SUCCESS
Implementation PR #196  MERGED
PR CI                   35078451640 — SUCCESS
Implementation merge    d4d1b3a19b2e7e1c55058e40a3f3e103787097c7
Post-merge CI           35078559069 — SUCCESS
118 test files / 1372 tests
13 focused B1 tests
138 modules transformed
```

### Phase 5.5B2 — COMPLETE

```text
Baseline develop          b6df113ec56aee3797487faedd286b097310ca80
Baseline CI               35122229988 — SUCCESS
Feature head              dd452d7df246a3b89f019b85c0d9fe1820df6f0e
Feature CI                35125924365 — SUCCESS
Implementation PR #199    MERGED
PR CI                     35126070074 — SUCCESS
Implementation merge      156ba5619857ea470f845818d6d22a39cfa85d75
Post-merge CI             35126194178 — SUCCESS
121 test files / 1395 tests
6 focused B2 panel tests
2 focused B2 app-shell tests
143 modules transformed
```

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
Browser export completion regression  NEXT — 5.5B3
Recovery/status UX                    NOT STARTED — 5.5C
Native filesystem                     Phase 6
```

## Current active task

**5.5B3 — Browser Export Regression & 5.5B Completion Gate — NEXT / NOT STARTED**

Do not begin 5.5B3 until the 5.5B2 closeout is merged into `develop`, the exact resulting `develop` CI is green, and the user separately says to proceed.
