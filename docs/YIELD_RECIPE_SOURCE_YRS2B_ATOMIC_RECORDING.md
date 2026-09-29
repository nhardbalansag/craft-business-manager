# Yield Recipe Source — YRS2B Atomic Yield + Provenance Recording

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE

YRS2 — Repository / Recording / Persistence           IN PROGRESS
    YRS2A — Provenance Repository + Application Service  COMPLETE
    YRS2B — Atomic Yield + Provenance Recording        COMPLETE
    YRS2C — PhysicalBusinessDatasetV5                  NEXT / NOT STARTED
    YRS2D — Physical Workbook v5 + v4→v5 Migration    NOT STARTED
    YRS2E — Snapshot / Hydration / Google Sheets Compatibility
                                                        NOT STARTED
```

Verified YRS2B base:

```text
develop  f45ba3e53fa94bb6092bdddf306de45d17ac706a
CI       36560594561 — SUCCESS
YRS2A    COMPLETE
```

## Purpose

YRS2B adds one source-aware recording boundary that can persist a real Yield Sample together with its selected Recipe source without leaving partial state.

The existing direct `YieldSampleEvidenceService.recordSample(...)` path remains available for backward compatibility until the Yield UI is refactored in YRS3/YRS4.

## Recording Input

The new coordinator accepts:

```ts
YieldRecipeSourceRecordingInput {
  sample: Omit<YieldSample, 'mixPresetId'>;
  source:
    | { kind: 'manual' }
    | {
        kind: 'mix-preset';
        mixPresetId: string;
      }
    | {
        kind: 'mold-formula';
        moldId: string;
        moldYieldProfileId: string;
      };
}
```

Recipe source is therefore authoritative at the recording boundary.

## Source Mapping

### Manual

```text
source.kind = manual
        ↓
YieldSample.mixPresetId absent
Mold Formula provenance absent
```

### Mix preset

```text
source.kind = mix-preset
        ↓
YieldSample.mixPresetId = selected MixPreset
Mold Formula provenance absent
```

### Mold formula

```text
source.kind = mold-formula
        ↓
YieldSample.mixPresetId absent
YieldMoldFormulaSource created
```

This prevents a new coordinated recording operation from claiming two source kinds simultaneously.

## Defensive Source Exclusivity

Even though the TypeScript input omits `mixPresetId` from the sample payload, YRS2B also strips any stray runtime `mixPresetId` for:

- Manual;
- Mold formula.

For Mix preset mode, the selected source ID is the only MixPreset provenance accepted.

Blank Mix preset selection is rejected before any write.

If corrupted/orphan Mold Formula provenance already reserves the same Yield Sample ID, Manual/Mix-preset recording fails closed with:

```text
EXISTING_MOLD_FORMULA_SOURCE
```

This prevents a retry from silently inheriting a different recipe source after a prior rollback failure.

## Two-Stage Preflight

Before repository mutation:

### Yield evidence preflight

```text
YieldSampleEvidenceService.prepareSampleForRecording(...)
```

performs the same normalization, intrinsic validation, duplicate-ID check, Product/MixPreset/Material reference checks, active-state checks, category checks, and unit checks used by normal Yield recording.

No Yield record is inserted.

### Mold Formula provenance preflight

For Mold Formula source only:

```text
YieldMoldFormulaSourceService
  .prepareSourceForPendingYieldSample(...)
```

validates provenance against the pending Yield Sample even though that Yield Sample is not yet persisted.

The preflight:

- checks duplicate provenance identity;
- canonicalizes Mold/profile IDs;
- validates the proposed full source collection in historical mode;
- validates the new source in recording mode.

No provenance record is inserted.

## Apply Order

After both preflights pass:

```text
1. insert YieldSample
2. insert YieldMoldFormulaSource (Mold formula only)
```

The dependency order guarantees provenance never intentionally precedes its Yield evidence.

## Compensating Rollback

If either write operation throws, YRS2B attempts to remove both newly reserved identities:

```text
delete YieldMoldFormulaSource by Yield Sample ID
delete YieldSample by Yield Sample ID
```

If rollback succeeds:

```text
APPLY_FAILED_RESTORED
```

is reported.

If rollback itself cannot fully clear partial state:

```text
ROLLBACK_FAILED
```

is reported with both the operation cause and rollback cause.

The failure distinction mirrors the repository's existing atomic hydration semantics.

## Why Validation Happens Before Writes

Normal business-rule failures such as:

- missing Material;
- inactive Mold;
- inactive formula profile;
- Product/Mold mismatch;
- profile/Mold mismatch;
- duplicate source identity;
- MixPreset/Mold Formula conflict;

are detected during preflight.

Therefore rollback is reserved for operational repository failures rather than expected validation flow.

## Backward Compatibility

YRS2B does not remove or change:

```text
YieldSampleEvidenceService.recordSample(...)
```

Existing Yield UI and existing tests can continue using that method until the YRS3/YRS4 UI migration.

The new coordinated service is additive.

## Shared Session

The shared session now exposes:

```text
yieldRecipeSourceRecordingService
```

using the existing shared:

- YieldSampleEvidenceService;
- YieldMoldFormulaSourceService;
- YieldSampleRepository;
- YieldMoldFormulaSourceRepository.

## Result

A successful coordinated recording returns:

```text
sample
resolved recipeSource
optional moldFormulaSource
```

Examples:

```text
Manual
  recipeSource.kind = manual

Mix preset
  recipeSource.kind = mix-preset

Mold formula
  recipeSource.kind = mold-formula
  moldFormulaSource = persisted provenance
```

## Tests

YRS2B covers:

- Manual recording;
- Mix preset recording;
- blank Mix preset rejection;
- Mold Formula atomic recording;
- Yield evidence preflight failure with no writes;
- provenance preflight failure with no writes;
- runtime source-exclusivity hardening;
- repository failure after provenance write;
- successful compensating rollback;
- distinct rollback-failure reporting;
- legacy direct Yield evidence recording compatibility;
- shared session wiring.

## Persistence Boundary

YRS2B still does not include `YieldMoldFormulaSource` in workbook/source snapshots.

That begins in YRS2C.

Therefore coordinated Mold Formula provenance exists in the live application graph after YRS2B, but persistence/export/import support is not considered complete until YRS2C–YRS2E are merged.

## Next Exact Task

```text
YRS2C — PhysicalBusinessDatasetV5
NEXT / NOT STARTED
```

Do not begin YRS2C until YRS2B is merged and exact post-merge `develop` CI is green.
