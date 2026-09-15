# Craft Business Manager — Development Plan

## Objective

Build a desktop-first tool for material costing, real-production yield learning, inventory-based production estimates, multi-vessel / multi-component craft products, selling-price / profit planning, and safe local persistence.

The domain and application layers remain storage-agnostic so Excel persistence can later move to SQLite without rewriting business rules.

## Delivery principles

- preserve user-entered/source evidence and derive normalized values;
- use canonical internal units (`g`, `mL`, `pc`);
- keep material-specific cross-dimension conversion behind calibration/manual evidence;
- keep React behind application services rather than duplicating business rules in UI code;
- keep derived costing/yield/capacity/pricing results out of authoritative persistence;
- keep workbook codec, dataset validation, repository hydration, and filesystem transport separate;
- advance tasks only after feature CI, PR CI, guarded merge, and exact post-merge `develop` CI succeed.

---

## Phase 0 — Repository & Architecture Foundation

Status: **COMPLETE**

Delivered React + TypeScript + Vite, branch strategy, storage abstraction, domain/application layering, Vitest, and GitHub Actions CI.

---

## Phase 1 — Materials, Units & Calibration

Status: **COMPLETE**

Dedicated plan: `docs/PHASE_1_MATERIALS_UNITS_CALIBRATION_PLAN.md`

```text
1.1 Measurement & Conversion Foundation         COMPLETE
1.2 Material Master Domain                      COMPLETE
1.3 Purchase Costing & Inventory Quantity       COMPLETE
1.4 Material-Specific Calibration               COMPLETE
1.5 Supplier & Source Metadata                  COMPLETE
1.6 Integration & Completion Gate               COMPLETE
```

Phase 1 established canonical units/conversion, Material master/source metadata, package costing, inventory normalization/valuation, material-specific calibration/manual fallback, and Materials/Calibration workflows.

---

## Phase 2 — Product Recipes & Mold Yield

Status: **COMPLETE**

Planning baseline: `docs/PHASE_2_PRODUCT_RECIPES_MOLD_YIELD_PLAN.md`

Completion tracker: `docs/PHASE_2_PROGRESS.md`

Final completion record: `docs/PHASE_2_6B_REGRESSION_BUILD_COMPLETION.md`

```text
2.1 Product & Mix Foundation                    COMPLETE
2.2 Yield Evidence & Per-Good-Piece Learning    COMPLETE
2.3 Recipe Requirement Synthesis                COMPLETE
2.4 Safety Waste & Inventory Capacity           COMPLETE
2.5 Product / Yield / Production UI             COMPLETE
2.6 Integration & Completion Gate               COMPLETE
```

Phase 2 established product categories, reusable MixPresets, immutable real-production yield evidence, learned per-good-piece requirements, fixed recipe items, safety waste, direct-material cost preview, physical batch rounding, stock-based direct-material capacity, and Product/Yield/Production workflows.

Final Phase 2 gate:

```text
PR #58 merged
Post-merge CI 34908149932 — SUCCESS
38 test files / 349 tests
```

---

## Phase 3 — Product Components, Vessels & Nested Molded Products

Status: **COMPLETE**

Planning baseline: `docs/PHASE_3_PRODUCT_COMPONENTS_VESSELS_PLAN.md`

Completion tracker: `docs/PHASE_3_PROGRESS.md`

Final completion record: `docs/PHASE_3_6B_REGRESSION_BUILD_COMPLETION.md`

```text
3.1 Composition Foundation                      COMPLETE
3.2 Finished Component Stock                    COMPLETE
3.3 Component-Aware Cost Roll-Up                COMPLETE
3.4 Component-Limited Assembly Capacity         COMPLETE
3.5 Component / Stock / Production UI           COMPLETE
3.6 Integration & Completion Gate               COMPLETE
```

Phase 3 established Material/Product-backed components, purchased and handmade vessels, Product graph cycle prevention, explicit ProductStock, recursive component cost roll-up, component-aware assembly capacity, tied limiter tracing, and component/stock/production workflows.

Final Phase 3 gate:

```text
3.6B PR #93 merged
Post-merge CI 34930387721 — SUCCESS
55 test files / 628 tests
```

---

## Phase 4 — Pricing & Production Planning

Status: **COMPLETE**

Planning baseline: `docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Completion tracker: `docs/PHASE_4_PROGRESS.md`

Final completion record: `docs/PHASE_4_6B_REGRESSION_BUILD_COMPLETION.md`

```text
4.1 Financial Profile & Pricing Policy Foundation       COMPLETE
4.2 Fully Loaded Product Unit Cost                       COMPLETE
4.3 Selling Price & Unit Economics                       COMPLETE
4.4 Planned Batch Financials & Capacity                  COMPLETE
4.5 Pricing & Production Planning UI                     COMPLETE
4.6 Integration & Completion Gate                        COMPLETE
```

Phase 4 established Product financial profiles, fixed-profit/markup/target-margin pricing, recursively fully loaded production cost, selling-price/unit-economics metrics, Q-specific physical planned-batch financials, capacity feasibility/warnings, and Pricing/Production financial UI.

Final Phase 4 gate:

```text
4.6B validation PR #128 merged
Post-merge CI 34981363478 — SUCCESS
81 test files / 986 tests
```

The existing Vite warning for a minified main chunk slightly above 500 kB is non-blocking and remains a future code-splitting/performance concern.

---

## Phase 5 — Excel Persistence

Status: **IN PROGRESS**

Master plan: `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Live tracker: `docs/PHASE_5_PROGRESS.md`

```text
5.1 Persisted Dataset & Workbook Contract Foundation    COMPLETE
    5.1A Source Inventory & Dataset Completeness         COMPLETE
    5.1B Workbook Schema / Sheet / Column Contracts      COMPLETE
    5.1C Dataset Validation & Reference Integrity        COMPLETE

5.2 XLSX Workbook Codec                                  IN PROGRESS
    5.2A XLSX Library Evaluation & Codec Boundary        COMPLETE
    5.2B Deterministic Dataset-to-XLSX Export            NEXT / NOT STARTED
    5.2C Strict XLSX-to-Dataset Import & Diagnostics     NOT STARTED

5.3 Snapshot, Hydration & Persistence Coordination       NOT STARTED
5.4 Version Compatibility, Backup & Recovery Safety      NOT STARTED
5.5 Excel Persistence UI                                 NOT STARTED
5.6 Integration & Completion Gate                        NOT STARTED
```

### Phase 5.1 — Persisted contract foundation

**COMPLETE**

Phase 5.1 established:

- complete versioned `BusinessDataset` covering all nine authoritative Phase 1–4 source collections;
- calibration evidence in persisted source state;
- 13-sheet normalized workbook v1 contract;
- exact sheet/column and child-row relationships;
- canonical enum/unit/value representation;
- deterministic sheet/column/row-order policy;
- formula-cell rejection policy and literal-text semantics;
- complete pre-hydration semantic validation;
- duplicate identity detection before repository construction;
- durable cross-reference validation;
- Product composition source/self/cycle integrity;
- deterministic structured diagnostics;
- preservation of missing-vs-zero/null and legitimate historical archived relationships;
- no silent repair or partial hydration.

Final Phase 5.1 closeout:

```text
develop  7efef34fac309f9d9745631a54bc8a8ba404415f
CI       34998382050 — SUCCESS
84 test files / 1048 tests
```

### Phase 5.2A — XLSX Library Evaluation & Codec Boundary

**COMPLETE**

Plan:
`docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY_PLAN.md`

Completion record:
`docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY.md`

Delivered:

- selected **SheetJS Community Edition 0.20.3**;
- pinned exact upstream tarball `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` rather than stale public npm `xlsx`;
- established library-neutral `WorkbookCodec`;
- implemented `SheetJsWorkbookCodec` as the only library-specific production adapter;
- in-memory `Uint8Array` encode and `Uint8Array | ArrayBuffer` decode;
- real `.xlsx` round-trip tests;
- outbound formula-object rejection;
- inbound formula metadata detection with no formula evaluation;
- formula-looking strings preserved as literal text;
- worksheet-order and primitive-cell behavior validated;
- no filesystem/Tauri dependency;
- 12 focused codec tests.

Implementation evidence:

```text
PR #140                         MERGED
Implementation merge            8468edf288b014a00f4f1529442fa043084f1102
Post-merge CI                   35002844064 — SUCCESS
85 test files / 1060 tests
12 Phase 5.2A focused tests
8 React workspace smoke tests
7 Phase 4.6A integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

The selected codec is not yet connected to React or `ExcelStorage`, so SheetJS has not yet entered the application entry bundle. Re-measure bundle impact when persistence becomes application-reachable and consider deferred/dynamic loading.

### Current Phase 5 boundary

```text
BusinessDataset contract             COMPLETE
Workbook schema contract            COMPLETE
Dataset semantic validator          COMPLETE
XLSX library selection              COMPLETE — SheetJS CE 0.20.3
Library-neutral byte codec          COMPLETE
SheetJS in-memory adapter           COMPLETE
Dataset -> workbook export          NOT STARTED — 5.2B
Workbook -> dataset reconstruction  NOT STARTED — 5.2C
ExcelStorage load/save              placeholder
Repository snapshot/hydration       NOT STARTED — 5.3
Native filesystem                   Phase 6
```

---

## Phase 6 — Tauri Desktop Integration

Status: **PLANNED**

Planned native file dialogs, application-data directory, backup folder, safe write/replace flow, and desktop packaging.

---

## Phase 7 — Reporting & Operational Polish

Status: **PLANNED**

Planned dashboard, inventory valuation, profitability, material requirements, low-stock indicators, production history, and Excel report export.

---

## Storage migration path

```text
React UI
   ↓
Application Services
   ↓
Domain
   ↓
Storage / Persistence Boundaries
   ├── WorkbookCodec -> SheetJsWorkbookCodec
   ├── ExcelStorage (later Phase 5 wiring)
   └── SQLiteStorage (future)
   ↓
Tauri filesystem boundary (Phase 6)
```

No React component should read or write spreadsheet cells directly.

## Current roadmap position

**Phase 0 — COMPLETE**  
**Phase 1 — COMPLETE**  
**Phase 2 — COMPLETE**  
**Phase 3 — COMPLETE**  
**Phase 4 — COMPLETE**  
**Phase 5 — IN PROGRESS**

Current active task:

**Phase 5.2B — Deterministic Dataset-to-XLSX Export — NEXT / NOT STARTED**

Do not begin 5.2B implementation until separately requested from the exact final green Phase 5.2A closeout baseline. Before implementation, perform a dedicated scope/decomposition review and create the 5.2B development plan.
