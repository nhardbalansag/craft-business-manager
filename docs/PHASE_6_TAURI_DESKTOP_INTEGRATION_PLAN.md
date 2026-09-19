# Phase 6 — Tauri Desktop Integration Development Plan

Status: SCOPED / IMPLEMENTATION NOT STARTED

Planning baseline:
- `develop`: `7336f7fad57410a8e9888344c240590bae20f59f`
- post-merge CI: `35182152823 — SUCCESS`

## Purpose

Move Craft Business Manager from a browser-hosted React/Vite workspace into a desktop-capable Tauri application while preserving the completed domain, application, workbook, validation, hydration, and persistence boundaries.

Phase 6 is a platform integration phase. It must not move business rules into Rust, duplicate workbook parsing, or create a second persistence model.

## Scope-review findings

### Existing boundaries are ready for native integration

The existing `WorkbookTransport` contract already owns byte persistence semantics separately from workbook/business logic. It exposes:
- load/save of workbook bytes;
- backup support capability;
- staged-replacement capability;
- atomic vs direct-non-atomic replacement guarantee;
- structured save failure stage/code;
- explicit committed vs not-committed failure state.

`PersistenceCoordinator` already owns the canonical workflow:
- source snapshot;
- workbook export;
- transport save/load;
- workbook import/version compatibility;
- validation;
- atomic repository hydration.

Therefore Phase 6 must provide native adapters around these contracts rather than change them without demonstrated need.

### Browser workflows stay separate

Existing browser commands are intentionally browser-specific:
- `BrowserWorkbookImportCommand` owns browser file selection/read and delegates apply to `PersistenceCoordinator`;
- `BrowserWorkbookExportCommand` owns browser download mechanics and delegates workbook creation to `PersistenceCoordinator`.

Desktop Open / Save / Save As must be implemented as separate native application/UI boundaries. Browser download semantics must not be relabeled as native save semantics.

### Tauri readiness is partial only

Current repository state:
- `@tauri-apps/api` is already a runtime dependency;
- Vite already uses the conventional strict dev port `1420`;
- `.gitignore` already excludes `src-tauri/target/`;
- no `src-tauri/` native project currently exists;
- no Tauri CLI script/dependency exists;
- no current application source uses `@tauri-apps`;
- CI currently validates Node/TypeScript/Vitest/Vite only and has no Rust/Tauri job.

This means Tauri shell bootstrap is a real implementation task and must precede native filesystem work.

## Architecture decisions

### 1. Tauri v2 is the desktop boundary

Use Tauri v2 and retain React/Vite as the frontend.

The frontend remains responsible for:
- UI state and dialogs/workflow orchestration;
- calling application services;
- presenting persistence outcomes and recovery guidance.

Rust remains responsible only for native/platform concerns that require stronger OS semantics.

### 2. Native safe-save is Rust-backed

Implement a TypeScript `TauriWorkbookTransport` that satisfies the existing `WorkbookTransport` interface and calls narrowly scoped Tauri commands.

Rust commands own:
- native file read;
- staged temporary-file write;
- flush/sync policy;
- optional backup creation;
- replacement/rename behavior;
- staging cleanup;
- lock/concurrency checks where supported;
- platform-specific error classification.

Do not put XLSX parsing, `BusinessDataset`, source repositories, validation, or hydration in Rust.

### 3. Native dialogs and transport are separate concerns

Native Open / Save As dialog selection returns a user-selected workbook path.

A selected path is then bound to a `TauriWorkbookTransport` instance. This keeps path choice out of `PersistenceCoordinator` and preserves the existing transport-neutral coordinator API.

### 4. Least-privilege Tauri capabilities

Tauri v2 capabilities/permissions must be explicit and minimal.

Prefer:
- dialog permissions only for the main desktop window;
- dedicated Rust commands for workbook filesystem operations;
- no blanket filesystem access from arbitrary frontend code;
- no shell execution permission unless a later approved feature requires it.

### 5. Platform guarantees must be truthful

`WorkbookTransport.capabilities.replacement` must reflect the real guarantee of the native implementation on the active platform.

Do not claim atomic replacement, durability, or locking unless the implementation and tests establish it.

Where guarantees differ by platform, document and expose the weaker truthful capability rather than hiding the difference.

## Phase 6 task map

```text
6.0 — Scope, Readiness & Architecture Contract                 COMPLETE (planning only)
6.1 — Tauri Shell, Build & Security Foundation                 NEXT / NOT STARTED
    6.1A — Tauri v2 Project Scaffold & Dev/Build Scripts
    6.1B — Minimal Capability / Permission Baseline
    6.1C — Native Build & CI Smoke Gate

6.2 — Native Workbook Transport                                NOT STARTED
    6.2A — Native Command / TypeScript Transport Contract
    6.2B — Native Workbook Load Path
    6.2C — Staged Save, Backup & Replacement Transaction
    6.2D — Durability, Cleanup & Error Mapping

6.3 — Desktop Workbook Open / Save / Save As Workflow          NOT STARTED
    6.3A — Native Open Workflow
    6.3B — Native Save As Workflow
    6.3C — Save to Active Workbook Path
    6.3D — Desktop Workbook Session Identity & UI State

6.4 — Recovery, Concurrency & Filesystem Safety                NOT STARTED
    6.4A — Backup Location / Naming / Retention Policy
    6.4B — External Change & Concurrent Access Policy
    6.4C — Crash / Interrupted-Save Recovery Policy
    6.4D — Recovery UX & Failure-State Regression

6.5 — Desktop Integration & Operational UX                     NOT STARTED
    6.5A — Browser-vs-Desktop Runtime Composition
    6.5B — Unsaved/Dirty-State & Close/Open Guard Policy
    6.5C — Native Path / Recent-Workbook UX Boundary
    6.5D — Desktop Security / Permission Review

6.6 — Packaging, Platform Validation & Completion Gate         NOT STARTED
    6.6A — Desktop Bundle Configuration
    6.6B — Native CI / Platform Test Matrix
    6.6C — Installer / Distribution Smoke Validation
    6.6D — Phase 6 Regression & Completion Gate
```

## 6.0 — Scope, Readiness & Architecture Contract — COMPLETE

This planning task establishes:
- native shell does not own business rules;
- `PersistenceCoordinator` remains authoritative for workbook/business lifecycle;
- `WorkbookTransport` remains the native persistence seam;
- Rust owns native safe-save/durability semantics;
- browser import/export remains available as a distinct browser workflow;
- Tauri permissions must be least-privilege;
- Phase 6 is decomposed before implementation.

No runtime code is changed by 6.0.

## 6.1 — Tauri Shell, Build & Security Foundation — NEXT

### 6.1A — Tauri v2 Project Scaffold & Dev/Build Scripts

Add the minimal native project:
- `src-tauri/` scaffold;
- Tauri v2 Rust dependencies;
- Tauri CLI development dependency;
- `tauri dev` / `tauri build` npm scripts;
- correct Vite dev URL and frontend build output configuration;
- application identity/bundle identifier/icon placeholders as required by Tauri;
- minimal main window that renders the existing application unchanged.

Non-goals:
- no native workbook save yet;
- no filesystem commands yet;
- no new business behavior.

Gate:
- browser `npm run build` remains green;
- `tauri build` or an approved no-bundle native build smoke succeeds in CI-supported environment;
- existing regression suite remains green.

### 6.1B — Minimal Capability / Permission Baseline

Establish:
- Tauri v2 capability file(s);
- main-window-only permissions;
- only core permissions needed for the shell;
- no unrestricted filesystem/shell scope;
- documented permission expansion rule for later tasks.

Gate:
- application launches with the minimal capability set;
- unnecessary native privileges are absent.

### 6.1C — Native Build & CI Smoke Gate

Extend CI with native prerequisites and a deterministic Tauri smoke build.

Keep existing Node validation unchanged and add native validation rather than replacing it.

Gate:
- TypeScript PASS;
- full browser regression PASS;
- Vite production build PASS;
- Rust compile/check PASS;
- Tauri smoke build PASS.

## 6.2 — Native Workbook Transport

### 6.2A — Native Command / TypeScript Transport Contract

Define narrow Tauri commands and typed frontend adapter for:
- load workbook bytes from bound path;
- save workbook bytes to bound path using `WorkbookSaveOptions`;
- return `WorkbookSaveReceipt`-compatible native outcomes;
- map native failures into the existing transport failure taxonomy.

Do not expose arbitrary application-wide filesystem APIs merely to satisfy this adapter.

### 6.2B — Native Workbook Load Path

Implement:
- binary read of `.xlsx` path;
- defensive byte ownership across IPC;
- file-not-found/access-denied/read-failure diagnostics;
- no workbook parsing in Rust;
- coordinator `loadCurrentWorkbook(transport)` integration tests.

### 6.2C — Staged Save, Backup & Replacement Transaction

Implement the filesystem transaction in this order:
1. inspect existing target;
2. create backup when requested/policy requires it;
3. write replacement bytes to a staging file in the appropriate filesystem location;
4. validate that staging write completed successfully;
5. commit using the platform’s selected replacement strategy;
6. clean staging artifacts;
7. return truthful backup and replacement receipts.

The old primary must remain authoritative until the commit boundary whenever the platform permits this guarantee.

### 6.2D — Durability, Cleanup & Error Mapping

Decide and test:
- file flush / sync behavior;
- directory sync where relevant and supported;
- rename/replace behavior on supported desktop OSes;
- post-commit cleanup failure semantics;
- pre-commit rollback/cleanup behavior;
- exact capability reporting.

Gate:
- Phase 5 safe-save lifecycle tests have native equivalents for all meaningful failure stages.

## 6.3 — Desktop Workbook Open / Save / Save As Workflow

### 6.3A — Native Open Workflow

Use native file dialog with `.xlsx` filtering.

Required behavior:
- cancel is non-destructive;
- selected path is not considered active until import/hydration succeeds;
- invalid workbook does not replace current live state or active workbook identity;
- successful open binds the active native transport/path.

### 6.3B — Native Save As Workflow

Required behavior:
- choose destination through native Save dialog;
- construct transport for selected path;
- save via `PersistenceCoordinator.saveCurrentWorkbook()`;
- only set the selected path as active after successful save;
- surface backup/replacement receipt truthfully.

### 6.3C — Save to Active Workbook Path

Required behavior:
- Save uses the current bound transport/path without another dialog;
- when no native path exists, Save routes to Save As;
- save failures do not silently change active identity.

### 6.3D — Desktop Workbook Session Identity & UI State

Represent separately:
- active native path;
- imported source identity;
- last successful save result/time;
- browser-downloaded copies.

UI wording must distinguish native durable save from browser download/export copy.

## 6.4 — Recovery, Concurrency & Filesystem Safety

### 6.4A — Backup Location / Naming / Retention Policy

Define deterministic backup behavior:
- backup directory location relative to primary or approved app-data location;
- collision-safe timestamp/sequence naming;
- whether backup is created for first save;
- retention count/age policy;
- cleanup failure handling.

Do not silently delete the only known-good recovery copy.

### 6.4B — External Change & Concurrent Access Policy

Define how Save behaves when the primary workbook has changed since it was opened/saved.

At minimum evaluate:
- file metadata/version fingerprint captured on successful load/save;
- pre-save recheck;
- fail-closed conflict result instead of blind overwrite;
- optional platform locking only where reliable and testable.

The application must not claim universal cross-process locking unless actually implemented across supported platforms.

### 6.4C — Crash / Interrupted-Save Recovery Policy

Define startup/open-time treatment of:
- stale staging files;
- primary missing after interrupted replacement;
- available backup with corrupt/missing primary;
- cleanup after confirmed recovery.

Recovery must be explicit and deterministic, not automatic destructive guessing.

### 6.4D — Recovery UX & Failure-State Regression

Map native failures to actionable UI states using the existing persistence/recovery vocabulary where possible.

Regression must prove:
- pre-commit failure preserves previous primary;
- committed cleanup failure reports that the new primary is authoritative;
- conflict refusal does not overwrite external changes;
- failed recovery does not destroy backup/staging evidence.

## 6.5 — Desktop Integration & Operational UX

### 6.5A — Browser-vs-Desktop Runtime Composition

Introduce a small runtime/platform composition boundary so:
- web/Vite browser mode keeps browser import/export tools;
- Tauri mode exposes native Open / Save / Save As;
- both modes use the same services/coordinator/domain rules.

Avoid scattered `window.__TAURI__` checks across UI components.

### 6.5B — Unsaved/Dirty-State & Close/Open Guard Policy

Define a source-state revision/dirty contract before prompting users.

Guard destructive transitions such as:
- opening another workbook;
- creating/resetting a workspace if later added;
- closing the desktop window with unsaved source changes.

Do not derive dirty state from generated XLSX byte timestamps because export metadata can vary independently of source changes.

### 6.5C — Native Path / Recent-Workbook UX Boundary

If recent files are included, persist only path/session metadata, not duplicate business source truth.

Required safety:
- missing/inaccessible recent paths fail gracefully;
- no automatic hydration of an arbitrary last path without validation;
- no credential or workbook content persisted in recent-file metadata.

### 6.5D — Desktop Security / Permission Review

Review:
- Tauri capabilities/scopes;
- command input validation;
- path handling and traversal assumptions;
- arbitrary frontend filesystem exposure;
- CSP / webview configuration where applicable;
- update/distribution permissions if later enabled.

Gate:
- only the required desktop privileges remain enabled.

## 6.6 — Packaging, Platform Validation & Completion Gate

### 6.6A — Desktop Bundle Configuration

Configure production bundles without weakening browser/Vite validation.

Define the first supported release target(s) explicitly in this task before claiming cross-platform support.

### 6.6B — Native CI / Platform Test Matrix

CI must separate:
- platform-neutral domain/application/tests;
- Rust/native unit tests;
- Tauri build smoke;
- OS-specific filesystem transaction tests.

OS-specific guarantees must only be asserted on the OS where they are tested.

### 6.6C — Installer / Distribution Smoke Validation

Validate at least:
- clean install;
- app launch;
- Open existing workbook;
- Save As new workbook;
- Save existing workbook;
- backup/recovery behavior;
- application restart and reopening a saved workbook;
- uninstall/update implications for user workbook data.

Code signing/release automation may be configured here once the intended release channel is chosen.

### 6.6D — Phase 6 Regression & Completion Gate

Completion requires:
- all Phase 1–6 tests PASS;
- TypeScript PASS;
- browser production build PASS;
- Rust/native tests PASS;
- Tauri production build/bundle PASS for declared supported target(s);
- native persistence integration PASS;
- exact diff review;
- feature/child PR CI PASS;
- guarded merge with expected head SHA;
- exact post-merge `develop` CI PASS;
- Phase 6 documentation reconciled.

## Security model

Phase 6 follows least privilege:
- no shell access by default;
- no broad home-directory filesystem permission merely for convenience;
- file dialog selection and dedicated native workbook commands are the intended user-file boundary;
- command arguments are validated on the Rust side;
- workbook bytes remain untrusted until the existing importer/validator accepts them;
- native integration does not bypass XLSX resource limits or dataset validation.

## Persistence invariants that Phase 6 must preserve

1. Workbook bytes are not authoritative until import/validation/hydration succeeds.
2. Derived costing/yield/capacity/pricing/production values remain recalculated, not persisted as source truth.
3. Failed import/hydration never partially mutates live repositories.
4. Failed native save before commit must not replace the previous primary.
5. Backup and replacement guarantees are reported truthfully by the transport.
6. Native filesystem concerns remain outside workbook/domain code.
7. Browser and desktop workflows may share the coordinator but not pretend to have identical durability semantics.
8. Physical-identification workbook v2 and legacy v1 compatibility remain supported.

## Deferred / non-goals for Phase 6

Unless separately approved, Phase 6 does not include:
- cloud synchronization;
- multi-user collaboration;
- database migration from XLSX;
- automatic background save;
- direct raw printer drivers/USB/Bluetooth printing;
- barcode scanner/camera workflow;
- automatic application updater;
- mobile Tauri targets;
- new business costing/production features.

## Current next action

```text
6.1A — Tauri v2 Project Scaffold & Dev/Build Scripts
NEXT / NOT STARTED
```

Do not begin 6.2 native filesystem behavior until the 6.1 shell/build/security foundation is merged and green.
