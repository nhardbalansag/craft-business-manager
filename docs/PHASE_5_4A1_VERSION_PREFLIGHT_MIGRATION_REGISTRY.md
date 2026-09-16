# Phase 5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract

Status: **COMPLETE**

Parent:

`5.4A — Schema Migration & Compatibility Framework`

Plan:

`docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY_PLAN.md`

## Authoritative baseline

```text
develop  f773a2cd928a87c74e62a547b3043c04dcaef577
CI       35040392356 — SUCCESS
```

## Implementation evidence

```text
Feature branch             feature/phase-5-4a1-version-preflight-migration-registry
Initial feature head       105f733730f66e6a89ca3a08e25b3a0513afe879
Initial CI                 35041137241 — FAILURE (test-fixture type inference only)
Corrected feature head     104beacd503b33b57e0180c0c642017c6ddb07a8
Corrected branch CI        35041223493 — SUCCESS
Implementation PR #166     MERGED
PR CI                      35041313805 — SUCCESS
Implementation merge       142a3b4a38b915c7e3258e490ba2b32d96490bb5
Post-merge develop CI      35041385616 — SUCCESS
97 test files / 1186 tests
18 focused 5.4A1 compatibility tests
TypeScript typecheck passed
Production Vite build passed
130 modules transformed
```

## Delivered contract

### Minimal workbook version preflight

`src/storage/workbookCompatibility.ts` introduces `preflightWorkbookVersion(...)` as a deliberately narrow compatibility boundary before strict current-workbook validation.

It reads only the minimum authoritative identity/version evidence required for compatibility routing:

- exactly one `_Meta` sheet;
- exactly one authoritative metadata row;
- exact `craft-business-manager` format identity;
- positive-integer workbook format version;
- positive-integer dataset schema version.

It does **not** require current business sheets, reconstruct source entities, read repositories, or infer metadata-free legacy formats.

### Independent version axes

The compatibility contract keeps workbook and dataset versions separate:

```ts
interface WorkbookVersionKey {
  workbookFormatVersion: number;
  datasetSchemaVersion: number;
}
```

`CURRENT_WORKBOOK_VERSION_KEY` is derived from the existing public constants. Those public constants remain unchanged at v1/v1.

### Compatibility classification

`classifyWorkbookCompatibility(...)` establishes deterministic outcomes:

```text
invalid
current
migratable
unsupported-older
unsupported-future
```

Rules proven by tests:

- exact current pair -> `current`;
- any future workbook or dataset axis -> `unsupported-future`;
- exact registered migration path -> `migratable`;
- non-current older pair without a path -> `unsupported-older`;
- invalid or missing metadata -> `invalid`;
- wrong format identity is never considered migration input.

### Pure migration-step contract

`WorkbookMigrationStep` defines only an exact `from` version pair, exact `to` version pair, and a pure neutral-workbook transformation function.

A migration step has no repository, hydration, transport, filesystem, React, or derived-business-calculation responsibility.

### Deterministic migration registry

`WorkbookMigrationRegistry` provides exact version-pair path resolution with these invariants:

- one registered next step per exact source pair;
- no duplicate/ambiguous source registrations;
- no self-loop;
- no cycle;
- no version-axis downgrade;
- deterministic single-step and multi-step resolution;
- explicit `null` when no exact path exists;
- defensive ownership of registered version keys;
- cycle-safe traversal.

### Defensive neutral-workbook ownership

`cloneWorkbookNeutralDocument(...)` provides deep ownership for neutral workbook data so migration fixtures and later migration execution do not share mutable nested workbook values with caller-owned documents.

### Production compatibility policy remains v1/v1

The production registry intentionally remains empty:

```ts
PRODUCTION_WORKBOOK_MIGRATION_STEPS = []
```

No fake v0 contract and no artificial v2 contract were introduced. Synthetic version pairs exist only in tests to prove the generic registry mechanics.

## Focused regression coverage

The 18 focused A1 tests prove:

1. current metadata can be preflighted without current business sheets;
2. missing `_Meta` rejects without heuristic legacy detection;
3. duplicate `_Meta` rejects deterministically;
4. `_Meta` must contain exactly one authoritative row;
5. wrong format identity rejects before migration classification;
6. workbook/dataset version shapes are validated independently;
7. public v1/v1 classifies as current;
8. production migration registry remains empty;
9. either future version axis classifies as unsupported future;
10. an older synthetic pair without a path is unsupported older;
11. an exact synthetic migration path is migratable;
12. single-step and multi-step paths resolve deterministically;
13. unavailable paths return no path;
14. duplicate/ambiguous migration sources reject;
15. self-loops reject;
16. cycles reject;
17. version-axis downgrades reject;
18. version keys and neutral workbook values are defensively owned.

## Corrective CI history

The first feature CI run:

```text
35041137241 — FAILURE
```

stopped during TypeScript typecheck before tests or build. The failure was limited to the test helper: default parameters derived from `as const` public version constants were inferred as literal type `1`, so synthetic `0` and `2` fixtures were rejected by TypeScript.

The helper parameters were explicitly widened to `number`. No production version constant, runtime compatibility rule, or migration behavior changed. The corrected feature head then passed the complete suite.

## A1 completion gate

| Gate | Result |
| --- | --- |
| Minimal metadata preflight independent of current business sheets | PASS |
| Exact separate workbook/dataset version axes | PASS |
| Current v1/v1 classification | PASS |
| Missing/invalid metadata rejection | PASS |
| Future-version rejection | PASS |
| Exact migratable-path classification | PASS |
| Unsupported older classification | PASS |
| Pure migration-step contract | PASS |
| Deterministic registry/path semantics | PASS |
| Duplicate/ambiguous source rejection | PASS |
| Self-loop/cycle rejection | PASS |
| No-downgrade rule | PASS |
| Defensive ownership | PASS |
| Production versions remain v1/v1 | PASS |
| Production registry remains empty | PASS |
| Existing importer/hydration behavior unchanged | PASS |
| Full automated suite | PASS |
| TypeScript typecheck | PASS |
| Production build | PASS |

**Phase 5.4A1 is COMPLETE.**

## Scope intentionally deferred

A1 does not execute migration steps during import. It does not alter `importBusinessDatasetFromXlsx(...)`, current strict workbook validation, dataset reconstruction, `PersistenceCoordinator`, hydration, UI, backup behavior, or filesystem behavior.

Those import/migration orchestration responsibilities belong to 5.4A2.

## Next task

**5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff — NEXT / NOT STARTED**

Do not begin 5.4A2 implementation until this A1 closeout is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
