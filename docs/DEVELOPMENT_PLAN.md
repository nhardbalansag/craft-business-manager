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

5.2 XLSX Workbook Codec                                  COMPLETE
    5.2A XLSX Library Evaluation & Codec Boundary        COMPLETE
    5.2B Deterministic Dataset-to-XLSX Export            COMPLETE
    5.2C Strict XLSX-to-Dataset Import & Diagnostics     COMPLETE

5.3 Snapshot, Hydration & Persistence Coordination       NOT STARTED
    5.3A Complete Source Snapshot Service                NEXT / NOT STARTED
    5.3B Validated Atomic Dataset Hydration              NOT STARTED
    5.3C Persistence Coordinator / Load-Save Lifecycle   NOT STARTED

5.4 Version Compatibility, Backup & Recovery Safety      NOT STARTED
5.5 Excel Persistence UI                                 NOT STARTED
5.6 Integration & Completion Gate                        NOT STARTED
```

### Phase 5.1 — Persisted contract foundation

**COMPLETE**

Phase 5.1 established the complete versioned nine-collection `BusinessDataset`, the 13-sheet normalized workbook v1 contract, exact source representation and ordering rules, formula-cell rejection, and complete pre-hydration duplicate/reference/graph validation.

Final Phase 5.1 closeout:

```text
develop  7efef34fac309f9d9745631a54bc8a8ba404415f
CI       34998382050 — SUCCESS
84 test files / 1048 tests
```

### Phase 5.2A — XLSX Library Evaluation & Codec Boundary

**COMPLETE**

Plan: `docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY_PLAN.md`  
Completion record: `docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY.md`

Delivered SheetJS Community Edition 0.20.3, library-neutral `WorkbookCodec`, in-memory byte encode/decode, formula-write rejection, inbound formula metadata detection, and 12 real-XLSX codec tests.

```text
PR #140                         MERGED
Implementation merge            8468edf288b014a00f4f1529442fa043084f1102
Post-merge CI                   35002844064 — SUCCESS
Final closeout develop          c03cee3cacbf9ed5f6a7726d380df9b461725356
Final closeout CI               35003583148 — SUCCESS
```

### Phase 5.2B — Deterministic Dataset-to-XLSX Export

**COMPLETE**

Plan: `docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT_PLAN.md`  
Completion record: `docs/PHASE_5_2B_DETERMINISTIC_DATASET_TO_XLSX_EXPORT.md`

Delivered the complete deterministic source export direction, including all 13 canonical sheets, explicit metadata, normalized child rows, missing/zero/null fidelity, schema self-validation, and real XLSX encoding.

```text
PR #143                         MERGED
Implementation merge            296960ee2f6e70999f4d279d59f977f4cf1c1d22
Post-merge CI                   35007932757 — SUCCESS
Final closeout develop          39ee7541b7de93e39d9963e5e1be1e80dcd07644
Final closeout CI               35008520820 — SUCCESS
86 test files / 1073 tests
```

### Phase 5.2C — Strict XLSX-to-Dataset Import & Diagnostics

**COMPLETE**

Plan: `docs/PHASE_5_2C_STRICT_XLSX_TO_DATASET_IMPORT_DIAGNOSTICS_PLAN.md`  
Completion record: `docs/PHASE_5_2C_STRICT_XLSX_TO_DATASET_IMPORT_DIAGNOSTICS.md`

Delivered:

- library-neutral XLSX-byte import via `WorkbookCodec`;
- structured codec/schema/metadata/reconstruction/dataset diagnostics;
- strict current-version metadata and schema gating;
- reconstruction of all nine source collections;
- Material supplier/source and nullable pricing-policy reconstruction;
- normalized MixPreset/YieldSample child reconstruction;
- trim-aware case-insensitive parent matching;
- orphan, duplicate-order, gap, and non-1-starting child-order rejection;
- final Phase 5.1C candidate validation;
- real XLSX export/import source-semantic round-trip;
- no repository/session mutation.

Implementation evidence:

```text
PR #146                         MERGED
PR CI                           35012225167 — SUCCESS
Implementation merge            3cd2bb280ef463b2267cafbbd28b9b9aba1fb656
Post-merge CI                   35012385953 — SUCCESS
87 test files / 1091 tests
18 Phase 5.2C focused tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

### Phase 5.2 completion result

The workbook codec/mapping layer is bidirectional and fail-closed:

```text
BusinessDataset -> WorkbookNeutralDocument -> XLSX bytes   COMPLETE
XLSX bytes -> WorkbookNeutralDocument -> BusinessDataset   COMPLETE
```

### Current Phase 5 boundary

```text
BusinessDataset contract             COMPLETE
Workbook schema contract             COMPLETE
Dataset semantic validator           COMPLETE
XLSX library / byte codec            COMPLETE — SheetJS CE 0.20.3
Dataset -> workbook/XLSX export      COMPLETE
Workbook -> dataset reconstruction   COMPLETE
Repository snapshot service          NOT STARTED — 5.3A
Validated atomic hydration           NOT STARTED — 5.3B
Persistence coordinator/load-save    NOT STARTED — 5.3C
ExcelStorage load/save               placeholder
Native filesystem                    Phase 6
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
   ├── BusinessDataset ↔ Workbook mapping
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

**Phase 5.3A — Complete Source Snapshot Service — NEXT / NOT STARTED**

5.3A must begin with a dedicated scope/decomposition review and development plan from the exact final green Phase 5.2C closeout baseline. Do not begin 5.3A implementation automatically as part of the 5.2C closeout.
