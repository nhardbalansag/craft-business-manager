import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ProductPriceTier } from '../../domain/productPriceTiers';
import type { Product } from '../../domain/products';

export interface ProductPriceTierEditorValue {
  name: string;
  kind: ProductPriceTier['kind'];
  priceBasis: ProductPriceTier['priceBasis'];
  priceAmount: number;
  unitsPerOffer: number;
  minimumOrderQuantity: number;
  additionalCostPerOffer: number;
  notes?: string;
}

interface ProductPriceTierEditorPanelProps {
  product: Product | null;
  tier: ProductPriceTier | null;
  open: boolean;
  saving: boolean;
  error?: string | null;
  onSubmit: (value: ProductPriceTierEditorValue) => Promise<void> | void;
  onCancel: () => void;
}

interface TierFormState {
  name: string;
  kind: ProductPriceTier['kind'];
  priceBasis: ProductPriceTier['priceBasis'];
  priceAmount: string;
  unitsPerOffer: string;
  minimumOrderQuantity: string;
  additionalCostPerOffer: string;
  notes: string;
}

function emptyForm(): TierFormState {
  return {
    name: '',
    kind: 'bulk',
    priceBasis: 'per-unit',
    priceAmount: '',
    unitsPerOffer: '1',
    minimumOrderQuantity: '1',
    additionalCostPerOffer: '0',
    notes: '',
  };
}

function tierToForm(tier: ProductPriceTier | null): TierFormState {
  if (!tier) return emptyForm();
  return {
    name: tier.name,
    kind: tier.kind,
    priceBasis: tier.priceBasis,
    priceAmount: String(tier.priceAmount),
    unitsPerOffer: String(tier.unitsPerOffer),
    minimumOrderQuantity: String(tier.minimumOrderQuantity),
    additionalCostPerOffer: String(tier.additionalCostPerOffer),
    notes: tier.notes ?? '',
  };
}

function finiteNonNegative(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function positiveInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function ProductPriceTierEditorPanel({
  product,
  tier,
  open,
  saving,
  error = null,
  onSubmit,
  onCancel,
}: ProductPriceTierEditorPanelProps) {
  const [form, setForm] = useState<TierFormState>(() => tierToForm(tier));

  useEffect(() => {
    if (open) setForm(tierToForm(tier));
  }, [open, tier]);

  const parsed = useMemo(() => ({
    priceAmount: finiteNonNegative(form.priceAmount),
    unitsPerOffer: positiveInteger(form.unitsPerOffer),
    minimumOrderQuantity: positiveInteger(form.minimumOrderQuantity),
    additionalCostPerOffer: finiteNonNegative(form.additionalCostPerOffer),
  }), [form]);

  const ready =
    product !== null &&
    product.isActive || tier !== null;

  const valid =
    Boolean(product) &&
    form.name.trim().length > 0 &&
    parsed.priceAmount !== null &&
    parsed.unitsPerOffer !== null &&
    parsed.minimumOrderQuantity !== null &&
    parsed.additionalCostPerOffer !== null;

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!product || !valid) return;

    await onSubmit({
      name: form.name,
      kind: form.kind,
      priceBasis: form.priceBasis,
      priceAmount: parsed.priceAmount!,
      unitsPerOffer: parsed.unitsPerOffer!,
      minimumOrderQuantity: parsed.minimumOrderQuantity!,
      additionalCostPerOffer: parsed.additionalCostPerOffer!,
      notes: form.notes.trim() || undefined,
    });
  }

  const createBlocked = tier === null && product !== null && !product.isActive;

  return (
    <form
      className="panel tier-editor-panel"
      aria-label="Price tier editor"
      onSubmit={submit}
    >
      <div className="panel-heading tier-editor-heading">
        <div>
          <p className="panel-kicker">TIER SOURCE</p>
          <h3>{tier ? `Edit ${tier.name}` : 'Create price tier'}</h3>
          <p>
            {tier
              ? `Editing ${tier.id}. The stable tier ID and Product relationship are preserved.`
              : product
                ? `Create a Package, Bulk, or Custom tier for ${product.name}. The tier ID is generated when saved.`
                : 'Select a Product before creating a price tier.'}
          </p>
        </div>
        {tier && (
          <span className={`status-pill ${tier.isActive ? 'status-active' : ''}`}>
            {tier.isActive ? 'Active' : 'Archived'}
          </span>
        )}
      </div>

      {createBlocked && (
        <div className="feedback feedback-error" role="status">
          New price tiers cannot be created for an archived Product.
        </div>
      )}

      {error && (
        <div className="feedback feedback-error" role="status">
          {error}
        </div>
      )}

      <div className="tier-editor-grid">
        <label className="field field-wide">
          <span>Tier name</span>
          <input
            value={form.name}
            disabled={saving || createBlocked}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Bulk 20+"
          />
        </label>

        <label className="field">
          <span>Tier kind</span>
          <select
            value={form.kind}
            disabled={saving || createBlocked}
            onChange={(event) =>
              setForm({ ...form, kind: event.target.value as ProductPriceTier['kind'] })
            }
          >
            <option value="package">Package</option>
            <option value="bulk">Bulk</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label className="field">
          <span>Price basis</span>
          <select
            value={form.priceBasis}
            disabled={saving || createBlocked}
            onChange={(event) =>
              setForm({
                ...form,
                priceBasis: event.target.value as ProductPriceTier['priceBasis'],
              })
            }
          >
            <option value="per-unit">Per unit</option>
            <option value="per-offer">Per offer</option>
          </select>
        </label>

        <label className="field">
          <span>Price amount (PHP)</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.priceAmount}
            disabled={saving || createBlocked}
            onChange={(event) => setForm({ ...form, priceAmount: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Units per offer</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={form.unitsPerOffer}
            disabled={saving || createBlocked}
            onChange={(event) => setForm({ ...form, unitsPerOffer: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Minimum order quantity</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={form.minimumOrderQuantity}
            disabled={saving || createBlocked}
            onChange={(event) =>
              setForm({ ...form, minimumOrderQuantity: event.target.value })
            }
          />
        </label>

        <label className="field">
          <span>Additional cost per offer (PHP)</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.additionalCostPerOffer}
            disabled={saving || createBlocked}
            onChange={(event) =>
              setForm({ ...form, additionalCostPerOffer: event.target.value })
            }
          />
        </label>

        <label className="field field-wide">
          <span>Notes</span>
          <textarea
            value={form.notes}
            disabled={saving || createBlocked}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Optional source notes"
          />
        </label>
      </div>

      <div className="tier-editor-source-note">
        <strong>{tier ? tier.id : 'ID generated on save'}</strong>
        <span>
          Product: {product?.id ?? 'None selected'} · Validation is enforced by the authoritative ProductPriceTier service.
        </span>
      </div>

      <div className="tier-editor-actions">
        <button
          className="button button-secondary"
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="button button-primary"
          type="submit"
          disabled={saving || createBlocked || !ready || !valid}
        >
          {saving ? 'Saving tier…' : tier ? 'Save tier changes' : 'Create tier'}
        </button>
      </div>
    </form>
  );
}
