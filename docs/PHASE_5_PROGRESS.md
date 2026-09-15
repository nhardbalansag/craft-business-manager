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
5.1 — Persisted Dataset & Workbook Contract Foundation   IN PROGRESS
    5.1A — Source Inventory & Dataset Completeness        COMPLETE
    5.1B — Workbook Schema / Sheet / Column Contracts     COMPLETE
    5.1C — Dataset Validation & Reference Integrity       PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED

5.2 — XLSX Workbook Codec                                 NOT STARTED
    5.2A — XLSX Library Evaluation & Codec Boundary       NOT STARTED
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
- The concrete XLSX library remains deferred to 5.2A.

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
First implementation checkpoint   61728a3e62d58afa291b57e02fa288836801fda3
First checkpoint CI               34985582449 — FAILURE
Corrected implementation head     d9a87c7714e69dc0584a86dbb20f282dbeadaa4d
Implementation CI                 34985739279 — SUCCESS
Documented feature head           b03313fe3260d7b293241b291b836f962e49b07c
Documented feature CI             34985914438 — SUCCESS
PR #131                           MERGED
PR CI                             34986078428 — SUCCESS
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
First implementation checkpoint   1416c41ae0a97e74ad8b152706906514d7f85c0c
First checkpoint CI               34993126608 — FAILURE
Corrected implementation head     7782d0ad7e77c6d52db928164ba9ae1facff4d55
Corrected implementation CI       34993382846 — SUCCESS
Documented feature head           fd45db3a23bf7d00fc51e65fd36c354d61f2c5a4
Documented feature CI             34993513561 — SUCCESS
PR #134                           MERGED
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

The first 5.1B checkpoint failed only on a TypeScript registry-construction cast; the corrected typed registry preserved the exact same workbook behavior.

---

## Phase 5.1C — Dataset Validation & Reference Integrity

Status: **PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Dedicated plan:

`docs/PHASE_5_1C_DATASET_VALIDATION_REFERENCE_INTEGRITY_PLAN.md`

Planning base:

```text
develop  656add851d6eeb6841f2f6e11816bbd52f5028c1
CI       34994087842 — SUCCESS
```

### Split assessment

5.1C does **not** require deeper formal numbered sub-phases.

It remains one atomic complete-dataset acceptance gate with internal checkpoints for:

1. envelope + per-record source contracts;
2. duplicate identities;
3. durable cross-references;
4. Product component source uniqueness + graph/cycle integrity;
5. deterministic structured diagnostics + regression.

### Audit conclusions

- validation must occur on raw candidate arrays before repository construction because normalized `Map` repositories can overwrite case-insensitive duplicate keys;
- existing Phase 1–4 source/domain validators remain authoritative and should be reused rather than reimplemented;
- `validateProductCompositionGraph(...)` remains the authoritative Product component source-uniqueness/self/cycle gate;
- validation is whole-dataset, pure, side-effect-free, and independent from XLSX/React/repositories/Tauri;
- live create/update services must **not** be replayed sequentially because their active-state rules are workflow eligibility rules and can reject legitimate historical/archived persisted source state;
- persistence blockers include malformed source rows, duplicate canonical identities, missing durable references, invalid configured pricing policy, duplicate Product component source identity, self-reference, and cycles;
- invalid candidates must return controlled deterministic diagnostics and must never be silently repaired or partially hydrated.

### Planned implementation surface

```text
src/domain/businessDatasetValidation.ts
src/domain/businessDatasetValidation.test.ts
```

Small behavior-preserving pure-validator extraction from an existing domain module is permitted only when a row contract is currently embedded inside derivation logic and cannot otherwise be reused safely.

### Locked duplicate matrix

```text
Materials                 ID; name
MaterialCalibrations      ID
MixPresets                ID; name
Products                  ID; name
YieldSamples              ID
RecipeItems               ID; (productId, materialId)
ProductComponents         ID; parent/source identity via graph validator
ProductStocks             productId
ProductFinancialProfiles  productId
```

All comparisons are trim-aware and case-insensitive.

### Locked durable reference matrix

```text
MaterialCalibration.materialId                   -> Material.id
MixPreset.lines[].materialId                     -> Material.id
Product.mixPresetId?                             -> MixPreset.id
YieldSample.productId                            -> Product.id
YieldSample.mixPresetId?                         -> MixPreset.id
YieldSample.materialInputs[].materialId          -> Material.id
FixedRecipeItem.productId                       -> Product.id
FixedRecipeItem.materialId                      -> Material.id
ProductComponent.parentProductId                -> Product.id
ProductComponent(material).sourceId             -> Material.id
ProductComponent(product).sourceId              -> Product.id
ProductStock.productId                          -> Product.id
ProductFinancialProfile.productId               -> Product.id
```

### Diagnostic contract direction

The canonical validator should return a structured result with stable issue codes and paths such as:

```text
materials[2].id
products[1].mixPresetId
yieldSamples[4].materialInputs[0].materialId
productComponents[3].sourceId
```

Future 5.2C may map these dataset paths to workbook sheet/row coordinates; 5.1C itself remains workbook-independent.

### Stop point

No 5.1C production/test implementation is included in this planning step.

Implementation may begin only after this planning documentation is merged to `develop` and exact post-merge CI is green, followed by a separate user instruction to proceed.

---

## Current persistence foundation

```text
BusinessDataset: 9 authoritative source collections
Workbook schema: 13 canonical sheets
Workbook structure validator: implemented
Dataset semantic/reference validator: planned in 5.1C, not implemented yet
ExcelStorage.load/save: intentional placeholders
XLSX dependency: not selected/installed
Repository hydration: not implemented
Native filesystem: Phase 6
```

## Current active task

**5.1C — Dataset Validation & Reference Integrity — PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED**

Do not begin 5.1C implementation until the dedicated planning PR is merged and exact post-merge `develop` CI is successful.
