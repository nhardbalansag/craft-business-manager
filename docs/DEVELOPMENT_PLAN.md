# Craft Business Manager — Development Plan

## Objective

Build a desktop-first tool for material costing, real-production yield learning, inventory-based production estimates, multi-vessel / multi-component craft products, selling-price / profit planning, and safe local persistence.

The domain and application layers remain storage-agnostic so Excel persistence can later move to SQLite without rewriting business rules.

## Delivery principles

- preserve user-entered/source evidence and derive normalized values;
- use canonical internal units (`g`, `mL`, `pc`);
- keep React behind application services rather than duplicating business rules in UI code;
- keep derived costing/yield/capacity/pricing outputs out of authoritative persistence;
- keep workbook codec, dataset validation, repository hydration, and filesystem transport separate;
- advance tasks only after feature CI, PR CI, guarded merge, and exact post-merge `develop` CI succeed.

## Phase status

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

## Phase 1–4 completion summary

The completed business foundation includes:

- canonical unit conversion and material-specific calibration;
- Material purchase costing, inventory and supplier/source metadata;
- Product categories, MixPresets, real-production YieldSamples and fixed recipes;
- safety waste, material-cost preview and inventory capacity;
- Material/Product-backed components, vessels and nested Product graphs;
- ProductStock, recursive component cost and component-aware capacity;
- Product financial profiles, fully loaded cost and pricing policies;
- planned-batch cost, revenue, profit, margin and capacity warnings;
- React Materials, Products, Yield, Production and Pricing workflows.

## Phase 5 — Excel Persistence

Status: **IN PROGRESS**

Master plan: `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`  
Live tracker: `docs/PHASE_5_PROGRESS.md`

```text
5.1 Persisted Dataset & Workbook Contract Foundation    COMPLETE
    5.1A Source Inventory & Dataset Completeness         COMPLETE
    5.1B Workbook Schema / Sheet / Column Contracts      COMPLETE
    5.1C Dataset Validation & Reference Integrity        COMPLETE

5.2 XLSX Workbook Codec                                  COMPLETE
    5.2A XLSX Library Evaluation & Codec Boundary        COMPLETE
    5.2B Deterministic Dataset-to-XLSX Export            COMPLETE
    5.2C Strict XLSX-to-Dataset Import & Diagnostics     COMPLETE

5.3 Snapshot, Hydration & Persistence Coordination       IN PROGRESS
    5.3A Complete Source Snapshot Service                COMPLETE
    5.3B Validated Atomic Dataset Hydration              IN PROGRESS
        5.3B1 Hydration Replacement Port & Bulk Replace  COMPLETE
        5.3B2 Validated Atomic Hydration + Rollback      NEXT / NOT STARTED
        5.3B3 Session/Fault Injection/Completion Gate    NOT STARTED
    5.3C Persistence Coordinator / Load-Save Lifecycle   NOT STARTED

5.4 Version Compatibility, Backup & Recovery Safety      NOT STARTED
5.5 Excel Persistence UI                                 NOT STARTED
5.6 Integration & Completion Gate                        NOT STARTED
```

### Phase 5.1 — Persisted contract foundation

**COMPLETE**

Established:

- versioned `BusinessDataset` covering all nine authoritative source collections;
- 13-sheet normalized workbook v1 contract;
- exact source representation and deterministic ordering rules;
- formula-cell rejection and literal-text semantics;
- complete pre-hydration duplicate/reference/graph validation;
- missing-vs-zero/null semantics and no silent repair.

Final closeout:

```text
develop  7efef34fac309f9d9745631a54bc8a8ba404415f
CI       34998382050 — SUCCESS
84 test files / 1048 tests
```

### Phase 5.2 — Bidirectional XLSX codec/mapping

**COMPLETE**

Established:

- SheetJS CE 0.20.3 behind library-neutral `WorkbookCodec`;
- in-memory `Uint8Array` XLSX encode/decode;
- deterministic `BusinessDataset -> workbook -> XLSX` export;
- strict `XLSX -> workbook -> BusinessDataset` import;
- all 13 canonical sheets and normalized child reconstruction;
- structured diagnostics and current-version fail-closed behavior;
- real-XLSX source-semantic round trip;
- no repository mutation in the import layer.

Latest Phase 5.2 implementation gate:

```text
5.2C PR #146             MERGED
5.2C merge               3cd2bb280ef463b2267cafbbd28b9b9aba1fb656
5.2C post-merge CI       35012385953 — SUCCESS
87 test files / 1091 tests
```

### Phase 5.3A — Complete Source Snapshot Service

**COMPLETE**

Provides one application-level, read-only snapshot of all nine authoritative repositories with centralized dataset schema version, deterministic top-level collection ordering, deep defensive ownership, missing/zero/null fidelity, and all-or-nothing failure behavior.

```text
Planning PR #148         MERGED
Implementation PR #149   MERGED
Implementation merge     2d475f0eded6acafeb03830cba768b3d84cb078d
Post-merge CI            35019082343 — SUCCESS
```

### Phase 5.3B — Validated Atomic Dataset Hydration

Parent plan:

`docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION_PLAN.md`

5.3B is formally split into:

```text
5.3B1 — Hydration Replacement Port & Repository Bulk Replace
5.3B2 — Validated Atomic Hydration + Rollback
5.3B3 — Session/Fault Injection/Completion Gate
```

Locked architecture:

- candidate dataset is complete replacement state, not a patch;
- validate the complete dataset before writes;
- snapshot current live source state before apply;
- replace all nine repositories through persistence-only bulk replacement;
- preserve repository object identity;
- do not replay normal business CRUD services during hydration;
- automatically rollback to the complete pre-hydration snapshot if apply fails;
- distinguish safe restored apply failure from rollback failure;
- never report rollback failure as successful hydration.

#### 5.3B1 — COMPLETE

Completion record:

`docs/PHASE_5_3B1_HYDRATION_REPLACEMENT_PORT_BULK_REPLACE.md`

Delivered `CollectionReplacementPort<T>` and staged whole-collection `replaceAll(...)` across all nine in-memory source repositories.

```text
Feature head               74e70a22b2a8b24cd1cb49f44f37502a1555b53b
Feature CI                 35021376680 — SUCCESS
Implementation PR #152     MERGED
PR CI                      35021553326 — SUCCESS
Implementation merge       6abd24123c3593582fdc4767bd486b319fc2ce2c
Post-merge CI              35021692593 — SUCCESS
89 test files / 1105 tests
9 focused B1 tests
```

B1 guarantees staged cloned next-state Maps, stale-row removal, empty clearing, nested source isolation, repository identity preservation, and pre-swap failure safety.

#### 5.3B2 — NEXT / NOT STARTED

B2 must implement the application-level atomic hydration transaction:

```text
candidate
  -> validateBusinessDatasetIntegrity(...)
  -> clone hydration-owned candidate
  -> CompleteSourceSnapshotService snapshot
  -> replace all nine source collections
  -> success

apply failure
  -> restore all nine collections from snapshot
  -> controlled restored failure

rollback failure
  -> distinct severe rollback-failure result
```

Do not begin B2 until the B1 docs-only closeout is merged and exact final `develop` CI is green, followed by a separate user instruction.

### Current persistence boundary

```text
BusinessDataset contract             COMPLETE
Workbook schema contract             COMPLETE
Dataset semantic validation          COMPLETE
XLSX codec / bidirectional mapping   COMPLETE
Complete source snapshot             COMPLETE — 5.3A
Repository bulk replacement          COMPLETE — 5.3B1
Atomic hydration + rollback          NEXT / NOT STARTED — 5.3B2
Hydration session completion gate    NOT STARTED — 5.3B3
Persistence coordinator/load-save    NOT STARTED — 5.3C
ExcelStorage load/save               placeholder
Backup/atomic transport              Phase 5.4B
Native filesystem                    Phase 6
```

## Phase 6 — Tauri Desktop Integration

Status: **PLANNED**

Planned native dialogs, application-data directory, backup paths, safe file replacement, and desktop packaging.

## Phase 7 — Reporting & Operational Polish

Status: **PLANNED**

Planned dashboard, inventory valuation, profitability, material requirements, low-stock indicators, production history, and report export.

## Current active task

**Phase 5.3B2 — Validated Atomic Hydration + Rollback — NEXT / NOT STARTED**
