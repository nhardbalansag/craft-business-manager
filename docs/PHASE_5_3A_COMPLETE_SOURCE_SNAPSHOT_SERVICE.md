# Phase 5.3A — Complete Source Snapshot Service

## Status

**COMPLETE**

Phase 5.3A establishes the application-level read-only boundary that captures every authoritative live business-source repository as one complete current-schema `BusinessDataset`.

No hydration, workbook transport, file I/O, UI, or derived business output was added in this phase.

---

## 1. Baseline and planning gate

Implementation proceeded only after the dedicated 5.3A plan was established and merged.

```text
Planning baseline develop      5109c7f045835ca4835349d49eff5ff3681cc8fc
Planning baseline CI           35012885175 — SUCCESS
Planning PR #148               MERGED
Planning merge                 e395166246cff04cdefcecf1a5f9c0477e97b437
Planning post-merge CI         35018499386 — SUCCESS
```

Dedicated plan:

`docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE_PLAN.md`

The planning split assessment remained valid: 5.3A required no deeper formal numbered sub-phases.

---

## 2. Delivered application boundary

New service:

```text
src/application/persistence/CompleteSourceSnapshotService.ts
```

Public application shape:

```ts
interface CompleteSourceSnapshotRepositories {
  materials: MaterialRepository;
  calibrations: CalibrationRepository;
  mixPresets: MixPresetRepository;
  products: ProductRepository;
  yieldSamples: YieldSampleRepository;
  recipeItems: FixedRecipeItemRepository;
  productComponents: ProductComponentRepository;
  productStocks: ProductStockRepository;
  productFinancialProfiles: ProductFinancialProfileRepository;
}

class CompleteSourceSnapshotService {
  snapshot(): Promise<BusinessDataset>;
}
```

The service depends only on repository interfaces. It does not depend on concrete in-memory repositories, React, workbook codecs, browser APIs, native filesystem APIs, or Tauri.

---

## 3. Complete authoritative source inventory

Every successful snapshot includes exactly the nine source collections established by Phase 5.1A:

```text
materials
materialCalibrations
mixPresets
products
yieldSamples
recipeItems
productComponents
productStocks
productFinancialProfiles
```

The snapshot also assigns:

```ts
schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION
```

No schema-version literal is duplicated inside the snapshot service.

---

## 4. Deterministic top-level ordering

Repository insertion order is not exposed as persistence semantics.

Each top-level source collection is copied and sorted by its durable identity using trim-aware case-insensitive comparison with exact-text tie-breaking:

```text
materials                  -> id
materialCalibrations       -> id
mixPresets                 -> id
products                   -> id
yieldSamples               -> id
recipeItems                -> id
productComponents          -> id
productStocks              -> productId
productFinancialProfiles   -> productId
```

The application layer does not import workbook row-order definitions or storage mapping code.

Nested source arrays remain represented according to their existing domain source object instead of being arbitrarily reordered by 5.3A.

---

## 5. Defensive snapshot ownership

The final snapshot passes through the existing:

```ts
cloneBusinessDataset(...)
```

boundary.

This provides independent ownership for all persisted source state, including mutable nested source structures such as:

- Material supplier/source metadata;
- MixPreset compatible-category arrays and line arrays;
- YieldSample material-input arrays;
- Product financial pricing policies.

Verified behavior:

```text
mutate returned snapshot
  -> live repository-owned source objects unchanged

change repository-owned source objects after snapshot
  -> previously returned snapshot unchanged
```

5.3A therefore does not rely on accidental cloning behavior of any particular repository implementation.

---

## 6. Source-evidence semantics preserved

The snapshot service does not repair or synthesize source evidence.

It preserves distinctions such as:

```text
no ProductStock row
!=
ProductStock row with onHandQuantity = 0

no ProductFinancialProfile row
!=
zero-cost ProductFinancialProfile

pricingPolicy = null
!=
a configured pricing policy
```

The service does not create missing stock/profile/calibration rows and does not rewrite IDs, timestamps, source metadata, monetary values, or quantities.

---

## 7. Read-only and all-or-nothing behavior

5.3A calls only repository `list()` operations.

It does not call:

```text
insert
replace
upsert
delete
```

All nine reads are collected as one snapshot operation. If any repository read rejects, the snapshot rejects and no partial `BusinessDataset` is returned.

No live repository mutation occurs during either success or failure.

---

## 8. Derived values remain excluded

The returned object is the authoritative `BusinessDataset` source envelope only.

5.3A does not persist or snapshot derived results such as:

- normalized material conversions;
- grams-per-cup derivations;
- learned yield requirements;
- costing previews;
- component costs;
- production requirements;
- capacity results;
- selling prices;
- profit/markup/margin metrics;
- expected batch financials;
- planned-batch feasibility.

Those remain recalculated from restored source evidence.

---

## 9. Shared session composition

`src/application/session.ts` now exposes:

```ts
completeSourceSnapshotService
```

wired to the same nine authoritative live repositories used by the existing Phase 1–4 application services.

This gives later persistence coordination one application entry point instead of requiring React or storage code to enumerate all repositories independently.

No Phase 5 persistence UI was added.

---

## 10. Focused regression coverage

New focused test file:

```text
src/application/persistence/CompleteSourceSnapshotService.test.ts
```

Focused tests verify:

1. canonical empty current-schema dataset;
2. all nine source collections and deterministic top-level identity ordering;
3. deep defensive isolation of top-level and nested source state;
4. preservation of explicit zero/null evidence without synthesized missing rows;
5. all-or-nothing repository-read failure behavior with no write calls.

---

## 11. Validation evidence

Implementation feature:

```text
Implementation branch           feature/phase-5-3a-complete-source-snapshot
Implementation head             73b67db22da2287c74fb57cd8f3e62f38b32a1a9
Implementation PR #149          MERGED
Feature/PR CI                    35018972923 — SUCCESS
Implementation merge            2d475f0eded6acafeb03830cba768b3d84cb078d
Post-merge develop CI           35019082343 — SUCCESS
```

Both feature and exact post-merge validation passed:

```text
TypeScript typecheck   SUCCESS
Full test suite        SUCCESS
Production Vite build SUCCESS
5 focused 5.3A tests  SUCCESS
```

No corrective implementation commit was required after the first feature head reached CI.

---

## 12. Completion gate result

The 5.3A completion gate is satisfied:

- one application service reads all nine authoritative repositories — **YES**;
- one complete current-schema `BusinessDataset` is returned — **YES**;
- top-level source ordering is deterministic — **YES**;
- snapshot-owned source data is deeply isolated from live state — **YES**;
- nested mutable structures do not alias repository-owned data — **YES**;
- zero/null/absence semantics are preserved — **YES**;
- no derived business output is included — **YES**;
- no repository mutation occurs — **YES**;
- failed reads return no partial snapshot — **YES**;
- shared session exposes the snapshot boundary — **YES**;
- React does not need to enumerate repositories — **YES**;
- focused tests are green — **YES**;
- full test/typecheck/build and post-merge CI are green — **YES**;
- 5.3B was not started as part of this work — **YES**.

---

## 13. Resulting persistence boundary

```text
live authoritative repositories
           |
           v
CompleteSourceSnapshotService
           |
           v
complete BusinessDataset
           |
           +--> deterministic XLSX export already available from 5.2B
           |
           `--> future save coordination in 5.3C
```

The reverse live-state operation is intentionally still missing:

```text
validated BusinessDataset
           |
           v
atomic live repository replacement
```

That is the next task.

---

## 14. Next task

```text
5.3B — Validated Atomic Dataset Hydration
```

Status after this closeout:

**NEXT / NOT STARTED**

5.3B must begin with its own scope/decomposition review and dedicated development plan from the exact final green 5.3A closeout baseline. Do not start hydration automatically as part of this closeout.
