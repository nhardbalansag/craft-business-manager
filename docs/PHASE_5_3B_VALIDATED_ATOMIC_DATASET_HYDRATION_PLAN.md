# Phase 5.3B — Validated Atomic Dataset Hydration Plan

## Status

**PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning base:

```text
develop  37eae3f97ae44bc439d90d215a199debcf933b4c
CI       35019405824 — SUCCESS
```

Predecessors:

```text
5.1A  Persisted Dataset Source Inventory & Contract Completeness   COMPLETE
5.1B  Workbook Schema / Sheet / Column Contracts                   COMPLETE
5.1C  Dataset Validation & Reference Integrity                     COMPLETE
5.2A  XLSX Library Evaluation & Codec Boundary                     COMPLETE
5.2B  Deterministic Dataset-to-XLSX Export                         COMPLETE
5.2C  Strict XLSX-to-Dataset Import & Diagnostics                  COMPLETE
5.3A  Complete Source Snapshot Service                             COMPLETE
```

This document plans Phase 5.3B only. It does not start hydration implementation.

---

## 1. Objective

Create the application-level write boundary that accepts one candidate complete `BusinessDataset`, validates it before any live mutation, and replaces all nine authoritative live source repositories as one logical hydration transaction.

Target flow:

```text
candidate BusinessDataset
          |
          v
validateBusinessDatasetIntegrity(...)
          |
          +---------------- invalid ----------------> deterministic validation issues
          |                                            live repositories unchanged
          |
        valid
          |
          v
clone candidate into hydration-owned state
          |
          v
snapshot current live BusinessDataset (5.3A)
          |
          v
replace all nine live source collections
          |
      +---+---+
      |       |
   success   failure
      |       |
      |       v
      |   restore pre-hydration snapshot
      |       |
      |   +---+---+
      |   |       |
      | restored rollback failure
      |   |       |
      |   v       v
      | controlled apply error / catastrophic rollback diagnostic
      v
hydration success
```

The live application must never accept a partial imported business database as a successful load.

5.3B is repository hydration infrastructure. It does not parse XLSX, choose files, save workbooks, create filesystem backups, migrate older schemas, or provide import/export UI.

---

## 2. Split assessment

Phase 5.3B **does require deeper formal sub-phases**.

The repository audit shows that 5.3B is not one isolated service addition like 5.3A. It has three materially different responsibilities with prerequisite ordering:

```text
5.3B1 — Hydration Replacement Port & Repository Bulk Replace
   |
   v
5.3B2 — Validated Atomic Hydration Service & Rollback
   |
   v
5.3B3 — Session Integration, Fault Injection & Completion Gate
```

### Why the split is required

The current CRUD repository contracts cannot represent complete dataset replacement safely:

```text
MaterialRepository
  list / findById / insert / replace
  -> no delete / no whole-collection replacement

CalibrationRepository
  list / findById / insert / delete
  -> no replace / no whole-collection replacement

MixPresetRepository
  list / findById / insert / replace
  -> no delete / no whole-collection replacement

ProductRepository
  list / findById / insert / replace
  -> no delete / no whole-collection replacement

YieldSampleRepository
  list / findById / insert / delete
  -> intentionally no record replacement in normal business workflow

FixedRecipeItemRepository
  list / findById / insert / replace / delete
  -> CRUD exists, but no atomic whole-collection replacement

ProductComponentRepository
  list / findById / insert / replace / delete
  -> CRUD exists, but no atomic whole-collection replacement

ProductStockRepository
  list / findByProductId / upsert
  -> no delete / no whole-collection replacement

ProductFinancialProfileRepository
  list / findByProductId / upsert
  -> no delete / no whole-collection replacement
```

Trying to hydrate through those ordinary CRUD methods would create correctness gaps:

- records removed from the workbook could remain stale in memory;
- missing ProductStock rows could incorrectly survive from the previous session;
- missing ProductFinancialProfile rows could incorrectly survive from the previous session;
- Material/Product/MixPreset records absent from the candidate cannot currently be deleted through their repository contracts;
- immutable YieldSample business semantics would be confused with persistence restore semantics;
- applying many individual writes would expose partial replacement when a later write fails;
- rollback would become an ad hoc inverse-CRUD problem instead of restoring one known previous dataset.

A dedicated whole-collection hydration capability is therefore a prerequisite before the hydration coordinator itself can be considered safe.

---

# 3. Formal 5.3B decomposition

## 5.3B1 — Hydration Replacement Port & Repository Bulk Replace

### Purpose

Give every live in-memory source repository a persistence-only whole-collection replacement capability without broadening normal application CRUD semantics unnecessarily.

### Primary deliverables

Recommended generic persistence-only port:

```ts
export interface CollectionReplacementPort<T> {
  replaceAll(records: readonly T[]): Promise<void>;
}
```

Recommended location:

```text
src/application/persistence/CollectionReplacementPort.ts
```

The existing normal repository interfaces should remain focused on business CRUD unless implementation discovery proves a compelling reason to change them.

Preferred hydration dependency shape uses structural intersections, for example:

```ts
type HydratableMaterialRepository =
  MaterialRepository & CollectionReplacementPort<Material>;
```

The nine current in-memory repository classes should implement a compatible `replaceAll(...)` operation in addition to their existing normal repository contract.

### Per-repository replacement semantics

Each `replaceAll(...)` implementation must:

1. treat the supplied records as a complete replacement collection, not a merge;
2. remove stale rows that are absent from the supplied collection;
3. defensively clone every incoming source record using the existing domain clone boundary for that record type;
4. prepare the complete next collection before exposing it as live state;
5. swap repository state only after next-state preparation succeeds;
6. leave that repository unchanged if preparation/cloning fails;
7. preserve source text, numeric precision, optional-field absence, explicit zero, explicit null, and explicit false values;
8. avoid invoking application business services, deriving defaults, or calculating derived outputs;
9. preserve the repository object's identity so all already-wired services continue observing the same repository instance after hydration.

### Recommended in-memory pattern

Current repositories are Map-backed. A safe pattern is conceptually:

```ts
async replaceAll(records: readonly T[]): Promise<void> {
  const next = new Map<string, T>();

  for (const record of records) {
    next.set(canonicalKey(record), cloneRecord(record));
  }

  this.records = next;
}
```

This is preferable to:

```text
clear current map
-> insert records one at a time
```

because clearing the active store before all next-state cloning succeeds creates an avoidable partial-state failure mode.

Repository backing-map fields may need to become reassignable rather than `readonly` references so a fully staged Map can be swapped in one operation.

### Normal CRUD semantics remain unchanged

`replaceAll(...)` is a persistence hydration capability, not a new business workflow.

In particular:

- YieldSample remains immutable through normal application services even though hydration may restore the complete persisted evidence collection;
- ProductStock normal workflows continue using upsert semantics;
- ProductFinancialProfile normal workflows continue using upsert semantics;
- normal domain validation/relationship enforcement remains owned by existing services and the 5.1C complete-dataset validator;
- React must not call `replaceAll(...)` directly.

### 5.3B1 tests

Focused tests must prove for all nine repository implementations that:

- replacement removes stale records;
- replacement installs the exact new source collection;
- an empty replacement clears the repository;
- replacement input is defensively cloned;
- nested source values do not alias caller-owned values;
- subsequent mutation of the caller's input does not mutate repository state;
- repository object identity is preserved;
- existing list/find semantics still work after replacement;
- existing ordinary CRUD tests remain green.

### 5.3B1 completion gate

5.3B1 is complete only when all nine authoritative current repositories support safe whole-collection replacement through the dedicated hydration capability and the full regression suite remains green.

5.3B2 must not begin before 5.3B1 is complete and merged.

---

## 5.3B2 — Validated Atomic Hydration Service & Rollback

### Purpose

Create the application service that validates a candidate complete dataset, captures current live state, replaces all nine collections, and restores the previous state if application fails.

Recommended implementation location:

```text
src/application/persistence/ValidatedAtomicDatasetHydrationService.ts
```

### Recommended dependency contract

Conceptually:

```ts
interface CompleteSourceHydrationRepositories {
  materials: MaterialRepository & CollectionReplacementPort<Material>;
  calibrations: CalibrationRepository & CollectionReplacementPort<MaterialCalibrationEvidence>;
  mixPresets: MixPresetRepository & CollectionReplacementPort<MixPreset>;
  products: ProductRepository & CollectionReplacementPort<Product>;
  yieldSamples: YieldSampleRepository & CollectionReplacementPort<YieldSample>;
  recipeItems: FixedRecipeItemRepository & CollectionReplacementPort<FixedRecipeItem>;
  productComponents: ProductComponentRepository & CollectionReplacementPort<ProductComponent>;
  productStocks: ProductStockRepository & CollectionReplacementPort<ProductStock>;
  productFinancialProfiles:
    ProductFinancialProfileRepository & CollectionReplacementPort<ProductFinancialProfile>;
}
```

The hydration service should also reuse the completed 5.3A snapshot boundary for pre-hydration rollback state rather than manually creating a second nine-repository read implementation.

### Recommended service shape

Conceptually:

```ts
class ValidatedAtomicDatasetHydrationService {
  constructor(
    repositories: CompleteSourceHydrationRepositories,
    snapshotService: CompleteSourceSnapshotService,
  ) {}

  hydrate(candidate: unknown): Promise<DatasetHydrationResult>;
}
```

Exact type names may be refined during implementation, but the architecture below is locked.

---

## 4. Validation must precede every write

5.3B must reuse the authoritative 5.1C validator:

```ts
validateBusinessDatasetIntegrity(candidate)
```

The hydration service must not duplicate domain/reference/graph rules.

Required sequence:

```text
candidate
   |
   v
validateBusinessDatasetIntegrity
   |
   +-- invalid --> return/reject with validation issues
   |              ZERO replaceAll calls
   |              ZERO live mutation
   |
   v
valid candidate
```

Validation covers the current complete dataset contract, record contracts, duplicate identities, references, and Product composition graph rules.

An invalid candidate must never be partially repaired, normalized into a different business meaning, or hydrated on a best-effort basis.

---

## 5. Candidate ownership and source fidelity

After validation and before repository mutation, the service should obtain hydration-owned source data through the existing dataset clone boundary:

```ts
cloneBusinessDataset(candidate)
```

This ensures caller-owned arrays/objects cannot become live repository aliases.

Hydration must preserve:

- original source IDs/text values accepted by the domain contract;
- optional-field absence;
- explicit numeric zero;
- explicit boolean false;
- `pricingPolicy = null`;
- absence of ProductStock rows;
- absence of ProductFinancialProfile rows;
- Material source metadata;
- MixPreset nested category/line order;
- YieldSample material input order;
- timestamp strings and source numeric precision.

Hydration must not normalize the candidate merely to make repository keys prettier.

Repository key canonicalization may remain trim-aware/case-insensitive internally while the stored source record retains its authoritative text.

---

## 6. Pre-hydration rollback snapshot

Only after the candidate has passed validation should the service capture the current live source state:

```ts
const previous = await completeSourceSnapshotService.snapshot();
```

Reasons:

- invalid candidates do not require unnecessary repository reads;
- the rollback source is one complete known-good `BusinessDataset`;
- rollback uses the same authoritative source inventory as normal persistence snapshotting;
- 5.3B does not invent a second private backup shape.

The previous snapshot must be treated as immutable rollback evidence for that hydration attempt.

---

## 7. Complete replacement order

Use one deterministic dependency-aware collection order for forward apply and rollback.

Recommended order:

```text
1. materials
2. materialCalibrations
3. mixPresets
4. products
5. yieldSamples
6. recipeItems
7. productComponents
8. productStocks
9. productFinancialProfiles
```

Rationale:

- foundational Material rows exist before Material-linked evidence;
- MixPreset source exists before Product references to presets;
- Product rows exist before Product-linked evidence, recipe, components, stock, and financial profiles;
- Product-backed ProductComponent relationships can resolve against an already replaced complete Product collection.

The current in-memory repositories do not perform cross-repository reference validation during raw storage writes, because that validation has already happened globally. The order nevertheless documents dependency intent and makes future repository implementations safer.

Do not use React ordering or workbook sheet order as an accidental transaction contract.

---

## 8. Atomicity definition for Phase 5.3B

Phase 5.3B requires **logical application-level atomicity from the user's perspective**.

Success means:

```text
all nine live authoritative collections represent the candidate dataset
```

Failure means:

```text
all nine live authoritative collections are restored to the exact pre-hydration dataset
```

The service must never report a successful hydration after only some collections were replaced.

This is not a claim that nine independent JavaScript repository objects provide database-engine isolation against arbitrary concurrent readers. Phase 5.3C will own persistence workflow serialization so user-facing load operations do not intentionally race other persistence operations.

The guarantee required here is:

- invalid candidate -> no write begins;
- write failure -> rollback attempted automatically;
- successful rollback -> pre-hydration source state restored;
- rollback failure -> never misreported as success; escalate a distinct severe diagnostic because live-state certainty is lost.

---

## 9. Replacement failure and rollback behavior

Recommended private apply operation:

```ts
private async replaceDataset(dataset: BusinessDataset): Promise<void> {
  await repositories.materials.replaceAll(dataset.materials);
  await repositories.calibrations.replaceAll(dataset.materialCalibrations);
  await repositories.mixPresets.replaceAll(dataset.mixPresets);
  await repositories.products.replaceAll(dataset.products);
  await repositories.yieldSamples.replaceAll(dataset.yieldSamples);
  await repositories.recipeItems.replaceAll(dataset.recipeItems);
  await repositories.productComponents.replaceAll(dataset.productComponents);
  await repositories.productStocks.replaceAll(dataset.productStocks);
  await repositories.productFinancialProfiles.replaceAll(dataset.productFinancialProfiles);
}
```

Hydration operation conceptually:

```ts
const validation = validateBusinessDatasetIntegrity(candidate);
if (!validation.valid) {
  return { status: 'rejected', issues: validation.issues };
}

const next = cloneBusinessDataset(candidate as BusinessDataset);
const previous = await snapshotService.snapshot();

try {
  await replaceDataset(next);
  return { status: 'hydrated' };
} catch (applyError) {
  try {
    await replaceDataset(previous);
  } catch (rollbackError) {
    throw new DatasetHydrationError('ROLLBACK_FAILED', ...);
  }

  throw new DatasetHydrationError('APPLY_FAILED_RESTORED', ...);
}
```

Exact result/error naming may be refined, but the behavioral distinction is mandatory.

---

## 10. Hydration result and diagnostic model

Expected invalid business data is different from infrastructure failure.

Recommended result shape:

```ts
type DatasetHydrationResult =
  | {
      status: 'hydrated';
    }
  | {
      status: 'rejected';
      issues: readonly BusinessDatasetValidationIssue[];
    };
```

Recommended controlled operational error codes:

```text
SNAPSHOT_FAILED
APPLY_FAILED_RESTORED
ROLLBACK_FAILED
```

Meaning:

### `SNAPSHOT_FAILED`

The candidate was valid, but the current live state could not be snapshotted before writes. No write may begin.

### `APPLY_FAILED_RESTORED`

A repository replacement failed after mutation began, but the pre-hydration snapshot was successfully restored.

The load did not succeed, but live source state is known to be safe.

### `ROLLBACK_FAILED`

Replacement failed and restoring the previous complete dataset also failed.

This is a high-severity invariant failure. The service must not pretend that live state is known-good. 5.3C/5.5C will later decide the user-facing recovery UX.

Raw storage/repository exceptions may be retained as `cause` for diagnostics, but callers should not need to parse arbitrary exception messages to identify the failure class.

---

## 11. No business-service replay during hydration

Hydration must not recreate a workbook by calling normal create/update services row by row.

Do not hydrate through:

```text
MaterialService.create/update
CalibrationService.create/delete
MixPresetService.create/update
ProductService.create/update
YieldSampleEvidenceService.record/delete
FixedRecipeItemService.create/update/delete
ProductComponentService.create/update/delete
ProductStockService upserts
ProductFinancialProfileService upserts
```

Reasons:

- complete-dataset validation has already checked the source graph as a whole;
- row-by-row service calls introduce ordering-sensitive transient invalidity;
- application services can synthesize defaults or apply workflow-specific restrictions that are correct for interactive editing but wrong for source restoration;
- immutable evidence restoration is different from recording a new business event;
- rollback becomes much more complex if business service side effects are replayed.

5.3B writes authoritative source collections through the dedicated hydration capability only.

---

## 12. Missing evidence must delete stale live evidence

Whole-dataset hydration means the candidate is authoritative.

Examples:

### ProductStock

Current live state:

```text
product-a -> 12 pc
```

Candidate dataset:

```text
no ProductStock row for product-a
```

After hydration:

```text
no ProductStock row for product-a
```

It must not remain `12`, and it must not become an invented `0` row.

### ProductFinancialProfile

Current live state contains a pricing profile, but the candidate has no profile row.

After hydration the profile must be absent.

### Material / Product / MixPreset

A source record absent from the candidate must not survive merely because the ordinary repository interface has no delete operation.

This requirement is one of the main reasons 5.3B1 needs whole-collection replacement rather than merge semantics.

---

## 13. Empty dataset hydration

A valid current-schema dataset with all nine source collections empty is a legitimate source state.

Hydrating it must clear all nine repositories.

Do not interpret an empty collection as:

```text
leave current data unchanged
```

The candidate is complete replacement state, not a patch.

---

## 14. Preserve repository object identity

The application session already wires many Phase 1–4 services to the current repository objects.

5.3B must not replace repository object instances in `session.ts` after hydration.

Bad pattern:

```ts
materialRepository = new InMemoryMaterialRepository(dataset.materials);
```

Existing services would still hold references to the old repository object.

Correct model:

```text
same repository object
        |
        v
replace internal complete collection
        |
        v
all previously wired services observe new source state
```

5.3B3 must include a regression test proving that an already-wired service sees hydrated data after replacement.

---

# 15. Phase 5.3B3 — Session Integration, Fault Injection & Completion Gate

## Purpose

Wire the completed hydration boundary into the shared application session and prove the full atomicity contract with controlled failure injection before 5.3B is closed.

### Session composition

Recommended shared instance in `src/application/session.ts`:

```ts
export const validatedAtomicDatasetHydrationService =
  new ValidatedAtomicDatasetHydrationService(
    {
      materials: materialRepository,
      calibrations: calibrationRepository,
      mixPresets: mixPresetRepository,
      products: productRepository,
      yieldSamples: yieldSampleRepository,
      recipeItems: fixedRecipeItemRepository,
      productComponents: productComponentRepository,
      productStocks: productStockRepository,
      productFinancialProfiles: productFinancialProfileRepository,
    },
    completeSourceSnapshotService,
  );
```

No React UI needs to invoke it directly during 5.3B. 5.3C will become the load/save lifecycle coordinator.

---

## 16. Fault-injection test strategy

Normal green-path tests are not enough for an atomicity phase.

5.3B3 must use fake/wrapped replacement repositories capable of intentionally failing at controlled collection boundaries.

Required scenarios:

### 16.1 Invalid candidate

- current live state is populated;
- candidate fails 5.1C validation;
- hydration returns validation rejection;
- zero `replaceAll(...)` calls occur;
- current snapshot remains exactly unchanged.

### 16.2 Snapshot failure before mutation

- candidate is valid;
- snapshot service fails before apply;
- zero `replaceAll(...)` calls occur;
- hydration surfaces controlled snapshot failure.

### 16.3 Mid-apply failure

Example:

```text
materials replace succeeds
calibrations replace succeeds
mixPresets replace succeeds
products replacement throws
```

Required result:

- rollback runs automatically;
- every repository matches the exact pre-hydration snapshot after rollback;
- hydration does not report success;
- controlled `APPLY_FAILED_RESTORED` diagnostic is surfaced.

### 16.4 Rollback failure

Inject:

```text
forward replacement failure
+
rollback replacement failure
```

Required result:

- distinct `ROLLBACK_FAILED` diagnostic;
- never report live state as safely restored;
- retain original apply failure plus rollback failure as diagnostic context where practical.

### 16.5 Successful complete replacement

- live repositories contain records not present in candidate;
- candidate contains different records;
- hydrate succeeds;
- stale rows are gone;
- all nine repository snapshots equal candidate source semantics.

### 16.6 Empty replacement

- live state is populated;
- hydrate a valid empty current-schema dataset;
- all nine repositories become empty.

### 16.7 Missing-vs-zero/null semantics

Prove at minimum:

- missing ProductStock row remains missing;
- explicit ProductStock `0` remains a row with zero;
- missing ProductFinancialProfile remains missing;
- explicit zero labor/overhead remains present;
- `pricingPolicy = null` remains explicit null;
- optional Material source fields remain absent when absent.

### 16.8 Defensive ownership

- mutate candidate after successful hydrate;
- live repositories remain unchanged;
- mutate repository list result;
- repository state remains unchanged.

### 16.9 Existing service reference continuity

- construct an application service before hydration using a repository instance;
- hydrate new source state into that same repository object;
- the pre-existing service observes the new hydrated state;
- no service graph rebuild is required.

---

## 17. Validation responsibilities remain separated

### 5.1C owns

- BusinessDataset completeness/current schema;
- record contract validity;
- duplicate identity detection;
- cross-reference integrity;
- component graph validation.

### 5.2C owns

- XLSX decode;
- workbook schema/metadata validation;
- row/cell parsing;
- parent/child reconstruction;
- workbook diagnostics;
- final candidate integrity validation before returning imported source data.

### 5.3A owns

- complete read-only repository snapshot.

### 5.3B owns

- revalidation at the live write boundary;
- complete source collection replacement;
- previous-state capture;
- apply/rollback atomicity semantics;
- hydration operational diagnostics;
- session hydration composition.

### 5.3C will own

- user/application load-save lifecycle orchestration;
- calling import decode + hydration as one workflow;
- calling snapshot + export as one workflow;
- persistence-operation concurrency/serialization;
- higher-level load/save status and diagnostics.

No phase should duplicate another phase's schema or business validation rules.

---

## 18. Explicit out of scope for 5.3B

Do not include:

- XLSX parsing or workbook row reconstruction;
- workbook export mapping;
- browser file picker APIs;
- browser download APIs;
- Tauri dialog/filesystem APIs;
- native atomic file replacement;
- backup file naming or backup transport;
- older dataset/workbook migration;
- corruption/resource-limit UX;
- persistence status UI;
- Google Sheets API integration;
- auto-save;
- background sync;
- multi-user/database transactions;
- Phase 1–4 formula changes;
- new business validation rules unrelated to hydration safety.

Ownership remains:

```text
5.3C  load/save lifecycle coordination
5.4A  schema migration/compatibility
5.4B  backup + atomic-write transport contract
5.4C  corruption/limits/recovery diagnostics
5.5   persistence UI
5.6   integrated round-trip completion
6     native Tauri filesystem/dialog implementation
```

---

## 19. Expected implementation surface

### 5.3B1 likely files

```text
src/application/persistence/CollectionReplacementPort.ts

src/application/materials/InMemoryMaterialRepository.ts
src/application/calibrations/InMemoryCalibrationRepository.ts
src/application/mixPresets/InMemoryMixPresetRepository.ts
src/application/products/InMemoryProductRepository.ts
src/application/yieldSamples/InMemoryYieldSampleRepository.ts
src/application/recipeItems/InMemoryFixedRecipeItemRepository.ts
src/application/productComponents/InMemoryProductComponentRepository.ts
src/application/productStocks/InMemoryProductStockRepository.ts
src/application/productFinancialProfiles/InMemoryProductFinancialProfileRepository.ts

focused replacement tests in existing repository test files
or one clearly scoped persistence replacement test suite
```

### 5.3B2 likely files

```text
src/application/persistence/ValidatedAtomicDatasetHydrationService.ts
src/application/persistence/ValidatedAtomicDatasetHydrationService.test.ts
```

A separate `DatasetHydrationError.ts` / diagnostic file is acceptable if it improves clarity.

### 5.3B3 likely files

```text
src/application/session.ts
additional hydration fault-injection/session integration tests
```

### Completion documentation

After successful implementation and post-merge validation:

```text
docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION.md
docs/PHASE_5_PROGRESS.md
```

---

## 20. Regression gates

Every implementation PR must pass:

```bash
npm test
npx tsc --noEmit
npm run build
```

GitHub Actions must be green on the exact feature head before merge.

After each implementation merge, the exact resulting `develop` commit must also pass CI before the next 5.3B sub-phase proceeds.

Because 5.3B is formally split, recommended merge progression is:

```text
5.3B1 implementation + CI + merge + post-merge CI
        |
        v
5.3B2 implementation + CI + merge + post-merge CI
        |
        v
5.3B3 implementation + CI + merge + post-merge CI
        |
        v
5.3B completion closeout docs + CI + merge + final post-merge CI
```

Do not develop B2 on an unmerged/unverified B1 feature head. Do not develop B3 on an unmerged/unverified B2 feature head.

---

## 21. Phase 5.3B completion gate

Phase 5.3B is complete only when all of the following are true:

- all nine authoritative live repositories support persistence-only complete collection replacement;
- replacement removes stale rows rather than merging candidate rows into existing state;
- repository replacement defensively clones source data;
- repository object identity remains stable;
- candidate dataset integrity is validated before any write begins;
- invalid candidates cause zero live writes;
- valid candidates can fully replace populated live state;
- a valid empty candidate clears all nine repositories;
- missing source evidence remains missing rather than becoming defaults;
- explicit zero/null/false source values remain explicit;
- the previous complete dataset is captured before mutation;
- mid-apply failure triggers automatic rollback;
- successful rollback restores the exact pre-hydration source snapshot;
- rollback failure has a distinct severe diagnostic and is never reported as hydration success;
- shared application session exposes one hydration service boundary;
- already-wired services observe hydrated state without repository-object replacement;
- React does not enumerate or mutate repositories directly;
- no derived business outputs are persisted or hydrated;
- full regression tests pass;
- TypeScript typecheck passes;
- production build passes;
- feature and exact post-merge `develop` CI are green;
- completion documentation records the exact PR/SHA/CI evidence.

---

## 22. Stop point after planning

This planning phase performs **no runtime hydration implementation**.

After this plan is merged and the exact post-merge `develop` CI is green, the next active implementation task becomes:

```text
5.3B1 — Hydration Replacement Port & Repository Bulk Replace
Status: NEXT / NOT STARTED
```

Do not automatically begin 5.3B1 as part of the planning merge. A separate user instruction to proceed starts implementation.

---

## 23. Resulting Phase 5 position

After this planning gate:

```text
5.1 — Persisted Dataset & Workbook Contract Foundation   COMPLETE
5.2 — XLSX Workbook Codec                                 COMPLETE
5.3 — Snapshot, Hydration & Persistence Coordination      IN PROGRESS
    5.3A — Complete Source Snapshot Service               COMPLETE
    5.3B — Validated Atomic Dataset Hydration             PLAN ESTABLISHED
        5.3B1 — Hydration Replacement Port & Bulk Replace NEXT / NOT STARTED
        5.3B2 — Validated Atomic Hydration + Rollback     NOT STARTED
        5.3B3 — Session/Fault Injection/Completion Gate   NOT STARTED
    5.3C — Persistence Coordinator / Load-Save Lifecycle  NOT STARTED
```

The key 5.3B architectural principle is:

> **A candidate business dataset is either fully accepted as the new live authoritative source state, or the previous live source state remains/restores as the authoritative state. Partial successful hydration is not an allowed outcome.**
