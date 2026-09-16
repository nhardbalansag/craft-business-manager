# Craft Business Manager — Development Plan

## Objective

Build a desktop-first business tool for material costing, real-production yield learning, inventory-based production estimates, multi-vessel / multi-component craft products, selling-price and profit planning, and safe local persistence.

The domain and application layers remain storage-agnostic so Excel persistence can later move to SQLite or another durable store without rewriting business rules.

## Documentation Authority

This document is the high-level roadmap.

For the exact live Phase 5 task and completion evidence, use:

`docs/PHASE_5_PROGRESS.md`

For the detailed Excel persistence architecture, use:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

For the completed import/open workflow, use:

- `docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW_PLAN.md`
- `docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW.md`

For the completed export/save-copy workflow, use:

- `docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW_PLAN.md`
- `docs/PHASE_5_5B1_BROWSER_WORKBOOK_EXPORT_DOWNLOAD_COMMAND.md`
- `docs/PHASE_5_5B2_REACT_EXPORT_SAVE_COPY_WORKFLOW.md`
- `docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW.md`

Historical phase completion records remain authoritative for their individual contracts and CI evidence.

## Delivery Principles

- preserve user-entered/source evidence and derive normalized values;
- use canonical internal units (`g`, `mL`, `pc`);
- keep React behind application services rather than duplicating business rules in UI code;
- keep derived costing/yield/capacity/pricing outputs out of authoritative persistence;
- keep workbook codec, dataset validation, repository hydration, and filesystem transport separate;
- keep browser persistence workflows separate from Phase 6 native filesystem behavior;
- advance tasks only after feature CI, PR CI, guarded merge, and exact post-merge `develop` CI succeed.

## Current Repository Baseline

Current green implementation baseline after Phase 5.5B3:

```text
develop  68a34802d4768438cd67fe0cdab42b95145ecbe1
CI       35129363820 — SUCCESS
```

## Overall Phase Status

```text
Phase 0 — Repository & Architecture Foundation                  COMPLETE
Phase 1 — Materials, Units & Calibration                        COMPLETE
Phase 2 — Product Recipes & Mold Yield                          COMPLETE
Phase 3 — Product Components, Vessels & Nested Molded Products COMPLETE
Phase 4 — Pricing & Production Planning                         COMPLETE
Phase 5 — Excel Persistence                                     IN PROGRESS
Phase 6 — Tauri Desktop Integration                             PLANNED
Phase 7 — Reporting & Operational Polish                        PLANNED
```

---

# Completed Business Foundation — Phases 0–4

The completed business foundation includes:

## Materials / measurement

- canonical unit conversion;
- material-specific calibration;
- package/purchase costing;
- inventory quantity and valuation semantics;
- supplier/source metadata;
- missing-vs-zero evidence rules.

## Products / recipes / yield

- product categories;
- mix presets and ratio lines;
- fixed recipes;
- real-production immutable yield samples;
- learned per-piece material requirements;
- safety waste;
- material-cost preview;
- inventory-based production capacity.

## Components / vessels / nested products

- Material-backed components;
- Product-backed components;
- vessel/component composition;
- ProductStock;
- cycle-safe nested Product graphs;
- recursive component cost;
- component-aware capacity and limiter tracing.

## Costing / pricing / production planning

- waste-adjusted direct material cost;
- fully loaded product cost;
- labor and overhead profiles;
- selling-price policies;
- profit, markup, and margin metrics;
- physical planned-batch cost;
- expected revenue/profit;
- capacity feasibility and bottleneck warnings.

## React business workspaces

- Materials;
- Calibration;
- Products / Mix Presets / Components / Finished Stock;
- Yield;
- Production;
- Pricing.

---

# Phase 5 — Excel Persistence

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Live tracker:

`docs/PHASE_5_PROGRESS.md`

## Phase 5 task map

```text
5.1 — Persisted Dataset & Workbook Contract Foundation   COMPLETE
5.2 — XLSX Workbook Codec                                 COMPLETE
5.3 — Snapshot, Hydration & Persistence Coordination      COMPLETE
5.4 — Version Compatibility, Backup & Recovery Safety     COMPLETE

5.5 — Excel Persistence UI                                IN PROGRESS
    5.5A — Import / Open Workbook Workflow                COMPLETE
        5.5A1 — Browser File Selection & Import Command Boundary  COMPLETE
        5.5A2 — React Open/Replace Workflow & Workspace Refresh   COMPLETE
        5.5A3 — Browser Import Regression & 5.5A Completion Gate  COMPLETE
    5.5B — Export / Save & Backup Workflow                COMPLETE
        5.5B1 — Browser Workbook Export & Download Command Boundary      COMPLETE
        5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness COMPLETE
        5.5B3 — Browser Export Regression & 5.5B Completion Gate        COMPLETE
    5.5C — Persistence Status / Validation / Recovery UX  NEXT / NOT STARTED

5.6 — Integration & Completion Gate                       NOT STARTED
    5.6A — Integrated Excel Round-Trip Workflow           NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Phase 5.1 — Persisted contract foundation — COMPLETE

Established:

- versioned `BusinessDataset` covering all nine authoritative source repositories;
- Material calibration evidence included as authoritative persistence data;
- 13-sheet normalized workbook v1 contract;
- exact source representation and deterministic ordering rules;
- formula-cell rejection and literal-text semantics;
- complete pre-hydration duplicate/reference/graph validation;
- missing-vs-zero/null semantics and no silent repair.

## Phase 5.2 — Bidirectional XLSX codec — COMPLETE

Established:

- SheetJS behind a library-neutral `WorkbookCodec`;
- in-memory `Uint8Array` XLSX encode/decode;
- deterministic `BusinessDataset -> workbook -> XLSX` export;
- strict `XLSX -> workbook -> BusinessDataset` import;
- normalized child-sheet reconstruction;
- structured diagnostics;
- real XLSX source-semantic round trip;
- no repository mutation in the codec/import layer.

## Phase 5.3 — Snapshot, hydration and persistence coordination — COMPLETE

Established:

- complete snapshot of all nine authoritative repositories;
- persistence-only whole-collection replacement;
- validate-before-write hydration;
- complete previous-state snapshot before apply;
- rollback after apply failure;
- distinct rollback-failure outcome;
- stable repository/service object identity;
- one `PersistenceCoordinator` for export/save and import/load/hydrate workflows.

## Phase 5.4 — Version, backup and recovery safety — COMPLETE

Established:

- workbook/dataset version preflight;
- explicit migration registry and migration execution boundary;
- future-version fail-closed behavior;
- byte-level backup/safe-save transport capability contract;
- logical in-memory staged/atomic replacement reference transport;
- resource limits before/during/after workbook decode;
- corruption and malformed workbook diagnostics;
- stable recovery categories/action codes;
- proof that expected import rejection leaves live source state unchanged.

Final Phase 5.4 closeout:

```text
develop  b8584d8681e95676c209c2e5a9dde0ee6278b71a
CI       35055715946 — SUCCESS
```

## Phase 5.5 — Excel Persistence UI — IN PROGRESS

Phase 5.5 turns the completed persistence backend into user-facing browser-compatible workflows while keeping native paths/dialogs/filesystem behavior in Phase 6.

### Phase 5.5A — Import / Open Workbook Workflow — COMPLETE

Parent completion record:

`docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW.md`

Delivered across A1–A3:

- browser-compatible `.xlsx` file selection and owned-byte acquisition;
- non-destructive pending selection;
- controlled cancellation, unsupported-extension, file-read and no-pending errors;
- explicit destructive replacement confirmation;
- delegation through `PersistenceCoordinator.importAndApplyWorkbook(...)` only;
- basic success/rejection/operational feedback;
- reading/importing and duplicate-submit protection;
- success-only workspace revision/remount;
- visible workspace refresh from the same singleton repositories/services;
- active-navigation preservation across successful refresh;
- real current v1/v1 XLSX end-to-end regression;
- representative corrupt, future-version, invalid-schema, invalid-business-reference and actual 20 MiB resource-limit rejection regression;
- exact previous-state preservation on rejected imports;
- successful retry after a prior rejected import;
- full Phase 1–5 regression, typecheck and production build gate.

Final 5.5A evidence:

```text
Parent closeout PR #194       MERGED
Final 5.5A closeout develop   088d0b7d6d5bd6114e3887293dca757140e4eaa5
Final 5.5A CI                 35064547341 — SUCCESS
117 test files / 1359 tests at A3 implementation gate
138 modules transformed
```

### Phase 5.5B — Export / Save & Backup Workflow — COMPLETE

Dedicated plan:

`docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW_PLAN.md`

Parent completion record:

`docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW.md`

Completed decomposition:

```text
5.5B1 — Browser Workbook Export & Download Command Boundary      COMPLETE
5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness COMPLETE
5.5B3 — Browser Export Regression & 5.5B Completion Gate        COMPLETE
```

The split kept browser artifact ownership, React workflow state, and end-to-end completion proof separate.

#### Phase 5.5B1 — Browser Workbook Export & Download Command Boundary — COMPLETE

Completion record:

`docs/PHASE_5_5B1_BROWSER_WORKBOOK_EXPORT_DOWNLOAD_COMMAND.md`

Delivered:

- `BrowserWorkbookExportCommand` as the application-layer browser export boundary;
- canonical XLSX bytes obtained only through `PersistenceCoordinator.exportCurrentWorkbook()`;
- defensive byte ownership before browser artifact creation;
- deterministic UTC filename guidance: `craft-business-manager-YYYY-MM-DD-HHmmss.xlsx`;
- official XLSX MIME type;
- injected Blob/object-URL/download/revoke adapter outside React;
- one explicit command producing one fresh coordinator export and one download dispatch;
- object-URL cleanup after successful dispatch and after dispatch failure;
- explicit preparation, dispatch and cleanup workflow failures;
- coordinator snapshot/export failures preserving their existing meaning;
- no repository mutation or import-style workspace refresh;
- no `WorkbookTransport` receipt, managed native path, Phase 5.4B pre-save backup, atomic-replacement or filesystem-durability claim.

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
138 modules transformed
```

#### Phase 5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness — COMPLETE

Completion record:

`docs/PHASE_5_5B2_REACT_EXPORT_SAVE_COPY_WORKFLOW.md`

Delivered:

- `WorkbookExportPanel` in the application shell;
- default B1 export command wired to the shared `persistenceCoordinator`;
- explicit **Download workbook** action and no implicit export during render;
- pending/download state and duplicate-submit protection;
- copy-oriented success feedback and controlled failure feedback;
- retry after failure;
- no `workspaceRevision` advance or workspace remount on export;
- stable active navigation;
- existing import workflow remains functional beside export;
- truthful browser language: export creates a new `.xlsx` copy rather than overwriting an imported workbook;
- no Phase 5.4B pre-save backup, native path, atomic replacement, or filesystem-durability claim.

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
2 focused app-shell B2 tests
Typecheck PASS
Production build PASS
143 modules transformed
```

#### Phase 5.5B3 — Browser Export Regression & 5.5B Completion Gate — COMPLETE

B3 added a tests-only real-stack completion gate over the finished B1/B2 runtime behavior.

Proven end to end:

- representative authoritative data across all nine persisted source collections exports through the user-facing React workflow;
- actual XLSX bytes passed to the browser artifact boundary decode/import through the production `SheetJsWorkbookCodec` and import stack;
- the reconstructed source dataset is equivalent to the authoritative source snapshot;
- export does not mutate live repositories;
- deterministic filename guidance and the official XLSX MIME type reach the browser boundary;
- one successful explicit export produces one download dispatch and temporary object-URL cleanup;
- sequential exports after source changes contain fresh data rather than stale bytes;
- source snapshot failure produces no false success/download and retry succeeds;
- injected workbook encoding failure produces no false success/download and retry succeeds;
- browser Blob preparation failure produces no false success/download and retry succeeds;
- browser dispatch failure cleans its temporary URL and retry succeeds;
- existing B1/B2 suites retain duplicate-submit protection and save/backup truthfulness proof;
- Phase 5.4B safe-save suites and 5.5A browser import regression remain green.

Implementation evidence:

```text
Baseline develop          014f40e5d1e50752abb504d89f1c759df5a2d7c3
Baseline CI               35126766679 — SUCCESS
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

The B3 implementation added exactly one regression test file and made no runtime/domain/schema/native-filesystem changes.

#### Parent 5.5B completion result

The complete browser workflow satisfies all locked 5.5B completion gates:

- explicit current workbook download;
- coordinator-owned canonical export;
- real valid current XLSX bytes;
- deterministic filename and MIME;
- safe browser object-URL lifecycle;
- duplicate-submit protection;
- distinct success and operational-failure states;
- no source mutation or import-style workspace refresh;
- truthful downloaded-copy wording;
- no manufactured Phase 5.4B backup, atomic replacement, native path, overwrite, or durability guarantee;
- unchanged `WorkbookTransport` safe-save contract for later native use;
- full regression, typecheck, and production build green.

Therefore:

```text
5.5B — Export / Save & Backup Workflow — COMPLETE
```

Browser export means **download/save a new copy**. Native Save / Save As, managed paths, real pre-save filesystem backups, atomic filesystem replacement, locking, `fsync`, and crash consistency remain Phase 6.

### Phase 5.5C — Persistence Status / Validation / Recovery UX — NEXT / NOT STARTED

5.5C owns the richer browser persistence experience that was deliberately excluded from A/B:

- richer persistence status presentation;
- validation/rejection detail presentation;
- unsupported-version guidance;
- corruption/resource-limit recovery guidance;
- backup/restore guidance consistent with browser capability limits;
- active workbook/history concepts if adopted;
- dirty/unsaved-state experience if adopted and justified by the current architecture.

Do not begin 5.5C until the 5.5B parent closeout is merged, the exact resulting `develop` CI is green, and the user separately instructs to proceed.

## Phase 5.6 — Integration & Completion Gate — NOT STARTED

5.6 will prove full application-service equivalence across Excel export/import/hydration and close Phase 5 only after all Phase 1–5 tests, browser persistence smoke coverage, typecheck, build, documentation, and exact merged `develop` CI are green.

---

# Phase 6 — Tauri Desktop Integration

Status: **PLANNED**

Phase 6 will provide the native implementation around the Phase 5 contracts:

- Open/Save dialogs;
- native file paths;
- application-data directory;
- durable backup paths;
- safe native replacement;
- filesystem locking/durability decisions;
- desktop packaging.

The Phase 5 workbook, validation, migration, hydration, and business rules must not be rewritten for Tauri.

---

# Phase 7 — Reporting & Operational Polish

Status: **PLANNED**

Planned areas include dashboard/operational summaries, inventory valuation and low-stock indicators, profitability, material requirements, production history/reporting, report export, and final usability/accessibility/performance polish.

---

# Current Active Task

**5.5C — Persistence Status / Validation / Recovery UX — NEXT / NOT STARTED**

Do not begin 5.5C until the 5.5B parent closeout is merged into `develop`, the exact resulting `develop` CI is green, and the user separately says to proceed.
