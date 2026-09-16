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

For the current export/save-copy workflow plan, use:

`docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW_PLAN.md`

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

Current green baseline after the Phase 5.5A parent closeout:

```text
develop  088d0b7d6d5bd6114e3887293dca757140e4eaa5
CI       35064547341 — SUCCESS
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
    5.5B — Export / Save & Backup Workflow                IN PROGRESS
        5.5B1 — Browser Workbook Export & Download Command Boundary      NEXT / NOT STARTED
        5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness NOT STARTED
        5.5B3 — Browser Export Regression & 5.5B Completion Gate        NOT STARTED
    5.5C — Persistence Status / Validation / Recovery UX  NOT STARTED

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
Implementation PR #193        MERGED
Implementation merge          6ca74db286beb02ff1672511ddcecc1773ddee73
Post-merge CI                 35064089137 — SUCCESS
Parent closeout PR #194       MERGED
Final 5.5A closeout develop   088d0b7d6d5bd6114e3887293dca757140e4eaa5
Final 5.5A CI                 35064547341 — SUCCESS
117 test files / 1359 tests at A3 implementation gate
138 modules transformed
```

Phase 5.5A did not introduce browser export/save, rich recovery UX, or native filesystem behavior.

### Phase 5.5B — Export / Save & Backup Workflow — PLANNING ESTABLISHED

Dedicated plan:

`docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW_PLAN.md`

5.5B is split into:

```text
5.5B1 — Browser Workbook Export & Download Command Boundary
5.5B2 — React Export / Save-Copy Workflow & Backup Truthfulness
5.5B3 — Browser Export Regression & 5.5B Completion Gate
```

The split is required because browser artifact/download ownership, React workflow state, and end-to-end completion proof are materially separate concerns.

Locked architecture decisions:

- browser export uses `PersistenceCoordinator.exportCurrentWorkbook()` as the authoritative workbook-byte boundary;
- React does not construct sheets, encode XLSX, enumerate repositories, or simulate save transactions;
- default browser behavior is **Download workbook / Save a copy**, not in-place save;
- deterministic `.xlsx` naming belongs to the browser export command boundary;
- browser Blob/object-URL/download dispatch is isolated outside React components and must clean up temporary URLs;
- successful export does not mutate business state or advance the import workspace revision;
- Phase 5.4B backup means exact pre-save primary bytes created before destructive replacement by a transport that owns the prior primary workbook;
- a normal browser download does not satisfy that definition, so browser mode must not claim a Phase 5.4B backup, atomic replacement, native path, or filesystem durability;
- `PersistenceCoordinator.saveCurrentWorkbook(transport, options)` and the existing transport receipts remain intact for a real native transport later;
- native Save / Save As, managed paths, real pre-save backup, atomic filesystem replacement, locks, `fsync`, and crash consistency remain Phase 6;
- detailed persistence status, recovery history, and broader backup/restore guidance remain 5.5C.

Next exact task:

**5.5B1 — Browser Workbook Export & Download Command Boundary — NEXT / NOT STARTED**

Do not begin 5.5B1 until the 5.5B planning change is merged, the exact resulting `develop` CI is green, and the user separately instructs to proceed.

### Phase 5.5C — Persistence Status / Validation / Recovery UX — NOT STARTED

Planned richer persistence status, validation details, unsupported-version guidance, recovery/backup guidance, and any adopted dirty/unsaved-state experience.

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

**5.5B1 — Browser Workbook Export & Download Command Boundary — NEXT / NOT STARTED**

Do not begin 5.5B1 until the 5.5B planning change is merged into `develop`, the exact resulting `develop` CI is green, and the user separately says to proceed.