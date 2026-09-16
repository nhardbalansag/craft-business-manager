# Phase 5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness

## Status

**COMPLETE**

Parent phase:

```text
5.5B — Export / Save & Backup Workflow — IN PROGRESS
```

Implementation baseline:

```text
develop  b6df113ec56aee3797487faedd286b097310ca80
CI       35122229988 — SUCCESS
```

Implementation merge:

```text
PR       #199 — MERGED
merge    156ba5619857ea470f845818d6d22a39cfa85d75
CI       35126194178 — SUCCESS
```

## Objective

Expose the completed 5.5B1 browser export command through the React application shell as a deliberate **Download workbook / Save a copy** workflow with controlled pending/success/failure state and truthful browser save/backup language.

B2 does not change workbook construction, persistence semantics, repository state, transport receipts, or native filesystem behavior.

## Delivered UI boundary

`WorkbookExportPanel` now:

- exposes an explicit **Download workbook** action;
- invokes only the injected browser export command;
- never exports merely because the component renders;
- shows a `Preparing download…` pending state;
- disables the action while export is active;
- uses an in-flight ref guard so synchronous duplicate clicks cannot dispatch a second export;
- reports successful download dispatch with the generated `.xlsx` filename;
- reports controlled export/browser-download failures;
- allows retry after a failed export;
- does not parse XLSX or construct workbook sheets;
- does not enumerate or mutate repositories;
- does not invoke `WorkbookTransport`.

## App-shell integration

`App` now owns a default:

```text
BrowserWorkbookExportCommand(persistenceCoordinator)
```

and renders the export panel beside the existing import/open workflow.

Export deliberately does **not** advance `workspaceRevision`, because downloading a workbook copy does not mutate the authoritative live dataset. The active application navigation section therefore remains stable across successful export.

The existing 5.5A import workflow remains functional beside the export surface and continues to own the success-only workspace refresh behavior for destructive dataset replacement.

## Truthful browser save / backup semantics

The B2 user-facing contract is intentionally explicit:

```text
browser export
  -> create current canonical workbook bytes
  -> download a new .xlsx copy
  -> do not overwrite a previously imported workbook
  -> do not claim a native managed path
  -> do not claim a Phase 5.4B pre-save backup
  -> do not claim atomic filesystem replacement or durable native save
```

Phase 5.4B backup remains the exact pre-save bytes of an existing primary workbook created by a transport that owns that primary before destructive replacement.

A normal browser download does not satisfy that definition.

Native Save / Save As, managed paths, real pre-save filesystem backups, atomic replacement, locking, `fsync`, and crash-consistency guarantees remain Phase 6.

## Files changed

Implementation PR #199 changed exactly five files:

```text
src/App.tsx
src/App.export.persistence.test.tsx
src/ui/persistence/WorkbookExportPanel.tsx
src/ui/persistence/WorkbookExportPanel.test.tsx
src/ui/persistence/workbookExport.css
```

No workbook schema, dataset/domain, persistence coordinator, transport, or native filesystem code changed.

## Test coverage

Focused B2 coverage adds:

- 6 `WorkbookExportPanel` tests;
- 2 app-shell export/import coexistence tests.

The focused tests prove:

1. render/mount does not implicitly export;
2. explicit action invokes one export;
3. duplicate submission is blocked while export is pending;
4. copy-oriented success feedback includes the generated filename;
5. browser download failure is shown as failure rather than success;
6. retry succeeds after a previous failure;
7. browser save/backup language does not claim overwrite or pre-save backup;
8. successful export does not advance workspace revision;
9. active navigation stays stable across export;
10. the import/replace workflow continues to operate beside export.

## CI evidence

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

## Completion gate

5.5B2 is complete because a browser user can deliberately download a current canonical `.xlsx` copy through the B1 command with pending, duplicate-submit, success and failure handling, while React remains persistence-neutral and the UI accurately describes browser-copy limitations.

No import-style workspace refresh is manufactured by export, and the native backup/save guarantees remain reserved for the transport/native layer.

## Next exact task

```text
5.5B3 — Browser Export Regression & 5.5B Completion Gate
NEXT / NOT STARTED
```

Do not begin 5.5B3 until this docs-only B2 closeout is merged, the exact resulting `develop` CI is green, and the user separately instructs to proceed.
