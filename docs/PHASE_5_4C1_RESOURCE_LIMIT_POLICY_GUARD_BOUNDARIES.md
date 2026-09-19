# Phase 5.4C1 — Resource Limit Policy & Guard Boundaries

Status: **COMPLETE**

Parent:

`5.4C — Corruption, Limits & Recovery Diagnostics`

## Authoritative evidence

```text
Planning baseline        a973792ef1c9fca7dbd7681b7aa6dff8ee068a1c
Planning baseline CI     35052042769 — SUCCESS
Feature branch           feature/phase-5-4c1-resource-limit-guards
Clean feature head       3978afe587ae268b4f03df1b5e1303b292f13c34
Clean branch CI          35052920663 — SUCCESS
Implementation PR        #180 — MERGED
PR CI                    35052995585 — SUCCESS
Implementation merge     a5e17553a0680bd4982ce22369360df9ef6b5e79
Post-merge develop CI    35053072059 — SUCCESS
```

Validation at the C1 implementation gate:

```text
109 test files / 1266 tests
21 new focused C1 tests
TypeScript typecheck — PASS
Production Vite build — PASS
133 modules transformed
```

## Delivered contract

Phase 5.4C1 establishes one explicit workbook resource-limit policy shared by the authoritative XLSX import path and the concrete SheetJS decoder.

Default guardrails:

```text
maxWorkbookBytes       20 MiB
maxWorksheetCount      32
maxColumnsPerSheet     64
maxRowsPerSheet        50,000 data rows
maxTotalRows           150,000 data rows
maxTotalCells          2,000,000 cell slots including header rows
```

The defaults are named, immutable, and validated as positive safe integers. Test-only/controlled callers may provide bounded overrides through the storage-layer contract; no React or user-configurable bypass was introduced.

## Guard ordering

The authoritative import path now applies resource protection in three layers:

```text
XLSX bytes
  -> byte-size guard
  -> WorkbookCodec.decode(...)
       -> SheetJS worksheet-count / declared-range guard
       -> neutral workbook materialization
  -> neutral-document resource guard
  -> compatibility / migration preparation
  -> strict current workbook schema
  -> reconstruction
  -> dataset integrity validation
  -> hydration
```

### 1. Pre-decode byte guard

`importBusinessDatasetFromXlsx(...)` checks the input byte length before invoking `WorkbookCodec.decode(...)`.

An over-limit workbook therefore:

- returns a controlled `resource-limit` import rejection;
- does not call codec decode;
- does not reach compatibility/schema/reconstruction;
- does not reach hydration.

### 2. SheetJS pre-expansion range guard

`SheetJsWorkbookCodec` checks:

- worksheet count;
- declared columns per worksheet;
- declared data rows per worksheet;
- aggregate data rows;
- aggregate cell slots including header rows.

These checks occur after SheetJS opens the workbook container but before the adapter loops through the declared worksheet range to build neutral rows/cells.

No `sheetRows`-style silent truncation is used. Oversized input fails closed instead of becoming an incomplete authoritative dataset.

### 3. Post-decode neutral-document guard

The authoritative importer validates the decoded neutral workbook again before compatibility/schema/reconstruction.

This prevents a custom or alternate `WorkbookCodec` implementation from bypassing application-level resource limits.

## Structured diagnostics

Resource failures use distinct codes:

```text
WORKBOOK_BYTES_EXCEEDED
WORKSHEET_COUNT_EXCEEDED
SHEET_COLUMNS_EXCEEDED
SHEET_ROWS_EXCEEDED
TOTAL_ROWS_EXCEEDED
TOTAL_CELLS_EXCEEDED
```

Each diagnostic preserves, where applicable:

```text
stage = resource-limit
limit kind
actual measured value
allowed maximum
worksheet name
```

Resource limits remain separate from workbook schema validation and business-domain validation.

## Safety regression evidence

C1 tests prove:

- exact-at-limit byte input is accepted;
- one-byte-over input rejects before codec decode;
- worksheet-count limits reject deterministically;
- per-sheet column and row limits retain worksheet context;
- aggregate row and cell limits reject deterministically;
- SheetJS rejects excessive declared worksheet ranges before neutral row expansion;
- arbitrary/custom codec output is checked again after decode;
- limit policy construction rejects invalid values;
- normal current v1/v1 real-XLSX import remains unchanged;
- `PersistenceCoordinator` returns controlled import rejection and never calls hydration for resource-limit failure.

## Boundary decisions preserved

C1 does **not**:

- duplicate existing workbook schema or dataset validation;
- change workbook/dataset public version v1/v1;
- add migration registrations;
- change hydration rollback;
- change save/backup/atomic-write semantics;
- add recovery classification or UI guidance;
- add React controls;
- add native filesystem, file dialogs, locking, `fsync`, or crash-consistency guarantees;
- claim complete ZIP-bomb/malware sandboxing.

SheetJS must still parse enough of the XLSX container to discover worksheet metadata. The C1 contract provides practical application-level browser safeguards, not an operating-system security sandbox.

## Next task

```text
5.4C2 — Corruption / Recovery Diagnostic Classification
NEXT / NOT STARTED
```

Do not begin 5.4C2 until this C1 closeout PR is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
