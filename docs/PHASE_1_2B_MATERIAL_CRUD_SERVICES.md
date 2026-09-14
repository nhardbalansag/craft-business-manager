# Phase 1.2B — Material Application CRUD Services

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-2b-material-crud-services`

Base: `develop`

## Objective

Make the Phase 1.2A material contract operational through application services without coupling React components or future Excel persistence directly to business rules.

## Architecture

```text
React UI (Phase 1.2C)
        ↓
MaterialService
        ↓
MaterialRepository
        ├── InMemoryMaterialRepository (current/test/pre-persistence use)
        ├── Excel-backed repository (future Phase 5 integration)
        └── SQLite-backed repository (future migration option)
```

The service layer does not know workbook sheet names, cell coordinates, filesystem paths, or Tauri APIs.

## Material operations

`MaterialService` supports:

- create material
- update material
- retrieve material by ID
- list all materials
- filter by material group
- filter active/inactive materials
- search by ID, name, or notes
- archive/deactivate material

Hard delete is intentionally not part of the material application API. Archiving preserves historical references and lets future product recipes continue pointing to the same stable material identity.

## Identity policy

Material identity follows these rules:

- material IDs are stable
- IDs are unique case-insensitively
- names are unique case-insensitively
- archived records still reserve their ID and name
- leading/trailing whitespace in ID/name is normalized before persistence
- updates cannot change the material ID

Examples:

```text
MAT-PLASTER
mat-plaster
 Mat-Plaster 
```

are treated as the same material ID for duplicate detection/retrieval.

Likewise:

```text
Plaster of Paris
plaster OF paris
```

are treated as the same name for uniqueness checks.

## Validation boundary

`MaterialService` calls the Phase 1.2A `validateMaterialContract()` before creating or updating data.

Therefore the application layer cannot silently persist:

- missing material identity
- unsupported material groups
- unsupported purchase/on-hand units
- incompatible standard unit dimensions

Numeric costing and stock rules remain intentionally deferred to Phase 1.3.

## Controlled application errors

The service exposes controlled errors for:

- `MATERIAL_NOT_FOUND`
- `DUPLICATE_MATERIAL_ID`
- `DUPLICATE_MATERIAL_NAME`

Domain contract errors from Phase 1.2A remain separate from these application/workflow errors.

## Listing behavior

Materials are returned alphabetically by name, then ID.

Optional filters:

```text
group
active
query
```

Search is case-insensitive across:

- material ID
- material name
- notes

## Repository boundary

`MaterialRepository` exposes only the minimum persistence operations needed by the application service:

```text
list()
findById()
insert()
replace()
```

The included `InMemoryMaterialRepository` provides deterministic pre-persistence behavior and automated-test support. It returns copies of stored material records so external mutation does not silently modify repository state.

## Automated coverage

Tests cover:

- valid create
- identity whitespace normalization
- case-insensitive retrieval
- duplicate ID rejection
- duplicate name rejection
- duplicates against archived records
- domain validation before persistence
- valid update while preserving stable ID
- duplicate-name prevention during update
- controlled not-found behavior
- null retrieval for missing records
- alphabetical listing
- group filter
- active/inactive filter
- ID/name/notes search
- archive behavior
- idempotent archive behavior
- protection against external object mutation

## Out of scope

- React Materials UI
- numeric package-cost validation
- effective conversion calculation
- normalized inventory
- inventory valuation
- material calibration
- supplier/source metadata
- Excel persistence

## Completion gate

Phase 1.2B is complete only after:

- TypeScript typecheck passes
- application/domain tests pass
- production build passes
- feature PR CI passes
- PR merges into `develop`
- post-merge `develop` CI passes

Next task after completion: **1.2C — Materials UI**.
