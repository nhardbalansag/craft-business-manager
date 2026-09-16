# Phase 5.5B1 — Browser Workbook Export & Download Command Boundary

Status: **COMPLETE**

Parent:

```text
5.5B — Export / Save & Backup Workflow — IN PROGRESS
```

Next exact task after this closeout is merged and the exact resulting `develop` CI is green:

```text
5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness — NEXT / NOT STARTED
```

Do not begin 5.5B2 until the user separately instructs to proceed.

## Baseline

```text
Planning closeout develop  892661ca6885f9897f05aa03b1d4ed446c90bfaa
Planning CI                 35077613877 — SUCCESS
```

Plan:

`docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW_PLAN.md`

## Delivered boundary

5.5B1 added:

```text
src/application/persistence/BrowserWorkbookExportCommand.ts
src/application/persistence/BrowserWorkbookExportCommand.test.ts
```

`BrowserWorkbookExportCommand` is the browser-facing application boundary for an explicit current-workbook download.

The authoritative flow is:

```text
explicit export command
  -> PersistenceCoordinator.exportCurrentWorkbook()
  -> owned canonical XLSX Uint8Array
  -> Blob(application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
  -> URL.createObjectURL(...)
  -> temporary download dispatch
  -> URL.revokeObjectURL(...)
```

The command does not enumerate repositories, construct workbook sheets, encode XLSX directly, use `WorkbookTransport`, or simulate native save transactions.

## Deterministic filename guidance

The browser boundary owns deterministic download filename guidance using an injected clock.

Format:

```text
craft-business-manager-YYYY-MM-DD-HHmmss.xlsx
```

UTC date/time fields are used so an injected instant produces the same filename regardless of runtime timezone.

The filename is browser download guidance only. It is not a managed filesystem path.

## Browser artifact ownership

5.5B1 establishes an injectable `BrowserWorkbookDownloadAdapter` that owns:

- Blob creation;
- object-URL creation;
- browser download dispatch;
- object-URL revocation.

The default browser adapter:

- defensively owns workbook bytes before Blob creation;
- uses the official XLSX MIME type;
- creates a temporary hidden download anchor;
- dispatches one download for one explicit command;
- removes the temporary anchor;
- revokes the temporary object URL after dispatch.

This keeps browser API mechanics outside React and makes the workflow deterministic under tests.

## Failure semantics

5.5B1 preserves coordinator snapshot/export operational failures unchanged.

Browser-specific failures use controlled workflow codes:

```text
DOWNLOAD_PREPARATION_FAILED
DOWNLOAD_DISPATCH_FAILED
DOWNLOAD_CLEANUP_FAILED
```

If download dispatch and object-URL cleanup both fail, dispatch remains the primary failure and the cleanup failure is preserved separately.

No failed preparation/dispatch is reported as successful download completion.

## Backup / native-save truthfulness

5.5B1 returns browser-copy evidence only:

- dispatched filename;
- byte length;
- XLSX MIME type;
- export metadata.

It does not manufacture:

- a `WorkbookBackupReceipt`;
- a native file path;
- an atomic replacement receipt;
- a claim that an existing workbook was overwritten;
- a filesystem durability guarantee.

The Phase 5.4B backup contract remains unchanged: a true pre-save backup represents exact previous-primary bytes created by a transport that owns the primary before destructive replacement.

A normal browser download creates a new copy and does not satisfy that definition. Native Save / Save As, managed paths, real filesystem backup, atomic replacement, locking, `fsync`, and crash-consistency decisions remain Phase 6.

## Regression coverage

The focused 5.5B1 suite proves:

- command construction performs no implicit export;
- one explicit command invokes `PersistenceCoordinator.exportCurrentWorkbook()` exactly once;
- one explicit command dispatches exactly one browser download;
- canonical exported bytes are defensively owned before browser artifact creation;
- deterministic `.xlsx` filename generation;
- correct XLSX MIME type;
- object URL creation from the workbook Blob;
- object URL cleanup after successful dispatch;
- object URL cleanup when dispatch fails after URL creation;
- browser artifact preparation failure is controlled and does not dispatch;
- cleanup-only failure remains observable;
- dispatch failure remains primary when cleanup also fails;
- coordinator snapshot/export failures propagate unchanged;
- returned browser-copy evidence does not contain transport receipt/path/backup/atomicity claims;
- sequential explicit exports perform fresh coordinator exports and fresh download dispatches.

## CI history

The first feature run failed only in the new test fixture:

```text
Initial feature CI  35078151129 — FAILURE
Reason              TypeScript fixture shape only
```

The fixture incorrectly included workbook identity/version fields in `WorkbookExportMetadata`. The real metadata contract contains `exportedAt` and optional `applicationVersion`; production implementation behavior was unchanged.

Corrected implementation evidence:

```text
Corrected feature head   f8663c5ef353672a297ca16e544af32b7b32d4ea
Corrected branch CI      35078325763 — SUCCESS
Implementation PR #196   MERGED
PR CI                    35078451640 — SUCCESS
Implementation merge     d4d1b3a19b2e7e1c55058e40a3f3e103787097c7
Post-merge CI            35078559069 — SUCCESS
118 test files / 1372 tests
13 focused BrowserWorkbookExportCommand tests
Typecheck PASS
Production build PASS
138 modules transformed
```

## Completion gate

5.5B1 is complete because:

1. canonical workbook bytes come only from `PersistenceCoordinator.exportCurrentWorkbook()`;
2. browser-specific Blob/object-URL/download behavior is isolated behind an application boundary;
3. exported bytes are defensively owned;
4. deterministic `.xlsx` filename guidance is established;
5. the XLSX MIME type is explicit;
6. temporary object URLs are cleaned up on success and dispatch failure;
7. browser preparation, dispatch, and cleanup failures remain explicit;
8. coordinator export failures preserve their existing meaning;
9. no repository mutation or import-style workspace refresh is introduced;
10. no `WorkbookTransport` backup/atomic/native-path guarantee is manufactured;
11. TypeScript typecheck, full regression tests, and production build are green on the exact merged `develop` commit.

## Next

```text
5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness — NEXT / NOT STARTED
```

5.5B2 should expose this command through the React application shell with pending/duplicate-submit/success/failure behavior and truthful browser copy/backup wording. It must not begin until this closeout is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
