# Yield & history usability

The workspace keeps Batch evidence on the left and Effective learning on the right at wide desktop widths. Smaller layouts stack the sections. Section shortcuts move keyboard focus and scroll to Batch evidence, Effective learning, or Recorded batches, with clearance for the mobile Menu button.

Recorded batches display five samples per page. Search and outcome filters cover the full history before pagination; changing search, outcome, sort, or product returns to page one. Correction deletion clamps to the last remaining page after the history refresh completes. Recording a batch clears history filters and returns to the newest page.

Preference and correction feedback appears in Recorded batches; restoring automatic selection reports its result in Effective learning. Feedback scrolls into view after refresh. Reusing a saved batch, resetting, and keeping an unsaved draft return focus to Batch evidence. Existing recipe-source provenance, draft protection, and correction safeguards remain in place.

Validation: regression tests cover paging, search/outcome/sort resets, delayed refresh after last-page deletion, contextual feedback, section shortcuts, and copied-draft focus. Browser checks use eleven samples at 320, 390, 768, 1024, 1280, and 1440 pixels, including mobile copy/preference actions and horizontal-overflow checks.
