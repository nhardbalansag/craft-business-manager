# Phase 5.5A2 — React Open/Replace Workflow & Workspace Refresh

## Status

**COMPLETE**

Parent:

```text
5.5A — Import / Open Workbook Workflow — IN PROGRESS
```

Next exact task:

```text
5.5A3 — Browser Import Regression & 5.5A Completion Gate — NEXT / NOT STARTED
```

Do not begin 5.5A3 until this closeout is merged into `develop`, the exact resulting `develop` CI is green, and the user separately instructs to proceed.

---

## Objective

Expose the completed 5.5A1 browser import command through the React application while preserving the established persistence architecture:

```text
browser file chooser
  -> BrowserWorkbookImportCommand.selectFile(...)
  -> pending owned workbook bytes
  -> explicit replacement confirmation
  -> BrowserWorkbookImportCommand.applyPendingSelection()
  -> PersistenceCoordinator.importAndApplyWorkbook(...)
  -> validated atomic hydration
  -> successful result only
  -> application workspace revision advances
  -> visible workspace remounts/refetches from the same singleton repositories/services
```

React does not parse XLSX, construct workbook sheets, enumerate repositories, or perform hydration directly.

---

## Authoritative Baseline

A2 started only after the A1 closeout was merged and exact `develop` CI was green:

```text
develop  15fbdf5ae44b08a8bd2070dfd85a55c98eeda185
CI       35061767967 — SUCCESS
```

Feature branch:

```text
feature/phase-5-5a2-react-open-replace-workflow
```

The branch was created from the exact baseline above.

---

## Delivered Runtime Behavior

### 1. Open / Import workbook surface

A dedicated `WorkbookImportPanel` now exposes browser-compatible workbook import controls at application-shell level.

The surface provides:

- an **Open / Import workbook** section;
- a hidden browser file input constrained to `.xlsx` as a UX filter;
- **Choose workbook** / **Choose another workbook** actions;
- selected workbook name and byte-size summary;
- **Cancel selection** before apply;
- **Apply import** as the explicit destructive action;
- visible reading/importing states;
- duplicate-submit prevention while an operation is active.

The extension/MIME filter remains UX guidance only. Workbook contents are still validated exclusively by the existing persistence/import stack.

### 2. Explicit replacement confirmation

Selecting a file remains non-destructive.

Before `applyPendingSelection()` is invoked, the UI requires an explicit confirmation that a successful import replaces the currently loaded authoritative business data.

Cancelling that confirmation performs no import and requests no workspace refresh.

### 3. Existing A1/coordinator boundary preserved

React talks to the A1 `BrowserWorkbookImportCommand`; the command delegates to `PersistenceCoordinator.importAndApplyWorkbook(...)`.

A2 does not introduce React-side knowledge of:

- workbook sheets or schema mapping;
- SheetJS parsing;
- compatibility or migration execution;
- business dataset validation rules;
- repository lists;
- hydration replacement mechanics;
- Tauri/native paths or filesystem I/O.

### 4. Controlled result states

The UI keeps these outcomes distinct:

```text
hydrated
  -> success feedback
  -> clear pending selection
  -> advance workspace revision

rejected
  -> basic issue-count/stage feedback
  -> retain pending selection
  -> no successful workspace refresh

operational failure
  -> controlled error message
  -> no successful workspace refresh
```

Detailed issue browsing, recovery instructions, backup/restore guidance, persistence history, and richer diagnostics remain owned by **5.5C**.

### 5. Success-only workspace refresh

`App` now owns an application-level `workspaceRevision` state.

The active business workspace is rendered under a keyed boundary:

```text
key = workspaceRevision
```

Only a successful `{ status: 'hydrated' }` result invokes the shell callback that increments the revision.

The navigation `section` state is outside the keyed boundary. Therefore:

- the current section remains selected across a successful import;
- the visible page remounts and re-runs its repository/service reads;
- the existing singleton repository/service graph remains intact;
- no new service graph is constructed merely to refresh the UI.

Rejected imports and operational failures do not advance the revision.

---

## Test Coverage

### `WorkbookImportPanel.test.tsx`

Eight focused tests prove:

1. browser chooser wiring and `.xlsx` accept guidance;
2. selected name/byte-size presentation without implicit apply;
3. cancel-selection behavior;
4. controlled browser file-read failure;
5. destructive confirmation before apply;
6. successful hydrate feedback, selection clearing, and exactly one refresh notification;
7. expected rejection and operational failure do not request a successful refresh;
8. duplicate apply is blocked while an import is pending.

### `App.persistence.test.tsx`

Four application-shell tests prove:

1. a successful simulated hydration updates the same singleton material repository, advances workspace revision, remounts Materials, and visibly reads the imported material;
2. rejection leaves revision unchanged and preserves the current visible presentation;
3. operational failure leaves revision unchanged and preserves the current visible presentation;
4. successful import while Products is active keeps Products selected across the workspace remount.

Existing application smoke, Products, Production, persistence, compatibility, recovery, hydration, Phase 1–4, typecheck, and production build suites remain green.

---

## Validation Evidence

An initial feature run stopped at typecheck because the test callback mock was inferred as a broad Vitest mock type rather than the required `() => void` callback:

```text
Initial feature CI  35062380717 — FAILURE
Scope               test typing only
```

The test mock was narrowed; production behavior did not change.

Corrected feature evidence:

```text
Feature head         a154942b1945c44bd7ae4057d25eadc5dc7aff76
Branch CI            35062474596 — SUCCESS
PR #191 CI           35062595529 — SUCCESS
Implementation PR    #191 — MERGED
Implementation merge e4be2a7b3f9f4289b00177a5f96bd61da113420d
Post-merge CI        35062713682 — SUCCESS
```

Corrected green gate:

```text
116 test files / 1351 tests
8 focused WorkbookImportPanel tests
4 app-shell workspace-refresh integration tests
TypeScript typecheck — PASS
Production build — PASS
138 modules transformed
```

The build continues to report the existing non-fatal large-chunk advisory; it does not fail the production build and is not an A2 persistence-contract issue.

---

## Scope Boundary Preserved

A2 did **not** implement:

- end-to-end real workbook browser regression completion — 5.5A3;
- browser export/download/save — 5.5B;
- backup export/download UI — 5.5B;
- rich validation/recovery/status UX — 5.5C;
- active workbook history/status model — 5.5C;
- native Open/Save dialogs — Phase 6;
- native file paths or filesystem writes — Phase 6;
- locking, `fsync`, platform rename/replace or crash consistency — Phase 6;
- workbook schema/version changes;
- business domain changes.

---

## Completion Gate Result

Phase 5.5A2 completion requirements are satisfied:

- browser `.xlsx` selection is exposed through React;
- selection remains non-destructive;
- selected workbook identity is visible;
- explicit confirmation is required before replacement apply;
- import runs through the A1 command and existing `PersistenceCoordinator`;
- pending/importing states prevent duplicate submit;
- success, expected rejection, and operational failure remain distinct;
- workspace revision advances only after successful hydration;
- the visible workspace remounts/refetches from the same singleton source graph;
- active navigation remains stable across successful refresh;
- rejected/failed imports do not manufacture a successful refresh;
- full CI is green.

Therefore:

```text
5.5A1 — COMPLETE
5.5A2 — COMPLETE
5.5A3 — NEXT / NOT STARTED
```
