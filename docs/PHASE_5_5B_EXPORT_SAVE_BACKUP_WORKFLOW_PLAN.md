# Phase 5.5B — Export / Save & Backup Workflow Plan

## Status

**PLANNING ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning baseline:

```text
develop  088d0b7d6d5bd6114e3887293dca757140e4eaa5
CI       35064547341 — SUCCESS
```

Parent phase:

```text
5.5 — Excel Persistence UI — IN PROGRESS
```

Previous completed task:

```text
5.5A — Import / Open Workbook Workflow — COMPLETE
```

Next exact task after this planning change is merged and exact `develop` CI is green:

```text
5.5B1 — Browser Workbook Export & Download Command Boundary — NEXT / NOT STARTED
```

Do not begin 5.5B1 until this planning change is merged into `develop`, the exact resulting `develop` CI is green, and the user separately instructs to proceed.

---

## Objective

Expose the already-complete Phase 5 workbook export/save backend through a browser-compatible workflow that lets the business owner deliberately create and download a current `.xlsx` workbook without duplicating persistence logic in React and without making false claims about filesystem save, overwrite, backup, or atomic-replacement guarantees.

The core browser flow will be:

```text
current authoritative repositories
  -> CompleteSourceSnapshotService
  -> PersistenceCoordinator.exportCurrentWorkbook()
  -> canonical current XLSX bytes
  -> browser download command boundary
  -> Blob/object URL/download dispatch
  -> downloaded .xlsx copy
```

React must not construct workbook sheets, enumerate repositories, or encode XLSX directly.

---

## Repository Reassessment

The exact green baseline already contains the required backend export and safe-save foundations.

### Existing coordinator export boundary

`PersistenceCoordinator.exportCurrentWorkbook()` already owns:

- complete authoritative source snapshot acquisition;
- current workbook metadata generation;
- canonical XLSX export;
- controlled snapshot/export operational errors;
- defensive byte ownership.

The browser workflow should reuse that method for download/export.

### Existing transport save boundary

`PersistenceCoordinator.saveCurrentWorkbook(transport, options)` already owns application-level save orchestration and delegates transaction details to the supplied `WorkbookTransport`.

The transport contract already defines:

- explicit backup capability;
- `none`, `if-supported`, and `required` backup requests;
- explicit backup receipts;
- staged-replacement capability;
- truthful `atomic` versus `direct-non-atomic` replacement receipts;
- structured transport failure stages and commit state.

5.5B must preserve those semantics rather than recreating them in browser UI code.

### Browser limitation that changes the UI contract

A normal browser download does **not** own an existing authoritative workbook path and does not overwrite an existing primary workbook through the Phase 5 transport transaction.

Therefore a browser download cannot truthfully claim that it:

- created a Phase 5.4B pre-save backup of an existing primary workbook;
- performed staged replacement of an existing workbook;
- atomically replaced a previous file;
- durably flushed bytes to a filesystem;
- locked a workbook path;
- knows whether the operating system or browser ultimately persisted the file exactly where the user expected.

Those native filesystem guarantees remain Phase 6.

In browser mode, the user-facing operation is therefore **Export / Download workbook** or **Save a copy**, not an in-place filesystem save.

---

## Why 5.5B Is Split

5.5B combines three materially different concerns:

1. browser artifact creation/download dispatch and deterministic filename ownership;
2. React workflow state and truthful save/backup presentation;
3. real export regression, failure cleanup, and the parent completion gate.

Keeping these in one implementation would mix browser API ownership, React state, persistence orchestration, and completion proof in a single change.

5.5B is therefore decomposed into three child tasks:

```text
5.5B — Export / Save & Backup Workflow                       IN PROGRESS
    5.5B1 — Browser Workbook Export & Download Command Boundary  NEXT / NOT STARTED
    5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness NOT STARTED
    5.5B3 — Browser Export Regression & 5.5B Completion Gate      NOT STARTED
```

---

# 5.5B1 — Browser Workbook Export & Download Command Boundary

## Purpose

Create a small browser-facing application boundary that owns export invocation, deterministic download naming, downloadable byte ownership, and browser download dispatch without placing Blob/object-URL behavior or workbook construction inside React components.

## Required work

- define a browser-compatible workbook download/export boundary;
- call `PersistenceCoordinator.exportCurrentWorkbook()` as the authoritative source of workbook bytes;
- never build workbook sheets or encode XLSX inside the browser command;
- defensively own the exported bytes before handing them to browser download APIs;
- define deterministic `.xlsx` filename guidance using an injected clock or equivalent deterministic input;
- sanitize any filename components if configurable naming is introduced;
- create the correct XLSX Blob media type;
- create and revoke temporary object URLs deterministically;
- dispatch one browser download per explicit command;
- ensure failures before dispatch do not report success;
- expose controlled workflow errors where browser download preparation/dispatch cannot complete;
- remain independent of Tauri/native paths and filesystem APIs.

## Locked filename direction

Default download names should be deterministic and human-readable, for example:

```text
craft-business-manager-YYYY-MM-DD-HHmmss.xlsx
```

The exact formatting helper should be deterministic under tests and must always produce an `.xlsx` suffix.

The filename is guidance for a browser-created copy. It is not an authoritative native path.

## Browser download ownership

Conceptually:

```text
explicit export command
  -> PersistenceCoordinator.exportCurrentWorkbook()
  -> owned Uint8Array
  -> Blob(application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
  -> URL.createObjectURL(...)
  -> temporary <a download="..."> dispatch
  -> URL.revokeObjectURL(...)
```

React should only invoke this boundary and consume its result.

## Tests

At minimum cover:

- exactly one coordinator export call per explicit command;
- no implicit export merely from rendering UI;
- exported bytes passed intact into the browser artifact boundary;
- deterministic `.xlsx` filename generation;
- correct workbook MIME type;
- one download dispatch per command;
- object URL cleanup after successful dispatch;
- object URL cleanup when dispatch throws after URL creation;
- coordinator snapshot/export failure propagation or controlled wrapping without manufactured success;
- browser API preparation/dispatch failure as a controlled workflow error;
- no native filesystem APIs or `WorkbookTransport` transaction claims.

## Completion gate

5.5B1 is complete when one explicit browser command can obtain canonical current workbook bytes through the coordinator and safely dispatch exactly one `.xlsx` download with deterministic naming and cleanup, while remaining transport- and native-filesystem-neutral.

---

# 5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness

## Purpose

Expose the B1 download boundary through the application shell with clear user-facing behavior and honest browser capability language.

## Required work

### Export / save-copy UI

Add an application-level persistence control that provides:

- **Download workbook** / **Export workbook** action;
- deterministic suggested filename visibility where useful;
- exporting/downloading pending state;
- duplicate-submit prevention while export is active;
- controlled success feedback after download dispatch;
- controlled operational failure feedback;
- no mutation of the current authoritative source dataset.

The existing 5.5A import surface and the new export surface may share a coherent persistence/data-file area, but 5.5B must not broaden into rich status/recovery UX owned by 5.5C.

### Truthful browser save semantics

Browser mode must describe the operation as a downloaded copy.

It must not say or imply that it:

- overwrote the workbook previously imported;
- knows the user's final filesystem path;
- performed native atomic replacement;
- guaranteed durable filesystem persistence.

### Truthful backup semantics

The Phase 5.4B definition of backup is exact **pre-save primary bytes** created before destructive replacement by a transport that actually owns the primary workbook.

A normal browser download does not satisfy that definition.

Therefore B2 should present browser backup capability truthfully:

```text
Browser export/download
  -> creates a new workbook copy
  -> does not overwrite an existing primary workbook
  -> Phase 5.4B pre-save backup = not applicable / unsupported in this browser workflow
```

If the UI offers an additional manually named “backup copy” download for convenience, it must be described only as another current exported copy and must not be represented as the transport backup receipt defined by Phase 5.4B.

Native in-place save + pre-save backup behavior remains Phase 6, where a real filesystem transport can call:

```text
PersistenceCoordinator.saveCurrentWorkbook(transport, { backup: ... })
```

with truthful transport capabilities and receipts.

### Feedback boundary

5.5B may show basic controlled feedback such as:

- workbook download prepared/dispatched;
- export failed;
- browser download could not be started;
- browser mode creates a copy rather than overwriting a managed workbook.

Detailed persistence history, active workbook identity, recovery instructions, and broader backup/restore guidance remain 5.5C.

## Tests

At minimum cover:

- explicit download button wiring;
- no export during render/mount;
- duplicate click protection while export is pending;
- successful download feedback;
- coordinator/export failure feedback;
- browser dispatch failure feedback;
- no workspace revision/remount on export because live source state is unchanged;
- active navigation remains stable;
- browser backup language never claims a pre-save transport backup or atomic replacement;
- import workflow remains functional beside the export workflow.

## Completion gate

A browser user can deliberately download a current canonical `.xlsx` copy from the application, with clear pending/success/failure feedback and truthful explanation that browser export is not native in-place save or Phase 5.4B pre-save backup.

---

# 5.5B3 — Browser Export Regression & 5.5B Completion Gate

## Purpose

Prove the complete browser export workflow against the existing Phase 5 persistence stack and close 5.5B without expanding into 5.5C or Phase 6.

## Required regression matrix

### Real current dataset export

- seed representative authoritative source data;
- invoke the user-facing browser export workflow;
- capture the bytes passed to the browser download boundary;
- decode/import those real XLSX bytes through the existing production codec/import stack;
- prove the exported source dataset is equivalent to the authoritative snapshot;
- prove export does not mutate current live repositories.

### Filename and browser artifact behavior

- deterministic valid `.xlsx` name;
- expected MIME type;
- exactly one download dispatch;
- temporary object URL cleanup;
- repeated sequential exports remain valid;
- no stale bytes are reused after source data changes between exports.

### Failure behavior

- source snapshot failure;
- workbook export/encoding failure where practically injectable;
- browser Blob/object URL/download dispatch failure where practically injectable;
- no success feedback on failure;
- retry can succeed after a prior failed export;
- duplicate-submit protection remains intact.

### Backup/save truthfulness

Regression coverage must prove that browser export does not manufacture:

- a `WorkbookBackupReceipt` claiming a pre-save backup;
- an `atomic` replacement receipt;
- a native path;
- a claim that an imported workbook was overwritten.

Existing 5.4B tests remain authoritative for actual transport backup/staged replacement semantics.

### Architectural regressions

Keep green:

- complete snapshot and canonical XLSX export;
- 5.4B transport capability/backup/safe-save suites;
- 5.5A browser import/open workflow;
- Phase 1–4 business workflows;
- TypeScript typecheck;
- production build.

## Parent 5.5B completion gate

5.5B is complete only when all of the following are true:

1. browser users can explicitly request a current workbook download;
2. export flows through `PersistenceCoordinator.exportCurrentWorkbook()` rather than React-side workbook construction;
3. downloaded bytes are real canonical current `.xlsx` bytes;
4. deterministic filename guidance is provided;
5. browser artifact/object-URL lifecycle is cleaned up safely;
6. duplicate export submission is controlled;
7. success and operational failure remain distinct;
8. export does not mutate live business source state or trigger an import-style workspace refresh;
9. browser UI truthfully describes the result as a downloaded copy;
10. browser mode does not manufacture Phase 5.4B backup, atomic replacement, path, or durability guarantees;
11. the existing transport safe-save/backup contract remains unchanged for later native use;
12. all regression, typecheck, and build gates are green.

---

# Ownership Boundaries

## 5.5B owns

- browser current-workbook export invocation;
- deterministic browser download filename guidance;
- browser Blob/object-URL/download dispatch boundary;
- React export/save-copy action;
- export pending/duplicate-submit/basic success/failure state;
- truthful browser backup/save capability messaging;
- browser export regression coverage.

## 5.5B does not own

### 5.5C — Persistence Status / Validation / Recovery UX

- rich validation/recovery issue presentation;
- active workbook identity/history;
- persistence event history;
- detailed backup/restore guidance;
- unsupported-version recovery UX;
- dirty/unsaved-state model if adopted.

### Phase 6 — Tauri Desktop Integration

- native Save / Save As dialogs;
- managed workbook filesystem paths;
- native overwrite of an existing workbook;
- real pre-save filesystem backups;
- durable staged replacement;
- OS rename/replace semantics;
- locks;
- `fsync`;
- crash consistency;
- desktop packaging.

### Persistence/domain internals

5.5B must not change merely for UI convenience:

- workbook schema/version contracts;
- canonical XLSX mapping;
- `BusinessDataset` semantics;
- material/product/yield/component/stock/financial domain rules;
- hydration semantics;
- migration semantics;
- the meaning of Phase 5.4B backup or replacement receipts.

---

# Expected Implementation Sequence

```text
5.5B planning docs
  -> merge + exact green develop CI
  -> STOP

user separately says proceed
  -> 5.5B1 implementation + tests
  -> PR + green CI + merge + green develop CI
  -> docs closeout
  -> STOP

user separately says proceed
  -> 5.5B2 implementation + tests
  -> PR + green CI + merge + green develop CI
  -> docs closeout
  -> STOP

user separately says proceed
  -> 5.5B3 regression/completion gate
  -> PR + green CI + merge + green develop CI
  -> parent 5.5B docs closeout
  -> advance exactly to 5.5C — NEXT / NOT STARTED
  -> STOP
```

## Next Exact Task After Planning

**5.5B1 — Browser Workbook Export & Download Command Boundary — NEXT / NOT STARTED**

Do not begin 5.5B1 until this planning change is merged into `develop`, the exact resulting `develop` CI is green, and the user separately instructs to proceed.
