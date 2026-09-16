# Phase 5.6A — Integrated Excel Round-Trip Workflow Plan

## Status

**PLANNING ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning baseline:

```text
develop  3cc9ae0e419a4e0075b04180849b23b7087bc98f
CI       35137244664 — SUCCESS
```

Parent phase:

```text
5.6 — Integration & Completion Gate — IN PROGRESS
```

Previous completed task:

```text
5.5 — Excel Persistence UI — COMPLETE
```

Next exact implementation task after this planning document is merged and the exact resulting `develop` CI is green:

```text
5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics — NEXT / NOT STARTED
```

Do not begin 5.6B during 5.6A implementation.

---

# Objective

Prove that Excel persistence preserves not only source rows, but the application behavior produced from those sources after a complete:

```text
authoritative live source state
-> complete source snapshot
-> canonical XLSX export
-> XLSX import/validation
-> atomic hydration
-> same stable application services
-> equivalent source and derived business behavior
```

Phase 5.6A is an application-integration proof over the production persistence and Phase 1–4 service graph. It is not a new persistence architecture and must not duplicate workbook parsing, validation, hydration, pricing, costing, yield, component, or production logic inside tests.

The existing application `session.ts` already provides the intended integration graph: the stable source repositories, `CompleteSourceSnapshotService`, `ValidatedAtomicDatasetHydrationService`, `PersistenceCoordinator`, and the same Phase 1–4 application services that must continue to behave equivalently after hydration.

---

# Why 5.6A Is Split

The master Phase 5 plan requires ten distinct scenarios, A–J. They span three different proof domains:

1. complete authoritative source fidelity and deterministic workbook semantics;
2. derived Phase 1–4 application-service equivalence after export/import/hydration;
3. invalid/unsupported input safety plus safe-save failure behavior.

Combining all ten scenarios into one change would create an oversized integration harness and make failures difficult to attribute.

5.6A is therefore decomposed into three bounded children:

```text
5.6A — Integrated Excel Round-Trip Workflow                              IN PROGRESS
    5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics NEXT / NOT STARTED
    5.6A2 — Phase 1–4 Derived Service Equivalence                         NOT STARTED
    5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate      NOT STARTED
```

The master-plan scenarios map exactly as follows:

```text
5.6A1 -> A, E, I
5.6A2 -> B, C, D, F
5.6A3 -> G, H, J + aggregate 5.6A completion proof
```

No master-plan scenario is dropped.

---

# Shared Integration Rules

## 1. Prefer the production application graph

For source/derived round-trip scenarios, use the real persistence stack and the same stable services wired by `src/application/session.ts` wherever practical.

The primary path is:

```text
singleton repositories/services
-> CompleteSourceSnapshotService.snapshot()
-> PersistenceCoordinator.exportCurrentWorkbook()
-> real XLSX bytes
-> PersistenceCoordinator.importAndApplyWorkbook(bytes)
-> ValidatedAtomicDatasetHydrationService
-> same repository/service objects
```

Tests must prove stable application-service identity is sufficient after hydration; do not recreate services simply to obtain a passing result unless the scenario specifically requires an isolated graph.

## 2. Reset state deterministically

Every integration test must own its setup/cleanup and replace all nine authoritative collections explicitly so tests remain order-independent.

The nine authoritative source collections are:

- materials;
- material calibrations;
- mix presets;
- products;
- yield samples;
- fixed recipe items;
- product components;
- product stocks;
- product financial profiles.

## 3. Use real XLSX bytes

Round-trip tests must cross the real `SheetJsWorkbookCodec` byte boundary. Neutral workbook documents alone are insufficient for A–H.

Scenario I may additionally decode/normalize workbook documents to compare deterministic schema/row semantics, because the master plan requires semantic determinism rather than relying on ZIP-container byte identity.

## 4. Compare authoritative source separately from derived results

Source equality and derived service equivalence are different assertions:

- source fidelity is proved from snapshots/imported datasets;
- costing/yield/capacity/pricing equivalence is proved by invoking the normal application services before and after hydrate.

Do not persist derived outputs just to make equivalence tests easier.

## 5. Preserve missing-vs-zero semantics

Missing values, explicit zero, `null`, `false`, and omitted optional fields must not collapse into each other during XLSX round-trip.

## 6. No browser/native UI requirement

5.6A is an application integration phase. React/browser status UI was completed in 5.5.

Do not add:

- native Open/Save dialogs;
- managed native paths;
- filesystem locking;
- `fsync`;
- OS rename/replace claims;
- desktop packaging.

Those remain Phase 6.

## 7. Production behavior should not change merely to satisfy tests

5.6A is expected to be predominantly integration-test work.

If a scenario exposes a genuine production defect, fix the smallest owning production layer with focused regression coverage. Do not add test-only business behavior, parallel validation, or persistence shortcuts.

If a large architecture change appears necessary, stop that child and re-plan instead of silently expanding scope.

---

# 5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics

## Purpose

Prove that the complete Phase 1–4 source model survives canonical XLSX export/import/hydration exactly and that equivalent source state produces deterministic workbook schema/row semantics.

## Master scenarios owned

```text
A — Complete Phase 1–4 source round-trip
E — Financial profile missing vs explicit zero
I — Deterministic export
```

## Scenario A — Complete authoritative source round-trip

Construct one representative valid source fixture covering all nine persisted collections and meaningful optional fields.

At minimum include:

- multiple materials with different unit/cost/source combinations;
- material calibration evidence;
- at least one ratio-based mix preset with child lines;
- products with and without optional mix preset references where contract-valid;
- yield sample evidence with normalized child inputs;
- fixed recipe items;
- Material-backed and Product-backed product components;
- explicit ProductStock;
- product financial profile(s).

Required proof:

1. hydrate/populate the authoritative source state;
2. capture the authoritative complete snapshot;
3. export real XLSX bytes through `PersistenceCoordinator`;
4. replace/clear current source state so the test cannot pass from stale repositories;
5. import and hydrate the exported bytes through `PersistenceCoordinator`;
6. capture a new complete snapshot;
7. assert source-semantic equivalence across all nine collections.

Repository/service instances must remain the same objects across hydrate.

## Scenario E — Missing vs explicit zero financial profile semantics

Use at least two valid products:

- Product A: no financial profile record;
- Product B: a configured financial profile with explicit `laborCostPerUnit = 0` and `overheadCostPerUnit = 0`, with `pricingPolicy = null`.

After round-trip prove:

- Product A still has no profile;
- Product B still has a profile;
- explicit zero remains zero, not missing;
- null pricing policy remains null;
- no default profile is manufactured.

## Scenario I — Deterministic export semantics

Build semantically equivalent source states using different repository insertion orders.

Required proof:

- required sheet set/order remains canonical;
- required column order remains canonical;
- source row semantics are deterministic;
- normalized child-sheet row semantics are deterministic;
- equivalent source state does not inherit repository insertion order as workbook meaning.

Use fixed export metadata/clock or compare decoded workbook semantics while intentionally excluding only metadata that is designed to vary between exports, such as `exportedAt`.

Do not require raw ZIP/XLSX byte identity unless the production codec already guarantees it; the master contract requires equivalent workbook schema/row semantics.

## A1 expected implementation shape

Prefer one dedicated integration test module focused on source fidelity/determinism plus small fixture helpers local to the test unless a fixture is clearly reused by A2/A3.

Do not create a general-purpose test framework prematurely.

## A1 completion gate

A1 is complete when scenarios A, E, and I are green through real persistence boundaries and the existing Phase 1–5.5 regression/typecheck/build remain green.

After A1 closes, advance exactly to:

```text
5.6A2 — Phase 1–4 Derived Service Equivalence — NEXT / NOT STARTED
```

---

# 5.6A2 — Phase 1–4 Derived Service Equivalence

## Purpose

Prove that authoritative XLSX persistence preserves the business meaning consumed by the existing Phase 1–4 services.

This child is the core reason 5.6A exists: row equality alone is insufficient.

## Master scenarios owned

```text
B — Calibration-dependent material
C — Yield + recipe Product
D — Nested components and ProductStock
F — Phase 4 pricing/production equivalence
```

## Common equivalence pattern

For each scenario:

1. establish valid live authoritative source state;
2. calculate the relevant derived result(s) through normal application services;
3. export real XLSX bytes through the production coordinator;
4. clear/replace authoritative state to prove the result is not stale;
5. import/hydrate the XLSX through the production coordinator;
6. invoke the same already-wired service objects again;
7. compare the business-semantic results.

The same service objects should be used before and after hydrate wherever the current stable-session architecture supports it.

## Scenario B — Calibration-dependent material

Persist and reload real volume-to-weight calibration evidence, including the master-plan `cup -> g` case.

Prove after hydrate that the same application path resolves the same:

- effective material conversion/normalization;
- package/base-unit costing result;
- calibration selection semantics.

The test must rely on `CalibrationService`/material calibration evidence consumed by the existing material/cost services rather than manually recalculating conversion math in the test.

## Scenario C — Yield + recipe Product

Persist/reload a Product with the required combination of:

- mix preset;
- yield samples;
- yield sample inputs;
- fixed recipe items.

Prove equivalent post-hydration behavior for the normal application services that derive effective product requirements and material-cost preview.

At minimum compare:

- effective recipe/material requirements;
- yield-derived requirement behavior where applicable;
- material-cost preview/result used by later costing services.

## Scenario D — Nested components and ProductStock

Persist/reload a component graph containing both:

- Material-backed component(s);
- Product-backed nested component(s);
- explicit ProductStock for product-backed availability.

Prove equivalent post-hydration behavior for:

- component relationships;
- recursive/component-aware cost behavior;
- source availability/capacity behavior;
- explicit ProductStock semantics.

The scenario must include a valid acyclic nested-product graph.

## Scenario F — Phase 4 pricing and production equivalence

Use a configured product that exercises the completed Phase 4 stack.

Capture before/after round-trip results from the normal services for representative outputs such as:

- fully loaded unit cost;
- product pricing quote / selling-price derivation;
- profit/markup/margin metrics represented by the quote path;
- physical planned-batch production cost;
- expected batch financials;
- assembly capacity trace and/or planned-batch capacity feasibility.

Compare business-semantic results, including limiting/bottleneck meaning where present.

Do not snapshot or persist these derived outputs.

## A2 expected implementation shape

Prefer one dedicated service-equivalence integration suite using the real shared application graph and reusable fixture setup only where it materially reduces duplication.

Production service constructors should not be duplicated merely to test persistence; `session.ts` is the canonical composition root for the live application graph.

## A2 completion gate

A2 is complete when scenarios B, C, D, and F prove the same derived application behavior before and after real XLSX export/import/hydration, with all prior suites still green.

After A2 closes, advance exactly to:

```text
5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate — NEXT / NOT STARTED
```

---

# 5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate

## Purpose

Prove that the integrated persistence workflow fails safely for invalid/unsupported workbooks and save-transaction faults, then close parent 5.6A with the full A–J scenario matrix green.

## Master scenarios owned

```text
G — Invalid workbook leaves state unchanged
H — Unsupported future version
J — Backup/replace failure path
```

A3 also owns the aggregate **5.6A completion gate** after A1 and A2 are complete.

## Scenario G — Invalid workbook preserves live state

Start from a known-good non-empty authoritative source state and snapshot it.

Attempt real import through `PersistenceCoordinator.importAndApplyWorkbook(...)` for representative invalid workbook cases required by the master plan:

- invalid reference/business relationship;
- invalid canonical schema/structure;
- invalid row/value data.

Required proof for each case:

- import returns controlled rejection rather than partial mutation;
- hydration is not applied for parse/validation rejection;
- complete authoritative live source snapshot remains equal to the known-good snapshot;
- stable repositories/services remain usable afterward.

Do not rely only on the React/browser rejection tests from 5.5C3; A3 must prove the application integration boundary directly.

## Scenario H — Unsupported future version

Create a valid-looking workbook with a future unsupported workbook and/or dataset version according to the compatibility contract.

Required proof:

- rejection occurs before live-state hydration;
- previous authoritative source state remains unchanged;
- structured issue evidence reports received/expected compatibility context;
- no migration guessing or silent downgrade occurs.

## Scenario J — Backup/staged/replace failure integration

Use the existing fake/in-memory transport contract rather than native filesystem code.

Exercise the production `PersistenceCoordinator.saveCurrentWorkbook(...)` path with controlled transport faults covering the master-plan safe-save concerns:

- backup failure when backup is required;
- staging/pre-commit failure;
- replacement/commit failure.

Required proof:

- no failed transaction is reported as a successful save;
- prior primary workbook bytes remain recoverable/preserved for pre-commit failures according to the established 5.4B contract;
- exact transport failure stage/commit state remains visible through the existing operational error contract;
- no coordinator-level fake rollback re-runs snapshot/export;
- no atomicity/backup capability is upgraded beyond the transport receipt.

Existing 5.4B unit/completion tests remain authoritative for low-level transport mechanics; A3 should add only the integrated proof required by Scenario J and must not copy the entire 5.4B suite.

## A3 aggregate 5.6A completion gate

Before 5.6A may be marked COMPLETE, verify all ten master scenarios:

```text
A — complete source round-trip                          GREEN
B — calibration-dependent material equivalence         GREEN
C — yield + recipe Product equivalence                 GREEN
D — nested components + ProductStock equivalence       GREEN
E — financial profile missing vs explicit zero         GREEN
F — Phase 4 pricing/production equivalence             GREEN
G — invalid workbook preserves state                   GREEN
H — unsupported future version                         GREEN
I — deterministic workbook schema/row semantics        GREEN
J — backup/replace failure integration                 GREEN
```

Also keep green:

- all existing Phase 1–4 integration suites;
- all Phase 5 persistence/compatibility/recovery/safe-save suites;
- 5.5A browser import regression;
- 5.5B browser export regression;
- 5.5C persistence UX completion regression;
- TypeScript typecheck;
- production build.

## A3 / parent 5.6A completion gate

5.6A is complete only when:

1. all A–J scenarios are represented by explicit integration evidence;
2. real XLSX bytes cross the codec boundary for source/service round-trip scenarios;
3. all nine authoritative source collections are covered by the complete source fixture;
4. stable application services produce equivalent business results after hydrate;
5. missing-vs-zero/null semantics remain intact;
6. invalid/future workbooks preserve previous live state;
7. safe-save integration retains the established 5.4B transaction truthfulness;
8. no browser/native filesystem scope is incorrectly introduced;
9. full regression, typecheck, and build are green;
10. implementation PR(s), guarded merges, and exact post-merge `develop` CI are green.

After the 5.6A closeout is merged and exact `develop` CI is green, advance exactly to:

```text
5.6B — Regression / Build / Phase 5 Completion — NEXT / NOT STARTED
```

Do not begin 5.6B without a separate user instruction.

---

# Ownership Boundaries

## 5.6A owns

- application-level source round-trip integration proof;
- Phase 1–4 derived-service equivalence after hydrate;
- deterministic workbook semantic integration proof;
- application-level invalid/future import state-preservation proof;
- application-level safe-save failure integration proof;
- the A–J integrated scenario matrix.

## 5.6A does not own

### 5.6B

- final repository-wide Phase 5 completion closeout;
- final documentation reconciliation for Phase 5 as a whole;
- declaring Phase 5 COMPLETE;
- advancing Phase 6 to next-for-scope-review.

### Phase 6

- Tauri native Open/Save/Save As dialogs;
- managed native file paths;
- real filesystem backup locations;
- OS atomic rename/replace guarantees;
- locks and `fsync`;
- crash consistency;
- desktop packaging.

### Phase 5.5 UI

- new browser persistence UX/status/recovery behavior unless a regression is discovered;
- duplicate React workbook logic.

---

# Expected Change Discipline

Each child should use the existing repository workflow:

1. verify exact green `develop` baseline;
2. create a focused feature branch from that exact SHA;
3. implement only the child scenario group;
4. run branch CI;
5. open PR to `develop`;
6. require exact-head PR CI green;
7. merge with expected-head SHA guard;
8. verify exact post-merge `develop` CI;
9. add/merge child completion documentation if consistent with the established repository pattern;
10. stop before the next child until the user separately says to proceed.

Never merge red CI.

---

# Planning Completion Result

Planning decision:

```text
5.6A requires decomposition.
```

Locked child sequence:

```text
5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics
5.6A2 — Phase 1–4 Derived Service Equivalence
5.6A3 — Rejection / Safe-Save Integration & 5.6A Completion Gate
```

Current exact task after this plan is merged and exact `develop` CI is green:

```text
5.6A1 — Source Round-Trip Fidelity & Deterministic Workbook Semantics — NEXT / NOT STARTED
```

No 5.6A implementation is part of this planning change.
