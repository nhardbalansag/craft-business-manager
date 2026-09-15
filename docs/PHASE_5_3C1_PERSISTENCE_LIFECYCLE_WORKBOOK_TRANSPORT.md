# Phase 5.3C1 — Persistence Lifecycle & Workbook Transport Contract

## Status

**COMPLETE**

Parent plan:

`docs/PHASE_5_3C_PERSISTENCE_COORDINATOR_LOAD_SAVE_LIFECYCLE_PLAN.md`

Authoritative implementation baseline:

```text
develop  a9eae16a2439fc8fbb458b4e370d858674ac087d
CI       35035328007 — SUCCESS
```

Feature branch:

```text
feature/phase-5-3c1-persistence-lifecycle-transport
```

## Objective

Establish one unambiguous byte-oriented persistence transport/lifecycle contract for the Phase 5 coordinator without moving workbook mapping, BusinessDataset validation, repository hydration, detailed backup/atomic-write behavior, React UI, or native filesystem concerns into the transport layer.

The resulting authoritative direction is:

```text
BusinessDataset
    <-> existing workbook import/export + WorkbookCodec
    <-> XLSX bytes
    <-> WorkbookTransport
```

There is no longer a competing public dataset-level `load(): BusinessDataset` / `save(dataset)` persistence abstraction.

---

# Delivered

## 1. Workbook byte transport contract

Added:

`src/storage/WorkbookTransport.ts`

The contract owns workbook bytes only:

```text
loadWorkbook() -> Uint8Array
saveWorkbook(bytes, options?) -> WorkbookSaveReceipt
```

It deliberately has no knowledge of:

- `BusinessDataset`;
- workbook sheets/columns;
- workbook schema validation;
- repository lists;
- hydration/replacement;
- costing/yield/pricing/capacity calculations;
- native filesystem paths.

Mutable byte ownership is explicit through `cloneWorkbookBytes(...)` and transport implementations must defensively own buffers that cross the boundary.

## 2. Narrow backup request / receipt vocabulary

The transport contract supports only a neutral request:

```text
none
if-supported
```

and neutral receipt states:

```text
not-requested
unsupported
created + reference
```

This is intentionally not the Phase 5.4B backup algorithm.

Phase 5.4B still owns:

- existing-file read-before-replace rules;
- backup naming;
- staged writes;
- atomic replace/commit;
- temporary artifact cleanup;
- recovery policy;
- detailed backup-failure behavior.

## 3. In-memory workbook transport

Added:

`src/storage/InMemoryWorkbookTransport.ts`

This provides a reusable non-native transport for later C2/C3 integration tests.

Properties:

- defensive copy on constructor input;
- defensive copy on save;
- defensive copy on load;
- deterministic `NO_WORKBOOK_AVAILABLE` failure when empty;
- arbitrary bytes are treated as transport data, not validated as workbook/business content;
- backup requests are reported as `unsupported` rather than implementing Phase 5.4B behavior.

## 4. Persistence lifecycle diagnostics contract

Added:

`src/application/persistence/PersistenceLifecycle.ts`

Stable lifecycle stages:

```text
snapshot
export
transport-save
transport-load
import
hydrate
```

Stable operational codes include:

```text
SNAPSHOT_FAILED
EXPORT_FAILED
TRANSPORT_SAVE_FAILED
TRANSPORT_LOAD_FAILED
HYDRATION_SNAPSHOT_FAILED
HYDRATION_APPLY_FAILED_RESTORED
HYDRATION_ROLLBACK_FAILED
```

The original cause is retained on `PersistenceLifecycleOperationalError` so later C2/C3 orchestration does not flatten lower-level context.

Expected workbook import rejection remains a structured result carrying the existing ordered Phase 5.2C issues instead of being mislabeled as an operational crash.

Hydration rejection also has a distinct structured rejection shape.

Rollback failure remains explicitly distinguishable from an apply failure whose rollback succeeded.

## 5. Obsolete dataset-level storage scaffold removed

Removed:

```text
src/storage/StoragePort.ts
src/storage/ExcelStorage.ts
```

The old scaffold predated the completed workbook codec architecture and exposed dataset-level persistence methods that could become a competing persistence path.

Typecheck after removal proves no live application code depended on those obsolete files.

---

# Focused tests

Added:

```text
src/storage/WorkbookTransport.test.ts
src/application/persistence/PersistenceLifecycle.test.ts
```

Focused coverage:

```text
8 WorkbookTransport tests
4 PersistenceLifecycle tests
12 focused Phase 5.3C1 tests total
```

Covered:

- defensive cloning of `Uint8Array` input;
- defensive cloning of `ArrayBuffer` input;
- saved-byte ownership independent of caller mutation;
- loaded-byte ownership independent of consumer mutation;
- default backup-not-requested receipt;
- explicit backup request reported as unsupported by the in-memory transport;
- deterministic empty-load failure;
- transport does not validate workbook/business semantics;
- lifecycle operational errors retain stable stage/code/message/cause;
- rollback failure code remains distinct from restored-apply failure;
- structured workbook import issues remain normal rejection data;
- hydration rejection remains separate from operational hydration failure.

---

# CI / merge evidence

```text
Feature head               b3bbb9b2a524289f73940ab951cbd96d61d9bc6c
Implementation PR          #159 — MERGED
PR CI                      35036181681 — SUCCESS
Implementation merge       5f37670d0b1865ceb691980c6c6f6864771ca07c
Post-merge develop CI      35036255261 — SUCCESS
93 test files / 1140 tests
12 focused Phase 5.3C1 tests
TypeScript typecheck passed
Production Vite build passed
121 modules transformed
```

The existing >500 kB Vite chunk warning remains informational and is not a Phase 5.3C1 failure.

---

# Completion gate

| Gate | Result |
| --- | --- |
| Workbook transport is byte-oriented | YES |
| Transport has no `BusinessDataset` knowledge | YES |
| Mutable byte ownership is defensive | YES |
| Neutral backup request/receipt vocabulary exists | YES |
| No Phase 5.4B backup/atomic-write algorithm implemented | YES |
| Stable lifecycle stages exist | YES |
| Stable operational error codes exist | YES |
| Original operational causes retained | YES |
| Structured 5.2C import issues remain structured | YES |
| Rollback failure remains explicitly severe/distinct | YES |
| Obsolete dataset-level `StoragePort` removed | YES |
| Placeholder `ExcelStorage` removed | YES |
| Focused tests pass | YES |
| Full regression suite passes | YES |
| TypeScript typecheck passes | YES |
| Production build passes | YES |

Therefore:

**Phase 5.3C1 — Persistence Lifecycle & Workbook Transport Contract is COMPLETE.**

---

# Current persistence boundary after 5.3C1

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE
Dataset -> XLSX export                COMPLETE
XLSX -> dataset reconstruction        COMPLETE
Repository snapshot service           COMPLETE — 5.3A
Validated atomic hydration            COMPLETE — 5.3B
Workbook byte transport contract      COMPLETE — 5.3C1
Persistence lifecycle vocabulary      COMPLETE — 5.3C1
Snapshot/export/save orchestration    NEXT / NOT STARTED — 5.3C2
Load/import/hydrate orchestration     NOT STARTED — 5.3C3
Detailed backup/atomic write          NOT STARTED — 5.4B
Native filesystem                     Phase 6
```

# Next task

**5.3C2 — Snapshot-to-XLSX Export / Save Orchestration — NEXT / NOT STARTED**

Do not begin 5.3C2 as part of this closeout.
