# Phase 5 — Excel Persistence Progress

Status: **MASTER PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Planning baseline: `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Authoritative planning base:

`develop` @ `1d9d93c265fcadd01c3f16318bfcf7c079a432a1`

Starting exact `develop` CI:

`34982462060 — SUCCESS`

```text
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

## Locked Phase 5 planning decisions

- `.xlsx` is the authoritative Phase 5 workbook format; legacy `.xls`, macro-enabled `.xlsm`, and CSV are not complete database formats for v1.
- Persist authoritative source evidence only; derived costing, yield-learning, capacity, pricing, revenue, and profit outputs are recalculated.
- The persisted dataset must cover every live authoritative source repository.
- `MaterialCalibrationEvidence[]` is currently missing from `BusinessDataset` and must be added before authoritative workbook encoding begins.
- Dataset schema version and workbook-format/layout version are distinct version concepts.
- Use normalized workbook sheets; do not hide nested arrays as JSON blobs in cells.
- Planned workbook source sheets are `_Meta`, `Materials`, `Calibrations`, `MixPresets`, `MixPresetLines`, `Products`, `YieldSamples`, `YieldSampleInputs`, `RecipeItems`, `ProductComponents`, `ProductStocks`, and `ProductFinancialProfiles`.
- Do not invent a `Settings` sheet until the application has a real authoritative Settings source contract.
- Free-text is literal data; spreadsheet formulas/macros are not authoritative business logic.
- Formula-looking text must export safely as text, and unsupported formula cells in authoritative input fields must fail closed.
- Import validates the entire candidate dataset before any live repository mutation.
- Failed import must leave current live state unchanged.
- Cross-reference, duplicate-identity, and Product composition-cycle validation are required before hydration.
- Missing source evidence remains different from explicit zero after round-trip.
- Numeric source precision is not silently rounded for display.
- Source timestamps preserve deterministic ISO semantics.
- Workbook parsing must be controlled and resource-bounded.
- Export row/column ordering must be deterministic.
- XLSX codec and storage transport are separate boundaries.
- React must use an application persistence coordinator rather than reading/writing spreadsheet cells or repositories directly.
- Snapshot/hydration operates over the complete source dataset, not individual ad hoc sheets.
- Backup/atomic-replacement sequencing belongs behind the persistence/transport boundary.
- Phase 5 tests backup/atomic semantics with an abstract/fake transport; concrete native Tauri filesystem behavior remains Phase 6.
- Browser-compatible import/export/download is Phase 5; native path/file-dialog behavior is Phase 6.
- Version migrations are explicit; unsupported future versions fail closed.
- Round-trip validation must prove Phase 1–4 service-derived behavior remains equivalent after restore.
- The concrete XLSX library is deliberately not locked by the master plan; 5.2A must assess maintenance, license, security, browser/Tauri compatibility, formula handling, bundle size, and testability before selection.

## Planning discovery evidence

Current storage port:

```text
load() -> BusinessDataset
save(BusinessDataset)
optional createBackup(BusinessDataset)
```

Current Excel adapter:

```text
ExcelStorage.load/save are placeholders and intentionally throw.
```

Current authoritative source repositories:

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

Current `BusinessDataset` covers all of the above **except CalibrationRepository evidence**.

No `.xlsx` codec dependency is currently installed.

## Current active task

**5.1A — Persisted Dataset Source Inventory & Contract Completeness — NEXT / NOT STARTED**

Do not begin 5.1A implementation until:

1. this Phase 5 master-plan documentation is merged to `develop`;
2. exact post-merge `develop` CI is green;
3. a dedicated 5.1A scope review/development plan is established before code changes.
