# Responsive workspaces

All application sections now adapt to phones, tablets, and desktop screens. Shared rules live in `src/responsive.css`, loaded after the existing workspace styles.

## Assessment and changes

| Area | Improvement |
| --- | --- |
| Navigation | All six sections remain visible in a three-column phone menu. The taller header scrolls with the document; active sections are announced with `aria-current`. |
| Materials | Inventory becomes labeled cards; supplier details, conversions, stock values, and actions remain available. Editor sections fit narrow screens. |
| Products | Mix tables become cards. Catalog controls, component trees, and finished-stock cards wrap safely, including long stock notes. |
| Production | Direct-material and component requirements become cards, including optional calculation columns. Quantity controls, cost details, readiness, and financial summaries adapt to smaller screens. |
| Calibration | History uses the shared card layout. Long evidence notes no longer expand the page on tablets or desktop. |
| Yield | Quantity fields occupy the correct grid column between 521 and 760 pixels. History, material inputs, and learning summaries fit narrow screens. |
| Pricing | Expanded cost details, nested traces, and summary values wrap within the workspace. |
| Workbook tools | Tools expand within the page on phones. Long filenames, selected files, import recovery, session status, and export controls stay accessible. Close and Escape restore focus to the trigger. |

Buttons and summaries have 44-pixel minimum touch targets on phone layouts and devices with coarse pointers. Form controls use 16-pixel text for those devices. Tables retain explicit table, row, and cell semantics and column headers; mobile labels use the same rows and actions as desktop. Tablet and desktop tables retain local horizontal scrolling where needed.

## Validation

- `npm run test:run`: 135 files, 1,458 tests passed, including new workbook dismissal/focus and active-navigation tests.
- `npm run build`: passed; the existing large JavaScript chunk warning remains.
- Isolated headless Microsoft Edge checks at 320, 390, 760, 768, 1024, and 1440 pixels, including a 760 × 390 landscape viewport.
- 102 layout/state checks covered populated workspaces, all Products subviews, Production calculations and costs, expanded material/pricing details, long supplier and stock notes, workbook rejection with a long filename, and all six empty states at 320 pixels.
- No document-level horizontal overflow or browser runtime errors. All 42 rendered table instances had cell labels; phone tables used the card layout.

The browser checks used synthetic in-memory data in a separate test browser. Physical iOS/Android devices and VoiceOver were not tested. For a device smoke test, open each navigation section, edit a record, expand details, rotate the screen, and open/close workbook tools; verify that the keyboard, controls, and field labels stay usable.
