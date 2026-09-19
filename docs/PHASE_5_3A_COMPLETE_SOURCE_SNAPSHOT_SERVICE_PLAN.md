# Phase 5.3A — Complete Source Snapshot Service Plan

## Status

**PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning base:

```text
develop  5109c7f045835ca4835349d49eff5ff3681cc8fc
CI       35012885175 — SUCCESS
```

Predecessors:

```text
5.1A  Persisted Dataset Source Inventory & Contract Completeness   COMPLETE
5.1B  Workbook Schema / Sheet / Column Contracts                   COMPLETE
5.1C  Dataset Validation & Reference Integrity                     COMPLETE
5.2A  XLSX Library Evaluation & Codec Boundary                     COMPLETE
5.2B  Deterministic Dataset-to-XLSX Export                         COMPLETE
5.2C  Strict XLSX-to-Dataset Import & Diagnostics                  COMPLETE
```

This document plans 5.3A only. It does not start implementation.

---

## 1. Objective

Create one application-level, read-only operation that snapshots every authoritative live source repository into one complete current-schema `BusinessDataset`.

Target flow:

```text
MaterialRepository --------------------\
CalibrationRepository ------------------\
MixPresetRepository ---------------------\
ProductRepository ------------------------\
YieldSampleRepository ---------------------> CompleteSourceSnapshotService
FixedRecipeItemRepository -----------------/             |
ProductComponentRepository ---------------/              v
ProductStockRepository ------------------/       current BusinessDataset
ProductFinancialProfileRepository -------/                |
                                                        defensive
                                                         ownership
```

The result must be suitable for later persistence/export without React, storage codecs, or transport code knowing how to enumerate application repositories.

5.3A is read-only. It does not hydrate repositories, load workbooks, save files, or coordinate persistence lifecycle operations.

---

## 2. Split assessment

5.3A does **not** require deeper formal numbered sub-phases.

Reason:

- the complete source inventory and `BusinessDataset` contract are already locked by 5.1A;
- each of the nine authoritative repositories already exposes `list()`;
- dataset defensive cloning and the current schema-version constant already exist;
- 5.3A has one cohesive responsibility: repository state -> complete source dataset snapshot;
- hydration/replacement is a materially different write concern already isolated as 5.3B;
- save/load orchestration is already isolated as 5.3C;
- splitting a read-only snapshot across formal phases would create artificial intermediate states without adding a useful architectural boundary.

Implementation will use internal checkpoints instead:

1. define the nine-repository dependency contract;
2. collect all source collections without derived-service calls;
3. apply deterministic top-level collection ordering;
4. establish deep defensive snapshot ownership through the existing dataset clone boundary;
5. expose the service through the shared application session without React repository knowledge;
6. validate complete, empty, deterministic, non-mutating, and defensive-isolation behavior.

---

## 3. Existing authoritative boundaries to reuse

### 3.1 Complete BusinessDataset contract

`src/domain/types.ts` already defines the complete persisted source dataset:

```ts
interface BusinessDataset {
  schemaVersion: number;
  materials: Material[];
  materialCalibrations: MaterialCalibrationEvidence[];
  mixPresets: MixPreset[];
  products: Product[];
  yieldSamples: YieldSample[];
  recipeItems: FixedRecipeItem[];
  productComponents: ProductComponent[];
  productStocks: ProductStock[];
  productFinancialProfiles: ProductFinancialProfile[];
}
```

5.3A must populate exactly these nine source collections.

It must not add derived results such as costs, yields, capacities, quotes, margins, revenue, or production feasibility.

### 3.2 Current dataset schema version

`src/domain/businessDataset.ts` already owns:

```ts
CURRENT_BUSINESS_DATASET_SCHEMA_VERSION
```

The snapshot service must use this constant directly when constructing the dataset. It must not hard-code another schema version.

### 3.3 Defensive clone boundary

`cloneBusinessDataset(...)` already deep-copies every persisted source collection, including mutable nested structures such as:

- Material source metadata;
- MixPreset arrays/lines;
- YieldSample input arrays;
- Product pricing policy;
- other current nested source values.

5.3A should reuse this boundary rather than creating a second manual deep-cloning implementation.

### 3.4 Repository read boundary

The shared application session already owns exactly these authoritative repositories:

```text
MaterialRepository
CalibrationRepository
MixPresetRepository
ProductRepository
YieldSampleRepository
FixedRecipeItemRepository
ProductComponentRepository
ProductStockRepository
ProductFinancialProfileRepository
```

All nine interfaces expose:

```ts
list(): Promise<SourceRecord[]>
```

No repository-interface expansion is required for 5.3A.

### 3.5 Session composition boundary

`src/application/session.ts` currently creates the live in-memory repositories and wires all business services around them.

5.3A should add one shared snapshot service instance at this composition root so future UI/persistence coordination can depend on the snapshot operation rather than importing nine repositories separately.

---

## 4. Recommended application boundary

Recommended implementation location:

```text
src/application/persistence/CompleteSourceSnapshotService.ts
```

Recommended dependency contract:

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
```

Recommended service shape:

```ts
class CompleteSourceSnapshotService {
  constructor(repositories: CompleteSourceSnapshotRepositories) {}

  snapshot(): Promise<BusinessDataset>;
}
```

Exact names may be refined during implementation, but the following architectural rules are locked:

- the service depends on repository interfaces, not in-memory concrete repository classes;
- the service returns `BusinessDataset`, not workbook rows or XLSX bytes;
- it does not depend on `WorkbookCodec`, `ExcelStorage`, browser APIs, Tauri APIs, or React;
- it performs no repository writes;
- it owns complete source aggregation at the application layer.

---

## 5. Snapshot algorithm

The snapshot operation should follow a simple fail-fast read flow:

```text
1. read all nine repository source collections
2. construct current-schema BusinessDataset candidate
3. apply deterministic top-level ordering
4. deep-clone into snapshot-owned data
5. return snapshot
```

Recommended pseudo-flow:

```ts
const dataset: BusinessDataset = {
  schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
  materials: await materials.list(),
  materialCalibrations: await calibrations.list(),
  mixPresets: await mixPresets.list(),
  products: await products.list(),
  yieldSamples: await yieldSamples.list(),
  recipeItems: await recipeItems.list(),
  productComponents: await productComponents.list(),
  productStocks: await productStocks.list(),
  productFinancialProfiles: await productFinancialProfiles.list(),
};

return cloneBusinessDataset(canonicalizeSnapshot(dataset));
```

The exact mechanics may use `Promise.all` only if doing so preserves understandable failure behavior and does not introduce side effects. Sequential reads are also valid. There is no performance requirement that justifies unsafe complexity here.

---

## 6. Deterministic ordering contract

5.3A should make the returned top-level source collections deterministic rather than exposing repository insertion order as persistence semantics.

### 6.1 Canonical text comparison

Use stable trim-aware case-insensitive ordering with exact-text tie-breaks for source identities, matching the deterministic intent already used by the workbook layer without importing storage code into the application layer.

Conceptually:

```text
canonical identity = trim(identity).toLocaleLowerCase()
primary comparison = canonical identity
secondary tie-break = exact identity text
```

### 6.2 Collection identity keys

Implementation should use each source contract's durable identity:

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

Where evidence records have an existing chronology-sensitive deterministic policy, identity remains the final stable tie-breaker; 5.3A must not mutate timestamps or source IDs.

### 6.3 Nested collection order

5.3A must **not** arbitrarily sort mutable nested arrays whose existing order is part of the source object representation.

Examples include:

- MixPreset compatible categories / ratio lines;
- YieldSample material inputs.

The snapshot service canonicalizes top-level repository collections only. Existing domain clone helpers preserve nested source structure.

### 6.4 No storage dependency

Do not import workbook schema row-order definitions or `businessDatasetWorkbookExport.ts` into the application layer.

Workbook export remains free to apply its own workbook-specific row ordering. 5.3A merely guarantees stable complete source collection ordering at the dataset boundary.

---

## 7. Defensive ownership contract

A successful snapshot must have independent ownership from live repository state.

Required guarantees:

```text
mutate returned snapshot
  -> live repositories unchanged

mutate/replace repository state after snapshot
  -> previously returned snapshot unchanged

mutate nested returned source objects/arrays
  -> live repository objects unchanged
```

This is why repository `list()` output must not simply be returned directly as the final dataset, even when current in-memory repositories already clone some values.

The existing `cloneBusinessDataset(...)` boundary should be the final ownership gate.

---

## 8. Read-only / non-mutation contract

5.3A must not call repository write methods:

```text
insert
replace
upsert
delete
```

It must not call business services that can derive, normalize, repair, or mutate source state.

It must not:

- validate by rewriting source rows;
- fill missing optional fields;
- synthesize default ProductStock rows;
- synthesize default ProductFinancialProfile rows;
- create missing calibration evidence;
- normalize source IDs by rewriting them;
- recalculate or persist derived values.

Snapshot means observation of authoritative source state, not repair.

---

## 9. Validation boundary

5.3A is expected to snapshot the live application source repositories, whose write services already enforce their source contracts.

The snapshot service should still construct a complete current-schema `BusinessDataset` and pass through the existing completeness/clone boundary.

Full semantic/reference/graph validation remains reusable downstream through 5.1C and must not be duplicated inside 5.3A.

Recommended rule:

- 5.3A guarantees **completeness, current schema version, deterministic ordering, and defensive ownership**;
- 5.1C remains the authoritative explicit validation operation when persistence/export/import workflows require dataset acceptance diagnostics;
- 5.3C may invoke validation as part of save/load lifecycle coordination where appropriate.

This avoids turning a read-only snapshot service into a second domain validation implementation.

---

## 10. Failure semantics

If any repository read rejects, the snapshot operation must reject and return no partial `BusinessDataset`.

No best-effort or partial snapshot is allowed.

Required behavior:

```text
all nine repository reads succeed
  -> return one complete snapshot

any repository read fails
  -> reject snapshot operation
  -> no partial BusinessDataset returned
  -> no live repository mutation
```

5.3A does not need a user-facing persistence diagnostic type yet. Controlled save/load diagnostics belong to 5.3C/5.4C. Tests should nevertheless prove that source read failures do not produce partial data or writes.

---

## 11. Session integration

After the service is implemented, `src/application/session.ts` should expose a shared instance similar to:

```ts
export const completeSourceSnapshotService = new CompleteSourceSnapshotService({
  materials: materialRepository,
  calibrations: calibrationRepository,
  mixPresets: mixPresetRepository,
  products: productRepository,
  yieldSamples: yieldSampleRepository,
  recipeItems: fixedRecipeItemRepository,
  productComponents: productComponentRepository,
  productStocks: productStockRepository,
  productFinancialProfiles: productFinancialProfileRepository,
});
```

This is the future application persistence entry point.

React must not gain imports for all nine repositories merely to save/export data.

No UI needs to call the service in 5.3A; user-facing persistence workflows remain Phase 5.5.

---

## 12. Expected implementation files

Primary expected source changes:

```text
src/application/persistence/CompleteSourceSnapshotService.ts
src/application/persistence/CompleteSourceSnapshotService.test.ts
src/application/session.ts
```

Documentation after successful implementation:

```text
docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE.md
docs/PHASE_5_PROGRESS.md
```

No storage codec file, workbook schema file, domain financial formula file, or React page should require behavior changes for this task.

If implementation discovery proves a small shared comparator helper is justified, it must remain application/domain-neutral and must not create a dependency from application code into `src/storage`.

---

## 13. Test plan

### 13.1 Complete nine-collection snapshot

Populate all nine repositories with representative source records and prove that `snapshot()` returns all nine collections plus the current schema version.

### 13.2 Empty live state

With all repositories empty:

```ts
snapshot()
```

must return the canonical shape:

```text
schemaVersion = CURRENT_BUSINESS_DATASET_SCHEMA_VERSION
all nine source collections = []
```

### 13.3 Deterministic ordering

Seed repositories in deliberately non-canonical insertion order and verify snapshot top-level collection order is deterministic.

Include case/whitespace-sensitive identity examples where valid source contracts permit them so exact tie-break behavior is explicit.

### 13.4 Deep defensive isolation

After taking a snapshot:

- mutate a top-level snapshot array;
- mutate a nested Material source object;
- mutate a MixPreset nested array/line;
- mutate a YieldSample input array/item;
- mutate a Product pricing policy when present;

Then verify repository state is unchanged.

### 13.5 Snapshot stability after repository changes

Take snapshot A, then modify live repository state through test setup/repository methods. Verify snapshot A does not change retroactively.

### 13.6 Missing-vs-zero/null semantics

Verify source evidence remains distinct:

- no ProductStock row vs explicit `0` stock row;
- no ProductFinancialProfile vs explicit zero-valued profile fields;
- `pricingPolicy = null` vs an actual pricing policy;
- absent optional Material source fields vs explicit source text.

### 13.7 No derived outputs

Type/runtime assertions should demonstrate that the returned object contains only the `BusinessDataset` envelope and nine authoritative source collections.

No costing, yield-learning, capacity, pricing, quote, or batch-financial results belong in the snapshot.

### 13.8 Read-only behavior

Use repository spies/fakes where useful to prove snapshot invokes only `list()` and no write method.

### 13.9 Failure is all-or-nothing

Make one repository `list()` reject and verify:

- `snapshot()` rejects;
- no `BusinessDataset` is returned;
- no repository write is attempted.

### 13.10 Shared session smoke coverage

Verify the shared application session exposes a usable snapshot service wired to the same nine live repositories used by existing Phase 1–4 services.

---

## 14. Regression gates

The implementation completion gate should require:

```text
npm test
npx tsc --noEmit
npm run build
```

and exact GitHub Actions CI success on the feature head and post-merge `develop`.

Existing Phase 1–5.2 tests must remain green because 5.3A must not change business formulas, workbook mapping, or import behavior.

---

## 15. Explicit out-of-scope work

5.3A does **not** include:

- candidate dataset hydration;
- repository bulk replacement;
- rollback/atomic replacement logic;
- workbook import/export changes;
- `ExcelStorage.load()` implementation;
- `ExcelStorage.save()` implementation;
- save/open coordinator lifecycle;
- browser file picker/download workflows;
- backup creation;
- version migration;
- corruption/resource-limit recovery handling;
- Tauri dialogs/filesystem access;
- persistence UI;
- Google Sheets integration;
- changes to Phase 1–4 financial/conversion/yield/capacity formulas.

Those remain owned by later tasks, principally 5.3B, 5.3C, 5.4, 5.5, and Phase 6.

---

## 16. Completion gate

5.3A is complete only when all of the following are true:

- one application service reads all nine authoritative repositories;
- it returns one complete current-schema `BusinessDataset`;
- top-level source collection ordering is deterministic;
- all returned source state is defensively owned by the snapshot;
- nested mutable source structures do not alias live repository data;
- explicit zero/null/absence semantics are preserved;
- no derived service result is included;
- snapshot performs no application-state mutation;
- failure of any source read yields no partial accepted snapshot;
- the shared application session exposes the snapshot boundary;
- React does not need to enumerate repositories;
- focused tests pass;
- full regression, TypeScript typecheck, production build, and CI are green;
- 5.3B remains not started.

---

## 17. Stop point

This planning step contains **no 5.3A source implementation**.

A separate implementation feature branch may be created only after this planning PR is merged, exact post-merge `develop` CI is green, and the user separately says to proceed.

Next implementation task after that gate:

```text
5.3A — Complete Source Snapshot Service
```
