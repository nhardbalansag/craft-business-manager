# Phase 5.1C — Dataset Validation & Reference Integrity

## Status

**IMPLEMENTATION VALIDATED — PR / MERGE PENDING**

Planning document:

`docs/PHASE_5_1C_DATASET_VALIDATION_REFERENCE_INTEGRITY_PLAN.md`

Authoritative implementation base:

```text
develop  9fc8c9b48ebc896e57e8e25e312e88f68f6af070
CI       34995743207 — SUCCESS
```

Feature branch:

`feature/phase-5-1c-dataset-validation-reference-integrity`

---

## Delivered implementation

### Complete candidate-dataset validation boundary

Added:

`src/domain/businessDatasetValidation.ts`

The validator accepts an unknown candidate, reuses the Phase 5.1A dataset-envelope gate, and returns a controlled deterministic result:

```text
BusinessDatasetValidationResult
├── valid
└── issues[]
    ├── code
    ├── collection
    ├── index
    ├── entityId
    ├── field
    ├── path
    └── message
```

The validation boundary is pure and does not construct repositories, hydrate application state, read workbook cells, or use any native filesystem API.

### Authoritative source validation

5.1C reuses the existing Phase 1–4 source/domain rules for all nine persisted collections:

- Materials;
- MaterialCalibrations;
- MixPresets;
- Products;
- YieldSamples;
- RecipeItems;
- ProductComponents;
- ProductStocks;
- ProductFinancialProfiles.

Material source validation also reuses existing package-costing/inventory derivation so invalid persisted numeric source state such as negative package cost or inventory cannot bypass the load gate.

Configured financial pricing policies continue through the authoritative `validatePricingPolicy(...)` rule.

### Historical calibration evidence validation

Added pure intrinsic validation:

`validateMaterialCalibrationEvidence(...)`

The existing material-specific calibration derivation still owns current Material compatibility. Its established error precedence was preserved by factoring identity and measurement validation into shared helpers rather than changing derivation semantics.

This lets persisted historical calibration evidence validate independently from a Material's later/current base-unit definition while retaining the existing calibration derivation behavior.

### Pre-hydration duplicate identity enforcement

Raw candidate arrays are checked before any repository construction can normalize or overwrite duplicate keys.

The implementation enforces trim-aware, case-insensitive duplicate rules for:

```text
Materials                 ID; name
MaterialCalibrations      ID
MixPresets                ID; name
Products                  ID; name
YieldSamples              ID
RecipeItems               ID; (productId, materialId)
ProductComponents         ID
ProductStocks             productId
ProductFinancialProfiles  productId
```

Product-component parent/source uniqueness remains delegated to the authoritative Phase 3 graph validator.

### Durable cross-reference enforcement

The complete candidate validates:

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
ProductComponent(material).sourceId             -> Material.id
ProductComponent(product).sourceId              -> Product.id
ProductStock.productId                          -> Product.id
ProductFinancialProfile.productId               -> Product.id
```

Reference comparison matches established trim-aware, case-insensitive identity semantics.

### Product composition integrity reuse

5.1C delegates to existing `validateProductCompositionGraph(...)` for:

- duplicate parent/source identity;
- direct Product self-reference;
- transitive Product cycles.

No second cycle algorithm was introduced.

### Persistence integrity remains separate from edit-time eligibility

The validator intentionally does not replay CRUD services or active-state write guards.

Valid persisted historical relationships therefore remain round-trippable even when referenced Materials, MixPresets, or Products are archived, while malformed rows, duplicate identities, missing references, invalid pricing policies, and composition cycles fail closed.

### No-repair semantics

5.1C does not:

- invent missing ProductStock rows;
- invent financial profiles;
- default null pricing policy;
- replace missing evidence with zero;
- rename duplicate IDs;
- drop orphan rows;
- break cycles;
- activate/archive entities to make a candidate pass.

The whole candidate is either valid for later hydration or rejected with diagnostics.

---

## Focused test coverage

Added:

`src/domain/businessDatasetValidation.test.ts`

The 30 focused tests cover:

- complete non-empty dataset;
- canonical empty dataset;
- trim-aware/case-insensitive reference resolution;
- archived historical relationships;
- historical calibration evidence independent from current Material base unit;
- missing versus explicit zero/null source evidence;
- candidate immutability;
- unsupported schema version and malformed collection failure;
- malformed row diagnostics;
- authoritative validation across all nine source collections;
- duplicate IDs/names/composite identities/one-record-per-Product rules;
- all locked durable cross-reference relationships;
- duplicate component source identity;
- direct self-reference;
- transitive cycle rejection;
- valid nested acyclic composition;
- deterministic issue ordering.

---

## First validated implementation checkpoint

```text
Feature head     03dfb5ca8bb4089321df312c5b31e2a151dbbfe9
CI               34997206352 — SUCCESS
Test files       84 passed
Tests            1048 passed
5.1C tests       30 passed
React smoke      8 passed
Phase 4.6A       7 real-service integration tests passed
Typecheck        PASS
Production build PASS
Modules          117 transformed
```

Existing non-blocking Vite warning remains:

```text
main minified JS chunk ~537.95 kB > 500 kB
```

This is the pre-existing code-splitting/performance warning and is not a 5.1C correctness blocker.

---

## Scope exclusions preserved

5.1C does not implement:

- XLSX dependency/library selection;
- XLSX encoding or decoding;
- workbook-to-dataset reconstruction;
- repository snapshot/hydration;
- persistence transactions/rollback;
- ExcelStorage runtime behavior;
- backups/atomic file replacement;
- browser file UI;
- Tauri filesystem/dialog behavior;
- data migration or automatic repair.

---

## Current gate

The implementation behavior is green on the feature branch.

Before 5.1C can be marked COMPLETE:

1. this documented feature head must pass exact CI;
2. the implementation PR to `develop` must pass exact PR CI;
3. the exact green PR head must be guarded-merged;
4. the resulting exact `develop` merge commit must pass push CI;
5. a docs-only closeout must mark 5.1C COMPLETE and advance the tracker to 5.2A;
6. the final closeout `develop` commit must pass exact CI.

Do not begin 5.2A implementation as part of this implementation record.
