# Phase 5.4A — Schema Migration & Compatibility Framework

Status: **COMPLETE**

Plan:

`docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY_PLAN.md`

Parent phase:

`5.4 — Version Compatibility, Backup & Recovery Safety`

## Purpose

Phase 5.4A established explicit workbook/dataset version compatibility and migration readiness without weakening the strict Phase 5 import/hydration lifecycle and without inventing historical product formats.

The framework now recognizes authoritative version metadata before strict current-sheet validation, classifies compatibility deterministically, can execute only explicit registered migration chains over neutral workbook documents, and always converges back to the existing strict current workbook/dataset contract before live state may be hydrated.

## Final architecture

```text
XLSX bytes
-> WorkbookCodec.decode(...)
-> minimal _Meta version preflight
-> compatibility classification
   ├── current
   │   -> defensive current-form document
   ├── migratable
   │   -> explicit deterministic migration chain
   │   -> exact current version pair
   ├── unsupported older
   │   -> structured rejection
   └── unsupported future / invalid
       -> structured rejection
-> strict current workbook validation
-> current dataset reconstruction
-> validateBusinessDatasetIntegrity(...)
-> PersistenceCoordinator
-> ValidatedAtomicDatasetHydrationService
```

Migration readiness does not create a second persistence or hydration path.

## Public version policy

The final Phase 5.4A public contract remains:

```text
formatId                craft-business-manager
workbook format         v1
business dataset schema v1
production migrations   none
```

v1/v1 is the first formal persisted workbook/dataset contract in the repository.

Phase 5.4A therefore deliberately did **not**:

- invent v0;
- bump to v2 merely to create migration work;
- infer legacy versions from missing metadata;
- register fictional production migration paths.

Synthetic migration fixtures are isolated framework tests only.

## Completed decomposition

```text
5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract  COMPLETE
5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff           COMPLETE
5.4A3 — Compatibility Regression & Completion Gate                             COMPLETE
```

## 5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract

Completion record:

`docs/PHASE_5_4A1_VERSION_PREFLIGHT_MIGRATION_REGISTRY.md`

A1 established:

- minimal `_Meta` preflight independent of current business-sheet validation;
- exact independent workbook-format and dataset-schema version axes;
- deterministic current/migratable/unsupported-older/unsupported-future/invalid classification;
- pure neutral-workbook migration-step contract;
- exact-version-pair migration registry;
- deterministic path resolution;
- duplicate-source rejection;
- self-loop and cycle rejection;
- no-downgrade protection;
- defensive version-key and neutral-workbook ownership;
- empty production migration registry for public v1/v1.

A1 evidence:

```text
Planning baseline          0624863f59929d645acd5f6539ab311afdfcb5bd
Planning baseline CI       35039111549 — SUCCESS
Planning PR #165           MERGED
Planning merge             f773a2cd928a87c74e62a547b3043c04dcaef577
Planning post-merge CI     35040392356 — SUCCESS
Initial feature head       105f733730f66e6a89ca3a08e25b3a0513afe879
Initial CI                 35041137241 — FAILURE (test helper literal typing only)
Corrected feature head     104beacd503b33b57e0180c0c642017c6ddb07a8
Corrected branch CI        35041223493 — SUCCESS
Implementation PR #166     MERGED
PR CI                      35041313805 — SUCCESS
Implementation merge       142a3b4a38b915c7e3258e490ba2b32d96490bb5
Post-merge develop CI      35041385616 — SUCCESS
97 test files / 1186 tests
18 focused A1 tests
130 modules transformed
```

## 5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff

Completion record:

`docs/PHASE_5_4A2_VERSION_AWARE_MIGRATION_EXECUTION.md`

A2 established:

- `prepareWorkbookForCurrentImport(...)` after codec decode and before strict current reconstruction;
- defensive current-form handoff;
- deterministic single/multi-step migration execution;
- owned step input and output;
- migration output structural validation;
- expected format identity enforcement;
- declared target-version enforcement after every step;
- final exact target-version enforcement;
- structured compatibility and migration diagnostics;
- original thrown migration cause retention where applicable;
- version-aware `importBusinessDatasetFromXlsx(...)` with unchanged external success/failure shape;
- unchanged `PersistenceCoordinator` runtime API;
- zero-hydration behavior for rejected imports.

A2 evidence:

```text
Authoritative baseline     049cc5cfe38090f87dbbe702b140915e8224b998
Baseline CI                35041734689 — SUCCESS
Initial feature head       5cf395dfd32722fc609bd269c4de48962cafef3f
Initial CI                 35042246720 — FAILURE (existing test stage expectation only)
Corrected feature head     c7ed54af3b38f8f9dacee52384af39472dac5d8b
Corrected branch CI        35042353048 — SUCCESS
Implementation PR #168     MERGED
PR CI                      35042498871 — SUCCESS
Implementation merge       9dc28493b9d4b46214a11eb330416e83af236db0
Post-merge develop CI      35042566109 — SUCCESS
99 test files / 1203 tests
12 focused migration-preparation tests
5 focused importer compatibility/handoff tests
TypeScript typecheck passed
Production Vite build passed
132 modules transformed
```

A2 closeout established the exact green A3 baseline:

```text
develop  c2816d5c0c293ba24f74f20c31edf2c61eb0f26f
CI       35042813430 — SUCCESS
```

## 5.4A3 — Compatibility Regression & Completion Gate

Completion record:

`docs/PHASE_5_4A3_COMPATIBILITY_REGRESSION_COMPLETION_GATE.md`

A3 added regression-only proof that:

- public compatibility remains v1/v1;
- production migration registry remains empty;
- no fabricated historical product version exists;
- every future-axis combination fails closed;
- missing/invalid metadata never triggers legacy inference;
- synthetic migration remains deterministic, isolated, and defensively owned;
- current strict workbook sheet/header/cell rules remain mandatory;
- current dataset duplicate/reference/component-cycle rules remain mandatory;
- direct current XLSX import remains green;
- transport-backed current load remains green;
- import metadata remains preserved;
- compatibility and migration rejection never reaches hydration;
- existing save/mutate/load/restore and atomic hydration/rollback guarantees remain green.

A3 evidence:

```text
Authoritative baseline     c2816d5c0c293ba24f74f20c31edf2c61eb0f26f
Baseline CI                35042813430 — SUCCESS
Feature head               ca282c8c3317482bc02d74eb5ea4acc347941ab3
Branch CI                  35046943869 — SUCCESS
Implementation PR #170     MERGED
PR CI                      35047034132 — SUCCESS
Implementation merge       75473f92766a0b66d5955dec89869eaaf5712939
Post-merge develop CI      35047100605 — SUCCESS
102 test files / 1214 tests
11 focused new A3 tests
TypeScript typecheck passed
Production Vite build passed
132 modules transformed
3 new test files only
no production/runtime changes
```

## Locked completion invariants

Phase 5.4A closes with these guarantees:

1. Workbook format version and dataset schema version are independent exact axes.
2. Minimal version preflight runs before strict current-sheet validation for routing only.
3. Missing `_Meta` is a rejection, not a legacy signal.
4. Wrong format identity is never migrated.
5. Any future version axis fails closed.
6. Migration paths are explicit exact-version-pair registrations.
7. Migration paths are deterministic, cycle-safe, and no-downgrade.
8. Migration steps operate only on neutral workbook data.
9. Migration code cannot touch repositories, hydration, transport, React, or native filesystem APIs.
10. Every migration step receives defensively owned input.
11. Migration output must preserve the application format identity.
12. Migration output must match the step's declared target version pair.
13. Completed migration must reach the exact current target pair.
14. Current strict workbook validation remains mandatory after compatibility preparation/migration.
15. Current complete dataset validation remains mandatory after reconstruction.
16. `PersistenceCoordinator` remains unaware of migration mechanics.
17. Compatibility/migration rejection means zero hydration writes.
18. Existing Phase 5.3B atomic hydration/rollback remains the only live replacement boundary.
19. Public versions remain v1/v1 until real schema evolution requires a new contract.
20. The production migration registry remains empty until a real older released contract exists.

## Phase 5.4A completion gate

Phase 5.4A is **COMPLETE** because:

- version preflight is explicit and tested;
- compatibility states are deterministic;
- migration registry/execution is pure and cycle-safe;
- migration output is fail-closed and current-contract-bound;
- strict current workbook/dataset validation remains final authority;
- current v1/v1 round trip remains green;
- unsupported/future/migration failures cannot reach live hydration;
- no fabricated product version was introduced;
- all implementation, regression, typecheck, test, build, PR, and post-merge CI gates are green.

## Next task

**5.4B — Backup & Atomic-Write Transport Contract — NEXT / NOT STARTED**

Phase 5.4B owns detailed backup creation, staged-write, atomic replace/commit, cleanup, and recovery-oriented transport semantics.

Do not begin Phase 5.4B until this Phase 5.4A closeout is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
