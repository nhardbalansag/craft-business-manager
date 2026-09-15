# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Authoritative Phase 5 planning base:

```text
develop  1d9d93c265fcadd01c3f16318bfcf7c079a432a1
CI       34982462060 — SUCCESS
```

Phase 5 master-plan merge:

```text
develop  5cf12188b8ec2d727aa5debe6a131a10168244ab
CI       34984709583 — SUCCESS
```

## Live task map

```text
5.1 — Persisted Dataset & Workbook Contract Foundation   COMPLETE
    5.1A — Source Inventory & Dataset Completeness        COMPLETE
    5.1B — Workbook Schema / Sheet / Column Contracts     COMPLETE
    5.1C — Dataset Validation & Reference Integrity       COMPLETE

5.2 — XLSX Workbook Codec                                 NOT STARTED
    5.2A — XLSX Library Evaluation & Codec Boundary       NEXT / NOT STARTED
    5.2B — Deterministic Dataset-to-XLSX Export           NOT STARTED
    5.2C — Strict XLSX-to-Dataset Import & Diagnostics    NOT STARTED

5.3 — Snapshot, Hydration & Persistence Coordination      NOT STARTED
    5.3A — Complete Source Snapshot Service               NOT STARTED
    5.3B — Validated Atomic Dataset Hydration              NOT STARTED
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

---

## Locked Phase 5 decisions

- `.xlsx` is the authoritative Phase 5 workbook format; `.xls`, `.xlsm`, and CSV are not complete v1 database formats.
- Persist authoritative source evidence only; derived costing, yield-learning, capacity, pricing, revenue, and profit outputs are recalculated.
- `BusinessDataset` covers all nine current authoritative source repositories.
- Dataset schema version and workbook-format/layout version are distinct version concepts.
- Phase 5.1B established a 13-sheet normalized workbook contract, including child sheets for MixPreset categories/lines and YieldSample inputs.
- All canonical schema sheets are required even when source collections are empty.
- Unknown extra workbook sheets/columns are non-authoritative and must not be guessed as application source state.
- Child arrays preserve order with workbook-only 1-based `categoryOrder`, `lineOrder`, and `inputOrder` fields.
- Do not invent a Settings sheet until the application has a real authoritative Settings source contract.
- Free text is literal source data; formulas/macros are never authoritative business logic.
- Formula-typed cells in authoritative fields fail closed; formula-looking text must remain literal text.
- Import validates the entire reconstructed candidate dataset before any live repository mutation.
- Failed validation/import must leave current live state unchanged.
- Missing evidence remains distinct from explicit zero/null source values.
- Source numeric precision is not silently rounded.
- Source timestamps preserve deterministic ISO text semantics.
- Export ordering must be deterministic.
- Workbook codec, source-dataset validation, repository hydration, and filesystem transport are separate boundaries.
- React must use an application persistence coordinator rather than reading/writing workbook cells or repositories directly.
- Concrete Tauri filesystem/dialog behavior remains Phase 6.
- Unsupported future versions fail closed; migrations are explicit.
- Round-trip validation must prove Phase 1–4 service-derived behavior remains equivalent after restore.
- The concrete XLSX library remains deliberately deferred to 5.2A.

---

## Phase 5.1A — Source Inventory & Dataset Completeness

Status: **COMPLETE**

Plan:

`docs/PHASE_5_1A_PERSISTED_DATASET_SOURCE_INVENTORY_CONTRACT_COMPLETENESS_PLAN.md`

Completion record:

`docs/PHASE_5_1A_PERSISTED_DATASET_SOURCE_INVENTORY_CONTRACT_COMPLETENESS.md`

Delivered:

- complete nine-collection `BusinessDataset`;
- `materialCalibrations` added to persisted source state;
- `CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1`;
- `BUSINESS_DATASET_SOURCE_COLLECTION_KEYS`;
- complete-envelope fail-closed validation;
- empty/clone/normalize helpers with defensive ownership;
- missing-vs-zero/null source semantics preserved;
- row/reference/graph validation explicitly deferred to 5.1C;
- no XLSX, UI, hydration, backup, or Tauri behavior introduced.

Completion evidence:

```text
Starting develop                  5cf12188b8ec2d727aa5debe6a131a10168244ab
Starting CI                       34984709583 — SUCCESS
Implementation merge              467341eafe36e37812eb65f4cd4683dd9153868b
Post-merge CI                     34986286733 — SUCCESS
Final closeout develop            8a1fdc2bbc5a24c20689c933b9964903d380e37c
Final closeout CI                 34986791114 — SUCCESS
82 test files / 996 tests
```

---

## Phase 5.1B — Workbook Schema / Sheet / Column Contracts

Status: **COMPLETE**

Plan:

`docs/PHASE_5_1B_WORKBOOK_SCHEMA_SHEET_COLUMN_CONTRACTS_PLAN.md`

Completion record:

`docs/PHASE_5_1B_WORKBOOK_SCHEMA_SHEET_COLUMN_CONTRACTS.md`

Delivered:

- library-independent workbook schema contract under `src/storage`;
- workbook format ID `craft-business-manager` and format version `1`;
- exact 13-sheet registry and exact ordered columns;
- normalized child-sheet relationships;
- canonical enum/unit/value representation;
- literal-only authoritative text/formula rejection;
- deterministic row/sheet order metadata;
- workbook-neutral structural diagnostics;
- no XLSX dependency or `ExcelStorage` runtime implementation.

Completion evidence:

```text
Starting develop                  ad11e171ab7a49ea978372a3879222db8f6b112e
Starting CI                       34988367766 — SUCCESS
Implementation merge              9b5ca56f8574f922218fafa18540e7b11606d4b9
Post-merge CI                     34993623712 — SUCCESS
Docs PR #135                      MERGED
Final closeout develop            656add851d6eeb6841f2f6e11816bbd52f5028c1
Final closeout CI                 34994087842 — SUCCESS
83 test files / 1018 tests
22 Phase 5.1B focused tests
8 React workspace smoke tests
7 Phase 4.6A integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

---

## Phase 5.1C — Dataset Validation & Reference Integrity

Status: **COMPLETE**

Plan:

`docs/PHASE_5_1C_DATASET_VALIDATION_REFERENCE_INTEGRITY_PLAN.md`

Completion record:

`docs/PHASE_5_1C_DATASET_VALIDATION_REFERENCE_INTEGRITY.md`

Delivered:

- pure complete-candidate `validateBusinessDatasetIntegrity(...)` boundary;
- controlled structured diagnostics with collection/index/entity/field/path context;
- authoritative row/source validation across all nine persisted collections;
- intrinsic `validateMaterialCalibrationEvidence(...)` extraction preserving existing material-specific derivation semantics;
- trim-aware, case-insensitive duplicate identity validation before repository hydration;
- complete durable cross-reference validation across Materials, MixPresets, Products, yield evidence, recipes, components, stock, and financial profiles;
- authoritative Phase 3 Product composition source-uniqueness/self/cycle validation reused rather than duplicated;
- deterministic issue ordering;
- archived historical relationships preserved when active-state restrictions are only live-edit eligibility rules;
- missing-vs-zero/null semantics preserved without repair/defaulting;
- invalid candidate rows are not silently dropped and the candidate is not mutated;
- no XLSX, workbook reconstruction, repository hydration, ExcelStorage runtime, backup, UI, or Tauri behavior introduced.

Completion evidence:

```text
Starting develop                  9fc8c9b48ebc896e57e8e25e312e88f68f6af070
Starting CI                       34995743207 — SUCCESS
First implementation checkpoint   03dfb5ca8bb4089321df312c5b31e2a151dbbfe9
First implementation CI           34997206352 — SUCCESS
Documented feature head           de7e297e9654625c2a6162acbec822b470c0760a
Documented feature-head CI        34997361899 — SUCCESS
PR #137                           MERGED
PR CI                             34997498206 — SUCCESS
Implementation merge              95b6cb35a85dbc1e71a2b4d71bc3dba8de23b40a
Post-merge develop CI             34997700828 — SUCCESS
84 test files / 1048 tests
30 Phase 5.1C focused tests
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

The existing Vite warning for the minified main JavaScript chunk slightly above 500 kB remains non-blocking and is unchanged in scope.

---

## Phase 5.1 completion result

**Phase 5.1 — Persisted Dataset & Workbook Contract Foundation — COMPLETE**

The persistence foundation now provides three distinct, testable layers:

```text
BusinessDataset contract
    9 authoritative source collections
    versioned complete source envelope

Workbook schema contract
    13 canonical normalized sheets
    exact sheet/column/representation rules

Dataset integrity contract
    complete pre-hydration source validation
    duplicate/reference/graph diagnostics
```

Current boundaries remain intentional:

```text
ExcelStorage.load/save          placeholder
XLSX dependency                 not selected/installed
XLSX byte codec                 not implemented
Workbook row reconstruction     not implemented
Repository hydration            not implemented
Native filesystem               Phase 6
```

## Current active task

**5.2A — XLSX Library Evaluation & Codec Boundary — NEXT / NOT STARTED**

5.2A must evaluate the concrete XLSX library and establish the codec boundary before any export/import implementation. It must remain browser/Tauri-compatible and filesystem-independent.

Do **not** begin 5.2A implementation until separately requested from the exact final green 5.1C closeout baseline.
