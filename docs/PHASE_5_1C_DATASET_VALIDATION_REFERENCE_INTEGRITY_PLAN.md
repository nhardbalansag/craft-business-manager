# Phase 5.1C — Dataset Validation & Reference Integrity Plan

## Status

**PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning base:

```text
develop  656add851d6eeb6841f2f6e11816bbd52f5028c1
CI       34994087842 — SUCCESS
```

Parent plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Progress tracker:

`docs/PHASE_5_PROGRESS.md`

Previous completed task:

`5.1B — Workbook Schema / Sheet / Column Contracts — COMPLETE`

---

## 1. Purpose

Phase 5.1C establishes one complete, side-effect-free validation boundary for a reconstructed `BusinessDataset` **before** any live repository hydration or mutation.

The boundary must determine whether a candidate persisted dataset is structurally and semantically safe enough to become application source state. It must convert validation failures into controlled, deterministic diagnostics rather than leaking arbitrary parser/domain/application exceptions.

5.1C is intentionally independent from any XLSX library. It validates `BusinessDataset` source semantics, not workbook bytes or cells.

---

## 2. Split assessment

**No deeper formal numbered split is required.**

5.1C remains one numbered task because all required checks belong to one atomic acceptance gate: either the whole candidate dataset is valid for later hydration or it is not.

Creating partial sub-phases such as separate identity/reference/graph validators would add integration overhead while still requiring one final complete-dataset decision before hydration.

Implementation should instead use these internal checkpoints:

1. dataset envelope and per-record source-contract validation;
2. collection-level duplicate identity validation;
3. durable cross-reference validation;
4. Product composition source-uniqueness and graph/cycle validation;
5. deterministic diagnostic ordering and full regression validation.

Do not treat these checkpoints as separately shippable persistence states.

---

## 3. Repository audit findings

### 3.1 Existing dataset boundary

Phase 5.1A already provides:

- `BusinessDataset` with all nine authoritative source collections;
- `CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1`;
- `assertBusinessDatasetCompleteness(...)`;
- defensive cloning/normalization helpers.

5.1C must build on that boundary rather than create a competing dataset envelope.

### 3.2 Existing workbook boundary

Phase 5.1B already validates workbook-neutral schema structure under `src/storage/workbookSchema.ts`.

5.1C must **not** duplicate:

- required sheet/column validation;
- workbook format version validation;
- cell primitive/formula rules;
- normalized child-sheet reconstruction rules.

The future 5.2C importer will reconstruct a candidate dataset, then pass it to the 5.1C validator.

### 3.3 Existing source/domain validators must be reused

Authoritative row/source rules already live in Phase 1–4 domain modules, including:

- `validateMaterialContract(...)`;
- calibration evidence/domain rules from `materialCalibration.ts`;
- `validateMixPresetContract(...)`;
- `validateProductContract(...)`;
- `validateYieldSampleContract(...)`;
- `validateFixedRecipeItemContract(...)`;
- `validateProductComponentContract(...)`;
- `validateProductStockContract(...)`;
- `validateProductFinancialProfileContract(...)`;
- `validatePricingPolicy(...)` when a financial profile has a non-null policy.

5.1C must call/reuse these rules wherever possible instead of reproducing their validation formulas or enum/unit rules.

If a current domain rule is embedded only inside a derivation function and cannot be safely reused as an intrinsic row validator, implementation may extract a pure validator **without changing existing behavior**. Such extraction must be covered by the existing domain tests plus new 5.1C tests.

### 3.4 Existing Product composition graph validator must be reused

`src/domain/productCompositionGraph.ts` already provides:

- `validateProductComponentSourceUniqueness(...)`;
- direct self-reference detection;
- deterministic cycle detection;
- `validateProductCompositionGraph(...)`.

5.1C must reuse this graph gate. It must not create another Product cycle algorithm.

### 3.5 Repository seed behavior makes pre-hydration duplicate validation mandatory

Current in-memory repositories normalize identity keys and store records in `Map` instances. Seed/insert operations can overwrite an earlier case-insensitive duplicate key.

Therefore 5.1C must validate duplicate identities on the raw candidate arrays **before** any repository construction/hydration. Hydrating first and validating afterward is forbidden because malformed rows could disappear silently.

### 3.6 Live mutation services are not the dataset validator

Application CRUD services contain both:

- durable source-integrity rules; and
- workflow-time eligibility rules such as requiring active Products/Materials/MixPresets for a new edit.

5.1C must not replay the candidate through create/update services sequentially. Doing so would:

- make validity depend on insertion order;
- reject legitimate historical/archived source state merely because it could not be newly created today;
- risk mutating repositories before the entire candidate is known valid;
- conflate persistence integrity with UI/live-write eligibility.

The complete-dataset validator must instead evaluate the candidate as one immutable snapshot.

---

## 4. Planned implementation boundary

Preferred implementation surface:

```text
src/domain/businessDatasetValidation.ts
src/domain/businessDatasetValidation.test.ts
```

`businessDatasetValidation.ts` should remain:

- pure;
- synchronous unless a compelling existing contract forces otherwise;
- independent from repositories;
- independent from React;
- independent from `ExcelStorage`;
- independent from XLSX libraries;
- independent from Tauri/native filesystem APIs.

`src/domain/businessDataset.ts` may receive only small shared exports/refactors if needed; avoid turning the existing completeness module into an oversized validation implementation.

---

## 5. Proposed public validation contract

Implementation should expose a controlled result rather than require callers to catch unrelated domain/application exceptions.

Recommended conceptual shape:

```ts
interface BusinessDatasetValidationIssue {
  code: BusinessDatasetValidationIssueCode;
  collection?: BusinessDatasetSourceCollectionKey;
  index?: number;
  entityId?: string;
  field?: string;
  path: string;
  message: string;
}

interface BusinessDatasetValidationResult {
  valid: boolean;
  issues: readonly BusinessDatasetValidationIssue[];
}

validateBusinessDatasetIntegrity(input: unknown): BusinessDatasetValidationResult
```

An assertion/throwing convenience wrapper may also be added only if useful to later hydration code, but the canonical validation result should remain structured and deterministic.

The exact exported names may be refined during implementation, but the semantic contract above is locked.

---

## 6. Diagnostic policy

### 6.1 Controlled issues

No expected bad candidate row should escape as an arbitrary raw domain/service error.

5.1C should catch known validation failures and convert them to dataset issues while retaining useful source context.

Unexpected programmer/system errors must not be silently reclassified as user-data problems.

### 6.2 Deterministic paths

At dataset level, diagnostics should identify the most specific available source location, for example:

```text
materials[2].id
products[1].mixPresetId
yieldSamples[4].materialInputs[0].materialId
productComponents[3].sourceId
productFinancialProfiles[0].pricingPolicy.value
```

Where meaningful also expose:

- collection;
- zero-based dataset array index;
- entity/source ID;
- field/path;
- stable issue code.

Workbook sheet/row coordinates are **not** owned by 5.1C. Future 5.2C may augment or map dataset diagnostics back to workbook sheet/row locations.

### 6.3 Deterministic ordering

Issue ordering must not depend on `Map` iteration accidents, repository insertion order, or exception timing.

Use a documented stable order, preferably:

1. canonical `BUSINESS_DATASET_SOURCE_COLLECTION_KEYS` order;
2. source array index/path;
3. stable issue code as final tie-breaker.

Graph diagnostics must use the deterministic graph behavior already established by Phase 3.

### 6.4 Whole-candidate failure

Do not drop invalid rows and continue with a partial dataset.

If one or more blocking issues exist:

```text
valid = false
```

The future hydration layer must receive no permission to mutate live state.

---

## 7. Validation matrix

### 7.1 Dataset envelope/version

Reuse `assertBusinessDatasetCompleteness(...)` semantics to require:

- object dataset envelope;
- supported dataset schema version;
- all nine source collections;
- collection array shape.

Unsupported/future dataset versions fail closed.

### 7.2 Materials

For every Material:

- apply authoritative Material source contract validation;
- preserve explicit zero source values where allowed;
- detect case-insensitive duplicate Material IDs;
- detect case-insensitive duplicate Material names.

Do not silently normalize two duplicate rows into one.

### 7.3 Material calibrations

For every calibration record:

- validate its intrinsic evidence fields using authoritative calibration rules or a behavior-preserving extracted pure evidence validator;
- detect case-insensitive duplicate calibration IDs;
- require referenced `materialId` to exist.

Do not make current Material active state a persistence requirement.

Do not require calibration evidence to be the currently selected/effective calibration; historical calibration evidence remains source data.

If current calibration validation is coupled to Material compatibility in a way that would reject historical but still persisted evidence after later Material edits, implementation must separate intrinsic evidence validation from current-use derivation instead of inventing a stricter import rule.

### 7.4 Mix presets

For every MixPreset:

- apply `validateMixPresetContract(...)`;
- detect case-insensitive duplicate preset IDs;
- detect case-insensitive duplicate preset names;
- require every `lines[].materialId` to reference an existing Material.

`validateMixPresetContract(...)` already owns line-level rules such as duplicate material lines, valid ratio parts, primary count, category tokens, and basis.

Do not reject a persisted snapshot merely because a referenced Material is currently archived. Active-state edit eligibility belongs to application workflows unless a later explicit invariant proves otherwise.

### 7.5 Products

For every Product:

- apply `validateProductContract(...)`;
- detect case-insensitive duplicate Product IDs;
- detect case-insensitive duplicate Product names;
- when `mixPresetId` is present, require that MixPreset to exist.

Active-state and current editability are not sufficient reasons by themselves to reject an otherwise referentially intact persisted snapshot.

Compatibility rules that are guaranteed as durable snapshot invariants may be enforced only if implementation proves they are preserved from **both sides** of every existing mutation path. Otherwise they remain workflow/readiness concerns, not 5.1C load blockers.

### 7.6 Yield samples

For every YieldSample:

- apply `validateYieldSampleContract(...)`;
- detect case-insensitive duplicate sample IDs;
- require `productId` to exist;
- require optional `mixPresetId` to exist when present;
- require every `materialInputs[].materialId` to exist.

Historical samples are immutable evidence. Do not reject them merely because referenced records are now archived.

Do not blindly replay `recordSample(...)`, which intentionally requires active sources for **new** evidence and therefore is stricter than persistence round-trip semantics.

### 7.7 Fixed recipe items

For every FixedRecipeItem:

- apply `validateFixedRecipeItemContract(...)`;
- detect case-insensitive duplicate item IDs;
- require `productId` to exist;
- require `materialId` to exist;
- detect duplicate `(productId, materialId)` recipe-line identity using case-insensitive canonical keys.

Do not replay `createItem(...)` as the import validator because it requires active Product/Material state and current derivability.

The existing Phase 2/3 rule that containers/vessels belong in Product components must not be reimplemented ad hoc. If 5.1C needs to classify that as a durable persistence invariant, reuse/extract the authoritative domain rule and prove round-trip compatibility in tests.

### 7.8 Product components

For every ProductComponent:

- apply `validateProductComponentContract(...)`;
- detect case-insensitive duplicate component IDs;
- require `parentProductId` to reference an existing Product;
- require `sourceId` to reference an existing Material when `sourceType = material`;
- require `sourceId` to reference an existing Product when `sourceType = product`.

After row/reference checks, run the authoritative Phase 3 composition-graph validation across the complete component collection to enforce:

- duplicate parent/source identity rules;
- direct self-reference rejection;
- transitive cycle rejection.

Do not duplicate the graph algorithm.

Active-source requirements used while editing an active parent are workflow eligibility rules and must not automatically be applied to historical/archived snapshot state.

### 7.9 Product stock

For every ProductStock:

- apply `validateProductStockContract(...)`;
- require `productId` to reference an existing Product;
- detect duplicate case-insensitive `productId` rows because ProductStock is one-record-per-Product.

Archived Products may retain stock records and remain valid persisted source state.

Missing ProductStock evidence remains distinct from explicit `0` stock.

### 7.10 Product financial profiles

For every ProductFinancialProfile:

- apply `validateProductFinancialProfileContract(...)`;
- when `pricingPolicy !== null`, also apply `validatePricingPolicy(...)`;
- require `productId` to reference an existing Product;
- detect duplicate case-insensitive `productId` rows because profiles are one-record-per-Product.

Archived Products may retain financial profiles.

Preserve:

- missing profile versus explicit zero labor/overhead;
- `pricingPolicy: null` versus configured zero-valued policies where valid.

---

## 8. Duplicate identity matrix

The implementation test matrix must explicitly cover at least:

| Collection | Duplicate rule |
| --- | --- |
| Materials | ID; name |
| MaterialCalibrations | ID |
| MixPresets | ID; name |
| Products | ID; name |
| YieldSamples | ID |
| RecipeItems | ID; `(productId, materialId)` |
| ProductComponents | ID; parent/source identity through graph validator |
| ProductStocks | `productId` |
| ProductFinancialProfiles | `productId` |

All identities above use the application’s case-insensitive, trim-aware semantics.

A duplicate must be reported before any repository could overwrite it.

---

## 9. Cross-reference matrix

The implementation must validate at least these durable references:

```text
MaterialCalibration.materialId                  -> Material.id
MixPreset.lines[].materialId                    -> Material.id
Product.mixPresetId?                            -> MixPreset.id
YieldSample.productId                           -> Product.id
YieldSample.mixPresetId?                        -> MixPreset.id
YieldSample.materialInputs[].materialId         -> Material.id
FixedRecipeItem.productId                       -> Product.id
FixedRecipeItem.materialId                      -> Material.id
ProductComponent.parentProductId                -> Product.id
ProductComponent(sourceType=material).sourceId  -> Material.id
ProductComponent(sourceType=product).sourceId   -> Product.id
ProductStock.productId                          -> Product.id
ProductFinancialProfile.productId               -> Product.id
```

Reference comparison is case-insensitive and trim-aware, matching established repository/service identity semantics.

Missing references are blocking validation issues.

---

## 10. Missing-vs-zero / no-repair policy

5.1C validates; it does not repair.

It must not:

- create missing ProductStock rows;
- create missing financial profiles;
- change null pricing policy to a default;
- replace missing values with numeric zero;
- coerce invalid enum/unit tokens;
- rename duplicate IDs;
- drop duplicate/orphan rows;
- break composition cycles automatically;
- activate/archive source records to make references pass.

Candidate values remain authoritative source evidence or the whole candidate fails validation.

---

## 11. Persistence integrity vs workflow eligibility

This distinction is a locked 5.1C design rule.

### Persistence integrity blockers

Examples:

- malformed source record;
- unsupported dataset schema version;
- duplicate canonical identity;
- missing referenced entity;
- duplicate Product component source identity;
- Product self-reference/cycle;
- invalid configured pricing policy.

### Workflow-time eligibility rules

Examples include rules specifically phrased as:

- “new sample requires active Product/Material/MixPreset”;
- “components cannot be added to archived parent”;
- “active Product cannot use archived source”;
- archive/update guards protecting currently active dependents.

These edit-time rules must not be mechanically replayed as dataset import blockers because persisted source state can contain legitimate historical/archived relationships.

If implementation discovers a rule whose classification is ambiguous, stop and document the invariant before tightening the persistence gate.

---

## 12. Test plan

Create focused tests for a complete, non-empty fixture covering all nine collections.

### 12.1 Happy paths

- complete valid dataset passes with zero issues;
- canonical empty dataset passes;
- case-insensitive references resolve correctly;
- archived referenced entities remain round-trippable where activity is only a workflow-time concern;
- explicit zero ProductStock/profile cost values remain valid;
- missing optional ProductStock/profile evidence remains valid;
- null pricing policy remains distinct from configured zero-valued policy.

### 12.2 Envelope/source-contract failures

- unsupported schema version;
- malformed required collection;
- invalid record contract in every authoritative collection;
- invalid configured pricing policy.

### 12.3 Duplicate identity failures

Cover every row in the duplicate identity matrix, including case/whitespace variants.

### 12.4 Missing-reference failures

Cover every relationship in the cross-reference matrix.

### 12.5 Product graph failures

- duplicate component source identity;
- direct Product self-reference;
- multi-node composition cycle;
- valid nested acyclic composition.

### 12.6 Diagnostic behavior

- stable issue code;
- stable collection/index/entity/field/path context;
- deterministic issue ordering when multiple independent errors exist;
- no invalid-row dropping;
- no mutation of the input dataset;
- no repository required to validate.

### 12.7 Regression

Full repository suite must remain green:

- TypeScript typecheck;
- all Phase 1–4 tests;
- Phase 5.1A dataset-completeness tests;
- Phase 5.1B workbook-schema tests;
- React smoke tests;
- production build.

---

## 13. Implementation sequence

When the user later says **proceed** after this plan is merged and green:

1. reverify exact `develop` SHA and exact successful CI from this planning closeout;
2. create a new feature branch from that exact commit;
3. add the pure dataset validation result/issue contract;
4. implement envelope and per-record validation adapters;
5. implement deterministic duplicate identity checks;
6. implement durable cross-reference checks;
7. reuse `validateProductCompositionGraph(...)` for component source uniqueness/self/cycles;
8. add the focused complete-dataset test matrix;
9. run exact feature CI;
10. add a 5.1C implementation/completion record only after behavior is green;
11. rerun exact documented-head CI;
12. open an implementation PR to `develop`;
13. guarded-merge only the exact green head;
14. require exact merged `develop` CI success;
15. use a docs-only closeout PR to mark 5.1C COMPLETE and advance to 5.2A;
16. require exact final closeout `develop` CI;
17. stop before 5.2A implementation unless separately requested.

---

## 14. Out of scope

5.1C must not implement:

- XLSX dependency selection;
- XLSX encode/decode;
- workbook row reconstruction from real files;
- repository snapshot service;
- repository hydration;
- transaction/rollback orchestration;
- `ExcelStorage.load/save` runtime behavior;
- backups or atomic replacement;
- browser file picker/download UI;
- Tauri filesystem/dialogs;
- automatic data repair/migration;
- Phase 1–4 business formula changes.

Those remain later Phase 5/6 tasks.

---

## 15. Completion gate

5.1C implementation may be marked COMPLETE only when:

- one complete candidate `BusinessDataset` can be validated without constructing live repositories;
- every current source collection receives its authoritative row/source validation;
- all locked duplicate identity rules are enforced before hydration;
- all locked durable cross-references are enforced;
- Product component source uniqueness and graph/cycle integrity reuse the authoritative Phase 3 validator;
- missing-vs-zero/null semantics are preserved without repair/defaulting;
- unsupported dataset versions fail closed;
- invalid candidates produce controlled deterministic structured diagnostics;
- multiple bad rows are not silently dropped;
- validation does not mutate the candidate or live application state;
- full typecheck/tests/build are green;
- implementation PR and exact merged `develop` CI are green;
- docs-only closeout and exact final `develop` CI are green.

---

## 16. Current stop point

This document establishes the 5.1C development plan only.

**No 5.1C implementation is started by this planning task.**

After this plan is merged and exact post-merge `develop` CI is green, the next user-approved action is to create a fresh 5.1C implementation branch from that exact baseline.
