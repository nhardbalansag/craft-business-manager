# Phase 5.4B — Backup & Atomic-Write Transport Contract Plan

Status: **PLANNING ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning baseline:

```text
develop  e35b6f04c65dbedcd0ffe7ebbe836a22e1f59065
CI       35047386809 — SUCCESS
```

Parent phase:

```text
5.4 — Version Compatibility, Backup & Recovery Safety
```

Previous completed boundary:

```text
5.4A — Schema Migration & Compatibility Framework — COMPLETE
```

## Purpose

Phase 5.4B defines and proves the byte-transport semantics required to replace an existing workbook safely without moving workbook schema, business validation, repository mutation, or native filesystem behavior into the transport layer.

The target lifecycle is conceptually:

```text
new XLSX bytes
  -> inspect target capability/current state
  -> optionally preserve current bytes as backup
  -> stage owned replacement bytes
  -> commit replacement
       ├── atomic where the transport truthfully supports atomic replacement
       └── explicitly non-atomic/direct where it does not
  -> cleanup temporary staging artifacts
  -> controlled save receipt / controlled failure
```

Phase 5 tests these semantics with memory/fake transports. Concrete Tauri filesystem operations remain Phase 6.

---

# Repository audit findings

## Existing transport contract

`src/storage/WorkbookTransport.ts` currently provides a deliberately small byte-only boundary:

```ts
export type WorkbookBackupRequest = 'none' | 'if-supported';

export interface WorkbookSaveOptions {
  readonly backup?: WorkbookBackupRequest;
}

export type WorkbookBackupReceipt =
  | { readonly status: 'not-requested' }
  | { readonly status: 'unsupported' }
  | { readonly status: 'created'; readonly reference: string };

export interface WorkbookSaveReceipt {
  readonly reference?: string;
  readonly backup: WorkbookBackupReceipt;
}

export interface WorkbookTransport {
  loadWorkbook(): Promise<Uint8Array>;
  saveWorkbook(bytes: Uint8Array, options?: WorkbookSaveOptions): Promise<WorkbookSaveReceipt>;
}
```

This contract correctly keeps `BusinessDataset`, workbook sheets, validation, hydration, React, and filesystem paths out of the transport.

However, it cannot yet describe:

- whether backup is actually supported;
- whether replacement is staged;
- whether commit is atomic or direct/non-atomic;
- whether a requested backup was unnecessary because no previous workbook existed;
- a required-backup policy;
- the stage at which a safe-save operation failed;
- cleanup/recovery state.

## Existing in-memory transport

`src/storage/InMemoryWorkbookTransport.ts` currently:

- owns bytes defensively;
- supports load/save;
- reports backup requests as `unsupported`;
- replaces its primary bytes directly;
- has no staged-commit model;
- has no backup artifact/history;
- has no deterministic fault-injection seam.

That behavior was intentionally left minimal by Phase 5.3C1 so 5.4B could own safe replacement semantics.

## Existing coordinator behavior

`PersistenceCoordinator.saveCurrentWorkbook(...)` already:

- exports canonical XLSX bytes before transport mutation;
- passes `WorkbookSaveOptions` to the transport;
- treats a thrown transport save as `TRANSPORT_SAVE_FAILED`;
- preserves the original thrown transport cause in the lifecycle error;
- returns the transport receipt unchanged on success.

Therefore 5.4B should evolve the transport contract and safe-save reference implementation without moving the backup/stage/commit algorithm into `PersistenceCoordinator`.

## Native filesystem remains out of scope

The repository has no authoritative native filesystem transport yet. Phase 5 must not claim `fsync`, rename atomicity, filesystem durability, path locking, or OS-specific replacement guarantees it cannot prove.

The Phase 5 reference implementation can prove transaction ordering and state preservation in memory. Phase 6 will map the same contract onto concrete Tauri filesystem APIs and platform guarantees.

---

# Split assessment

5.4B is too broad for one implementation PR because it combines three materially different concerns:

1. public transport capability/policy/error contracts;
2. a deterministic reference implementation of backup + staging + commit;
3. fault-injection and recovery regression proving destructive-save safety.

It is therefore formally split into three children:

```text
5.4B
├── 5.4B1 — Safe-Save Capability, Policy & Transaction Contract
├── 5.4B2 — Backup + Staged-Commit In-Memory Reference Transport
└── 5.4B3 — Failure Recovery, Coordinator Regression & Completion Gate
```

No deeper split is planned initially. Each child must still be reassessed against the exact repository baseline before implementation.

---

# 5.4B1 — Safe-Save Capability, Policy & Transaction Contract

Status: **NEXT / NOT STARTED**

Planned branch:

```text
feature/phase-5-4b1-safe-save-transport-contract
```

## Purpose

Make transport guarantees and backup policy explicit before implementing a safe replacement algorithm.

## Planned work

### 1. Preserve byte-only ownership

`WorkbookTransport` remains a byte transport.

It must not gain knowledge of:

- `BusinessDataset`;
- workbook sheet/schema contracts;
- import/export validation;
- repository/hydration services;
- React/UI;
- native filesystem implementation details.

### 2. Explicit capability vocabulary

Add a transport-level capability description sufficient to truthfully distinguish at least:

- backup/copy support;
- staged replacement support;
- atomic replacement support versus direct/non-atomic replacement.

The exact TypeScript shape may be refined during implementation, but capability reporting must be deterministic and must not infer atomicity from transport type names.

A browser/download-oriented transport must be able to report that native atomic replacement is unavailable.

### 3. Backup policy

Retain the current meanings:

```text
none          -> do not attempt backup
if-supported  -> create backup when the transport supports it; unsupported is allowed
```

Add a required-backup policy only at this transport boundary:

```text
required      -> replacement may not proceed unless backup support exists and backup creation succeeds
```

Locked behavior:

- unsupported `if-supported` backup may continue with an explicit unsupported receipt;
- unsupported `required` backup fails before replacement staging/commit;
- if the transport claims backup support and an attempted backup fails, save fails before replacement commit;
- no existing primary workbook is distinct from backup failure and should produce an explicit no-existing-source/not-needed outcome rather than a fake backup artifact.

### 4. Replacement/commit receipt

A successful save receipt must expose the replacement guarantee actually delivered, such as atomic versus direct/non-atomic.

The contract must make it impossible for browser/fake transports to silently imply native atomic replacement.

### 5. Controlled transport-save failure vocabulary

Introduce a storage-level safe-save error/context capable of distinguishing failure locations needed by B2/B3, including at least:

```text
capability / required-backup precondition
read-existing
backup
stage
commit
cleanup
```

The exact public codes may be refined during implementation.

Original causes should remain available where applicable so `PersistenceCoordinator` can continue wrapping the transport error without flattening it.

### 6. Cleanup semantics

Lock the semantic distinction between:

- failure before commit, where the previous primary workbook must remain authoritative;
- successful commit, where the new primary is authoritative even if later temporary-artifact cleanup reports a problem.

A post-commit cleanup problem must not be represented as though the replacement definitely never occurred. The contract/receipt/error vocabulary must preserve that distinction.

### 7. Compatibility with existing coordinator

Prefer keeping:

```ts
saveWorkbook(bytes, options)
```

as the orchestration call so `PersistenceCoordinator` remains unaware of backup/staging internals.

Any contract evolution must preserve existing no-backup save behavior and defensive byte ownership.

## B1 test matrix

At minimum prove:

- capability reporting is explicit and immutable/defensively owned where needed;
- no-backup default remains deterministic;
- `if-supported` and `required` are distinct policies;
- unsupported optional backup is not a failure;
- unsupported required backup is a pre-commit failure;
- save receipts cannot claim atomic replacement when the transport capability is non-atomic;
- transport-stage errors retain stage/code/cause context;
- no business/workbook/hydration behavior enters the transport contract.

## B1 completion gate

- safe-save capability vocabulary is stable;
- backup policy is explicit;
- actual replacement guarantee is visible in success receipts;
- pre-commit versus post-commit failure meaning is explicit;
- existing coordinator API remains transport-agnostic;
- no native filesystem behavior is implemented.

---

# 5.4B2 — Backup + Staged-Commit In-Memory Reference Transport

Status: **NOT STARTED**

Planned branch:

```text
feature/phase-5-4b2-in-memory-safe-save-transport
```

## Purpose

Implement one deterministic memory/reference transport that proves the B1 safe-save ordering independently of Tauri/native filesystem APIs.

## Planned work

### 1. Safe replacement sequence

The reference transport must model this exact logical ordering when replacement is requested:

```text
1. own/copy caller bytes
2. inspect/read existing primary bytes when present
3. satisfy backup policy
4. stage replacement bytes separately from primary bytes
5. commit staged bytes as the new primary
6. cleanup the staging artifact
7. return a truthful receipt
```

No step may expose caller-owned mutable bytes as authoritative transport state.

### 2. Timestamped backup artifact

When backup is requested, supported, and a previous primary exists:

- create an exact defensive copy of the pre-save primary bytes;
- give it a deterministic timestamp/reference using an injected/testable clock or explicit timestamp source;
- never back up the newly staged bytes by mistake;
- retain backup bytes independently from later primary changes.

The timestamp/reference is transport evidence, not business/workbook metadata.

### 3. Logical atomic commit

The memory/reference transport may truthfully advertise logical atomic replacement because commit can be modeled as one primary-reference swap after staging succeeds.

This proves transaction ordering only. Documentation/tests must explicitly state that it does not prove native filesystem durability or OS rename semantics.

### 4. No-existing-primary case

Saving into an empty transport:

- must not invent backup bytes;
- must report an explicit no-existing-source/not-needed backup outcome when backup was requested;
- may still stage and commit the new workbook.

### 5. Staging cleanup

After a normal success, no temporary staged artifact remains.

After a pre-commit failure, cleanup is attempted and the original primary remains authoritative.

### 6. Deterministic fault-injection seam

Provide a test/reference-only way to fail at controlled lifecycle points without introducing nondeterministic behavior.

Expected injectable points include at least:

```text
read-existing
backup
stage
commit
cleanup
```

Fault injection must not be part of application business APIs.

### 7. Preserve simple transport use

Assess whether the current `InMemoryWorkbookTransport` should evolve into this reference implementation or whether a dedicated safe/transactional in-memory transport produces a cleaner compatibility boundary.

Whichever implementation is chosen, existing Phase 5.3C behavior must remain green.

## B2 test matrix

At minimum prove:

- first save with no prior workbook;
- overwrite with no backup requested;
- overwrite with `if-supported` backup;
- overwrite with `required` backup;
- backup bytes equal exact pre-save primary bytes;
- backup reference/timestamp deterministic under injected clock;
- staged bytes are not visible as primary before commit;
- successful commit exposes only new primary bytes;
- returned/load/backup bytes are defensively owned;
- staging artifact is cleaned after normal success;
- logical atomic guarantee is reported truthfully.

## B2 completion gate

- the safe-save sequence is executable and observable in memory;
- backup-before-commit ordering is proven;
- staging keeps replacement bytes separate until commit;
- success cleanup is proven;
- receipts truthfully report backup and replacement outcomes;
- no native filesystem API is introduced.

---

# 5.4B3 — Failure Recovery, Coordinator Regression & Completion Gate

Status: **NOT STARTED**

Planned branch:

```text
feature/phase-5-4b3-safe-save-recovery-completion-gate
```

## Purpose

Prove that every destructive-save failure path preserves the strongest recoverable state promised by the transport contract and that application-level save orchestration never reports transport failure as successful persistence.

## Required regression coverage

### Backup-policy failures

Prove:

- optional backup unsupported -> save may proceed with explicit unsupported receipt;
- required backup unsupported -> zero replacement commit;
- backup creation failure -> zero replacement commit;
- failed backup never produces a fake `created` receipt.

### Staging failures

Prove:

- staging failure preserves exact previous primary bytes;
- a backup already created before staging failure remains a valid copy of previous primary bytes;
- temporary staging state is cleaned when cleanup succeeds.

### Commit failures

Prove:

- commit failure preserves exact previous primary bytes;
- staged replacement is not exposed as authoritative primary;
- existing backup remains usable when one was created;
- cleanup is attempted.

### Cleanup failures

Prove separately:

- cleanup failure after a pre-commit failure does not alter the preserved primary;
- cleanup problem after a completed commit does not falsely claim the commit never occurred;
- the returned/raised outcome preserves enough state to distinguish committed-new-primary from uncommitted-old-primary.

### Coordinator integration

Through `PersistenceCoordinator.saveCurrentWorkbook(...)`, prove:

- safe-save options are passed to the transport unchanged;
- successful safe-save receipt is propagated;
- transport failures become `TRANSPORT_SAVE_FAILED` while retaining the underlying transport error/cause;
- a failed transport save is never returned as `{ status: 'saved' }`;
- snapshot/export remain non-destructive and are not repeated to simulate transport rollback.

### Browser/non-atomic truthfulness

Using a fake capability profile, prove a transport that cannot perform atomic replacement reports non-atomic/direct behavior and is never upgraded to an atomic claim by the coordinator.

### Full repository gate

Run:

```text
TypeScript typecheck
full automated test suite
production Vite build
```

## B3 completion gate

Phase 5.4B is complete only when:

- capability reporting is explicit;
- backup policy is deterministic;
- backup happens before destructive commit when requested/supported;
- replacement bytes are staged separately before commit in the reference transport;
- failures before commit preserve the previous primary workbook;
- backup artifacts preserve exact previous bytes;
- temporary artifacts are cleaned according to the contract;
- post-commit cleanup outcomes do not create false rollback claims;
- coordinator propagation remains controlled and transport-agnostic;
- non-atomic/browser-style transports cannot falsely claim native atomicity;
- all CI gates pass.

After B3 is complete and merged, create the 5.4B parent completion record and advance exactly to:

```text
5.4C — Corruption, Limits & Recovery Diagnostics — NEXT / NOT STARTED
```

Do not begin 5.4C automatically.

---

# Locked 5.4B decisions

1. `WorkbookTransport` remains byte-only.
2. Backup/stage/commit/cleanup semantics belong to the transport boundary, not React and not `PersistenceCoordinator`.
3. `PersistenceCoordinator` remains responsible for snapshot/export orchestration and wrapping transport failure, not implementing file replacement.
4. `none`, `if-supported`, and `required` are distinct backup policies; existing `none`/`if-supported` meaning is preserved.
5. A transport that advertises backup support must fail closed before commit if requested backup creation fails.
6. No prior primary workbook is not a backup failure and must not create fake backup bytes.
7. Backup bytes represent the exact pre-save primary workbook.
8. Replacement bytes are defensively owned before entering staging.
9. Staged replacement is not authoritative until commit.
10. Failures before commit preserve the previous primary workbook.
11. Atomic replacement is a capability/guarantee, not an assumption.
12. Browser/download workflows may report non-atomic behavior and must never imply native filesystem replacement guarantees.
13. The in-memory reference transport proves logical ordering/atomic commit semantics only; it does not prove disk durability, `fsync`, rename behavior, or crash consistency.
14. Concrete Tauri filesystem operations remain Phase 6.
15. Cleanup is part of the safe-save lifecycle and must be exercised on success and failure paths.
16. A post-commit cleanup problem is semantically different from a pre-commit failure; outcomes must not falsely claim rollback.
17. Transport errors preserve stage/cause context and remain the cause of coordinator `TRANSPORT_SAVE_FAILED` errors.
18. 5.4C remains the owner of workbook corruption/resource-limit/recovery-user diagnostics; 5.4B owns only transport-level replacement/recoverability semantics.
19. Hydration rollback semantics remain owned by 5.3B and are not mixed with save-side transport recovery.
20. No business domain, workbook version, workbook schema, or migration behavior changes are required by 5.4B.

# Out of scope

Phase 5.4B does not implement:

- Tauri filesystem/dialog APIs;
- operating-system file locks;
- actual filesystem `fsync`/directory sync;
- platform-specific rename/replace guarantees;
- crash-consistency guarantees beyond the abstract/reference contract;
- browser download management;
- React persistence UI;
- workbook corruption parsing;
- workbook/sheet/row resource limits;
- business dataset migration;
- repository hydration rollback;
- Phase 5.5 user-facing backup/restore UX.

Those remain assigned to 5.4C, 5.5, Phase 6, or later platform-specific work.

# Next action after planning merge

After this docs-only plan is merged and the exact resulting `develop` CI is green:

```text
5.4B1 — Safe-Save Capability, Policy & Transaction Contract
NEXT / NOT STARTED
```

Do not begin 5.4B1 until the user separately says to proceed.
