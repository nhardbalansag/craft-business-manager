# Physical Identification & Storage Foundation — Development Plan

Status: COMPLETE

Baseline:
- original `develop`: `78d339b6427df0ab916030689a1d75f55e8cb9da`
- original post-merge CI: `35170032170 — SUCCESS`

Completion evidence:
- implementation feature branch: `feature/physical-identification-storage-foundation`
- final feature head: `a924654a0264a021dd854a3474e361f1a7648862`
- implementation validation CI: `35180872109 — SUCCESS`
- docs-inclusive feature CI: `35181655292 — SUCCESS`
- exact PR file list reviewed: `42 changed files`
- PR: `#226 — Add physical identification and storage foundation`
- PR CI: `35181812559 — SUCCESS`
- guarded merge used expected head SHA `a924654a0264a021dd854a3474e361f1a7648862`
- merge commit on `develop`: `9f1b78bf97d11d46338b9001edf5175a3e41fdcd`
- post-merge `develop` CI: `35181912497 — SUCCESS`
- CI validated TypeScript, the full regression suite, and the production build

## Goal

Extend the existing browser-based thermal product-label workflow into one coherent physical-identification system for products, molds, and workshop storage.

The completed scope provides:
- standards-compliant QR codes;
- Code 128 barcodes;
- persistent Mold IDs and Mold records;
- persistent hierarchical Rack / Shelf / Bin storage records;
- assignment of molds to storage locations;
- printable Product labels with QR/barcode options;
- printable Mold labels with QR/barcode and assigned location path;
- printable Storage Location labels with QR/barcode and human-readable path;
- workbook persistence and safe migration for the new authoritative source collections.

## Architectural decisions

### Stable identities

Authoritative identity stays separate from physical location:
- Product IDs already exist and remain unchanged.
- Mold IDs are stable identifiers, e.g. `MOLD-0012`.
- Storage Location IDs are stable identifiers, e.g. `LOC-BIN-0004`.
- Moving a mold changes only `storageLocationId`; it never changes the Mold ID.

### Hierarchical storage model

Use one normalized `StorageLocation` entity with:
- `id`;
- `name`;
- `type`: `rack | shelf | bin`;
- optional `parentId`;
- optional notes;
- active/archive state.

Hierarchy rules:
- rack: no parent;
- shelf: parent must be an active/existing rack;
- bin: parent must be an active/existing shelf.

This supports paths such as:
`Rack A / Shelf 2 / Bin 04`

and allows each level to have its own printable label.

### Mold model

Use a persisted `Mold` entity with:
- `id`;
- `productId`;
- `name`;
- optional `storageLocationId`;
- optional notes;
- active/archive state.

A product may have zero or many molds. A mold belongs to exactly one product and may be unassigned to storage.

### Machine-readable payloads

Use deterministic identification payloads:
- Product QR: `CBM:PRODUCT:<product-id>`
- Mold QR: `CBM:MOLD:<mold-id>`
- Storage QR: `CBM:LOCATION:<location-id>`
- Code 128 barcode text: the authoritative entity ID itself.

QR/barcode generation uses standards-compliant SVG through `@bwip-js/generic`, without a network barcode service.

### Persistence compatibility

Adding molds and storage locations changes persisted source truth. The completed implementation therefore:
- supports the physical-identification dataset/workbook v2 contract;
- adds `Molds` and `StorageLocations` sheets;
- imports legacy v1/v1 workbooks into the v2 physical dataset with empty new collections;
- preserves existing v1 source data during migration;
- keeps unsupported/future versions fail-closed;
- keeps hydration rejection-safe and restores previous live state when apply fails.

## PIS0 — Contracts & dependency readiness — COMPLETE

Completed:
- standards-compliant SVG barcode/QR dependency;
- shared deterministic machine-readable payload helpers;
- QR and Code 128 generation tests, including invalid/blank identity behavior.

## PIS1 — Storage Location domain & services — COMPLETE

Completed:
- `StorageLocation` domain contract and validation;
- hierarchy validation and cycle protection;
- repository interface + in-memory implementation;
- create/update/archive/list service behavior;
- deterministic location-path resolution;
- archive protection for active child/location relationships.

## PIS2 — Mold identity domain & services — COMPLETE

Completed:
- `Mold` domain contract and validation;
- repository interface + in-memory implementation;
- create/update/archive/list service behavior;
- Product referential integrity;
- optional Storage Location referential integrity;
- move/unassign storage behavior without identity mutation.

## PIS3 — Dataset / workbook persistence v2 — COMPLETE

Completed persisted source extensions:
- `storageLocations`;
- `molds`.

Completed integration:
- physical source snapshot service;
- rejection-safe atomic physical hydration;
- physical dataset validation/cloning;
- workbook v2 export/import;
- v1 compatibility/migration;
- row/reference validation;
- session composition through the existing persistence coordinator.

Canonical physical sheets:
- `StorageLocations`;
- `Molds`.

Regression covers:
- v2 round-trip fidelity;
- v1 workbook migration with empty storage/mold collections;
- invalid parent/product/location reference rejection;
- failed hydration without partial live-state mutation.

## PIS4 — Product QR & barcode labels — COMPLETE

Completed Product label enhancements:
- optional QR code;
- optional Code 128 barcode;
- live preview representation;
- printed SVGs generated from Product ID;
- existing exact millimeter label presets and copy counts retained;
- category/status controls retained;
- machine-readable label regression coverage.

## PIS5 — Mold & Storage workspace UI — COMPLETE

The Products section now exposes the physical-identification workspace while preserving the existing Product/Mix/Component/Stock workshop.

### Molds view

Completed:
- create/edit/archive mold;
- select owning Product;
- assign/move/unassign Storage Location;
- show current Rack / Shelf / Bin path;
- search/filter;
- `Print mold label`;
- label content for mold identity, owning Product, current storage path, QR, Code 128, size, and copies.

### Storage view

Completed:
- create/edit/archive rack/shelf/bin;
- hierarchy-constrained parent selection;
- path display/preview;
- search/filter;
- `Print storage label`;
- label content for type/name, Location ID, full path, QR, Code 128, size, and copies.

## PIS6 — Validation & completion gate — COMPLETE

Focused regression covers:
- domain validation and hierarchy rules;
- duplicate IDs;
- cycle prevention;
- mold/product/location referential integrity;
- move/unassign semantics;
- dataset snapshot/hydration;
- workbook v2 import/export;
- v1 -> v2 compatibility/migration;
- QR SVG generation;
- Code 128 SVG generation;
- product label machine-readable options;
- mold label contents;
- storage label contents;
- Products workspace navigation and CRUD paths;
- printing remains non-destructive.

Repository gate results:
- TypeScript PASS;
- full regression suite PASS;
- production build PASS;
- feature CI PASS;
- exact diff review COMPLETE;
- PR to `develop` COMPLETE;
- PR CI PASS;
- guarded merge COMPLETE;
- post-merge `develop` CI PASS.

## Scope decision: drawers / generalized storage

This foundation intentionally implements the approved normalized hierarchy `rack -> shelf -> bin` only. Drawer/custom location types are not required for PIS completion and remain a follow-up storage-taxonomy enhancement so they do not expand this completed persistence contract.

## Non-goals / follow-up capabilities

- direct USB / serial / Bluetooth printer discovery;
- silent/default printer selection;
- raw TSPL/ZPL/CPCL/ESC-POS command output;
- Tauri native direct printing;
- camera/scanner input workflow;
- drawer/custom storage taxonomy;
- mold maintenance lifecycle / wear counters;
- stock deduction from scanning or printing;
- automatic production transactions.

These are follow-up capabilities built on the completed persisted identification foundation.
