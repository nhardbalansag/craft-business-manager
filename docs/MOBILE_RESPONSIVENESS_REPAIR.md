# Mobile responsiveness repair

The sidebar styling had reintroduced a desktop content offset on phones and inherited a three-column navigation grid. The content now uses the full phone width, navigation stays in one column, and the drawer scrolls on short landscape screens. Closed mobile navigation is hidden from keyboard focus. Closing Workbook tools returns focus to the visible Menu button.

Workspace grids now respond to the width available beside the sidebar. Components, finished stock, calibration, pricing, molds/storage, and Yield can stack before their columns become cramped. Yield retains separate input and learning sections when stacked and its two-column layout when space allows.

Other corrections:

- Keep hidden table labels inside their scroll container so Calibration does not expand the document.
- Wrap long storage names and dialog headings.
- Keep label checkboxes compact with full-height tappable labels.
- Use readable touch-input text across workspaces, including physical identification and dialogs.
- Reserve space for touch-sized clear buttons in Yield and Production search inputs.
- Fit label dialogs to the dynamic viewport and honor reduced motion in navigation and workbook transitions.

Validation uses an isolated Edge browser with synthetic workshop data, including long supplier and storage names. Coverage includes Materials and its editor, Calibration, Products and its editor, mixes, components, finished stock, molds/storage, label dialogs, Yield and Production search, all Production views, Pricing details, Workbook import/recovery, navigation, and empty states. Widths range from 320 to 1440px, including 760px landscape and both sides of the sidebar breakpoint. Browser checks cover document overflow, control sizes and text, navigation, and dialog interactions; mobile screenshots were visually reviewed.

All 134 core-workspace checks and 99 extended checks passed with no overflow/control-size failures or runtime errors. A further 18 checks verified the final label-control adjustments. The full suite passed: 159 files and 1,559 tests. TypeScript and the production build passed, with the existing Vite bundle-size advisory.
