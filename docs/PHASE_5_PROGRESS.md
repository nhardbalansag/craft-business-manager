# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Phase 5.6A plan:

`docs/PHASE_5_6A_INTEGRATED_EXCEL_ROUND_TRIP_WORKFLOW_PLAN.md`

This file is the concise authoritative live Phase 5 tracker. Detailed historical implementation evidence remains in each dedicated phase-completion record and in Git history.

## Current authoritative green implementation baseline

After Phase 5.6A2 implementation:

```text
develop  3555a8e02dc4fafe5c3a32e6ecccd3ab7f88eab5
CI       35141650499 — SUCCESS
```

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

5.3 — Snapshot, Hydration & Persistence Coordination      COMPLETE
    5.3A — Complete Source Snapshot Service               COMPLETE
    5.3B — Validated Atomic Dataset Hydration             COMPLETE
    5.3C — Persistence Coordinator / Load-Save Lifecycle  COMPLETE

5.4 — Version Compatibility, Backup & Recovery Safety     COMPLETE
    5.4A — Schema Migration & Compatibility Framework     COMPLETE
    5.4B — Backup & Atomic-Write Transport Contract       COMPLETE
    5.4C — Corruption, Limits & Recovery Diagnostics      COMPLETE

5.5 — Excel Persistence UI                                COMPLETE
    5.5A — Import / Open Workbook Workflow                COMPLETE
    5.5B — Export / Save & Backup Workflow                COMPLETE
    5.5C — Persistence Status / Validation / Recovery UX  COMPLETE
        5.5C1 — Persistence Session Status & Workbook Identity        COMPLETE
        5.5C2 — Validation Detail & Recovery Guidance UX              COMPLETE
        5.5C3 — Persistence UX Regression & Phase 5.5 Completion Gate COMPLETE

5.6 — Integration & Completion Gate                       IN PROGRESS
    5.6A — Integrated Excel Round-Trip Workflow           IN PROGRESS
        5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics COMPLETE
        5.6A2 — Phase 1–4 Derived Service Equivalence                         COMPLETE
        5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate      NEXT / NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Locked Phase 5 architecture

### Authoritative source and workbook

- `.xlsx` is the authoritative Phase 5 workbook format.
- `BusinessDataset` covers all nine authoritative source repositories.
- Derived costing, yield-learning, capacity, pricing, and production results are recalculated and are not persisted as source truth.
- Dataset schema version and workbook format version are separate axes.
- Workbook v1 uses 13 normalized canonical sheets.
- Missing source evidence stays distinct from explicit zero/null/false.
- Formula cells are not authoritative source values.
- SheetJS remains behind the library-neutral `WorkbookCodec` boundary.

### Snapshot / hydration / persistence

- `CompleteSourceSnapshotService` is the complete source-snapshot boundary.
- `ValidatedAtomicDatasetHydrationService` validates before replacement and owns rollback behavior.
- `PersistenceCoordinator` owns the application-level export/import/save/load lifecycle.
- React does not enumerate repositories or construct workbook sheets directly.
- Stable singleton repository/service identity is preserved across hydration.

### Compatibility / safe save / recovery

- Future unsupported workbook or dataset versions fail closed.
- Raw importer issues remain authoritative technical evidence.
- Recovery summaries remain derived/advisory.
- `WorkbookTransport` reports backup/replacement guarantees truthfully.
- Browser download remains copy-oriented and does not claim native overwrite, managed paths, atomic filesystem replacement, `fsync`, locking, or durable native backup behavior.
- Native filesystem behavior remains Phase 6.

---

## Phase 5.1 — Persisted Dataset & Workbook Contract Foundation — COMPLETE

Established the complete versioned source dataset, normalized workbook contract, and pre-hydration dataset/reference validation boundary.

Key source collections:

```text
materials
materialCalibrations
mixPresets
products
yieldSamples
recipeItems
productComponents
productStocks
productFinancialProfiles
```

---

## Phase 5.2 — XLSX Workbook Codec — COMPLETE

Established deterministic dataset-to-workbook export, strict workbook-to-dataset import, SheetJS byte encoding/decoding, formula safety, normalized child sheets, and structured diagnostics.

---

## Phase 5.3 — Snapshot, Hydration & Persistence Coordination — COMPLETE

Established complete source snapshots, atomic validated hydration/rollback, stable repository identity, and the single application persistence coordinator.

---

## Phase 5.4 — Version Compatibility, Backup & Recovery Safety — COMPLETE

Final Phase 5.4 evidence:

```text
develop  b8584d8681e95676c209c2e5a9dde0ee6278b71a
CI       35055715946 — SUCCESS
```

Established compatibility/version preflight, migration framework, future-version rejection, safe-save/backup transport contracts, staged/atomic in-memory reference behavior, resource limits, corruption diagnostics, deterministic recovery guidance, and rejection state preservation.

---

## Phase 5.5 — Excel Persistence UI — COMPLETE

Parent completion record:

`docs/PHASE_5_5_EXCEL_PERSISTENCE_UI.md`

Final parent evidence:

```text
Closeout PR #209               MERGED
Final 5.5 develop              3cc9ae0e419a4e0075b04180849b23b7087bc98f
Final 5.5 CI                   35137244664 — SUCCESS
```

Detailed 5.5A/B/C implementation evidence remains in the dedicated completion records.

---

## Phase 5.6 — Integration & Completion Gate — IN PROGRESS

### 5.6A — Integrated Excel Round-Trip Workflow — IN PROGRESS

Plan:

`docs/PHASE_5_6A_INTEGRATED_EXCEL_ROUND_TRIP_WORKFLOW_PLAN.md`

Planning evidence:

```text
Planning PR #210               MERGED
Planning head                  04f9f9fe6065e17999eb4d0588898535be42e0fc
Planning PR CI                 35138324273 — SUCCESS
Planning merge                 c70eaebbb2af62a28868985ff4cf0dfacfc64d8d
Post-plan CI                   35138470416 — SUCCESS
```

Locked decomposition:

```text
5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics COMPLETE
5.6A2 — Phase 1–4 Derived Service Equivalence                         COMPLETE
5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate      NEXT / NOT STARTED
```

Scenario ownership:

```text
A1 -> A, E, I
A2 -> B, C, D, F
A3 -> G, H, J + aggregate 5.6A completion proof
```

### 5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics — COMPLETE

Completion record:

`docs/PHASE_5_6A1_SOURCE_ROUND_TRIP_FIDELITY_DETERMINISTIC_WORKBOOK_SEMANTICS.md`

A1 proves through the real singleton application graph and real XLSX bytes:

- **Scenario A:** all nine authoritative source collections survive export -> clear -> import/hydrate with exact source-semantic equality and stable repository identity;
- **Scenario E:** missing Product financial profile remains missing, while explicit zero labor/overhead remains a configured profile and `pricingPolicy: null` remains null;
- **Scenario I:** equivalent source state produces the same canonical workbook sheet/column/row semantics regardless of top-level repository insertion order, excluding only designed-to-vary `_Meta.exportedAt` metadata.

Implementation evidence:

```text
Implementation PR #211          MERGED
Implementation merge            4f01b4b706bb82fad260d407d7b4c4173a230b40
Post-implementation develop CI  35139932051 — SUCCESS
129 test files / 1430 tests
3 focused A1 integration tests
Typecheck PASS
Production build PASS
149 modules transformed
```

### 5.6A2 — Phase 1–4 Derived Service Equivalence — COMPLETE

Completion record:

`docs/PHASE_5_6A2_PHASE_1_4_DERIVED_SERVICE_EQUIVALENCE.md`

A2 proves through the production singleton service graph and real XLSX bytes:

- **Scenario B:** calibration-dependent `cup -> g` conversion, latest calibration selection, package/base-unit costing, and recipe normalization remain equivalent;
- **Scenario C:** yield-derived plus fixed-recipe requirements and material-cost previews remain equivalent;
- **Scenario D:** Material-backed/Product-backed component relationships, explicit ProductStock availability, recursive component cost, and fully loaded parent cost remain equivalent;
- **Scenario F:** fully loaded unit cost, pricing quote, physical planned-batch cost, expected financials, capacity trace, bottleneck meaning, and planned-batch feasibility remain equivalent.

Representative Scenario F meaning remains stable after hydrate:

```text
current assembly capacity  5
limiting source            product-child ProductStock
requested batch            6
feasibility                over-current-capacity
overage                    1
```

Implementation evidence:

```text
A2 baseline                     f1d403bc6b8fe5196d8837ed790a3959aae01466
A2 baseline CI                  35140571447 — SUCCESS
Feature head                    1dfef553a4741de760321ebd936a90cc43dec1e1
Feature branch CI               35141355473 — SUCCESS
Implementation PR #213          MERGED
Implementation PR CI            35141515815 — SUCCESS
Implementation merge            3555a8e02dc4fafe5c3a32e6ecccd3ab7f88eab5
Post-implementation develop CI  35141650499 — SUCCESS
130 test files / 1434 tests
4 focused A2 integration tests
Typecheck PASS
Production build PASS
149 modules transformed
```

A2 implementation was tests-only: exactly one added integration-test file, 455 additions, and no production runtime/domain/schema/coordinator/transport/UI/native-filesystem changes.

### 5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate — NEXT / NOT STARTED

A3 owns:

- Scenario G — invalid workbook preserves state;
- Scenario H — future/unsupported version rejection;
- Scenario J — backup/staged/replace failure integration;
- aggregate A–J parent 5.6A completion proof.

### 5.6B — Regression / Build / Phase 5 Completion — NOT STARTED

Phase 5 may be marked COMPLETE only after 5.6A is fully closed and the separate 5.6B final gate succeeds.

---

## Current persistence boundary

```text
BusinessDataset source contract          COMPLETE
Workbook schema contract                 COMPLETE
Dataset integrity validator              COMPLETE
XLSX library / codec                     COMPLETE
Dataset <-> XLSX round-trip              COMPLETE
Snapshot / hydration                     COMPLETE — 5.3
Persistence coordinator lifecycle        COMPLETE — 5.3C
Schema compatibility / migration         COMPLETE — 5.4A
Backup / atomic-write safety             COMPLETE — 5.4B
Corruption / resource / recovery         COMPLETE — 5.4C
Browser persistence UI                   COMPLETE — 5.5
Source round-trip integration            COMPLETE — 5.6A1
Derived service equivalence              COMPLETE — 5.6A2
Rejection/safe-save + A completion gate  NEXT — 5.6A3
Phase 5 final completion gate            NOT STARTED — 5.6B
Native filesystem                        Phase 6
```

## Current active task

**5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate — NEXT / NOT STARTED**

Do not begin 5.6A3 until the Phase 5.6A2 docs-only closeout is merged into `develop`, the exact resulting `develop` CI is green, and the user separately says to proceed.
