# Physical Identification & Storage Foundation — Development Plan

Status: IN PROGRESS

Baseline:
- `develop`: `78d339b6427df0ab916030689a1d75f55e8cb9da`
- post-merge CI: `35170032170 — SUCCESS`

## Goal

Extend the existing browser-based thermal product-label workflow into one coherent physical-identification system for products, molds, and workshop storage.

The completed scope must provide:
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
- Mold IDs are new stable identifiers, e.g. `MOLD-0012`.
- Storage Location IDs are new stable identifiers, e.g. `LOC-BIN-0004`.
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

QR/barcode generation must be standards-compliant SVG. Use `@bwip-js/generic` so the application can render both QR Code and Code 128 with one browser-compatible SVG library and without a network barcode service.

### Persistence compatibility

Adding molds and storage locations changes persisted source truth. Therefore:
- bump `BusinessDataset` schema from v1 to v2;
- bump canonical workbook format from v1 to v2;
- add `Molds` and `StorageLocations` sheets;
- register an explicit v1/v1 -> v2/v2 workbook migration that adds empty new sheets and updates `_Meta`;
- preserve all existing v1 source data unchanged during migration;
- keep future versions fail-closed.

## PIS0 — Contracts & dependency readiness

- add the standards-compliant SVG barcode/QR dependency;
- define shared machine-readable payload helpers;
- keep code generation pure/deterministic where possible;
- test QR and Code 128 output structure and invalid/blank ID behavior.

## PIS1 — Storage Location domain & services

Add:
- `StorageLocation` domain contract and validation;
- hierarchy validation and cycle protection;
- repository interface + in-memory implementation;
- application service for create/update/archive/list;
- deterministic location-path resolution;
- safe archive rules so an active child cannot silently lose its parent.

## PIS2 — Mold identity domain & services

Add:
- `Mold` domain contract and validation;
- repository interface + in-memory implementation;
- application service for create/update/archive/list;
- Product referential integrity;
- optional Storage Location referential integrity;
- move/unassign storage behavior without identity mutation.

## PIS3 — Dataset / workbook persistence v2

Extend the canonical persisted source dataset with:
- `storageLocations`;
- `molds`.

Update:
- source snapshot service;
- atomic hydration service;
- dataset validation/cloning;
- workbook schema;
- workbook export/import;
- compatibility/migration registry;
- row/reference validation;
- session composition.

Required canonical sheets:
- `StorageLocations`;
- `Molds`.

Required regression:
- v2 round-trip fidelity;
- v1 workbook migrates with empty storage/mold collections;
- invalid parent/product/location references reject atomically;
- failed import must not partially replace live repositories.

## PIS4 — Product QR & barcode labels

Enhance the existing Product label dialog/renderer:
- optional QR code;
- optional Code 128 barcode;
- live preview representation;
- printed SVGs generated from Product ID;
- exact millimeter label presets retained;
- copies retained;
- category/status options retained;
- small-label layouts remain readable and fail clearly if a selected content combination cannot fit safely.

## PIS5 — Mold & Storage workspace UI

Extend the Products workshop with dedicated views:
- `Molds`;
- `Storage`.

### Molds view

Provide:
- create/edit/archive mold;
- select owning Product;
- assign/move/unassign Storage Location;
- show current Rack / Shelf / Bin path;
- search/filter;
- `Print mold label`.

Mold label must support:
- mold name;
- Mold ID;
- owning Product ID/name;
- current storage path when assigned;
- QR code;
- Code 128 barcode;
- size/copies controls.

### Storage view

Provide:
- create/edit/archive rack/shelf/bin;
- parent selection constrained by hierarchy;
- path preview;
- search/filter;
- `Print storage label`.

Storage label must support:
- location name/type;
- Location ID;
- full human-readable path;
- QR code;
- Code 128 barcode;
- size/copies controls.

## PIS6 — Validation & completion gate

Focused tests must cover:
- domain validation and hierarchy rules;
- duplicate IDs;
- cycle prevention;
- mold/product/location referential integrity;
- move/unassign semantics;
- dataset snapshot/hydration;
- workbook v2 import/export;
- v1 -> v2 migration;
- QR SVG generation;
- Code 128 SVG generation;
- product label machine-readable options;
- mold label contents;
- storage label contents;
- Products workspace navigation and CRUD paths;
- printing remains non-destructive.

Completion requires:
- TypeScript PASS;
- full regression suite PASS;
- production build PASS;
- feature CI PASS;
- exact diff review;
- PR to `develop`;
- PR CI PASS;
- guarded merge with expected head SHA;
- post-merge `develop` CI PASS.

## Non-goals

- direct USB / serial / Bluetooth printer discovery;
- silent/default printer selection;
- raw TSPL/ZPL/CPCL/ESC-POS command output;
- Tauri native direct printing;
- camera/scanner input workflow;
- mold maintenance lifecycle / wear counters;
- stock deduction from scanning or printing;
- automatic production transactions.

Those remain follow-up capabilities built on this persisted identification foundation.
