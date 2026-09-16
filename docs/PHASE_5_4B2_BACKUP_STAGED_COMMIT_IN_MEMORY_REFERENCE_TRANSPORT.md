# Phase 5.4B2 — Backup + Staged-Commit In-Memory Reference Transport

Status: **COMPLETE**

Parent:

```text
5.4B — Backup & Atomic-Write Transport Contract
```

Next task after this closeout is merged and exact `develop` CI is green:

```text
5.4B3 — Failure Recovery, Coordinator Regression & Completion Gate — NEXT / NOT STARTED
```

Do not begin 5.4B3 until the user separately says to proceed.

## Authoritative baseline

```text
develop  bae01571e707b820d90f5ed182c938e7a152899d
CI       35049365565 — SUCCESS
```

Feature branch:

```text
feature/phase-5-4b2-in-memory-safe-save-transport
```

Feature head:

```text
89b5f1bc49d00cfbe14bc26dc224381a019ff6a8
```

Implementation PR:

```text
#175 — Phase 5.4B2: backup and staged-commit in-memory reference transport
```

Implementation merge:

```text
163fa33b6dab018b938f37071920e85cf5137d72
```

Post-merge `develop` CI:

```text
35050167491 — SUCCESS
```

## Split reassessment

B2 was reassessed against the exact green B1 closeout baseline and did **not** require a deeper split.

The repository already had the B1 byte-only safe-save contract, so B2 remained one cohesive reference-transport implementation unit: backup evidence, deterministic staging, logical commit, cleanup, diagnostics, and fault injection.

A dedicated `SafeInMemoryWorkbookTransport` was chosen instead of changing the existing `InMemoryWorkbookTransport`.

This preserves two intentionally different transport profiles:

```text
InMemoryWorkbookTransport
  backup             unsupported
  stagedReplacement  false
  replacement        direct-non-atomic

SafeInMemoryWorkbookTransport
  backup             supported
  stagedReplacement  true
  replacement        atomic   (logical in-memory guarantee only)
```

The simple transport therefore remains a useful non-atomic compatibility/reference baseline for B3.

## Delivered implementation

### Dedicated safe in-memory reference transport

Added:

```text
src/storage/SafeInMemoryWorkbookTransport.ts
src/storage/SafeInMemoryWorkbookTransport.test.ts
```

No existing transport or persistence coordinator production file was modified.

### Exact safe-save ordering

`SafeInMemoryWorkbookTransport.saveWorkbook(...)` models this lifecycle:

```text
1. defensively own/copy caller replacement bytes
2. inspect existing primary bytes
3. satisfy backup policy
4. stage replacement bytes separately from primary
5. commit staged bytes with one primary-reference swap
6. clean the staging artifact
7. return a truthful transport receipt
```

The old primary remains authoritative until the commit reference swap.

### Backup policy behavior

The B1 policies are implemented as follows:

```text
none
  -> no backup attempt
  -> backup receipt: not-requested

if-supported
  -> backup existing primary when present
  -> no-existing primary: not-needed / no-existing-workbook

required
  -> backup existing primary before replacement when present
  -> no-existing primary: not-needed / no-existing-workbook
```

Because this reference transport truthfully advertises backup support, both `if-supported` and `required` can create backup evidence when a previous primary exists.

No-existing-primary does not create fake backup bytes.

### Exact pre-save backup evidence

Backup artifacts are exact defensive copies of the previous primary bytes.

Backup references are deterministic under an injected clock and sequence counter:

```text
memory://safe-backup/<ISO timestamp>/<sequence>
```

Example:

```text
memory://safe-backup/2026-09-16T04:00:00.000Z/0001
```

The sequence suffix keeps references unique even when the injected clock returns the same timestamp repeatedly.

Backup bytes remain independent from later primary saves and from caller mutations.

### Staged replacement

Replacement bytes are copied into dedicated staging state before commit.

The reference transport exposes test/reference-only diagnostics:

```text
listBackupReferences()
loadBackup(reference)
peekStagedWorkbook()
```

These diagnostics return owned/defensive values and do not extend the generic `WorkbookTransport` application contract.

Tests prove that immediately before commit:

```text
primary = previous workbook
staged  = replacement workbook
```

so staged bytes are not authoritative early.

### Logical atomic commit

Commit is modeled as one in-memory primary-reference swap after staging succeeds.

The successful receipt truthfully reports:

```text
replacement.guarantee = atomic
```

This is only a **logical in-memory atomic guarantee**.

It does **not** claim:

- native filesystem rename atomicity;
- disk durability;
- `fsync` semantics;
- file locking;
- crash consistency;
- operating-system replacement behavior.

Those guarantees remain Phase 6 native transport responsibilities.

### Staging cleanup

Normal successful saves clear staging state after commit.

A representative pre-commit commit failure also proves:

- the previous primary remains unchanged;
- staged replacement is not exposed as primary;
- staging cleanup is attempted and succeeds under the normal cleanup path.

The exhaustive failure/recovery matrix remains B3 scope.

### Deterministic fault-injection seam

The reference transport accepts a test/reference-only fault injector for:

```text
read-existing
backup
stage
commit
cleanup
```

This keeps failure behavior deterministic and provides the seam required for B3 without introducing fault controls into application business APIs.

The B2 implementation only uses representative fault testing; B3 owns the complete failure/recovery and coordinator regression matrix.

### Defensive byte ownership

B2 proves defensive ownership across:

- constructor initial bytes;
- caller replacement bytes;
- primary load results;
- staged diagnostic views;
- retained backup bytes;
- backup load results.

Caller mutation cannot change authoritative transport state after bytes cross the boundary.

## Validation evidence

Feature branch gate:

```text
Feature head            89b5f1bc49d00cfbe14bc26dc224381a019ff6a8
Branch CI               35050007808 — SUCCESS
Test files              103 passed
Tests                   1232 passed
Focused B2 tests        13 passed
TypeScript typecheck    PASS
Production Vite build   PASS
Modules transformed     132
```

Implementation PR gate:

```text
Implementation PR #175  MERGED
PR CI                   35050081527 — SUCCESS
```

Post-merge gate:

```text
develop                  163fa33b6dab018b938f37071920e85cf5137d72
CI                       35050167491 — SUCCESS
```

The existing Vite large-chunk warning and GitHub Actions Node deprecation warnings remain informational and unrelated to B2.

## B2 completion gate

Phase 5.4B2 is complete because the reference transport now proves:

- executable safe-save ordering;
- exact backup-before-commit behavior;
- deterministic backup evidence;
- no fake backup for an empty primary;
- defensive byte ownership;
- staged replacement isolation;
- logical in-memory atomic commit;
- successful staging cleanup;
- truthful save receipts;
- deterministic failure injection for B3;
- preservation of the previous primary on a representative pre-commit commit failure;
- no native filesystem API or native durability claim.

## Out of scope preserved

B2 does not implement:

- `PersistenceCoordinator` failure regression beyond existing full-suite coverage;
- exhaustive backup/stage/commit/cleanup fault recovery cases;
- browser/non-atomic coordinator truthfulness regression;
- Tauri filesystem/dialog APIs;
- real file backup paths;
- native rename/replace/fsync/locking behavior;
- workbook corruption/resource-limit diagnostics;
- UI persistence behavior.

These remain B3, 5.4C, Phase 5.5, or Phase 6 responsibilities as defined by the parent plan.

## Next

```text
5.4B3 — Failure Recovery, Coordinator Regression & Completion Gate — NEXT / NOT STARTED
```

B3 must be reassessed against the exact green post-closeout `develop` baseline before implementation, and it must not begin until the user separately says to proceed.
