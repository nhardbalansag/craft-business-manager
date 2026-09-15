import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  productComponentService,
  productStockService,
} from '../../application/session';
import type { ProductComponent } from '../../domain/productComponents';
import type { ProductStock } from '../../domain/productStock';
import type { Product } from '../../domain/products';
import {
  buildProductStockRows,
  type ProductStockRow,
  type ProductStockRowState,
} from './productStockRows';

type ProductStockViewProps = {
  products: readonly Product[];
  catalogLoading: boolean;
};

type ActiveFilter = 'active' | 'archived' | 'all';
type StockStateFilter = ProductStockRowState | 'all';

type StockFormState = {
  onHandQuantity: string;
  notes: string;
};

const EMPTY_FORM: StockFormState = {
  onHandQuantity: '',
  notes: '',
};

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please check the stock value and try again.';
}

function stockStateLabel(row: ProductStockRow): string {
  if (row.stockState === 'missing') return 'Missing stock data';
  if (row.stockState === 'zero') return '0 pc · Zero stock';
  return `${row.onHandQuantity?.toLocaleString() ?? 0} pc on hand`;
}

export function ProductStockView({ products, catalogLoading }: ProductStockViewProps) {
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [stocks, setStocks] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [form, setForm] = useState<StockFormState>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [query, setQuery] = useState('');
  const [productStatus, setProductStatus] = useState<ActiveFilter>('all');
  const [stockState, setStockState] = useState<StockStateFilter>('all');

  const reloadStockSources = useCallback(async () => {
    setLoading(true);
    try {
      const [nextComponents, nextStocks] = await Promise.all([
        productComponentService.listComponents(),
        productStockService.listStocks(),
      ]);
      setComponents(nextComponents);
      setStocks(nextStocks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadStockSources();
  }, [reloadStockSources]);

  const rows = useMemo(
    () => buildProductStockRows(products, components, stocks),
    [components, products, stocks],
  );

  useEffect(() => {
    if (rows.length === 0) {
      if (selectedProductId) setSelectedProductId('');
      return;
    }

    const selectedStillExists = rows.some(
      (row) => comparable(row.productId) === comparable(selectedProductId),
    );
    if (!selectedStillExists) setSelectedProductId(rows[0]!.productId);
  }, [rows, selectedProductId]);

  const selectedRow = useMemo(
    () => rows.find((row) => comparable(row.productId) === comparable(selectedProductId)) ?? null,
    [rows, selectedProductId],
  );

  useEffect(() => {
    if (!selectedRow) {
      setForm(EMPTY_FORM);
      return;
    }

    setForm({
      onHandQuantity: selectedRow.onHandQuantity === null ? '' : String(selectedRow.onHandQuantity),
      notes: selectedRow.notes ?? '',
    });
  }, [selectedRow]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = normalizeQuery(query);
    return rows.filter((row) => {
      const statusMatches =
        productStatus === 'all' || (productStatus === 'active' ? row.productIsActive : !row.productIsActive);
      const stockMatches = stockState === 'all' || row.stockState === stockState;
      const queryMatches =
        !normalizedQuery ||
        [
          row.productName,
          row.productId,
          row.notes ?? '',
          ...row.parentProductNames,
        ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      return statusMatches && stockMatches && queryMatches;
    });
  }, [productStatus, query, rows, stockState]);

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    setFeedback(null);
  }

  async function submitStock(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);

    if (!selectedRow) {
      setFeedback({ type: 'error', message: 'Select a finished component Product before setting stock.' });
      return;
    }

    if (!form.onHandQuantity.trim()) {
      setFeedback({
        type: 'error',
        message: 'Enter the current finished stock quantity. Leave missing stock unsaved or enter 0 for an explicit zero stock record.',
      });
      return;
    }

    try {
      await productStockService.setStock(
        selectedRow.productId,
        Number(form.onHandQuantity),
        form.notes,
      );
      await reloadStockSources();
      setFeedback({ type: 'success', message: `${selectedRow.productName} finished stock updated.` });
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    }
  }

  if (catalogLoading && products.length === 0) {
    return <div className="panel empty-state"><p>Loading finished component stock workspace…</p></div>;
  }

  if (products.length === 0) {
    return (
      <div className="panel empty-state">
        <div className="empty-icon">◇</div>
        <h3>Create a Product first</h3>
        <p>Finished component stock needs Product identities before current on-hand counts can be recorded.</p>
      </div>
    );
  }

  return (
    <div className="product-stock-workspace">
      <div className="product-stock-layout">
        <form className="panel material-form product-stock-editor" onSubmit={submitStock}>
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">FINISHED COMPONENT STOCK</p>
              <h2>Set current stock</h2>
            </div>
            {selectedRow && (
              <span className={`status-pill ${selectedRow.productIsActive ? 'status-active' : ''}`}>
                {selectedRow.productIsActive ? 'Active' : 'Archived'}
              </span>
            )}
          </div>

          <div className="form-grid">
            <label className="field field-wide">
              <span>Product</span>
              <select
                value={selectedProductId}
                disabled={rows.length === 0}
                onChange={(event) => selectProduct(event.target.value)}
              >
                {rows.length === 0 ? (
                  <option value="">No finished component Products yet</option>
                ) : rows.map((row) => (
                  <option key={row.productId} value={row.productId}>
                    {row.productName} · {row.productId}{row.productIsActive ? '' : ' (archived)'}
                  </option>
                ))}
              </select>
              <small>
                Current Product-backed child components plus Products that already have ProductStock are shown.
              </small>
            </label>

            <label className="field field-wide">
              <span>Current finished stock (pc)</span>
              <input
                type="number"
                min="0"
                step="1"
                disabled={!selectedRow}
                value={form.onHandQuantity}
                onChange={(event) => setForm({ ...form, onHandQuantity: event.target.value })}
                placeholder={selectedRow?.stockState === 'missing' ? 'Missing — enter a whole-piece count' : '0'}
              />
              <small>Whole pieces only. Unit is fixed to pc and is not selectable.</small>
            </label>

            <label className="field field-wide">
              <span>Stock notes</span>
              <textarea
                disabled={!selectedRow}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Physical count, shelf/location note, recount detail…"
              />
            </label>
          </div>

          {selectedRow?.stockState === 'missing' && (
            <div className="stock-state-callout stock-state-missing">
              <strong>Missing stock data</strong>
              <span>No ProductStock record exists yet. Saving 0 creates an explicit known-zero stock record.</span>
            </div>
          )}

          {selectedRow && selectedRow.stockState !== 'missing' && (
            <div className="stock-state-callout">
              <strong>{stockStateLabel(selectedRow)}</strong>
              <span>This is the current authoritative finished-piece count for assembly availability.</span>
            </div>
          )}

          <button className="button button-primary button-full" type="submit" disabled={!selectedRow}>
            {selectedRow?.stockRecordExists ? 'Save stock' : 'Set stock'}
          </button>

          {feedback && <div className={`feedback feedback-${feedback.type}`}>{feedback.message}</div>}
        </form>

        <div className="panel material-list product-stock-list-panel">
          <div className="panel-heading list-heading">
            <div>
              <p className="panel-kicker">CURRENT FINISHED STOCK</p>
              <h2>Component Products</h2>
            </div>
            <div className="material-count"><strong>{visibleRows.length}</strong><span>shown</span></div>
          </div>

          <div className="filters stock-filters">
            <label className="search-field">
              <span className="sr-only">Search finished component stock</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Product, stock note or parent…" />
            </label>
            <select aria-label="Finished stock Product status filter" value={productStatus} onChange={(event) => setProductStatus(event.target.value as ActiveFilter)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <select aria-label="Finished stock state filter" value={stockState} onChange={(event) => setStockState(event.target.value as StockStateFilter)}>
              <option value="all">All stock states</option>
              <option value="missing">Missing</option>
              <option value="zero">Zero</option>
              <option value="available">Available</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state"><p>Loading finished component stock…</p></div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">□</div>
              <h3>No finished component stock rows yet</h3>
              <p>Add a Product-backed component first. Once a child Product is used, its missing or recorded ProductStock will appear here.</p>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="empty-state">
              <h3>No stock rows match these filters</h3>
              <p>Adjust the search, Product status, or stock-state filter.</p>
            </div>
          ) : (
            <div className="product-stock-card-list">
              {visibleRows.map((row) => (
                <button
                  type="button"
                  key={row.productId}
                  className={`product-stock-card ${comparable(row.productId) === comparable(selectedProductId) ? 'selected' : ''}`}
                  onClick={() => selectProduct(row.productId)}
                >
                  <span className="product-stock-card-main">
                    <span className="product-stock-card-heading">
                      <strong>{row.productName}</strong>
                      <span className={`status-pill ${row.productIsActive ? 'status-active' : ''}`}>
                        {row.productIsActive ? 'Active' : 'Archived'}
                      </span>
                    </span>
                    <small>{row.productId} · {row.productCategory}</small>
                    <span className={`stock-state-pill stock-state-${row.stockState}`}>{stockStateLabel(row)}</span>
                    <small>
                      {row.usedAsChild
                        ? `Used by ${row.parentProductNames.join(', ')}`
                        : 'Not currently used as a child component'}
                    </small>
                    {row.notes && <small className="stock-card-note">{row.notes}</small>}
                  </span>
                  <span className="text-button" aria-hidden="true">Edit</span>
                </button>
              ))}
            </div>
          )}

          <div className="list-footer">
            <span>Missing stock is unresolved; explicit 0 pc is known zero.</span>
            <span>{rows.filter((row) => row.usedAsChild).length} current child Products</span>
          </div>
        </div>
      </div>
    </div>
  );
}
