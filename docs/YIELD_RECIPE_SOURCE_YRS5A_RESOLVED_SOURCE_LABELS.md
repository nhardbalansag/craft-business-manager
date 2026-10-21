# Yield Recipe Source — YRS5A Resolved Source Labels

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE
YRS3 — Yield Recipe Source UI                         COMPLETE
YRS4 — Mold Formula Draft Integration Refactor        COMPLETE

YRS5 — Yield History Provenance UI                    IN PROGRESS
    YRS5A — Resolved Source Labels                    COMPLETE IN THIS CHANGE
    YRS5B — Mold / Profile Traceability               NEXT / NOT STARTED
    YRS5C — Legacy Sample Presentation                NOT STARTED

YRS6 — Integrated Regression & Completion Gate        NOT STARTED
```

Verified YRS5A base:

```text
develop  75a317caa2ccc90b2d70d6665e88da2fdca5ac02
CI       36591213704 — SUCCESS
YRS4     COMPLETE / MERGED
```

## Purpose

YRS1 established one authoritative source-resolution contract:

```text
Mold Formula provenance exists
    → mold-formula

otherwise mixPresetId exists
    → mix-preset

otherwise
    → manual
```

YRS5A exposes that resolved source kind in Yield History.

The history UI no longer interprets recipe provenance from
`YieldSample.mixPresetId` alone.

## Authoritative Read Path

For every loaded Yield Sample, the history workspace resolves provenance through:

```ts
yieldMoldFormulaSourceService.resolveRecipeSourceForYieldSample(sample.id)
```

The returned `ResolvedYieldRecipeSource` is the only input used to choose the
history source label.

The presentation labels are:

```text
manual        → Manual
mix-preset    → Mix preset
mold-formula  → Mold formula
```

This prevents the old ambiguity where a Formula-originated sample with no
MixPreset reference could be visually mistaken for Manual.

## History Presentation

The previous history summary field:

```text
Mix
```

becomes:

```text
Recipe source
```

Each history card therefore exposes one explicit provenance label alongside:

- good pieces;
- good yield;
- defect rate.

### Manual

```text
Recipe source
Manual
```

### Mix preset

```text
Recipe source
Mix preset
Standard Plaster Mix
```

The Mix preset name was already available in history before YRS5A. It remains
secondary context beneath the resolved source label.

### Mold formula

```text
Recipe source
Mold formula
```

YRS5A intentionally does not show the Mold ID/name or profile ID yet.

That belongs to YRS5B.

## Search Compatibility

Yield History search now includes the resolved source label.

Queries such as:

```text
manual
mix preset
mold formula
```

can therefore filter history by recipe-source kind.

Existing search inputs remain supported:

- sample ID;
- Material name/ID;
- Mix preset name;
- recorded date;
- notes.

The search placeholder and empty-result guidance now refer to `source` rather
than only `mix`.

## Fail-Closed Resolution

YRS5A does not duplicate or soften the domain resolver.

If a persisted sample cannot resolve its recipe source through the authoritative
YRS service, history loading surfaces the existing history error path rather than
inventing a label.

This preserves YRS1 exclusivity rules, including rejection of simultaneous
MixPreset + Mold Formula provenance.

## Read-Only Boundary

Resolved source labels are presentation only.

They do not change:

- Yield Sample persistence;
- Mold Formula provenance persistence;
- preferred/effective Yield selection;
- Yield learning;
- good-yield / defect calculations;
- Production calculations;
- correction/deletion policy.

No history row is rewritten.

## YRS5B Boundary

YRS5B owns physical Formula traceability details.

YRS5A does not add:

- Mold name;
- Mold ID;
- Plaster Mold Yield Profile ID;
- profile-specific history actions.

A Mold Formula history row shows only:

```text
Recipe source
Mold formula
```

until YRS5B.

## YRS5C Boundary

YRS5C owns any dedicated legacy-sample presentation/refinement.

YRS5A simply applies the existing deterministic resolver to all samples loaded
through the current repositories. It does not add a special `Legacy` badge or
rewrite historical records.

## Regression Coverage

YRS5A verifies:

- Manual samples display `Recipe source → Manual`;
- MixPreset samples display `Recipe source → Mix preset`;
- existing Mix preset name remains visible as secondary context;
- Mold Formula provenance wins the resolved label and displays
  `Recipe source → Mold formula`;
- Mold/profile IDs are not exposed in the YRS5A source summary;
- resolved source labels participate in Yield History search;
- source-label presentation does not affect effective/preferred Yield behavior.

## Deliberately Unchanged

YRS5A does not:

- add Mold/profile history traceability;
- add legacy-specific badges or annotations;
- change source resolution precedence;
- change persistence;
- change Formula calculations;
- change actual-measurement confirmation;
- change Yield learning;
- change Production calculations.

## Next Exact Task

```text
YRS5B — Mold / Profile Traceability
NEXT / NOT STARTED
```

Do not begin YRS5B until YRS5A is merged and exact post-merge `develop` CI is green.
