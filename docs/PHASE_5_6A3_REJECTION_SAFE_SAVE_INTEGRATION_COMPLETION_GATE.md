# Phase 5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate

Status: **COMPLETE**

Parent:

```text
5.6A — Integrated Excel Round-Trip Workflow
```

Implementation baseline:

```text
develop  a5fbf93b980bf48c0535cca17e08cdbf918ba3fa
CI       35142120146 — SUCCESS
```

Implementation branch:

```text
feature/phase-5-6a3-rejection-safe-save-completion
```

Feature head:

```text
9a07191adf72b8c6d52d6c9c615862222023f2e1
```

Feature CI:

```text
35142621280 — SUCCESS
```

Implementation PR:

```text
#215 — Implement Phase 5.6A3 rejection and safe-save completion gate
```

PR CI:

```text
35142799049 — SUCCESS
```

Implementation merge:

```text
a34fab08b75c591d7eb15d2b6c63fc3bee8970f2
```

Post-implementation `develop` CI:

```text
35142923525 — SUCCESS
```

## Scope

5.6A3 owned the remaining Phase 5.6A master-plan scenarios:

```text
G — Invalid workbook leaves state unchanged
H — Unsupported future version
J — Backup / staged / replace failure integration
```

It also owns the aggregate A–J completion proof for parent Phase 5.6A.

No production runtime behavior was changed. The implementation added one application-integration test module only:

```text
src/application/persistence/Phase56A3RejectionSafeSaveCompletion.test.ts
```

Diff:

```text
1 commit ahead / 0 behind
1 test file added
297 additions / 0 deletions
```

No changes were made to runtime/domain/schema/coordinator/transport/UI/native-filesystem code.

---

## Scenario G — Invalid Workbook Preserves Live State — COMPLETE

The integration suite starts from a known-good non-empty authoritative live dataset, captures the complete source snapshot, then attempts import through the production `PersistenceCoordinator.importAndApplyWorkbook(...)` path using real SheetJS-generated XLSX bytes.

Three representative failure classes are covered.

### Invalid business reference

A Product row is mutated to reference a nonexistent MixPreset.

Expected controlled issue:

```text
MISSING_REFERENCE
```

Proof:

- import rejects at `stage: import`;
- no candidate state becomes live;
- the complete post-rejection source snapshot equals the pre-import snapshot;
- the already-wired `MaterialService` remains usable against the preserved live repositories.

### Invalid canonical workbook structure

The required `Products` sheet is removed from an otherwise canonical workbook.

Expected controlled issue:

```text
MISSING_REQUIRED_SHEET
```

Proof is the same: controlled import rejection, unchanged live state, stable application graph.

### Invalid row/value data

A material `purchaseQuantity` cell is replaced with a non-number token.

Expected controlled issue:

```text
INVALID_CELL_TYPE
```

Again, the previous live dataset remains authoritative after rejection.

This is application-level integration evidence and does not rely only on the Phase 5.5 browser/React rejection tests.

---

## Scenario H — Unsupported Future Version — COMPLETE

The suite creates a valid-looking canonical workbook and advances both version axes beyond the current supported versions:

```text
workbookFormatVersion = CURRENT_WORKBOOK_FORMAT_VERSION + 1
datasetSchemaVersion  = CURRENT_BUSINESS_DATASET_SCHEMA_VERSION + 1
```

Expected result:

```text
stage                compatibility
code                 UNSUPPORTED_FUTURE_VERSION
compatibilityStatus  unsupported-future
```

The issue retains both:

```text
sourceVersion  received workbook/dataset versions
targetVersion  current supported workbook/dataset versions
```

Proof:

- rejection happens before live-state hydration;
- no migration guessing or silent downgrade occurs;
- previous authoritative source state is unchanged;
- stable services remain usable afterward.

---

## Scenario J — Backup / Stage / Commit Failure Integration — COMPLETE

The integration suite uses:

```text
PersistenceCoordinator.saveCurrentWorkbook(...)
+ SafeInMemoryWorkbookTransport
+ real authoritative source snapshot
+ real SheetJS workbook export
```

It injects three pre-commit faults:

```text
backup -> BACKUP_FAILED
stage  -> STAGE_FAILED
commit -> COMMIT_FAILED
```

For each fault the coordinator surfaces:

```text
PersistenceLifecycleOperationalError
stage: transport-save
code:  TRANSPORT_SAVE_FAILED
```

The exact underlying `WorkbookTransportSaveError` remains available as the operational cause and retains:

```text
stage
code
commitState: not-committed
causeValue
```

Required transaction truthfulness is proved:

- no failed transaction is reported as a successful save;
- the pre-existing primary workbook bytes remain authoritative after every pre-commit fault;
- if backup completed before a later stage/commit fault, the backup artifact contains the exact old primary bytes;
- stage cleanup removes uncommitted staging bytes;
- coordinator snapshot/export runs exactly once and is not re-run as a fake rollback mechanism;
- transport capabilities remain transport-owned and unchanged:

```text
backup             supported
stagedReplacement  true
replacement        atomic
```

The `atomic` guarantee here remains the established logical in-memory reference-swap guarantee only. No native filesystem, `fsync`, locking, crash-consistency, or OS rename guarantee is introduced.

---

# Aggregate Phase 5.6A Scenario Matrix

All master-plan scenarios A–J now have explicit integration evidence:

```text
A — complete source round-trip                          GREEN — 5.6A1
B — calibration-dependent material equivalence         GREEN — 5.6A2
C — yield + recipe Product equivalence                 GREEN — 5.6A2
D — nested components + ProductStock equivalence       GREEN — 5.6A2
E — financial profile missing vs explicit zero         GREEN — 5.6A1
F — Phase 4 pricing/production equivalence             GREEN — 5.6A2
G — invalid workbook preserves state                   GREEN — 5.6A3
H — unsupported future version                         GREEN — 5.6A3
I — deterministic workbook schema/row semantics        GREEN — 5.6A1
J — backup/replace failure integration                 GREEN — 5.6A3
```

Scenario ownership remains:

```text
5.6A1 -> A, E, I
5.6A2 -> B, C, D, F
5.6A3 -> G, H, J
```

---

## Final A3 Regression Gate

Feature and PR/post-merge validation remained green:

```text
131 test files passed
1,439 tests passed
5 focused A3 integration tests passed
TypeScript typecheck PASS
Production build PASS
149 modules transformed
```

The same full suite includes the completed:

- Phase 1–4 integration workflows;
- Phase 5 codec/import/export tests;
- migration/compatibility tests;
- hydration/rollback tests;
- safe-save and recovery completion suites;
- 5.5A browser import regression;
- 5.5B browser export regression;
- 5.5C persistence UX completion regression;
- 5.6A1 source round-trip scenarios;
- 5.6A2 derived-service equivalence scenarios.

---

## Completion Decision

Phase `5.6A3` is **COMPLETE**.

With A1, A2, and A3 complete and all A–J scenarios green, parent `5.6A — Integrated Excel Round-Trip Workflow` satisfies its implementation completion gate.

The next task after the parent 5.6A documentation closeout is:

```text
5.6B — Regression / Build / Phase 5 Completion — NEXT / NOT STARTED
```

The user has explicitly authorized continuation through 5.6B in the same session.

Phase 6 remains untouched.
