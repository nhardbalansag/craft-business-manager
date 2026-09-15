# Craft Business Manager

Desktop-first business costing, inventory, production-yield, production-planning, pricing, and persistence manager for a craft business producing paintable plaster art/toys, handmade candle vessels, candles, event crafts, and multi-component products.

## Project direction

The application uses **React + TypeScript + Vite** and is intended to be wrapped by **Tauri** for safe local desktop file access.

The business/domain layer remains storage-agnostic. Excel (`.xlsx`) is the first persisted business-data format, with SQLite remaining a future migration option without rewriting core business rules.

## Architecture

```text
React UI
   ↓
Application / Business Services
   ↓
Domain Models + Costing / Production / Pricing Engines
   ↓
Persistence Boundaries
   ├── BusinessDataset validation
   ├── BusinessDataset ↔ Workbook mapping
   ├── WorkbookCodec -> SheetJsWorkbookCodec
   ├── Source snapshot / hydration coordination
   ├── ExcelStorage (later Phase 5 wiring)
   └── SQLiteStorage (future)
   ↓
Tauri filesystem boundary (planned Phase 6)
```

React components do not directly manipulate spreadsheet cells or repositories for persistence.

## Implemented business foundation

Phases 1–4 are complete and include:

- canonical unit conversion and material-specific calibration;
- Material purchasing, costing, inventory and supplier/source metadata;
- Product categories, MixPresets, real-production YieldSamples, fixed recipes and safety waste;
- inventory-based production capacity and limiting-resource analysis;
- Material/Product-backed components, vessels and nested Product graphs;
- ProductStock, recursive component cost and component-aware capacity;
- Product financial profiles, fully loaded cost and pricing policies;
- planned-batch cost, revenue, profit, margin and capacity warnings;
- Materials, Products, Yield, Production and Pricing workflows.

## Excel persistence progress

### Phase 5.1 — Persisted contract foundation — COMPLETE

Provides:

- complete versioned `BusinessDataset` over all nine authoritative source collections;
- 13-sheet normalized workbook v1 contract;
- exact source representation/ordering and formula rejection;
- complete pre-hydration duplicate/reference/graph validation;
- missing-vs-zero/null fidelity and no silent repair.

### Phase 5.2 — Bidirectional XLSX codec/mapping — COMPLETE

Provides:

```text
BusinessDataset -> canonical workbook -> XLSX bytes   COMPLETE
XLSX bytes -> canonical workbook -> BusinessDataset   COMPLETE
```

- SheetJS Community Edition 0.20.3 behind `WorkbookCodec`;
- deterministic 13-sheet export;
- strict current-version import with structured diagnostics;
- normalized MixPreset/YieldSample child round-trip;
- literal formula-looking text and formula-cell fail-closed behavior;
- real-XLSX source-semantic round-trip;
- no repository mutation during import.

Latest Phase 5.2 gate:

```text
5.2C implementation PR #146  MERGED
5.2C merge                    3cd2bb280ef463b2267cafbbd28b9b9aba1fb656
5.2C post-merge CI            35012385953 — SUCCESS
87 test files / 1091 tests
```

### Phase 5.3A — Complete Source Snapshot Service — COMPLETE

One application-level read boundary now snapshots all nine authoritative repositories into one deep-cloned, deterministic current-version `BusinessDataset` without writes, defaults, or derived outputs.

```text
Implementation PR #149       MERGED
Implementation merge          2d475f0eded6acafeb03830cba768b3d84cb078d
Post-merge CI                 35019082343 — SUCCESS
```

### Phase 5.3B — Validated Atomic Dataset Hydration — IN PROGRESS

The parent plan splits hydration into:

```text
5.3B1 — Hydration Replacement Port & Repository Bulk Replace   COMPLETE
5.3B2 — Validated Atomic Hydration + Rollback                  NEXT / NOT STARTED
5.3B3 — Session/Fault Injection/Completion Gate                NOT STARTED
```

#### 5.3B1 — COMPLETE

All nine authoritative in-memory repositories now support persistence-only whole-collection replacement through:

```ts
interface CollectionReplacementPort<T> {
  replaceAll(records: readonly T[]): Promise<void>;
}
```

The implementation stages a fully cloned replacement Map before live swap, removes stale rows, clears on empty input, preserves repository object identity, isolates nested caller-owned source data, and leaves a repository unchanged if next-state preparation fails before swap.

```text
Feature head               74e70a22b2a8b24cd1cb49f44f37502a1555b53b
Feature CI                 35021376680 — SUCCESS
Implementation PR #152     MERGED
PR CI                      35021553326 — SUCCESS
Implementation merge       6abd24123c3593582fdc4767bd486b319fc2ce2c
Post-merge CI              35021692593 — SUCCESS
89 test files / 1105 tests
9 focused 5.3B1 tests
TypeScript typecheck passed
Production Vite build passed
119 modules transformed
```

The existing Vite chunk-size warning remains non-blocking at roughly 538.78 kB minified / 136.34 kB gzip.

#### 5.3B2 — NEXT / NOT STARTED

The next task will coordinate the atomic application-level hydration transaction:

```text
validate complete candidate
-> clone hydration-owned candidate
-> snapshot current live state
-> replace all nine repositories
-> success

apply failure
-> restore all nine repositories from snapshot
-> controlled restored failure

rollback failure
-> distinct severe failure diagnostic
```

No 5.3B2 runtime implementation is included in the 5.3B1 closeout.

## Remaining major Phase 5 work

- 5.3B2 validated atomic hydration + rollback;
- 5.3B3 session/fault-injection completion gate;
- 5.3C persistence coordinator and `ExcelStorage.load/save` lifecycle;
- 5.4 version migration, backup/atomic transport, corruption/resource-limit hardening;
- 5.5 persistence UI;
- 5.6 integrated round-trip/regression completion gate.

Native filesystem and dialogs remain Phase 6.

## Branching

- `main` — stable/releasable;
- `develop` — integration branch;
- `feature/*` — implementation work;
- `docs/*` — documentation/status closeout when useful.

## Current status

```text
Phase 0 — COMPLETE
Phase 1 — COMPLETE
Phase 2 — COMPLETE
Phase 3 — COMPLETE
Phase 4 — COMPLETE
Phase 5 — IN PROGRESS
```

**Current next task: Phase 5.3B2 — Validated Atomic Hydration + Rollback — NEXT / NOT STARTED.**

See:

- `docs/DEVELOPMENT_PLAN.md`
- `docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`
- `docs/PHASE_5_PROGRESS.md`
- `docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION_PLAN.md`
- `docs/PHASE_5_3B1_HYDRATION_REPLACEMENT_PORT_BULK_REPLACE.md`
