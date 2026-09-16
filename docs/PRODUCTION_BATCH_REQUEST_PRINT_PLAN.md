# Production Batch Request / PDF Print — Development Plan

Status: IN PROGRESS

Baseline:
- `develop`: `7c6eec4133c2c0d1108ce95c14ac26b31114c1aa`
- post-merge CI: `35157529905 — SUCCESS`

## Goal

Add a printable Production Request / Batch Sheet to the Production workspace. The sheet must summarize the authoritative planned batch information already calculated by the application and support physical printing or browser **Save as PDF** without introducing duplicate costing, capacity, yield, or pricing math.

## B1 — Batch sheet view model

Build a pure presentation model from the current Production-page evidence:
- product identity, category, active/archive state;
- planned finished quantity;
- safety-waste percentage and effective yield evidence ID;
- direct material requirements with material names, batch quantities, units, on-hand quantities, and shortage/readiness evidence;
- component / vessel / nested-product requirements with quantity per parent, planned batch quantity, available stock, and readiness;
- current assembly capacity, feasibility, limiting resources, warnings, and readiness issues;
- authoritative batch financials: planned production cost, expected revenue, expected profit, margin, average cost per finished unit, and selling price;
- generated-at timestamp and a stable human-readable production request reference.

No business math may be re-derived beyond simple formatting/presentation joins.

## B2 — A4 print document

Generate a dedicated printable HTML document with:
- Production Request / Batch Sheet heading;
- batch and product summary;
- materials-to-prepare table;
- components / vessels table when applicable;
- capacity and readiness section;
- financial summary;
- production notes / issues;
- blank Actual Production Results fields;
- Prepared by / Produced by / Checked by sign-off lines;
- A4-friendly print CSS and page-break-safe tables.

The browser print dialog is the delivery boundary. Users can choose a physical printer or **Save as PDF**. This first version does not claim to generate or persist a PDF file itself.

## B3 — Production workspace action

Add `Print / Save Batch Sheet` to Production only when a current valid estimate exists.
- button disabled while recalculating or when there is no current estimate;
- printing opens a dedicated document and invokes its print dialog;
- current workspace and stock remain unchanged;
- archived products remain printable but retain their archived warning/state;
- incomplete/partial estimates remain printable with explicit readiness warnings rather than fabricated values.

## B4 — Validation / completion gate

- view-model tests for material, component, capacity, financial, warning, and blank/partial states;
- print-document tests for A4 structure, tables, blank actual-result/sign-off fields, escaping, and no false PDF persistence claims;
- browser print-command tests;
- Production UI integration test for action readiness and invocation;
- full TypeScript, regression suite, production build, feature CI, PR CI, guarded merge, and post-merge `develop` CI.

## Non-goals

- persisting production requests as a new repository/domain entity;
- decrementing stock when printing;
- recording actual production results;
- automatic yield-sample creation from the paper form;
- server-side/native PDF generation;
- signatures, QR codes, barcodes, attachments, or approval workflow.

## Follow-up candidates

After this first print feature is stable, a separate phase can add persisted production orders/batches, statuses, actual consumed quantities, completed/rejected pieces, operator/approver identities, and automatic yield-history evidence from completed batches.
