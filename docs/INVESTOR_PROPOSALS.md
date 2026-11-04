# Investor Proposal Generator

Open **Business insights → Investor proposals**. This is an owner document tool. The recipient needs no account or login. Creating, saving or exporting a proposal does not record investment capital, expenses, investor balances, ownership, or payments.

## Prepare and share a proposal

1. Complete **Business profile** with the business name, description, contact details and risks. These details appear in the proposal.
2. Enter the investor's name, proposal date, projected start month, proposed capital, investor share, business reserve, term in months, and maximum cumulative payout. The cap includes the original capital and any gain; it must be at least the proposed capital. There is no separate automatic principal refund.
3. Choose a projection source and explain its assumptions and financial record coverage. Add the proposed use of funds, relevant risks, and additional conditions.
4. Review the Conservative, Moderate and Optimistic sales-volume, product-cost and monthly-growth adjustments. The starting 80%/100%/120% volume factors are illustrative owner assumptions, not probabilities or historical growth findings.
5. Select **Preview investor proposal**. Review monthly payouts, annual totals, capital recovery, net gain, reserves and the amount retained by the business. A payout can be zero, and capital may remain unrecovered when the term ends.
6. Download a real **PDF** or editable **Word (.docx)** file for printing or attachment through Messenger or email. Files are generated locally in the browser. Fonts are embedded in the PDF; no external document service receives the data.
7. Select **Save proposal snapshot** to keep the frozen terms and inputs under **Documents** and in SQLite backups. Later draft or forecast changes do not rewrite that snapshot. Saved proposals also support the existing HTML, CSV, Word and ZIP review-pack exports.

The draft autosaves with the business workspace. Editing a projection input clears its preview so the owner can review the changed figures. The separate save action retains a document snapshot. A downloaded PDF or Word file is a sharing document, not a restorable database backup.

## Projection sources

| Source | Inputs and limits |
| --- | --- |
| Recorded business history | Uses the existing reporting service's saved receipt sales, historical product costs and recorded operating expenses. Select complete calendar months ending before the proposal date. Zero-activity months remain in the average. At least one saved receipt and complete product-cost evidence are required. The owner must confirm expense coverage, including any zero-expense months. Fewer than three months is flagged as limited history. |
| Manual monthly assumptions | Enter monthly sales, product costs and operating expenses when history is insufficient or a different operating plan is proposed. The document identifies them as owner assumptions. No production-capacity limit is inferred. |
| Existing business forecast | Reuses the existing forecast service's unit selling price, variable unit cost, fixed expenses and entered monthly production capacity. Scenario volume and cost adjustments apply to those inputs, using the proposal start month and growth assumptions. Whole-unit demand is capped by capacity. Funding, opening cash and upfront investment are not investor profit. |

Missing historical product costs are never replaced with current catalog costs or assumed zero. Expenses can be incomplete, and saved product costs may already include labor or overhead. Review these records to avoid counting the same costs twice. Revenue and indicative profit are not audited net profit, legally distributable profit, or proof of available cash. These estimates do not model tax, collection delays or automatic returns from reinvesting the reserve.

## Distribution model, version 1

Money is rounded in cents. Each modeled month:

1. Estimated profit = sales − product costs − operating expenses.
2. A negative result carries forward. Later positive profit first absorbs losses incurred earlier in this modeled term.
3. The configured reserve percentage is set aside from the remaining positive profit.
4. Investor entitlement = remaining distributable profit × investor share percentage.
5. Estimated payout = the smaller of that entitlement and the unused cumulative payout cap. Payouts stop at the cap or the end of the term. No payout is projected during a loss-making month.
6. Business retention = estimated profit − the investor payout. This includes the reserve, recovered losses, the business's remaining share, and any entitlement above the cap. A negative retained amount is a business loss.

Capital recovery is the first month-end when cumulative distributions reach the original contribution. Net investment gain is total distributions minus original capital and can be negative. Unrecovered capital is the remaining shortfall. The average monthly payout divides all payouts by the full term, including zero-payment months; it is not a fixed monthly entitlement. Annual figures use consecutive 12-month blocks from the start month and explicitly label a shorter final year.

For example, PHP 20,000 sales less PHP 8,000 product costs and PHP 2,000 operating expenses gives PHP 10,000 estimated profit. With a 30% reserve and 25% investor share, PHP 3,000 is reserved, PHP 1,750 is the uncapped investor payout, and PHP 8,250 stays in the business. A PHP 10,000 contribution and PHP 14,000 cumulative cap permits up to PHP 4,000 net gain; reaching that cap is not assured.

Every proposal distinguishes estimated earnings from guaranteed payments. Actual payments depend on actual distributable profit, available cash and a separate written agreement. The model considers one proposed investor independently. Existing business losses and other investor obligations are not imported automatically. Profit-sharing is not a stated ownership percentage. Capital can be lost or remain unrecovered; termination, tax and other rights must be agreed separately.

## Persistence and development

- The draft and document kind are additive optional fields in the existing version-1 business workspace. Older web/mobile backups without these fields remain valid. No catalog/mobile tables, application ID, database user version or mobile backup contract changed.
- Web SQLite backups retain the draft and saved snapshots. The current Android app can import the database but does not display or preserve the web business extension when exporting a new backup. Keep the original web backup. See [SQLite and mobile backup details](BUSINESS_INSIGHTS.md#sqlite-and-mobile-backups).
- History-derived snapshot saves recheck the inputs and transaction-history revision before committing. Business/catalog revision protections remain in place. Proposal writes only change business draft/document records.
- `InvestorProposalSnapshot.modelVersion = 1` freezes the calculation contract. Future changes to distribution rules must use a new supported model version and preserve rendering of existing version-1 snapshots.
- Report aggregation stays in the existing cancellable worker. The PDF engine, fonts, Word generator and document exporters load on demand. Investor calculations operate on compact financial inputs rather than catalog images or customer lists.

Validation covers cents, loss recovery, payout caps, partial periods, historical evidence, forecast capacity reuse, document escaping, real PDF/Word downloads, unchanged ledgers, and SQLite backup/restore. PDF and Word layouts are visually checked using generated documents.
