# Phase 5.4A3 — Compatibility Regression & Completion Gate

Status: **COMPLETE**

Parent plan:

`docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY_PLAN.md`

## Objective

Prove that the compatibility and migration-readiness architecture introduced by Phase 5.4A1/A2 does not weaken the strict workbook, dataset, persistence, or hydration guarantees established by Phase 5.2 and Phase 5.3.

A3 intentionally adds regression/completion evidence only. It does not add a new production workbook version, a legacy compatibility heuristic, a production migration predecessor, or a new persistence API.

## Authoritative baseline

```text
develop  c2816d5c0c293ba24f74f20c31edf2c61eb0f26f
CI       35042813430 — SUCCESS
```

Feature branch:

`feature/phase-5-4a3-compatibility-completion-gate`

## Split reassessment

A3 was reassessed before implementation and did **not** require a deeper split.

Reason:

- A1 already owned version preflight/classification/registry contracts;
- A2 already owned migration execution and importer handoff;
- A3 was therefore a bounded regression and completion gate rather than a new architecture surface.

## Delivered regression coverage

A3 added three test-only completion surfaces and made no production/runtime code changes.

### Storage compatibility completion gate

Added:

`src/storage/workbookCompatibilityCompletion.test.ts`

Coverage proves:

- the public product contract remains workbook v1 / dataset v1;
- the production migration registry remains empty;
- no fabricated historical product version is introduced;
- future workbook format with current dataset version rejects;
- current workbook format with future dataset version rejects;
- both axes future reject;
- isolated synthetic mixed lower/future pairs reject whenever any axis is future relative to the synthetic target;
- missing `_Meta` never triggers legacy inference;
- zero, malformed, incomplete, and wrong-format metadata reject deterministically;
- synthetic multi-step migration order is deterministic;
- synthetic migration remains defensively owned and does not mutate the source document;
- strict current workbook sheet/header/cell validation remains authoritative;
- strict current dataset duplicate/reference/component-cycle validation remains authoritative.

### Persistence compatibility completion gate

Added:

`src/application/persistence/PersistenceCompatibilityCompletion.test.ts`

Coverage proves:

- real current v1/v1 XLSX bytes still import through `PersistenceCoordinator`;
- import metadata is preserved;
- direct bytes import still hydrates the reconstructed current dataset;
- transport-backed load still routes through the same import/hydrate lifecycle;
- production future-version combinations reject before hydration;
- representative invalid compatibility metadata rejects before hydration.

The existing `PersistenceCoordinatorCompletion.test.ts` remains the authoritative broader persistence integration evidence for:

```text
save A
-> mutate live state to B
-> load saved workbook
-> restore exact A
```

as well as preserved service/repository identity, hydration rollback behavior, source-evidence fidelity, and canonical source-only workbook persistence.

### Migration rejection hydration safety gate

Added:

`src/application/persistence/PersistenceMigrationRejectionCompletion.test.ts`

This coordinator seam test proves that a structured importer rejection with:

```text
stage = migration
code  = MIGRATION_STEP_FAILED
```

is returned as an import rejection and performs **zero hydration calls**.

This seam proof is intentional. The production registry is empty because v1/v1 is the first formal persisted contract, so A3 does not manufacture a fake production predecessor merely to force an end-to-end production migration failure.

The real migration executor failure behavior itself remains covered by the A2 storage-level migration tests.

## Public compatibility policy remains unchanged

```text
formatId                craft-business-manager
workbook format         v1
business dataset schema v1
production migrations   none
```

There is no valid public positive-integer predecessor below v1/v1.

Therefore:

- v1/v1 remains current;
- version 0 remains invalid rather than legacy;
- missing metadata remains invalid rather than legacy;
- future axes fail closed;
- migration behavior is proven with isolated synthetic registry/target fixtures;
- production migration registration waits for a real future schema evolution that creates an actual predecessor/current relationship.

## Strict current validation remains final authority

Compatibility readiness does not bypass current validation.

The completed flow remains:

```text
XLSX bytes
-> WorkbookCodec.decode(...)
-> minimal version preflight
-> compatibility classification
-> optional registered migration chain
-> strict current workbook schema validation
-> current metadata validation
-> dataset reconstruction
-> validateBusinessDatasetIntegrity(...)
-> PersistenceCoordinator
-> ValidatedAtomicDatasetHydrationService
```

A compatible or migrated neutral workbook is still rejected if it violates current:

- required sheet contracts;
- required/header contracts;
- authoritative cell/formula rules;
- dataset record rules;
- duplicate identity rules;
- reference integrity;
- product component graph/cycle rules.

## Atomicity and hydration safety

A3 confirms that compatibility/migration rejection does not reach hydration.

Existing Phase 5.3B guarantees remain authoritative for candidates that do reach hydration:

- candidate validation before writes;
- complete pre-write snapshot;
- sequential whole-dataset replacement;
- exact rollback on apply failure;
- distinct severe rollback-failure diagnostics;
- preserved repository/service identity.

## Implementation evidence

Feature head:

`ca282c8c3317482bc02d74eb5ea4acc347941ab3`

Feature branch CI:

`35046943869 — SUCCESS`

Implementation PR:

`#170 — Phase 5.4A3: compatibility regression and completion gate`

PR CI:

`35047034132 — SUCCESS`

Implementation merge:

`75473f92766a0b66d5955dec89869eaaf5712939`

Post-merge `develop` CI:

`35047100605 — SUCCESS`

Validation at the feature gate:

```text
102 test files / 1214 tests
11 focused new A3 tests
TypeScript typecheck passed
Production Vite build passed
132 modules transformed
```

Feature diff:

```text
3 commits ahead / 0 behind baseline
3 new test files
588 additions / 0 deletions
no production/runtime changes
```

## Completion gate

Phase 5.4A3 is complete because:

- current v1/v1 import behavior remains green;
- direct and transport-backed current imports remain green;
- current metadata remains preserved;
- future workbook/dataset axes fail closed before hydration;
- missing/invalid metadata does not trigger legacy inference;
- synthetic migration mechanics remain deterministic and pure;
- no fabricated production version was introduced;
- strict current workbook validation remains mandatory;
- strict current dataset validation remains mandatory;
- compatibility/migration rejection performs zero hydration writes;
- existing 5.3B hydration/rollback guarantees remain intact;
- full repository typecheck, test, and production build gates are green after merge.

## Parent phase result

With A1, A2, and A3 complete, **Phase 5.4A — Schema Migration & Compatibility Framework is ready for parent closeout**.

The next task after the A3 + parent 5.4A docs closeout is merged and the exact resulting `develop` CI is green is:

**5.4B — Backup & Atomic-Write Transport Contract — NEXT / NOT STARTED**

Do not begin 5.4B until the user separately says to proceed.
