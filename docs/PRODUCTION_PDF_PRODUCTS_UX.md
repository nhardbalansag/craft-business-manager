# Production PDF and Products improvements

## Production sheets

Batch sheets use A4 portrait with 16 mm left/right margins and 18 mm top/bottom margins on every printed page. The screen preview shows an inset paper layout; print mode removes that screen padding so page margins are applied once. Print guidance explains the browser settings that preserve the layout.

Page footers show the application name and page count. Table headers repeat on continuation pages, longer identifiers wrap, headings stay with their content, and actual-result fields stay with signatures and the planning disclaimer. The Production print panel shows the paper size and margin settings before printing. Thermal-label sizing is unchanged.

## Products workspace

- Cards and Compact layouts share filters, product actions, and selected editor state.
- Category counts reflect the current search and status filter.
- A visible editor status identifies unsaved drafts. Selecting the same product preserves the draft; selecting another product or starting a new one offers Keep editing / Discard changes.
- Catalog fields, filters, and layout survive a visit to Molds & Storage.
- The area switcher separates titles from descriptions and aligns with the workspace at mobile and desktop widths.

## Validation

- Full suite: 153 test files, 1,525 tests passed. New interaction tests cover draft preservation, explicit discard, saved-state feedback, catalog layouts/counts, and switching workshop areas.
- Type checking and production build passed. The pre-existing bundle-size warning remains.
- Rendered two synthetic batch sheets in headless Microsoft Edge: a two-page example and an eight-page stress case with 40 materials, 20 components, and long notes.
- Inspected the rendered PDF pages. Extracted text bounds verified the margins, page numbers, all 60 stress-case row IDs, and the final completion/signature block.
- Passed 20 browser layout checks at 320, 390, 768, and 1280 pixels across catalog layouts, Molds & Storage, Production costs, and the print panel. No page overflow or browser runtime errors.

Browser print settings can override page margins. The verified PDF settings used the CSS page size with browser headers/footers disabled; physical printer drivers and non-Chromium browsers were not tested.
