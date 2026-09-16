# Phase 5.4B — Backup & Atomic-Write Transport Contract

Status: **COMPLETE**

Parent:

```text
5.4 — Version Compatibility, Backup & Recovery Safety
```

Next task after this closeout is merged and exact `develop` CI is green:

```text
5.4C — Corruption, Limits & Recovery Diagnostics — NEXT / NOT STARTED
```

Do not begin 5.4C until the user separately says to proceed.

## Completed decomposition

```text
5.4B1 — Safe-Save Capability, Policy & Transaction Contract                    COMPLETE
5.4B2 — Backup + Staged-Commit In-Memory Reference Transport                   COMPLETE
5.4B3 — Failure Recovery, Coordinator Regression & Completion Gate             COMPLETE
```

## Planning baseline

```text
develop                  e35b6f04c65dbedcd0ffe7ebbe836a22e1f59065
CI                       35047386809 — SUCCESS
Planning PR #172         MERGED
Planning merge           55c06e9309f48345635bd5f5a543762a3ca8ce84
Planning post-merge CI   35048445692 — SUCCESS
```

Plan:

`docs/PHASE_5_4B_BACKUP_ATOMIC_WRITE_TRANSPORT_PLAN.md`

## 5.4B1 — COMPLETE

Completion record:

`docs/PHASE_5_4B1_SAFE_SAVE_CAPABILITY_TRANSACTION_CONTRACT.md`

B1 established the byte-only safe-save contract:

- explicit immutable transport capabilities;
- `none`, `if-supported`, and `required` backup policies;
- truthful backup outcomes;
- explicit atomic versus direct/non-atomic replacement receipts;
- safe-save failure stage/code/commit-state vocabulary;
- original failure cause preservation;
- a semantic distinction between pre-commit and post-commit cleanup failure.

Key evidence:

```text
Implementation PR #173   MERGED
Implementation merge     2ec2a75c43bef03690f0de7014d4171ba7a36ea0
Post-merge CI            35049144901 — SUCCESS
102 test files / 1219 tests
```

## 5.4B2 — COMPLETE

Completion record:

`docs/PHASE_5_4B2_BACKUP_STAGED_COMMIT_IN_MEMORY_REFERENCE_TRANSPORT.md`

B2 added the deterministic `SafeInMemoryWorkbookTransport` reference implementation while preserving the simple non-atomic `InMemoryWorkbookTransport`.

B2 proved:

- exact pre-save backup evidence;
- deterministic backup references under an injected clock;
- separate replacement staging;
- previous primary remaining authoritative until commit;
- one logical in-memory primary-reference-swap commit;
- success cleanup;
- defensive ownership of primary, staged, and backup bytes;
- deterministic fault injection for read-existing, backup, stage, commit, and cleanup.

Its reported `atomic` guarantee is explicitly logical/in-memory only and does not claim filesystem durability, rename semantics, `fsync`, locking, or crash consistency.

Key evidence:

```text
Implementation PR #175   MERGED
Implementation merge     163fa33b6dab018b938f37071920e85cf5137d72
Post-merge CI            35050167491 — SUCCESS
103 test files / 1232 tests
```

## 5.4B3 — COMPLETE

Completion record:

`docs/PHASE_5_4B3_SAFE_SAVE_RECOVERY_COMPLETION_GATE.md`

B3 completed the recovery and coordinator gate with tests only.

It proves:

- unsupported optional backup can proceed explicitly;
- unsupported required backup cannot commit replacement;
- read-existing and backup failures preserve previous primary state;
- failed backup never creates fake backup evidence;
- stage and commit failures preserve previous primary bytes;
- backups created before later failure remain exact and usable;
- staging cleanup occurs when cleanup succeeds;
- cleanup failure before commit reports `not-committed` and retains nested operation + cleanup causes;
- cleanup failure after commit reports `committed` and leaves the new primary authoritative;
- `PersistenceCoordinator` forwards options and receipts without owning transaction internals;
- transport failures remain `TRANSPORT_SAVE_FAILED` with the exact transport error retained;
- coordinator orchestration never upgrades non-atomic transport guarantees or re-exports to simulate rollback.

Key evidence:

```text
Feature head             61a9e4360cd53de0ee965123bdd60891714b79d7
Branch CI                35050876845 — SUCCESS
Implementation PR #177   MERGED
PR CI                    35050944517 — SUCCESS
Implementation merge     8100baf43351db501878286127ec1c21a87dee57
Post-merge CI            35051019882 — SUCCESS
105 test files / 1245 tests
13 focused B3 tests
132 modules transformed
```

## Final 5.4B architecture

The save-side transport boundary is now:

```text
PersistenceCoordinator
  -> canonical XLSX bytes
  -> WorkbookTransport.saveWorkbook(bytes, options)
       -> explicit capabilities
       -> explicit backup policy
       -> transport-owned backup/stage/commit/cleanup
       -> truthful receipt or structured transport failure
```

Two reference transport profiles remain intentionally available:

```text
InMemoryWorkbookTransport
  backup             unsupported
  stagedReplacement  false
  replacement        direct-non-atomic

SafeInMemoryWorkbookTransport
  backup             supported
  stagedReplacement  true
  replacement        atomic (logical in-memory only)
```

## Locked outcomes

1. `WorkbookTransport` remains byte-only.
2. Backup/stage/commit/cleanup stay in the transport boundary, not React or the coordinator.
3. Backup policy is deterministic and explicit.
4. Required backup fails closed when unsupported or when backup creation fails.
5. Backup evidence always represents exact pre-save primary bytes.
6. No-existing-primary does not create fake backup evidence.
7. Replacement bytes are owned and staged separately before commit in the safe reference transport.
8. Failures before commit preserve the previous primary workbook.
9. A post-commit cleanup failure is not represented as rollback.
10. Atomicity is an explicit transport guarantee and may not be inferred or upgraded by callers.
11. Browser/direct transports may truthfully remain non-atomic.
12. `PersistenceCoordinator` remains transport-agnostic and wraps failures without flattening them.
13. Hydration rollback remains owned by Phase 5.3B and is not mixed with save-side recovery.
14. Native filesystem durability, actual atomic rename/replace, locks, `fsync`, and crash consistency remain Phase 6 concerns.
15. Workbook corruption/resource-limit/recovery diagnostics remain 5.4C concerns.

## Parent completion gate

Phase 5.4B is complete because:

- transport capability reporting is explicit;
- backup policies and outcomes are explicit;
- safe reference backup happens before destructive commit;
- staged replacement remains separate until commit;
- pre-commit failures preserve old primary state;
- exact backup evidence survives later operation failure;
- cleanup semantics are observable and tested;
- committed-vs-uncommitted cleanup failure is preserved explicitly;
- coordinator integration is regression-proven;
- non-atomic transport truthfulness is regression-proven;
- typecheck, full tests, and production build are green.

## Next

```text
5.4C — Corruption, Limits & Recovery Diagnostics — NEXT / NOT STARTED
```

5.4C must be reassessed against the exact final green 5.4B closeout baseline before implementation. Do not start it automatically.
