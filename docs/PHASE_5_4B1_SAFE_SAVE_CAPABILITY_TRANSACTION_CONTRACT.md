# Phase 5.4B1 — Safe-Save Capability, Policy & Transaction Contract

Status: **COMPLETE**

Parent:

```text
5.4B — Backup & Atomic-Write Transport Contract
```

Next task after this closeout is merged and exact `develop` CI is green:

```text
5.4B2 — Backup + Staged-Commit In-Memory Reference Transport — NEXT / NOT STARTED
```

Do not begin 5.4B2 until the user separately says to proceed.

## Authoritative baseline

```text
develop  55c06e9309f48345635bd5f5a543762a3ca8ce84
CI       35048445692 — SUCCESS
```

Feature branch:

```text
feature/phase-5-4b1-safe-save-transport-contract
```

Corrected feature head:

```text
bd3f01235f8d9786e003ad77285e652b792c583d
```

Implementation PR:

```text
#173 — Phase 5.4B1: safe-save capability and transaction contract
```

Implementation merge:

```text
2ec2a75c43bef03690f0de7014d4171ba7a36ea0
```

Post-merge `develop` CI:

```text
35049144901 — SUCCESS
```

## Split reassessment

B1 was reassessed against the exact green baseline and did **not** require a deeper split. The repository already had one narrow byte-only `WorkbookTransport` seam and `PersistenceCoordinator` already forwarded transport options and receipts without owning storage mechanics.

B1 therefore remained a contract-focused child. Actual backup creation, staging, commit behavior, and deterministic fault injection remain B2/B3 responsibilities.

## Delivered contract

### Explicit backup policy

`WorkbookBackupRequest` now supports:

```text
none
if-supported
required
```

Semantics:

- `none`: no backup is attempted;
- `if-supported`: backup may be attempted when supported and unsupported is a valid explicit outcome;
- `required`: replacement may not proceed when backup capability is unavailable.

The existing simple in-memory transport rejects unsupported required-backup requests before changing primary bytes.

### Explicit transport capabilities

`WorkbookTransport` now exposes immutable capabilities describing:

- backup support;
- staged-replacement support;
- actual replacement guarantee.

Replacement guarantee is explicitly one of:

```text
atomic
direct-non-atomic
```

Atomicity is therefore data supplied by the transport contract rather than an assumption inferred from a class name, runtime, coordinator, or UI.

### Truthful save receipt

Successful save receipts now contain both:

- backup outcome; and
- replacement guarantee actually delivered.

Backup receipts distinguish:

```text
not-requested
unsupported
not-needed / no-existing-workbook
created / reference
```

No-existing-primary is therefore representable without inventing backup bytes or misclassifying it as failure.

### Controlled safe-save failure vocabulary

`WorkbookTransportSaveError` records:

- failure stage;
- stable error code;
- commit state;
- original cause when applicable.

Defined stages:

```text
capability
read-existing
backup
stage
commit
cleanup
```

Defined commit states:

```text
not-committed
committed
```

This establishes the contract needed for B2/B3 to distinguish a pre-commit failure, where the previous primary remains authoritative, from a post-commit cleanup problem, where the replacement may already be authoritative.

### Byte-only boundary preserved

`WorkbookTransport` still has no knowledge of:

- `BusinessDataset`;
- workbook sheet/schema contracts;
- workbook validation/migration mechanics;
- repositories or hydration;
- React/UI;
- native filesystem paths or Tauri APIs.

`PersistenceCoordinator` production code required no B1 change. It continues to export canonical XLSX bytes, call the transport once, return the receipt unchanged on success, and preserve the thrown transport error as the cause of its existing `TRANSPORT_SAVE_FAILED` lifecycle error.

## Existing simple in-memory transport after B1

`InMemoryWorkbookTransport` intentionally remains a simple reference for direct byte storage, not the B2 safe-save implementation.

Its capabilities are explicitly:

```text
backup             unsupported
stagedReplacement  false
replacement        direct-non-atomic
```

It still defensively owns saved bytes and returns defensive copies on load.

B1 does **not** add backup artifacts, staging state, logical atomic commit, cleanup orchestration, or fault injection to this transport.

## Validation history

The first PR gate exposed one missed legacy test fixture after `WorkbookSaveReceipt.replacement` became required:

```text
PR CI  35048938545 — FAILURE
Stage  Typecheck
Cause  PersistenceCoordinatorCompletion.test.ts fake save receipt omitted replacement
```

No production logic failed and tests/build did not run in that failed gate.

The fixture was corrected without widening B1 scope. Corrected PR gate:

```text
PR CI               35049014369 — SUCCESS
Test files           102 passed
Tests                1219 passed
Focused transport    13 tests
TypeScript           PASS
Production build     PASS
Modules transformed  132
```

The existing Vite large-chunk warning remains informational and unrelated to B1.

Post-merge gate:

```text
develop              2ec2a75c43bef03690f0de7014d4171ba7a36ea0
CI                   35049144901 — SUCCESS
```

## Completion gate

Phase 5.4B1 is complete because the storage boundary can now explicitly and deterministically express:

- backup policy including required backup;
- backup capability;
- staged-replacement capability;
- atomic versus non-atomic replacement guarantee;
- distinct backup receipt outcomes;
- safe-save failure stage;
- whether commit had occurred when failure was reported;
- original transport failure context.

No native filesystem guarantee has been claimed.

## Next

```text
5.4B2 — Backup + Staged-Commit In-Memory Reference Transport — NEXT / NOT STARTED
```

B2 should implement the actual deterministic in-memory backup/stage/commit ordering against this contract. It must be reassessed against the exact green post-closeout `develop` baseline before implementation, and it must not begin until the user separately says to proceed.
