# Yield Recipe Source — YRS6 Integrated Regression & Completion Gate

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE
YRS3 — Yield Recipe Source UI                         COMPLETE
YRS4 — Mold Formula Draft Integration Refactor        COMPLETE
YRS5 — Yield History Provenance UI                    COMPLETE
YRS6 — Integrated Regression & Completion Gate        COMPLETE IN THIS CHANGE
```

Verified YRS6 base:

```text
develop  9acc7b517be309fde80fa8415fd384aaa76f6bf3
CI       36597917929 — SUCCESS
YRS5     COMPLETE / MERGED
```

## Purpose

YRS6 does not introduce another recipe-source feature.

It closes the Yield Recipe Source enhancement by:

1. proving the three source modes together through the shared application
   recording boundary;
2. proving the same saved graph survives physical-v5 workbook export/import;
3. proving learned Yield requirements remain based on actual measured evidence;
4. auditing every original YRS0 compatibility decision against implemented
   regression coverage;
5. advancing the project back to the previously deferred Phase 6 sequence only
   after merge and exact post-merge `develop` CI are green.

## Integrated Runtime Regression

The YRS6 completion test records three real Yield Samples through the shared:

```ts
yieldRecipeSourceRecordingService
```

using:

```text
Manual
Mix preset
Mold formula
```

with identical measured Material evidence.

It verifies the persisted source graph is:

```text
Manual
  YieldSample.mixPresetId        absent
  YieldMoldFormulaSource         absent

Mix preset
  YieldSample.mixPresetId        MIX-YRS6
  YieldMoldFormulaSource         absent

Mold formula
  YieldSample.mixPresetId        absent
  YieldMoldFormulaSource         exactly one
```

The Formula sample remains an ordinary `YieldSample` containing actual batch
evidence. It does not gain persisted fields for:

- recipe-source discriminator;
- planned pieces;
- theoretical Water;
- theoretical Plaster;
- theoretical Glue;
- required pours.

## Learning Compatibility

All three completion-gate samples intentionally contain the same actual
evidence:

```text
Plaster consumed   100 g
Good pieces        4
Rejected pieces    1
```

YRS6 verifies all three derive:

```text
25 g / good piece
20% defect rate
```

regardless of recipe-source provenance.

This proves the final integrated runtime preserves the original rule:

```text
Recipe-source provenance
        ≠
Yield-learning quantity authority
```

Actual measured Yield evidence remains authoritative.

## Persistence Round Trip

The integrated source graph is snapshotted through:

```text
PhysicalSourceSnapshotServiceV5
```

then exported through the shared:

```text
PersistenceCoordinator
```

The resulting physical workbook includes the canonical:

```text
YieldMoldFormulaSources
-----------------------
yieldSampleId
moldId
moldYieldProfileId
```

and no theoretical Formula-result columns.

The live repositories are then cleared and the workbook is imported/hydrated
again through the same coordinator.

YRS6 verifies after hydration:

- the complete physical-v5 snapshot equals the pre-export snapshot;
- Manual still resolves Manual;
- Mix preset still resolves the exact saved Mix preset;
- Mold formula still resolves the exact saved Mold/profile provenance;
- derived Yield learning remains identical.

## YRS0 Completion Matrix

| Original YRS0 decision | Final state | Primary regression evidence |
| --- | --- | --- |
| Existing `YieldSample` contract preserved | PASS | `src/domain/yieldSamples.ts`; YRS6 completion regression |
| Existing MixPreset Yield samples remain compatible | PASS | YRS2B recorder tests; YRS5A/YRS5C history regressions; YRS6 |
| Legacy no-preset samples resolve Manual | PASS | YRS1A resolver tests; YRS5C history regression |
| Mold Formula provenance becomes explicit | PASS | YRS1B/YRS1C; YRS2A/YRS2B; YRS6 |
| MixPreset + Mold Formula simultaneous source forbidden | PASS | `yieldRecipeSource.test.ts`; `YieldRecipeSourceRecordingService.test.ts` |
| Formula outputs remain derived | PASS | YRS4B; YRS6 persisted-shape assertions |
| Actual Yield measurements remain authoritative | PASS | YRS4C confirmation regressions; YRS6 learning assertions |
| Core workbook version bump not required | PASS | YRS2D/YRS2E compatibility and migration regressions |
| Physical workbook v5 required for Formula provenance | PASS | YRS2C/YRS2D/YRS2E; YRS6 workbook round trip |
| Google Sheets remains shared-XLSX compatibility path | PASS | `YieldRecipeSourcePersistenceV5.test.ts` |
| Atomic Yield + provenance recording required | PASS | `YieldRecipeSourceRecordingService.test.ts` |
| MY6 actual-measurement confirmation retained | PASS | YRS4C / `YieldPage.my6.test.tsx` |
| Yield learning / Production mathematics unchanged | PASS | YRS6 learning equivalence plus existing Production regression suite |

## Cross-Phase Coverage Inventory

### Domain

Covered by:

- `src/domain/yieldRecipeSource.test.ts`;
- `src/domain/yieldMoldFormulaSource.test.ts`;
- `src/domain/yieldMoldFormulaSourceValidation.test.ts`;
- `src/domain/physicalBusinessDatasetV5.test.ts`.

### Application / Recording

Covered by:

- `src/application/yieldMoldFormulaSources/YieldMoldFormulaSourceService.test.ts`;
- `src/application/yieldRecipeSources/YieldRecipeSourceRecordingService.test.ts`;
- `src/application/yieldRecipeSources/YieldRecipeSourceRecordingServiceSession.test.ts`;
- `src/application/yieldRecipeSources/YieldRecipeSourceCompletionGate.test.ts`.

### Persistence

Covered by:

- `src/storage/physicalBusinessDatasetV5Workbook.test.ts`;
- `src/application/persistence/YieldRecipeSourcePersistenceV5.test.ts`;
- existing PersistenceCoordinator compatibility/completion suites.

### Yield UI

Covered by:

- `src/ui/yield/YieldRecipeSourceSelector.test.tsx`;
- YRS3 source-mode tests;
- `src/ui/yield/YieldPage.my6.test.tsx`;
- `src/ui/yield/YieldPage.yrs5a.test.tsx`;
- `src/ui/yield/YieldPage.yrs5b.test.tsx`;
- `src/ui/yield/YieldPage.yrs5c.test.tsx`.

## Final Functional Contract

After YRS6 the supported Yield workflow is:

```text
Choose Product
    ↓
Choose Recipe source
    ├─ Manual
    ├─ Mix preset
    └─ Mold formula
          ↓
       Formula setup
       Planned pieces
       Theoretical preview
       Use as Yield Sample Draft
       Verify actual Materials
       Actual measurement confirmation
    ↓
Enter / verify actual batch evidence
    ↓
Record Yield Sample
    ↓
Resolve persisted source provenance
    ↓
Yield History source labels / traceability
    ↓
Yield learning continues from actual measured evidence
```

## Persistence Contract

Final authoritative persistence remains:

```text
YieldSample
  actual measured evidence
  optional MixPreset ID for Mix preset source

YieldMoldFormulaSource
  yieldSampleId
  moldId
  moldYieldProfileId
```

The following remain derived and are not persisted as Yield evidence:

- planned pieces;
- Formula Water/Plaster/Glue estimates;
- total mixture;
- required pours;
- produced capacity;
- Formula cost;
- Product safety waste calculations.

## Completion Decision

YRS is complete when this change is merged and the exact resulting `develop`
commit passes:

```text
dependency install
typecheck
full test suite
production build
```

No YRS phase remains after YRS6.

## Next Exact Task After YRS Completion

The project returns to the previously deferred desktop sequence:

```text
Phase 6.1A — Tauri v2 Project Scaffold & Dev/Build Scripts
NEXT / NOT STARTED
```

Do not begin Phase 6.1A automatically. Start it only as a separate user-directed
task after YRS6 is merged and exact post-merge `develop` CI is green.
