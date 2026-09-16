# Phase 5.5A1 — Browser File Selection & Import Command Boundary

## Status

**COMPLETE**

Parent plan:

`docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW_PLAN.md`

## Authoritative implementation baseline

```text
develop  95d63ccb3f20e0412376ae35ea0f5c13652fa753
CI       35059276175 — SUCCESS
```

Feature branch:

`feature/phase-5-5a1-browser-file-import-command`

## Delivered contract

5.5A1 introduces a browser-facing application boundary at:

`src/application/persistence/BrowserWorkbookImportCommand.ts`

The command deliberately separates file selection from destructive import application.

Conceptually:

```text
browser-selected File-like input
  -> arrayBuffer()
  -> owned Uint8Array copy
  -> pending workbook selection
       name + actual acquired byte length exposed to UI
  -> explicit applyPendingSelection()
  -> PersistenceCoordinator.importAndApplyWorkbook(...)
```

### Selection semantics

- `.xlsx` filename checking is a UX guard only; it is never treated as workbook-content validation.
- selected bytes are copied and privately owned by the command;
- caller mutation after selection cannot change the pending workbook;
- UI-facing pending metadata exposes only file name and acquired byte length;
- selection metadata is immutable/frozen;
- actual acquired byte length is authoritative for the pending selection rather than caller-provided `File.size` metadata;
- chooser cancellation is a non-error/no-op and preserves an already-pending valid selection;
- unsupported extension and file-read failure preserve the previous pending selection;
- `clearSelection()` explicitly discards the pending selection without invoking persistence.

### Apply semantics

- selection alone never calls persistence;
- apply without a pending workbook fails with the controlled `NO_PENDING_WORKBOOK` workflow error;
- every explicit apply call receives a fresh defensive byte copy;
- apply delegates only to `PersistenceCoordinator.importAndApplyWorkbook(...)`;
- structured coordinator rejection results are returned unchanged;
- coordinator operational errors propagate unchanged;
- the command does not manufacture a success result.

### Controlled workflow errors

```text
UNSUPPORTED_FILE_EXTENSION
FILE_READ_FAILED
NO_PENDING_WORKBOOK
```

`BrowserWorkbookImportWorkflowError` retains the original cause where one exists.

## Explicitly out of scope

5.5A1 does **not** add:

- React file chooser UI;
- destructive replacement confirmation UI;
- workspace revision/remount behavior;
- duplicate-submit UI state;
- rich validation/recovery presentation;
- workbook export/save/download;
- native Tauri dialogs, paths, or filesystem operations;
- workbook parsing or sheet construction in the browser command;
- repository enumeration or direct hydration from the command;
- domain/business-rule changes.

Those remain owned by 5.5A2, 5.5A3, 5.5B, 5.5C, and Phase 6 as established in the parent plan.

## Validation evidence

Initial feature gate:

```text
CI 35061184236 — FAILURE
```

The failure occurred only during TypeScript checking in the new test helper because `Uint8Array.buffer` was typed as `ArrayBufferLike`, while the synthetic file contract correctly declared browser `arrayBuffer()` as `Promise<ArrayBuffer>`.

The test helper was corrected to expose a concrete `ArrayBuffer`. Runtime implementation behavior and the A1 contract were unchanged.

Corrected feature head:

```text
54f7d3af36984d9bd2fcd5aae041ae0012ce195a
```

Corrected branch gate:

```text
CI 35061273728 — SUCCESS
114 test files / 1339 tests
12 focused A1 tests
Typecheck PASS
Production build PASS
135 modules transformed
```

Implementation PR:

```text
PR #189 — MERGED
Locked head  54f7d3af36984d9bd2fcd5aae041ae0012ce195a
Merge       13e51998a55789a1fafe3da233344928c889b4a0
```

PR-triggered validation:

```text
CI 35061356082 — SUCCESS
```

Exact implementation post-merge `develop` validation:

```text
develop  13e51998a55789a1fafe3da233344928c889b4a0
CI       35061438644 — SUCCESS
Typecheck PASS
Full tests PASS
Production build PASS
```

## Completion gate

Phase 5.5A1 is complete because:

1. browser-compatible file bytes can be acquired without native APIs;
2. selected bytes are defensively owned;
3. selection is non-destructive;
4. cancellation is a controlled no-op;
5. file-read and unsupported-extension failures are controlled;
6. explicit apply is required before persistence is invoked;
7. apply delegates through the existing `PersistenceCoordinator`;
8. coordinator rejection and operational semantics remain intact;
9. no React/native/domain/workbook-schema scope leaked into A1;
10. the exact merged implementation is green on `develop`.

## Next task

**5.5A2 — React Open/Replace Workflow & Workspace Refresh — NEXT / NOT STARTED**

Do not start 5.5A2 until this docs-only closeout is merged, the exact resulting `develop` CI is green, and the user separately instructs to proceed.
