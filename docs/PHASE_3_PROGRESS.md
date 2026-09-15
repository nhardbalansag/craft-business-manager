# Phase 3 — Product Components, Vessels & Nested Molded Products Progress

Status: **IN PROGRESS**

Planning baseline: `docs/PHASE_3_PRODUCT_COMPONENTS_VESSELS_PLAN.md`

```text
3.1 — Composition Foundation                              COMPLETE
    3.1A — Product Component Contract & Roles             COMPLETE
    3.1B — Composition Graph Integrity & Cycle Prevention COMPLETE
    3.1C — Component Repository & Application Services    COMPLETE

3.2 — Finished Component Stock                            COMPLETE
    3.2A — Product Stock Contract & Validation            COMPLETE
    3.2B — Product Stock Repository & Services            COMPLETE
    3.2C — Source Availability & Relationship Guards      COMPLETE

3.3 — Component-Aware Cost Roll-Up                        COMPLETE
    3.3A — Material-Backed Component Cost                 COMPLETE
    3.3B — Recursive Product-Backed Component Cost        COMPLETE
    3.3C — Total Product Cost & Readiness                  COMPLETE

3.4 — Component-Limited Assembly Capacity                 COMPLETE
    3.4A — Per-Component Availability & Capacity          COMPLETE
    3.4B — Direct-Material + Component Capacity           COMPLETE
    3.4C — Limiting Resource Trace & Readiness            COMPLETE

3.5 — Component / Stock / Production UI                   IN PROGRESS
    3.5A — Product Composition Editor                     COMPLETE
    3.5B — Finished Component Stock UI                    COMPLETE
    3.5C — Component-Aware Production Estimate UI         NEXT

3.6 — Integration & Completion Gate                       NOT STARTED
    3.6A — Integrated Multi-Component Workflow            NOT STARTED
    3.6B — Regression / Build / Completion                NOT STARTED
```

## Locked planning decisions

- component sources are explicitly `material` or `product`;
- component quantities are positive whole `pc` counts;
- purchased/material-backed components use count-based Material inventory and Phase 1 material costing;
- handmade/product-backed components use explicit finished ProductStock for current assembly availability;
- nested Product cost is recursively derived while composition cycles are prohibited;
- Phase 3 baseline capacity is current assembly capacity, not hypothetical recursive manufacture of missing child stock;
- Product-backed assembly capacity uses explicit current ProductStock only;
- Phase 2 direct materials and Phase 3 discrete components remain distinct until derived synthesis views combine them;
- genuine `NO_REQUIREMENTS` may be neutral for a valid component-only Product;
- broken/unresolved required resources remain blocking and are not silently treated as zero;
- every resource tied at the final assembly-capacity minimum remains visible;
- limiting-resource identity is typed as direct Material requirement, Material-backed component, or Product-backed component;
- capacity limiter paths terminate at the immediate current parent input and do not imply recursive manufacture;
- Product composition UI uses ProductComponentService for authoritative writes;
- composition source filtering is UX convenience only; application/domain validation remains authoritative;
- nested composition preview is read-only and corruption-guarded;
- finished ProductStock UI preserves missing-versus-explicit-zero semantics;
- archived relevant ProductStock remains inspectable/correctable;
- no ProductStock delete/reset-to-missing shortcut is introduced without an application/domain contract;
- labor, overhead, selling price, and profit remain Phase 4;
- Excel persistence remains Phase 5;
- no stock reservation, automatic deduction, or stock transaction ledger is introduced in Phase 3.

## Completed phase records

### 3.1 — Composition Foundation

**COMPLETE**

Implementation records:

- `docs/PHASE_3_1A_PRODUCT_COMPONENT_CONTRACT.md`
- `docs/PHASE_3_1B_COMPOSITION_GRAPH_INTEGRITY.md`
- `docs/PHASE_3_1C_COMPONENT_REPOSITORY_SERVICES.md`

### 3.2 — Finished Component Stock

**COMPLETE**

Implementation records:

- `docs/PHASE_3_2A_PRODUCT_STOCK_CONTRACT.md`
- `docs/PHASE_3_2B_PRODUCT_STOCK_REPOSITORY_SERVICES.md`
- `docs/PHASE_3_2C_COMPONENT_SOURCE_AVAILABILITY.md`

### 3.3 — Component-Aware Cost Roll-Up

**COMPLETE**

Implementation records:

- `docs/PHASE_3_3A_MATERIAL_BACKED_COMPONENT_COST.md`
- `docs/PHASE_3_3B_RECURSIVE_PRODUCT_COMPONENT_COST.md`
- `docs/PHASE_3_3C_TOTAL_COMPONENT_AWARE_PRODUCT_COST.md`

Latest completion evidence:

```text
3.3C PR #77 merged
implementation merge 742dd4d2e0882fc1d8f32904adad25a154082167
post-merge CI 34918526564 — SUCCESS
47 test files / 489 tests
```

### 3.4 — Component-Limited Assembly Capacity

**COMPLETE**

#### 3.4A — Per-Component Availability & Capacity

```text
PR #79 merged
implementation merge 3c2e788935baebf5154fb3080534baba9ff3f94a
post-merge develop CI 34919538278 — SUCCESS
49 test files / 524 tests
```

Development plan: `docs/PHASE_3_4A_PER_COMPONENT_CAPACITY_PLAN.md`

Implementation record: `docs/PHASE_3_4A_PER_COMPONENT_CAPACITY.md`

#### 3.4B — Direct-Material + Component Capacity Synthesis

```text
PR #81 merged
implementation merge c598eb81b1521e63773c163f6aef1a3004cafbdb
post-merge develop CI 34920455875 — SUCCESS
50 test files / 551 tests
27 dedicated 3.4B tests
```

Development plan: `docs/PHASE_3_4B_DIRECT_MATERIAL_COMPONENT_CAPACITY_SYNTHESIS_PLAN.md`

Implementation record: `docs/PHASE_3_4B_DIRECT_MATERIAL_COMPONENT_CAPACITY_SYNTHESIS.md`

#### 3.4C — Limiting Resource Trace & Readiness

```text
PR #83 merged
implementation merge 2abd09b743cc88f4db06dc52916eb39b2bc9a52e
post-merge develop CI 34921631005 — SUCCESS
51 test files / 586 tests
35 dedicated 3.4C tests
```

Development plan: `docs/PHASE_3_4C_LIMITING_RESOURCE_TRACE_READINESS_PLAN.md`

Implementation record: `docs/PHASE_3_4C_LIMITING_RESOURCE_TRACE_READINESS.md`

### 3.5A — Product Composition Editor

**COMPLETE**

Delivered:

- Products workspace exposes Products, Mix presets, and Components;
- active parent Product supports component add/edit/remove through ProductComponentService;
- archived parent is read-only for composition inspection;
- active/count-based/self/duplicate/cycle-invalid candidates are filtered for UX while service validation remains authoritative;
- immediate composition cards and guarded nested preview are available.

Evidence:

```text
PR #85 merged
implementation merge b4ab27f7620de4e2d255a1816f6bfd216a954173
Corrected implementation CI 34923251592 — SUCCESS
Final feature-head CI        34923392945 — SUCCESS
PR CI                        34923453562 — SUCCESS
Post-merge develop CI        34923517417 — SUCCESS
52 test files / 596 tests
9 dedicated composition-preview tests
6 React workspace smoke tests
```

Development plan: `docs/PHASE_3_5A_PRODUCT_COMPOSITION_EDITOR_PLAN.md`

Implementation record: `docs/PHASE_3_5A_PRODUCT_COMPOSITION_EDITOR.md`

### 3.5B — Finished Component Stock UI

**COMPLETE**

Delivered:

- Products workspace now exposes a `Finished stock` view;
- relevant rows include current Product-backed child Products even when ProductStock is missing;
- existing historical/no-longer-referenced ProductStock remains inspectable;
- current stock is set/corrected through ProductStockService;
- finished stock unit is fixed to whole `pc` counts;
- missing ProductStock remains distinct from explicit zero ProductStock;
- archived relevant ProductStock remains visible and correctable;
- rows show current parent Product usage and support search/status/stock-state filtering;
- no ProductStock delete/unset shortcut, transaction history, reservation, or automatic deduction was introduced.

Evidence:

```text
PR #87 merged
implementation merge c542021c60e1e276782fc484db7aa84ad0ac3952
Corrected implementation CI 34924675552 — SUCCESS
Final feature-head CI        34924830981 — SUCCESS
PR CI                        34924911146 — SUCCESS
Post-merge develop CI        34924968637 — SUCCESS
53 test files / 608 tests
11 dedicated productStockRows tests
7 React workspace smoke tests
TypeScript typecheck passed
production build passed
```

Development plan: `docs/PHASE_3_5B_FINISHED_COMPONENT_STOCK_UI_PLAN.md`

Implementation record: `docs/PHASE_3_5B_FINISHED_COMPONENT_STOCK_UI.md`

## Current active task

**3.5C — Component-Aware Production Estimate UI — NEXT / NOT STARTED**

Do not begin 3.5C until a dedicated development plan/scope review is established for that task.
