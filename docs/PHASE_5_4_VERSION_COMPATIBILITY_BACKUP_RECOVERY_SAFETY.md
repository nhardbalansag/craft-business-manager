# Phase 5.4 — Version Compatibility, Backup & Recovery Safety

Status: **COMPLETE**

Parent:

```text
Phase 5 — Excel Persistence
```

## Purpose

Phase 5.4 establishes the persistence safety layer around the Phase 5 workbook lifecycle. It completes version-aware import preparation, backup/safe-save transport contracts, bounded workbook import, deterministic recovery diagnostics, and end-to-end rejection/state-preservation proof.

The phase deliberately remains storage/application focused. User-facing persistence UX remains Phase 5.5, while native filesystem durability and OS integration remain Phase 6.

## Completed decomposition

```text
5.4A — Schema Migration & Compatibility Framework       COMPLETE
5.4B — Backup & Atomic-Write Transport Contract         COMPLETE
5.4C — Corruption, Limits & Recovery Diagnostics        COMPLETE
```

### 5.4A — Compatibility & migration

Phase 5.4A established:

- minimal `_Meta` version preflight before current strict-schema validation;
- separate workbook-format and dataset-schema version axes;
- exact current v1/v1 handling;
- explicit deterministic migration registry/path contracts;
- fail-closed future-version behavior;
- no metadata-free legacy guessing;
- a production migration registry that remains empty until a real predecessor exists;
- migration on neutral workbook documents only;
- strict current workbook and dataset validation after migration/current routing;
- zero hydration writes after compatibility/migration rejection.

### 5.4B — Backup & safe-save transport

Phase 5.4B established:

- byte-only `WorkbookTransport` capability reporting;
- backup policies `none`, `if-supported`, and `required`;
- exact pre-save backup evidence;
- staged replacement semantics in the safe in-memory reference transport;
- truthful `atomic` versus `direct-non-atomic` replacement guarantees;
- deterministic backup/stage/commit/cleanup failure semantics;
- clear pre-commit versus post-commit cleanup outcomes;
- coordinator propagation without storage rollback-by-reexport;
- separation of logical reference-transport proof from native durability concerns.

### 5.4C — Corruption, limits & recovery

Phase 5.4C established:

- explicit application-level workbook resource limits;
- byte-size rejection before codec decode;
- SheetJS worksheet/range guards before large neutral expansion;
- post-decode neutral-document resource validation;
- no silent truncation of authoritative workbook input;
- stable recovery categories and machine-readable action guidance;
- raw diagnostic preservation;
- advisory-only backup restore guidance;
- deterministic classification precedence;
- real-XLSX corrupt/truncated regression coverage;
- previous live-state preservation for every expected import rejection class;
- zero hydration calls when import has not produced a valid candidate.

## Locked safety boundary after Phase 5.4

```text
XLSX bytes
  -> pre-decode resource guard
  -> WorkbookCodec.decode(...)
       -> concrete SheetJS declared-range guards
  -> post-decode neutral-document resource guard
  -> minimal version preflight
  -> compatibility classification
       -> current
       -> registered migration path
       -> controlled rejection
  -> strict current workbook schema validation
  -> dataset reconstruction
  -> complete dataset integrity validation
  -> PersistenceCoordinator
  -> ValidatedAtomicDatasetHydrationService
```

Save-side safety remains:

```text
current source snapshot
  -> canonical workbook export
  -> WorkbookTransport
       -> explicit backup policy
       -> optional/required pre-save backup
       -> staged replacement when supported
       -> truthful replacement guarantee
       -> structured failure/commit-state evidence
```

## Public compatibility contract

The public persisted format remains:

```text
formatId                craft-business-manager
workbook format         v1
business dataset schema v1
```

Phase 5.4 does not invent a fake v0 or bump versions solely to demonstrate migration.

## Recovery categories

```text
resource-limit
unreadable-or-corrupt-workbook
unsupported-or-incompatible-version
workbook-structure
invalid-workbook-values
invalid-business-data
unexpected-import-failure
```

Recovery action codes remain UI-agnostic guidance:

```text
select-another-file
restore-known-good-backup
reduce-workbook-size
open-with-compatible-or-newer-app
repair-workbook-structure
correct-source-data
retry-or-report-unexpected-error
```

## Resource-limit contract

```text
maxWorkbookBytes       20 MiB
maxWorksheetCount      32
maxColumnsPerSheet     64
maxRowsPerSheet        50,000 data rows
maxTotalRows           150,000 data rows
maxTotalCells          2,000,000 cell slots including header rows
```

## Final regression evidence before docs closeout

Phase 5.4C3 implementation merge:

```text
Baseline develop        a22c6df34ec16fd853e6278e44fd6cf760521f44
Baseline CI             35054630120 — SUCCESS
Corrected feature head  e388b6c3d0252d5475f0fb961d6be9d82721574d
Branch CI               35055251724 — SUCCESS
Implementation PR #184 MERGED
PR CI                   35055338528 — SUCCESS
Implementation merge   8af74f1be40f1d60a4f41235162f19e1a7541a14
Post-merge CI          35055416159 — SUCCESS
111 test files / 1302 tests
14 focused C3 tests
Typecheck PASS
Production build PASS
133 modules transformed
```

## Phase 5.4 completion decision

All three Phase 5.4 workstreams are complete and regression-green:

```text
5.4A COMPLETE
5.4B COMPLETE
5.4C COMPLETE
```

Therefore **Phase 5.4 — Version Compatibility, Backup & Recovery Safety is COMPLETE**.

## Explicit remaining boundaries

Phase 5.4 does not implement:

- React import/open/save/recovery controls;
- native file dialogs or OS paths;
- native Tauri filesystem behavior;
- OS-level file locks, rename atomicity, `fsync`, or crash consistency;
- automatic selection/loading of a backup file;
- antivirus/malware scanning;
- legacy `.xls` / `.xlsm` support;
- Google Sheets integration.

Those remain later roadmap work.

## Next task

After this completion record and the Phase 5 tracker closeout are merged with green CI, advance exactly to:

```text
5.5A — Import / Open Workbook Workflow — NEXT / NOT STARTED
```

Do not begin Phase 5.5A automatically.
