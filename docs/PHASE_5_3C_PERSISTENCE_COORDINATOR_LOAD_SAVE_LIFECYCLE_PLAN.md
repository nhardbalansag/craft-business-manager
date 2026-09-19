# Phase 5.3C — Persistence Coordinator / Load-Save Lifecycle Development Plan

## Status

**PLANNING ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning baseline:

```text
develop  8e6935d4abcebd3c31e8c1237fc71995130793fa
CI       35034624914 — SUCCESS
```

Planning branch:

```text
docs/phase-5-3c-persistence-coordinator-plan
```

Parent phase:

```text
5.3 — Repository Snapshot, Hydration & Persistence Coordination
```

Completed prerequisites:

```text
5.3A — Complete Source Snapshot Service               COMPLETE
5.3B — Validated Atomic Dataset Hydration             COMPLETE
5.2B — Deterministic Dataset-to-XLSX Export           COMPLETE
5.2C — Strict XLSX-to-Dataset Import & Diagnostics    COMPLETE
```

Next implementation gate after this plan is merged and its exact `develop` CI is green:

```text
5.3C1 — Persistence Lifecycle & Workbook Transport Contract
```

Do not begin 5.3C1 implementation as part of this planning change.

---

# Objective

Phase 5.3C composes the persistence primitives already completed in Phases 5.2, 5.3A, and 5.3B into one application-level load/save lifecycle.

The completed coordinator must give later UI work one boundary for:

```text
current live repositories
    -> complete source snapshot
    -> deterministic XLSX export
    -> workbook bytes / transport save

workbook bytes / transport load
    -> strict XLSX import
    -> validated BusinessDataset candidate
    -> atomic dataset hydration
    -> restored live repositories
```

React must not directly call workbook codecs, enumerate repositories, or perform replacement writes.

The coordinator is orchestration only. It must not create a second set of business rules, workbook mappings, validation rules, hydration rules, or derived calculations.

---

# Planning Audit

## 1. Export boundary already exists

`src/storage/businessDatasetWorkbookExport.ts` already provides:

```ts
exportBusinessDatasetToXlsx(
  dataset: BusinessDataset,
  metadata: WorkbookExportMetadata,
  codec: WorkbookCodec,
): Uint8Array
```

It already:

- validates the complete dataset;
- builds the canonical 13-sheet workbook;
- validates the generated workbook schema;
- delegates byte encoding to `WorkbookCodec`;
- keeps SheetJS-specific APIs outside application/domain code.

5.3C must call this boundary rather than rebuilding workbook rows itself.

## 2. Import boundary already exists

`src/storage/businessDatasetWorkbookImport.ts` already provides:

```ts
importBusinessDatasetFromXlsx(
  bytes: WorkbookBinaryInput,
  codec: WorkbookCodec,
): BusinessDatasetWorkbookImportResult
```

It already:

- decodes workbook bytes;
- validates workbook schema and metadata;
- reconstructs all source collections;
- validates the resulting current-version `BusinessDataset`;
- returns deterministic structured import issues;
- never mutates live repositories.

5.3C must preserve these import diagnostics instead of converting every invalid workbook into a generic exception.

## 3. Snapshot boundary already exists

`CompleteSourceSnapshotService.snapshot()` already returns one complete, deterministic, deep-cloned current-schema `BusinessDataset` covering all nine authoritative source repositories.

5.3C must use that service for save/export instead of reading repositories itself.

## 4. Atomic hydration boundary already exists

`ValidatedAtomicDatasetHydrationService.hydrate(...)` already owns:

- complete candidate validation before writes;
- hydration-owned cloning;
- pre-hydration rollback snapshotting;
- deterministic replacement of all nine repositories;
- rollback after apply failure;
- controlled `SNAPSHOT_FAILED`, `APPLY_FAILED_RESTORED`, and `ROLLBACK_FAILED` errors.

5.3C must call this service for load/import application instead of replaying repository CRUD operations.

## 5. The old `StoragePort` scaffold is no longer the correct authoritative shape

The repository still contains the early scaffold:

```ts
interface StoragePort {
  load(): Promise<BusinessDataset>;
  save(dataset: BusinessDataset): Promise<void>;
  createBackup?(dataset: BusinessDataset): Promise<string>;
}
```

and a placeholder `ExcelStorage` whose methods throw.

That shape predates the completed workbook architecture.

The authoritative Phase 5 boundary is now:

```text
BusinessDataset <-> WorkbookCodec <-> XLSX bytes
```

A dataset-level storage port would either:

- bypass the completed workbook codec/import contracts; or
- force a storage adapter to own application orchestration that belongs in 5.3C.

Therefore 5.3C must replace or retire this obsolete scaffold in favor of a **workbook-byte transport boundary**.

## 6. Transport scope must remain narrow

5.3C needs enough transport abstraction to load and save workbook bytes, but it must not pull Phase 5.4B forward.

5.4B remains the owner of:

- read-existing-before-replace rules;
- timestamped backup artifact semantics;
- staged writes;
- atomic replace/commit semantics;
- temporary-artifact cleanup;
- detailed backup failure policy;
- native filesystem implementation details.

5.3C may define a minimal backup-request signal/receipt so orchestration can request backup behavior when a transport supports it, but it must not claim native atomic replacement or define the detailed 5.4B algorithm.

## 7. Native filesystem remains Phase 6

5.3C must be testable entirely with in-memory/fake workbook transports.

No Tauri file dialogs, paths, filesystem APIs, or native save locations belong in this phase.

---

# Split Decision

Phase 5.3C **requires formal subdivision**.

Reason:

The phase has three materially different responsibilities:

1. establishing the byte-oriented transport/lifecycle contract;
2. orchestrating snapshot -> export -> save;
3. orchestrating load -> import -> hydrate and proving the complete lifecycle.

Implementing all three in one branch would make it harder to distinguish contract errors from export orchestration errors and destructive load/hydration behavior.

Locked decomposition:

```text
5.3C
├── 5.3C1 — Persistence Lifecycle & Workbook Transport Contract
├── 5.3C2 — Snapshot-to-XLSX Export / Save Orchestration
└── 5.3C3 — XLSX Load / Import / Hydrate & Completion Gate
```

No deeper numbered split is planned initially. Each child phase must be reassessed before implementation; split again only if repository discovery proves a child materially larger than this plan.

---

# 5.3C1 — Persistence Lifecycle & Workbook Transport Contract

## Purpose

Establish the application/storage contracts required to move XLSX bytes into and out of the coordinator without exposing workbook codec or repository internals to UI code.

## Required work

### A. Introduce a workbook-byte transport contract

Create a library-neutral transport boundary based on workbook bytes, not `BusinessDataset` values.

Target conceptual shape:

```ts
interface WorkbookTransport {
  loadWorkbook(): Promise<WorkbookBinaryInput>;
  saveWorkbook(
    bytes: Uint8Array,
    options?: WorkbookSaveOptions,
  ): Promise<WorkbookSaveReceipt>;
}
```

Exact naming may be refined during implementation, but the contract must preserve these rules:

- transport reads/writes workbook bytes only;
- transport never validates business entities;
- transport never reconstructs or hydrates repositories;
- transport never maps workbook sheets;
- transport never calculates derived business results;
- byte ownership is defensive where mutable buffers cross boundaries.

### B. Define narrow backup-request semantics without implementing 5.4B

If the base transport supports a backup request, the contract may carry a neutral request/receipt such as:

```text
backup not requested
backup requested but unsupported
backup created / reference returned
```

5.3C1 must **not** define native backup naming, staged writes, atomic replace, cleanup, or recovery algorithms. Those remain 5.4B.

A simple fake/in-memory transport is sufficient for 5.3C tests.

### C. Establish lifecycle result/error vocabulary

Define controlled stages for coordinator failures so later UI can distinguish, at minimum:

```text
snapshot
export/encode
transport-save
transport-load
import/decode/schema/dataset
hydrate
```

Rules:

- structured 5.2C import issues remain structured and ordered;
- `DatasetHydrationError` context is not discarded;
- operational failures have stable coordinator codes/stages;
- normal invalid-workbook rejection is not mislabeled as an unexpected crash;
- rollback failure remains visibly severe.

### D. Retire or replace obsolete dataset-level storage scaffolding

Audit `StoragePort.ts` and `ExcelStorage.ts` references.

If they remain unused except by each other, remove or replace them with the new byte-oriented boundary so there is only one authoritative persistence direction.

Do not leave a second public `load(): BusinessDataset` / `save(dataset)` abstraction that bypasses the coordinator.

### E. Focused tests

Cover:

- read/write byte transport contract;
- defensive byte ownership where applicable;
- backup-request/receipt behavior if included;
- deterministic lifecycle error/result shapes;
- no `BusinessDataset` knowledge in transport tests.

## Out of scope

- snapshot/export orchestration;
- import/hydration orchestration;
- session wiring;
- React UI;
- migration/version compatibility beyond current 5.2C behavior;
- detailed backup/atomic replacement;
- native filesystem.

## Completion gate

5.3C1 is complete when one unambiguous workbook-byte transport/lifecycle contract exists and the obsolete dataset-level persistence scaffold can no longer be mistaken for the authoritative Phase 5 path.

---

# 5.3C2 — Snapshot-to-XLSX Export / Save Orchestration

## Purpose

Create the non-destructive half of the persistence coordinator:

```text
live repositories
-> CompleteSourceSnapshotService
-> BusinessDataset
-> exportBusinessDatasetToXlsx
-> XLSX bytes
-> optional transport save
```

## Required work

### A. Create the persistence coordinator

Create an application-level coordinator, expected under:

```text
src/application/persistence/
```

Conceptual dependencies:

```text
CompleteSourceSnapshotService
ValidatedAtomicDatasetHydrationService   // consumed fully in C3
WorkbookCodec
clock / export metadata source
optional application version source
```

The coordinator must receive or construct no repository list itself.

### B. Deterministic export metadata

`exportedAt` must come from an injectable/testable clock or explicit export metadata input.

Do not hard-wire nondeterministic time inside test assertions.

`applicationVersion` remains optional and must not become a workbook compatibility gate.

### C. Export-current operation

Provide one operation that returns current workbook bytes without requiring a transport, conceptually:

```text
exportCurrentWorkbook()
```

This supports later browser download workflows in Phase 5.5.

Expected behavior:

1. capture complete snapshot;
2. generate deterministic metadata;
3. export via the existing 5.2B function and injected codec;
4. return bytes plus useful export metadata/status;
5. never mutate live state.

### D. Save-current operation

Provide a transport-backed operation, conceptually:

```text
saveCurrentWorkbook(transport, options)
```

Expected behavior:

1. perform the same authoritative snapshot/export pipeline;
2. pass resulting bytes to the workbook transport;
3. pass a neutral backup request when requested/supported by the C1 contract;
4. return a controlled receipt/result;
5. never claim atomic replacement unless the transport later supplies that capability under 5.4B.

### E. Controlled failure mapping

Tests must distinguish:

- snapshot failure;
- invalid live dataset/export rejection;
- codec/encode failure;
- transport save failure;
- optional backup-request result if applicable.

A failed export/save must not mutate repositories.

## Out of scope

- workbook import;
- dataset hydration;
- UI download code;
- filesystem path handling;
- atomic replace semantics;
- backup implementation internals.

## Completion gate

5.3C2 is complete when the complete current application source state can be exported to canonical XLSX bytes and optionally passed to a byte transport through one application-level coordinator API.

---

# 5.3C3 — XLSX Load / Import / Hydrate & Completion Gate

## Purpose

Complete the destructive half of the lifecycle and prove end-to-end coordinator behavior:

```text
workbook bytes / transport load
-> importBusinessDatasetFromXlsx
-> validated candidate
-> ValidatedAtomicDatasetHydrationService
-> live repositories
```

## Required work

### A. Import-and-apply operation from bytes

Provide a coordinator operation that accepts `WorkbookBinaryInput` directly.

Expected sequence:

1. import with the existing 5.2C boundary;
2. if import returns issues, return controlled rejection and do not call hydration;
3. if import succeeds, pass the complete candidate to `ValidatedAtomicDatasetHydrationService`;
4. preserve import metadata in the success/result context where useful;
5. preserve hydration rejection/error context without flattening rollback failures.

### B. Load-and-apply operation through transport

Provide a transport-backed operation, conceptually:

```text
loadCurrentWorkbook(transport)
```

Expected sequence:

1. read workbook bytes through the C1 transport;
2. execute the exact same import-and-apply path used for direct bytes;
3. never create a second parser/hydrator implementation.

### C. Shared-session integration

Instantiate one shared concrete coordinator in `src/application/session.ts` using:

```text
completeSourceSnapshotService
validatedAtomicDatasetHydrationService
SheetJsWorkbookCodec
```

The session should expose the coordinator for Phase 5.5 UI work.

Do not expose repository replacement ports to React.

### D. Full lifecycle regression tests

At minimum prove:

1. current source state A can export/save to workbook bytes;
2. live source state can change to B;
3. loading/importing the saved workbook restores state A;
4. the post-load complete snapshot is semantically equal to A;
5. already-wired application services observe restored A without session rebuild;
6. invalid workbook bytes/issues cause zero live writes;
7. transport-load failure causes zero live writes;
8. hydration apply failure still follows 5.3B rollback guarantees;
9. rollback failure remains a distinct severe coordinator outcome;
10. empty valid workbook dataset can clear all authoritative source state;
11. missing-vs-zero/null semantics remain preserved;
12. optional source-field absence remains true absence;
13. caller-owned input buffers/candidates cannot mutate live state after completion;
14. no derived business outputs are persisted as source rows.

### E. Completion regression

Run:

```text
TypeScript typecheck
full Vitest suite
production Vite build
```

Record exact test counts, module count, feature head, PR, merge commit, and post-merge CI in the completion document.

## Out of scope

- React persistence UI (5.5);
- old-workbook migrations (5.4A);
- detailed backup/atomic write semantics (5.4B);
- corruption/size-limit hardening beyond existing import behavior (5.4C);
- native file dialogs/filesystem (Phase 6).

## Completion gate

5.3C is complete when later UI can perform persistence through one shared application-level coordinator and does not need to know about workbook sheet mappings, repository lists, replacement ports, or hydration rollback internals.

---

# Coordinator Error/Result Principles

The implementation should prefer explicit results for expected user-correctable rejections and controlled exceptions/errors for operational failures.

Conceptually:

```text
invalid workbook / validation issues
    -> structured rejected result

successful import + successful hydrate
    -> applied result

snapshot/encode/transport operational failure
    -> controlled lifecycle error

hydrate apply failure + successful rollback
    -> controlled restored-failure result/error retaining hydration code

hydrate rollback failure
    -> severe controlled error retaining both apply and rollback causes
```

Do not transform all failures into a single string message at the coordinator boundary.

Phase 5.5 will decide user-facing copy/presentation.

---

# Architectural Invariants

The following are locked across all 5.3C children:

1. `.xlsx` remains the authoritative workbook format.
2. Persist source evidence only; derived outputs remain recalculated.
3. All nine authoritative source repositories remain covered.
4. Snapshot logic stays in `CompleteSourceSnapshotService`.
5. Workbook mapping stays in the 5.2 export/import boundaries.
6. XLSX library APIs stay behind `WorkbookCodec`.
7. Dataset validation remains `validateBusinessDatasetIntegrity(...)`.
8. Live replacement/rollback stays in `ValidatedAtomicDatasetHydrationService`.
9. Transport moves workbook bytes, not `BusinessDataset` objects.
10. Invalid import must cause zero live repository writes.
11. Failed hydrate must preserve 5.3B rollback guarantees.
12. Repository/service object identity remains stable through hydration.
13. Missing evidence stays distinct from explicit zero/null/false.
14. Truly absent optional source fields remain absent.
15. React does not enumerate repositories or call `replaceAll(...)`.
16. No Tauri filesystem/dialog implementation enters Phase 5.3C.
17. 5.4B remains owner of detailed backup, staging, atomic replace, and cleanup semantics.
18. 5.3C must not claim browser/native atomic file replacement.

---

# Expected File Areas

Planning only; exact implementation files may be refined after each child-phase preflight.

Likely areas:

```text
src/application/persistence/PersistenceCoordinator.ts
src/application/persistence/PersistenceCoordinator.test.ts
src/application/persistence/... focused C2/C3 tests
src/storage/WorkbookTransport.ts
src/storage/... fake/in-memory transport tests
src/storage/StoragePort.ts                 retire/refactor if obsolete
src/storage/ExcelStorage.ts                retire/refactor if obsolete
src/application/session.ts                 C3 only
docs/PHASE_5_PROGRESS.md
```

No UI file should need modification for 5.3C.

---

# Branch / PR Strategy

After this planning PR is merged and exact `develop` CI is green:

```text
5.3C1
feature/phase-5-3c1-persistence-lifecycle-transport

5.3C2
feature/phase-5-3c2-export-save-orchestration

5.3C3
feature/phase-5-3c3-load-import-hydrate
```

Each child phase follows the established workflow:

1. verify exact green `develop` baseline;
2. create feature branch from that exact SHA;
3. implement only the child scope;
4. run focused + full CI;
5. open PR to `develop`;
6. merge only after green PR CI;
7. verify exact post-merge `develop` CI;
8. create/merge docs-only child closeout if needed;
9. do not begin the next child until the user separately says to proceed.

After C3 is merged and green, create the parent 5.3C completion record and advance the tracker to:

```text
5.4A — Schema Migration & Compatibility Framework — NEXT / NOT STARTED
```

Do not start 5.4A automatically.

---

# Planning Completion Gate

This planning phase is complete only when:

- the 5.3C split is documented;
- the obsolete dataset-level storage scaffold issue is documented;
- the minimal workbook-byte transport boundary is defined conceptually;
- 5.4B ownership is protected from scope creep;
- C1/C2/C3 responsibilities and completion gates are explicit;
- `docs/PHASE_5_PROGRESS.md` is updated to make 5.3C1 the next implementation gate;
- planning PR CI is green;
- planning PR is merged;
- exact post-merge `develop` CI is green.

Until those gates pass:

**5.3C1 implementation remains NOT STARTED.**
