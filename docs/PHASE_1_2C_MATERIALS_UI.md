# Phase 1.2C — Materials UI

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-2c-materials-ui`

Base: `develop`

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

Examples:

```text
base g  -> g, kg, oz, lb + package labels
base mL -> mL, L, cup, tbsp, tsp, fl-oz + package labels
base pc -> pc + package labels
```

Changing the base unit resets purchase/on-hand standard units to a compatible default and clears any previous manual package conversion.

Package labels such as `bag`, `box`, `pack`, or `bottle` remain source inputs. Phase 1.3 will enforce effective-conversion and costing rules.

## Application-service boundary

The React screen does not directly mutate a dataset and does not own duplicate or contract rules.

```text
MaterialsPage
    ↓
MaterialService
    ↓
MaterialRepository
```

The current screen uses `InMemoryMaterialRepository` only because Excel persistence is intentionally scheduled later.

## Persistence limitation

The UI clearly displays **Session-only storage**.

Material data survives React rerenders within the running application module, but it is not yet written to an Excel workbook or SQLite database and will not survive a full application reload/restart.

No fake inventory records are seeded.

## Archive behavior

Archiving is soft-delete behavior:

- active material becomes inactive
- record remains queryable through the Archived/All filters
- material ID remains reserved
- editing an archived material preserves its archived state
- edit does not silently reactivate a record

Hard delete and restore/reactivate controls are intentionally not introduced here.

## Out of scope

- Excel save/load
- package conversion calculations
- cost per base unit
- normalized on-hand quantity
- inventory valuation
- cup-to-weight calibration
- supplier/source metadata
- product recipes

## Completion gate

Phase 1.2C is complete only after:

- TypeScript typecheck passes
- existing domain/application tests pass
- production build passes
- feature PR CI passes
- PR merges into `develop`
- post-merge `develop` CI passes

When complete, **Phase 1.2 — Material Master Domain** is complete.

Next task: **Phase 1.3A — Package Cost / Base-Unit Costing**.
