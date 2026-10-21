# Plaster Mold Yield Automation — MY5 Mold Formula Configuration UI

## Status

```text
MY0 — Domain & Workflow Audit                       COMPLETE
MY1 — Plaster Mold Formula Foundation               COMPLETE
MY2 — Repository & Application Services             COMPLETE
MY3 — Physical Dataset v4 / Workbook Migration      COMPLETE
MY4 — Mold Yield Calculator Engine                  COMPLETE
MY5 — Mold Formula Configuration UI                 COMPLETE
    MY5A — Profile Configuration Form               COMPLETE
    MY5B — Saved Formula Estimate Preview           COMPLETE
    MY5C — History / Responsive / Accessibility     COMPLETE

MY6 — Yield Workspace Integration                   NEXT / NOT STARTED
```

## Purpose

MY5 exposes the MY1–MY4 plaster-mold contracts through the existing physical Mold workspace.

The UI is intentionally Mold-centric:

```text
Products
  ↓
Molds & storage
  ↓
Plaster yield setup
```

A Product category does not enable the UI. An active physical Mold can receive a separate `PlasterMoldYieldProfile`.

## MY5A — Profile Configuration

Implemented component:

```text
src/ui/products/PlasterMoldFormulaConfigurationPanel.tsx
```

The panel supports:

- active Mold selection;
- automatic stable `PMYP-####` profile ID generation;
- Water Material selection;
- Plaster Material selection;
- Glue Material selection;
- measured Mold water-fill weight;
- user-friendly Water adjustment percentage input;
- Plaster factor;
- Glue factor;
- pieces per pour / cavity capacity;
- notes;
- active-profile update;
- active-profile archive;
- archived-profile restore.

Only active Materials with:

```text
baseUnit = g
```

are shown in the formula Material selectors.

The application service remains authoritative for:

- Material-role distinctness;
- source existence;
- active-state rules;
- one active profile per Mold;
- all numeric/source validation.

The UI does not duplicate those domain rules.

## Percentage Input Mapping

The source contract stores:

```text
waterAdjustmentRate = 0.30
```

The UI displays:

```text
Water adjustment (%) = 30
```

On save:

```text
30 / 100 = 0.30
```

This is presentation-only conversion. The persisted source contract remains unchanged.

## MY5B — Saved Formula Estimate Preview

When the selected Mold has an active saved profile, the UI consumes:

```text
plasterMoldYieldCalculatorService
```

It displays:

- adjusted Water per pour;
- Plaster per pour;
- Glue per pour;
- total mixture per pour;
- total mixture per piece;
- pieces-per-pour capacity;
- optional requested-piece estimate;
- required pours;
- produced capacity;
- extra capacity;
- requested-quantity total mixture.

The preview uses the **saved active profile**, not unsaved form changes. This prevents a draft UI value from being presented as an authoritative configured formula.

For the canonical example:

```text
Mold water fill        50 g
Water adjustment       30%
Plaster factor         0.75
Glue factor            0.05
Pieces per pour        4
Requested pieces       21
```

the UI receives from MY4:

```text
Per pour
Water                  35 g
Plaster                26.25 g
Glue                   1.75 g
Total                  63 g

Per piece total        15.75 g

Required pours         6
Produced capacity      24
Extra capacity         3
Requested total mix    378 g
```

## Explicit Estimate Boundary

The panel visibly labels the result as:

```text
THEORETICAL ESTIMATE
```

and states:

```text
Product safety waste is not applied.
This does not create Yield evidence.
```

MY5 does not:

- create a `YieldSample`;
- pre-fill a Yield Sample form;
- mutate Yield history;
- apply Product `safetyWasteRate`;
- inspect Material stock/capacity;
- calculate Material cost;
- calculate selling price or profit.

Yield-draft integration remains MY6.

Cost / capacity / production preview remains MY7.

## MY5C — Profile History

Archived profiles remain visible for the selected Mold.

Restore is available only when that Mold has no active profile. This reflects the existing one-active-profile-per-Mold service rule rather than bypassing it in the UI.

## Responsive & Accessibility Contract

The formula UI:

- uses ordinary labeled native `select`, `input`, and `textarea` controls;
- preserves the application-wide mobile 44px touch-target/input baseline;
- collapses the two-column editor/preview layout below 980px;
- collapses Material selectors below 980px;
- collapses form metrics and requested-quantity summaries below 720px;
- remains shrink-safe at phone widths;
- exposes status/error feedback with live/status or alert semantics;
- includes an explicit region label for the formula configuration panel.

Regression coverage:

```text
PlasterMoldFormulaConfigurationPanel.test.tsx
PlasterMoldFormulaResponsive.test.ts
```

## Existing Workspace Integration

The panel is mounted inside:

```text
PhysicalIdentificationWorkspace
```

under the Mold view.

The Products workspace navigation now describes the physical area as:

```text
Physical IDs, locations, formulas & labels
```

No new top-level application section is required.

## Persistence

MY5 creates/updates profiles only through:

```text
PlasterMoldYieldProfileService
```

Therefore MY3 physical dataset v4 / workbook v4 persistence remains the authoritative save/export path automatically.

No calculated preview values are persisted.

## Next Task

```text
MY6 — Yield Workspace Integration
NEXT / NOT STARTED
```

MY6 may add an explicit **Use as Yield Sample Draft** workflow. It must not auto-save formula estimates as actual Yield evidence.
