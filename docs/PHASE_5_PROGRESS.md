# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Current authoritative implementation baseline after 5.5A3:

```text
develop  6ca74db286beb02ff1672511ddcecc1773ddee73
CI       35064089137 — SUCCESS
```

## Live task map

```text
5.1 — Persisted Dataset & Workbook Contract Foundation   COMPLETE
    5.1A — Source Inventory & Dataset Completeness        COMPLETE
    5.1B — Workbook Schema / Sheet / Column Contracts     COMPLETE
    5.1C — Dataset Validation & Reference Integrity       COMPLETE

5.2 — XLSX Workbook Codec                                 COMPLETE
    5.2A — XLSX Library Evaluation & Codec Boundary       COMPLETE
    5.2B — Deterministic Dataset-to-XLSX Export           COMPLETE
    5.2C — Strict XLSX-to-Dataset Import & Diagnostics    COMPLETE

5.3 — Snapshot, Hydration & Persistence Coordination      COMPLETE
    5.3A — Complete Source Snapshot Service               COMPLETE
    5.3B — Validated Atomic Dataset Hydration             COMPLETE
    5.3C — Persistence Coordinator / Load-Save Lifecycle  COMPLETE

5.4 — Version Compatibility, Backup & Recovery Safety     COMPLETE
    5.4A — Schema Migration & Compatibility Framework     COMPLETE
    5.4B — Backup & Atomic-Write Transport Contract       COMPLETE
    5.4C — Corruption, Limits & Recovery Diagnostics      COMPLETE

5.5 — Excel Persistence UI                                IN PROGRESS
    5.5A — Import / Open Workbook Workflow                COMPLETE
        5.5A1 — Browser File Selection & Import Command Boundary  COMPLETE
        5.5A2 — React Open/Replace Workflow & Workspace Refresh   COMPLETE
        5.5A3 — Browser Import Regression & 5.5A Completion Gate  COMPLETE
    5.5B — Export / Save & Backup Workflow                NEXT / NOT STARTED
    5.5C — Persistence Status / Validation / Recovery UX  NOT STARTED

5.6 — Integration & Completion Gate                       NOT STARTED
    5.6A — Integrated Excel Round-Trip Workflow           NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Locked Phase 5 decisions

### Persisted source and workbook

- `.xlsx` is the authoritative Phase 5 workbook format.
- Persist authoritative source evidence only; derived costing/yield/capacity/pricing outputs are recalculated after restore.
- `BusinessDataset` covers all nine authoritative source repositories.
- Dataset schema version and workbook format version remain separate.
- Workbook v1 has 13 normalized canonical sheets.
- Missing evidence remains distinct from explicit zero/null/false.
- Formula cells are not authoritative source values; formula-looking text remains literal.
- SheetJS remains hidden behind the library-neutral `WorkbookCodec`.

### Snapshot, hydration and coordinator

- 5.3A owns complete deterministic source snapshots.
- 5.3B owns validation-before-write, whole-dataset replacement, rollback, and stable repository/service identity.
- 5.3C owns the single application-level persistence lifecycle over workbook bytes.
- Expected import rejection never reaches hydration.
- React and workbook adapters do not enumerate repositories directly.

### Compatibility, safe save and recovery

- Workbook-format and dataset-schema versions remain separate exact axes.
- Public versions remain v1/v1; production migration registry stays empty until a real predecessor exists.
- Future versions fail closed.
- `WorkbookTransport` remains byte-only and reports backup/replacement capabilities truthfully.
- Required backup cannot proceed when unsupported or when creation fails.
- Pre-commit save failures preserve the previous primary workbook.
- Native filesystem durability, locking, rename atomicity and `fsync` remain Phase 6.
- Import is resource-bounded before decode, during SheetJS expansion, and after neutral-document reconstruction.
- Raw importer issues remain authoritative; recovery summaries are derived/advisory.
- Expected import rejection leaves the prior authoritative source state unchanged.

### Browser import / open workflow — 5.5A — COMPLETE

Plan:

`docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW_PLAN.md`

Parent completion record:

`docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW.md`

Child completion records:

- `docs/PHASE_5_5A1_BROWSER_FILE_SELECTION_IMPORT_COMMAND.md`
- `docs/PHASE_5_5A2_REACT_OPEN_REPLACE_WORKSPACE_REFRESH.md`

Final decomposition:

```text
5.5A1 — Browser File Selection & Import Command Boundary  COMPLETE
5.5A2 — React Open/Replace Workflow & Workspace Refresh   COMPLETE
5.5A3 — Browser Import Regression & 5.5A Completion Gate  COMPLETE
```

A1 established:

- selecting a file is non-destructive;
- browser file bytes are defensively owned before apply;
- `.xlsx` filename filtering is UX guidance only and never replaces content validation;
- chooser cancellation is a non-error/no-op;
- unsupported-extension and file-read failures are controlled workflow errors;
- explicit apply delegates to `PersistenceCoordinator.importAndApplyWorkbook(...)`;
- coordinator rejection/results and operational errors retain their existing meaning.

A2 established:

- the React shell exposes **Open / Import workbook** through the A1 command;
- selected filename and byte size are visible before apply;
- successful replacement requires explicit user confirmation;
- cancel/change-file and reading/importing states are controlled;
- duplicate apply is prevented while an import is active;
- successful hydrate, expected rejection and operational failure remain distinct;
- `workspaceRevision` advances only after `{ status: 'hydrated' }`;
- the visible repository-backed workspace remounts/refetches after successful hydration;
- the existing singleton repository/service graph remains intact;
- active navigation remains stable across the successful remount;
- rejected/failed import does not manufacture a successful workspace refresh.

A3 proved the complete browser workflow through the real import stack:

- real current v1/v1 XLSX selection remains non-destructive until explicit apply;
- valid real XLSX import hydrates the authoritative dataset and refreshes the visible workspace;
- corrupt workbook, future-version, invalid canonical structure, invalid business references, and the real default 20 MiB resource-limit rejection preserve the previous live dataset;
- rejected imports do not advance the successful workspace revision;
- changing the pending file before apply uses only the newest selection;
- a valid second import succeeds after a prior rejected attempt;
- full Phase 1–5 regression, typecheck, and production build remain green.

Rich recovery presentation remains 5.5C, browser export/save belongs to 5.5B, and native dialogs/filesystem remain Phase 6.

## Completion evidence index

### Phase 5.3 — COMPLETE

```text
Parent closeout PR #164 — MERGED
Final develop  0624863f59929d645acd5f6539ab311afdfcb5bd
Final CI       35039111549 — SUCCESS
```

### Phase 5.4 — COMPLETE

```text
5.4A final implementation gate  CI 35047100605
5.4B parent closeout            PR #178 — MERGED / CI 35051330092
5.4C C3 implementation gate     CI 35055416159
Parent 5.4 closeout             PR #185 — MERGED
Final Phase 5.4 develop         b8584d8681e95676c209c2e5a9dde0ee6278b71a
Final Phase 5.4 CI              35055715946 — SUCCESS
```

### Phase 5.5A planning

```text
Planning PR #188 — MERGED
Planning merge     95d63ccb3f20e0412376ae35ea0f5c13652fa753
Post-merge CI      35059276175 — SUCCESS
```

### Phase 5.5A1 — COMPLETE

```text
Corrected feature head     54f7d3af36984d9bd2fcd5aae041ae0012ce195a
Corrected branch CI        35061273728 — SUCCESS
Implementation PR #189     MERGED
PR CI                      35061356082 — SUCCESS
Implementation merge       13e51998a55789a1fafe3da233344928c889b4a0
Post-merge CI              35061438644 — SUCCESS
Final A1 closeout develop  15fbdf5ae44b08a8bd2070dfd85a55c98eeda185
Final A1 CI                35061767967 — SUCCESS
```

### Phase 5.5A2 — COMPLETE

```text
Baseline develop           15fbdf5ae44b08a8bd2070dfd85a55c98eeda185
Baseline CI                35061767967 — SUCCESS
Initial feature CI         35062380717 — FAILURE (test callback typing only)
Corrected feature head     a154942b1945c44bd7ae4057d25eadc5dc7aff76
Corrected branch CI        35062474596 — SUCCESS
Implementation PR #191     MERGED
PR CI                      35062595529 — SUCCESS
Implementation merge       e4be2a7b3f9f4289b00177a5f96bd61da113420d
Post-merge CI              35062713682 — SUCCESS
Final A2 closeout develop  8a9978c23dea7b807abfbf779c9fb51daf1409fe
Final A2 CI                35063049816 — SUCCESS
116 test files / 1351 tests
8 focused import-panel tests
4 app-shell workspace-refresh tests
138 modules transformed
```

### Phase 5.5A3 — COMPLETE

```text
Baseline develop           8a9978c23dea7b807abfbf779c9fb51daf1409fe
Baseline CI                35063049816 — SUCCESS
Initial feature CI         35063726548 — FAILURE (test union narrowing only)
Corrected feature head     7c0afea45432afdd21e4074b9e1a19c7a8906ec1
Corrected branch CI        35063842407 — SUCCESS
Implementation PR #193     MERGED
PR CI                      35063981728 — SUCCESS
Implementation merge       6ca74db286beb02ff1672511ddcecc1773ddee73
Post-merge CI              35064089137 — SUCCESS
117 test files / 1359 tests
8 new real browser-import regression tests
138 modules transformed
```

A3 changed tests only. The initial A3 branch failure was isolated to TypeScript narrowing in the regression harness; production behavior was unchanged.

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / codec                   COMPLETE
Dataset <-> XLSX round-trip            COMPLETE
Snapshot / hydration                   COMPLETE — 5.3
Persistence coordinator lifecycle     COMPLETE — 5.3C
Schema compatibility / migration      COMPLETE — 5.4A
Backup / atomic-write safety          COMPLETE — 5.4B
Corruption / resource / recovery      COMPLETE — 5.4C
Browser import/open workflow          COMPLETE — 5.5A
Browser export/save                   NEXT — 5.5B
Recovery/status UX                    NOT STARTED — 5.5C
Native filesystem                     Phase 6
```

## Current active task

**5.5B — Export / Save & Backup Workflow — NEXT / NOT STARTED**

Do not begin 5.5B until the Phase 5.5A parent docs-only closeout is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
