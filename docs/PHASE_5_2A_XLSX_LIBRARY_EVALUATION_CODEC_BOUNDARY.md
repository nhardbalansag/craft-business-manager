# Phase 5.2A — XLSX Library Evaluation & Codec Boundary

## Status

**IMPLEMENTATION VALIDATED — PR / MERGE PENDING**

Planning document:

`docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY_PLAN.md`

Authoritative implementation base:

```text
develop  e5707cc297887a9817957c2ac658caeb18d42d21
CI       35001226969 — SUCCESS
```

Feature branch:

`feature/phase-5-2a-xlsx-library-evaluation-codec-boundary`

---

## Selection decision

**Selected library: SheetJS Community Edition 0.20.3**

Authoritative package source:

`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`

The dependency is intentionally pinned to the exact upstream release URL rather than the stale public npm `xlsx` package.

Current source checks used for the decision:

- SheetJS Node installation: `https://docs.sheetjs.com/docs/getting-started/installation/nodejs/`
- SheetJS framework/bundler installation: `https://docs.sheetjs.com/docs/getting-started/installation/frameworks/`
- SheetJS formula model: `https://docs.sheetjs.com/docs/csf/features/formulae/`
- SheetJS local byte access: `https://docs.sheetjs.com/docs/demos/local/file/`
- SheetJS CDN / Apache-2.0 licensing: `https://cdn.sheetjs.com/`
- SheetJS CVE-2023-30533 remediation: `https://cdn.sheetjs.com/advisories/CVE-2023-30533`
- SheetJS CVE-2024-22363 remediation: `https://cdn.sheetjs.com/advisories/CVE-2024-22363`

The selected release satisfies the 5.2A hard gates:

- browser/framework/bundler-compatible ESM package;
- in-memory `ArrayBuffer` / `Uint8Array` read support;
- in-memory workbook byte generation;
- formulas exposed separately from literal values when `cellFormula: true` is used;
- no filesystem API required by the codec;
- current SheetJS security advisories identify the prototype-pollution issue as fixed in `0.19.3+` and the ReDoS issue as fixed in `0.20.2+`; selected `0.20.3` is beyond both remediation floors;
- Apache-2.0 permits commercial use subject to its license/notice requirements.

## Fallback decision

Approved fallback if SheetJS later fails a Phase 5 requirement:

`@excel.js/exceljs`

At the evaluation date its public npm package is actively published and MIT-licensed, but it is not needed because the primary candidate passed the repository-specific spike.

## Candidates not selected

### Public npm `xlsx`

Not selected. The public npm registry package is stale relative to the current authoritative SheetJS CDN releases and should not be substituted for the pinned upstream package.

### Original `exceljs`

Not selected as the primary path. Its long-standing public release remains `4.4.0`; current dependency/build maintenance concerns make the actively evaluated SheetJS path preferable for this application.

### `read-excel-file` / `write-excel-file`

Not selected for the authoritative codec because formula-cell visibility/rejection is a hard import-safety requirement and the reader documents formula cells as unsupported.

### `xlsx-populate`

Not selected because maintenance age is not competitive with the selected path.

---

## Dependency change

`package.json` now pins:

```json
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

The repository does not currently commit a `package-lock.json`, so no lockfile was omitted or left stale by this change.

The first CI install with this dependency succeeded and installed the dependency graph normally under Node 22 / npm 10.

### Supply-chain note

SheetJS upstream recommends vendoring its release tarball for stronger offline/reproducible supply-chain control. The Phase 5 implementation currently uses the exact versioned upstream URL. Before production packaging/distribution, the project should reassess whether to vendor the selected tarball and include Apache-2.0 attribution/license material in the application distribution.

---

# Delivered codec boundary

## Library-neutral contract

Added:

`src/storage/workbookCodec.ts`

The application-facing boundary is intentionally independent from SheetJS:

```text
WorkbookCodec
├── encode(WorkbookNeutralDocument) -> Uint8Array
└── decode(Uint8Array | ArrayBuffer) -> WorkbookNeutralDocument
```

The contract reuses the 5.1B neutral workbook representation instead of leaking third-party worksheet/workbook types into the domain or application layers.

Controlled codec errors use `WorkbookCodecError` with stable codes for:

```text
INVALID_DOCUMENT
INVALID_SHEET
INVALID_CELL_VALUE
FORMULA_WRITE_NOT_ALLOWED
INVALID_HEADER_CELL
XLSX_ENCODE_FAILED
XLSX_DECODE_FAILED
```

## SheetJS adapter

Added:

`src/storage/sheetJsWorkbookCodec.ts`

`SheetJsWorkbookCodec` is the only production module introduced by 5.2A that imports `xlsx`.

It provides:

- fully in-memory XLSX encoding;
- fully in-memory XLSX decoding;
- `Uint8Array` output;
- `Uint8Array` and `ArrayBuffer` input;
- worksheet order preservation;
- primitive literal values only on encode;
- formula-write rejection at the authoritative codec boundary;
- formula metadata preservation on decode through `WorkbookFormulaCell`;
- formula header rejection;
- non-text header rejection;
- finite-number enforcement before XLSX encoding;
- controlled wrapping of SheetJS encode/decode failures;
- no Node `fs`, browser file picker, Tauri filesystem, or native path dependency.

## Formula safety

5.2A proves both directions needed by the Phase 5 architecture.

### Outbound

Formula-looking user strings such as:

```text
=1+1
+SUM(A1:A2)
-1+2
@SUM(A1:A2)
```

are passed to SheetJS as ordinary string values and round-trip as literal text rather than executable formula cells.

The authoritative encode boundary refuses a `WorkbookFormulaCell` input entirely.

### Inbound

The adapter reads with:

```text
cellFormula: true
```

A real XLSX formula cell is reconstructed as:

```text
{
  formula: "...",
  cachedValue: ...
}
```

rather than being mistaken for a primitive source value.

That neutral formula value is directly compatible with the existing 5.1B workbook-schema rule, which emits `FORMULA_CELL_NOT_ALLOWED` for authoritative source columns.

No formula evaluation engine was added.

---

# Focused spike tests

Added:

`src/storage/sheetJsWorkbookCodec.test.ts`

The 12 focused tests prove:

1. the runtime library reports exact version `0.20.3`;
2. the SheetJS adapter satisfies the library-neutral `WorkbookCodec` interface;
3. mixed primitive workbook sheets round-trip through real `.xlsx` bytes in memory;
4. `ArrayBuffer` input is supported in addition to `Uint8Array`;
5. worksheet order survives the round-trip;
6. formula-looking strings remain literal text;
7. authoritative encode rejects formula objects;
8. a real formula cell is surfaced as formula metadata without being evaluated as source data;
9. decoded formula metadata feeds the existing `FORMULA_CELL_NOT_ALLOWED` workbook-schema validation rule;
10. formula/non-text header cells fail through controlled codec errors;
11. duplicate sheet names and non-finite outbound cell values fail before XLSX encoding;
12. the entire spike works without filesystem access.

---

# First checkpoint and correction

Initial spike head:

`62feaef38bebbe52bc903f5b17da6572e5495550`

CI:

`35002241556 — FAILURE`

The upstream package installed successfully. TypeScript then rejected one strict callback parameter in the adapter:

```text
src/storage/sheetJsWorkbookCodec.ts
TS7006: Parameter 'column' implicitly has an 'any' type.
```

Tests/build correctly did not run.

The correction explicitly typed that validation callback parameter as `unknown`; no codec behavior, package decision, or safety rule changed.

Corrected spike head:

`e1ae246b7d31c35330a2f1fb7d1624797700c004`

CI:

`35002380964 — SUCCESS`

Validation evidence:

```text
TypeScript typecheck       PASS
Test files                 85 passed
Tests                      1060 passed
5.2A focused tests         12 passed
React workspace smoke      8 passed
Phase 4.6A integration     7 passed
Production Vite build      PASS
Modules transformed        117
Main JS                    ~537.95 kB minified
Main JS gzip               ~136.60 kB
```

The pre-existing Vite warning for the main application chunk remaining slightly above 500 kB is unchanged in practical scope.

The production application bundle did **not** absorb SheetJS during 5.2A because the codec is not yet reachable from the React entry graph. This is intentional. 5.2B/5.5 must remeasure bundle impact when real persistence usage becomes application-reachable and should prefer deferred/dynamic loading if that meaningfully protects initial UI load cost.

---

# Scope exclusions preserved

5.2A does **not** implement:

- `BusinessDataset -> WorkbookNeutralDocument` mapping;
- deterministic canonical Phase 5 export rows;
- normalized child-sheet export;
- `_Meta` generation from business state;
- workbook-to-dataset reconstruction;
- strict 5.2C workbook diagnostics beyond the generic codec boundary;
- repository snapshot/hydration;
- `ExcelStorage.load/save` runtime behavior;
- browser open/save UI;
- backup or atomic replace behavior;
- Tauri filesystem/dialog behavior.

Those remain in their planned later tasks.

---

## Selection conclusion

**SheetJS Community Edition 0.20.3 is selected as the Phase 5 XLSX codec implementation library.**

The selection is based on the current upstream maintenance/security information plus a repository-specific executable spike proving the exact capabilities needed by this application.

## Current gate

Before 5.2A can be marked COMPLETE:

1. this documented feature head must pass exact CI;
2. the implementation PR to `develop` must pass exact PR CI;
3. the exact green PR head must be guarded-merged;
4. the resulting exact implementation merge on `develop` must pass push CI;
5. a docs-only closeout must mark 5.2A COMPLETE and advance 5.2B to NEXT / NOT STARTED;
6. the final closeout `develop` commit must pass exact CI.

Do not begin 5.2B implementation as part of 5.2A closeout.
