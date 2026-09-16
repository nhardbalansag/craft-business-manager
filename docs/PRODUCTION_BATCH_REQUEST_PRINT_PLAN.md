# Production Batch Request / PDF Print — Development Plan

Status: COMPLETE

Baseline:
- `develop`: `7c6eec4133c2c0d1108ce95c14ac26b31114c1aa`
- post-merge CI: `35157529905 — SUCCESS`

## Goal

Add a printable Production Request / Batch Sheet to the Production workspace. The sheet summarizes authoritative planned batch information already calculated by the application and supports physical printing or browser **Save as PDF** without introducing duplicate costing, capacity, yield, or pricing math.

## B1 — Batch sheet view model — COMPLETE

Implemented a pure presentation model from current authoritative Production evidence:
- product identity, category, active/archive state;
- planned finished quantity;
- safety-waste percentage and effective yield evidence ID;
- direct material requirements with material names, batch quantities, units, normalized on-hand quantities, and shortage/readiness evidence;
- component / vessel / nested-product requirements with quantity per parent, planned batch quantity, available stock, and readiness;
- current assembly capacity, feasibility, limiting resources, warnings, and readiness issues;
- authoritative batch financials: planned production cost, expected revenue, expected profit, margin, average cost per finished unit, selling price, and profit per unit;
- generated-at timestamp and stable human-readable production request reference.

No business math is duplicated. Financial, capacity, yield, and requirement values are copied from existing authoritative application results. The only new arithmetic is presentation-only shortage (`required - known on-hand`, floored at zero).

## B2 — A4 print document — COMPLETE

Implemented a dedicated printable HTML document with:
- Production Request / Batch Sheet heading;
- batch and product summary;
- materials-to-prepare table;
- components / vessels / nested products table when applicable;
- capacity and limiting-resource section;
- financial summary;
- readiness notes / issues;
- product notes when available;
- blank production notes / instructions area;
- blank Actual Production Results fields;
- Prepared by / Produced by / Checked by sign-off lines;
- A4-friendly print CSS and page-break-safe tables;
- HTML escaping of source/business text.

The browser print dialog is the delivery boundary. Users can choose a physical printer or **Save as PDF**. This version does not claim to generate, upload, or persist a PDF file itself.

## B3 — Production workspace action — COMPLETE

Added `Print / Save Batch Sheet` to the authoritative Production batch overview.
- it is available only while a current completed estimate is displayed;
- changing Product or quantity hides the action while recalculation is pending;
- the action opens the print window synchronously, refreshes the same authoritative production services, then prints the resulting presentation snapshot;
- current workspace and stock remain unchanged;
- archived and partial/not-ready estimates remain truthful through explicit warnings and unavailable values;
- blocked browser pop-ups produce an actionable error instead of claiming a print succeeded.

## B4 — Validation / completion gate — COMPLETE

Focused coverage added for:
- deterministic request identity and generated timestamp;
- material required/on-hand/shortage/unresolved states;
- component / vessel mapping;
- authoritative financial-value passthrough;
- archived/readiness warnings and issue propagation;
- A4 document structure and required sections;
- blank actual-result and sign-off fields;
- HTML escaping;
- browser print invocation and blocked-popup behavior;
- non-destructive source-state proof using before/after complete source snapshots.

Implementation feature gate before this closeout update:
- feature head: `7b2f0190aa9736df95d9f595745e0b4d42d4f1c6`
- CI: `35162539567 — SUCCESS`
- TypeScript: PASS
- test files: `141 passed`
- tests: `1,479 passed`
- production build: PASS
- Vite modules transformed: `156`

The existing >500 kB JavaScript chunk advisory remains informational and is not introduced as a correctness failure by this feature.

## Files

- `src/ui/production/batchProductionRequestView.ts`
- `src/ui/production/batchProductionRequestPrint.ts`
- `src/ui/production/BatchProductionRequestPrintButton.tsx`
- `src/ui/production/ProductionFinancialSummary.tsx`
- `src/ui/production/batchProductionRequestView.test.ts`
- `src/ui/production/batchProductionRequestPrint.test.ts`
- `src/ui/production/BatchProductionRequestPrintButton.test.tsx`

## Non-goals

- persisting production requests as a new repository/domain entity;
- decrementing or reserving stock when printing;
- recording actual production results;
- automatic yield-sample creation from the paper form;
- server-side/native PDF generation;
- signatures, QR codes, barcodes, attachments, or approval workflow.

## Follow-up candidates

A separate future phase can add persisted production orders/batches, statuses, actual consumed quantities, completed/rejected pieces, operator/approver identities, and automatic yield-history evidence from completed batches.
