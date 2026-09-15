# Phase 5.2A — XLSX Library Evaluation & Codec Boundary — Development Plan

## Status

**PLAN ONLY — IMPLEMENTATION NOT STARTED**

Repository:

`nhardbalansag/craft-business-manager`

Authoritative planning base:

```text
develop  7efef34fac309f9d9745631a54bc8a8ba404415f
CI       34998382050 — SUCCESS
```

Parent phase:

**5.2 — XLSX Workbook Codec**

Previous completed foundation:

**5.1 — Persisted Dataset & Workbook Contract Foundation — COMPLETE**

---

## 1. Purpose

Phase 5.2A selects and proves the concrete JavaScript/TypeScript XLSX engine that will sit behind the existing library-independent persistence contracts.

It must also establish a small internal codec boundary so later Phase 5 work can read and write `.xlsx` bytes without allowing third-party workbook/cell types to leak into the domain, application services, React UI, repository interfaces, or Tauri filesystem layer.

5.2A is deliberately a **bounded evaluation + adapter spike**. It does not implement production dataset export or import.

---

## 2. Split assessment

### Decision

**5.2A does not require deeper formal numbered sub-phases.**

The task is one atomic technology-selection gate: the library decision is not complete until the selected library has passed the same browser-compatible in-memory codec smoke tests and the adapter boundary is proven.

Implementation should use internal checkpoints rather than new roadmap phases:

```text
Checkpoint A — Candidate verification / decision matrix
Checkpoint B — Library-neutral codec contract
Checkpoint C — In-memory browser-compatible XLSX spike
Checkpoint D — Formula / literal-text / primitive-type safety tests
Checkpoint E — Bundle / dependency / security / license review
Checkpoint F — Final selected-library decision record
```

If a primary candidate fails a hard gate, 5.2A may test the approved fallback candidate within the same task. That is not a reason to split the roadmap.

---

## 3. Existing repository constraints

The current project is:

- React 19;
- TypeScript 5.8;
- Vite 7;
- Vitest 5;
- ESM (`"type": "module"`);
- browser-first for Phase 5 codec behavior;
- Tauri 2 filesystem integration deferred to Phase 6.

There is currently **no spreadsheet/XLSX dependency installed**.

`ExcelStorage` remains an intentional placeholder.

Phase 5.1 already established:

1. the complete nine-collection `BusinessDataset` source contract;
2. the 13-sheet workbook v1 schema and column contracts;
3. formula policy (`literal-only` for authoritative text and `reject` for authoritative non-text fields);
4. deterministic workbook ordering requirements;
5. the complete pre-hydration semantic/reference validator.

5.2A must integrate with those contracts rather than redefine them.

---

## 4. Hard selection requirements

A candidate cannot be selected unless it satisfies all of the following.

### 4.1 Browser / Vite / Tauri-front-end compatibility

The library must:

- work in a modern browser bundle produced by Vite;
- work without Node-only filesystem APIs at the codec boundary;
- accept workbook input from `Uint8Array` and/or `ArrayBuffer`;
- emit XLSX bytes as `Uint8Array` and/or `ArrayBuffer`;
- not require Electron, Excel, LibreOffice, Python, Java, or a backend service;
- remain usable from a future Tauri webview while file acquisition/storage stays outside the codec.

### 4.2 Required primitive cell support

The spike must prove read/write behavior for:

- string;
- number;
- boolean;
- blank / absent cell;
- exact sheet names;
- ordered rows/columns.

Dates are **not** required as authoritative Excel date cells because Phase 5 intentionally preserves source timestamps as deterministic ISO text.

### 4.3 Formula visibility and rejection

This is a hard gate.

The selected parser must expose enough cell metadata to distinguish a real formula cell from a literal text value.

The codec must be able to support this Phase 5 rule:

```text
formula-typed authoritative cell -> reject
formula-looking literal text     -> preserve as text
```

It is not sufficient to expose only a cached calculated value while hiding the presence of a formula.

The application does not need a formula calculation engine.

### 4.4 Literal-text safety

The spike must prove that strings such as:

```text
=SUM(A1:A2)
+123
-1+1
@example
```

can be written as literal text and read back as literal text rather than becoming executable spreadsheet formulas.

No spreadsheet formula is authoritative application logic.

### 4.5 License suitability

The selected dependency must permit commercial/proprietary application distribution under terms the project can comply with.

Any attribution/notice obligations must be documented before selection.

### 4.6 Maintenance and release health

Evaluate:

- current release recency;
- active maintenance or credible stewardship;
- browser/build compatibility;
- unresolved compatibility issues relevant to Vite/modern Node tooling;
- dependency health.

Popularity alone is not sufficient.

### 4.7 Security history

The selected exact version and installation source must be checked for known unresolved high/critical advisories relevant to reading untrusted `.xlsx` files.

The plan must distinguish a stale registry artifact from the maintained upstream release when those differ.

### 4.8 Bundle/runtime cost

Record the practical browser cost of the selected adapter/library.

At minimum capture:

- dependency footprint;
- bundler compatibility;
- whether the codec can be lazy/dynamically imported later;
- an isolated browser bundle size or equivalent reproducible measurement;
- whether the selection adds Node polyfills to the browser bundle.

The existing application already has a non-blocking ~538 kB main-chunk warning. 5.2A must not hide a material codec-size increase inside the main application bundle without documenting it.

---

## 5. Candidate research snapshot

Research snapshot date:

**2026-09-16**

This snapshot is evidence for planning. Exact package/version/security facts must be rechecked again at implementation time before a dependency is committed.

### 5.1 SheetJS Community Edition — primary spike candidate

Current upstream documentation reports:

```text
version       0.20.3
license       Apache-2.0
browser       supported
ESM/bundlers  supported
read bytes    Uint8Array / ArrayBuffer
write bytes   Uint8Array / ArrayBuffer
formula meta  exposed through cell `f`
```

Important distribution rule:

The maintained SheetJS CE release is distributed from the SheetJS authoritative CDN/package tarball. The historical `xlsx` package on the public npm registry is stale and must **not** be treated as the current upstream package.

Security history relevant to this project:

- CVE-2023-30533 prototype pollution affected releases before 0.19.3; upstream remediation is 0.19.3+;
- CVE-2024-22363 ReDoS affected releases before 0.20.2; upstream remediation is 0.20.2+;
- the currently documented 0.20.3 release is newer than both remediation thresholds.

Why it is the **primary candidate**:

- mature XLSX parse/write support;
- direct in-memory byte APIs match Phase 5 architecture;
- explicit formula metadata directly supports fail-closed formula rejection;
- browser and bundler guidance is documented;
- no formula evaluator is required for this project;
- permissive commercial-use license.

Risk/verification items:

- nonstandard dependency acquisition from an authoritative tarball/CDN instead of normal npm registry release;
- Apache-2.0 notice/attribution obligations;
- exact Vite 7 bundle size and tree-shaking behavior;
- reproducible dependency pinning/lockfile behavior;
- current advisory check at implementation time.

Official references:

- https://docs.sheetjs.com/docs/getting-started/installation/frameworks/
- https://docs.sheetjs.com/docs/getting-started/installation/standalone/
- https://docs.sheetjs.com/docs/demos/local/file/
- https://docs.sheetjs.com/docs/csf/features/formulae/
- https://docs.sheetjs.com/docs/miscellany/license/
- https://cdn.sheetjs.com/advisories/CVE-2023-30533
- https://cdn.sheetjs.com/advisories/CVE-2024-22363

### 5.2 `@excel.js/exceljs` — approved fallback candidate

Research snapshot:

```text
package        @excel.js/exceljs
version        0.15.0
license        MIT
publish state  actively published in 2026
browser model  document-based workbook API
formula model  explicit formula/result values
```

This is an active fork of ExcelJS and is a reasonable fallback if SheetJS fails a hard implementation gate.

Why it is not the primary candidate yet:

- it is a comparatively young fork with materially less adoption history than the original package;
- browser/Vite behavior and dependency footprint must be proven in this repository rather than assumed from the original ExcelJS lineage.

Reference:

- https://www.npmjs.com/package/@excel.js/exceljs

### 5.3 Original `exceljs` — not preferred for new selection

Research snapshot:

```text
version   4.4.0
license   MIT
release   published years ago
```

The original project supports browser document workbooks and exposes formula values, but it is not preferred for a new dependency decision because:

- current npm release 4.4.0 is old;
- 2026 project discussions/issues continue to report deprecated/outdated dependencies and security-related dependency work;
- a current Vite/Rollup browser build issue is open;
- maintainers/community discussions point users toward maintained forks.

It may be used as historical comparison evidence, not as the default implementation target.

References:

- https://www.npmjs.com/package/exceljs
- https://github.com/exceljs/exceljs/discussions/3040
- https://github.com/exceljs/exceljs/issues

### 5.4 `read-excel-file` + `write-excel-file` — rejected for Phase 5 authoritative import

These packages are actively maintained, MIT licensed, and browser-friendly.

However, `read-excel-file` explicitly states that formula cells are not supported.

That fails a Phase 5 hard requirement because the importer must distinguish formula cells from authoritative literal values and reject formula-typed source cells deterministically.

Therefore this pair is **not eligible** for the authoritative codec even though its API is otherwise attractive.

References:

- https://www.npmjs.com/package/read-excel-file
- https://www.npmjs.com/package/write-excel-file

### 5.5 `xlsx-populate` — rejected as primary dependency

Research snapshot:

```text
version      1.21.0
license      MIT
last publish approximately 7 years ago
browser      historically supported
```

The maintenance age is too high for a new persistence dependency handling user-supplied workbooks.

Reference:

- https://www.npmjs.com/package/xlsx-populate

### 5.6 Emerging pre-1.0 libraries — watchlist only

New TypeScript-first XLSX libraries exist in 2026, but an explicitly pre-1.0/alpha package should not displace a mature primary candidate for this application's v1 persistence layer without a strong technical need.

They may be revisited later if both approved candidates fail hard gates.

---

## 6. Provisional candidate order

The implementation spike should proceed in this order:

```text
1. SheetJS CE current upstream release — PRIMARY
2. @excel.js/exceljs current release   — FALLBACK
```

The word **primary** does not mean selected yet.

The final selection occurs only after the exact implementation spike, tests, bundle review, license review, and security review pass.

Do not install multiple production spreadsheet libraries permanently. A rejected candidate must not remain in final dependencies.

---

## 7. Codec boundary direction

### 7.1 Architectural rule

Third-party workbook/cell objects must stop at the storage adapter boundary.

Target architecture:

```text
BusinessDataset
    |
    |  Phase 5.2B / 5.2C mapping
    v
library-neutral workbook representation
    |
    |  WorkbookCodec
    v
XLSX bytes (Uint8Array / ArrayBuffer)
    |
    v
future transport / browser / Tauri filesystem
```

No SheetJS/ExcelJS type may appear in:

- `src/domain/**`;
- application services;
- repository interfaces;
- React component props/state contracts;
- `StoragePort`;
- future Tauri transport interfaces.

### 7.2 Minimal neutral workbook representation

5.2A may introduce a minimal internal representation sufficient to prove the codec boundary, for example:

```ts
type WorkbookPrimitive = string | number | boolean | null;

interface WorkbookCellData {
  value: WorkbookPrimitive;
  formula?: string;
}

interface WorkbookRowData {
  cells: WorkbookCellData[];
}

interface WorkbookSheetData {
  name: string;
  rows: WorkbookRowData[];
}

interface WorkbookDocument {
  sheets: WorkbookSheetData[];
}
```

Exact names may change after implementation audit.

The important contract is semantic:

- values are library-neutral;
- formula presence is represented explicitly;
- sheet and row ordering are preserved;
- no filesystem path appears in the codec API.

### 7.3 Codec interface direction

A possible boundary is:

```ts
interface WorkbookCodec {
  decode(bytes: Uint8Array | ArrayBuffer): WorkbookDocument;
  encode(workbook: WorkbookDocument): Uint8Array;
}
```

Promise-returning methods are acceptable if the selected browser library requires asynchronous work.

The final interface must be chosen from actual library behavior rather than forcing this exact sketch.

---

## 8. Required implementation spike

5.2A implementation must include real in-memory XLSX bytes.

### 8.1 Encode smoke test

Create a small neutral workbook containing at least:

```text
_Meta
Smoke
```

The `Smoke` sheet must include:

- text;
- number;
- boolean;
- blank;
- formula-looking literal text.

Encode to `.xlsx` bytes without filesystem APIs.

### 8.2 Decode smoke test

Decode the generated bytes back to the neutral representation and prove primitive values and sheet names survive.

### 8.3 Formula detection fixture

Create or programmatically encode a workbook containing an actual formula cell and prove decode exposes formula presence separately from the cached/result value.

The test does not need to calculate the formula.

### 8.4 Literal formula-looking text fixture

Prove a source string beginning with `=`, `+`, `-`, or `@` can round-trip as literal text without being converted into a formula by the writer.

### 8.5 Browser-compatible build gate

The selected adapter must compile under the existing TypeScript/Vite configuration.

No global Node `fs`, `stream`, `Buffer`, or crypto polyfill should be required by the application-facing codec path unless explicitly justified and proven safe for the browser bundle.

---

## 9. Security and resource-safety rules

5.2A does not implement the final Phase 5.4C import-size limits, but the technology decision must not block them.

The selected parser must allow the application to wrap parsing with later controls such as:

- maximum workbook byte size;
- maximum sheet count;
- maximum row count;
- maximum cell count;
- rejection of unsupported workbook structures;
- controlled error translation.

Do not treat successful parsing as semantic validity. Phase 5.1B structural validation and Phase 5.1C dataset validation remain authoritative gates after decode/reconstruction.

No macros are executed.

No formulas are evaluated as application logic.

---

## 10. Dependency pinning rule

The final implementation must pin an exact selected upstream version through the lockfile.

If SheetJS CE is selected:

- do not install the stale public npm registry `xlsx@0.18.5` and call it current;
- use the current authoritative SheetJS package source documented by upstream;
- document the exact tarball/version origin;
- ensure `package-lock.json` records a reproducible resolved artifact and integrity information where supported;
- record Apache-2.0 notice obligations.

If the fallback is selected, document the exact npm package/version and why the primary candidate failed.

---

## 11. Planned implementation surface

Expected 5.2A implementation changes are limited to the codec-selection boundary and proof.

Likely files:

```text
package.json
package-lock.json
src/storage/workbookCodec.ts
src/storage/<selected-library>WorkbookCodec.ts
src/storage/workbookCodec.test.ts
```

Optional focused fixture/helper files are allowed under `src/storage` test scope.

A 5.2A implementation record should be added after green validation.

### Not part of 5.2A

Do not implement:

- complete `BusinessDataset -> workbook` export mapping;
- complete workbook -> candidate `BusinessDataset` reconstruction;
- `ExcelStorage.load/save` runtime wiring;
- repository snapshots;
- repository hydration;
- application persistence coordinator;
- browser open/save UI;
- backup/atomic replacement;
- Tauri filesystem/dialog integration;
- workbook migrations.

Those belong to later Phase 5/6 tasks.

---

## 12. Required focused tests

The selected codec spike must cover at least:

1. browser-compatible in-memory encode;
2. browser-compatible in-memory decode;
3. string round-trip;
4. finite number round-trip;
5. boolean round-trip;
6. blank/empty representation behavior;
7. multiple sheet names/order;
8. formula cell visibility;
9. formula cached result does not hide formula presence;
10. formula-looking text remains literal text;
11. Unicode/free-text round-trip;
12. bytes can be passed as `Uint8Array`;
13. `ArrayBuffer` compatibility where supported by the boundary;
14. third-party types do not leak through exported codec contracts;
15. controlled translation of malformed/unsupported input into a codec-level error rather than an untyped library exception where feasible in 5.2A.

The exact test count is not fixed; behavior coverage is the gate.

---

## 13. Evaluation record required before final selection

The implementation record must contain a decision matrix for at least the primary and fallback candidates:

```text
criterion
maintenance
license
installation source
browser/Vite support
Uint8Array input
ArrayBuffer input
Uint8Array/ArrayBuffer output
formula visibility
literal formula-looking text safety
TypeScript ergonomics
bundle footprint
runtime dependencies
security/advisory status
result: select / reject / fallback
```

The selected-library rationale must be evidence-based rather than preference-based.

---

## 14. Validation and Git workflow

Implementation, when separately authorized, must follow the repository's normal guarded workflow:

1. reverify exact `develop` SHA;
2. reverify exact green CI for that SHA;
3. recheck upstream current version/license/security facts;
4. create feature branch from exact green `develop`;
5. implement bounded candidate spike and codec boundary;
6. run focused tests;
7. run full typecheck/tests/build in GitHub Actions;
8. record exact dependency and evaluation decision;
9. validate final documented feature head;
10. open PR to `develop`;
11. require exact PR CI on exact head;
12. guarded-merge using exact expected head SHA;
13. require exact post-merge `develop` CI;
14. perform docs-only 5.2A closeout;
15. advance to 5.2B only after final green closeout.

Do not begin 5.2B automatically.

---

## 15. 5.2A completion gate

5.2A is complete only when all are true:

- one concrete XLSX library/version is selected with documented rationale;
- license obligations are documented and acceptable;
- current security/advisory review passes;
- browser/Vite compatibility is proven in this repository;
- in-memory XLSX encode/decode passes;
- `Uint8Array`/`ArrayBuffer` behavior is proven as applicable;
- formula cells are distinguishable and can be rejected later;
- formula-looking literal text is preserved safely;
- a library-neutral codec boundary exists;
- third-party library types do not leak outside storage implementation;
- bundle/dependency impact is recorded;
- full repository typecheck/tests/build are green;
- implementation PR and exact post-merge CI are green;
- docs-only closeout is green.

---

## 16. Stop point for this planning step

This document establishes the 5.2A implementation plan only.

**Do not install SheetJS, ExcelJS, or any other XLSX dependency in this planning step.**

**Do not create codec production/test implementation in this planning step.**

After this plan is merged and exact post-merge `develop` CI is green, stop at:

**5.2A — PLAN ESTABLISHED / IMPLEMENTATION NOT STARTED**

Implementation begins only after a separate user instruction to proceed.
