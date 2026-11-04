# Workbook downloads

Database tools offers two XLSX downloads:

- **Download workbook** includes catalog records and product pictures.
- **Download workbook without pictures** creates a smaller catalog copy for large photo collections. It preserves all other exported fields. The saved catalog and its pictures are unchanged. Importing this smaller copy does not restore pictures, so retain a SQLite backup.

XLSX remains an optional interchange format. Use **Download SQLite backup** for a complete backup including pictures, transaction history and Business insights. No primary storage or mobile SQLite file contract has changed.

## Long text

SQLite supports text values longer than Excel's 32,767 UTF-16 code-unit cell limit. Previously a single such value could abort the complete XLSX download with the generic “Current business source state could not be exported to XLSX” message.

The Excel codec now splits oversized values into bounded fragments in a hidden `_CraftLongText` sheet. The original cell contains a readable preview and continuation reference; the complete value remains in the workbook. Normal-sized cells and existing photo fragments keep their format. Web import reassembles long values before workbook schema/domain validation, preserving Unicode and line breaks. It rejects missing fragments, missing continuation sheets, altered previews and invalid targets rather than importing shortened text.

Keep the hidden continuation sheet when editing the workbook. Edit very long fields in the app and export again. Web XLSX imports understand these continuations; for complete transfer to mobile, use the compatible SQLite backup.

## Export failure details

Export feedback now includes the underlying encoding or module-load cause. Structured validation errors identify the field/path or Excel row without dumping source values or stack traces. Module-load errors advise saving edits and reopening the app. Failed exports leave saved records unchanged; a smaller picture-free copy and complete SQLite backup remain available alternatives.

Regression checks cover fresh-browser workbook downloads, long SQLite text with pictures through real XLSX export/import, picture-free copies preserving stored photos, failed module loads, Unicode boundaries, missing continuations and actionable validation messages.
