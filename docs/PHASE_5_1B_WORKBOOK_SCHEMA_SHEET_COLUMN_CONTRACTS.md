# Phase 5.1B — Workbook Schema / Sheet / Column Contracts

## Status

**COMPLETE**

Plan:

`docs/PHASE_5_1B_WORKBOOK_SCHEMA_SHEET_COLUMN_CONTRACTS_PLAN.md`

Authoritative implementation base:

```text
develop  ad11e171ab7a49ea978372a3879222db8f6b112e
CI       34988367766 — SUCCESS
```

Implementation branch:

`feature/phase-5-1b-workbook-schema-contracts`

Implementation PR:

`#134 — Phase 5.1B — Workbook schema contracts — MERGED`

Implementation merge:

`9b5ca56f8574f922218fafa18540e7b11606d4b9`

Exact post-merge `develop` CI:

`34993623712 — SUCCESS`

## Delivered

Phase 5.1B introduces a library-independent workbook contract under `src/storage` without selecting or integrating an XLSX library.

Implementation surface:

```text
src/storage/workbookSchema.ts
src/storage/workbookSchema.test.ts
```

The implementation establishes:

- workbook format ID `craft-business-manager`;
- workbook format version `1`, separate from `CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1`;
- exact 13-sheet canonical registry;
- every canonical sheet required even when its source collection is empty;
- exact ordered canonical columns and explicit source semantic mappings;
- normalized child sheets for `MixPreset.compatibleCategories[]`, `MixPreset.lines[]`, and `YieldSample.materialInputs[]`;
- 1-based workbook-only reconstruction order fields `categoryOrder`, `lineOrder`, and `inputOrder`;
- complete top-level `BusinessDataset` source-collection-to-primary-sheet coverage;
- explicit Material source-metadata flattening;
- paired `pricingMethod` / `pricingValue` encoding for nullable Product pricing policy while preserving explicit numeric zero;
- canonical enum and unit tokens instead of display labels;
- raw finite numeric source representation without business rounding;
- ISO-compatible timestamp fields represented as literal text contracts;
- literal-only text / formula-cell rejection policy for authoritative workbook fields;
- deterministic sheet and row-order metadata;
- workbook-neutral schema representations independent from any `.xlsx` package;
- controlled structural diagnostics for missing/duplicate sheets and columns, column order, cell primitive shape, enum/unit tokens, child ordering, metadata versioning, paired pricing fields, and formula cells;
- unknown extra worksheets/columns treated as non-authoritative rather than guessed as application state.

## Boundary intentionally preserved

Phase 5.1B does **not**:

- add an XLSX dependency;
- generate or parse real `.xlsx` bytes;
- modify `ExcelStorage` runtime behavior;
- validate duplicate business identities;
- validate Material/Product/MixPreset references;
- validate ProductComponent source relationships or composition cycles;
- hydrate repositories;
- implement backups, file replacement, UI workflows, or Tauri filesystem behavior.

Business/reference/graph integrity remains Phase 5.1C.

## Focused validation

The dedicated `workbookSchema.test.ts` suite contains **22 tests** covering:

- format identity and version separation;
- exact 13-sheet order;
- complete source-collection coverage;
- normalized parent/child relationships;
- exact columns for all canonical sheets;
- Material source mappings;
- pricing null/zero/pair semantics;
- child order metadata;
- canonical enum/unit tokens;
- timestamp and formula policies;
- deterministic row-order metadata;
- empty-source workbook validity;
- missing/duplicate/reordered schema elements;
- missing cell versus explicit `0` / `false` semantics;
- primitive/enum/unit diagnostics;
- invalid child order diagnostics;
- literal formula-looking text versus formula-typed cells;
- unsupported workbook/dataset versions;
- permitted non-authoritative extra sheets/columns;
- malformed workbook-neutral input.

## Validation evidence

### First implementation checkpoint

```text
Head  1416c41ae0a97e74ad8b152706906514d7f85c0c
CI    34993126608 — FAILURE
```

The first checkpoint failed at TypeScript typecheck before tests/build because `Object.fromEntries(...)` could not safely prove the complete `Record<WorkbookSheetName, WorkbookSheetContract>` shape.

This was a compile-time registry-construction typing issue only. No workbook-schema rule or test had failed.

Correction:

- replaced the ambiguous `Object.fromEntries(...)` cast with an explicit typed registry construction;
- kept the exact same sheet/column/validation contract;
- did not weaken any type or runtime validation rule.

### Corrected implementation checkpoint

```text
Head  7782d0ad7e77c6d52db928164ba9ae1facff4d55
CI    34993382846 — SUCCESS
```

### Documented feature head

```text
Head  fd45db3a23bf7d00fc51e65fd36c354d61f2c5a4
CI    34993513561 — SUCCESS
```

### Merge validation

```text
PR #134                  MERGED
Expected feature head    fd45db3a23bf7d00fc51e65fd36c354d61f2c5a4
Implementation merge     9b5ca56f8574f922218fafa18540e7b11606d4b9
Post-merge develop CI    34993623712 — SUCCESS
```

Validated results:

```text
TypeScript typecheck                    PASS
Full test files                         83 passed / 83
Full tests                              1018 passed / 1018
Phase 5.1B focused tests                22 passed
React workspace smoke tests             8 passed
Phase 4.6A real-service integration      7 passed
Production Vite build                   PASS
Modules transformed                     117
```

The existing Vite warning remains non-blocking:

```text
main minified JS ~537.87 kB (> 500 kB warning threshold)
gzip ~136.60 kB
```

It is unchanged from prior phases and is a future code-splitting/performance concern rather than a Phase 5.1B correctness blocker.

## Completion decision

All 5.1B implementation and merge gates are satisfied. The workbook schema contract is now authoritative on `develop` at implementation merge `9b5ca56f8574f922218fafa18540e7b11606d4b9`, backed by exact successful CI `34993623712`.

Phase 5.1C has **not** started. Its scope remains dataset-level business identity, cross-reference, relationship, and Product composition-graph validation before hydration.
