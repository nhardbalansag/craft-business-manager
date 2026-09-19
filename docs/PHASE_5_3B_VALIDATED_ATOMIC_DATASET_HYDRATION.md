# Phase 5.3B — Validated Atomic Dataset Hydration

Status: **COMPLETE**

Parent phase:

`5.3 — Snapshot, Hydration & Persistence Coordination`

Planning document:

`docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION_PLAN.md`

Completed implementation sequence:

```text
5.3B1 — Hydration Replacement Port & Repository Bulk Replace   COMPLETE
5.3B2 — Validated Atomic Hydration + Rollback                  COMPLETE
5.3B3 — Session Integration, Fault Injection & Completion Gate COMPLETE
```

## Objective

Phase 5.3B establishes a safe application-level boundary that replaces the complete authoritative live source dataset from a validated `BusinessDataset` without replaying ordinary business CRUD workflows.

The completed hydration flow is:

```text
candidate BusinessDataset
        |
        v
validate complete dataset integrity
        |
        v
clone hydration-owned candidate
        |
        v
snapshot current live source state
        |
        v
replace all nine authoritative collections
        |
        +------------------------------+
        |                              |
        v                              v
     success                       apply failure
                                       |
                                       v
                           restore pre-hydration snapshot
                                       |
                         +-------------+-------------+
                         |                           |
                         v                           v
              APPLY_FAILED_RESTORED          ROLLBACK_FAILED
```

The candidate is always complete replacement state. Hydration is not a patch, merge, or incremental import operation.

---

## Planning evidence

Phase 5.3B was deliberately split before implementation because repository CRUD interfaces could not safely express complete multi-repository replacement.

```text
Planning PR                 #151 — MERGED
Planning closeout develop   3552385ed84deab2500b69cf9e8fbd1538bde1a0
Planning closeout CI        35020396594 — SUCCESS
```

The split established three responsibilities:

1. B1 — repository-level whole-collection replacement primitives;
2. B2 — application-level validation, apply, rollback, and diagnostics;
3. B3 — shared-session integration, exhaustive failure injection, source-fidelity proof, and parent completion gate.

---

# 5.3B1 — Hydration Replacement Port & Repository Bulk Replace

Status: **COMPLETE**

Completion record:

`docs/PHASE_5_3B1_HYDRATION_REPLACEMENT_PORT_BULK_REPLACE.md`

Validation evidence:

```text
Feature head               74e70a22b2a8b24cd1cb49f44f37502a1555b53b
Feature CI                 35021376680 — SUCCESS
Implementation PR          #152 — MERGED
PR CI                      35021553326 — SUCCESS
Implementation merge       6abd24123c3593582fdc4767bd486b319fc2ce2c
Post-merge develop CI      35021692593 — SUCCESS
Regression                 89 test files / 1105 tests
Focused B1 tests           9
Production build           PASS — 119 modules transformed
```

Delivered:

- generic persistence-only `CollectionReplacementPort<T>`;
- `replaceAll(...)` implementation across all nine authoritative in-memory repositories;
- fully staged cloned next-state maps before live swap;
- complete stale-record removal;
- valid empty-collection clearing;
- defensive ownership of nested source records;
- preserved repository object identity;
- pre-swap preparation failure safety;
- no replay of business CRUD workflows;
- no derived-output persistence or recalculation inside replacement primitives.

The nine replacement collections are:

```text
materials
material calibrations
mix presets
products
yield samples
fixed recipe items
product components
product stocks
product financial profiles
```

---

# 5.3B2 — Validated Atomic Hydration + Rollback

Status: **COMPLETE**

Completion record:

`docs/PHASE_5_3B2_VALIDATED_ATOMIC_HYDRATION_ROLLBACK.md`

Validation evidence:

```text
Feature head               55604886406403055a06badeb7d8f5e74e155da2
Implementation PR          #154 — MERGED
PR CI                      35033331003 — SUCCESS
Implementation merge       73f1bf3b28c5632a53d8958a7517d19e0eedb195
Post-merge develop CI      35033404012 — SUCCESS
Regression                 90 test files / 1110 tests
Focused B2 tests           5
Production build           PASS — 119 modules transformed
```

Delivered `ValidatedAtomicDatasetHydrationService` with these locked guarantees:

- calls `validateBusinessDatasetIntegrity(...)` before any live write;
- rejects invalid candidates without repository mutation;
- clones accepted candidates through the established `BusinessDataset` clone boundary;
- reuses `CompleteSourceSnapshotService` to capture pre-hydration rollback evidence;
- applies all nine whole-collection replacements through one explicit application-level sequence;
- automatically restores the previous complete dataset after forward-apply failure;
- returns success only after the complete apply sequence succeeds;
- distinguishes operational failures using controlled diagnostics.

Operational diagnostics:

```text
SNAPSHOT_FAILED
APPLY_FAILED_RESTORED
ROLLBACK_FAILED
```

`ROLLBACK_FAILED` remains a severe result and retains both the original apply cause and rollback cause. It is never reported as successful hydration.

---

# 5.3B3 — Session Integration, Fault Injection & Completion Gate

Status: **COMPLETE**

Implementation branch:

`feature/phase-5-3b3-session-fault-injection`

Authoritative B3 baseline:

```text
develop  7ff9d51b0965add105e1c58943a2852f61d11145
CI       35033683723 — SUCCESS
```

Implementation PR:

`#156 — Phase 5.3B3: session integration and hydration completion gate`

Final feature head:

`929f09049d9e24857ee2389688e8a64d9e24a70c`

Final PR CI:

`35034176226 — SUCCESS`

Implementation merge:

`50d0ae082095e4c3f397bee5a8b8d276ace93a26`

Post-merge develop CI:

`35034304286 — SUCCESS`

Final B3 regression evidence:

```text
91 test files passed
1128 tests passed
18 focused B3 completion tests passed
TypeScript typecheck passed
Production Vite build passed
121 modules transformed
```

## Shared-session integration

`src/application/session.ts` now exports one shared:

`validatedAtomicDatasetHydrationService`

It is composed from the same nine repository objects already used by the rest of the application plus the existing `completeSourceSnapshotService`.

Hydration does not replace repository objects. Existing services therefore continue to hold valid references before and after dataset replacement.

A dedicated regression test constructs an application service before hydration and proves that the same service instance observes the newly hydrated data afterward.

## Exhaustive forward fault injection

B3 injects controlled apply failures at every repository boundary:

```text
1. materials
2. material calibrations
3. mix presets
4. products
5. yield samples
6. recipe items
7. product components
8. product stocks
9. product financial profiles
```

For every boundary, the test proves:

- hydration does not report success;
- rollback runs;
- the exact complete pre-hydration snapshot is restored;
- the failure is surfaced as `APPLY_FAILED_RESTORED` when restoration succeeds.

## Snapshot and rollback failure proof

B3 also proves:

- invalid dataset rejection performs zero replacement writes;
- snapshot failure occurs before mutation and performs zero replacement writes;
- rollback failure is surfaced as `ROLLBACK_FAILED`;
- both forward apply cause and rollback cause remain available to diagnostics.

## Complete replacement proof

Successful hydration proves:

- all nine collections are replaced;
- stale records from the previous live state are removed;
- a valid empty `BusinessDataset` clears all nine repositories;
- post-hydration snapshot matches the candidate source state.

## Source-fidelity proof

B3 explicitly verifies that persistence semantics remain source-faithful:

- missing ProductStock evidence remains missing;
- explicit ProductStock `0` remains an explicit persisted row;
- missing ProductFinancialProfile evidence remains missing;
- explicit zero labor/overhead values remain zero;
- `pricingPolicy: null` remains explicit null;
- optional Material source metadata remains absent when absent;
- nested source structures remain defensively owned.

During the first B3 CI iteration, the new fidelity test correctly detected that `cloneMaterial(...)` synthesized an own property `source: undefined` for materials whose `source` field was absent.

The clone helper was corrected so absent source metadata remains truly absent while present source metadata is still deep-cloned.

Corrective CI history:

```text
Initial B3 head            b7e207f714172e690d787b3f46f3902be6817cd9
Initial branch CI          35034071494 — FAILURE
Reason                     optional source absence fidelity assertion
Corrected B3 head          929f09049d9e24857ee2389688e8a64d9e24a70c
Corrected PR CI            35034176226 — SUCCESS
```

The failing assertion was not weakened; the source clone boundary was corrected to satisfy the locked persistence contract.

## UI/application-boundary verification

The Phase 5.3B completion review verified that the React UI continues to operate through application services from `src/application/session.ts`.

Top-level UI pages use services such as:

```text
materialService
calibrationService
mixPresetService
productService
yieldHistoryService
yieldSampleEvidenceService
productionRequirementService
plannedBatchCapacityFeasibilityService
productFinancialProfileService
productPricingQuoteService
```

Product component and stock editing likewise use `productComponentService` and `productStockService`.

No persistence replacement port is exposed as a UI editing primitive. The atomic hydration boundary remains an application-level persistence concern for later load/save orchestration.

---

# Parent 5.3B completion gate

All required gates are satisfied.

| Gate | Result |
| --- | --- |
| Candidate is treated as complete replacement state | YES |
| Complete dataset validated before writes | YES |
| Invalid candidate causes zero live writes | YES |
| Candidate source data defensively cloned | YES |
| Pre-hydration live snapshot captured | YES |
| All nine repositories support whole-collection replacement | YES |
| Stale rows removed during successful hydration | YES |
| Empty dataset clears all nine repositories | YES |
| Forward failure at each repository boundary is tested | YES |
| Successful rollback restores exact previous dataset | YES |
| Rollback failure is distinct and retains context | YES |
| Missing versus explicit zero/null semantics preserved | YES |
| Optional Material source absence preserved | YES |
| Repository object identity preserved | YES |
| Already-wired services observe hydrated state | YES |
| Shared session exports hydration service | YES |
| UI continues through application services | YES |
| TypeScript typecheck passes | YES |
| Full regression suite passes | YES |
| Production build passes | YES |

Therefore:

**Phase 5.3B — Validated Atomic Dataset Hydration is COMPLETE.**

---

# Persistence boundary after Phase 5.3B

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE
Dataset -> XLSX export                COMPLETE
XLSX -> dataset reconstruction        COMPLETE
Repository snapshot service           COMPLETE — 5.3A
Repository bulk replacement primitive COMPLETE — 5.3B1
Validated atomic hydration/rollback   COMPLETE — 5.3B2
Hydration session completion gate     COMPLETE — 5.3B3
Persistence coordinator/load-save     NEXT / NOT STARTED — 5.3C
ExcelStorage.load/save                placeholder
Native filesystem                     Phase 6
```

# Next task

**5.3C — Persistence Coordinator / Load-Save Lifecycle — NEXT / NOT STARTED**

Phase 5.3C must not be started as part of this closeout. It owns the orchestration that composes the already completed snapshot, workbook export/import, validation, and atomic hydration boundaries into load/save lifecycle behavior.
