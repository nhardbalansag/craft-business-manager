# Phase 5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics

## Status

**COMPLETE**

Parent:

```text
5.6A — Integrated Excel Round-Trip Workflow — IN PROGRESS
```

Next exact task:

```text
5.6A2 — Phase 1–4 Derived Service Equivalence — NEXT / NOT STARTED
```

Phase 5 remains **IN PROGRESS**. Phase 5.6B remains **NOT STARTED**.

---

## Objective

Prove the source-fidelity portion of the Phase 5.6A integration contract through the real application persistence composition, real XLSX bytes, and the same live singleton repositories used by the application.

A1 owns master-plan scenarios:

```text
A — Complete Phase 1–4 source round-trip
E — Financial profile missing vs explicit zero
I — Deterministic export semantics
```

This phase is an integration proof only. No production runtime behavior, domain contract, workbook schema, coordinator, transport, React UI, or native-filesystem behavior was changed.

---

## Authoritative Baseline

```text
develop  c70eaebbb2af62a28868985ff4cf0dfacfc64d8d
CI       35138470416 — SUCCESS
```

The baseline already contained the merged Phase 5.6A decomposition plan:

`docs/PHASE_5_6A_INTEGRATED_EXCEL_ROUND_TRIP_WORKFLOW_PLAN.md`

---

## Implementation

Feature branch:

`feature/phase-5-6a1-source-round-trip-fidelity`

Implementation file:

`src/application/persistence/Phase56A1SourceRoundTripFidelity.test.ts`

The implementation added exactly one integration-test module and no production files.

The test suite uses the real application singleton graph from `src/application/session.ts`, including:

- `completeSourceSnapshotService`;
- `validatedAtomicDatasetHydrationService`;
- `persistenceCoordinator`;
- the real `SheetJsWorkbookCodec` reached through the coordinator/export path;
- all nine authoritative source repositories.

The representative fixture covers all nine persisted source collections:

1. materials;
2. material calibration evidence;
3. mix presets;
4. products;
5. yield samples;
6. fixed recipe items;
7. product components;
8. product stock;
9. product financial profiles.

---

## Scenario A — Complete Phase 1–4 Source Round-Trip

The integration proof:

1. hydrates a representative complete current-schema dataset into the live singleton repositories;
2. snapshots the authoritative source state through `CompleteSourceSnapshotService`;
3. exports real `.xlsx` bytes through `PersistenceCoordinator.exportCurrentWorkbook()`;
4. hydrates the canonical empty dataset to clear the live source repositories;
5. verifies the live source snapshot is actually empty, preventing stale state from satisfying the test;
6. imports and applies the exported bytes through `PersistenceCoordinator.importAndApplyWorkbook()`;
7. snapshots the rehydrated source state;
8. proves exact source-semantic equality with the pre-export snapshot;
9. proves the same nine repository objects remain in use after hydration.

The fixture exercises materials with supplier/source metadata, material calibration evidence, nested normalized mix/yield child arrays, products, fixed recipe data, material-backed and product-backed components, ProductStock, and financial profile evidence.

Result: **PASS**.

---

## Scenario E — Financial Profile Missing vs Explicit Zero

The round-trip proves these states remain distinct:

### Missing profile

Products intentionally created without a `ProductFinancialProfile` still have no profile after export -> clear -> import -> hydrate.

No default financial profile is manufactured.

### Explicit zero profile

A configured profile with:

```text
laborCostPerUnit    0
overheadCostPerUnit 0
pricingPolicy       null
```

survives round-trip as that exact configured source state, including its notes.

Therefore:

```text
missing profile != explicit zero-cost profile
pricingPolicy null remains null
```

Result: **PASS**.

---

## Scenario I — Deterministic Workbook Semantics

Equivalent authoritative source state is hydrated in different top-level repository insertion orders and exported twice through the real coordinator.

Both XLSX outputs are decoded using the production `SheetJsWorkbookCodec` and compared semantically.

The proof establishes:

- canonical sheet order equals `CANONICAL_WORKBOOK_SHEET_NAMES`;
- every sheet uses the exact column order declared by `WORKBOOK_SHEETS`;
- canonical workbook row semantics are equal for equivalent source state after excluding only `_Meta.exportedAt`, which is deliberately operation-time metadata;
- material and Product rows are deterministically ordered;
- normalized child-sheet semantics remain deterministic for:
  - `MixPresetCategories`;
  - `MixPresetLines`;
  - `YieldSampleInputs`.

The test deliberately does **not** require byte-identical ZIP containers because XLSX container metadata may vary independently of the authoritative workbook semantics.

Result: **PASS**.

---

## Regression / CI Evidence

```text
A1 baseline                     c70eaebbb2af62a28868985ff4cf0dfacfc64d8d
A1 baseline CI                  35138470416 — SUCCESS
Feature head                    784d0eb41ca25346b46e69bcac740903c14e4f02
Feature branch CI               35139602664 — SUCCESS
Implementation PR               #211 — MERGED
Implementation PR CI            35139807458 — SUCCESS
Implementation merge            4f01b4b706bb82fad260d407d7b4c4173a230b40
Post-implementation develop CI  35139932051 — SUCCESS
129 test files / 1430 tests
3 focused A1 integration tests
Typecheck PASS
Production build PASS
149 modules transformed
```

No corrective implementation commit was required. The first full feature-branch gate passed.

---

## Scope Verification

Effective implementation diff:

```text
1 commit ahead / 0 behind
1 added test file
384 additions / 0 deletions
```

No changes were made to:

- production application services;
- domain types or rules;
- BusinessDataset schema;
- workbook schema/import/export implementation;
- `PersistenceCoordinator`;
- hydration mechanics;
- transport/save behavior;
- React/browser persistence UI;
- Phase 6 native filesystem/Tauri scope.

---

## Completion Decision

All A1-owned scenarios are green through the real persistence integration boundary.

Therefore:

```text
5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics — COMPLETE
```

The Phase 5.6A parent is **not complete yet**. Remaining children are:

```text
5.6A2 — Phase 1–4 Derived Service Equivalence                    NEXT / NOT STARTED
5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate NOT STARTED
```

Do not begin 5.6A2 without a separate user instruction after this closeout is merged and the exact resulting `develop` CI is green.