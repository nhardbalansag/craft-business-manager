# SQLite storage, backups and mobile interchange

SQLite is the primary business database. The app no longer requires an Excel file or a Google Sheet to retain saved records. Excel/Drive/Google Sheets imports and optional Excel exports remain available under **Database**.

## Backup and restore

1. Save any unfinished form edits.
2. Open **Database → Download SQLite backup**.
3. Keep the downloaded `.sqlite` file outside the browser.
4. To restore it, choose **Import / restore SQLite backup**, review the product/material/photo/transaction counts, then choose **Restore this SQLite backup**.

Restore replaces the catalog and transaction history together. Checksums, SQLite integrity, schema versions, catalog relationships, transaction documents and image references are checked before replacement. Concurrent changes after review reject the restore. A failed database commit rolls the live editor back; the previous database remains intact. A successful restore retains the preceding file as an additional internal recovery copy.

The download captures the latest valid working records, including a rescue copy when the last local database write failed. It does not save unfinished form drafts. Keep the tab open when saving fails until you have recovered or downloaded a backup.

If the database cannot be opened at startup, editing stays blocked. Retry storage or select and review a `.sqlite` backup directly on that screen. Recovering an unreadable database also retains the previous raw file.

## Mobile compatibility

The format matches the existing native Android reader on:

- Repository: [nhardbalansag/IOWO-Event-Tool](https://github.com/nhardbalansag/IOWO-Event-Tool/tree/my-lovely-craft)
- Branch: `my-lovely-craft`
- Verified commit: `209ec7298921b42aa89c72dd6f5eab0133317e81`
- Contract: `android/app/src/main/java/com/iowoeventticketingapp/CraftBackupFiles.kt`, `writeSqlite` / `readSqlite`

On Android, open **Data files → Import SQLite backup** and select the downloaded file. **Import catalog only** brings in products, materials, components, recipes, pricing, stock counts and photos while preserving phone history and settings. **Restore all backup data** replaces the phone's saved state, including the backed-up transaction history. Review that choice before applying it.

The web app also accepts SQLite backups produced by that mobile format. Phone-specific settings, jobs, requests and archived image references are preserved in the portable state even where the web app has no matching editor. Existing mobile inventory movement history is retained, while managed stock balances are rebased onto web-edited catalog quantities.

Files use native SQLite application ID `0x4D4C4346`, `user_version=1`, and these shared tables:

| Table | Contents |
| --- | --- |
| `craft_meta` | Format/version, creation metadata and SHA-256 manifests |
| `craft_state_chunks` | Portable mobile-compatible app state in ordered chunks |
| `craft_records` | Ordered records for all fourteen physical-v5 source collections, with per-record hashes |
| `craft_images` | Deduplicated JPEG BLOBs addressed by SHA-256 |
| `craft_web_meta` | Web revision metadata; ignored by the Android reader |

Photos are stored as BLOBs, rather than large image strings repeated in catalog records. Portable photo references use `backup://image/<sha256>`. The web editor reconstructs its image data URLs; Android restores the same bytes to its managed photo directory.

Shared mobile limits are enforced: 256 MiB per file, 32 MiB combined state/catalog JSON, 500,000 source records, 10,000 images, 200 MiB total images, and 360,000 bytes per JPEG. Invalid legacy photo strings remain recoverable in local storage but must be replaced with a valid photo before making a mobile-compatible backup.

## Migration and browser storage

The first successful open migrates the previous workspace and separate transaction-history store into one SQLite file. Neither original store is deleted or overwritten. Failure leaves them available for retry or recovery. Subsequent edits persist only to SQLite; original legacy stores are no longer live data sources.

SQLite is compiled to WebAssembly and runs in a worker. The browser retains the resulting database file in IndexedDB, replacing it and its generation metadata atomically. In-memory business repositories are working projections hydrated from SQLite; Excel is not involved in normal saving. Conflicting tabs cannot silently overwrite each other.

This is local browser storage, not a shared server database. Use the same browser and app origin for automatic recovery, and use the downloaded backup to move between devices. Clearing site data can remove local storage. The production host must serve the emitted worker JavaScript and `.wasm` assets; use HTTPS or localhost. Device-specific appearance and import preferences remain local settings.

## Verification

```text
npm run typecheck
npm run test:run -- --maxWorkers=4
npm run build
npm run test:browser
```

The browser test uses an isolated Chrome profile and production assets. It migrates old stores, preserves photos and transaction history, downloads a SQLite backup, verifies that file independently with Python's native SQLite engine against the Android contract, imports an Excel file, restores the backup, reloads, and recovers a deliberately unreadable test database.

On Windows, the browser test uses installed Google Chrome. On other platforms install Playwright Chromium first (`npx playwright install chromium`). Python is needed for the independent native-format check. No connected Android device is required for these tests; they verify the file contract rather than claiming a device installation test.
