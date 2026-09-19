# Phase 5.3C2 — Snapshot-to-XLSX Export / Save Orchestration

## Status

**COMPLETE**

Parent phase:

```text
5.3C — Persistence Coordinator / Load-Save Lifecycle
```

Dedicated parent plan:

`docs/PHASE_5_3C_PERSISTENCE_COORDINATOR_LOAD_SAVE_LIFECYCLE_PLAN.md`

Previous prerequisite:

```text
5.3C1 — Persistence Lifecycle & Workbook Transport Contract — COMPLETE
```

Next task after this closeout:

```text
5.3C3 — XLSX Load / Import / Hydrate & Completion Gate — NEXT / NOT STARTED
```

---

## Authoritative baseline

```text
develop  1deddb42ff0b451fe0d5cbdbf1563e43767f31f0
CI       35036482810 — SUCCESS
```

Feature branch:

```text
feature/phase-5-3c2-export-save-orchestration
```

Feature head:

```text
9781330de883d21537969e4649be8d6c37eb5dad
```

Implementation PR:

```text
#161 — Phase 5.3C2: snapshot-to-XLSX export and save orchestration
```

PR CI:

```text
35036820512 — SUCCESS
```

Implementation merge:

```text
78f0444029905db801a53427e8c9b3bb3d119d69
```

Post-merge `develop` CI:

```text
35036895766 — SUCCESS
```

---

# Delivered implementation

## 1. Application-level persistence coordinator

Added:

`src/application/persistence/PersistenceCoordinator.ts`

The coordinator now owns the non-destructive persistence lifecycle:

```text
live authoritative repositories
-> CompleteSourceSnapshotService.snapshot()
-> complete BusinessDataset
-> deterministic export metadata
-> exportBusinessDatasetToXlsx(...)
-> XLSX bytes
-> optional WorkbookTransport.saveWorkbook(...)
```

The coordinator does not enumerate repositories, map workbook sheets, calculate derived results, or perform repository writes.

## 2. Direct workbook export

Added:

```ts
exportCurrentWorkbook()
```

This operation:

- captures the complete authoritative source snapshot through 5.3A;
- generates deterministic export metadata from an injectable clock;
- carries optional application-version metadata without making it a compatibility gate;
- delegates dataset/workbook validation and canonical mapping to the existing 5.2B export boundary;
- delegates XLSX encoding to the injected `WorkbookCodec`;
- returns caller-owned workbook bytes plus metadata;
- never requires a persistence transport;
- never mutates live source state.

This is the application boundary later browser-download UI can consume without learning workbook internals.

## 3. Transport-backed save

Added:

```ts
saveCurrentWorkbook(transport, options)
```

This operation executes the same authoritative snapshot/export pipeline as direct export, then passes defensive XLSX bytes to the C1 `WorkbookTransport`.

The save result contains:

- controlled `saved` status;
- exported byte length;
- export metadata;
- transport-owned save receipt;
- neutral backup receipt when backup intent is requested.

The coordinator does not claim atomic replacement, backup creation guarantees, filesystem paths, staged writes, cleanup, or recovery semantics. Those remain Phase 5.4B / Phase 6 responsibilities.

## 4. Deterministic metadata source

The coordinator accepts an injectable clock:

```ts
() => Date
```

Tests can therefore assert exact `exportedAt` values without relying on wall-clock time.

`applicationVersion` remains optional and is copied into workbook metadata only when supplied.

## 5. Defensive byte ownership

The coordinator uses the C1 `cloneWorkbookBytes(...)` boundary so:

- codec-owned mutable buffers are not exposed directly to callers;
- transport calls receive owned workbook-byte copies;
- later caller mutation cannot mutate the codec-owned result buffer.

## 6. Controlled failure mapping

C2 maps operational failures through the C1 lifecycle vocabulary:

```text
snapshot failure       -> stage=snapshot       code=SNAPSHOT_FAILED
export/encode failure  -> stage=export         code=EXPORT_FAILED
transport save failure -> stage=transport-save code=TRANSPORT_SAVE_FAILED
```

The original cause remains attached as `causeValue`.

This preserves important lower-level diagnostics, including:

- `BusinessDatasetWorkbookExportError` with structured dataset issues;
- `WorkbookCodecError` encode context;
- transport-specific failure context.

Invalid live source state therefore remains distinguishable from a codec failure even though both occur inside the export lifecycle stage.

---

# Focused validation

Added:

`src/application/persistence/PersistenceCoordinator.test.ts`

Focused C2 coverage proves:

1. deterministic injected `exportedAt` and optional application version are written into the workbook;
2. direct export produces actual XLSX bytes through `SheetJsWorkbookCodec`;
3. returned workbook bytes are caller-owned even when a codec reuses a mutable buffer;
4. save uses the same snapshot/export pipeline and forwards backup intent;
5. the C1 in-memory transport reports requested backup as unsupported rather than inventing backup behavior;
6. snapshot failure is classified before any export attempt;
7. invalid current source state is mapped to `EXPORT_FAILED` while retaining structured `BusinessDatasetWorkbookExportError` issues;
8. codec encode failure remains available as the retained export cause;
9. transport save failure is mapped separately and does not mutate the snapshotted source dataset.

Focused C2 test count:

```text
7 tests
```

---

# Regression evidence

Implementation PR CI:

```text
94 test files passed
1147 tests passed
7 focused 5.3C2 coordinator tests passed
TypeScript typecheck passed
Production Vite build passed
121 modules transformed
```

Post-merge `develop` CI:

```text
35036895766 — SUCCESS
```

---

# Locked boundaries preserved

5.3C2 intentionally did **not** implement:

- workbook import;
- dataset hydration;
- shared session coordinator wiring;
- React download/save UI;
- native filesystem paths or dialogs;
- old-workbook migration;
- detailed backup creation;
- staged writes;
- atomic replace/commit semantics;
- recovery or corruption policy.

Those remain assigned to 5.3C3, 5.4, 5.5, and Phase 6 as defined by the Phase 5 plan.

---

# Completion decision

Phase 5.3C2 is complete because the application can now compose the complete authoritative live source snapshot into canonical XLSX bytes and optionally save those bytes through the library-neutral workbook transport using one application-level coordinator boundary.

No load/import/hydrate behavior was started in this phase.

## Next exact task

```text
5.3C3 — XLSX Load / Import / Hydrate & Completion Gate — NEXT / NOT STARTED
```
