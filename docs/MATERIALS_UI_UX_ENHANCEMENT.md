# Materials workspace UI and UX enhancement

The Materials page already derives purchase costing, stock normalization, and valuation through the domain layer. Its long editor crowded the inventory table, while changing filters triggered asynchronous catalog reads on every keystroke. Initial load failures had no recovery state, archive had no restore action, and blank numeric fields could become zero during preview conversion.

## Updated workflow

- Separate Inventory and Material editor views preserve drafts and filters while browsing within Materials.
- Inventory shows normalized stock, unit cost, stock value, suppliers, re-order links, and expandable conversion/contact details.
- Search covers identity, group, supplier, contact, and notes. Group/status/stock filters and value sorting run locally over one catalog snapshot.
- Active inventory summaries remain independent of table filters. Unresolved valuations are excluded from a visibly labeled known subtotal.
- The editor leads with a live cost/stock/value preview. Conversion evidence and optional supplier details expand on demand.
- Purchase-unit changes clear unit-specific manual factors. Blank required quantities and costs stay distinct from explicit zero; existing calibration precedence remains authoritative.
- Save guards prevent duplicate requests and edits during writes. Failures retain the draft and focus the error; successful saves return focus to inventory. Load retries and archive restoration use existing services.
- Revision checks ignore late catalog reads. Existing workbook-import regression assertions now target import feedback specifically, so inventory status announcements do not interfere with them.

Domain formulas, persistence contracts, and material relationship guards remain unchanged. No new dependencies were added.

## Validation

Fifteen new React interaction tests cover creation, local filtering, sorting, draft retention, package-unit edits, cup calibration, zero versus blank input, archive/restore, relationship guards, duplicate saves, load/write recovery, late reads, keyboard focus, and incomplete valuations. The full regression suite passed: **119 test files / 1,387 tests**. TypeScript and the Vite production build passed.

Browser connection was unavailable; DOM interaction checks were used. Visual verification in a browser remains outstanding. The existing main-bundle size warning remains.
