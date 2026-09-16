# Phase 5.5C2 — Validation Detail & Recovery Guidance UX

Status: **COMPLETE**

Parent:

```text
5.5C — Persistence Status / Validation / Recovery UX — IN PROGRESS
```

Previous completed child:

```text
5.5C1 — Persistence Session Status & Workbook Identity — COMPLETE
```

Next exact child:

```text
5.5C3 — Persistence UX Regression & Phase 5.5 Completion Gate — NEXT / NOT STARTED
```

Do not begin 5.5C3 until this C2 closeout is merged into `develop`, the exact resulting `develop` CI is green, and the user separately instructs the session to proceed.

---

## Objective

Turn the structured import diagnostics already produced by the Phase 5 workbook importer and recovery classifier into actionable browser UI without flattening away the raw technical evidence or inventing native backup/filesystem capabilities.

C2 is presentation/workflow-state work only. It does not change workbook/domain semantics, persistence coordination, hydration/rollback, transport backup behavior, or Phase 6 native filesystem scope.

---

## Baseline

C2 started from the exact green C1 closeout baseline:

```text
develop  cb10db016d8f85321ca744675ae97b465db08387
CI       35133267611 — SUCCESS
```

Feature branch:

```text
feature/phase-5-5c2-validation-recovery-guidance
```

---

## Delivered Runtime Behavior

### 1. Raw importer issues remain the source of truth

Expected import rejection retains and renders the complete structured issue evidence returned by the coordinator.

For import-stage workbook issues, the UI exposes available:

- issue stage;
- issue code;
- message;
- sheet name;
- Excel row or internal row index when available;
- column;
- business/source path;
- source/target version context;
- resource usage and configured maximum when available.

The UI explicitly states that these issue records are the technical source of truth and that recovery guidance is derived from them rather than replacing them.

### 2. Existing recovery classifier remains authoritative for guidance

C2 does not duplicate or redefine recovery categorization.

For import-stage expected rejection it calls the existing:

```text
summarizeWorkbookImportRecovery(...)
```

boundary and renders its deterministic:

- primary recovery category;
- total issue count;
- non-zero issue-stage counts;
- recommended recovery actions;
- backup/restore recommendation flag.

No recovery semantics were moved into React and no storage-layer issue code meaning was changed.

### 3. Recovery categories are actionable in browser UI

The UI now gives specific guidance for:

- unsupported or incompatible workbook versions;
- corrupt/unreadable workbook bytes;
- workbook/resource-size limits;
- workbook structure problems;
- invalid workbook values;
- invalid business references/data;
- unexpected import-processing failures represented by the established classifier.

Future/incompatible version diagnostics can show source and supported-target workbook/dataset versions when supplied by the raw issue.

Resource-limit diagnostics can show actual usage and maximum values when supplied by the issue.

### 4. Browser restore wording is truthful

When the recovery classifier recommends:

```text
restore-known-good-backup
```

C2 explains that browser recovery means selecting/importing a known-good workbook copy that the user already possesses, such as an earlier exported copy.

The UI explicitly does **not** claim that browser mode:

- created a Phase 5.4B pre-save transport backup;
- discovers or manages a backup location;
- owns a native workbook path;
- can restore from a managed filesystem backup;
- performed native atomic replacement or durable filesystem persistence.

Those capabilities remain Phase 6 concerns.

### 5. Expected rejection remains distinct from operational failure

Expected structured rejection renders validation/recovery details.

Unexpected `PersistenceLifecycleOperationalError` exceptions remain on the existing operational-error path and do not manufacture a recovery summary from nonexistent importer issues.

### 6. Defensive hydration rejection remains distinct

The coordinator retains a defensive `stage: 'hydrate'` rejection shape.

C2 renders its raw dataset-validation evidence separately rather than passing that different issue type through the workbook-import recovery classifier.

### 7. Rejection lifecycle is not stale

`WorkbookImportPanel` now owns rejection presentation state alongside its existing pending-selection and feedback state.

Rejection details are cleared when:

- the user selects/changes the workbook file;
- the user cancels the pending selection;
- a new apply attempt starts;
- a later import succeeds.

A rejected workbook remains pending so the user can inspect details and choose another workbook or retry as appropriate.

### 8. Existing successful behavior remains unchanged

A successful import still:

- clears the pending selection;
- reports success;
- calls `onHydrated(...)` once;
- lets the application shell advance `workspaceRevision` exactly through the existing success-only path;
- updates C1 session status through the existing success-only callback.

Expected rejection and operational failure do not call `onHydrated(...)`.

The existing real-stack 5.5A regression remains green and continues to prove expected rejection preserves the previous authoritative live workspace.

The existing C1 app status tests remain green and continue to prove later rejected/failed imports do not replace last-successful session status.

---

## Implementation Files

C2 changed exactly five persistence UI/test files:

```text
src/ui/persistence/WorkbookImportPanel.tsx
src/ui/persistence/WorkbookImportPanel.recovery.test.tsx
src/ui/persistence/WorkbookImportRejectionDetails.tsx
src/ui/persistence/WorkbookImportRejectionDetails.test.tsx
src/ui/persistence/workbookImportRecovery.css
```

No changes were made to:

- `BusinessDataset` semantics;
- workbook schema/version constants;
- XLSX mapping/codec;
- recovery-classifier semantics;
- `PersistenceCoordinator`;
- hydration/rollback mechanics;
- `WorkbookTransport`;
- Phase 1–4 business logic;
- Phase 6 native filesystem behavior.

---

## Focused C2 Tests

C2 added **10 focused tests**.

### `WorkbookImportRejectionDetails.test.tsx` — 7 tests

Proves:

1. raw issue evidence remains visible with code/message/sheet/row/column/path;
2. future-version guidance is derived deterministically with source/target version context;
3. corrupt-workbook recovery uses browser-truthful known-good-copy language;
4. resource-limit usage and reduce-size guidance render without manufacturing backup guidance;
5. invalid-business-data guidance preserves the raw business path;
6. mixed rejection categories render deterministic stage counts and primary category;
7. defensive hydration rejection stays distinct while retaining raw dataset-validation evidence.

### `WorkbookImportPanel.recovery.test.tsx` — 3 tests

Proves:

1. expected rejection displays raw issues + derived guidance without requesting workspace refresh;
2. operational failure remains separate and does not render expected-rejection recovery UI;
3. a later successful import clears stale rejection details and returns to the normal success path.

Existing Phase 5.5A/C1 tests additionally retain proof that rejected imports preserve live state and last-successful session status.

---

## CI / PR Evidence

Feature head:

```text
6c3aa4ea0264570bd5a9d66e813fc8cff7964473
```

Feature branch CI:

```text
35133930153 — SUCCESS
```

Implementation PR:

```text
#206 — Implement Phase 5.5C2 validation and recovery guidance — MERGED
```

PR exact-head CI:

```text
35134074959 — SUCCESS
```

Implementation merge:

```text
0603ef10575f5f08c27170cb174bf23b8c675b21
```

Post-merge `develop` CI:

```text
35134221363 — SUCCESS
```

Green implementation gate:

```text
127 test files / 1,423 tests PASS
10 focused C2 tests PASS
TypeScript typecheck PASS
Production build PASS
149 modules transformed
```

Feature diff against exact baseline:

```text
5 commits ahead / 0 behind
5 persistence UI/test files changed
no domain/schema/coordinator/transport/native-filesystem changes
```

---

## Completion Gate Result

The C2 completion gate is satisfied.

Rejected imports now show deterministic, actionable, source-specific validation and recovery guidance while:

- keeping raw issue evidence visible;
- preserving the existing recovery classifier as the guidance source;
- keeping expected rejection distinct from operational error;
- retaining previous live-state preservation behavior;
- clearing stale rejection detail on subsequent workflow changes/success;
- describing backup/restore truthfully for browser mode;
- making no unsupported native path, managed backup, atomic replacement, durability, or dirty/clean claim.

Therefore:

```text
5.5C2 — Validation Detail & Recovery Guidance UX — COMPLETE
```

Next exact task:

```text
5.5C3 — Persistence UX Regression & Phase 5.5 Completion Gate — NEXT / NOT STARTED
```
