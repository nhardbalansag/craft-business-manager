# Phase 5.4C2 — Corruption / Recovery Diagnostic Classification

Status: **COMPLETE**

Parent:

```text
5.4C — Corruption, Limits & Recovery Diagnostics
```

## Purpose

Phase 5.4C2 adds one stable, UI-agnostic recovery summary over the existing detailed workbook import diagnostics. It does not replace, rewrite, or mutate the original importer issues.

The classifier remains storage-facing and pure. It has no repository, hydration, transport, React, native filesystem, or backup-selection dependency.

## Authoritative implementation baseline

```text
develop  26265df41731053358a779bb53f1f44609fb8601
CI       35053316688 — SUCCESS
```

Feature branch:

```text
feature/phase-5-4c2-recovery-diagnostic-classification
```

Corrected feature head:

```text
12907c2f28e1ee653b2b24f8940b2cbf39c2e62c
```

## Delivered contract

Implementation files:

```text
src/storage/workbookRecoveryDiagnostics.ts
src/storage/workbookRecoveryDiagnostics.test.ts
```

Stable recovery categories:

```text
resource-limit
unreadable-or-corrupt-workbook
unsupported-or-incompatible-version
workbook-structure
invalid-workbook-values
invalid-business-data
unexpected-import-failure
```

Stable recovery action codes:

```text
select-another-file
restore-known-good-backup
reduce-workbook-size
open-with-compatible-or-newer-app
repair-workbook-structure
correct-source-data
retry-or-report-unexpected-error
```

The summary includes:

```text
primaryCategory
recommendedActions
issueCount
stageCounts
categoryCounts
backupRestoreRecommended
liveStateChanged = false
```

## Classification precedence

Primary classification is deterministic and independent of raw issue ordering:

```text
resource-limit
-> unreadable / corrupt codec failure
-> unsupported / incompatible version
-> workbook structure
-> invalid workbook values
-> invalid business data
-> unexpected import failure
```

Detailed import issues remain the authoritative engineering evidence. The summary is derived guidance only.

## Recovery semantics

- Corrupt/unreadable workbook diagnostics recommend selecting another file and may recommend restoring a known-good backup.
- Resource-limit rejection recommends reducing workbook size or selecting another file; it does not imply corruption.
- Version incompatibility recommends using a compatible/newer application or another file; it does not masquerade as corruption.
- Structural damage recommends workbook structure repair and may recommend a known-good backup.
- Invalid workbook values recommend source correction and may recommend a known-good backup.
- Dataset-integrity problems recommend correcting source/business data.
- Migration/reconstruction operational failures are classified as unexpected failures and recommend retry/report guidance.
- Backup restore remains advisory only. No backup is selected or loaded by the classifier.
- `liveStateChanged` is always false because classification itself performs no hydration or mutation.

## Validation matrix

Focused coverage proves classification for:

- truncated/corrupt decode failure;
- resource-limit failure;
- future/unsupported version;
- missing `_Meta`;
- missing required sheet/header;
- duplicate header;
- malformed primitive value;
- invalid enum/unit;
- formula cell;
- orphan normalized child row;
- invalid source reference;
- product composition cycle;
- migration operational failure;
- reconstruction operational failure;
- deterministic mixed-issue precedence;
- deterministic action ordering;
- raw issue preservation;
- advisory backup semantics;
- empty issue collection rejection.

## CI evidence

The first branch CI exposed a type-only issue where frozen action arrays widened to `readonly string[]`:

```text
35054131375 — FAILURE at typecheck
```

The action constants were corrected to retain literal action-code tuple types without changing runtime behavior.

Corrected feature validation:

```text
Branch CI              35054203155 — SUCCESS
Typecheck              PASS
Test files             110 passed
Tests                  1,288 passed
Focused C2 tests       22 passed
Production build       PASS
Modules transformed    133
```

Implementation PR:

```text
#182 — MERGED
```

Implementation merge:

```text
cff570f7a2f483cae1e2a41bf40b74bfe230f238
```

Exact post-merge `develop` CI:

```text
35054369314 — SUCCESS
```

## Completion gate

5.4C2 is COMPLETE because:

- all Phase 5.4C malformed/corruption classes map to stable recovery categories;
- guidance is machine-readable and UI-agnostic;
- raw structured diagnostics remain unchanged;
- backup restore is advisory only;
- classification precedence is deterministic;
- importer/coordinator/hydration/transport contracts remain unchanged;
- full typecheck/tests/build are green.

## Next task

```text
5.4C3 — Recovery Safety Regression & Phase 5.4 Completion Gate
NEXT / NOT STARTED
```

Do not begin 5.4C3 until this docs-only closeout is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
