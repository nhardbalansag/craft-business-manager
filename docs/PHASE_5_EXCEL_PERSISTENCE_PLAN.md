# Phase 5 — Excel Persistence Master Development Plan

## Status

**MASTER PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning base:

`develop` @ `1d9d93c265fcadd01c3f16318bfcf7c079a432a1`

Starting exact `develop` CI:

`34982462060 — SUCCESS`

Planning branch:

`docs/phase-5-master-plan`

## Objective

Turn the completed Phase 1–4 in-memory source model into a durable, validated, versioned `.xlsx` persistence format without moving spreadsheet concerns into the domain/application business rules.

Phase 5 must let the business owner:

- export the complete authoritative business source dataset to an Excel workbook;
- import that workbook later and restore the same business source state;
- preserve all source evidence required by costing, yield, composition, inventory, capacity, and pricing logic;
- detect malformed, incomplete, contradictory, or unsupported workbook data before live application state is changed;
- retain a deterministic schema/version contract so later application versions can migrate older workbooks safely;
- create safe backup artifacts before destructive replacement when the active storage transport supports replacement;
- use browser-compatible import/export during Phase 5 while keeping native path/dialog/filesystem operations reserved for Phase 6 Tauri integration.

Phase 5 is persistence infrastructure and user workflow. It must not change the financial, conversion, recipe, component, yield, inventory, capacity, or pricing formulas completed in Phases 1–4.

---

# Planning Discovery

## Existing storage scaffold

The repository already has a small storage abstraction:

```ts
interface StoragePort {
  load(): Promise<BusinessDataset>;
  save(dataset: BusinessDataset): Promise<void>;
  createBackup?(dataset: BusinessDataset): Promise<string>;
}
```

and a placeholder `ExcelStorage` implementation whose `load()` and `save()` deliberately throw until the Excel-persistence phase.

This is useful architectural intent, but it is not yet sufficient as the authoritative Phase 5 contract because:

- no workbook schema exists;
- no `.xlsx` codec dependency/boundary exists;
- no validated import path exists;
- no live repository snapshot/hydration coordinator exists;
- no atomic dataset replacement semantics exist;
- no migration/version compatibility rules exist;
- no user-facing import/export workflow exists.

## Existing `BusinessDataset`

The current dataset contract contains:

```text
schemaVersion
materials
mixPresets
products
yieldSamples
recipeItems
productComponents
productStocks
productFinancialProfiles
```

### Critical completeness gap

The live application session also owns an authoritative `CalibrationRepository`, but `BusinessDataset` currently does **not** contain `MaterialCalibrationEvidence[]`.

Calibration evidence is not optional derived output. It is authoritative source evidence used by material quantity normalization, package costing, inventory normalization, recipe/yield calculations, and downstream production/pricing calculations.

Therefore Phase 5 must not implement an authoritative workbook writer against the current incomplete dataset contract.

**5.1A must first reconcile the persisted source inventory and add calibration evidence to the authoritative persisted dataset contract.**

## Current authoritative repositories

The completed application session owns these source repositories:

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

These are the authoritative source collections that Phase 5 must be capable of round-tripping.

Derived services/results such as material costing, learned requirements, production requirements, component costs, fully loaded cost, selling price, expected revenue/profit, and capacity feasibility are recalculated from source evidence and must not become persisted authoritative rows.

## Current session limitation

The shared application session constructs in-memory repositories directly and wires services around them.

There is currently no application-level operation that:

1. snapshots all authoritative repositories into one complete dataset; or
2. validates a candidate dataset and replaces the complete live source state atomically.

Phase 5 must add an explicit snapshot/hydration boundary rather than teaching React or the workbook codec to mutate individual repositories ad hoc.

## Current dependency state

No `.xlsx` codec library is currently installed.

Phase 5 will evaluate the workbook library behind an internal codec boundary in 5.2A before adopting it. The selection must consider:

- browser/Tauri compatibility;
- `.xlsx` read/write support;
- TypeScript support;
- maintained/current package state;
- license compatibility;
- security history;
- bundle-size impact;
- deterministic testability;
- formula/macro handling behavior.

The master plan does not lock the repository to a specific Excel library before that evaluation.

## Tauri boundary

`@tauri-apps/api` is present, but native file dialogs/path/filesystem behavior remains **Phase 6**.

Phase 5 therefore owns:

- dataset contracts;
- workbook schema;
- XLSX encode/decode;
- validation;
- repository snapshot/hydration;
- persistence coordination;
- browser-compatible import/export/download workflows;
- storage-transport abstractions needed by future native integration.

Phase 6 will provide the concrete native filesystem/dialog implementation without rewriting the Phase 5 workbook or business-data rules.

---

# Locked Phase 5 Architecture Decisions

## 1. Persist source evidence, not derived business results

The Excel workbook is an authoritative persistence format for source state.

Persist:

- material source/configuration/inventory fields;
- material calibration evidence;
- mix preset definitions;
- Product source records;
- immutable yield-sample evidence;
- fixed recipe source lines;
- Product component source lines;
- ProductStock source records;
- Product financial-profile source records;
- schema/workbook metadata required to interpret the file.

Do **not** persist as authoritative business source data:

- cost per base unit;
- inventory valuation;
- derived grams-per-cup;
- effective yield calculations;
- learned per-piece requirements;
- recipe cost previews;
- waste-adjusted production requirements;
- component-aware costs;
- producible/current assembly capacity;
- limiting-resource calculations;
- fully loaded unit cost;
- selling price;
- profit/markup/margin;
- planned batch cost/revenue/profit;
- capacity-feasibility results.

Those must be recalculated from restored source evidence by the existing authoritative services.

## 2. Persisted dataset completeness is a formal contract

Phase 5 will establish one explicit persisted dataset contract containing every authoritative source collection required to restore application behavior.

At minimum it must contain:

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

The existing `schemaVersion` field will be reviewed in 5.1A/5.1B so its semantics are explicit.

No source repository may remain outside the persistence inventory without an explicit documented exclusion.

## 3. Dataset schema version and workbook-format version are separate concepts

The workbook metadata must distinguish:

```text
dataset schema version
workbook format/layout version
```

Reason:

- the business dataset contract can evolve while the workbook layout remains compatible;
- workbook column/sheet layout can evolve without changing domain source semantics;
- migrations need to know which concern changed.

A reserved metadata sheet will identify the file as a Craft Business Manager workbook and carry these version values.

## 4. `.xlsx` is the Phase 5 authoritative exchange/persistence format

Phase 5 targets modern `.xlsx` workbooks.

Phase 5 does not promise support for:

- legacy binary `.xls`;
- macro-enabled `.xlsm` as an authoritative application format;
- CSV as a complete database substitute;
- Google Sheets as a separate live database/API integration.

A user may later upload an exported `.xlsx` workbook to Google Sheets manually, but live Google Sheets integration requires separate planning.

## 5. Workbook sheets are normalized and inspectable

Do not serialize nested arrays as opaque JSON strings merely to make encoding easy.

Nested source collections use parent/child sheets so rows remain readable, filterable, and recoverable.

Initial workbook layout target:

```text
_Meta
Materials
Calibrations
MixPresets
MixPresetLines
Products
YieldSamples
YieldSampleInputs
RecipeItems
ProductComponents
ProductStocks
ProductFinancialProfiles
```

### `_Meta`

Reserved metadata such as:

```text
formatId
workbookFormatVersion
datasetSchemaVersion
exportedAt
applicationVersion (when reliably available)
```

`exportedAt` is workbook metadata, not authoritative business source evidence.

### Materials

One row per Material. Embedded supplier/source metadata remains columns on the material row unless a later source-domain change creates a separate supplier entity.

### Calibrations

One row per `MaterialCalibrationEvidence` record.

### MixPresets + MixPresetLines

One parent row per mix preset plus one child row per ratio line.

### YieldSamples + YieldSampleInputs

One parent row per immutable yield sample plus one child row per measured material input.

### ProductFinancialProfiles

Pricing policy can remain flattened into explicit columns such as pricing method/value because the policy is a one-to-one nested value, not an independent entity.

## 6. No invented Settings source contract

Earlier roadmap notes suggested a `Settings` sheet as a possible workbook sheet.

There is currently no authoritative Settings repository/domain source contract.

Phase 5 will not create a fake Settings table simply because spreadsheets often have one.

Workbook metadata belongs in `_Meta`. A future Settings sheet should appear only after the application has a real persisted settings source model.

## 7. Workbook text is data, never executable business logic

Authoritative application fields must not depend on spreadsheet formulas.

Rules:

- exported source fields are written as literal values;
- authoritative import does not evaluate workbook formulas to determine business source values;
- formula cells in authoritative source columns must be rejected or treated as unsupported input according to the 5.2C parser contract;
- text values that begin with spreadsheet formula prefixes must remain literal text rather than becoming formulas during export;
- macros are not required or executed.

This protects the workbook from becoming a second calculation engine and reduces spreadsheet-injection risk.

## 8. Import validates before live-state mutation

Loading is two-step:

```text
Workbook bytes
  -> parse candidate workbook
  -> candidate persisted dataset
  -> schema/type/domain/reference/graph validation
  -> complete valid dataset
  -> atomic live-state replacement
```

No live repository is mutated while workbook parsing or validation is still in progress.

A failed import must leave the currently loaded business state unchanged.

## 9. Cross-reference validation is explicit

Workbook validation must cover at least:

- duplicate IDs/keys under the application's case-insensitive identity policies;
- missing Material references;
- missing Product references;
- missing MixPreset references;
- calibration-to-Material references;
- yield-sample Product/Material/MixPreset references;
- recipe Product/Material references;
- ProductComponent parent/source references;
- ProductStock Product references;
- ProductFinancialProfile Product references;
- Product composition self/cycle rules;
- duplicate ProductComponent source rules;
- current domain source-contract validation for every row.

Import must not silently discard bad rows and continue with a partially loaded database.

## 10. Missing and explicit zero remain different after round-trip

Phase 1–4 evidence semantics must survive Excel persistence.

Examples:

- no ProductStock row != ProductStock row with `0 pc`;
- no ProductFinancialProfile != explicit profile with `0` labor and `0` overhead;
- `pricingPolicy = null` != an invented default policy;
- optional notes/source fields absent != arbitrary placeholder values.

The importer/exporter must not convert missing source evidence into fake zero/empty defaults.

## 11. Numeric precision is not presentation formatting

Persist authoritative numeric source values without business-rounding them merely for Excel display.

The workbook may apply readable number formats, but encoded source numbers retain the precision supplied by the source model.

Currency formatting, percentage formatting, and column widths are presentation metadata and must not change imported semantics.

## 12. Dates/timestamps use deterministic ISO semantics

Authoritative source timestamps such as calibration `recordedAt` and yield-sample `recordedAt` remain ISO-compatible source strings at the application boundary.

Workbook presentation may use Excel date formatting only if round-trip semantics are deterministic and timezone-safe.

The preferred v1 contract is to preserve canonical ISO text rather than rely on ambiguous local Excel serial-date interpretation.

## 13. Workbook parsing is fail-closed and resource-bounded

The importer must reject unsupported/corrupt structures with controlled diagnostics.

5.2C/5.4C will establish practical limits for workbook/sheet/row sizes so a malformed or hostile workbook cannot cause uncontrolled memory use in the desktop/web runtime.

No raw parser exception should become the only user-facing explanation.

## 14. Deterministic export is required

Given semantically identical source state, workbook row ordering and schema column ordering should be deterministic.

Recommended row ordering:

- stable case-insensitive ID/key order for entity sheets;
- parent ID + stable child identity/order for child sheets;
- chronological evidence may preserve source identity while remaining deterministic.

This improves testing, support, and future workbook-diff/recovery workflows.

## 15. Codec and storage transport remain separate

Conceptual separation:

```text
BusinessDataset
    <-> WorkbookCodec <-> XLSX bytes
                         |
                         v
                  WorkbookTransport
                         |
             browser / memory / Tauri
```

The workbook codec knows sheets/cells.

The domain and normal application services do not.

The native Tauri transport remains Phase 6.

## 16. Repository snapshot/hydration has one application boundary

React must not enumerate all repositories and build workbooks itself.

Phase 5 will add an application-level persistence coordinator capable of:

- snapshotting complete authoritative source state;
- validating a candidate complete dataset;
- applying a valid dataset as one logical replacement;
- saving/exporting the current complete dataset;
- reporting controlled persistence/import issues.

The exact repository bulk-replacement/session-rebuild implementation is decided in 5.3A/5.3B, but atomicity from the user's perspective is mandatory.

## 17. Backup and atomic replacement are capabilities, not React logic

Backup naming, write-before-replace sequencing, and atomic replacement semantics belong behind the persistence/transport boundary.

Phase 5 can fully test these semantics with an in-memory/fake transport.

Phase 6 will implement the concrete native filesystem operations.

Browser Phase 5 workflows may export/download a primary workbook and explicit backup artifacts but cannot pretend that browser downloads are native atomic file replacement.

## 18. Version migration is explicit

For supported older workbook/dataset versions:

```text
read old format
-> migrate candidate source dataset
-> validate current contract
-> hydrate current application state
```

For future/unsupported versions:

- fail closed;
- do not guess column meaning;
- leave live state unchanged;
- report expected vs received versions.

## 19. Import/export must preserve service-derived behavior

Round-trip success is not only row equality.

Integration tests must prove that after export -> import/hydrate:

- material calibration selection still resolves identically;
- product yield learning still resolves identically;
- recipe requirements/costs remain equivalent;
- component relationships and ProductStock semantics remain equivalent;
- financial profile/pricing results remain equivalent;
- Phase 4 production financial/capacity planning remains equivalent for the same source state.

## 20. Existing Phase 1–4 domain contracts remain authoritative

Excel parsing does not create a parallel validation system that contradicts application/domain rules.

Workbook-specific validation handles file/schema/cell parsing. Parsed source objects must still pass the existing authoritative domain/application constraints.

---

# Phase 5 Decomposition

## 5.1 — Persisted Dataset & Workbook Contract Foundation

### 5.1A — Persisted Dataset Source Inventory & Contract Completeness

Purpose:

Reconcile every live authoritative source repository against the persisted dataset contract before workbook implementation.

Required work:

- inventory all authoritative Phase 1–4 source repositories;
- formally classify persisted source vs derived/non-persisted result;
- add `MaterialCalibrationEvidence[]` to the persisted dataset contract;
- define dataset schema-version semantics;
- define defensive cloning/normalization for a complete dataset;
- define controlled completeness errors;
- ensure no existing source repository is silently omitted;
- keep any nonexistent Settings domain out of the contract.

Completion gate:

- one complete source dataset can represent all current business source state;
- calibration evidence is no longer lost by dataset serialization;
- tests cover complete/empty datasets, defensive cloning, and missing-vs-zero semantics;
- no XLSX library/code is introduced yet.

### 5.1B — Workbook Schema, Sheets & Column Contracts

Create the versioned workbook layout independent of a concrete Excel library.

Deliver:

- workbook format ID/version constants;
- `_Meta` contract;
- sheet-name constants;
- ordered column definitions;
- parent/child sheet relationship definitions;
- required/optional cell rules;
- enum/unit/value representation rules;
- literal-text/formula policy;
- deterministic ordering policy;
- workbook schema diagnostics.

Completion gate:

- the full source dataset has an explicit sheet/column destination;
- every sheet/column has a documented semantic owner;
- workbook format can be unit-tested without generating real `.xlsx` bytes.

### 5.1C — Dataset Validation & Cross-Reference Integrity

Create one complete-dataset validation boundary before repository hydration.

Cover:

- per-record domain validation;
- duplicate identity rules;
- all cross-references;
- Product composition graph/cycle integrity;
- missing-vs-zero preservation;
- supported schema-version check;
- deterministic issue paths such as sheet/row/entity/field where available.

Completion gate:

- invalid imported candidate data can be rejected before live-state mutation;
- validation returns controlled structured diagnostics rather than arbitrary parser/service failures.

---

## 5.2 — XLSX Workbook Codec

### 5.2A — XLSX Library Evaluation & Codec Boundary

Perform a bounded implementation spike before selecting the concrete library.

Evaluate:

- maintained/current version;
- license;
- browser/Tauri frontend compatibility;
- read/write support for required primitive types;
- formula-cell visibility/rejection support;
- performance/bundle cost;
- security advisories/history;
- testability from `Uint8Array`/`ArrayBuffer` without native filesystem access.

Create an internal codec boundary so library-specific workbook APIs do not leak into application/domain services.

Completion gate:

- chosen library/adapter decision is documented with rationale;
- basic in-memory workbook encode/decode smoke test passes;
- no Tauri filesystem dependency is introduced.

### 5.2B — Deterministic Dataset-to-XLSX Export

Implement source dataset -> workbook bytes.

Requirements:

- write `_Meta` first;
- write every required source sheet;
- split nested MixPreset/YieldSample arrays into normalized child sheets;
- preserve optional vs zero semantics;
- preserve full numeric source precision;
- preserve ISO timestamp semantics;
- escape/write formula-looking text safely as literal source text;
- deterministic row/column ordering;
- readable headers/column formats without changing source values.

Completion gate:

- complete fixture dataset exports successfully;
- deterministic workbook semantics are tested;
- no derived business outputs are written as authoritative source columns.

### 5.2C — Strict XLSX-to-Dataset Import & Diagnostics

Implement workbook bytes -> candidate dataset.

Requirements:

- validate format metadata/version;
- validate expected sheets/headers;
- parse required/optional primitive cells explicitly;
- reject unsupported formula cells in authoritative source fields;
- reconstruct normalized child rows into nested source arrays;
- reject duplicate/orphan child rows;
- produce structured workbook diagnostics;
- pass the reconstructed candidate through 5.1C validation;
- never mutate live repositories directly.

Completion gate:

- valid exported workbooks import to semantically equivalent datasets;
- malformed workbook cases fail closed with deterministic issues;
- no parser exception leaves partially usable data masquerading as valid.

---

## 5.3 — Repository Snapshot, Hydration & Persistence Coordination

### 5.3A — Complete Source Snapshot Service

Create one application-level operation that reads every authoritative repository and returns one complete persisted dataset.

Requirements:

- include all nine current source repositories;
- no derived service results;
- defensive copies;
- deterministic collection ordering where appropriate;
- dataset schema version applied centrally;
- snapshot does not mutate application state.

Completion gate:

- current live session state can be represented completely without React knowing repository details.

### 5.3B — Validated Atomic Dataset Hydration

Create the application-level load/apply boundary.

Requirements:

- validate complete candidate dataset first;
- apply it as one logical replacement;
- no partially applied import visible after any controlled failure;
- preserve missing-vs-zero semantics;
- service/repository graph remains usable after hydrate;
- rollback or session-replacement strategy tested for unexpected apply failure.

The implementation may choose coordinated repository `replaceAll`, a rebuilt session, or another storage-agnostic technique after repository audit, but user-visible atomicity is mandatory.

Completion gate:

- successful hydrate fully replaces source state;
- failed hydrate leaves previous source state unchanged.

### 5.3C — Persistence Coordinator / Load-Save Lifecycle

Compose:

```text
snapshot service
+ dataset validator
+ workbook codec
+ transport boundary
```

Deliver controlled operations for:

- export/save current dataset;
- parse/import candidate workbook;
- validate before apply;
- apply valid dataset;
- expose persistence status/issues;
- request backup behavior when supported by transport.

Completion gate:

- UI can use one application-level persistence API rather than manipulating workbook or repository internals.

---

## 5.4 — Version Compatibility, Backup & Recovery Safety

### 5.4A — Schema Migration & Compatibility Framework

Implement explicit version handling.

Cover:

- current version;
- supported older-version migration fixture(s);
- future version rejection;
- missing metadata rejection or explicitly documented legacy-detection policy;
- migration result validation under current domain contracts.

Completion gate:

- version behavior is deterministic and tested;
- unsupported files never silently reinterpret columns.

### 5.4B — Backup & Atomic-Write Transport Contract

Define/test storage capabilities needed for safe replacement:

- read existing bytes;
- create timestamped backup/copy where supported;
- stage/write new bytes;
- atomic replace/commit where supported;
- cleanup temporary artifacts after success/failure;
- controlled backup failure policy.

Use an in-memory/fake transport for Phase 5 tests.

Native Tauri filesystem implementation remains Phase 6.

Completion gate:

- destructive save ordering is tested independently of native filesystem APIs;
- browser workflows do not falsely claim native atomic replacement.

### 5.4C — Corruption, Limits & Recovery Diagnostics

Cover:

- truncated/corrupt `.xlsx`;
- missing required sheet/header;
- duplicate headers;
- malformed numbers/booleans/enums;
- formula cells in authoritative source fields;
- orphan child rows;
- invalid references/cycles;
- unsupported versions;
- practical workbook/sheet/row limits;
- backup/restore guidance metadata where applicable.

Completion gate:

- malformed files fail safely;
- previous live state remains intact;
- users receive actionable diagnostic summaries.

---

## 5.5 — Excel Persistence UI

### 5.5A — Import / Open Workbook Workflow

Add a dedicated persistence/data-file UI surface or appropriately scoped application controls.

Browser-compatible Phase 5 flow:

- select `.xlsx` file;
- read bytes;
- parse + validate;
- show validation summary before replacement when appropriate;
- apply valid dataset;
- reload/refresh application views from authoritative hydrated state;
- surface controlled errors without partial import.

Native file dialog/path integration remains Phase 6.

### 5.5B — Export / Save & Backup Workflow

Provide browser-compatible export/download behavior for the authoritative workbook.

Requirements:

- export current complete source state;
- deterministic `.xlsx` filename recommendation;
- explicit backup export option where meaningful;
- visible success/failure state;
- no direct sheet construction in React.

When Phase 6 adds native file access, this UI should call the same persistence coordinator through a native transport rather than duplicate workbook logic.

### 5.5C — Persistence Status, Validation & Recovery UX

Display:

- active workbook/import identity when known;
- dataset/workbook version;
- last successful import/export timestamp in UI state (not authoritative business data);
- validation issue counts/details;
- unsupported-version guidance;
- backup/restore guidance;
- dirty/unsaved-state behavior if introduced by the final persistence coordinator design.

Do not hide source-data failures behind generic “Excel error” messages.

---

## 5.6 — Integration & Completion Gate

### 5.6A — Integrated Excel Round-Trip Workflow

Validate real application-service scenarios through export -> import -> hydrate.

Minimum scenario matrix:

#### Scenario A — Complete Phase 1–4 source round-trip

Include every current authoritative source collection and prove semantic equality after round-trip.

#### Scenario B — Calibration-dependent material

Persist/reload real `cup -> g` calibration evidence and prove the same material costing/normalization result after hydrate.

#### Scenario C — Yield + recipe Product

Persist/reload yield samples, mix preset, fixed recipe items, and Product; prove effective requirements remain equivalent.

#### Scenario D — Nested components and ProductStock

Persist/reload Material-backed and Product-backed components plus explicit ProductStock; prove component cost/capacity behavior remains equivalent.

#### Scenario E — Financial profile missing vs explicit zero

Prove missing financial profile remains missing, while explicit zero labor/overhead remains a configured profile; pricing-policy null remains null.

#### Scenario F — Phase 4 pricing/production equivalence

Export/reload a configured Product and prove unit economics plus planned physical batch financial/capacity results remain equivalent.

#### Scenario G — Invalid workbook leaves state unchanged

Attempt import with invalid reference/schema/row data and prove the previous live source state is untouched.

#### Scenario H — Unsupported future version

Reject without hydration and report the received/expected version.

#### Scenario I — Deterministic export

Equivalent source state produces equivalent workbook schema/row semantics regardless of repository insertion order.

#### Scenario J — Backup/replace failure path

Using fake transport, prove failed staged/backup/replace operations do not report a successful save and preserve recoverable prior bytes according to the transport contract.

### 5.6B — Regression / Build / Phase 5 Completion

Final gate:

- all Phase 1–5 tests green;
- all Phase 1–4 integration suites remain green;
- dedicated Phase 5 round-trip scenarios green;
- browser persistence smoke coverage green;
- TypeScript typecheck green;
- production build green;
- documentation reconciled;
- exact merged `develop` CI green.

Only after that should Phase 5 be marked COMPLETE and Phase 6 become NEXT FOR SCOPE REVIEW / NOT STARTED.

---

# Workbook V1 Source Mapping

This is the planning-level target; exact header spelling is finalized in 5.1B.

## `_Meta`

```text
formatId
workbookFormatVersion
datasetSchemaVersion
exportedAt
applicationVersion?
```

## `Materials`

```text
id
name
group
baseUnit
purchaseQuantity
purchaseUnit
packageCost
manualBaseUnitsPerPurchaseUnit?
onHandQuantity
onHandUnit
source.* optional flattened fields
notes?
isActive
```

## `Calibrations`

```text
id
materialId
measuredVolume
volumeUnit
knownWeight
weightUnit
recordedAt
notes?
```

## `MixPresets`

```text
id
name
basis
compatibleCategories (representation finalized in 5.1B)
notes?
isActive
```

## `MixPresetLines`

```text
presetId
materialId
role
parts
```

## `Products`

```text
id
name
category
mixPresetId?
safetyWasteRate
notes?
isActive
```

## `YieldSamples`

```text
id
productId
mixPresetId?
goodPieces
rejectedPieces
recordedAt
notes?
```

## `YieldSampleInputs`

```text
yieldSampleId
materialId
quantity
unit
```

## `RecipeItems`

```text
id
productId
materialId
quantityPerProduct
unit
role
notes?
```

## `ProductComponents`

```text
id
parentProductId
sourceType
sourceId
role
quantityPerParent
notes?
```

## `ProductStocks`

```text
productId
onHandQuantity
notes?
```

## `ProductFinancialProfiles`

```text
productId
laborCostPerUnit
overheadCostPerUnit
pricingMethod?
pricingValue?
notes?
```

When `pricingPolicy = null`, pricing method/value cells remain absent according to the 5.1B null representation contract.

---

# Validation Layers

The import pipeline must keep these responsibilities distinct.

## Layer 1 — Workbook container validation

Examples:

- is readable `.xlsx` content;
- metadata sheet exists;
- supported format version;
- expected sheets/headers;
- file/sheet/row bounds.

## Layer 2 — Cell/row parsing

Examples:

- required text;
- optional text;
- finite number;
- integer;
- boolean;
- supported enum/unit;
- no unsupported formula cell.

## Layer 3 — Source-record domain validation

Reuse completed domain contracts for Materials, calibrations, MixPresets, Products, YieldSamples, RecipeItems, ProductComponents, ProductStock, ProductFinancialProfiles, and pricing policy.

## Layer 4 — Dataset relationship validation

Examples:

- referenced entity existence;
- duplicate keys;
- graph cycles;
- active/historical relationship rules where authoritative;
- parent/child sheet reconstruction integrity.

## Layer 5 — Atomic hydration

Only a fully valid current dataset reaches live source repositories.

---

# Error/Issue Design Requirements

Phase 5 should use controlled structured persistence diagnostics with enough location information to help users repair spreadsheets.

Conceptual fields may include:

```text
code
message
severity
sheet?
row?
column?
entityType?
entityId?
underlyingCode?
```

Exact types are established by the relevant sub-phase.

Raw XLSX-library exception strings must not become the public application contract.

---

# Testing Strategy

## Contract tests

- dataset completeness;
- clone/reference isolation;
- schema metadata;
- sheet/column definitions;
- validation issue locations.

## Codec tests

- export source primitives;
- nested child-sheet reconstruction;
- optional/null/zero fidelity;
- number precision;
- ISO date string fidelity;
- formula-looking literal text;
- malformed/formula-cell rejection;
- deterministic order.

## Hydration tests

- complete replace;
- no partial state after validation failure;
- rollback/session-replacement behavior for unexpected apply error;
- services continue resolving equivalent results after load.

## Migration/recovery tests

- current version;
- supported older version;
- unsupported future version;
- corrupt workbook;
- limits;
- backup/replace failure.

## UI smoke tests

- import control/path;
- export/download control/path;
- validation feedback;
- successful loaded-state refresh;
- no native Tauri dependency required for Phase 5 browser tests.

## Integration tests

Use the real completed source repositories/services and compare business-derived outcomes before vs after Excel round-trip.

---

# Security & Data-Safety Requirements

- never execute macros;
- never depend on formulas for authoritative business values;
- prevent formula injection on exported free-text fields;
- reject or explicitly control formula cells on import;
- validate all numeric/text/enum input from workbook cells;
- enforce practical parsing limits;
- do not partially hydrate invalid files;
- do not overwrite/replace persistent storage before required validation/backup sequencing succeeds;
- do not silently migrate unknown future versions;
- keep native filesystem permissions/path handling in Phase 6.

---

# Phase 5 Explicit Non-Goals

Phase 5 does not implement:

- native Tauri file dialogs;
- native application-data directories;
- native filesystem path persistence;
- OS-specific atomic rename implementation;
- SQLite persistence;
- cloud sync;
- Google Sheets live API synchronization;
- multi-user concurrent editing;
- database locking;
- stock reservation/deduction/transaction ledger;
- production posting/history;
- tax/VAT/accounting journals;
- arbitrary Excel formula support;
- macros;
- `.xls`/`.xlsm` compatibility guarantee.

These require Phase 6 or separate future planning.

---

# Completion Definition

Phase 5 is complete only when:

1. every authoritative Phase 1–4 source collection is represented by the persisted dataset contract;
2. material calibration evidence round-trips correctly;
3. a versioned workbook schema exists;
4. complete datasets export to deterministic `.xlsx` bytes;
5. supported `.xlsx` workbooks import to validated candidate datasets;
6. invalid workbooks fail without mutating live state;
7. live source state can be snapshotted and atomically replaced through an application boundary;
8. browser-compatible import/export is available without leaking spreadsheet logic into React;
9. version, corruption, formula, and backup/replace failure paths are tested;
10. real Phase 1–4 business-derived results remain equivalent after Excel round-trip;
11. full test/typecheck/build regression is green;
12. exact merged `develop` CI is green;
13. Phase 6 is advanced only to NEXT FOR SCOPE REVIEW / NOT STARTED.

---

# Roadmap

```text
Phase 5 — Excel Persistence                              MASTER PLAN ESTABLISHED

5.1 — Persisted Dataset & Workbook Contract Foundation   NOT STARTED
    5.1A — Source Inventory & Dataset Completeness        NEXT
    5.1B — Workbook Schema / Sheet / Column Contracts     NOT STARTED
    5.1C — Dataset Validation & Reference Integrity       NOT STARTED

5.2 — XLSX Workbook Codec                                 NOT STARTED
    5.2A — XLSX Library Evaluation & Codec Boundary       NOT STARTED
    5.2B — Deterministic Dataset-to-XLSX Export           NOT STARTED
    5.2C — Strict XLSX-to-Dataset Import & Diagnostics    NOT STARTED

5.3 — Snapshot, Hydration & Persistence Coordination      NOT STARTED
    5.3A — Complete Source Snapshot Service               NOT STARTED
    5.3B — Validated Atomic Dataset Hydration              NOT STARTED
    5.3C — Persistence Coordinator / Load-Save Lifecycle  NOT STARTED

5.4 — Version Compatibility, Backup & Recovery Safety     NOT STARTED
    5.4A — Schema Migration & Compatibility Framework     NOT STARTED
    5.4B — Backup & Atomic-Write Transport Contract       NOT STARTED
    5.4C — Corruption, Limits & Recovery Diagnostics      NOT STARTED

5.5 — Excel Persistence UI                                NOT STARTED
    5.5A — Import / Open Workbook Workflow                NOT STARTED
    5.5B — Export / Save & Backup Workflow                NOT STARTED
    5.5C — Persistence Status / Validation / Recovery UX  NOT STARTED

5.6 — Integration & Completion Gate                       NOT STARTED
    5.6A — Integrated Excel Round-Trip Workflow           NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Current next implementation task

**5.1A — Persisted Dataset Source Inventory & Contract Completeness — NEXT / NOT STARTED**

Do not begin 5.1A implementation until this Phase 5 master-plan PR is merged to `develop`, exact post-merge `develop` CI is green, and a dedicated 5.1A development plan has been established before code changes.