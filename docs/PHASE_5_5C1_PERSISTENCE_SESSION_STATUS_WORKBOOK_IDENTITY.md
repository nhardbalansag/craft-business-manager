# Phase 5.5C1 — Persistence Session Status & Workbook Identity

## Status

**COMPLETE**

Parent:

```text
5.5C — Persistence Status / Validation / Recovery UX — IN PROGRESS
```

Next exact task:

```text
5.5C2 — Validation Detail & Recovery Guidance UX — NEXT / NOT STARTED
```

Do not begin 5.5C2 without a separate user instruction.

---

## Objective Completed

5.5C1 adds truthful browser-session persistence status without changing authoritative business data, workbook structure, persistence-coordinator behavior, safe-save transport semantics, or native filesystem scope.

The application can now show:

- the current supported workbook format ID/version;
- the current supported dataset schema version;
- the browser-known identity of the last successfully imported workbook;
- imported workbook byte size and metadata;
- the time the current application session observed successful import;
- the identity of the last successfully downloaded workbook copy;
- downloaded byte size and export metadata;
- the time the current application session observed successful download dispatch.

Workbook metadata `exportedAt` remains explicitly distinct from session-observed `importedAt` / `downloadedAt`.

---

## Delivered Architecture

### Pure browser-session model

Added:

`src/ui/persistence/workbookPersistenceSession.ts`

The model:

- consumes the existing workbook/dataset version constants;
- starts without invented import/export identity;
- records successful import evidence only after hydration succeeds;
- records successful export evidence only after browser download dispatch succeeds;
- preserves active imported identity when a new copy is exported;
- freezes session status/evidence records;
- rejects invalid observation dates rather than manufacturing timestamps.

This state is UI-session state only. It is not persisted into `BusinessDataset` or the workbook.

### Persistence status panel

Added:

`src/ui/persistence/WorkbookPersistenceStatusPanel.tsx`

and:

`src/ui/persistence/workbookPersistenceStatus.css`

The panel provides three truthful areas:

1. current workbook/dataset contract;
2. browser-known imported workbook identity;
3. last successfully downloaded workbook copy.

The panel explicitly states:

- browser filenames are identity labels, not managed native paths;
- downloading a copy does not overwrite the imported workbook;
- the application does not claim dirty/clean synchronization with later edits.

### Success-only import evidence

Updated:

`src/ui/persistence/WorkbookImportPanel.tsx`

A successful hydrated import now emits `WorkbookImportHydratedEvent` containing:

- the selected browser workbook identity/size;
- the actual successful hydrated result/metadata.

Rejected imports and operational failures emit no successful status evidence.

### Success-only export evidence

Updated:

`src/ui/persistence/WorkbookExportPanel.tsx`

The optional `onDownloaded` callback runs only after `exportAndDownload()` succeeds. Failed exports do not emit successful status evidence.

### App-shell integration

Updated:

`src/App.tsx`

The app shell now owns browser-session persistence status and an injectable `persistenceUiClock` for deterministic operation timestamps.

Successful import:

```text
hydrated result
  -> record successful import session evidence
  -> increment workspaceRevision exactly once
```

Successful export:

```text
download-dispatched result
  -> record successful export session evidence
  -> no workspaceRevision change
```

Active navigation remains unchanged by status updates.

---

## Dirty / Clean State Decision

5.5C1 deliberately does **not** introduce dirty/clean or unsaved-state claims.

The current application does not have a complete authoritative mutation-tracking boundary across every business edit. Inferring synchronization from React renders, repository reads, or persistence operations would therefore be unreliable.

A future dirty-state feature requires its own mutation-tracking contract and planning. C1 does not manufacture one.

---

## Test Coverage

Focused C1 coverage added:

```text
workbookPersistenceSession.test.ts                 4 tests
WorkbookPersistenceStatusPanel.test.tsx            3 tests
App.persistence.status.test.tsx                    5 tests
----------------------------------------------------------
Focused C1 coverage                               12 tests
```

The tests prove:

- current contract constants are surfaced without duplicated magic numbers;
- initial session has no invented workbook identity/history;
- successful import records filename, size, metadata, and observed import time;
- workbook `exportedAt` remains distinct from session import time;
- rejected/failed imports preserve the last successful import identity;
- successful export records downloaded-copy identity and observed dispatch time;
- export does not replace active imported workbook identity;
- failed exports preserve the last successful export status;
- successful import refreshes the workspace exactly once;
- export status does not remount the workspace;
- active navigation remains stable;
- native-path and dirty/clean claims are not introduced.

Existing 5.5A/5.5B regressions remain green.

---

## CI / PR Evidence

Planning baseline and plan closeout:

```text
Pre-plan develop                 a1c175176ce4df9fe1c3ae8ec91afd5151dd1e59
Pre-plan CI                      35129979872 — SUCCESS
Planning PR #203                 MERGED
Planning head                    82e7a168443688b28262d1c666adae94a902ef68
Planning PR CI                   35131606179 — SUCCESS
Planning merge / C1 baseline     f37529c3886ad52bc53347b1b275c8142b15d093
Post-plan develop CI             35131746177 — SUCCESS
```

Implementation history:

```text
Initial feature head             5ac1220d3f535aa9476d30e482f333f65a2c3a9d
Initial feature CI               35132299736 — FAILURE
Corrected feature head           8ec0ec92c122ed72084a4274a5a26e300f72c586
Corrected branch CI              35132491552 — SUCCESS
Implementation PR #204           MERGED
PR CI                            35132643889 — SUCCESS
Implementation merge             0a3a68c78a93824da1c01644cfa24723fbfaf8e5
Post-merge CI                    35132771870 — SUCCESS
```

The initial feature CI failure was isolated to a new test-harness TypeScript mock signature. The production implementation did not fail; tests/build were skipped by CI after typecheck failed. The test mock was aligned with the real `(bytes) => Promise<PersistenceWorkbookApplyResult>` command signature, after which the exact corrected head passed all gates.

Corrected green gate:

```text
125 test files / 1,413 tests PASS
12 focused C1 tests
TypeScript typecheck PASS
Production build PASS
146 modules transformed
```

Implementation diff versus exact baseline:

```text
10 commits ahead / 0 behind
9 app/persistence UI/test files changed
no docs changes in implementation PR
no domain/schema/coordinator/transport/native-filesystem changes
```

---

## Completion Gate Result

5.5C1 is complete because the browser user can now see truthful session-level workbook/import/export identity and current persistence contract information while:

- successful operations update status;
- unsuccessful operations preserve prior successful status;
- import refresh behavior remains exactly scoped;
- export never remounts live business state;
- filenames remain browser identity labels rather than native paths;
- downloaded copies remain distinct from imported workbook identity;
- no backup/atomicity/durability claim is introduced;
- no unsupported dirty/clean synchronization claim is introduced;
- full regression, typecheck, and production build are green.

## Next Exact Task

**5.5C2 — Validation Detail & Recovery Guidance UX — NEXT / NOT STARTED**
