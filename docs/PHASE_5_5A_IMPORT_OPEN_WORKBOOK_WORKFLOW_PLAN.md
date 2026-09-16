# Phase 5.5A — Import / Open Workbook Workflow Plan

## Status

**PLANNING ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning baseline:

```text
develop  728b9b99b1da5192fd894f04c64d7ab3d1447d07
CI       35058157911 — SUCCESS
```

Parent phase:

```text
5.5 — Excel Persistence UI
```

Previous prerequisite:

```text
5.4 — Version Compatibility, Backup & Recovery Safety — COMPLETE
```

## Objective

Expose the already-complete Phase 5 import/hydration backend through a safe browser-compatible React workflow that lets the business owner choose a `.xlsx` workbook, explicitly replace the currently loaded source state, apply the workbook through the existing `PersistenceCoordinator`, and refresh the visible application workspace from the newly hydrated authoritative repositories.

Phase 5.5A must not duplicate workbook parsing, validation, migration, recovery classification, repository replacement, or domain rules in React.

## Repository Audit

The current application already has the required backend import boundary:

```text
persistenceCoordinator.importAndApplyWorkbook(bytes)
```

The shared application session already wires:

```text
SheetJsWorkbookCodec
CompleteSourceSnapshotService
ValidatedAtomicDatasetHydrationService
PersistenceCoordinator
```

The existing coordinator already provides:

- strict XLSX import;
- resource-limit enforcement;
- compatibility/version handling;
- current-schema validation;
- dataset reconstruction and integrity validation;
- atomic hydration;
- controlled import rejection;
- controlled operational failure wrapping.

The React shell currently has no persistence/data-file surface and no browser file input.

The current application also uses singleton in-memory repositories/services from `src/application/session.ts`, while individual React workspaces load repository-backed state into local component state. Hydrating the singleton repositories therefore does not automatically force an already-mounted workspace to refetch. A successful import needs an explicit application-level refresh/remount boundary so the visible UI cannot keep presenting stale pre-import data.

## Why 5.5A Is Split

The parent task combines three materially different concerns:

1. browser file selection and owned-byte acquisition;
2. destructive replacement confirmation, coordinator invocation, and React workspace refresh;
3. end-to-end browser import regression and completion evidence.

Keeping those concerns in one PR would make browser APIs, persistence orchestration, React state invalidation, and completion testing land simultaneously.

5.5A is therefore decomposed into three child tasks.

```text
5.5A — Import / Open Workbook Workflow                     IN PROGRESS
    5.5A1 — Browser File Selection & Import Command Boundary  NEXT / NOT STARTED
    5.5A2 — React Open/Replace Workflow & Workspace Refresh   NOT STARTED
    5.5A3 — Browser Import Regression & 5.5A Completion Gate  NOT STARTED
```

---

# 5.5A1 — Browser File Selection & Import Command Boundary

## Purpose

Create a small browser-facing import boundary that owns selected-file byte acquisition and pending-import state without placing file APIs or workbook parsing logic inside the React page components.

## Required Work

- define the browser-compatible selected-workbook input contract;
- accept a user-selected file and defensively read it as `Uint8Array` bytes;
- preserve basic file identity needed by the UI, such as file name and byte length;
- treat `.xlsx` extension filtering as a UX guard only, not as trusted content validation;
- own/copy the acquired workbook bytes so caller mutation cannot alter the pending import;
- model selection cancellation as a non-error/no-op outcome;
- convert browser file-read failures into controlled workflow errors;
- expose a deliberate apply/import command that delegates to the existing `PersistenceCoordinator` rather than parsing sheets directly;
- prevent a pending file selection from implicitly mutating live repositories merely because it was selected;
- remain independent of Tauri/native paths/dialogs.

## Locked Boundary

A selected file is **not** an applied workbook.

Conceptually:

```text
browser File
  -> read ArrayBuffer
  -> owned Uint8Array
  -> pending workbook selection
  -> explicit apply command
  -> PersistenceCoordinator.importAndApplyWorkbook(...)
```

The workbook codec and validation stack remain authoritative for file contents. File name/MIME metadata must never be used as proof that the workbook is valid.

## Tests

At minimum cover:

- `.xlsx` selection;
- defensive byte ownership;
- selection cancellation;
- file-read failure;
- unsupported filename/extension UX rejection where enforced;
- no coordinator call merely from selecting a file;
- exactly one coordinator call per explicit apply command;
- import rejection/result pass-through without manufacturing success.

## Completion Gate

- browser file bytes can be acquired without native APIs;
- selection remains non-destructive;
- explicit apply delegates through the existing persistence coordinator;
- no React page constructs workbook sheets or hydrates repositories directly;
- full repository CI is green.

---

# 5.5A2 — React Open/Replace Workflow & Workspace Refresh

## Purpose

Expose the A1 import boundary through a dedicated user-facing data-file workflow and guarantee that successful hydration becomes visible across the existing workspaces.

## Required Work

### Persistence UI surface

Add a dedicated persistence/data-file surface or appropriately scoped application-level controls that provide:

- **Open / Import workbook** action;
- browser `.xlsx` file chooser;
- selected file name and size summary;
- clear explanation that a successful import replaces the currently loaded authoritative business source state;
- explicit confirmation before the destructive apply command;
- cancel/change-file behavior before apply;
- pending/importing state;
- duplicate-submit prevention.

### Coordinator integration

- call only the A1/browser import boundary and existing `PersistenceCoordinator`;
- never construct sheets, parse XLSX, enumerate repositories, or run hydration directly from React;
- represent successful hydration separately from expected import rejection and operational failure;
- preserve the existing previous-state safety guarantees on rejection/failure.

### Workspace refresh contract

Introduce one deliberate application-level workspace revision/refresh mechanism.

After **successful hydration only**:

```text
hydration succeeds
  -> advance workspace revision
  -> remount/refetch repository-backed workspace state
  -> keep application service/repository singleton identities intact
```

The mechanism may use an application-shell revision key or an equivalent narrowly scoped approach, but it must not reconstruct the service graph or replace repository instances.

Requirements:

- current/selected navigation section should remain stable where practical;
- successful import causes the visible workspace to read the newly hydrated source state;
- rejected/failed imports do not trigger a false successful refresh;
- no hidden partial-import state is presented.

### Basic feedback boundary

5.5A may show basic controlled feedback such as:

- import succeeded;
- import rejected with issue count/category summary;
- file read failed;
- unexpected persistence operation failed.

Detailed issue browsing, recovery instructions, backup/restore UX, active workbook identity, and richer persistence status belong to **5.5C**.

## Tests

At minimum cover:

- file chooser wiring;
- replacement confirmation;
- cancelling before apply;
- apply button disabled while pending;
- successful coordinator result;
- rejected import result;
- operational error result;
- no duplicate apply while an import is running;
- workspace revision changes only after successful hydrate;
- visible workspace refetch/remount after successful import;
- active navigation does not unexpectedly jump on success;
- rejection/failure leaves the current workspace state presentation intact until its normal next refresh.

## Completion Gate

A user can select and explicitly import a valid `.xlsx` workbook in the browser-compatible app and the visible application immediately reflects the hydrated authoritative state without native filesystem APIs.

---

# 5.5A3 — Browser Import Regression & 5.5A Completion Gate

## Purpose

Prove the complete 5.5A user workflow against the already-complete 5.1–5.4 persistence stack and close the parent task without expanding into export or recovery UX.

## Required Regression Matrix

### Valid workbook

- create or use real valid current v1/v1 XLSX bytes;
- select through the browser file boundary;
- require explicit apply;
- hydrate successfully;
- refresh the visible workspace;
- prove imported source state is what the application subsequently reads.

### Invalid workbook

Cover representative existing rejection classes without re-testing every low-level validator:

- corrupt/unreadable workbook;
- incompatible/future version;
- invalid workbook structure/value;
- invalid business dataset;
- resource-limit rejection where practical in the UI workflow harness.

For each representative rejection:

- no success state;
- no successful workspace revision advance;
- previous live authoritative source state remains unchanged;
- controlled summary remains available to the UI.

### Browser/workflow failures

- cancelled selection;
- file-read failure;
- repeated click/apply protection;
- unexpected coordinator operational error;
- changing the selected file before apply;
- successful second import after a prior rejected attempt.

### Architectural regressions

Keep existing guarantees green:

- Phase 5.3 atomic hydration/rollback;
- Phase 5.4 compatibility, backup, resource-limit, and recovery tests;
- Phase 1–4 business workflows;
- recent Production and Products UI interaction suites;
- TypeScript typecheck;
- production build.

## Parent 5.5A Completion Gate

5.5A is complete only when all of the following are true:

1. browser users can choose an `.xlsx` workbook;
2. selection alone never mutates live state;
3. replacement requires a deliberate apply/confirmation action;
4. import flows through `PersistenceCoordinator`;
5. valid import atomically hydrates the authoritative dataset;
6. successful hydration refreshes/remounts the visible workspace from the same singleton repositories/services;
7. invalid/rejected import leaves the previous dataset unchanged;
8. controlled workflow feedback exists without duplicating the full 5.5C recovery UX;
9. no Tauri/native file dialog/path/filesystem behavior is introduced;
10. all CI gates are green.

---

# Ownership Boundaries

## 5.5A owns

- browser workbook file selection;
- browser file-to-byte acquisition;
- pending selected-workbook state;
- explicit destructive import confirmation;
- calling the existing persistence coordinator;
- basic import success/rejection/failure UI state;
- application workspace refresh after successful hydration;
- browser import regression coverage.

## 5.5A does not own

### 5.5B — Export / Save & Backup Workflow

- workbook download/export;
- save filename recommendation;
- backup export/download UI;
- save receipts/status.

### 5.5C — Persistence Status / Validation / Recovery UX

- rich validation issue explorer;
- detailed recovery instructions;
- backup/restore guidance UI;
- active workbook identity/status history;
- richer persistence timestamps/status panels;
- dirty/unsaved-state UX if adopted.

### Phase 6 — Tauri Desktop Integration

- native Open/Save dialogs;
- native file paths;
- application-data directories;
- OS filesystem reads/writes;
- durable native backup/replace semantics;
- locking, `fsync`, crash consistency, or desktop packaging.

### Domain/application business rules

5.5A must not change:

- material conversion/costing rules;
- yield/recipe logic;
- component graphs;
- inventory semantics;
- pricing/profit formulas;
- production/capacity calculations;
- workbook schema/version contracts merely for UI convenience.

---

# Expected Implementation Sequence

```text
5.5A planning docs
  -> merge + green develop CI
  -> STOP

user separately says proceed
  -> 5.5A1 implementation + tests
  -> PR + green CI + merge + green develop CI
  -> docs closeout
  -> STOP

user separately says proceed
  -> 5.5A2 implementation + tests
  -> PR + green CI + merge + green develop CI
  -> docs closeout
  -> STOP

user separately says proceed
  -> 5.5A3 regression/completion gate
  -> PR + green CI + merge + green develop CI
  -> parent 5.5A docs closeout
  -> advance to 5.5B NEXT / NOT STARTED
  -> STOP
```

## Next Exact Task After This Planning PR

**5.5A1 — Browser File Selection & Import Command Boundary — NEXT / NOT STARTED**

Do not begin 5.5A1 until this planning branch is merged into `develop`, the exact resulting `develop` CI is green, and the user separately instructs to proceed.
