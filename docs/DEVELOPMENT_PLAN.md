# Craft Business Manager — Development Plan

## Objective

Build a desktop-first business tool for material costing, real-production yield learning, inventory-based production estimates, multi-vessel / multi-component craft products, selling-price and profit planning, and safe local persistence.

The domain and application layers remain storage-agnostic so Excel persistence can later move to SQLite or another durable store without rewriting business rules.

## Documentation Authority

This file is the high-level roadmap.

For detailed historical implementation evidence, use the dedicated phase plans/completion records and Git history.

Current Phase 5 records:

- `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`
- `docs/PHASE_5_PROGRESS.md`
- `docs/PHASE_5_5_EXCEL_PERSISTENCE_UI.md`
- `docs/PHASE_5_6A_INTEGRATED_EXCEL_ROUND_TRIP_WORKFLOW_PLAN.md`
- `docs/PHASE_5_6A_INTEGRATED_EXCEL_ROUND_TRIP_WORKFLOW.md`
- `docs/PHASE_5_6B_REGRESSION_BUILD_PHASE_5_COMPLETION.md`

Historical child completion records remain authoritative for their individual contracts and CI evidence.

## Delivery Principles

- preserve user-entered/source evidence and derive normalized values;
- use canonical internal units (`g`, `mL`, `pc`);
- keep React behind application services rather than duplicating business rules in UI code;
- keep derived costing/yield/capacity/pricing outputs out of authoritative persistence;
- keep workbook codec, dataset validation, repository hydration, and filesystem transport separate;
- keep browser persistence workflows separate from native filesystem behavior;
- advance tasks only after branch/PR CI, guarded merge, and exact post-merge `develop` CI succeed;
- plan/scope the next phase before beginning implementation when the phase introduces a new platform boundary.

---

## Current Repository Milestone

Phase 5 final pre-closeout green baseline:

```text
develop  42f612e147b6fefc39068c2f978ccd03c97df9b5
CI       35143413096 — SUCCESS
131 test files / 1,439 tests
TypeScript typecheck PASS
Production build PASS
149 modules transformed
```

The final Phase 5 documentation closeout is merged only after its own full pull-request CI succeeds; the exact resulting `develop` SHA and post-merge CI are the final Git-history evidence.

---

## Overall Phase Status

```text
Phase 0 — Repository & Architecture Foundation                  COMPLETE
Phase 1 — Materials, Units & Calibration                        COMPLETE
Phase 2 — Product Recipes & Mold Yield                          COMPLETE
Phase 3 — Product Components, Vessels & Nested Molded Products COMPLETE
Phase 4 — Pricing & Production Planning                         COMPLETE
Phase 5 — Excel Persistence                                     COMPLETE
Phase 6 — Tauri Desktop Integration                             NEXT FOR SCOPE REVIEW / NOT STARTED
Phase 7 — Reporting & Operational Polish                        PLANNED
```

---

# Completed Business Foundation — Phases 0–4

## Phase 0 — Repository & Architecture Foundation — COMPLETE

Established the React/TypeScript project structure, domain/application separation, testing/CI baseline, and repository workflow used by later phases.

## Phase 1 — Materials, Units & Calibration — COMPLETE

Established:

- canonical unit conversion;
- material-specific calibration;
- package/purchase costing;
- inventory quantity and valuation semantics;
- supplier/source metadata;
- missing-vs-zero evidence rules;
- Materials and Calibration application/UI workflows.

## Phase 2 — Product Recipes & Mold Yield — COMPLETE

Established:

- product categories;
- mix presets and ratio lines;
- fixed recipes;
- immutable real-production yield samples;
- learned per-piece material requirements;
- safety waste;
- material-cost preview;
- inventory-based production capacity;
- Products/Yield workflows.

## Phase 3 — Components, Vessels & Nested Products — COMPLETE

Established:

- Material-backed components;
- Product-backed components;
- vessel/component composition;
- ProductStock;
- cycle-safe nested Product graphs;
- recursive component costing;
- component-aware capacity and limiter tracing.

## Phase 4 — Pricing & Production Planning — COMPLETE

Established:

- waste-adjusted direct material cost;
- fully loaded product cost;
- labor and overhead financial profiles;
- selling-price policies;
- profit, markup, and margin metrics;
- physical planned-batch cost;
- expected revenue/profit;
- assembly-capacity trace;
- planned-batch capacity feasibility and bottleneck warnings;
- Production and Pricing workspaces.

---

# Phase 5 — Excel Persistence — COMPLETE

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Final status tracker:

`docs/PHASE_5_PROGRESS.md`

Final completion gate:

`docs/PHASE_5_6B_REGRESSION_BUILD_PHASE_5_COMPLETION.md`

## Final Phase 5 task map

```text
5.1 — Persisted Dataset & Workbook Contract Foundation   COMPLETE
5.2 — XLSX Workbook Codec                                 COMPLETE
5.3 — Snapshot, Hydration & Persistence Coordination      COMPLETE
5.4 — Version Compatibility, Backup & Recovery Safety     COMPLETE
5.5 — Excel Persistence UI                                COMPLETE
5.6 — Integration & Completion Gate                       COMPLETE
    5.6A — Integrated Excel Round-Trip Workflow           COMPLETE
    5.6B — Regression / Build / Phase 5 Completion        COMPLETE
```

## Phase 5 delivered

### Persisted source contract

- versioned `BusinessDataset` covering all nine authoritative source repositories;
- Material calibration evidence included as source truth;
- normalized 13-sheet workbook v1 contract;
- deterministic sheet/column/row semantics;
- complete cross-reference/graph validation;
- missing-vs-zero/null/false preservation.

### XLSX codec

- SheetJS behind a library-neutral `WorkbookCodec`;
- in-memory `Uint8Array` encode/decode;
- deterministic source-to-XLSX export;
- strict XLSX-to-source import;
- formula rejection for authoritative values;
- normalized child-sheet reconstruction;
- structured workbook diagnostics and resource limits.

### Snapshot, hydration and coordinator

- complete snapshot of all nine source repositories;
- validate-before-write atomic hydration;
- previous-state snapshot and rollback behavior;
- stable singleton repository/service identity;
- one `PersistenceCoordinator` for export/save/import/load/apply workflows.

### Compatibility, backup and recovery safety

- explicit workbook/dataset version handling;
- migration registry/boundary;
- fail-closed future-version behavior;
- transport-owned backup/staged-replacement/replacement guarantees;
- safe in-memory reference transport for transaction testing;
- corrupt/malformed/resource-limit diagnostics;
- deterministic recovery categories/actions;
- rejection without partial live-state mutation.

### Browser persistence UI

- `.xlsx` file selection/import;
- explicit destructive replacement confirmation;
- successful workspace refresh from hydrated source state;
- workbook export/download-copy;
- deterministic filename and XLSX MIME handling;
- persistence session identity/status;
- raw validation detail plus deterministic recovery guidance;
- retry/failure regression coverage;
- truthful browser language that does not claim native overwrite/durability.

### Integrated round-trip proof

Phase 5.6A verifies the complete A–J matrix:

```text
A — complete source round-trip                          GREEN
B — calibration-dependent material equivalence         GREEN
C — yield + recipe Product equivalence                 GREEN
D — nested components + ProductStock equivalence       GREEN
E — financial profile missing vs explicit zero         GREEN
F — Phase 4 pricing/production equivalence             GREEN
G — invalid workbook preserves state                   GREEN
H — unsupported future version                         GREEN
I — deterministic workbook schema/row semantics        GREEN
J — backup/replace failure integration                 GREEN
```

Source/service round-trip scenarios cross real XLSX bytes and reuse the stable application graph. Derived costing/yield/capacity/pricing/production results remain recalculated rather than persisted.

### Final Phase 5 gate

Phase 5.6B requires and verifies:

- all Phase 1–5 tests green;
- Phase 1–4 integration workflows green;
- dedicated Phase 5.6 A1/A2/A3 integration suites green;
- browser persistence smoke/regression coverage green;
- TypeScript typecheck green;
- production build green;
- documentation reconciled;
- exact post-merge `develop` CI green.

No runtime feature change is required by 5.6B unless this gate exposes a genuine defect.

---

# Phase 6 — Tauri Desktop Integration

Status: **NEXT FOR SCOPE REVIEW / NOT STARTED**

Phase 6 introduces a new platform/native-filesystem boundary and must be scoped before implementation.

Expected Phase 6 ownership includes:

- Tauri application shell/integration;
- native Open / Save / Save As dialogs;
- managed native workbook paths;
- native `WorkbookTransport` implementation using the Phase 5 coordinator contract;
- real filesystem backup location/rotation policy;
- OS-level staged write and replace behavior;
- explicit replacement/atomicity guarantees where the platform supports them;
- file locking/concurrent-access policy;
- `fsync` / durable flush decisions where applicable;
- crash-consistency/recovery behavior;
- desktop packaging/distribution;
- platform-specific tests without moving business rules out of the existing domain/application layers.

Phase 6 must reuse the completed Phase 5 persistence boundaries rather than duplicate workbook parsing, validation, source snapshot, hydration, or business calculations.

Before implementation, perform a dedicated Phase 6 scope/decomposition review.

---

# Phase 7 — Reporting & Operational Polish

Status: **PLANNED**

Expected later work may include:

- business/reporting dashboards;
- printable/exportable operational summaries;
- usability/accessibility polish;
- advanced filtering/search;
- workflow/productivity improvements;
- deployment/update/operational documentation.

Phase 7 scope should be revisited after the desktop/native persistence workflow is stable.

---

## Current Next Action

```text
Phase 6 — Tauri Desktop Integration
NEXT FOR SCOPE REVIEW / NOT STARTED
```

Do not begin Phase 6 implementation until its scope has been reviewed and, if needed, decomposed into smaller development phases.