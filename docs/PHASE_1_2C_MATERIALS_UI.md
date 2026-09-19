# Phase 1.2C — Materials UI

## Status

**FEATURE CI PASSED — MERGE / POST-MERGE GATE**

Branch: `feature/phase-1-2c-materials-ui`

Base: `develop`

PR: `#9`

## Objective

Deliver the first visible, usable material-management screen on top of the Phase 1.2A material contract and Phase 1.2B application service.

## User-facing features

The Materials workspace now provides:

- Add Material form
- Edit Material workflow
- stable/non-editable material ID during edit
- material group selector
- canonical base-unit selector
- purchase quantity and unit inputs
- package cost input
- conditional manual-conversion input for package labels
- on-hand quantity and unit inputs
- notes
- active material list
- search by material ID, name, or notes
- filter by material group
- filter by active / archived / all status
- archive/deactivate action
- inline success/error feedback
- responsive desktop/mobile layout

## Measurement behavior

The UI only offers standard measurement units compatible with the selected canonical base dimension.

```text
base g  -> g, kg, oz, lb + package labels
base mL -> mL, L, cup, tbsp, tsp, fl-oz + package labels
base pc -> pc + package labels
```

Changing the base unit resets purchase/on-hand standard units to a compatible default and clears any previous manual package conversion.

Package labels such as `bag`, `box`, `pack`, or `bottle` remain source inputs. Phase 1.3 will enforce effective-conversion and costing rules.

## Application-service boundary

```text
MaterialsPage
    ↓
MaterialService
    ↓
MaterialRepository
```

The React screen does not directly mutate a dataset, does not duplicate identity rules, and does not read/write spreadsheet cells.

## Persistence limitation

The screen clearly displays **Session-only storage**. The current implementation uses `InMemoryMaterialRepository`; data is not yet written to Excel or SQLite and will not survive a full application reload/restart.

No fake inventory records are seeded.

## Archive behavior

- archive is soft delete
- archived records remain available through Archived/All filters
- IDs remain reserved
- editing an archived material preserves its archived state
- editing does not silently reactivate records

## Feature validation evidence

PR `#9` feature-head CI passed:

- dependency installation
- TypeScript typecheck
- existing domain/application automated tests
- production build

## Remaining completion gate

- merge PR `#9` into `develop`
- confirm post-merge `develop` CI passes

When this gate passes, **Phase 1.2 — Material Master Domain is complete**.

## Out of scope

- Excel save/load
- package conversion calculations
- cost per base unit
- normalized on-hand quantity
- inventory valuation
- cup-to-weight calibration
- supplier/source metadata
- product recipes

Next task after completion: **Phase 1.3A — Package Cost / Base-Unit Costing**.
