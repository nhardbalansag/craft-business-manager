# Phase 5.5B — Export / Save & Backup Workflow Completion

Status: **COMPLETE**

Parent phase:

```text
5.5 — Excel Persistence UI — IN PROGRESS
```

Completed sequence:

```text
5.5B1 — Browser Workbook Export & Download Command Boundary      COMPLETE
5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness COMPLETE
5.5B3 — Browser Export Regression & 5.5B Completion Gate        COMPLETE
```

Next exact task after this closeout is merged and exact `develop` CI is green:

```text
5.5C — Persistence Status / Validation / Recovery UX — NEXT / NOT STARTED
```

Do not begin 5.5C until this closeout is merged, the exact resulting `develop` CI is green, and the user separately instructs to proceed.

---

## Objective Delivered

Phase 5.5B exposes the completed Phase 5 workbook export backend as a truthful browser-compatible **Download workbook / Save a copy** workflow.

The completed browser path is:

```text
current authoritative repositories
  -> CompleteSourceSnapshotService
  -> PersistenceCoordinator.exportCurrentWorkbook()
  -> canonical current XLSX bytes
  -> BrowserWorkbookExportCommand
  -> Blob/object URL/download dispatch
  -> downloaded .xlsx copy
```

React does not construct workbook sheets, enumerate repositories, encode XLSX, invoke a native filesystem transport, or manufacture transport save/backup semantics.

---

## 5.5B1 — Browser Export Command Boundary — COMPLETE

5.5B1 established `BrowserWorkbookExportCommand` as the application-level browser artifact boundary.

Delivered:

- canonical bytes come only from `PersistenceCoordinator.exportCurrentWorkbook()`;
- exported bytes are defensively owned before browser artifact creation;
- deterministic UTC filename guidance in `craft-business-manager-YYYY-MM-DD-HHmmss.xlsx` format;
- official XLSX MIME type;
- injectable Blob/object-URL/download/revoke behavior for deterministic tests;
- one explicit command produces one coordinator export and one download dispatch;
- temporary object URLs are revoked after successful dispatch and dispatch failure;
- preparation, dispatch, and cleanup failures are controlled and distinct;
- coordinator snapshot/export operational errors preserve their existing lifecycle meaning;
- result metadata does not invent a `WorkbookTransport` receipt, native path, backup receipt, or atomicity claim.

Evidence:

```text
Corrected feature head        f8663c5ef353672a297ca16e544af32b7b32d4ea
Corrected branch CI           35078325763 — SUCCESS
Implementation PR #196        MERGED
PR CI                         35078451640 — SUCCESS
Implementation merge          d4d1b3a19b2e7e1c55058e40a3f3e103787097c7
Post-merge CI                 35078559069 — SUCCESS
118 test files / 1372 tests
13 focused BrowserWorkbookExportCommand tests
```

---

## 5.5B2 — React Export / Save-Copy Workflow — COMPLETE

5.5B2 exposed B1 through the application shell.

Delivered:

- `WorkbookExportPanel` with explicit **Download workbook** action;
- no export merely from render/mount;
- `Preparing download…` pending state;
- duplicate-submit protection using disabled state plus an in-flight ref guard;
- copy-oriented success feedback with the generated filename;
- controlled failure feedback and retry support;
- export does not advance `workspaceRevision` or remount the live workspace;
- active navigation remains stable;
- existing 5.5A import/replace workflow continues to operate beside export;
- user-facing wording states browser export creates a new `.xlsx` copy;
- browser mode does not claim overwrite, managed path, pre-save backup, atomic replacement, or durable filesystem persistence.

Evidence:

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
2 focused app-shell integration tests
```

---

## 5.5B3 — Browser Export Regression & Completion Gate — COMPLETE

B3 added a real-stack user-facing browser regression without changing runtime behavior.

The new regression seeds representative authoritative source evidence across all nine persisted source collections and proves:

1. the React **Download workbook** action invokes the real browser export command;
2. the command uses the real shared `PersistenceCoordinator`;
3. the actual bytes passed to browser artifact creation are valid current XLSX bytes;
4. those captured bytes decode/import through the production `SheetJsWorkbookCodec` and `importBusinessDatasetFromXlsx(...)` stack;
5. the reconstructed dataset is equivalent to the authoritative source snapshot;
6. export leaves live repositories unchanged;
7. deterministic filename guidance and the official XLSX MIME type reach the browser boundary;
8. exactly one browser dispatch occurs per explicit successful export;
9. temporary object URLs are revoked;
10. sequential exports after source changes contain fresh data rather than stale bytes;
11. source snapshot failure yields no false success/download and retry succeeds;
12. injected workbook encoding failure yields no false success/download and retry succeeds;
13. browser artifact preparation failure yields no false success/download and retry succeeds;
14. failed browser dispatch still cleans its object URL and retry succeeds;
15. existing B1/B2 tests continue to prove duplicate-submit protection and absence of manufactured transport receipt/native path/backup/atomicity claims;
16. existing Phase 5.4B safe-save tests and Phase 5.5A import regression remain green.

Evidence:

```text
Baseline develop          014f40e5d1e50752abb504d89f1c759df5a2d7c3
Baseline CI               35126766679 — SUCCESS
Feature branch            feature/phase-5-5b3-browser-export-regression
Feature head              6f61fe1ae9e80b8a7c5592b3d38261a7874f34e1
Feature CI                35129097293 — SUCCESS
Implementation PR #201    MERGED
PR CI                     35129252003 — SUCCESS
Implementation merge      68a34802d4768438cd67fe0cdab42b95145ecbe1
Post-merge CI             35129363820 — SUCCESS
122 test files / 1401 tests
6 focused B3 real-stack regression tests
Typecheck PASS
Production build PASS
143 modules transformed
```

B3 is a tests-only implementation change: one regression test file was added and no runtime/domain/schema/native-filesystem code changed.

---

## Parent 5.5B Completion Gate

All locked parent completion conditions are satisfied:

1. browser users can explicitly request a current workbook download — **PASS**;
2. export flows through `PersistenceCoordinator.exportCurrentWorkbook()` — **PASS**;
3. downloaded bytes are real canonical current `.xlsx` bytes — **PASS**;
4. deterministic filename guidance is provided — **PASS**;
5. browser artifact/object-URL lifecycle is cleaned safely — **PASS**;
6. duplicate export submission is controlled — **PASS**;
7. success and operational failure remain distinct — **PASS**;
8. export does not mutate live source state or trigger import-style refresh — **PASS**;
9. browser UI truthfully describes the result as a downloaded copy — **PASS**;
10. browser mode does not manufacture Phase 5.4B backup, atomic replacement, path, or durability guarantees — **PASS**;
11. the transport safe-save/backup contract remains unchanged for later native use — **PASS**;
12. regression, typecheck, and production build gates are green — **PASS**.

Therefore:

```text
5.5B — Export / Save & Backup Workflow — COMPLETE
```

---

## Locked Browser Save / Backup Meaning

A normal browser export is:

```text
current source data
  -> fresh canonical workbook bytes
  -> downloaded new copy
```

It is **not**:

```text
existing managed primary workbook
  -> pre-save backup
  -> staged replacement
  -> atomic native overwrite
  -> durable filesystem flush
```

The Phase 5.4B backup definition remains exact pre-save primary bytes created before destructive replacement by a transport that owns an existing primary workbook. Browser download does not satisfy that contract and therefore creates no `WorkbookBackupReceipt`.

Native Save / Save As, managed filesystem paths, real pre-save backup, atomic replacement, locking, `fsync`, crash consistency, and desktop packaging remain Phase 6.

---

## Out of Scope / Unchanged

5.5B did not change:

- `BusinessDataset` semantics;
- workbook schema or public v1/v1 versions;
- canonical XLSX mapping;
- migration behavior;
- hydration behavior;
- material/product/yield/component/stock/financial business rules;
- `WorkbookTransport` backup/replacement semantics;
- native filesystem behavior.

Rich persistence status, validation detail, recovery guidance, active workbook/history concepts, and any adopted dirty-state experience remain 5.5C.

---

## Next Exact Task

**5.5C — Persistence Status / Validation / Recovery UX — NEXT / NOT STARTED**

Stop after this closeout is merged and exact `develop` CI is green. Do not begin 5.5C without a separate user instruction.
