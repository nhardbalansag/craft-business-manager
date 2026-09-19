# Craft Business Manager — Development Plan

## Objective

Build a desktop-first business tool for material costing, real-production yield learning, inventory-based production estimates, multi-vessel / multi-component craft products, selling-price and profit planning, and safe local persistence.

The domain and application layers remain storage-agnostic so Excel persistence can later move to SQLite or another durable store without rewriting business rules.

## Documentation Authority

This file is the high-level roadmap.

For detailed historical implementation evidence, use the dedicated phase plans/completion records and Git history.

Key persistence / desktop-boundary records:

- `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`
- `docs/PHASE_5_PROGRESS.md`
- `docs/PHASE_5_5_EXCEL_PERSISTENCE_UI.md`
- `docs/PHASE_5_6A_INTEGRATED_EXCEL_ROUND_TRIP_WORKFLOW_PLAN.md`
- `docs/PHASE_5_6A_INTEGRATED_EXCEL_ROUND_TRIP_WORKFLOW.md`
- `docs/PHASE_5_6B_REGRESSION_BUILD_PHASE_5_COMPLETION.md`
- `docs/PHYSICAL_IDENTIFICATION_STORAGE_FOUNDATION_PLAN.md`
- `docs/PHASE_6_TAURI_DESKTOP_INTEGRATION_PLAN.md`

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

Current verified integration baseline before the Tiered Pricing enhancement:

```text
develop  e2057a063544f56088177e8211e03b96c21ef7e1
CI       35432387049 — SUCCESS
Preferred Yield enhancement — COMPLETE
Legacy physical workbook Preferred Yield compatibility fix — COMPLETE
Tiered Pricing TP0 audit — ACTIVE
```

The completed physical-identification and Preferred Yield work extends persisted source truth while preserving Phase 5 persistence boundaries. Tiered Pricing is an intervening business-domain enhancement requested before Phase 6 implementation. Phase 6 remains scoped but must not be started automatically while the Tiered Pricing task chain is active.

---

## Overall Phase Status

```text
Phase 0 — Repository & Architecture Foundation                  COMPLETE
Phase 1 — Materials, Units & Calibration                        COMPLETE
Phase 2 — Product Recipes & Mold Yield                          COMPLETE
Phase 3 — Product Components, Vessels & Nested Molded Products COMPLETE
Phase 4 — Pricing & Production Planning                         COMPLETE
Phase 5 — Excel Persistence                                     COMPLETE
Phase 6 — Tauri Desktop Integration                             SCOPED / IMPLEMENTATION NOT STARTED
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

- versioned `BusinessDataset` covering authoritative source repositories;
- Material calibration evidence included as source truth;
- normalized workbook contract with deterministic sheet/column/row semantics;
- complete cross-reference/graph validation;
- missing-vs-zero/null/false preservation.

The later Physical Identification & Storage Foundation extends that source contract with Mold and Storage Location records and workbook v2 compatibility while preserving the same persistence architecture.

### XLSX codec

- SheetJS behind a library-neutral `WorkbookCodec`;
- in-memory `Uint8Array` encode/decode;
- deterministic source-to-XLSX export;
- strict XLSX-to-source import;
- formula rejection for authoritative values;
- normalized child-sheet reconstruction;
- structured workbook diagnostics and resource limits.

### Snapshot, hydration and coordinator

- complete source snapshot services;
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

Phase 5.6B verified:

- all Phase 1–5 tests green;
- Phase 1–4 integration workflows green;
- dedicated Phase 5.6 integration suites green;
- browser persistence smoke/regression coverage green;
- TypeScript typecheck green;
- production build green;
- documentation reconciled;
- exact post-merge `develop` CI green.

---

# Tiered Pricing Enhancement — ACTIVE

Status: **TP2 COMPLETE / TP3A NEXT**

Master audit and compatibility plan:

`docs/TIERED_PRICING_TP0_DOMAIN_COMPATIBILITY_AUDIT.md`

Purpose:

- preserve the existing Product financial profile and Default / Single selling-price behavior;
- add one-to-many Package / Bulk / Custom pricing as a separate authoritative source collection;
- calculate independent tier profit, markup, margin, discount, and below-cost diagnostics;
- preserve existing XLSX / Google Sheets / physical workbook records through explicit migration;
- avoid silently changing Production revenue calculations until quantity-aware tier selection is implemented explicitly.

Task map:

```text
TP0 — Tiered Pricing Domain & Compatibility Audit                 COMPLETE
TP1 — Product Price Tier Domain Foundation                       COMPLETE
    TP1A — Product Price Tier Domain Contract & Validation        COMPLETE
    TP1B — Stable Tier ID Foundation                              COMPLETE
TP2 — Repository & Application Services                           COMPLETE
    TP2A — Repository Contract + In-Memory Implementation         COMPLETE
    TP2B — ProductPriceTierService CRUD / Archive / Reference     COMPLETE
    TP2C — Session Wiring + Service Regressions                    COMPLETE
TP3 — Tier Economics Engine                                       NEXT / NOT STARTED
    TP3A — Pure Tier Economics Formulas                           NEXT / NOT STARTED
    TP3B — ProductPriceTierQuoteService                           NOT STARTED
    TP3C — Default-Price Comparison + Below-Cost Diagnostics      NOT STARTED
TP4 — Default Pricing Compatibility Layer                         NOT STARTED
TP5 — Workbook / Dataset Persistence & Migration                  NOT STARTED
TP6 — Pricing UI                                                  NOT STARTED
TP7 — Pricing Quote Integration                                   NOT STARTED
TP8 — Quantity-Aware Tier Resolution                              NOT STARTED
TP9 — Integrated Validation & Completion Gate                     NOT STARTED
```

TP2 is complete. Do not start TP3 automatically from the TP2 completion gate.

---

# Phase 6 — Tauri Desktop Integration

Status: **SCOPED / IMPLEMENTATION NOT STARTED**

Master plan:

`docs/PHASE_6_TAURI_DESKTOP_INTEGRATION_PLAN.md`

Phase 6 introduces the native shell/filesystem boundary while reusing the completed persistence architecture.

## Phase 6 architecture contract

- React/Vite remains the application frontend.
- `PersistenceCoordinator` remains authoritative for source snapshot, workbook export/import, validation, and hydration.
- `WorkbookTransport` remains the native byte-persistence seam.
- browser import/download workflows remain separate from native Open / Save / Save As.
- the real safe-save filesystem transaction is Rust-backed through narrow Tauri commands so platform durability, replacement, locking, and crash-consistency semantics are explicit.
- Tauri v2 capabilities follow least privilege; Phase 6 does not grant broad filesystem or shell access for convenience.
- no business calculation or XLSX parsing moves into Rust.

## Phase 6 task map

```text
6.0 — Scope, Readiness & Architecture Contract                 COMPLETE (planning only)
6.1 — Tauri Shell, Build & Security Foundation                 NEXT / NOT STARTED
    6.1A — Tauri v2 Project Scaffold & Dev/Build Scripts       NEXT
    6.1B — Minimal Capability / Permission Baseline
    6.1C — Native Build & CI Smoke Gate

6.2 — Native Workbook Transport                                NOT STARTED
    6.2A — Native Command / TypeScript Transport Contract
    6.2B — Native Workbook Load Path
    6.2C — Staged Save, Backup & Replacement Transaction
    6.2D — Durability, Cleanup & Error Mapping

6.3 — Desktop Workbook Open / Save / Save As Workflow          NOT STARTED
    6.3A — Native Open Workflow
    6.3B — Native Save As Workflow
    6.3C — Save to Active Workbook Path
    6.3D — Desktop Workbook Session Identity & UI State

6.4 — Recovery, Concurrency & Filesystem Safety                NOT STARTED
    6.4A — Backup Location / Naming / Retention Policy
    6.4B — External Change & Concurrent Access Policy
    6.4C — Crash / Interrupted-Save Recovery Policy
    6.4D — Recovery UX & Failure-State Regression

6.5 — Desktop Integration & Operational UX                     NOT STARTED
    6.5A — Browser-vs-Desktop Runtime Composition
    6.5B — Unsaved/Dirty-State & Close/Open Guard Policy
    6.5C — Native Path / Recent-Workbook UX Boundary
    6.5D — Desktop Security / Permission Review

6.6 — Packaging, Platform Validation & Completion Gate         NOT STARTED
    6.6A — Desktop Bundle Configuration
    6.6B — Native CI / Platform Test Matrix
    6.6C — Installer / Distribution Smoke Validation
    6.6D — Phase 6 Regression & Completion Gate
```

Do not begin 6.2 native filesystem behavior until the 6.1 shell/build/security foundation is merged and green.

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
TP3A — Pure Tier Economics Formulas
NEXT / NOT STARTED
```

Tiered Pricing is the active intervening enhancement. Phase 6.1A remains scoped and pending, but must not begin automatically until the Tiered Pricing chain is completed or explicitly reprioritized.