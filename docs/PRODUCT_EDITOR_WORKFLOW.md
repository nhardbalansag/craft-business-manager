# Product add and edit workflow

The product form now groups identity, production setup, and optional notes into three sections. Responsive fields, explicit ID guidance, and a material-reserve example make the setup easier to review before saving.

The Products page owns the editor's open state and current product. A canceled product switch no longer changes the heading to the rejected destination. Returning to the catalog preserves the draft and offers a Resume draft action, with focus restored when opening and closing the editor.

Inline validation identifies missing or duplicate identities, invalid reserve percentages, and unavailable mix references. The first invalid field receives focus on submission. Fractional reserve values such as 7.25% can be entered without a native step mismatch. Changing category explains when an incompatible mix is cleared.

After creating a product, its saved details remain open for review or further editing. Both create and update use the normalized service result, preventing whitespace normalization from falsely marking a saved product as unsaved. Failed saves retain the draft for retry.

Validation covers create/edit, accepted and canceled switches, resuming new drafts, duplicate IDs, fractional reserves, normalized saves, mix changes, and service failure recovery. Isolated Edge browser checks passed at 320, 390, 520, 760, 1024, and 1440px with no horizontal overflow and form controls at least 44px in each dimension. Mobile and desktop screenshots were visually reviewed; no runtime errors were reported.

Full checks: 155 test files / 1,542 tests passed; TypeScript and the production build passed. Vite still reports the existing large-bundle advisory.
