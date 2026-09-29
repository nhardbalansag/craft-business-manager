# Yield Recipe Source — YRS5B Mold / Profile Traceability

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE
YRS3 — Yield Recipe Source UI                         COMPLETE
YRS4 — Mold Formula Draft Integration Refactor        COMPLETE

YRS5 — Yield History Provenance UI                    IN PROGRESS
    YRS5A — Resolved Source Labels                    COMPLETE
    YRS5B — Mold / Profile Traceability               COMPLETE IN THIS CHANGE
    YRS5C — Legacy Sample Presentation                NEXT / NOT STARTED

YRS6 — Integrated Regression & Completion Gate        NOT STARTED
```

Verified YRS5B base:

```text
develop  ac50f84f73ce66d70666960e5c6a9763be0d9699
CI       36593940497 — SUCCESS
YRS5A    COMPLETE / MERGED
```

## Purpose

YRS5A made the resolved recipe-source kind visible in Yield History.

For Mold Formula samples, YRS5B adds the physical source identity that explains
where the Formula-assisted draft came from:

```text
Recipe source
Mold formula

Dinosaur 4-Cavity Mold · MOLD-0004
Profile PMYP-0004
```

This is read-only production provenance.

## Authoritative Source

The history workspace still resolves the recipe source through:

```ts
yieldMoldFormulaSourceService.resolveRecipeSourceForYieldSample(sample.id)
```

When that resolved source is `mold-formula`, YRS5B uses the resolved stored
identifiers:

- `moldId`;
- `moldYieldProfileId`.

Those identifiers are then looked up through the existing Mold and Plaster Mold
Yield Profile application services for display metadata.

The provenance record remains authoritative for identity.

The lookup is used only to enrich presentation with the Mold name and archived
state.

## Traceability Presentation

A Mold Formula history row now includes:

```text
Recipe source
Mold formula

<Mold name> · <Mold ID>
Profile <Profile ID>
```

The Mold ID and Profile ID are always rendered from the resolved provenance
identity.

If the Mold record is available, its saved name is shown before the ID.

This gives history both human-readable context and exact identifier-level
traceability.

## Archived Historical Sources

YRS provenance validation intentionally distinguishes recording rules from
historical rules.

A Mold/profile can become archived after a real Yield batch was recorded.

That must not erase historical provenance.

Therefore YRS5B continues to display archived sources:

```text
Dinosaur 4-Cavity Mold · MOLD-0004 · archived
Profile PMYP-0004 · archived
```

Archived state is informational only.

It does not invalidate the historical Yield Sample and does not affect
preferred/effective Yield selection.

## Missing Display Metadata

The persisted provenance IDs remain the fallback identity.

If a Mold display record cannot be loaded, history still shows:

```text
Mold · <stored Mold ID>
Profile <stored Profile ID>
```

YRS5B does not invent a Mold name or substitute another profile.

Normal PhysicalBusinessDatasetV5 validation still requires valid historical
references for authoritative persisted datasets.

## Search Compatibility

Yield History search now includes Mold Formula traceability terms:

- Mold name;
- Mold ID;
- Mold Yield Profile ID.

For example:

```text
Dinosaur 4-Cavity Mold
MOLD-0004
PMYP-0004
```

can locate the Formula-sourced batch.

Existing source-kind search from YRS5A remains supported:

```text
mold formula
mix preset
manual
```

## Read-Only Boundary

YRS5B changes history presentation only.

It does not change:

- `YieldMoldFormulaSource` persistence;
- Mold/profile persistence;
- Yield Sample evidence;
- Formula calculations;
- preferred/effective selection;
- Yield learning;
- Production calculations;
- correction/deletion behavior.

No historical source relationship is rewritten.

## YRS5C Boundary

YRS5C owns explicit presentation for samples inherited from pre-YRS source
models.

YRS5B does not add:

- Legacy badges;
- migration-origin text;
- special old-workbook annotations;
- source inference rules beyond the existing resolver.

## Regression Coverage

YRS5B verifies:

- Mold Formula history shows the Mold Formula source label;
- Mold name is displayed from the referenced Mold;
- stored Mold ID is visible;
- stored profile ID is visible;
- archived Mold/profile identities remain visible as historical provenance;
- Mold name participates in history search;
- Mold ID participates in history search;
- profile ID participates in history search;
- traceability remains absent from Manual/Mix preset source presentation;
- preferred/effective Yield behavior is unchanged.

## Next Exact Task

```text
YRS5C — Legacy Sample Presentation
NEXT / NOT STARTED
```

Do not begin YRS5C until YRS5B is merged and exact post-merge `develop` CI is green.
