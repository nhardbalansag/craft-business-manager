# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

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

5.3 — Snapshot, Hydration & Persistence Coordination      IN PROGRESS
    5.3A — Complete Source Snapshot Service               COMPLETE
    5.3B — Validated Atomic Dataset Hydration             IN PROGRESS
        5.3B1 — Hydration Replacement Port & Bulk Replace COMPLETE
        5.3B2 — Validated Atomic Hydration + Rollback     NEXT / NOT STARTED
        5.3B3 — Session/Fault Injection/Completion Gate   NOT STARTED
    5.3C — Persistence Coordinator / Load-Save Lifecycle  NOT STARTED

5.4 — Version Compatibility, Backup & Recovery Safety     NOT STARTED
    5.4A — Schema Migration & Compatibility Framework     NOT STARTED
    5.4B — Backup & Atomic-Write Transport Contract       NOT STARTED
    5.4C — Corruption, Limits & Recovery Diagnostics      NOT STARTED

5.5 — Excel Persistence UI                                NOT STARTED
    5.5A — Import / Open Workbook Workflow                NOT STARTED
    5.5B — Export / Save & Backup Workflow                NOT STARTED
    5.5C — Persistence Status / Validation / Recovery UX  NOT STARTED

5.6 — Integration & Completion Gate                       NOT STARTED
    5.6A — Integrated Excel Round-Trip Workflow           NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Locked Phase 5 decisions

- `.xlsx` is the authoritative Phase 5 workbook format.
- Persist authoritative source evidence only; derived outputs are recalculated after restore.
- `BusinessDataset` covers all nine authoritative source repositories.
- Dataset schema version and workbook format version remain separate.
- Workbook v1 has 13 normalized canonical sheets.
- Missing evidence stays distinct from explicit zero/null/false.
- Formula cells are not authoritative source values; formula-looking text stays literal.
- SheetJS CE 0.20.3 is hidden behind the library-neutral `WorkbookCodec`.
- Import/export mapping is bidirectional, current-version-only, and fail-closed.
- Complete reconstructed candidates validate before any live repository mutation.
- 5.3A snapshots all nine source repositories through one application-level read boundary.
- 5.3B treats a candidate `BusinessDataset` as complete replacement state, never a patch/merge.
- 5.3B validates with `validateBusinessDatasetIntegrity(...)` before writes and uses the 5.3A snapshot as rollback evidence.
- 5.3B uses persistence-only whole-collection replacement instead of replaying ordinary business CRUD workflows.
- 5.3B1 established `CollectionReplacementPort<T>` across all nine in-memory repositories with staged cloned `Map` replacement, stale-row removal, empty clearing, preserved repository identity, and pre-swap failure safety.
- 5.3B2 must coordinate all nine replacements atomically at the application level and automatically restore the pre-hydration snapshot when apply fails.
- Rollback failure must remain a distinct severe diagnostic and may never be reported as successful hydration.
- 5.3C owns load/save lifecycle orchestration; 5.4B owns backup/atomic filesystem transport; Phase 6 owns native Tauri filesystem behavior.

## Completed persistence foundation

### Phase 5.1 — COMPLETE

```text
5.1A final develop  8a1fdc2bbc5a24c20689c933b9964903d380e37c
5.1A CI             34986791114 — SUCCESS
5.1B final develop  656add851d6eeb6841f2f6e11816bbd52f5028c1
5.1B CI             34994087842 — SUCCESS
5.1C final develop  7efef34fac309f9d9745631a54bc8a8ba404415f
5.1C CI             34998382050 — SUCCESS
```

### Phase 5.2 — COMPLETE

```text
5.2A implementation PR #140   MERGED
5.2A final CI                 35003583148 — SUCCESS
5.2B implementation PR #143   MERGED
5.2B final CI                 35008520820 — SUCCESS
5.2C implementation PR #146   MERGED
5.2C implementation merge     3cd2bb280ef463b2267cafbbd28b9b9aba1fb656
5.2C post-merge CI            35012385953 — SUCCESS
87 test files / 1091 tests after 5.2C
```

5.2 provides complete fail-closed bidirectional mapping:

```text
BusinessDataset -> canonical workbook -> XLSX bytes   COMPLETE
XLSX bytes -> canonical workbook -> BusinessDataset   COMPLETE
```

### Phase 5.3A — COMPLETE

Plan: `docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE_PLAN.md`  
Completion: `docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE.md`

```text
Planning PR #148             MERGED
Planning CI                  35018499386 — SUCCESS
Implementation PR #149       MERGED
Implementation merge         2d475f0eded6acafeb03830cba768b3d84cb078d
Post-merge CI                35019082343 — SUCCESS
5 focused snapshot tests
```

Delivered complete deterministic deep-cloned snapshots over all nine repositories with current dataset schema version and all-or-nothing read behavior.

## Phase 5.3B — Validated Atomic Dataset Hydration

Parent plan:

`docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION_PLAN.md`

Planning closeout baseline before B1:

```text
develop  3552385ed84deab2500b69cf9e8fbd1538bde1a0
CI       35020396594 — SUCCESS
```

### 5.3B1 — Hydration Replacement Port & Repository Bulk Replace

Status: **COMPLETE**

Completion record:

`docs/PHASE_5_3B1_HYDRATION_REPLACEMENT_PORT_BULK_REPLACE.md`

```text
Feature head               74e70a22b2a8b24cd1cb49f44f37502a1555b53b
Feature CI                 35021376680 — SUCCESS
Implementation PR #152     MERGED
PR CI                      35021553326 — SUCCESS
Implementation merge       6abd24123c3593582fdc4767bd486b319fc2ce2c
Post-merge develop CI      35021692593 — SUCCESS
89 test files / 1105 tests
9 focused 5.3B1 replacement tests
TypeScript typecheck passed
Production Vite build passed
119 modules transformed
```

Delivered:

- generic persistence-only `CollectionReplacementPort<T>`;
- whole-collection `replaceAll(...)` in all nine source repositories;
- fully staged cloned next-state Maps before live swap;
- stale-record removal and empty-collection clearing;
- defensive ownership of nested source evidence;
- repository object identity preservation;
- pre-swap preparation failure safety;
- no business CRUD replay or derived output calculation.

### 5.3B2 — Validated Atomic Hydration + Rollback

Status: **NEXT / NOT STARTED**

B2 must implement the application-level hydration transaction:

```text
candidate BusinessDataset
  -> validate complete candidate
  -> clone hydration-owned candidate
  -> snapshot current live source state
  -> apply all nine collection replacements
  -> success

apply failure
  -> restore all nine collections from pre-hydration snapshot
  -> return controlled restored-failure result

rollback failure
  -> return distinct severe rollback-failure diagnostic
```

No 5.3B2 implementation has started as part of the 5.3B1 closeout.

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE
Dataset -> XLSX export                COMPLETE
XLSX -> dataset reconstruction        COMPLETE
Repository snapshot service           COMPLETE — 5.3A
Repository bulk replacement primitive COMPLETE — 5.3B1
Validated atomic hydration/rollback   NEXT / NOT STARTED — 5.3B2
Hydration session completion gate     NOT STARTED — 5.3B3
Persistence coordinator/load-save     NOT STARTED — 5.3C
ExcelStorage.load/save                placeholder
Native filesystem                     Phase 6
```

## Current active task

**5.3B2 — Validated Atomic Hydration + Rollback — NEXT / NOT STARTED**

Do not begin B2 implementation until the B1 closeout PR is merged, exact final `develop` CI is green, and the user separately says to proceed.
