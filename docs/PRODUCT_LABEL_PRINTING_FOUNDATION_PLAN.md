# Product Label Printing Foundation — Development Plan

Status: COMPLETE

Baseline:
- `develop`: `467ced34e21de943f0cc44c585b354885a9a7f3e`
- post-merge CI: `35163760903 — SUCCESS`

Completion evidence:
- implementation head before plan closeout: `a153e633a4f44f3c76544185c9ecf3b1ff208adb`
- feature CI: `35169701264 — SUCCESS`
- TypeScript: PASS
- 145 test files / 1,487 tests: PASS
- production build: PASS

## Goal

Add browser-based thermal product-label printing for workshop storage and mold organization. Labels must use the existing authoritative Product record, support common thermal-label dimensions and copy counts, provide an on-screen preview, and print through the browser/OS print dialog without introducing printer-brand-specific dependencies.

## L1 — Product label presentation contract

COMPLETE.

Created a pure label view model from the existing Product source record:
- product name;
- stable product ID;
- category label;
- active / archived state;
- selected label-size preset;
- selected copy count.

No product-domain data or workbook schema changes were introduced.

## L2 — Thermal label document renderer

COMPLETE.

Added a dedicated label print renderer with preset page sizes suitable for common thermal label stock:
- 40 × 30 mm;
- 50 × 30 mm;
- 50 × 25 mm;
- 60 × 40 mm.

Implemented:
- selected dimensions drive `@page` size;
- zero page margin and print-friendly monochrome layout;
- product name and Product ID are always present and prominent;
- category and status are optional display details;
- multiple copies render as separate label pages;
- all product text is HTML-escaped;
- printing uses a dedicated popup/document and browser `print()` boundary;
- popup-blocked failures are explicit and user-visible.

## L3 — Product catalog label UI

COMPLETE.

Added a `Print label` action to every Product catalog card.

The label dialog provides:
- selected product identity;
- label-size selector;
- copies input with safe 1–50 bounds;
- toggles for category and status;
- live visual preview at representative scale;
- explicit explanation that the OS/browser printer dialog selects the actual thermal printer;
- `Print label(s)` action;
- `Cancel` / close action.

Archived products remain printable and retain their archived status when status display is enabled.

## L4 — Validation / completion gate

COMPLETE.

Focused tests cover:
- label view-model/category/status mapping;
- dimension preset validation;
- HTML escaping;
- copy rendering and page-break semantics;
- popup-blocked handling;
- catalog action opens the correct product label UI;
- selected size/copy/toggle behavior;
- print action invocation;
- regression of existing Products workflow.

Completed gate:
- TypeScript PASS;
- full regression suite PASS;
- production build PASS;
- feature CI `35169701264 — SUCCESS`.

PR CI, merge, and post-merge `develop` CI are release-integration gates performed after this plan closeout commit.

## Non-goals

- direct USB / serial / Bluetooth printer discovery;
- TSPL, ZPL, CPCL, ESC/POS command generation;
- silently choosing a system printer;
- QR-code or barcode generation in this first foundation;
- persisted mold/storage-location records;
- stock changes or label-print audit history;
- Tauri/native direct-print integration.

## Follow-up candidates

1. QR/barcode labels backed by the same stable Product ID.
2. Mold and storage-location entities (rack / shelf / bin) with dedicated labels.
3. Label templates for materials, vessels, components, and finished stock.
4. Phase 6 Tauri printer discovery, default-printer settings, and direct TSPL/ZPL/ESC-POS adapters.
