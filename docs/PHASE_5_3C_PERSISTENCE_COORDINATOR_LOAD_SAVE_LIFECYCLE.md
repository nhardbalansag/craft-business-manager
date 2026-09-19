# Phase 5.3C — Persistence Coordinator / Load-Save Lifecycle — Completion Record

Status: **COMPLETE**

Plan:

`docs/PHASE_5_3C_PERSISTENCE_COORDINATOR_LOAD_SAVE_LIFECYCLE_PLAN.md`

## Scope completed

Phase 5.3C now provides one application-level persistence lifecycle over the already-completed Phase 5 source, workbook, snapshot, and hydration contracts:

```text
SAVE / EXPORT
live repositories
-> CompleteSourceSnapshotService
-> BusinessDataset
-> exportBusinessDatasetToXlsx
-> XLSX bytes
-> optional WorkbookTransport save

LOAD / IMPORT
WorkbookTransport / caller bytes
-> importBusinessDatasetFromXlsx
-> validated BusinessDataset candidate
-> ValidatedAtomicDatasetHydrationService
-> live repositories
```

The coordinator does not enumerate repositories, parse workbook sheets itself, replay ordinary business CRUD services, implement native filesystem access, or claim detailed atomic-write/backup behavior.

## Completed decomposition

```text
5.3C1 — Persistence Lifecycle & Workbook Transport Contract  COMPLETE
5.3C2 — Snapshot-to-XLSX Export / Save Orchestration         COMPLETE
5.3C3 — XLSX Load / Import / Hydrate & Completion Gate       COMPLETE
```

## 5.3C1 — Transport and lifecycle foundation

Completion record:

`docs/PHASE_5_3C1_PERSISTENCE_LIFECYCLE_WORKBOOK_TRANSPORT.md`

Delivered:

- byte-only `WorkbookTransport`;
- defensive workbook-byte ownership;
- neutral backup request/receipt vocabulary;
- reusable in-memory transport;
- stable lifecycle stage/code vocabulary;
- structured import/hydration rejection shapes;
- distinct severe rollback-failure diagnostics;
- retirement of the obsolete dataset-level `StoragePort` / placeholder `ExcelStorage` path.

Evidence:

```text
Implementation PR #159     MERGED
Implementation merge       5f37670d0b1865ceb691980c6c6f6864771ca07c
Post-merge CI              35036255261 — SUCCESS
93 test files / 1140 tests
12 focused 5.3C1 tests
```

## 5.3C2 — Export/save orchestration

Completion record:

`docs/PHASE_5_3C2_SNAPSHOT_XLSX_EXPORT_SAVE_ORCHESTRATION.md`

Delivered:

- `PersistenceCoordinator` application boundary;
- shared complete snapshot -> deterministic metadata -> existing XLSX exporter pipeline;
- `exportCurrentWorkbook()` for transport-independent workbook bytes;
- `saveCurrentWorkbook(...)` through `WorkbookTransport`;
- injectable export clock and optional application version;
- neutral backup-intent forwarding;
- controlled snapshot/export/transport-save failure mapping;
- no live-state mutation on export/save failures.

Evidence:

```text
Implementation PR #161     MERGED
Implementation merge       78f0444029905db801a53427e8c9b3bb3d119d69
Post-merge CI              35036895766 — SUCCESS
94 test files / 1147 tests
7 focused 5.3C2 coordinator tests
```

## 5.3C3 — Load/import/hydrate completion gate

Authoritative baseline:

```text
develop  beb97dbac0325425a21cdfaaaf4cb7cca45b0666
CI       35037111736 — SUCCESS
```

Feature branch:

`feature/phase-5-3c3-load-import-hydrate-completion`

Corrected feature head:

`486f7bf6032a56bc8d98a99f9e182dc907801109`

Implementation PR:

`#163 — Phase 5.3C3: XLSX load import hydrate completion gate`

Implementation merge:

`3c14b209737f69b32cb746c667affac518d306f2`

Post-merge develop CI:

`35038755032 — SUCCESS`

### Delivered lifecycle operations

`PersistenceCoordinator` now owns both halves of Phase 5.3C:

- `exportCurrentWorkbook()`;
- `saveCurrentWorkbook(transport, options)`;
- `importAndApplyWorkbook(bytes)`;
- `loadCurrentWorkbook(transport)`.

Direct bytes and transport-loaded bytes converge on the same strict import-and-apply path. No second parser or hydrator implementation exists.

### Import rejection contract

Expected invalid workbook conditions remain structured import rejections:

```text
status = rejected
stage  = import
issues = BusinessDatasetWorkbookImportIssue[]
```

Hydration is not called when import rejects the workbook.

The importer remains authoritative about whether a malformed input is rejected during codec, schema, metadata, reconstruction, or dataset validation. The coordinator does not flatten or reinterpret that ordered diagnostic evidence.

### Hydration error mapping

The coordinator preserves the original `DatasetHydrationError` as operational cause while exposing stable application lifecycle codes:

```text
SNAPSHOT_FAILED
-> HYDRATION_SNAPSHOT_FAILED

APPLY_FAILED_RESTORED
-> HYDRATION_APPLY_FAILED_RESTORED

ROLLBACK_FAILED
-> HYDRATION_ROLLBACK_FAILED
```

Rollback failure remains explicitly severe and is never returned as hydration success.

### Shared application session

`src/application/session.ts` now exports one shared concrete:

```text
persistenceCoordinator
```

It is composed from the same:

- `completeSourceSnapshotService`;
- `validatedAtomicDatasetHydrationService`;
- shared live repository object graph;
- concrete `SheetJsWorkbookCodec`.

Existing business services therefore continue observing the same repositories after successful hydration; no service graph rebuild is required.

## Completion regression proof

The corrected C3 gate passed:

```text
96 test files / 1168 tests
TypeScript typecheck passed
Production Vite build passed
130 modules transformed
```

C3-specific completion coverage proves:

1. source state A can be saved to workbook bytes;
2. live state can change to B after save;
3. load/import restores A;
4. the post-load complete snapshot equals A semantically;
5. an already-wired application service observes restored state without reconstruction;
6. invalid workbook rejection performs zero hydration writes;
7. transport-load failure performs zero live writes;
8. a real hydration apply failure restores the exact prior dataset and maps to `HYDRATION_APPLY_FAILED_RESTORED`;
9. rollback failure remains a distinct `HYDRATION_ROLLBACK_FAILED` outcome retaining operation and rollback causes;
10. a valid empty workbook clears every authoritative source collection;
11. missing records remain distinct from explicit zero/null values;
12. truly absent optional Material source metadata stays absent rather than becoming an own `undefined` property;
13. caller-owned workbook buffers cannot mutate live state after import completion;
14. canonical persistence contains source workbook sheets only and excludes derived costing/capacity/pricing/profit outputs;
15. the shared application session exposes the coordinator;
16. already-wired shared session services observe restored workbook state.

## Corrective CI history

Two pre-merge branch failures were resolved before the implementation PR gate:

```text
35038280781 — FAILURE
```

This was a compile-time test-fixture typing issue: a synthetic hydration rejection widened a validation issue code to generic `string`. The fixture was changed to use the authoritative `BusinessDatasetValidationIssue` type.

```text
35038384023 — FAILURE
```

Typecheck and all lifecycle completion/session tests passed, but one unit assertion incorrectly required arbitrary malformed bytes to reject specifically at the codec stage. SheetJS can decode some arbitrary byte sequences into a workbook object, after which the strict importer correctly rejects the result at the schema stage. The test was corrected to assert the actual contract: structured import rejection, ordered importer diagnostics, and zero hydration calls.

Corrected branch CI:

```text
35038527004 — SUCCESS
96 test files / 1168 tests
130 modules transformed
```

PR CI also passed on the same locked head before merge.

## Parent Phase 5.3C completion gate

| Gate | Result |
| --- | --- |
| One application persistence coordinator | PASS |
| Snapshot/export/save lifecycle | PASS |
| Direct bytes import/apply lifecycle | PASS |
| Transport load uses same import/apply path | PASS |
| Strict fail-closed importer reused | PASS |
| Valid candidates use atomic hydration service | PASS |
| Invalid workbook causes zero hydration writes | PASS |
| Transport-load failure causes zero live writes | PASS |
| Apply failure rollback guarantee retained | PASS |
| Rollback failure distinct and severe | PASS |
| Missing vs zero/null evidence preserved | PASS |
| Optional source absence preserved | PASS |
| Shared services observe restored state | PASS |
| Derived outputs excluded from authoritative workbook | PASS |
| TypeScript typecheck | PASS |
| Full automated test suite | PASS |
| Production build | PASS |

**Phase 5.3C is COMPLETE.**

Because 5.3A, 5.3B, and 5.3C are all complete, **Phase 5.3 — Snapshot, Hydration & Persistence Coordination is also COMPLETE.**

## Scope intentionally still deferred

The following remain outside 5.3C and are not implied complete by this closeout:

- older workbook/schema migration and compatibility — 5.4A;
- detailed backup creation, staged write, atomic replace/commit, cleanup, and recovery transport semantics — 5.4B;
- broader corruption/limit/recovery diagnostics — 5.4C;
- persistence UI workflows — 5.5;
- final integrated Phase 5 gate — 5.6;
- native Tauri filesystem/dialog behavior — Phase 6.

## Next task

**5.4A — Schema Migration & Compatibility Framework — NEXT / NOT STARTED**

Do not begin Phase 5.4A implementation until this parent closeout is merged, the exact final `develop` CI is green, and the user separately says to proceed.
