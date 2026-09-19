# Phase 5.1A — Persisted Dataset Source Inventory & Contract Completeness Plan

## Status

**COMPLETE — IMPLEMENTED, MERGED, AND POST-MERGE VALIDATED**

Authoritative base:

`develop` @ `5cf12188b8ec2d727aa5debe6a131a10168244ab`

Exact base CI:

`34984709583 — SUCCESS`

Feature branch:

`feature/phase-5-1a-dataset-source-completeness`

Plan-before-code commit:

`26ef1a887c75cd1cd648c1884cc1d24be968ddcd`

> The planning sections below are preserved as the pre-implementation contract. Final execution evidence is recorded in the closeout section at the end.

## Purpose

Make the persisted `BusinessDataset` contract complete for every authoritative Phase 1–4 source repository before any workbook/XLSX implementation begins.

This task is a persistence-source contract task only. It does not introduce XLSX encoding, workbook sheets/columns, cross-reference validation, repository hydration, browser import/export, or Tauri filesystem behavior.

## Source inventory

Current authoritative source repositories and persisted ownership:

| Repository | Authoritative source type | `BusinessDataset` field | 5.1A state |
| --- | --- | --- | --- |
| `MaterialRepository` | `Material` | `materials` | already represented |
| `CalibrationRepository` | `MaterialCalibrationEvidence` | `materialCalibrations` | **missing — add in 5.1A** |
| `MixPresetRepository` | `MixPreset` | `mixPresets` | already represented |
| `ProductRepository` | `Product` | `products` | already represented |
| `YieldSampleRepository` | `YieldSample` | `yieldSamples` | already represented |
| `FixedRecipeItemRepository` | `FixedRecipeItem` | `recipeItems` | already represented |
| `ProductComponentRepository` | `ProductComponent` | `productComponents` | already represented |
| `ProductStockRepository` | `ProductStock` | `productStocks` | already represented |
| `ProductFinancialProfileRepository` | `ProductFinancialProfile` | `productFinancialProfiles` | already represented |

No Settings repository/source contract exists, so 5.1A must not invent one.

Derived material costs, normalized inventory values, learned yield, production requirements, component costs, capacities, pricing quotes, revenue, profit, and other computed results remain non-persisted.

## Locked implementation decisions

### 1. Current dataset schema version

Define one explicit current dataset schema version constant:

```text
CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1
```

Version `1` represents the first formally specified complete persisted source dataset. No workbook has yet been authoritative, so adding calibration evidence establishes the v1 contract rather than requiring a migration from a previously released persisted schema.

### 2. Complete source collection list

Expose one ordered source-collection key list used by completeness checks:

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

This is the complete Phase 1–4 persistence inventory.

### 3. Top-level completeness only

5.1A validates only the complete persisted dataset envelope:

- input is an object;
- schema version is a positive integer;
- schema version is the current supported v1 value;
- every required source collection exists;
- every required source collection is an array.

Row-level domain validation, duplicate identity checks, missing references, component graph cycles, and relationship integrity are reserved for 5.1C.

### 4. Defensive cloning

Provide a full dataset clone operation that creates new arrays and new source records, including nested source structures:

- Material source metadata;
- MixPreset compatible categories and lines;
- YieldSample material inputs;
- ProductFinancialProfile pricing policy;
- every other source record.

Mutating a cloned dataset must not mutate the original source dataset.

### 5. Normalization semantics

`normalizeBusinessDataset` in 5.1A means:

1. assert the complete top-level persisted dataset envelope;
2. return a defensive clone in the canonical dataset shape.

It must **not** silently repair invalid source rows, trim business identifiers, invent defaults, create missing rows, or perform 5.1C reference/domain validation.

### 6. Controlled completeness errors

Use a dedicated `BusinessDatasetCompletenessError` with controlled codes for:

- non-object dataset input;
- invalid schema-version shape;
- unsupported dataset schema version;
- missing required source collection;
- source collection that is not an array.

Diagnostics should identify the affected collection/version when applicable.

### 7. Missing versus explicit zero

Dataset helpers must preserve evidence semantics:

- no ProductStock row stays missing;
- ProductStock `{ onHandQuantity: 0 }` stays an explicit zero row;
- no ProductFinancialProfile stays missing;
- explicit `0` labor/overhead stays an explicit configured profile;
- `pricingPolicy: null` stays explicitly unconfigured;
- no placeholder source rows are synthesized.

## Planned code changes

Expected implementation surface:

```text
src/domain/types.ts
src/domain/businessDataset.ts
src/domain/businessDataset.test.ts
```

`src/domain/types.ts` will add/re-export `MaterialCalibrationEvidence` and add `materialCalibrations` to `BusinessDataset`.

`src/domain/businessDataset.ts` will own the v1 dataset schema constant, required collection keys, empty-dataset factory, envelope completeness assertion, clone, and normalize helper.

No XLSX dependency or storage adapter implementation is included.

## Test matrix

Focused tests must cover:

1. empty v1 dataset contains all nine source collections;
2. complete dataset with calibration evidence is accepted;
3. missing `materialCalibrations` fails with a controlled missing-collection error;
4. non-array collection fails closed;
5. invalid/non-integer schema version fails closed;
6. unsupported schema version fails closed;
7. defensive cloning isolates top-level and nested source structures;
8. normalization returns canonical defensive source ownership without source repair;
9. missing ProductStock/profile remain absent;
10. explicit zero ProductStock/profile and `pricingPolicy: null` survive cloning/normalization unchanged.

## Validation gate

Before 5.1A can be marked complete:

- focused 5.1A tests pass;
- full repository test suite passes;
- TypeScript typecheck passes;
- production build passes;
- no XLSX library/code is introduced;
- feature PR CI passes;
- exact merged `develop` CI passes;
- final documentation records the exact feature head, PR, merge SHA, CI evidence, and advances 5.1B to NEXT only after post-merge validation.

## Explicit exclusions

Not part of 5.1A:

- workbook `_Meta`, sheets, or column contracts — 5.1B;
- row/domain/reference/graph validation — 5.1C;
- XLSX library selection — 5.2A;
- XLSX export/import — 5.2B/5.2C;
- repository snapshot/hydration — 5.3;
- backup/atomic transport — 5.4;
- persistence UI — 5.5;
- Tauri native filesystem/dialogs — Phase 6.

## Historical next step after plan approval

Implement only the contract-completeness surface above, validate it, and do not begin 5.1B automatically.

---

## Final execution closeout

The plan was executed without expanding into 5.1B or later Phase 5 work.

```text
Starting develop                 5cf12188b8ec2d727aa5debe6a131a10168244ab
Starting develop CI              34984709583 — SUCCESS
Plan-before-code                 26ef1a887c75cd1cd648c1884cc1d24be968ddcd
First implementation checkpoint  61728a3e62d58afa291b57e02fa288836801fda3
First checkpoint CI              34985582449 — FAILURE (expected fixture completeness catch)
Corrected implementation head    d9a87c7714e69dc0584a86dbb20f282dbeadaa4d
Implementation CI                34985739279 — SUCCESS
Documented feature head          b03313fe3260d7b293241b291b836f962e49b07c
Documented feature-head CI       34985914438 — SUCCESS
PR #131                          MERGED
PR CI                            34986078428 — SUCCESS
Implementation merge             467341eafe36e37812eb65f4cd4683dd9153868b
Post-merge develop CI            34986286733 — SUCCESS
82 test files / 996 tests
10 Phase 5.1A focused tests
8 React workspace smoke tests
7 Phase 4.6A real-service integration tests
TypeScript typecheck passed
Production Vite build passed
117 modules transformed
```

The implementation added the missing calibration source collection, established dataset schema v1 and controlled top-level completeness semantics, preserved evidence distinctions, and introduced no XLSX/workbook/transport/UI/Tauri behavior.

**5.1A is complete. 5.1B remains separate and must receive its own dedicated development plan before implementation.**
