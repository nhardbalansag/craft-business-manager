# Business insights and proposals

Open **Business insights** in the application drawer. The workspace is loaded on demand and retained while switching workshops, including working form edits. Profile, scenario and proposal edits save to SQLite after a one-second pause; expenses and generated documents use an explicit save. The save status distinguishes working changes, durable records, and failed saves. A database backup flushes pending business edits before exporting.

## First-release workflow

1. Create or import saved receipt history in Transactions. Quotations do not count as sales.
2. Complete Business profile, including record coverage, funding uses, milestones, and risks. An optional cash starting point represents the balance at the **start** of its date in SGT.
3. Record operating expenses and cash movements in Expenses & cash. An entry's recognition date and cash movement date can differ. Unpaid operating expenses affect the indicative result, but not cash.
4. Choose report dates or a month, quarter, year, or rolling twelve-month period. Overview shows sales, comparisons, margins, cash, monthly trends, and a searchable product breakdown. Its product filters affect the breakdown, not whole-business totals.
5. Enter separate Conservative, Expected, and Optimistic assumptions in Forecast. These names do not supply invented sales or growth assumptions.
6. Configure corporate, event, or reseller offers in Proposals. Search product names/codes such as `P (1pcs)`, filter categories/pictures, select all matches or individual products, and confirm quantities and selling prices. Saved default prices are resolved through the existing quantity-aware pricing service; negotiated wholesale/package unit prices can be entered manually. Quantity changes clear a price for review. Internal costs are excluded from the customer document.
7. In Documents, generate a business report, investor summary, business and growth plan, or customer proposal. Choose a forecast for investor/growth documents. The preparation checklist is included when evidence or business information is missing.
8. Review the sandboxed preview, then print/save PDF, download an actual editable `.docx`, download figures as CSV, or download an HTML copy. A ZIP document pack includes Word, HTML, CSV, a frozen JSON source snapshot and instructions. This ZIP is a sharing artifact, not an importable database backup.

For proposed investor profit-sharing terms, use the separate **Investor proposals** tab. It calculates three scenarios, capped distributions, recovery and gain from reviewed historical data, manual assumptions or an existing forecast, and generates downloadable PDF and Word proposals. No investor account or actual investment entry is created. See [Investor Proposal Generator instructions and calculation rules](INVESTOR_PROPOSALS.md).

## Calculation and evidence rules

- Sales use saved receipt totals after discount on the sale's SGT date. Discounts are allocated to item sales while preserving exact receipt cents. Historical saved costs are used; current catalog costs are never substituted for missing evidence.
- A receipt with missing product costs makes aggregate gross profit and the indicative result unavailable. Known cost subtotals remain available internally.
- The previous comparison covers the same number of calendar days immediately preceding the selected period. No percentage growth is shown when the prior period has no sales.
- Cash uses managed transaction movement dates, or the original applied payment capped at the sale total when no management entry exists. Paid ledger entries use their cash date. Overpayment/change is excluded. Transaction history still represents one managed movement per receipt, not an installment collection ledger.
- Operating expenses affect the indicative result whether paid or unpaid. Inventory/equipment purchases, funding and owner movements affect cash only. Loan repayment entries represent cash principal; interest can be recorded separately as an operating expense.
- Product costs may already contain allocated labor and overhead. Recording the same costs again as operating expenses can double-count them. The document explains this limitation; the result is not accounting net profit or an audited financial statement.
- Cash balances are tracked estimates from the optional opening cash date and recorded movements only. Earlier report periods have no opening/closing balance if the starting point is later than the report start. Outstanding balances are the amounts saved at sale, not live receivables.
- Repeat customers use normalized contact information, falling back to names, within the chosen period. They are not a permanent customer identity model.
- Forecasts contain twelve months, floor demand to whole units and cap units at entered monthly capacity. All sales are collected and costs paid in the same month. Funding and upfront investment occur before month one. The funding gap includes a negative pre-operating balance. Break-even is unavailable without positive unit contribution.
- Taxes, financing schedules, delayed collections, market sizing and valuations are not inferred. Written business claims come from the owner's profile. There are no AI/network calls for document narration.
- Snapshots copy their profile, report, receipt references, ledger evidence, scenario and selected thumbnail images. Later edits do not change existing documents. Large printed tables show bounded leading rows; CSV contains the full stored breakdown/evidence. Private reports contain financial information; customer proposals contain only the selling offer and profile contact details.

## SQLite and mobile backups

The primary SQLite file holds a versioned business workspace and revision in `craft_web_meta`, with SHA-256 verification of the workspace JSON. Record validation, safe money totals, bounded lengths and revision checks run before committing or accepting an imported extension. Business writes preserve catalog and transaction history, and catalog/history writes preserve business records. Restore increments the local business revision to reject stale edits from other tabs.

The Android-required tables, application ID, user version, images and state checksums retain their existing format. Web backups containing business records remain importable by the mobile branch documented in `SQLITE_STORAGE.md`. The current mobile app **does not display or preserve the web business extension when it exports a new backup**. Keep the original web `.sqlite` backup to retain expenses, forecasts and documents. Importing an older/mobile-produced backup on the web restores an empty business workspace; the restore review explains this before replacement.

Limits: 50,000 ledger entries, 12 scenarios, 100 different products per proposal, 40 document snapshots and a 16 MB business extension. Reports support up to 120 calendar months. Photos in document snapshots use validated JPEG thumbnails; external images and executable HTML are not accepted. CSV text is protected against formula injection.

## Performance and validation

The workspace, its CSS, Word generator and ZIP exporter are split into on-demand bundles. Report aggregation runs in a cancellable worker with indexed lookups and one pass through receipts/ledger entries. Lists start with 25 rows. Product search is deferred, price resolution is batched, and autosave is debounced. No chart library is needed.

Investor PDF generation and embedded fonts also load only on request. Its additive draft and snapshot records share the existing SQLite business extension; older backups remain accepted. Historical proposal saves check the source-history revision as well as the business revision.

Financial tests cover SGT boundaries, exact discount allocation, cash/sale date separation, unpaid expenses, funding classifications, unknown costs, capacity/break-even, document escaping, Word/ZIP structure, unsafe imports and spreadsheet formulas. SQLite tests cover stale writes, extension checksums, backup/restore and absence of the extension in Android-style files. UI tests cover failed-save recovery and selecting matches across bounded pages. The production browser test exercises Excel/history import, expenses, forecasting, document exports, product selection, mobile layout and a native-readable SQLite restore.
