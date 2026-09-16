# Phase 5.5A — Import / Open Workbook Workflow

## Status

**COMPLETE**

Parent phase:

```text
5.5 — Excel Persistence UI — IN PROGRESS
```

Next exact task:

```text
5.5B — Export / Save & Backup Workflow — NEXT / NOT STARTED
```

Do not begin 5.5B until this parent closeout is merged into `develop`, the exact resulting `develop` CI is green, and the user separately instructs to proceed.

---

## Objective Achieved

Phase 5.5A exposes the completed Phase 5 import/hydration backend as a safe browser-compatible user workflow:

```text
browser .xlsx file
  -> BrowserWorkbookImportCommand.selectFile(...)
  -> defensively owned pending bytes
  -> selected-file summary
  -> explicit replacement confirmation
  -> BrowserWorkbookImportCommand.applyPendingSelection()
  -> PersistenceCoordinator.importAndApplyWorkbook(...)
  -> resource / compatibility / schema / dataset validation
  -> validated atomic hydration
  -> successful result only
  -> workspace revision advances
  -> visible workspace remounts/refetches
  -> same singleton repositories/services remain authoritative
```

Selection alone never mutates live source state. Expected rejection does not hydrate or advance the successful workspace revision. Operational failure does not manufacture success.

React does not parse XLSX, construct workbook sheets, enumerate repositories, run migrations, or hydrate repositories directly.

---

## Child Task Completion

```text
5.5A1 — Browser File Selection & Import Command Boundary  COMPLETE
5.5A2 — React Open/Replace Workflow & Workspace Refresh   COMPLETE
5.5A3 — Browser Import Regression & 5.5A Completion Gate  COMPLETE
```

Detailed child records:

- `docs/PHASE_5_5A1_BROWSER_FILE_SELECTION_IMPORT_COMMAND.md`
- `docs/PHASE_5_5A2_REACT_OPEN_REPLACE_WORKSPACE_REFRESH.md`

Planning record:

- `docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW_PLAN.md`

---

## 5.5A1 — Browser File Selection & Import Command Boundary

A1 established a browser-facing command boundary that:

- accepts `.xlsx` file selection as UX guidance without trusting the filename as content proof;
- reads browser `ArrayBuffer` data and defensively owns the resulting bytes;
- preserves immutable selected filename and byte-length metadata;
- treats chooser cancellation as a non-error/no-op;
- converts unsupported extension, file-read failure, and no-pending-workbook cases into controlled workflow errors;
- keeps selection non-destructive;
- requires an explicit apply command;
- delegates apply only to `PersistenceCoordinator.importAndApplyWorkbook(...)`;
- preserves existing coordinator rejection and operational-error semantics;
- remains independent of React and native filesystem APIs.

A1 implementation evidence:

```text
Corrected feature head     54f7d3af36984d9bd2fcd5aae041ae0012ce195a
Branch CI                  35061273728 — SUCCESS
Implementation PR #189     MERGED
PR CI                      35061356082 — SUCCESS
Implementation merge       13e51998a55789a1fafe3da233344928c889b4a0
Post-merge CI              35061438644 — SUCCESS
Final A1 closeout develop  15fbdf5ae44b08a8bd2070dfd85a55c98eeda185
Final A1 CI                35061767967 — SUCCESS
```

The initial A1 feature run `35061184236` failed only because of a synthetic test-helper `ArrayBufferLike` typing issue. Runtime behavior did not change when that helper was corrected.

---

## 5.5A2 — React Open/Replace Workflow & Workspace Refresh

A2 exposed the A1 boundary through the React application and established:

- an application-level **Open / Import workbook** surface;
- hidden browser `.xlsx` chooser wiring;
- selected filename and byte-size summary;
- choose-another and cancel-selection behavior;
- explicit confirmation before destructive replacement apply;
- controlled reading/importing states;
- duplicate-submit protection;
- basic success/rejection/operational feedback;
- a single application-level `workspaceRevision` remount boundary;
- revision advance only after `{ status: 'hydrated' }`;
- visible workspace refetch from the same singleton repositories/services after success;
- active navigation preservation across the successful remount;
- no false successful refresh on rejection or failure.

A2 implementation evidence:

```text
Baseline develop           15fbdf5ae44b08a8bd2070dfd85a55c98eeda185
Baseline CI                35061767967 — SUCCESS
Corrected feature head     a154942b1945c44bd7ae4057d25eadc5dc7aff76
Branch CI                  35062474596 — SUCCESS
Implementation PR #191     MERGED
PR CI                      35062595529 — SUCCESS
Implementation merge       e4be2a7b3f9f4289b00177a5f96bd61da113420d
Post-merge CI              35062713682 — SUCCESS
Final A2 closeout develop  8a9978c23dea7b807abfbf779c9fb51daf1409fe
Final A2 CI                35063049816 — SUCCESS
116 test files / 1351 tests
8 focused WorkbookImportPanel tests
4 app-shell workspace-refresh tests
138 modules transformed
```

The initial A2 feature run `35062380717` failed only because a Vitest callback mock was inferred more broadly than the required `() => void` type. The test mock was narrowed without changing production behavior.

---

## 5.5A3 — Browser Import Regression & Completion Gate

A3 intentionally introduced **no production/runtime behavior changes**. It added a real-stack browser regression suite that exercises:

```text
React App
  -> WorkbookImportPanel
  -> BrowserWorkbookImportCommand
  -> real PersistenceCoordinator
  -> real SheetJsWorkbookCodec
  -> real XLSX bytes
  -> real singleton repositories / hydration service
```

Eight new regression cases prove:

1. a real current v1/v1 XLSX selection is non-destructive until explicit apply;
2. explicit apply hydrates the authoritative source dataset and refreshes the visible workspace;
3. corrupt/unreadable workbook bytes are rejected while preserving the previous live dataset;
4. a real future-version workbook is rejected by compatibility handling without successful refresh;
5. a real workbook with invalid canonical structure is rejected by schema handling;
6. a structurally valid workbook that reconstructs an invalid business reference is rejected by dataset validation;
7. a browser selection above the real default 20 MiB workbook byte limit is rejected before decode and preserves the previous workspace;
8. changing the selected file before apply uses the newest pending workbook, and a valid import can subsequently succeed after a prior rejected attempt.

Existing A1/A2 tests remain part of the parent gate and cover chooser cancellation, browser file-read failure, destructive confirmation, duplicate submission, operational failure, navigation stability, and success-only workspace revision behavior.

A3 implementation evidence:

```text
Baseline develop           8a9978c23dea7b807abfbf779c9fb51daf1409fe
Baseline CI                35063049816 — SUCCESS
Initial feature CI         35063726548 — FAILURE (test union narrowing only)
Corrected feature head     7c0afea45432afdd21e4074b9e1a19c7a8906ec1
Corrected branch CI        35063842407 — SUCCESS
Implementation PR #193     MERGED
PR CI                      35063981728 — SUCCESS
Implementation merge       6ca74db286beb02ff1672511ddcecc1773ddee73
Post-merge CI              35064089137 — SUCCESS
117 test files / 1359 tests
8 new A3 real browser-import regression tests
TypeScript typecheck       PASS
Production build           PASS
138 modules transformed
```

The initial A3 feature run failed only because a test inspected an import-only `stage` property on a union that can also contain hydration validation issues. The test was narrowed with `'stage' in issue`; runtime behavior was unchanged.

---

## Parent 5.5A Completion Gate

All parent requirements are satisfied.

### 1. Browser users can choose an `.xlsx` workbook

**PROVEN.** The React surface delegates selected browser files to the A1 browser command boundary.

### 2. Selection alone never mutates live state

**PROVEN.** Real current XLSX bytes can remain pending while the prior authoritative dataset and visible workspace remain unchanged.

### 3. Replacement requires deliberate apply / confirmation

**PROVEN.** React requires explicit confirmation before the pending command is applied.

### 4. Import flows through `PersistenceCoordinator`

**PROVEN.** Browser apply delegates through `BrowserWorkbookImportCommand` to `PersistenceCoordinator.importAndApplyWorkbook(...)`; React does not duplicate import orchestration.

### 5. Valid import atomically hydrates the authoritative dataset

**PROVEN.** A3 drives real v1/v1 XLSX bytes through the production coordinator/hydration path and verifies the post-import complete source snapshot.

### 6. Successful hydration refreshes the visible workspace from the same singleton graph

**PROVEN.** The success-only workspace revision remount causes repository-backed UI state to refetch without replacing repository/service instances.

### 7. Invalid/rejected import leaves the previous dataset unchanged

**PROVEN.** Representative codec, compatibility, schema, dataset-integrity, and resource-limit rejection cases preserve the exact prior authoritative snapshot and do not advance the successful workspace revision.

### 8. Controlled workflow feedback exists without duplicating 5.5C

**PROVEN.** Basic success, rejection, file-read, and operational feedback is present. Rich issue exploration/recovery guidance remains deferred to 5.5C.

### 9. No Tauri/native filesystem behavior is introduced

**PROVEN.** 5.5A uses browser File/ArrayBuffer boundaries only. Native paths, dialogs, OS reads/writes, durable backup paths, locking and `fsync` remain Phase 6.

### 10. All CI gates are green

**PROVEN.** A1, A2, A3 implementation/PR/post-merge gates are green, including full repository regression, typecheck and production build.

---

## Scope Boundary Preserved

Phase 5.5A did **not** implement:

### 5.5B — Export / Save & Backup Workflow

- browser workbook export/download UI;
- deterministic save/download filename UX;
- backup download/export behavior;
- save receipts/status presentation.

### 5.5C — Persistence Status / Validation / Recovery UX

- rich validation issue explorer;
- detailed recovery instructions;
- unsupported-version guidance UI;
- backup/restore guidance;
- active workbook identity/history;
- dirty/unsaved-state UX if adopted.

### Phase 6 — Tauri Desktop Integration

- native Open/Save dialogs;
- native filesystem paths;
- application-data directories;
- durable filesystem backup/replace semantics;
- locks, rename guarantees, `fsync`, crash consistency or packaging.

### Business/domain contracts

No Phase 5.5A work changed material costing/conversion, recipes/yield, component graphs, stock semantics, pricing/profit formulas, production/capacity calculations, or workbook schema/version contracts merely for UI convenience.

---

## Final Parent Result

```text
5.5A — Import / Open Workbook Workflow                COMPLETE
    5.5A1 — Browser File Selection & Import Command Boundary  COMPLETE
    5.5A2 — React Open/Replace Workflow & Workspace Refresh   COMPLETE
    5.5A3 — Browser Import Regression & 5.5A Completion Gate  COMPLETE

5.5B — Export / Save & Backup Workflow                NEXT / NOT STARTED
5.5C — Persistence Status / Validation / Recovery UX  NOT STARTED
```

Phase 5.5A is complete. Do not start 5.5B automatically.
