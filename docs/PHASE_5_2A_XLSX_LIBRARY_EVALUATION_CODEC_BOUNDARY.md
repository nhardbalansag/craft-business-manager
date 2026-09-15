# Phase 5.2A — XLSX Library Evaluation & Codec Boundary

## Status

**COMPLETE**

Planning document:

`docs/PHASE_5_2A_XLSX_LIBRARY_EVALUATION_CODEC_BOUNDARY_PLAN.md`

Authoritative implementation base:

```text
develop  e5707cc297887a9817957c2ac658caeb18d42d21
CI       35001226969 — SUCCESS
```

Implementation branch:

`feature/phase-5-2a-xlsx-library-evaluation-codec-boundary`

---

## Selection decision

**Selected library: SheetJS Community Edition 0.20.3**

Authoritative package source:

`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`

The dependency is intentionally pinned to the exact upstream release URL rather than the stale public npm `xlsx` package.

Source checks used for the selection included the current SheetJS Node/framework installation guidance, formula model, in-memory file access guidance, Apache-2.0 distribution information, and the published remediation guidance for CVE-2023-30533 and CVE-2024-22363.

The selected release satisfied the 5.2A hard gates:

- browser/framework/bundler-compatible package;
- in-memory `ArrayBuffer` / `Uint8Array` read support;
- in-memory workbook byte generation;
- formulas exposed separately from literal values when `cellFormula: true` is used;
- no filesystem API required by the codec;
- selected `0.20.3` is newer than both documented SheetJS security-remediation floors used during evaluation;
- Apache-2.0 permits commercial use subject to license/notice obligations.

Approved fallback if SheetJS later fails a Phase 5 requirement:

`@excel.js/exceljs`

Not selected:

- public npm `xlsx` — stale relative to maintained upstream SheetJS releases;
- original `exceljs` — mature but less attractive for this project given release/dependency/browser-maintenance concerns reviewed during 5.2A;
- `read-excel-file` / `write-excel-file` — authoritative import unsuitable because formula-cell visibility is a hard requirement;
- `xlsx-populate` — maintenance age not competitive for a new user-file persistence dependency.

---

## Dependency decision

`package.json` now pins:

```json
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

The repository does not currently commit a `package-lock.json`, so no lockfile was omitted or left stale.

The selected upstream package installed successfully under the repository CI Node/npm environment.

### Supply-chain follow-up

SheetJS upstream recommends vendoring its release tarball for stronger offline/reproducible supply-chain control. Phase 5 currently pins the exact upstream versioned URL. Before production packaging/distribution, reassess vendoring and ensure Apache-2.0 attribution/license material is included where required.

---

# Delivered codec boundary

## Library-neutral contract

Added:

`src/storage/workbookCodec.ts`

```text
WorkbookCodec
├── encode(WorkbookNeutralDocument) -> Uint8Array
└── decode(Uint8Array | ArrayBuffer) -> WorkbookNeutralDocument
```

The contract reuses the Phase 5.1B neutral workbook representation. SheetJS types do not leak into domain models, application services, repositories, React, `StoragePort`, or future Tauri transport contracts.

Controlled codec errors:

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

- fully in-memory XLSX encoding and decoding;
- `Uint8Array` output;
- `Uint8Array` and `ArrayBuffer` input;
- worksheet-order preservation;
- primitive literal values only on encode;
- formula-write rejection at the authoritative codec boundary;
- formula metadata preservation on decode through `WorkbookFormulaCell`;
- formula-header rejection;
- non-text-header rejection;
- finite-number enforcement before XLSX encoding;
- controlled wrapping of SheetJS encode/decode failures;
- no Node `fs`, browser file picker, Tauri filesystem, or native-path dependency.

## Formula safety

Outbound formula-looking strings such as:

```text
=1+1
+SUM(A1:A2)
-1+2
@SUM(A1:A2)
```

round-trip as literal text rather than executable formula cells.

The authoritative encode boundary refuses a `WorkbookFormulaCell` input.

Inbound XLSX decoding uses:

```text
cellFormula: true
```

A real formula cell is reconstructed as neutral metadata:

```text
{
  formula: "...",
  cachedValue: ...
}
```

That representation feeds the existing Phase 5.1B `FORMULA_CELL_NOT_ALLOWED` workbook-schema rule. No formula evaluation engine was added.

---

# Focused tests

Added:

`src/storage/sheetJsWorkbookCodec.test.ts`

The 12 focused tests prove:

1. exact runtime SheetJS version `0.20.3`;
2. implementation of the library-neutral `WorkbookCodec` interface;
3. real XLSX primitive round-trip entirely in memory;
4. `ArrayBuffer` input support;
5. worksheet-order preservation;
6. formula-looking strings remain literal;
7. authoritative formula-object writes are rejected;
8. real formula cells are exposed as formula metadata;
9. decoded formula metadata reaches the existing `FORMULA_CELL_NOT_ALLOWED` validation rule;
10. formula/non-text headers fail through controlled codec errors;
11. duplicate sheet names and non-finite outbound values fail before XLSX encoding;
12. no filesystem access is required.

---

# Validation history

### Initial spike checkpoint

```text
Head  62feaef38bebbe52bc903f5b17da6572e5495550
CI    35002241556 — FAILURE
```

The exact upstream dependency installed successfully. TypeScript then rejected one strict callback parameter:

```text
src/storage/sheetJsWorkbookCodec.ts
TS7006: Parameter 'column' implicitly has an 'any' type.
```

Tests/build correctly did not run.

The correction typed that callback parameter as `unknown`; codec behavior, package selection, and safety rules were unchanged.

### Corrected spike checkpoint

```text
Head  e1ae246b7d31c35330a2f1fb7d1624797700c004
CI    35002380964 — SUCCESS
```

### Documented feature head

```text
Head  44a60d0032391ee99c6550fd4c6ae1b0d651ad94
CI    35002575999 — SUCCESS
```

### Implementation PR / merge

```text
PR #140                  MERGED
PR CI                    35002720788 — SUCCESS
Implementation merge     8468edf288b014a00f4f1529442fa043084f1102
Post-merge develop CI    35002844064 — SUCCESS
```

Integrated validation baseline:

```text
85 test files / 1060 tests
12 Phase 5.2A focused tests
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
Main JS ~537.95 kB minified / ~136.60 kB gzip
```

The existing Vite warning for the main application chunk remaining slightly above 500 kB is still non-blocking.

SheetJS did not enter the React production entry bundle during 5.2A because the codec is not yet application-reachable. Phase 5.2B/5.5 must remeasure bundle impact when persistence becomes reachable and should use deferred/dynamic loading if that materially protects initial UI load cost.

---

# Scope exclusions preserved

5.2A did **not** implement:

- `BusinessDataset -> WorkbookNeutralDocument` mapping;
- deterministic canonical Phase 5 export rows;
- normalized child-sheet export;
- `_Meta` generation from business state;
- workbook-to-dataset reconstruction;
- Phase 5.2C strict import diagnostics/reconstruction;
- repository snapshot/hydration;
- `ExcelStorage.load/save` runtime behavior;
- browser open/save UI;
- backup or atomic replace behavior;
- Tauri filesystem/dialog behavior.

---

## Completion result

**SheetJS Community Edition 0.20.3 is the selected Phase 5 XLSX codec implementation library.**

The Phase 5 storage layer now has a library-neutral workbook-byte codec boundary plus a validated in-memory SheetJS adapter.

## Next task

**5.2B — Deterministic Dataset-to-XLSX Export — NEXT / NOT STARTED**

Do not begin 5.2B implementation as part of this closeout. It must start separately from the exact final green 5.2A closeout baseline and must receive its own scope/decomposition review and development plan before implementation.
