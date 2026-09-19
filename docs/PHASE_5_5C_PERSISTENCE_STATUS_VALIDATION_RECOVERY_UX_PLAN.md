# Phase 5.5C — Persistence Status / Validation / Recovery UX Plan

## Status

**PLANNING ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning baseline:

```text
develop  a1c175176ce4df9fe1c3ae8ec91afd5151dd1e59
CI       35129979872 — SUCCESS
```

Parent phase:

```text
5.5 — Excel Persistence UI — IN PROGRESS
```

Previous completed task:

```text
5.5B — Export / Save & Backup Workflow — COMPLETE
```

Next exact implementation task after this plan is merged and the exact resulting `develop` CI is green:

```text
5.5C1 — Persistence Session Status & Workbook Identity — NEXT / NOT STARTED
```

---

## Objective

Complete the browser-facing Phase 5.5 persistence experience without changing workbook/domain semantics or pretending that browser downloads provide native filesystem guarantees.

5.5C must let the user understand:

- which imported workbook identity is currently known to the browser session;
- the current supported workbook-format and dataset-schema versions;
- the latest successful import and export/download operations in UI state;
- why a rejected workbook failed, using the authoritative raw importer issues;
- what recovery action is appropriate for unsupported versions, corrupt workbooks, resource limits, structural errors, or invalid business data;
- when backup/restore guidance applies conceptually and when browser mode cannot provide a Phase 5.4B transport backup.

5.5C is UI/session guidance only. It must not alter the canonical workbook, persistence coordinator, hydration semantics, transport backup contract, or native filesystem scope.

---

# Why 5.5C Is Split

The master plan groups several distinct concerns under one heading:

1. persistence-session status and known workbook identity;
2. rejected-import validation details and recovery guidance;
3. regression proof and the parent Phase 5.5 completion gate.

Combining all three in one implementation would mix state modeling, import diagnostics, recovery copy, React integration, and completion proof.

5.5C is therefore decomposed into three bounded children:

```text
5.5C — Persistence Status / Validation / Recovery UX                 IN PROGRESS
    5.5C1 — Persistence Session Status & Workbook Identity           NEXT / NOT STARTED
    5.5C2 — Validation Detail & Recovery Guidance UX                 NOT STARTED
    5.5C3 — Persistence UX Regression & Phase 5.5 Completion Gate    NOT STARTED
```

---

# 5.5C1 — Persistence Session Status & Workbook Identity

## Purpose

Introduce a browser-session status model and a visible persistence-status surface without inventing durable history or native file identity.

## Locked status semantics

The status is **session UI state**, not authoritative business data and not persisted into the workbook.

The UI may know:

- current supported workbook format ID/version;
- current supported dataset schema version;
- last successfully imported workbook filename and size;
- metadata returned by the successful import;
- time the application session observed the successful import;
- last successfully downloaded/exported filename and size;
- metadata returned by the successful export;
- time the application session observed the successful download dispatch.

The UI must distinguish:

```text
workbook metadata exportedAt
!=
application-session importedAt/downloadedAt
```

The imported filename is a browser-selected identity label only. It is not a managed filesystem path.

## Required implementation

- create a small immutable/pure persistence UI session-state model;
- expose the current workbook contract using existing version constants rather than duplicated magic numbers;
- record successful import identity + metadata only after hydration succeeds;
- record successful export/download identity + metadata only after browser dispatch succeeds;
- do not update successful-operation status on rejected import or operational failure;
- add a React persistence status panel near the existing import/export controls;
- show a clear empty state before any successful import/export in the current app session;
- preserve active navigation and existing `workspaceRevision` behavior;
- use an injectable clock or equivalent deterministic input for observed-operation timestamps.

## Dirty / unsaved state decision

**Do not introduce dirty/unsaved-state claims in 5.5C1.**

The current application has no single authoritative mutation/event boundary covering every business edit. Inferring `clean` or `dirty` from React renders or repository reads would be unreliable and could mislead the user.

A future dirty-state feature requires a deliberate mutation-tracking contract and separate planning. Until then the UI must not claim that the current workbook copy is synchronized with all live edits.

## C1 tests

At minimum prove:

- initial status uses current format/schema constants and has no known active import/export;
- successful import records filename, size, imported workbook metadata, and observed import time;
- rejected/failed import does not replace the last successful import status;
- successful export records downloaded filename, size, export metadata, and observed download time;
- failed export does not replace the last successful export status;
- imported filename is presented as browser-known identity, not a native path;
- export remains a downloaded copy and is not represented as overwriting the active imported workbook;
- status updates do not trigger an extra workspace revision beyond the existing successful import refresh;
- export status updates do not remount the workspace or change active navigation.

## C1 completion gate

A user can see truthful session-level persistence status and the current workbook/dataset contract after successful import/export operations, without any false native-path, backup, overwrite, durability, or dirty-state claim.

---

# 5.5C2 — Validation Detail & Recovery Guidance UX

## Purpose

Turn the structured import diagnostics completed in 5.2C/5.4C into actionable browser UI while retaining raw issues as the technical source of truth.

## Required implementation

For expected import rejection:

- retain the complete raw `BusinessDatasetWorkbookImportIssue[]` from the coordinator result;
- derive recovery guidance through the existing `summarizeWorkbookImportRecovery(...)` boundary;
- show total issue count and useful stage/category summaries;
- show issue details with available sheet, row, column/path, code, and message;
- provide specific unsupported/incompatible-version guidance;
- provide corrupt/unreadable workbook guidance;
- provide workbook-size/resource-limit guidance;
- provide workbook-structure/value guidance;
- provide invalid-business-data guidance;
- keep expected rejection distinct from unexpected operational failure.

## Recovery guidance truthfulness

The existing recovery model may recommend `restore-known-good-backup` for appropriate rejection categories.

In browser mode that guidance means:

- choose/import a known-good workbook copy the user already possesses; or
- choose another valid exported copy.

It must **not** imply the browser application created or manages a Phase 5.4B pre-save transport backup.

Native managed backup discovery/restore remains Phase 6.

## C2 tests

At minimum cover:

- raw issue details remain visible and are not replaced by only a generic summary;
- deterministic recovery category/action rendering;
- future/unsupported-version guidance;
- corrupt codec failure guidance;
- resource-limit guidance;
- schema/structure/value guidance;
- invalid-business-data guidance;
- backup/restore copy remains browser-truthful;
- previous live workspace remains unchanged on expected rejection;
- a later successful import clears/replaces stale rejection detail appropriately.

## C2 completion gate

Rejected imports show deterministic, actionable, source-specific validation and recovery guidance without hiding the raw issue evidence or making unsupported browser backup/native filesystem claims.

---

# 5.5C3 — Persistence UX Regression & Phase 5.5 Completion Gate

## Purpose

Prove the complete Phase 5.5 browser persistence UI across import, export, status, validation, and recovery, then close Phase 5.5 without beginning Phase 5.6.

## Required regression matrix

### Successful import/status

- import real current XLSX bytes through the production stack;
- visible workspace refreshes exactly once;
- status records the selected browser filename and imported metadata;
- status shows current format/schema versions;
- active navigation remains stable.

### Successful export/status

- user-facing export captures real current XLSX bytes;
- status records the downloaded copy filename and export metadata;
- no workspace refresh/remount;
- active imported workbook identity is not falsely replaced by the exported copy identity.

### Rejection/recovery

- future version;
- corrupt/unreadable workbook;
- resource limit;
- workbook structure/schema error;
- invalid business reference/data;
- raw issues + deterministic recovery guidance visible;
- previous live source state preserved;
- last successful status not overwritten by rejection.

### Operational failures

- unexpected import operational failure does not masquerade as expected validation rejection;
- export operational/browser failure does not report a successful download status;
- retry remains possible.

### Truthfulness regressions

The browser UI must not claim:

- a managed native workbook path;
- native in-place overwrite;
- Phase 5.4B pre-save backup creation;
- atomic filesystem replacement;
- durable filesystem flush;
- dirty/clean synchronization status without a real mutation-tracking contract.

### Architecture/regression gate

Keep green:

- Phase 5.4 compatibility/recovery/safe-save suites;
- 5.5A import regression;
- 5.5B export regression;
- Phase 1–4 business suites;
- TypeScript typecheck;
- production build.

## Parent Phase 5.5 completion gate

Phase 5.5 is complete only when:

1. browser users can select/import current `.xlsx` workbooks deliberately;
2. valid imports hydrate authoritative source state atomically and refresh views;
3. invalid imports preserve prior live state;
4. browser users can download a current canonical `.xlsx` copy deliberately;
5. export does not mutate/remount live business state;
6. session status shows truthful known workbook/import/export identity and versions;
7. rejected imports expose useful raw validation details;
8. deterministic recovery guidance is shown for supported failure categories;
9. browser backup/save guidance remains truthful about copy-only behavior;
10. no unsupported native path/atomicity/durability/dirty-state claim is introduced;
11. all Phase 1–5.5 regression tests remain green;
12. typecheck and production build remain green.

After the parent 5.5 closeout is merged and exact `develop` CI is green, advance exactly to:

```text
5.6A — Integrated Excel Round-Trip Workflow — NEXT / NOT STARTED
```

Do not begin 5.6A without a separate user instruction.

---

# Ownership Boundaries

## 5.5C owns

- browser-session persistence status;
- known imported workbook identity labels;
- last successful import/export operation UI timestamps;
- current supported workbook/dataset version display;
- import validation detail rendering;
- recovery summary/action rendering;
- browser-truthful backup/restore guidance;
- Phase 5.5 browser UX completion regression.

## 5.5C does not own

### Phase 5.6

- full Phase 1–4 service-result equivalence after export/import/hydration;
- final Phase 5 integration/completion gate.

### Phase 6

- native Open/Save/Save As dialogs;
- managed filesystem paths;
- in-place overwrite;
- real filesystem pre-save backups;
- backup discovery/restore from managed locations;
- OS atomic rename/replace semantics;
- locks, `fsync`, crash consistency, desktop packaging.

### Domain / persistence internals

5.5C must not alter merely for UI convenience:

- `BusinessDataset` semantics;
- workbook schema/version constants;
- canonical XLSX mapping;
- importer issue meaning;
- migration compatibility rules;
- hydration/rollback semantics;
- `WorkbookTransport` backup/replacement receipt semantics;
- Phase 1–4 costing/yield/component/inventory/pricing rules.

---

# Expected Implementation Sequence

```text
5.5C planning docs
  -> PR + green CI + merge + exact green develop CI
  -> 5.5C1 implementation
  -> PR + green CI + merge + green develop CI
  -> docs closeout
  -> STOP

user separately says proceed
  -> 5.5C2 implementation
  -> PR + green CI + merge + green develop CI
  -> docs closeout
  -> STOP

user separately says proceed
  -> 5.5C3 regression/completion gate
  -> PR + green CI + merge + green develop CI
  -> parent 5.5 docs closeout
  -> advance to 5.6A NEXT / NOT STARTED
  -> STOP
```

## Next Exact Task

**5.5C1 — Persistence Session Status & Workbook Identity — NEXT / NOT STARTED**
