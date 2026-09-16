# Phase 5.4B3 — Failure Recovery, Coordinator Regression & Completion Gate

Status: **COMPLETE**

Parent:

```text
5.4B — Backup & Atomic-Write Transport Contract
```

Next task after the B3 + parent 5.4B closeout is merged and exact `develop` CI is green:

```text
5.4C — Corruption, Limits & Recovery Diagnostics — NEXT / NOT STARTED
```

Do not begin 5.4C until the user separately says to proceed.

## Authoritative baseline

```text
develop  d47038ffbe3182a465233bb7d9cb5eabb25d3a31
CI       35050455351 — SUCCESS
```

Feature branch:

```text
feature/phase-5-4b3-safe-save-recovery-completion-gate
```

Feature head:

```text
61a9e4360cd53de0ee965123bdd60891714b79d7
```

Implementation PR:

```text
#177 — Phase 5.4B3: safe-save recovery and completion gate
```

Implementation merge:

```text
8100baf43351db501878286127ec1c21a87dee57
```

Post-merge `develop` CI:

```text
35051019882 — SUCCESS
```

## Split reassessment

B3 was reassessed against the exact green B2 closeout baseline and did **not** require a deeper split.

B1 already defined safe-save capability/policy/error semantics and B2 already supplied deterministic backup, staging, commit, cleanup, and fault-injection mechanics. B3 therefore remained a regression/completion-gate task.

The implementation introduced **tests only**. No production transport, coordinator, workbook, repository, hydration, UI, or native filesystem code changed.

## Added completion coverage

Added:

```text
src/storage/SafeInMemoryWorkbookTransportRecoveryCompletion.test.ts
src/application/persistence/PersistenceSafeSaveCompletion.test.ts
```

### Backup-policy recovery

B3 proves:

- unsupported `if-supported` backup may proceed with an explicit `unsupported` receipt;
- unsupported `required` backup fails before replacement commit;
- backup creation failure preserves the previous primary;
- backup creation failure creates no fake backup artifact;
- no staging artifact is introduced when failure occurs before staging.

### Read-existing failure

A deterministic `read-existing` fault proves:

- `READ_EXISTING_FAILED` is reported with `commitState: not-committed`;
- previous primary bytes remain authoritative;
- no backup or staging evidence is created.

### Staging failure

A deterministic stage fault after a required backup proves:

- exact previous primary bytes remain authoritative;
- the already-created backup remains a valid exact copy of the previous primary;
- staging cleanup is attempted;
- staging is removed when cleanup succeeds;
- the failure remains `STAGE_FAILED / not-committed`.

### Commit failure

A deterministic commit fault proves:

- exact previous primary bytes remain authoritative;
- staged replacement never becomes authoritative;
- a previously created backup remains usable;
- cleanup is attempted;
- staging is removed when cleanup succeeds;
- the failure remains `COMMIT_FAILED / not-committed`.

### Cleanup failure before commit

B3 separately proves the severe combined case where an operation fails before commit and cleanup also fails.

The resulting `WorkbookTransportSaveError` is:

```text
stage        cleanup
code         CLEANUP_FAILED
commitState  not-committed
```

Its cause context retains both:

- the original pre-commit operation error; and
- the cleanup failure cause.

The previous primary remains authoritative. The staging artifact may remain because cleanup itself failed, which is represented explicitly instead of being hidden.

### Cleanup failure after commit

B3 also proves the distinct post-commit cleanup case.

The resulting error is:

```text
stage        cleanup
code         CLEANUP_FAILED
commitState  committed
```

The new primary remains authoritative even though cleanup failed. The exact pre-save backup remains available.

This prevents callers from falsely treating post-commit cleanup failure as though replacement definitely rolled back.

## Coordinator regression gate

Through `PersistenceCoordinator.saveCurrentWorkbook(...)`, B3 proves:

- safe-save options are passed to the transport unchanged;
- successful transport receipts are propagated unchanged;
- safe/atomic receipts stay atomic only when the transport reports atomic capability;
- direct/non-atomic transport receipts remain direct/non-atomic and are never upgraded by the coordinator;
- transport save errors become `TRANSPORT_SAVE_FAILED`;
- the exact underlying `WorkbookTransportSaveError` remains in `causeValue`;
- `commitState: committed` survives coordinator wrapping for post-commit cleanup failure;
- failed save orchestration never returns `{ status: 'saved' }`;
- source snapshot/export is not repeated to simulate transport rollback;
- transport rollback/recovery remains a transport concern rather than a coordinator concern.

## Validation evidence

Feature branch gate:

```text
Feature head            61a9e4360cd53de0ee965123bdd60891714b79d7
Branch CI               35050876845 — SUCCESS
Test files              105 passed
Tests                   1245 passed
Focused B3 tests        13 passed
  storage recovery       8
  coordinator completion 5
TypeScript typecheck    PASS
Production Vite build   PASS
Modules transformed     132
```

Implementation PR gate:

```text
Implementation PR #177  MERGED
PR CI                   35050944517 — SUCCESS
```

Post-merge gate:

```text
develop                 8100baf43351db501878286127ec1c21a87dee57
CI                      35051019882 — SUCCESS
```

## B3 completion gate

5.4B3 is complete because the repository now proves:

- explicit backup capability/policy behavior;
- backup-before-destructive-commit ordering;
- exact pre-save backup evidence;
- separate replacement staging;
- preservation of old primary on failures before commit;
- deterministic recovery behavior for read, backup, stage, commit, and cleanup failures;
- separate semantics for pre-commit and post-commit cleanup failure;
- coordinator propagation without flattening or false success;
- truthful non-atomic behavior for the simple transport;
- full repository typecheck, tests, and production build remain green.

No production/runtime change was required by B3.

## Next

The parent `5.4B — Backup & Atomic-Write Transport Contract` can now be closed.

After the docs-only B3 + parent closeout is merged and the exact resulting `develop` CI is green, advance exactly to:

```text
5.4C — Corruption, Limits & Recovery Diagnostics — NEXT / NOT STARTED
```

Do not begin 5.4C automatically.
