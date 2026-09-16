# Public Google Sheets Import — Development Plan

Status: PLANNING BASELINE

## Goal

Add a first Google Sheets integration that can import a publicly published Google spreadsheet into Craft Business Manager without Google sign-in, OAuth, API keys, or a second persistence model.

## Scope

### G1 — Public source boundary

- Accept only `https://docs.google.com/spreadsheets/d/e/<published-id>/pubhtml` or equivalent published `/pub` URLs.
- Normalize the source to the published XLSX representation.
- Fetch with browser credentials omitted so the capability cannot silently depend on a signed-in Google session.
- Keep fetched bytes pending until the user explicitly confirms import.
- Delegate workbook parsing, version compatibility, validation, and hydration to the existing `PersistenceCoordinator`.

### G2 — Workbook tools UI

- Add a Public Google Sheets panel inside the existing Workbook tools disclosure.
- Explain that the entire spreadsheet must be **Published to the web**.
- Make it clear that this first version is read-only snapshot import, not live sync and not write-back.
- Show fetch/import readiness, errors, source identity, and fetched byte size.
- Successful import refreshes the existing workspace and persistence session status exactly like local XLSX import.

### G3 — Validation and completion gate

- URL parser/normalization tests.
- Fetch failure, HTTP failure, empty response, and explicit-apply tests.
- UI tests for load, clear, apply, rejection, and success.
- App integration test proving successful Google Sheets import updates the compact Workbook identity and workspace revision.
- Full typecheck, regression suite, production build, PR CI, guarded merge, and post-merge CI.

## Non-goals for this first version

- Private Google Sheets.
- Google OAuth.
- Google Sheets API credentials.
- Editing or writing back to Google Sheets.
- Automatic/live synchronization.
- Treating arbitrary public CSV layouts as Craft Business Manager data.

## Data contract

The Google spreadsheet must represent the existing Craft Business Manager workbook contract. Google Sheets is only a transport/source. The authoritative `BusinessDataset`, workbook schema/version checks, validation, and hydration rules remain unchanged.

## Safety / truthfulness

A successful public Google Sheets fetch does not change live app data. Only explicit Apply Import may hydrate repositories. Rejected or failed imports must preserve current live data. The browser capability makes no claim that a public Google Sheet is private, authenticated, writable, synchronized, or backed up.
