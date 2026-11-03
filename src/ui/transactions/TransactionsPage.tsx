import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  loadTransactionHistory,
  saveTransactionHistory,
  type TransactionHistorySnapshot,
} from './transactionHistoryStore';
import {
  emptyTransactionArchive,
  mergePortableTransactions,
  readPortableTransactions,
  scopePortableTransactions,
  transactionPicture,
  type PortableTransactionArchive,
} from './portableTransactions';
import { createTransactionArchive } from './transactionArchive';
import {
  defaultTransactionFilters,
  effectiveTransaction,
  filterTransactionQuotations,
  filterTransactionReceipts,
  managedTransactions,
  transactionDay,
  transactionSummary,
  type TransactionEntry,
  type TransactionFilters,
} from './transactions';
import { transactionWorkbook } from './transactionWorkbook';
import { printTransactionFinancialReport } from './transactionReport';
import type { SavedCustomerReceipt } from './models';
import './transactions.css';

const money = (value: number | null) =>
  value === null ? 'Not available' : `PHP ${value.toFixed(2)}`;
export function TransactionsPage({
  load = loadTransactionHistory,
  save = saveTransactionHistory,
}: {
  load?: typeof loadTransactionHistory;
  save?: typeof saveTransactionHistory;
}) {
  const [snapshot, setSnapshot] = useState<TransactionHistorySnapshot>({
    revision: 0,
    archive: emptyTransactionArchive(),
  });
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [filters, setFilters] = useState<TransactionFilters>(
    defaultTransactionFilters
  );
  const [kind, setKind] = useState<'receipts' | 'quotations'>('receipts'),
    [page, setPage] = useState(1),
    [includeQuotations, setIncludeQuotations] = useState(true);
  const [review, setReview] = useState<{
    name: string;
    archive: PortableTransactionArchive;
  } | null>(null);
  const [selected, setSelected] = useState<SavedCustomerReceipt | null>(null),
    [entry, setEntry] = useState<TransactionEntry | null>(null),
    [amount, setAmount] = useState('');
  const occupied = useRef(false),
    mounted = useRef(true),
    detail = useRef<HTMLElement>(null);
  useEffect(() => {
    mounted.current = true;
    load()
      .then((value) => {
        if (mounted.current) {
          setSnapshot(value);
          setReady(true);
        }
      })
      .catch((cause) => {
        if (mounted.current) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Transaction history could not be loaded.'
          );
        }
      });
    return () => {
      mounted.current = false;
    };
  }, [load]);
  async function perform(label: string, action: () => Promise<void>) {
    if (occupied.current) return;
    occupied.current = true;
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'The transaction operation failed. Existing history is unchanged.'
        );
    } finally {
      occupied.current = false;
      if (mounted.current) setBusy('');
    }
  }
  const view = useMemo(() => {
    try {
      const receipts = filterTransactionReceipts(snapshot.archive, filters),
        quotations = filterTransactionQuotations(snapshot.archive, filters);
      return {
        receipts,
        quotations,
        summary: transactionSummary(
          receipts,
          snapshot.archive.transactionEntries
        ),
        error: '',
      };
    } catch (cause) {
      return {
        receipts: [],
        quotations: [],
        summary: null,
        error: cause instanceof Error ? cause.message : 'Invalid filters',
      };
    }
  }, [snapshot, filters]);
  const preview = useMemo(
    () =>
      review
        ? mergePortableTransactions(snapshot.archive, review.archive)
        : null,
    [snapshot, review]
  );
  const locked = !!busy || !ready;
  const count =
      kind === 'receipts' ? view.receipts.length : view.quotations.length,
    pages = Math.max(1, Math.ceil(count / 25)),
    currentPage = Math.min(page, pages);
  const period = `${
    filters.dateBasis === 'sale' ? 'Sale date' : 'Movement date'
  }: ${filters.from || 'beginning'} to ${filters.to || 'latest'} (SGT) · ${
    filters.direction
  }${filters.query ? ` · Search: ${filters.query}` : ''}`;
  function filter(change: Partial<TransactionFilters>) {
    setFilters((value) => ({ ...value, ...change }));
    setPage(1);
  }
  async function inspect(file: File) {
    await perform('Reading transaction archive…', async () => {
      const archive = await readPortableTransactions(file);
      if (mounted.current) setReview({ name: file.name, archive });
    });
  }
  function choose(receipt: SavedCustomerReceipt) {
    const movement = effectiveTransaction(
      receipt,
      snapshot.archive.transactionEntries
    );
    setSelected(receipt);
    setEntry({ ...movement });
    setAmount(movement.amount.toFixed(2));
    setError('');
    requestAnimationFrame(() =>
      detail.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    );
  }
  async function commit(archive: PortableTransactionArchive) {
    const next = await save(archive, snapshot.revision);
    if (mounted.current) setSnapshot(next);
  }
  function manage(event: FormEvent) {
    event.preventDefault();
    if (!entry) return;
    void perform('Saving cash movement…', async () => {
      if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(amount.trim()))
        throw new Error(
          'Enter a non-negative movement amount with up to two decimal places.'
        );
      const value = {
        ...entry,
        amount: Math.round(Number(amount) * 100) / 100,
        updatedAt: new Date().toISOString(),
      };
      await commit({
        ...snapshot.archive,
        transactionEntries: managedTransactions(snapshot.archive, value),
      });
      if (mounted.current)
        setNotice(
          'Debit/credit movement saved. Original receipt and catalog remain unchanged.'
        );
    });
  }
  function download(format: 'json' | 'excel') {
    void perform('Preparing transaction download…', async () => {
      const scope = scopePortableTransactions(
        snapshot.archive,
        createTransactionArchive(snapshot.archive, filters, includeQuotations)
      );
      const json = JSON.stringify(scope);
      if (new TextEncoder().encode(json).length > 32 * 1024 * 1024)
        throw new Error('Choose a smaller date range for this export.');
      const bytes =
        format === 'excel' ? transactionWorkbook(scope, json) : null;
      const blob = new Blob([bytes ? new Uint8Array(bytes).buffer : json], {
        type:
          format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/json',
      });
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = `my-lovely-craft-transactions-${new Date()
        .toISOString()
        .slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'json'}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  function print(receipts = view.receipts, label = period) {
    try {
      setError('');
      printTransactionFinancialReport(
        receipts,
        snapshot.archive.transactionEntries ?? [],
        label
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The financial report could not be opened.'
      );
    }
  }
  function metrics(receipts: SavedCustomerReceipt[]) {
    const summary = transactionSummary(
      receipts,
      snapshot.archive.transactionEntries
    );
    return (
      <>
        <div className="transaction-metrics">
          {(
            [
              ['Credit / money in', summary.credit],
              ['Debit / money out', summary.debit],
              ['Net cash movement', summary.net],
              ['Original sales total', summary.sales],
              ['Saved product cost', summary.cost],
              ['Estimated sale profit', summary.profit],
              ['Paid toward sale', summary.received],
              ['Balance at sale', summary.balance],
            ] as const
          ).map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{money(value)}</strong>
            </article>
          ))}
        </div>
        {!!summary.unknownCostCount && (
          <p>
            {summary.unknownCostCount} receipts lack complete saved cost
            evidence. Total cost and profit remain unavailable. Known cost
            subtotal: {money(summary.knownCost)}.
          </p>
        )}
      </>
    );
  }
  return (
    <section className="transaction-page" aria-labelledby="transaction-heading">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">SALES / MOBILE HISTORY</p>
          <h1 id="transaction-heading">Transactions &amp; financials</h1>
          <p className="page-lead">
            Upload mobile receipts, review date ranges and manage money in or
            out.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={!!busy}
          onClick={() =>
            void perform('Reloading history…', async () => {
              const next = await load();
              if (mounted.current) {
                setSnapshot(next);
                setReady(true);
                setSelected(null);
                setEntry(null);
              }
            })
          }
        >
          Reload history
        </button>
      </div>
      <p>
        History is saved in this browser separately from your workbook.
        Uploading files appends records and never replaces catalog data. Keep a
        downloaded archive when moving devices or browsers.
      </p>
      {busy && <p role="status">{busy}</p>}
      {(error || view.error) && (
        <p className="feedback feedback-error" role="alert">
          {error || view.error}
        </p>
      )}
      {notice && (
        <p className="feedback" role="status">
          {notice}
        </p>
      )}
      <section className="transaction-panel" aria-label="Transaction transfer">
        <h2>Upload or download history</h2>
        <p>
          Choose transaction-only JSON or Excel exported from My Lovely Craft
          mobile. SQLite files are mobile backups.
        </p>
        <div className="transaction-actions">
          <label className="field">
            <span>Upload transaction archive</span>
            <input
              aria-label="Upload transaction archive"
              type="file"
              accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={locked}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void inspect(file);
              }}
            />
          </label>
          <button
            className="button button-secondary"
            type="button"
            disabled={
              locked ||
              !!view.error ||
              !(view.receipts.length + view.quotations.length)
            }
            onClick={() => download('json')}
          >
            Download transaction JSON
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={
              locked ||
              !!view.error ||
              !(view.receipts.length + view.quotations.length)
            }
            onClick={() => download('excel')}
          >
            Download transaction Excel
          </button>
        </div>
        <label className="transaction-check">
          <input
            type="checkbox"
            checked={includeQuotations}
            disabled={locked}
            onChange={(event) => setIncludeQuotations(event.target.checked)}
          />
          Include saved quotations and their images in downloads
        </label>
        <p>
          Downloads use the current date, search and direction filters. Excel
          includes readable tables and a hidden archive for exact restoration;
          table edits do not alter the archive.
        </p>
        {review && preview && (
          <section
            className="transaction-review"
            aria-label="Review transaction import"
          >
            <h3>{review.name}</h3>
            <p>
              {preview.stats.receiptsAdded} new receipts ·{' '}
              {preview.stats.quotationsAdded} new quotations ·{' '}
              {preview.stats.entriesAdded} new management records ·{' '}
              {preview.stats.duplicates} duplicates skipped ·{' '}
              {preview.stats.conflicts} conflicts kept local.
            </p>
            <p>
              Import considers every record in the file, regardless of the
              current filters. Existing IDs with changed content retain their
              local versions.
            </p>
            <div className="transaction-actions">
              <button
                type="button"
                className="button button-primary"
                disabled={locked}
                onClick={() =>
                  void perform('Appending transaction history…', async () => {
                    await commit(preview.archive);
                    if (mounted.current) {
                      setReview(null);
                      setNotice(
                        `Added ${preview.stats.receiptsAdded} receipts and ${preview.stats.quotationsAdded} quotations. Kept current history and catalog.`
                      );
                    }
                  })
                }
              >
                Append imported history
              </button>
              <button
                type="button"
                className="button button-secondary"
                disabled={locked}
                onClick={() => setReview(null)}
              >
                Cancel import
              </button>
            </div>
          </section>
        )}
      </section>
      <fieldset
        className="transaction-panel transaction-filters"
        disabled={locked}
      >
        <legend>Filter history</legend>
        <label className="field">
          <span>Search receipts, customers or products</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => filter({ query: event.target.value })}
            placeholder="Receipt, customer, product or code"
          />
        </label>
        <label className="field">
          <span>From date</span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => filter({ from: event.target.value })}
          />
        </label>
        <label className="field">
          <span>To date</span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => filter({ to: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Date basis</span>
          <select
            aria-label="Date basis"
            value={filters.dateBasis}
            onChange={(event) =>
              filter({
                dateBasis: event.target
                  .value as TransactionFilters['dateBasis'],
              })
            }
          >
            <option value="sale">Sale date</option>
            <option value="movement">Movement date</option>
          </select>
        </label>
        <label className="field">
          <span>Cash direction</span>
          <select
            aria-label="Cash direction"
            value={filters.direction}
            onChange={(event) =>
              filter({
                direction: event.target
                  .value as TransactionFilters['direction'],
              })
            }
          >
            <option value="all">All</option>
            <option value="credit">Credit / money in</option>
            <option value="debit">Debit / money out</option>
          </select>
        </label>
        <div className="transaction-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              const date = transactionDay();
              filter({ from: date, to: date });
            }}
          >
            Today only
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => filter({ from: '', to: '' })}
          >
            All dates
          </button>
        </div>
        <p>
          Dates include the entire day in Singapore time. Quotations always use
          their creation date.
        </p>
      </fieldset>
      <section
        className="transaction-panel"
        aria-label="Filtered transaction financial view"
      >
        <h2>Financial view · {view.receipts.length} receipts</h2>
        {view.summary && metrics(view.receipts)}
        <p>
          Debit means money out; credit means money in. Quotations are excluded
          from sales and cash totals. Estimated sale profit uses original sales
          after discount and saved product costs, independently of managed cash
          flow. Balance figures are amounts recorded at sale, not a running
          payment account.
        </p>
        <button
          type="button"
          className="button button-primary"
          disabled={locked || !!view.error || !view.receipts.length}
          onClick={() => print()}
        >
          Print / Save financial report PDF
        </button>
      </section>
      <section className="transaction-panel">
        <div className="transaction-actions">
          <h2>Saved history</h2>
          <button
            type="button"
            className="button button-secondary"
            aria-pressed={kind === 'receipts'}
            onClick={() => {
              setKind('receipts');
              setPage(1);
            }}
          >
            Receipts ({view.receipts.length})
          </button>
          <button
            type="button"
            className="button button-secondary"
            aria-pressed={kind === 'quotations'}
            onClick={() => {
              setKind('quotations');
              setPage(1);
            }}
          >
            Quotations ({view.quotations.length})
          </button>
        </div>
        <div
          className="transaction-table"
          tabIndex={0}
          role="region"
          aria-label="Transaction history"
        >
          <table>
            <thead>
              <tr>
                <th>Reference / customer</th>
                <th>Saved date (SGT)</th>
                <th>{kind === 'receipts' ? 'Sale total' : 'Quoted total'}</th>
                <th>
                  {kind === 'receipts' ? 'Cash movement' : 'Estimated profit'}
                </th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {kind === 'receipts'
                ? view.receipts
                    .slice((currentPage - 1) * 25, currentPage * 25)
                    .map((receipt) => {
                      const movement = effectiveTransaction(
                        receipt,
                        snapshot.archive.transactionEntries
                      );
                      return (
                        <tr key={receipt.id}>
                          <td>
                            <strong>{receipt.reference}</strong>
                            <small>{receipt.customerName}</small>
                          </td>
                          <td>{transactionDay(receipt.createdAt)}</td>
                          <td>{money(receipt.total)}</td>
                          <td>
                            {movement.direction === 'credit'
                              ? 'Credit / money in'
                              : 'Debit / money out'}
                            <strong>{money(movement.amount)}</strong>
                            <small>{movement.date}</small>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={locked}
                              onClick={() => choose(receipt)}
                            >
                              Financial view / Manage {receipt.reference}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                : view.quotations
                    .slice((currentPage - 1) * 25, currentPage * 25)
                    .map((quote) => (
                      <tr key={quote.id}>
                        <td>
                          <strong>{quote.customer.quotationReference}</strong>
                          <small>{quote.customer.customer.name}</small>
                        </td>
                        <td>{transactionDay(quote.createdAt)}</td>
                        <td>{money(quote.customer.total)}</td>
                        <td>{money(quote.owner.totalProfit)}</td>
                        <td>
                          {quote.customer.items.map((item) => {
                            const photo = transactionPicture(
                              snapshot.archive,
                              quote.photos[item.product.id]?.thumbnailUri
                            );
                            return photo ? (
                              <img
                                className="transaction-photo"
                                key={item.product.id}
                                src={photo}
                                alt={item.product.name}
                              />
                            ) : null;
                          })}
                          Quotation estimate
                        </td>
                      </tr>
                    ))}
            </tbody>
          </table>
          {!count && <p>No history matches these filters.</p>}
        </div>
        {pages > 1 && (
          <nav className="transaction-actions" aria-label="Transaction pages">
            <button
              type="button"
              className="button button-secondary"
              disabled={locked || currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {pages}
            </span>
            <button
              type="button"
              className="button button-secondary"
              disabled={locked || currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </section>
      {selected && entry && (
        <section
          className="transaction-panel"
          ref={detail}
          aria-label="Current transaction financial view"
        >
          <h2>
            {selected.reference} · {selected.customerName}
          </h2>
          {metrics([selected])}
          <button
            type="button"
            className="button button-secondary"
            disabled={locked}
            onClick={() => print([selected], `Receipt ${selected.reference}`)}
          >
            Print current transaction financial report
          </button>
          <h3>Original items</h3>
          <div className="transaction-table">
            <table>
              <thead>
                <tr>
                  <th>Product / code</th>
                  <th>Quantity</th>
                  <th>Sale amount</th>
                  <th>Saved cost</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      {item.name}
                      <small>{item.productId}</small>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{money(item.amount)}</td>
                    <td>{money(item.totalProductCost ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={manage}>
            <fieldset className="transaction-filters" disabled={locked}>
              <legend>Manage cash movement</legend>
              <label className="field">
                <span>Direction</span>
                <select
                  aria-label="Direction"
                  value={entry.direction}
                  onChange={(event) =>
                    setEntry({
                      ...entry,
                      direction: event.target
                        .value as TransactionEntry['direction'],
                    })
                  }
                >
                  <option value="credit">Credit / money in</option>
                  <option value="debit">Debit / money out</option>
                </select>
              </label>
              <label className="field">
                <span>Movement amount (PHP)</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Movement date</span>
                <input
                  type="date"
                  value={entry.date}
                  onChange={(event) =>
                    setEntry({ ...entry, date: event.target.value })
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Management notes</span>
                <textarea
                  value={entry.notes}
                  maxLength={1000}
                  onChange={(event) =>
                    setEntry({ ...entry, notes: event.target.value })
                  }
                />
              </label>
              <p>
                Changes update this receipt's cash movement in financial
                reports. Original receipt values, payment details, quoted prices
                and inventory are preserved.
              </p>
              <button type="submit" className="button button-primary">
                Save debit / credit update
              </button>
            </fieldset>
          </form>
        </section>
      )}
    </section>
  );
}
