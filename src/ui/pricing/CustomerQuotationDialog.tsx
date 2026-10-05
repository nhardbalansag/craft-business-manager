import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import {
  buildCustomerQuotationView,
  type CustomerQuotationDraft,
} from './customerQuotation';
import { printCustomerQuotation } from './customerQuotationPrint';
import './customerQuotation.css';

interface CustomerQuotationDialogProps {
  open: boolean;
  result: ProductPriceResolutionResult | null;
  onClose(): void;
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
    terms: 'Prices are valid until the date shown above. Production schedule and delivery arrangements are confirmed separately.',
    generatedAtIso: now.toISOString(),
  };
}

export function CustomerQuotationDialog({
  open,
  result,
  onClose,
}: CustomerQuotationDialogProps) {
  const [draft, setDraft] = useState<CustomerQuotationDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const resultKey = useMemo(
    () =>
      result
        ? [result.productId, result.quantity, result.selectedTierId ?? 'default', result.totalSellingPrice].join('|')
        : '',
    [result],
  );

  useEffect(() => {
    if (!open || !result) return;
    setDraft(initialDraft(result));
    setError(null);
  }, [open, resultKey, result]);

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

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!result || !draft) return;
    try {
      const view = buildCustomerQuotationView(result, {
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
        className="panel customer-quotation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-quotation-title"
      >
        <div className="customer-quotation-heading">
          <div>
            <p className="panel-kicker">CUSTOMER QUOTATION</p>
            <h2 id="customer-quotation-title">Print / Save as PDF</h2>
            <p>
              Prepare a customer-facing quotation for {result.productName}. Internal
              cost, profit, and margin data will not be printed.
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

        <div className="customer-quotation-price-summary" aria-label="Quotation price summary">
          <div><span>Product</span><strong>{result.productName}</strong><small>{result.productId}</small></div>
          <div><span>Quantity</span><strong>{result.quantity.toLocaleString('en-PH')}</strong><small>finished units</small></div>
          <div><span>Unit price</span><strong>{result.unitSellingPrice?.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</strong></div>
          <div><span>Total</span><strong>{result.totalSellingPrice?.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</strong></div>
        </div>

        <form aria-label="Customer quotation form" onSubmit={submit}>
          <div className="customer-quotation-grid">
            <label className="field">
              <span>Business name</span>
              <input
                required
                value={draft.businessName}
                onChange={(event) => update('businessName', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Quotation number</span>
              <input
                required
                value={draft.quotationReference}
                onChange={(event) => update('quotationReference', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Customer name</span>
              <input
                required
                autoFocus
                value={draft.customerName}
                onChange={(event) => update('customerName', event.target.value)}
                placeholder="Customer or company name"
              />
            </label>

            <label className="field">
              <span>Customer contact</span>
              <input
                value={draft.customerContact ?? ''}
                onChange={(event) => update('customerContact', event.target.value)}
                placeholder="Phone, email, or contact person"
              />
            </label>

            <label className="field field-wide">
              <span>Customer address</span>
              <textarea
                value={draft.customerAddress ?? ''}
                onChange={(event) => update('customerAddress', event.target.value)}
                placeholder="Optional billing or delivery address"
              />
            </label>

            <label className="field">
              <span>Valid until</span>
              <input
                type="date"
                value={draft.validUntil ?? ''}
                onChange={(event) => update('validUntil', event.target.value)}
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
            <button className="button button-secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-primary" type="submit">
              Print / Save as PDF
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
