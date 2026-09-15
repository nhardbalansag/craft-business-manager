# Phase 5.1B — Workbook Schema / Sheet / Column Contracts Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative base:

`develop` @ `8a1fdc2bbc5a24c20689c933b9964903d380e37c`

Exact base CI:

`34986791114 — SUCCESS`

Planning branch:

`docs/phase-5-1b-workbook-schema-plan`

## Purpose

Define the complete, versioned, library-independent workbook contract that maps the Phase 5.1A `BusinessDataset` source model to normalized workbook sheets and ordered columns before any XLSX library is selected or any workbook bytes are generated.

Phase 5.1B is a persistence-schema contract task only. It must make the workbook layout unit-testable as plain TypeScript metadata while keeping concrete XLSX APIs, parsing/writing, repository hydration, browser file workflows, backups, and Tauri filesystem behavior out of scope.

## Split assessment

**No deeper numbered split is required.**

5.1B is already one narrow contract boundary with no runtime persistence behavior. Creating `5.1B.1`, `5.1B.2`, etc. would add ceremony without creating independently releasable behavior.

Implementation should instead use these internal checkpoints:

1. workbook identity/version and canonical sheet registry;
2. exact ordered column/source mappings;
3. parent/child relationships and source-array reconstruction rules;
4. cell representation, required/optional, enum/unit, timestamp, and formula policies;
5. deterministic ordering and controlled workbook-schema diagnostics;
6. focused tests, full regression, PR/merge validation, and documentation closeout.

## Repository findings that govern this plan

Phase 5.1A established the complete source dataset:

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

`CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1` is already authoritative for the dataset contract.

The storage layer currently contains only:

```text
StoragePort
ExcelStorage placeholder
```

`ExcelStorage` still throws intentionally, and no XLSX dependency is installed. Workbook-specific contracts therefore belong under `src/storage`, not `src/domain`.

## Important refinement from the Phase 5 master-plan draft

The master plan's initial sheet target listed `MixPresets` and `MixPresetLines`, but the live authoritative `MixPreset` source also contains:

```ts
compatibleCategories: ProductCategory[]
```

The Phase 5 architecture explicitly rejects packing nested authoritative arrays into opaque JSON or delimiter-separated cells.

Therefore 5.1B formalizes an additional normalized child sheet:

```text
MixPresetCategories
```

This is a refinement of the master plan's **initial target**, not a new business entity. Each row belongs to one `MixPreset` and exists only to preserve/reconstruct its ordered `compatibleCategories` source array.

## Workbook identity and version semantics

Define library-independent constants equivalent to:

```ts
CRAFT_BUSINESS_WORKBOOK_FORMAT_ID = 'craft-business-manager'
CURRENT_WORKBOOK_FORMAT_VERSION = 1
```

The workbook-format version is distinct from:

```ts
CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1
```

Meaning:

- `datasetSchemaVersion` identifies the business source-data contract;
- `workbookFormatVersion` identifies the workbook sheet/column/layout contract;
- either may evolve independently in later phases;
- unsupported versions fail closed rather than guessing layout meaning.

## Canonical sheet registry

Phase 5.1B v1 contains exactly these **13 authoritative schema sheets**, in this deterministic order:

```text
1.  _Meta
2.  Materials
3.  Calibrations
4.  MixPresets
5.  MixPresetCategories
6.  MixPresetLines
7.  Products
8.  YieldSamples
9.  YieldSampleInputs
10. RecipeItems
11. ProductComponents
12. ProductStocks
13. ProductFinancialProfiles
```

All 13 schema sheets are required even when their data collection is empty.

Reason:

```text
missing canonical sheet != canonical sheet with zero source rows
```

Unknown extra worksheets may exist in a workbook and are non-authoritative. They are ignored for source reconstruction and must never be interpreted as application state. Future 5.2C/5.4C parsing limits still apply to the workbook as a whole so ignored sheets cannot bypass resource-safety limits.

Canonical sheet names and canonical column keys are case-sensitive contract tokens. Import must not silently guess renamed or misspelled schema names.

---

# Exact v1 sheet contracts

## 1. `_Meta`

Purpose: identify the workbook format and the dataset contract used by the file.

Exactly one authoritative metadata row is expected.

Ordered columns:

| Column | Type | Required | Semantic owner |
| --- | --- | --- | --- |
| `formatId` | text | yes | workbook contract; exact `craft-business-manager` |
| `workbookFormatVersion` | number/integer | yes | workbook contract version |
| `datasetSchemaVersion` | number/integer | yes | `BusinessDataset.schemaVersion` |
| `exportedAt` | text/ISO timestamp | yes on export | workbook export metadata only |
| `applicationVersion` | text | no | exporting application metadata when reliably available |

`exportedAt` and `applicationVersion` are **not authoritative business source evidence**.

`exportedAt` uses deterministic ISO-8601 text, not an Excel serial date.

## 2. `Materials`

One row per `Material`.

Ordered columns:

```text
id
name
group
baseUnit
purchaseQuantity
purchaseUnit
packageCost
manualBaseUnitsPerPurchaseUnit
onHandQuantity
onHandUnit
sourceVendorName
sourceDetail
sourcePurchaseLink
sourceContactNumber
sourceSocialPage
sourceNotes
notes
isActive
```

Source mapping:

```text
id                                  -> Material.id
name                                -> Material.name
group                               -> Material.group
baseUnit                            -> Material.baseUnit
purchaseQuantity                    -> Material.purchaseQuantity
purchaseUnit                        -> Material.purchaseUnit
packageCost                         -> Material.packageCost
manualBaseUnitsPerPurchaseUnit      -> Material.manualBaseUnitsPerPurchaseUnit
onHandQuantity                      -> Material.onHandQuantity
onHandUnit                          -> Material.onHandUnit
sourceVendorName                    -> Material.source?.vendorName
sourceDetail                        -> Material.source?.source
sourcePurchaseLink                  -> Material.source?.purchaseLink
sourceContactNumber                 -> Material.source?.contactNumber
sourceSocialPage                    -> Material.source?.socialPage
sourceNotes                         -> Material.source?.notes
notes                               -> Material.notes
isActive                            -> Material.isActive
```

Material source metadata remains flattened because it is an optional one-to-one nested value, not a separately identified entity or repeated array.

All source metadata cells being blank reconstructs `source: undefined`; no empty source object is synthesized.

## 3. `Calibrations`

One row per `MaterialCalibrationEvidence`.

Ordered columns:

```text
id
materialId
measuredVolume
volumeUnit
knownWeight
weightUnit
recordedAt
notes
```

Derived values such as `measuredCups`, `knownWeightGrams`, and `gramsPerCup` are intentionally excluded.

`recordedAt` is canonical ISO-compatible text.

## 4. `MixPresets`

One row per `MixPreset` parent record.

Ordered columns:

```text
id
name
basis
notes
isActive
```

The repeated `compatibleCategories` and `lines` arrays do not appear in the parent row. They are normalized into the next two child sheets.

## 5. `MixPresetCategories`

One row per entry in `MixPreset.compatibleCategories`.

Ordered columns:

```text
mixPresetId
categoryOrder
category
```

Source semantics:

- `mixPresetId` links to the parent preset;
- `categoryOrder` is **workbook reconstruction metadata**, not a domain field;
- `categoryOrder` is a required 1-based positive integer within each parent;
- `category` is one canonical `ProductCategory` token.

The ordered child rows reconstruct the original `compatibleCategories` array without inventing IDs or packing values into one cell.

## 6. `MixPresetLines`

One row per `MixPreset.lines` entry.

Ordered columns:

```text
mixPresetId
lineOrder
materialId
role
parts
```

Source semantics:

- `lineOrder` is required 1-based workbook reconstruction metadata;
- it preserves the source-array order without inventing a `MixPresetLine` domain ID;
- `materialId`, `role`, and `parts` map directly to `MixPresetLine`.

## 7. `Products`

One row per `Product`.

Ordered columns:

```text
id
name
category
mixPresetId
safetyWasteRate
notes
isActive
```

`safetyWasteRate` is stored as its canonical decimal rate, e.g. `0.05` for 5%, not display text `5%` or numeric `5`.

## 8. `YieldSamples`

One row per `YieldSample` parent record.

Ordered columns:

```text
id
productId
mixPresetId
goodPieces
rejectedPieces
recordedAt
notes
```

`materialInputs` is normalized into `YieldSampleInputs`.

`recordedAt` is canonical ISO-compatible text.

## 9. `YieldSampleInputs`

One row per `YieldSample.materialInputs` entry.

Ordered columns:

```text
yieldSampleId
inputOrder
materialId
quantity
unit
```

`inputOrder` is required 1-based workbook reconstruction metadata and is not added to the domain model.

## 10. `RecipeItems`

One row per `FixedRecipeItem`.

Ordered columns:

```text
id
productId
materialId
quantityPerProduct
unit
role
notes
```

Only source quantity/unit are persisted. Derived canonical quantities, conversion source, calibration choice, and costs are excluded.

## 11. `ProductComponents`

One row per `ProductComponent`.

Ordered columns:

```text
id
parentProductId
sourceType
sourceId
role
quantityPerParent
notes
```

Derived cost, availability, capacity, graph trace, and limiting-resource data are excluded.

## 12. `ProductStocks`

One row per persisted `ProductStock` source record.

Ordered columns:

```text
productId
onHandQuantity
notes
```

No unit column is introduced: Product stock is canonically whole pieces (`pc`) in the existing source contract.

Row absence remains semantically distinct from an explicit row with `onHandQuantity = 0`.

## 13. `ProductFinancialProfiles`

One row per persisted `ProductFinancialProfile` source record.

Ordered columns:

```text
productId
laborCostPerUnit
overheadCostPerUnit
pricingMethod
pricingValue
notes
```

The one-to-one nested `PricingPolicy | null` is flattened.

Reconstruction rules:

```text
pricingMethod blank + pricingValue blank
    -> pricingPolicy = null

pricingMethod populated + pricingValue populated
    -> pricingPolicy = { method, value }

only one populated
    -> structurally invalid workbook row
```

Numeric `0` is a real value and must never be confused with blank/absent.

Row absence remains distinct from an explicit zero-cost financial-profile row.

---

# Cell representation contract

## Primitive types

The schema contract uses only workbook-neutral primitives:

```text
text
number
boolean
blank (optional value only)
```

No domain source value requires formula evaluation, rich text, hyperlinks as executable semantics, macros, embedded objects, or JSON-in-cell encoding.

## Required versus optional cells

A column contract declares whether its source value is required.

Rules:

- required text must be present and nonblank;
- required number must be present as a numeric value;
- required boolean must be present as a boolean value;
- optional text/reference/number may be blank to mean source absence/`undefined`;
- blank is never converted automatically into `0`, `false`, empty source objects, or placeholder IDs;
- explicit numeric zero is preserved as a number;
- explicit boolean `false` is preserved as a boolean.

The detailed domain range/business validation of populated values remains 5.1C.

## Enum and unit tokens

Workbook rows persist canonical application tokens, not display labels.

Examples:

```text
ProductCategory      paintable-art | candle-pot | candle
RatioBasis           weight | volume
PricingMethod        profit-amount | markup-percent | margin-percent
Product source type  material | product
BaseUnit             g | mL | pc
Input units           g | kg | oz | lb | mL | L | cup | tbsp | tsp | fl-oz | pc
```

Material package units use their canonical tokens such as `bag`, `box`, `pack`, etc.

The schema registry may expose allowed-token metadata for structural diagnostics and testability. Existing domain validators remain authoritative for business semantics.

## Numbers, money, and rates

Authoritative numeric source values are stored as numbers without business rounding.

Examples:

- `packageCost`, labor, and overhead are raw numeric amounts;
- `purchaseQuantity`, measured quantities, ratio parts, and recipe quantities preserve source precision;
- `safetyWasteRate` is a canonical decimal rate;
- pricing markup/margin values remain canonical decimal rates;
- display number formats are presentation metadata only and must never change imported values.

`NaN`, `Infinity`, and `-Infinity` are not valid workbook source values.

## Timestamps

`recordedAt` and `_Meta.exportedAt` use ISO-compatible **text** values in workbook v1.

Do not use locale-dependent Excel serial-date interpretation as the authoritative v1 representation.

## Literal text and spreadsheet formulas

Every authoritative text column has a `literal-only` policy.

The workbook codec must later ensure that text beginning with spreadsheet formula triggers such as `=`, `+`, `-`, or `@` is emitted as literal text rather than as an executable formula.

Authoritative input fields never rely on spreadsheet formula evaluation.

5.1B defines this policy in metadata; 5.2B/5.2C implement and test the concrete XLSX-library handling.

A formula-typed cell encountered in an authoritative source column must fail closed during import rather than being evaluated as source data.

---

# Parent/child relationships

The workbook schema registry must formally declare these relationships:

```text
MixPresets.id
  -> MixPresetCategories.mixPresetId
  -> MixPresetLines.mixPresetId

YieldSamples.id
  -> YieldSampleInputs.yieldSampleId
```

Relationship metadata in 5.1B describes reconstruction ownership only.

5.1B does **not** verify that every child reference resolves, that IDs are unique, or that Product graphs are acyclic. Those dataset-integrity checks belong to 5.1C.

## Workbook-only order columns

These fields exist solely to reconstruct authoritative source arrays:

```text
MixPresetCategories.categoryOrder
MixPresetLines.lineOrder
YieldSampleInputs.inputOrder
```

Rules:

- positive integer;
- 1-based within each parent;
- deterministic on export;
- not copied into domain source objects;
- gaps/duplicates/order-shape diagnostics may be reported by workbook structural validation, while parent existence/reference validation remains 5.1C.

---

# Deterministic export ordering policy

5.1B defines canonical ordering metadata even though actual export is 5.2B.

Canonical **sheet order** is the 13-sheet registry order above.

Recommended canonical **row order**:

```text
Materials                 id (case-insensitive, stable tie by exact id)
Calibrations              materialId, recordedAt, id
MixPresets                id
MixPresetCategories       mixPresetId, categoryOrder
MixPresetLines            mixPresetId, lineOrder
Products                  id
YieldSamples              productId, recordedAt, id
YieldSampleInputs          yieldSampleId, inputOrder
RecipeItems               productId, id
ProductComponents         parentProductId, id
ProductStocks             productId
ProductFinancialProfiles  productId
```

Top-level repository/dataset array order is not authoritative and may be canonicalized for deterministic export.

Child array order **is preserved** through explicit workbook-only order columns.

Comparisons of source IDs for canonical ordering use case-insensitive primary comparison with an exact-string tie-breaker so output is stable.

---

# Workbook schema diagnostics boundary

5.1B should define controlled, structured diagnostics for workbook **shape/contract** concerns without performing 5.1C business/reference validation.

Expected structural diagnostic categories include:

```text
INVALID_WORKBOOK_SCHEMA
MISSING_META_SHEET
INVALID_META_ROW_COUNT
INVALID_FORMAT_ID
INVALID_WORKBOOK_FORMAT_VERSION
INVALID_DATASET_SCHEMA_VERSION_SHAPE
MISSING_REQUIRED_SHEET
MISSING_REQUIRED_COLUMN
DUPLICATE_COLUMN
UNEXPECTED_CANONICAL_COLUMN
MISSING_REQUIRED_CELL
INVALID_CELL_TYPE
INVALID_ENUM_TOKEN
INVALID_UNIT_TOKEN
INVALID_CHILD_ORDER
INVALID_PAIRED_FIELDS
FORMULA_CELL_NOT_ALLOWED
```

Exact implementation names may be refined before code only if the semantics remain equivalent and the plan is updated first.

### Unknown extra sheets

Unknown extra worksheets are permitted and ignored as non-authoritative content.

### Unknown extra columns on canonical sheets

For v1 canonical sheets, unknown extra columns should be ignored rather than treated as source data, provided all required canonical columns exist and canonical columns are not duplicated.

Reason:

- users may annotate/export around the authoritative table;
- later versions can add fields without older code guessing their semantics;
- authoritative reconstruction remains based only on known canonical columns.

Future migration/version logic remains responsible for compatibility between known workbook format versions.

### What remains 5.1C

Do not pull these concerns into 5.1B:

- domain contract/range validation beyond structural primitive/token shape;
- duplicate Material/Product/etc. identity rules;
- case-insensitive entity identity conflicts;
- missing Material/Product/MixPreset references;
- ProductComponent source/parent existence;
- Product composition self/cycle validation;
- one-stock/profile-per-product enforcement;
- semantic relationship compatibility;
- complete-dataset acceptance before hydration.

---

# Planned implementation surface

Expected code surface for the later implementation step:

```text
src/storage/workbookSchema.ts
src/storage/workbookSchema.test.ts
```

`workbookSchema.ts` should contain plain TypeScript constants/types/functions describing:

- workbook identity/version;
- sheet order/names;
- ordered column contracts;
- required/optional primitive types;
- allowed enum/unit tokens where useful;
- source semantic mappings;
- parent/child relationship metadata;
- literal/formula policy;
- deterministic row-order metadata;
- structural schema diagnostics/assertions that can operate on workbook-neutral schema/row representations.

No concrete XLSX library types may leak into this module.

Do not modify `ExcelStorage` to read/write files in 5.1B.

## Possible supporting types

Implementation may define workbook-neutral concepts similar to:

```text
WorkbookSheetName
WorkbookColumnContract
WorkbookSheetContract
WorkbookCellKind
WorkbookFormulaPolicy
WorkbookRelationshipContract
WorkbookSchemaIssue
```

These are persistence-layer contracts, not domain entities.

---

# Focused test matrix

5.1B implementation tests must cover at least:

1. exact workbook format ID and format version;
2. dataset schema version remains separately represented;
3. exact 13-sheet canonical order;
4. every authoritative `BusinessDataset` source collection has an explicit sheet destination;
5. `MixPreset.compatibleCategories` maps to `MixPresetCategories` and is not packed into one cell;
6. `MixPreset.lines` maps to `MixPresetLines` with `lineOrder`;
7. `YieldSample.materialInputs` maps to `YieldSampleInputs` with `inputOrder`;
8. Material source metadata maps to explicit flattened Material columns;
9. ProductFinancialProfile null-policy encoding uses paired blank pricing fields without conflating numeric zero;
10. exact ordered columns for every canonical sheet;
11. required/optional primitive kinds are encoded in the schema registry;
12. enum/unit columns expose canonical tokens;
13. timestamps are defined as ISO text, not Excel serial-date values;
14. authoritative text columns are marked literal/formula-disallowed;
15. deterministic row-order metadata exists for every data sheet;
16. missing canonical sheet/column diagnostics are controlled;
17. wrong primitive type / invalid token diagnostics are controlled;
18. child order must be a positive 1-based integer shape;
19. unknown extra sheets/columns are non-authoritative and ignored by schema reconstruction policy;
20. no XLSX dependency/API is required to run the focused contract tests.

Full repository regression must also remain green.

---

# Validation gate

Before 5.1B can later be marked complete:

- the dedicated plan is already merged before implementation begins;
- workbook schema code remains library-independent;
- exact 13-sheet registry exists;
- every source field has an explicit canonical destination/reconstruction rule;
- every canonical sheet has exact ordered columns;
- parent/child/order semantics are explicit;
- missing-vs-explicit-zero/null semantics remain representable;
- literal-text/formula policy is explicit;
- focused schema tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- no XLSX package is added in 5.1B;
- feature PR CI passes;
- exact merged `develop` CI passes;
- documentation closeout advances 5.1C to NEXT only after the post-merge gate is green.

---

# Explicit exclusions

Not part of 5.1B:

- concrete XLSX package evaluation/selection — 5.2A;
- creating/parsing real `.xlsx` bytes — 5.2B/5.2C;
- source-row domain/cross-reference/cycle validation — 5.1C;
- repository snapshotting — 5.3A;
- repository hydration/atomic state replacement — 5.3B;
- persistence coordinator lifecycle — 5.3C;
- backup/atomic filesystem replacement — 5.4;
- persistence UI — 5.5;
- browser file picker/download implementation — 5.5;
- native Tauri filesystem/dialog behavior — Phase 6;
- any change to Phase 1–4 calculations or business formulas.

## Next step after this planning PR is merged and validated

Start a separate 5.1B implementation feature branch from the exact final green planning `develop` baseline, implement only the library-independent workbook schema contract above, and do not begin 5.1C automatically.
