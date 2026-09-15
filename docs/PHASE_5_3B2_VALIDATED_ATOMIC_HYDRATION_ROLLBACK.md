# Phase 5.3B2 — Validated Atomic Hydration + Rollback

## Status

**COMPLETE**

Parent plan:

`docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION_PLAN.md`

Authoritative implementation baseline:

```text
develop  bfc3a82ab964ed4d4c4e97256d4c9d95974a86a1
CI       35022208365 — SUCCESS
```

Implementation branch:

`feature/phase-5-3b2-validated-atomic-hydration`

Implementation PR:

`#154 — Phase 5.3B2: validated atomic hydration and rollback`

Implementation head:

`55604886406403055a06badeb7d8f5e74e155da2`

Implementation merge:

`73f1bf3b28c5632a53d8958a7517d19e0eedb195`

Post-merge develop CI:

`35033404012 — SUCCESS`

---

## Delivered application boundary

5.3B2 adds:

`src/application/persistence/ValidatedAtomicDatasetHydrationService.ts`

The service accepts one complete candidate `BusinessDataset` and owns the application-level hydration transaction without importing workbook, filesystem, React, or Tauri concerns.

The hydration flow is now:

```text
candidate BusinessDataset
        |
        v
validateBusinessDatasetIntegrity(...)
        |
   +----+----+
   |         |
 invalid    valid
   |         |
   v         v
reject     cloneBusinessDataset(...)
zero writes  |
             v
     CompleteSourceSnapshotService.snapshot()
             |
             v
     replace all nine collections
             |
       +-----+-----+
       |           |
    success      failure
       |           |
       v           v
   hydrated     rollback previous snapshot
                   |
             +-----+-----+
             |           |
          restored    rollback failed
             |           |
             v           v
 APPLY_FAILED_RESTORED  ROLLBACK_FAILED
```

---

## Complete hydration dependency contract

The service consumes the nine normal repository interfaces intersected with the persistence-only `CollectionReplacementPort<T>` established in 5.3B1:

```text
MaterialRepository
CalibrationRepository
MixPresetRepository
ProductRepository
YieldSampleRepository
FixedRecipeItemRepository
ProductComponentRepository
ProductStockRepository
ProductFinancialProfileRepository
```

This keeps ordinary business CRUD semantics separate from complete persistence restore semantics.

---

## Validation-before-write guarantee

5.3B2 reuses:

`validateBusinessDatasetIntegrity(...)`

An invalid candidate:

- returns structured dataset validation issues;
- does not capture a rollback snapshot;
- performs zero `replaceAll(...)` calls;
- leaves the live repositories unchanged.

No validation rule is duplicated inside the hydration service.

---

## Candidate ownership

A valid candidate is cloned through:

`cloneBusinessDataset(...)`

before asynchronous repository mutation begins.

This preserves the Phase 5 source-fidelity rules and prevents caller-owned arrays/objects from becoming the hydration transaction's mutable working state.

---

## Rollback snapshot

Before any live write, B2 reuses the completed 5.3A boundary:

`CompleteSourceSnapshotService.snapshot()`

The previous complete source dataset becomes the rollback evidence for that hydration attempt.

If snapshotting fails, hydration throws the controlled code:

`SNAPSHOT_FAILED`

and no replacement starts.

---

## Replacement order

Forward application and rollback both use the same explicit dependency-aware sequence:

```text
1. materials
2. materialCalibrations
3. mixPresets
4. products
5. yieldSamples
6. recipeItems
7. productComponents
8. productStocks
9. productFinancialProfiles
```

A successful hydration means all nine live authoritative source collections represent the accepted candidate.

---

## Apply failure behavior

If any repository replacement fails after mutation has begun, the service immediately applies the complete pre-hydration snapshot using the same replacement sequence.

When restoration succeeds, the service reports:

`APPLY_FAILED_RESTORED`

This means:

- hydration did not succeed;
- previous live source state was restored;
- callers do not need to parse raw repository exception text to identify the failure class.

---

## Rollback failure behavior

If forward application fails and restoring the pre-hydration snapshot also fails, the service reports:

`ROLLBACK_FAILED`

The controlled error retains both the original operation cause and rollback cause.

This is intentionally distinct from a restored apply failure because live-state certainty is no longer guaranteed.

5.3B3 / later recovery UX owns broader handling and completion proof; B2 does not pretend rollback failure is success.

---

## Focused regression coverage

Added:

`src/application/persistence/ValidatedAtomicDatasetHydrationService.test.ts`

Focused B2 tests prove:

1. invalid candidates are rejected before snapshot/write;
2. a valid complete dataset is applied through all nine repositories in dependency order;
3. pre-hydration snapshot failure prevents every write;
4. a representative mid-apply failure restores the previous complete dataset;
5. rollback failure is surfaced as the distinct severe `ROLLBACK_FAILED` diagnostic.

The exhaustive per-repository failure-boundary matrix and already-wired session-service observation test remain intentionally assigned to 5.3B3.

---

## Validation evidence

```text
Feature head                 55604886406403055a06badeb7d8f5e74e155da2
Implementation PR #154       MERGED
PR CI                        35033331003 — SUCCESS
Implementation merge         73f1bf3b28c5632a53d8958a7517d19e0eedb195
Post-merge develop CI        35033404012 — SUCCESS
Test files                   90 passed
Tests                        1110 passed
Focused 5.3B2 tests          5 passed
TypeScript typecheck         SUCCESS
Production Vite build        SUCCESS
Modules transformed          119
```

---

## Scope boundaries preserved

5.3B2 did **not**:

- wire the hydration service into `src/application/session.ts`;
- perform the exhaustive nine-boundary fault-injection completion matrix;
- add user-facing import/recovery UI;
- parse or encode XLSX;
- implement persistence load/save orchestration;
- implement filesystem backup or atomic file replacement;
- add Tauri filesystem/dialog behavior.

Those remain assigned to 5.3B3, 5.3C, 5.4, 5.5, and Phase 6 according to the parent plan.

---

## Completion gate

```text
Validation before any write                         YES
Hydration-owned complete candidate                  YES
Pre-hydration complete rollback snapshot            YES
All nine replacement calls coordinated              YES
Deterministic dependency-aware apply order          YES
Automatic rollback after apply failure              YES
Restored apply failure diagnostic                   YES
Distinct rollback-failure diagnostic                YES
Focused regression coverage                         YES
Full test suite                                     PASS
Typecheck                                           PASS
Production build                                    PASS
```

**Phase 5.3B2 is COMPLETE.**

Next task:

**5.3B3 — Session Integration, Fault Injection & Completion Gate — NEXT / NOT STARTED**

Do not begin 5.3B3 automatically as part of this closeout.
