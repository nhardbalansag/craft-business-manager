# Import an uploaded Excel workbook from Google Drive

## Daily use

1. Export/download your Craft Business Manager workbook as `.xlsx`.
2. Upload that Excel file to Google Drive and keep its original Excel format.
3. Set **Share → General access → Anyone with the link → Viewer** and allow downloads.
4. Copy the file link. Open **Workbook → Import Excel from Google Drive** in the app.
5. Paste the link and choose **Fetch Excel from Drive**. Review the filename and size.
6. Choose **Apply Drive import** and confirm replacement of the currently loaded business data.

The app downloads the original binary Excel file using Google's Drive API `files.get?alt=media`.
There is no Google Sheets conversion, published-sheet export, or third-party CORS proxy.
Standard Drive `/file/d/.../view`, `open?id=...`, and `uc?id=...` links are supported, including
resource keys. A `docs.google.com/spreadsheets/d/.../edit` compatibility-view link is accepted
only when Drive metadata confirms that its underlying file remains an uploaded `.xlsx`.
Folders, shortcuts, native Google Sheets, `.xls`, and `.xlsm` files are rejected.

Fetching is read-only and never changes the live workspace. Apply uses the same compatibility,
schema, business-data validation, atomic hydration, and browser autosave path as local Excel
import. The **Maximum workbook size** preference applies to metadata preflight, actual streamed
download size, and validation at Apply. Failed requests leave the current workspace unchanged.

The last successfully fetched link is remembered locally, but the app never automatically
re-imports it on startup. To preserve the same link when updating the source, use Drive's
**File information → Manage versions → Upload new version** for that file. Fetch again for a fresh snapshot.
Changes in the app are saved locally; they are not written back to the Drive file.

## One-time setup

Google Drive's public preview/download page is not used as a cross-origin fetch endpoint.
Anonymous API access to link-shared files requires a Google Cloud **browser API key**:

1. Create/select a Google Cloud project and enable **Google Drive API**.
2. Create an API key. Apply an API restriction for **Google Drive API** and a website restriction
   for the app's allowed HTTP referrers, for example `https://mylovelycraft.coresite.pro/*`.
   Add the local development origin separately when needed.
3. Configure the site once by copying `.env.example` to `.env`, setting
   `VITE_GOOGLE_DRIVE_API_KEY`, and rebuilding/redeploying the static app.
4. Alternatively, use **One-time Google Drive API setup** inside Workbook tools to save the
   browser key on this device without rebuilding. A browser override takes precedence over
   the site default. **Clear browser key** removes only that override.

Browser API keys are public client configuration, not permission to read private Drive files.
Never put service-account private keys, OAuth client secrets, or access tokens in this setting.
Keys are sent only to `https://www.googleapis.com`; they are not included in displayed source
links, pending selection metadata, error reports, exports, or workspace snapshots.
Anyone with the sharing link can read the workbook. Private files require a different signed-in
integration and are not supported by this public-link importer.

## Troubleshooting

- **Setup error:** enable Drive API, check the browser key and HTTP referrer restrictions.
- **HTTP 401/403/404:** check the file link, public Viewer access, and download permission.
- **Quota limit:** wait for Google's quota to recover and fetch again.
- **Size limit:** increase Maximum workbook size and fetch again; downloads are also bounded
  while streaming if metadata or Content-Length does not provide the actual size.
- **File changed/incomplete download:** fetch again before applying.
- **Validation rejection:** review the original workbook issue details; the selected snapshot
  stays pending and the existing workspace remains intact.

Reference documentation:

- [Google Workspace API key credentials](https://developers.google.com/workspace/guides/create-credentials#api-key-credentials)
- [Drive binary downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
- [Drive resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys)
- [Upload a new version in Drive](https://support.google.com/drive/answer/2409045)
