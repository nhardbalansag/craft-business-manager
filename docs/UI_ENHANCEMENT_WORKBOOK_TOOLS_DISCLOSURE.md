# Workbook Tools Disclosure UI Enhancement

Status: IMPLEMENTED ON FEATURE BRANCH

## Goal

Keep workbook persistence controls available without permanently occupying the top of every business workspace.

## UX Change

The previous always-visible surfaces:

- Persistence Status
- Data File / Open Import
- Save a Copy / Download Workbook

are now grouped inside a compact **Workbook** disclosure in the sticky application header.

The disclosure is closed by default. Its compact header state shows the active imported workbook filename when known, otherwise `No workbook imported`.

Opening the disclosure reveals the existing persistence status, import, and export panels inside a scrollable popover. The existing Phase 5 import/export/session-status contracts are reused unchanged.

## Behavior Preserved

- import selection remains non-destructive until confirmation;
- successful import still refreshes the repository-backed workspace exactly once;
- rejected or failed imports do not replace the existing workspace;
- browser export still downloads a new copy and does not claim native overwrite or backup behavior;
- session status remains browser-session metadata only;
- all existing persistence diagnostics and recovery guidance remain available.

## Responsive Behavior

Desktop/tablet shows the Workbook control with the imported filename. On narrow mobile layouts it reduces to a compact icon control while the opened popover remains viewport-bounded and scrollable.

## Validation

Dedicated disclosure regression coverage verifies:

- workbook tools are collapsed by default;
- all three persistence surfaces remain present inside the disclosure;
- the disclosure opens and closes from the header control.

Full repository regression, typecheck, and production build must remain green before merge.
