# Phase 1.5B — Materials UI Integration

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-5b-materials-source-ui`

Base: `develop`

## Objective

Expose the Phase 1.5A supplier/source contract directly in the existing Materials workflow so a material can remember where it was purchased and how to buy it again.

Supplier/source metadata remains optional and informational. It must not influence costing, calibration, stock normalization, or inventory valuation.

## Materials form integration

The Materials form now has a dedicated **Supplier / source** section with:

- vendor / supplier name
- source / branch / marketplace / platform
- purchase / re-order link
- contact number
- social page / handle
- source-specific buying notes

Material notes remain a separate field so supplier instructions are not mixed with intrinsic material details.

All supplier/source fields are optional. When every source field is blank, `MaterialService` normalizes the nested source object away instead of persisting an empty object.

## Edit workflow

Existing material source data is loaded back into the form during Edit.

Saving an edit passes the source metadata through the existing MaterialService normalization/validation boundary, including:

- whitespace trimming
- blank-field removal
- valid `http`/`https` purchase-link enforcement
- nested source clone safety

## Material list integration

The Materials table now includes a **Source** column.

When source metadata exists it can display:

- vendor name
- branch/platform/source detail
- contact number
- social page/handle
- direct **Re-order** link when a purchase URL exists

When no source metadata exists the table explicitly displays `Not recorded`.

## Search integration

The existing MaterialService source-aware search from Phase 1.5A is exposed through the Materials search box.

A user can search by material identity as before, and now also by supplier/source values such as vendor, branch/platform, contact, social page, purchase link, or source notes.

## Costing isolation

No supplier/source field is passed into any financial formula.

These calculations remain unchanged:

```text
package base quantity
cost per base unit
normalized on-hand quantity
inventory value
material calibration
```

Changing a vendor name, phone number, social handle, or purchase link cannot alter any costing result.

## Persistence boundary

Supplier/source metadata remains session-scoped together with Materials and Calibration records.

Excel persistence remains Phase 5.

## Validation coverage

Phase 1.5B relies on the Phase 1.5A domain/application regression tests for source normalization, validation, source-aware search, persistence behavior, and nested mutation isolation.

The UI completion gate additionally requires:

- TypeScript typecheck passes
- all automated regression tests pass
- production React build passes
- feature PR CI passes
- PR merges into `develop`
- post-merge `develop` CI passes

## Completion result

After this task passes all gates, **Phase 1.5 — Supplier & Source Metadata** is complete.

Next active task: **1.6A — Integrated Materials Workflow**.
