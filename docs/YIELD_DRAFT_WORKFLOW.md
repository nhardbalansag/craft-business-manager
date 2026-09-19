# Yield draft workflow improvements

The Yield workspace now protects an edited batch before switching products, resetting the form, or copying another historical batch. Users can keep editing or explicitly discard the draft. Keyboard focus moves to the warning and returns to the Sample ID when editing resumes.

Saving and correction deletion lock conflicting actions until completion. Failed saves preserve the entered evidence for retry. History requests ignore outdated responses after a product switch, and the summary shows a loading state while the selected product's evidence is being read.

Draft readiness checks dates, active material references, compatible units, mix availability, and whole-piece counts. Invalid counts do not produce misleading percentage previews. Copied unavailable references remain visible so users can replace them.

Material rows have visible labels and more space for quantity and unit entry. History filters adapt to narrow widths, including when the clear-filters button is visible.

## Validation

- Full Vitest suite: 154 files, 1,534 tests passed.
- Production build and TypeScript check passed; Vite retains its large-bundle advisory.
- Isolated Edge browser checks at 320, 390, 520, 760, 1024, 1280, and 1440px: no horizontal overflow; material controls at least 44px in each dimension.
- Browser checks covered batch reuse, keeping an unsaved draft, saving, and switching products. No runtime errors were reported. Mobile and desktop screenshots were visually reviewed.
- Regression tests cover stale history responses, duplicate saves, draft replacement protection, failed-save retry, unavailable copied materials, and invalid draft previews.
