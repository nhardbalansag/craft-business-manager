# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Phase 5.6A plan:

`docs/PHASE_5_6A_INTEGRATED_EXCEL_ROUND_TRIP_WORKFLOW_PLAN.md`

This file is the concise authoritative live Phase 5 tracker. Detailed historical implementation evidence remains in each dedicated phase-completion record and in Git history.

## Current authoritative green implementation baseline

After Phase 5.6A1 implementation:

```text
develop  4f01b4b706bb82fad260d407d7b4c4173a230b40
CI       35139932051 — SUCCESS
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
        5.6A2 — Phase 1–4 Derived Service Equivalence                         NEXT / NOT STARTED
        5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate      NOT STARTED
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

Established:

- compatibility/version preflight;
- explicit migration framework;
- future-version rejection;
- safe-save/backup transport capability contracts;
- staged/atomic in-memory reference transport behavior;
- resource limits and corruption diagnostics;
- deterministic recovery categories/actions;
- expected rejection preserving prior live source state.

---

## Phase 5.5 — Excel Persistence UI — COMPLETE

Parent completion record:

`docs/PHASE_5_5_EXCEL_PERSISTENCE_UI.md`

### 5.5A — Import / Open Workbook Workflow — COMPLETE

Parent completion record:

`docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW.md`

Final evidence:

```text
develop  088d0b7d6d5bd6114e3887293dca757140e4eaa5
CI       35064547341 — SUCCESS
```

### 5.5B — Export / Save & Backup Workflow — COMPLETE

Plan / completion records:

- `docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW_PLAN.md`
- `docs/PHASE_5_5B1_BROWSER_WORKBOOK_EXPORT_DOWNLOAD_COMMAND.md`
- `docs/PHASE_5_5B2_REACT_EXPORT_SAVE_COPY_WORKFLOW.md`
- `docs/PHASE_5_5B_EXPORT_SAVE_BACKUP_WORKFLOW.md`

Final evidence:

```text
develop  a1c175176ce4df9fe1c3ae8ec91afd5151dd1e59
CI       35129979872 — SUCCESS
```

### 5.5C — Persistence Status / Validation / Recovery UX — COMPLETE

Plan / completion records:

- `docs/PHASE_5_5C_PERSISTENCE_STATUS_VALIDATION_RECOVERY_UX_PLAN.md`
- `docs/PHASE_5_5C1_PERSISTENCE_SESSION_STATUS_WORKBOOK_IDENTITY.md`
- `docs/PHASE_5_5C2_VALIDATION_DETAIL_RECOVERY_GUIDANCE_UX.md`
- `docs/PHASE_5_5C3_PERSISTENCE_UX_REGRESSION_PHASE_5_5_COMPLETION_GATE.md`

C3 implementation evidence:

```text
Implementation PR #208         MERGED
Implementation merge           1059adaaa0492a2308036271f1a0fa898739ee00
Post-merge CI                  35136380402 — SUCCESS
128 test files / 1427 tests
4 focused C3 completion tests
Typecheck PASS
Production build PASS
149 modules transformed
```

Final parent 5.5 closeout:

```text
Closeout PR #209               MERGED
Final 5.5 develop              3cc9ae0e419a4e0075b04180849b23b7087bc98f
Final 5.5 CI                   35137244664 — SUCCESS
```

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
5.6A2 — Phase 1–4 Derived Service Equivalence                         NEXT / NOT STARTED
5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate      NOT STARTED
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
A1 baseline                     c70eaebbb2af62a28868985ff4cf0dfacfc64d8d
A1 baseline CI                  35138470416 — SUCCESS
Feature head                    784d0eb41ca25346b46e69bcac740903c14e4f02
Feature branch CI               35139602664 — SUCCESS
Implementation PR #211          MERGED
Implementation PR CI            35139807458 — SUCCESS
Implementation merge            4f01b4b706bb82fad260d407d7b4c4173a230b40
Post-implementation develop CI  35139932051 — SUCCESS
129 test files / 1430 tests
3 focused A1 integration tests
Typecheck PASS
Production build PASS
149 modules transformed
```

A1 implementation was tests-only: exactly one added test file, 384 additions, and no production runtime/domain/schema/coordinator/transport/UI/native-filesystem changes.

### 5.6A2 — Phase 1–4 Derived Service Equivalence — NEXT / NOT STARTED

A2 owns:

- Scenario B — calibration-dependent material behavior;
- Scenario C — yield + recipe Product behavior;
- Scenario D — nested components + ProductStock behavior;
- Scenario F — Phase 4 pricing/production equivalence.

A2 must compare derived service results before export and after import/hydration using the same stable application service graph. It must not persist derived results as source truth.

### 5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate — NOT STARTED

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
Derived service equivalence              NEXT — 5.6A2
Rejection/safe-save + A completion gate  NOT STARTED — 5.6A3
Phase 5 final completion gate            NOT STARTED — 5.6B
Native filesystem                        Phase 6
```

## Current active task

**5.6A2 — Phase 1–4 Derived Service Equivalence — NEXT / NOT STARTED**

Do not begin 5.6A2 until the Phase 5.6A1 docs-only closeout is merged into `develop`, the exact resulting `develop` CI is green, and the user separately says to proceed.