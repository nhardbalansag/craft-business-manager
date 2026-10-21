# Plaster Mold Yield Automation — MY8 Regression & Completion Gate

## Status

```text
MY0 — Domain & Workflow Audit                       COMPLETE
MY1 — Plaster Mold Formula Foundation               COMPLETE
MY2 — Repository & Application Services             COMPLETE
MY3 — Physical Dataset v4 / Workbook Migration      COMPLETE
MY4 — Mold Yield Calculator Engine                  COMPLETE
MY5 — Mold Formula Configuration UI                 COMPLETE
MY6 — Yield Workspace Integration                   COMPLETE
MY7 — Cost / Capacity / Production Preview          COMPLETE
MY8 — Regression & Completion Gate                  COMPLETE

Plaster Mold Yield Automation                       COMPLETE
```

## Purpose

MY8 closes the Plaster Mold Yield Automation program by validating the entire source-to-operation lifecycle without introducing any new business feature.

The completion gate proves the architecture established across MY0–MY7 remains coherent as one integrated system.

## Completion Matrix

```text
A — source/domain formula semantics                    GREEN
B — profile referential and relationship guards       GREEN
C — shared repository/application graph               GREEN
D — PhysicalBusinessDataset v4 persistence            GREEN
E — workbook v4 round trip                            GREEN
F — calculator / multi-cavity requested quantity      GREEN
G — Formula → Yield Sample Draft boundary              GREEN
H — actual Yield evidence authority                    GREEN
I — Product safety-waste separation                    GREEN
J — formula Material costing                           GREEN
K — formula current-stock capacity                     GREEN
L — Production parallel-preview boundary               GREEN
M — responsive/accessibility regressions               GREEN
N — full TypeScript / test / production build gate     GREEN
```

## Integrated Lifecycle Gate

The dedicated completion suite is:

```text
src/application/plasterMoldYieldProfiles/
  PlasterMoldYieldAutomationCompletionGate.test.ts
```

It uses the shared application session rather than a synthetic duplicate graph.

The canonical completion scenario creates:

```text
Product
  PROD-MY8

Mold
  MOLD-MY8

Active formula profile
  PMYP-MY8

Formula Materials
  Water
  Plaster
  Glue
```

with:

```text
waterFillWeightGrams = 50
waterAdjustmentRate  = 0.30
plasterFactor        = 0.75
glueFactor           = 0.05
piecesPerPour         = 4
```

## Formula Contract Reconfirmed

For one pour:

```text
Adjusted Water       35 g
Plaster           26.25 g
Glue               1.75 g
Total mixture        63 g
```

For requested quantity 21:

```text
Required pours        6
Produced capacity    24
Extra capacity        3

Water               210 g
Plaster           157.5 g
Glue                10.5 g
Total mixture        378 g
```

The completion gate reconfirms:

```text
productSafetyWasteApplied = false
yieldEvidenceCreated      = false
```

for the MY4 theoretical calculator result.

## Formula → Yield Draft Boundary Reconfirmed

The completion gate passes the MY4 result through:

```text
buildPlasterMoldYieldDraft(...)
```

and verifies the draft contains:

- Mold/profile provenance;
- Water/Plaster/Glue theoretical quantities;
- requested quantity;
- required pours;
- produced capacity;
- extra capacity;
- total mixture.

It explicitly verifies the draft does **not** contain:

```text
goodPieces
rejectedPieces
YieldSample evidence
```

and that merely constructing the draft does not create a Yield sample.

## Actual Yield Evidence Authority

The completion scenario then records a real batch:

```text
Water       36 g
Plaster   27.4 g
Glue       1.8 g

Good pieces      4
Rejected pieces  0
```

This produces measured per-piece learning:

```text
Water      9 g / piece
Plaster 6.85 g / piece
Glue     0.45 g / piece
```

The Product has:

```text
safetyWasteRate = 0.10
```

Therefore normal Production planning for 21 pieces derives from the **actual Yield sample**, then applies Product safety waste:

```text
Water
9 × 1.10 × 21
= 207.9 g

Plaster
6.85 × 1.10 × 21
= 158.235 g

Glue
0.45 × 1.10 × 21
= 10.395 g
```

These values intentionally differ from the theoretical six-pour formula totals:

```text
Formula Water       210 g
Formula Plaster   157.5 g
Formula Glue       10.5 g
```

That difference is a required completion-gate behavior.

It proves:

```text
Mold Formula Estimate != Yield Evidence
Mold Water Adjustment != Product Safety Waste
```

and proves the MY Formula path never silently replaces actual Production learning.

## Persistence Round Trip

After both the formula source profile and actual Yield evidence exist, MY8:

1. snapshots the full PhysicalBusinessDataset v4;
2. exports the current workbook through the shared `PersistenceCoordinator`;
3. clears the authoritative in-memory repositories;
4. imports and hydrates the workbook;
5. snapshots the restored source graph;
6. requires exact source equality before/after.

The restored graph must preserve:

- Product;
- Materials;
- Mold;
- active PlasterMoldYieldProfile;
- actual Yield Sample;
- all existing persisted source collections.

No calculated MY formula/cost/capacity output is persisted.

## Post-Round-Trip Recalculation

After hydration, MY8 recalculates:

```text
MY4 theoretical formula
ProductionRequirementService actual-Yield plan
MY7 formula operational preview
```

and requires each result to equal its pre-export result.

This proves derived MY outputs are deterministic from restored source truth.

## Cost / Capacity Completion Contract

With the canonical MY8 Material prices and stock, MY7 must continue to derive:

```text
Formula material cost / pour     3.675
Formula material cost / piece    0.91875
Target formula material cost    22.05
```

and:

```text
Maximum complete pours from stock  28
Maximum produced pieces            112
Limiting formula Material          Water
```

The completion gate also reconfirms:

```text
productSafetyWasteApplied = false
yieldEvidenceUsed         = false
productionPathReplaced    = false
```

for the formula operational preview.

## Relationship Guard Completion

MY8 reconfirms that an active formula profile prevents:

- archiving its Mold;
- archiving one of its formula Materials;
- changing a required formula Material away from weight-based `g`.

This ensures source integrity remains protected after all later MY integrations.

## Persistence Boundary

The completed MY feature persists only authoritative source inputs:

```text
PlasterMoldYieldProfile
```

Derived values remain recalculated:

- adjusted Water;
- Plaster;
- Glue;
- total mixture;
- per-piece formula quantities;
- required pours;
- produced / extra capacity;
- formula costs;
- stock capacity;
- shortfalls;
- limiting Material;
- Yield draft values.

## Existing Full-Suite Regressions

MY8 relies on the complete repository test suite to keep the child contracts green, including:

```text
MY1A formula domain tests
MY1B source contract tests
MY1C reference validation tests
MY2 repository/service/session tests
MY3 dataset/workbook/snapshot/hydration tests
MY4 calculator/session tests
MY5 configuration UI + responsive tests
MY6 Yield draft/workspace/responsive tests
MY7 operational service/Production/responsive tests
MY8 integrated lifecycle gate
```

## Completion Criteria

The Plaster Mold Yield Automation program is complete only when all of the following are true on the final MY8 head:

```text
Typecheck        SUCCESS
Full test suite  SUCCESS
Production build SUCCESS
PR CI            SUCCESS
Post-merge CI    SUCCESS
```

## Program Closure

After MY8 merges and exact post-merge `develop` CI is green:

```text
Plaster Mold Yield Automation — COMPLETE
```

The next previously deferred project task returns to:

```text
6.1A — Tauri v2 Project Scaffold & Dev/Build Scripts
NEXT / NOT STARTED
```

Do not start Phase 6.1A as part of MY8.
