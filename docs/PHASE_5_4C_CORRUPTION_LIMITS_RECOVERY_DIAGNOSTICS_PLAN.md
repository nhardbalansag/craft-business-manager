# Phase 5.4C — Corruption, Limits & Recovery Diagnostics Plan

Status: **PLANNED / NOT IMPLEMENTED**

Parent:

```text
5.4 — Version Compatibility, Backup & Recovery Safety
```

Authoritative planning baseline:

```text
develop  3cce1f03eda8e9266c40bee3dc8218e3c04bb786
CI       35051330092 — SUCCESS
```

Planning branch:

```text
docs/phase-5-4c-corruption-limits-recovery-plan
```

## Purpose

Phase 5.4C completes the safety layer around workbook import by making malformed/corrupt-file behavior, resource limits, recovery classification, and previous-state preservation explicit and testable.

The phase must **reuse** the existing Phase 5 validation stack rather than creating parallel workbook or business validators.

Existing authoritative layers already cover much of the malformed-workbook matrix:

```text
SheetJsWorkbookCodec
  -> corrupt/unreadable XLSX decode failures

workbook compatibility/preflight
  -> missing metadata / unsupported versions / migration routing

validateWorkbookSchema(...)
  -> required sheets and columns
  -> duplicate sheets/columns
  -> invalid column order
  -> required cells
  -> malformed primitive values
  -> enum/unit tokens
  -> formula-cell rejection
  -> paired-field rules

businessDatasetWorkbookImport reconstruction
  -> orphan child rows
  -> duplicate/gapped child ordering
  -> metadata validation

validateBusinessDatasetIntegrity(...)
  -> domain rules
  -> duplicate identities
  -> missing references
  -> product composition cycles

PersistenceCoordinator + hydration
  -> rejected import never reaches hydration
  -> valid import hydrates only after validation
```

5.4C therefore adds the missing **resource-boundary contract**, a stable **recovery diagnostic summary**, and one consolidated **recovery/state-preservation completion gate**.

---

# Split decision

5.4C **requires a three-child split**.

Reason:

1. Resource limits are a security/reliability boundary and must be established independently of user-facing recovery meaning.
2. Existing low-level import issues are intentionally precise but are not yet a stable recovery-guidance contract for Phase 5.5 UX.
3. Corrupt/truncated real-XLSX regression plus live-state-preservation proof is broad enough to deserve a final completion gate after the first two contracts exist.

Locked decomposition:

```text
5.4C
├── 5.4C1 — Resource Limit Policy & Guard Boundaries
├── 5.4C2 — Corruption / Recovery Diagnostic Classification
└── 5.4C3 — Recovery Safety Regression & Phase 5.4 Completion Gate
```

No deeper split is planned initially. Each child must still be reassessed against the exact green baseline before implementation.

---

# 5.4C1 — Resource Limit Policy & Guard Boundaries

Status: **NEXT / NOT STARTED after planning closeout**

Planned branch:

```text
feature/phase-5-4c1-resource-limit-guards
```

## Purpose

Define deterministic, testable resource limits for workbook import so unexpectedly large files/sheets/row ranges fail closed before they can be treated as a valid business dataset.

This is not a claim of complete hostile-file sandboxing. SheetJS still has to parse XLSX container structures, and Phase 5 runs in browser-style JavaScript. The goal is to establish practical application-level bounds and avoid unbounded neutral-workbook expansion/reconstruction.

## Planned work

### 1. Explicit resource-limit contract

Create a storage-level immutable limit policy, conceptually covering:

```text
maxWorkbookBytes
maxWorksheetCount
maxColumnsPerSheet
maxRowsPerSheet
maxTotalRows
maxTotalCells
```

Exact default values must be:

- named constants, never hidden magic numbers;
- justified against the current 13-sheet normalized workbook and expected small-business data scale;
- high enough for legitimate growth;
- conservative enough for browser memory/reconstruction safety;
- overrideable/injectable in tests where useful without turning limits into user-controlled runtime bypasses.

### 2. Pre-codec byte-size guard

Before `WorkbookCodec.decode(...)` is invoked by the authoritative XLSX import path:

- measure the caller-owned input byte length;
- reject over-limit input deterministically;
- return a controlled import issue;
- do not call codec decode;
- do not call hydration.

This is the earliest application-level protection available without native filesystem/container inspection.

### 3. SheetJS early worksheet-range guard

The concrete SheetJS adapter currently decodes `!ref` and iterates every declared row/column range.

Add an early range/dimension guard before materializing neutral rows so a worksheet with an extreme declared range cannot cause unbounded row/cell iteration.

Requirements:

- validate worksheet count before per-sheet expansion where possible;
- inspect decoded range dimensions before row loops;
- reject row/column/cell counts beyond policy;
- preserve sheet name and measured/allowed values in controlled diagnostic context;
- do not silently truncate rows via `sheetRows` or similar options and then treat the result as complete.

Silent truncation is forbidden because it would convert corruption/oversize input into false authoritative source data.

### 4. Post-codec neutral-document guard

After any codec returns a neutral workbook document, validate resource limits again before compatibility/schema/reconstruction work.

This ensures:

- custom/test codecs cannot bypass the application limit policy;
- worksheet count, per-sheet rows/columns, total rows, and total cells are checked consistently;
- neutral-document fixtures remain testable independently of SheetJS.

### 5. Controlled issue vocabulary

Introduce resource-limit diagnostics that preserve at minimum:

```text
limit kind
actual value
allowed maximum
sheet name when applicable
stage/context
```

The authoritative importer should surface them as a controlled import rejection, not as an arbitrary exception.

Exact code names may be refined during implementation, but the distinction between at least these cases must remain stable:

```text
workbook bytes exceeded
worksheet count exceeded
sheet columns exceeded
sheet rows exceeded
total rows exceeded
total cells exceeded
```

### 6. No mutation

Any resource-limit failure must stop before:

- dataset reconstruction;
- hydration snapshot;
- repository replacement;
- transport save behavior.

## C1 test matrix

At minimum prove:

- exact-at-limit input is accepted;
- over-limit workbook bytes reject before codec decode;
- excessive worksheet count rejects;
- excessive per-sheet columns reject;
- excessive per-sheet rows reject;
- excessive total rows reject;
- excessive total cells reject;
- SheetJS declared-range guard rejects before large neutral row expansion;
- arbitrary/custom codec output is still checked post-decode;
- resource-limit diagnostics preserve actual/max/sheet context;
- invalid limit policy construction is rejected or impossible;
- no hydration occurs after a limit rejection;
- normal current v1/v1 workbook behavior remains unchanged.

## C1 completion gate

- application-level workbook resource limits are explicit and deterministic;
- byte-size checks occur before decode;
- SheetJS range checks occur before large row/cell materialization;
- neutral-document checks occur before compatibility/schema reconstruction;
- no silent truncation is used;
- limit failures are structured import rejections;
- full typecheck/tests/build are green.

---

# 5.4C2 — Corruption / Recovery Diagnostic Classification

Status: **NOT STARTED**

Planned branch:

```text
feature/phase-5-4c2-recovery-diagnostic-classification
```

## Purpose

Create one stable, storage/application-facing recovery summary that converts detailed import issues into actionable recovery categories without deleting or flattening the original diagnostics.

This contract is intended to support Phase 5.5C UX later. It is **not** the UI itself.

## Existing issue sources to preserve

The classifier must consume the existing structured import issue vocabulary, including:

```text
codec
compatibility
migration
resource-limit   (from C1)
schema
metadata
reconstruction
dataset
```

Existing precise issues remain authoritative evidence and must still be available to callers/tests.

## Planned recovery categories

Use stable machine-readable categories conceptually equivalent to:

```text
unreadable-or-corrupt-workbook
resource-limit
unsupported-or-incompatible-version
workbook-structure
invalid-workbook-values
invalid-business-data
unexpected-import-failure
```

Exact type names may be refined during implementation.

## Planned recovery action codes

Provide deterministic action metadata suitable for later UI mapping, conceptually:

```text
select-another-file
restore-known-good-backup
reduce-workbook-size
open-with-compatible-or-newer-app
repair-workbook-structure
correct-source-data
retry-or-report-unexpected-error
```

These are guidance codes, not filesystem actions.

### Backup/restore guidance

Where corruption/structure/value damage suggests the authoritative workbook itself is unsafe, diagnostics may mark backup restore as recommended.

5.4C must **not**:

- directly load a backup reference;
- know native file paths;
- choose which backup to restore;
- mutate transport state;
- implement UI buttons.

Those actions remain 5.5/Phase 6 responsibilities.

## Summary contract

A recovery summary should preserve enough information for Phase 5.5C to present a useful message without having to reverse-engineer raw issue codes.

At minimum include deterministic values equivalent to:

```text
primary category
recommended action code(s)
issue count
stage/category counts
backup-restore recommendation when applicable
whether live state was changed (for expected import rejection this remains false)
```

Do not expose raw third-party exception text as the only user-facing guidance. Original causes may remain attached to raw diagnostics for engineering/debugging.

## Deterministic classification precedence

When a workbook has multiple issues, classification must be deterministic.

Preferred precedence should reflect the earliest trustworthy failure boundary, for example:

```text
resource-limit / codec corruption
-> compatibility/version
-> schema/metadata
-> reconstruction
-> dataset integrity
```

Exact ordering must be documented and tested.

## C2 test matrix

At minimum classify:

- truncated/corrupt decode failure;
- over-limit workbook;
- future/unsupported version;
- missing `_Meta`;
- missing required sheet/header;
- duplicate header;
- malformed number/boolean/enum/unit;
- formula cell in authoritative data;
- orphan child row;
- invalid reference;
- product composition cycle;
- unexpected importer operational failure where represented.

Also prove:

- original raw issues remain unchanged;
- summary ordering is deterministic;
- mixed issues choose the documented primary category;
- guidance does not claim an automatic restore occurred;
- no repository/hydration/native filesystem dependency enters the classifier.

## C2 completion gate

- every Phase 5.4C malformed/corruption class maps to a stable recovery category;
- guidance is machine-readable and UI-agnostic;
- raw structured diagnostics are preserved;
- backup guidance is advisory only;
- existing importer/coordinator contracts remain compatible;
- full typecheck/tests/build are green.

---

# 5.4C3 — Recovery Safety Regression & Phase 5.4 Completion Gate

Status: **NOT STARTED**

Planned branch:

```text
feature/phase-5-4c3-recovery-safety-completion-gate
```

## Purpose

Prove the complete Phase 5.4 safety story across real XLSX bytes, importer diagnostics, resource limits, compatibility, recovery classification, coordinator behavior, and unchanged live state.

C3 should be primarily regression/integration tests unless those tests expose a real defect.

## Required real-XLSX regression matrix

At minimum prove controlled behavior for:

```text
truncated XLSX bytes
random/corrupt non-XLSX bytes
missing required sheet
missing required header
duplicate header
malformed number
malformed boolean
invalid enum/unit
formula in authoritative source cell
orphan normalized child row
invalid source reference
product composition cycle
unsupported/future workbook or dataset version
resource limit exceeded
```

Where a malformed case is easier to create as a neutral-document fixture than as raw XLSX, C3 must still include representative real-XLSX corruption/truncation tests so the codec boundary itself is exercised.

## Previous-state preservation

Through `PersistenceCoordinator.importAndApplyWorkbook(...)` and/or `loadCurrentWorkbook(...)`, prove for every expected rejection class:

- hydration is not called when import has not produced a valid candidate;
- no repository write occurs;
- previously loaded business state remains exactly unchanged;
- no partial reconstructed dataset is returned as success.

For dataset-level invalidity that reaches the validated hydration boundary, retain the existing 5.3B guarantees rather than inventing a second rollback system.

## Recovery summary integration

For representative failures, prove:

- raw issues are preserved;
- recovery summary category/action is deterministic;
- backup-restore guidance is advisory and truthful;
- unsupported versions do not masquerade as corruption;
- resource-limit rejection remains distinct from malformed business data.

## Cross-phase regression

Ensure 5.4C does not regress:

- 5.4A current v1/v1 compatibility behavior;
- future-version fail-closed behavior;
- 5.4B safe-save receipts/error semantics;
- 5.3C export/save and load/import/hydrate lifecycle;
- 5.3B hydration rollback;
- missing-vs-explicit zero/null/false fidelity;
- true absence of optional `Material.source` evidence.

## Full repository gate

Run:

```text
TypeScript typecheck
full automated test suite
production Vite build
```

## C3 completion gate

Phase 5.4C is complete only when:

- corrupt/truncated workbooks fail safely;
- resource-limit policy is enforced before unsafe expansion/reconstruction;
- malformed workbook/value/reference/cycle cases remain structured and deterministic;
- recovery summaries are actionable but UI-agnostic;
- previous live state is unchanged after expected import rejection;
- compatibility and safe-save behavior remain regression-green;
- all CI gates pass.

After C3 implementation is merged and exact post-merge `develop` CI is green, create a docs-only closeout that:

1. marks `5.4C` COMPLETE;
2. marks parent `5.4 — Version Compatibility, Backup & Recovery Safety` COMPLETE;
3. adds the parent Phase 5.4 completion record;
4. advances exactly to:

```text
5.5A — Import / Open Workbook Workflow — NEXT / NOT STARTED
```

Do **not** begin 5.5 automatically.

---

# Locked 5.4C decisions

1. Existing workbook schema, compatibility, reconstruction, and dataset validators remain authoritative; 5.4C does not duplicate them.
2. Resource limits are a separate safety contract, not business-domain validation.
3. Workbook byte limits are checked before codec decode.
4. SheetJS must guard declared worksheet dimensions before large neutral row/cell materialization where feasible.
5. Neutral workbook resource limits are checked again after decode so alternate codecs cannot bypass the application policy.
6. Silent truncation is forbidden for authoritative import.
7. Limit failures are expected structured import rejections, not successful partial imports.
8. Corrupt/unreadable XLSX remains distinguishable from resource-limit, version, schema, reconstruction, and dataset failures.
9. Recovery classification summarizes raw diagnostics; it never replaces or mutates them.
10. Recovery actions are machine-readable guidance codes only; no UI/file operation is performed in 5.4C.
11. Backup restore guidance is advisory. Backup selection/loading remains outside the importer and classifier.
12. `PersistenceCoordinator` remains the application orchestration boundary and must not learn XLSX sheet rules.
13. Expected import rejection must not call hydration and must preserve previous live state.
14. Hydration rollback remains owned by 5.3B; save-side transport recovery remains owned by 5.4B.
15. Public workbook/dataset versions remain v1/v1 unless a separate real schema evolution explicitly changes them.
16. Native Tauri filesystem/dialog, OS file size probing, file locking, and crash consistency remain Phase 6.
17. User-facing persistence/recovery UX remains Phase 5.5C.
18. Phase 5.4 closes only after 5.4C3 and its docs closeout are green.

# Out of scope

5.4C does not implement:

- React import/export controls;
- native file dialogs or filesystem paths;
- actual backup selection/restore execution;
- antivirus/malware scanning;
- complete ZIP-bomb sandboxing beyond the application/codec guards available in JavaScript;
- OS-level file locks or durability guarantees;
- business dataset migrations beyond 5.4A;
- save-side atomic replacement beyond 5.4B;
- hydration rollback beyond 5.3B;
- Google Sheets integration;
- legacy `.xls` or `.xlsm` support.

# Next action after planning merge

After this docs-only plan is merged and the exact resulting `develop` CI is green:

```text
5.4C1 — Resource Limit Policy & Guard Boundaries
NEXT / NOT STARTED
```

Do not begin 5.4C1 until the user separately says to proceed.
