# Product Label Printing Foundation — Development Plan

Status: IN PROGRESS

Baseline:
- `develop`: `467ced34e21de943f0cc44c585b354885a9a7f3e`
- post-merge CI: `35163760903 — SUCCESS`

## Goal

Add browser-based thermal product-label printing for workshop storage and mold organization. Labels must use the existing authoritative Product record, support common thermal-label dimensions and copy counts, provide an on-screen preview, and print through the browser/OS print dialog without introducing printer-brand-specific dependencies.

## L1 — Product label presentation contract

Create a pure label view model from the existing Product source record:
- product name;
- stable product ID;
- category label;
- active / archived state;
- optional product notes only when explicitly enabled for the label;
- selected label-size preset;
- selected copy count.

No product-domain data or workbook schema changes are allowed.

## L2 — Thermal label document renderer

Add a dedicated label print renderer with preset page sizes suitable for common thermal label stock:
- 40 × 30 mm;
- 50 × 30 mm;
- 50 × 25 mm;
- 60 × 40 mm.

Requirements:
- selected dimensions drive `@page` size;
- zero page margin and print-friendly monochrome layout;
- product name and Product ID are always present and prominent;
- category and status are optional display details;
- multiple copies render as separate label pages;
- all product text is HTML-escaped;
- printing uses a dedicated popup/document and browser `print()` boundary;
- popup-blocked failures are explicit and user-visible.

## L3 — Product catalog label UI

Add a `Print label` action to every Product catalog card.

Opening the action must provide:
- selected product identity;
- label-size selector;
- copies input with safe bounds;
- toggles for category and status;
- live visual preview at representative scale;
- explicit explanation that the OS/browser printer dialog selects the actual thermal printer;
- `Print labels` action;
- `Cancel` / close action.

Archived products remain printable and retain their archived status when status display is enabled.

## L4 — Validation / completion gate

Add focused tests for:
- label view-model/category/status mapping;
- dimension preset validation;
- HTML escaping;
- copy rendering and page-break semantics;
- popup-blocked handling;
- catalog action opens the correct product label UI;
- selected size/copy/toggle behavior;
- print action invocation;
- regression of existing Products workflow.

Then require:
- TypeScript PASS;
- full regression suite PASS;
- production build PASS;
- feature CI PASS;
- PR CI PASS;
- merge to `develop`;
- post-merge `develop` CI PASS.

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
