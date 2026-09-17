# Separate batch input and saved learning

Yield now places Batch evidence in a dedicated left column and Effective learning with recorded history in a dedicated right column on screens wider than 1040px. Both columns have semantic section headings and explanations distinguishing unsaved batch input from saved results. Warm input accents, green learning accents, and a vertical divider reinforce the separation.

The batch form uses normal document scrolling instead of a constrained internal scrollbar. On smaller screens, input comes first and saved results follow under a separate heading and divider.

Validation: 13 Yield workflow tests passed; TypeScript and production build passed. Isolated Edge checks at 320, 390, 520, 760, 1024, 1280, and 1440px verified column separation, aligned desktop cards, stacked mobile sections, no horizontal overflow, no internal form scrolling, and material controls at least 44px in each dimension. Draft reuse, cancellation, saving, and product switching passed without runtime errors. Desktop layout was visually reviewed. Vite retains the existing bundle-size advisory.
