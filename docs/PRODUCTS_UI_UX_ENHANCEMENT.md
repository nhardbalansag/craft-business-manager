# Products workspace UI and UX enhancement

The Products page already delegated product, mix, component, and stock rules to application services. Its main usability problems were a cramped catalog table, technical headings, indistinguishable empty/filter states, and no direct route from a catalog item to its composition. Failed catalog reads also surfaced as unhandled errors, and pending saves could be submitted repeatedly.

## Changes

- A catalog-first layout with responsive product cards, category markers, active/archive status, material reserve, mix details, and expandable production notes.
- Category filters, status selection, name/category sorting, and search covering product names, IDs, notes, and mix names. Empty collections and unmatched searches have separate guidance.
- Workshop counts and navigation with descriptive labels and pressed states. Product and mix drafts remain mounted while switching views; product catalog filters are retained.
- Direct composition navigation preserves the selected product. Archived products and mixes can be restored through existing service validation.
- Required product fields, explicit blank-reserve rejection, compatible mix preservation during category changes, focus transfer to editing, and save guards that prevent duplicate submissions.
- Accessible feedback and loading retries across the catalog, component editor, and stock workspace. A completed save is reported separately from a subsequent refresh failure.
- Improved spacing in composition panels and responsive ratio-line controls.

No domain rules, persistence contracts, or application services changed. Archive and activation relationship checks remain authoritative.

## Validation

- 113 test files / 1,327 tests passed, including 15 new Products interaction tests.
- TypeScript and the Vite production build passed.
- Tests exercise creation, editing, searching, filtering, draft retention, composition navigation, archive/restore, relationship guards, duplicate-save prevention, mix editing, and read/write error recovery.
- The existing main-bundle size warning remains (approximately 1,103 kB).
- DOM interaction checks passed. A browser connection was unavailable, so visual verification remains outstanding.
