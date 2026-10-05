import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ProductPriceResolutionRequest,
  ProductPriceResolutionResult,
} from '../../application/pricing/ProductPriceResolutionService';
import type { Product } from '../../domain/products';
import {
  buildCustomerQuotationView,
  customerQuotationSourceLabel,
  type CustomerQuotationDraft,
} from './customerQuotation';
import { printCustomerQuotation } from './customerQuotationPrint';
import './customerQuotation.css';

interface CustomerQuotationDialogProps {
  open: boolean;
  result: ProductPriceResolutionResult | null;
  products: readonly Product[];
  resolvePrice(
    request: ProductPriceResolutionRequest,
  ): Promise<ProductPriceResolutionResult>;
  onClose(): void;
}

interface QuotationLineState {
  key: number;
  productId: string;
  quantity: string;
  selectedTierId: string | null;
  result: ProductPriceResolutionResult | null;
  loading: boolean;
  error: string | null;
}

function dateInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function referenceFor(result: ProductPriceResolutionResult, now: Date): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  const stamp = local.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const product = result.productId
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
  return `QT-${stamp}-${product || 'PRODUCT'}`;
}

function initialDraft(result: ProductPriceResolutionResult): CustomerQuotationDraft {
  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + 7);

  return {
    businessName: 'My Lovely Craft',
    quotationReference: referenceFor(result, now),
    customerName: '',
    customerContact: '',
    customerAddress: '',
    validUntil: dateInputValue(validUntil),
    notes: '',
    terms:
      'Prices are valid until the date shown above. Production schedule and delivery arrangements are confirmed separately.',
    generatedAtIso: now.toISOString(),
  };
}

function initialLine(
  result: ProductPriceResolutionResult,
  key: number,
): QuotationLineState {
  return {
    key,
    productId: result.productId,
    quantity: String(result.quantity),
    selectedTierId: result.selectedTierId,
    result,
    loading: false,
    error: null,
  };
}

function parsedQuantity(value: string): number | null {
  if (!value.trim()) return null;
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CustomerQuotationDialog({
  open,
  result,
  products,
  resolvePrice,
  onClose,
}: CustomerQuotationDialogProps) {
  const [draft, setDraft] = useState<CustomerQuotationDraft | null>(null);
  const [lines, setLines] = useState<QuotationLineState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const nextLineKey = useRef(2);
  const requestVersion = useRef(new Map<number, number>());

  const resultKey = useMemo(
    () =>
      result
        ? [
            result.productId,
            result.quantity,
            result.selectedTierId ?? 'default',
            result.totalSellingPrice,
          ].join('|')
        : '',
    [result],
  );

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products],
  );

  useEffect(() => {
    if (!open || !result) return;
    setDraft(initialDraft(result));
    setLines([initialLine(result, 1)]);
    nextLineKey.current = 2;
    requestVersion.current.clear();
    setError(null);
  }, [open, resultKey]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    closeRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !result || !draft) return null;

  function update<K extends keyof CustomerQuotationDraft>(
    key: K,
    value: CustomerQuotationDraft[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setError(null);
  }

  function patchLine(
    key: number,
    changes:
      | Partial<QuotationLineState>
      | ((current: QuotationLineState) => Partial<QuotationLineState>),
  ) {
    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? {
              ...line,
              ...(typeof changes === 'function' ? changes(line) : changes),
            }
          : line,
      ),
    );
  }

  async function resolveLine(
    key: number,
    productId: string,
    quantityValue: string,
    selectedTierId: string | null,
  ) {
    const quantity = parsedQuantity(quantityValue);
    if (!productId || quantity === null) {
      patchLine(key, {
        result: null,
        loading: false,
        error: quantityValue.trim()
          ? 'Quantity must be a positive whole number.'
          : null,
      });
      return;
    }

    const version = (requestVersion.current.get(key) ?? 0) + 1;
    requestVersion.current.set(key, version);
    patchLine(key, { loading: true, error: null });

    try {
      const next = await resolvePrice({
        productId,
        quantity,
        ...(selectedTierId === null ? {} : { selectedTierId }),
      });
      if (requestVersion.current.get(key) !== version) return;

      patchLine(key, {
        result: next,
        loading: false,
        error:
          next.status === 'ready'
            ? null
            : next.issues[0]?.message ?? 'Pricing is not ready for this item.',
      });
    } catch (resolveError) {
      if (requestVersion.current.get(key) !== version) return;
      patchLine(key, {
        result: null,
        loading: false,
        error:
          resolveError instanceof Error
            ? resolveError.message
            : 'The item price could not be resolved.',
      });
    }
  }

  function changeProduct(line: QuotationLineState, productId: string) {
    patchLine(line.key, {
      productId,
      quantity: '1',
      selectedTierId: null,
      result: null,
      error: null,
    });
    if (productId) {
      void resolveLine(line.key, productId, '1', null);
    }
  }

  function changeQuantity(line: QuotationLineState, quantity: string) {
    patchLine(line.key, { quantity });
    void resolveLine(
      line.key,
      line.productId,
      quantity,
      line.selectedTierId,
    );
  }

  function changePricingSource(
    line: QuotationLineState,
    value: string,
  ) {
    const selectedTierId = value === 'default' ? null : value;
    patchLine(line.key, { selectedTierId });
    void resolveLine(
      line.key,
      line.productId,
      line.quantity,
      selectedTierId,
    );
  }

  function addProduct() {
    const key = nextLineKey.current++;
    setLines((current) => [
      ...current,
      {
        key,
        productId: '',
        quantity: '1',
        selectedTierId: null,
        result: null,
        loading: false,
        error: null,
      },
    ]);
    setError(null);
  }

  function removeProduct(key: number) {
    requestVersion.current.delete(key);
    setLines((current) => current.filter((line) => line.key !== key));
    setError(null);
  }

  const usedProductIds = new Set(
    lines.map((line) => line.productId).filter(Boolean),
  );
  const canAddProduct = activeProducts.some(
    (product) => !usedProductIds.has(product.id),
  );

  const readyResults = lines
    .map((line) => line.result)
    .filter(
      (candidate): candidate is ProductPriceResolutionResult =>
        candidate?.status === 'ready' &&
        candidate.unitSellingPrice !== null &&
        candidate.totalSellingPrice !== null,
    );

  const quotationTotal = readyResults.reduce(
    (sum, candidate) => sum + (candidate.totalSellingPrice ?? 0),
    0,
  );

  const allLinesReady =
    lines.length > 0 &&
    lines.every(
      (line) =>
        Boolean(line.productId) &&
        parsedQuantity(line.quantity) !== null &&
        !line.loading &&
        line.result?.status === 'ready' &&
        line.result.unitSellingPrice !== null &&
        line.result.totalSellingPrice !== null,
    );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !allLinesReady || readyResults.length !== lines.length) {
      setError(
        'Every quotation item needs a Product, valid quantity, and ready pricing before printing.',
      );
      return;
    }

    try {
      const view = buildCustomerQuotationView(readyResults, {
        ...draft,
        generatedAtIso: new Date().toISOString(),
      });
      printCustomerQuotation(view);
      setError(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'The quotation could not be prepared.',
      );
    }
  }

  return (
    <div
      className="customer-quotation-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="panel customer-quotation-dialog customer-quotation-dialog-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-quotation-title"
      >
        <div className="customer-quotation-heading">
          <div>
            <p className="panel-kicker">CUSTOMER QUOTATION</p>
            <h2 id="customer-quotation-title">Print / Save as PDF</h2>
            <p>
              Build one customer-facing quotation with one or more Products.
              Every line uses its own saved quantity-aware pricing.
            </p>
          </div>
          <button
            ref={closeRef}
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form aria-label="Customer quotation form" onSubmit={submit}>
          <section className="customer-quotation-items" aria-label="Quotation products">
            <div className="customer-quotation-section-heading">
              <div>
                <span>Requested Products</span>
                <strong>
                  {lines.length} {lines.length === 1 ? 'item' : 'items'} · {money(quotationTotal)}
                </strong>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={addProduct}
                disabled={!canAddProduct}
              >
                Add another product
              </button>
            </div>

            <div className="customer-quotation-item-list">
              {lines.map((line, index) => {
                const tierLines =
                  line.result?.integratedQuote.tierPricing?.tiers ?? [];
                const eligibleIds = new Set(line.result?.eligibleTierIds ?? []);
                const sourceReady = line.result?.status === 'ready';

                return (
                  <article
                    key={line.key}
                    className="customer-quotation-item"
                    aria-label={`Quotation item ${index + 1}`}
                  >
                    <div className="customer-quotation-item-heading">
                      <strong>Item {index + 1}</strong>
                      {lines.length > 1 && (
                        <button
                          className="button button-secondary button-small"
                          type="button"
                          onClick={() => removeProduct(line.key)}
                          aria-label={`Remove quotation item ${index + 1}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="customer-quotation-item-grid">
                      <label className="field customer-quotation-product-field">
                        <span>Product</span>
                        <select
                          required
                          value={line.productId}
                          disabled={line.loading}
                          onChange={(event) =>
                            changeProduct(line, event.target.value)
                          }
                        >
                          <option value="">Select a Product</option>
                          {activeProducts.map((product) => (
                            <option
                              key={product.id}
                              value={product.id}
                              disabled={
                                product.id !== line.productId &&
                                usedProductIds.has(product.id)
                              }
                            >
                              {product.name} · {product.id}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Quantity</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          required
                          value={line.quantity}
                          disabled={!line.productId || line.loading}
                          onChange={(event) =>
                            changeQuantity(line, event.target.value)
                          }
                        />
                      </label>

                      <label className="field customer-quotation-source-field">
                        <span>Pricing source</span>
                        <select
                          value={line.selectedTierId ?? 'default'}
                          disabled={!line.productId || line.loading}
                          onChange={(event) =>
                            changePricingSource(line, event.target.value)
                          }
                        >
                          <option value="default">Default / Single</option>
                          {tierLines
                            .filter((candidate) => candidate.tier.isActive)
                            .map((candidate) => {
                              const eligible = eligibleIds.has(candidate.tier.id);
                              return (
                                <option
                                  key={candidate.tier.id}
                                  value={candidate.tier.id}
                                  disabled={
                                    !eligible &&
                                    line.selectedTierId !== candidate.tier.id
                                  }
                                >
                                  {candidate.tier.name}
                                  {eligible ? '' : ' · not eligible'}
                                </option>
                              );
                            })}
                        </select>
                      </label>

                      <div className="customer-quotation-item-price">
                        <span>Unit price</span>
                        <strong>
                          {line.loading
                            ? 'Resolving…'
                            : money(line.result?.unitSellingPrice ?? null)}
                        </strong>
                        <small>
                          {sourceReady && line.result
                            ? customerQuotationSourceLabel(line.result)
                            : 'Waiting for ready pricing'}
                        </small>
                      </div>

                      <div className="customer-quotation-item-price">
                        <span>Amount</span>
                        <strong>
                          {line.loading
                            ? 'Resolving…'
                            : money(line.result?.totalSellingPrice ?? null)}
                        </strong>
                        <small>
                          {line.result?.status === 'ready'
                            ? 'Ready'
                            : 'Not ready'}
                        </small>
                      </div>
                    </div>

                    {line.error && (
                      <div
                        className="feedback feedback-error customer-quotation-item-error"
                        role="alert"
                      >
                        {line.error}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {!canAddProduct && lines.length > 0 && (
              <small className="customer-quotation-all-products-note">
                All active Products are already included in this quotation.
              </small>
            )}
          </section>

          <div className="customer-quotation-grid">
            <label className="field">
              <span>Business name</span>
              <input
                required
                value={draft.businessName}
                onChange={(event) =>
                  update('businessName', event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Quotation number</span>
              <input
                required
                value={draft.quotationReference}
                onChange={(event) =>
                  update('quotationReference', event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Customer name</span>
              <input
                required
                autoFocus
                value={draft.customerName}
                onChange={(event) =>
                  update('customerName', event.target.value)
                }
                placeholder="Customer or company name"
              />
            </label>

            <label className="field">
              <span>Customer contact</span>
              <input
                value={draft.customerContact ?? ''}
                onChange={(event) =>
                  update('customerContact', event.target.value)
                }
                placeholder="Phone, email, or contact person"
              />
            </label>

            <label className="field field-wide">
              <span>Customer address</span>
              <textarea
                value={draft.customerAddress ?? ''}
                onChange={(event) =>
                  update('customerAddress', event.target.value)
                }
                placeholder="Optional billing or delivery address"
              />
            </label>

            <label className="field">
              <span>Valid until</span>
              <input
                type="date"
                value={draft.validUntil ?? ''}
                onChange={(event) =>
                  update('validUntil', event.target.value)
                }
              />
            </label>

            <label className="field field-wide">
              <span>Quotation notes</span>
              <textarea
                value={draft.notes ?? ''}
                onChange={(event) => update('notes', event.target.value)}
                placeholder="Product customization, color, packaging, event details, or delivery notes"
              />
            </label>

            <label className="field field-wide">
              <span>Terms & conditions</span>
              <textarea
                value={draft.terms ?? ''}
                onChange={(event) => update('terms', event.target.value)}
              />
            </label>
          </div>

          {error && (
            <div className="feedback feedback-error" role="alert">
              {error}
            </div>
          )}

          <div className="customer-quotation-actions">
            <div className="customer-quotation-grand-total">
              <span>Quotation total</span>
              <strong>{money(quotationTotal)}</strong>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={!allLinesReady}
            >
              Print / Save as PDF
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
