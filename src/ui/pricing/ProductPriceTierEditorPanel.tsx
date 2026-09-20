import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ProductPriceTierError,
  validateProductPriceTierContract,
  type ProductPriceTier,
} from '../../domain/productPriceTiers';
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

function alignMinimumToOfferSize(minimumValue: string, unitsValue: string): string {
  const minimum = positiveInteger(minimumValue);
  const units = positiveInteger(unitsValue);
  if (minimum === null || units === null) return minimumValue;

  return String(Math.max(units, Math.ceil(minimum / units) * units));
}

const TIER_KIND_GUIDANCE: Record<
  ProductPriceTier['kind'],
  { title: string; description: string; recommendation: string }
> = {
  package: {
    title: 'Package · fixed bundle',
    description:
      'Use Package when several Product units are sold together as one named bundle or set.',
    recommendation:
      'Per-offer pricing is the clearest setup. Units per offer is the bundle size, and the minimum order must contain whole bundles.',
  },
  bulk: {
    title: 'Bulk · quantity threshold',
    description:
      'Use Bulk when the selling price changes after the customer reaches a minimum quantity.',
    recommendation:
      'Per-unit pricing is the normal setup. Keep units per offer at 1 and use minimum order quantity as the volume threshold.',
  },
  custom: {
    title: 'Custom · explicit special offer',
    description:
      'Use Custom for event, customer, channel, or one-off pricing that does not fit a standard package or bulk rule.',
    recommendation:
      'Choose per-unit or per-offer intentionally. Custom tiers remain explicit alternatives and are never selected automatically.',
  },
};

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

  const sourceValidationError = useMemo(() => {
    if (
      !product ||
      !form.name.trim() ||
      parsed.priceAmount === null ||
      parsed.unitsPerOffer === null ||
      parsed.minimumOrderQuantity === null ||
      parsed.additionalCostPerOffer === null
    ) {
      return null;
    }

    try {
      validateProductPriceTierContract({
        id: tier?.id ?? 'TIER-DRAFT',
        productId: product.id,
        name: form.name,
        kind: form.kind,
        priceBasis: form.priceBasis,
        priceAmount: parsed.priceAmount,
        unitsPerOffer: parsed.unitsPerOffer,
        minimumOrderQuantity: parsed.minimumOrderQuantity,
        additionalCostPerOffer: parsed.additionalCostPerOffer,
        notes: form.notes,
        isActive: tier?.isActive ?? true,
      });
      return null;
    } catch (validationError) {
      return validationError instanceof ProductPriceTierError
        ? validationError.message
        : 'The tier source values are not valid.';
    }
  }, [form, parsed, product, tier]);

  const specializedWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (form.kind === 'package') {
      if (form.priceBasis === 'per-unit') {
        warnings.push(
          'This Package is priced per unit. Use per-offer when the entered price is for the complete bundle.',
        );
      }
      if (parsed.unitsPerOffer === 1) {
        warnings.push(
          'This Package currently contains one Product unit per offer. Increase Units per offer for a multi-piece bundle.',
        );
      }
    }

    if (form.kind === 'bulk') {
      if (form.priceBasis === 'per-offer') {
        warnings.push(
          'This Bulk tier is priced per offer. Use per-unit when the entered price is the price of each piece after the threshold.',
        );
      }
      if (parsed.minimumOrderQuantity === 1) {
        warnings.push(
          'This Bulk tier starts at quantity 1, so it does not yet create a meaningful volume threshold.',
        );
      }
    }

    return warnings;
  }, [form.kind, form.priceBasis, parsed.minimumOrderQuantity, parsed.unitsPerOffer]);

  const kindGuide = TIER_KIND_GUIDANCE[form.kind];
  const editorTitleId = 'price-tier-editor-title';
  const kindGuideId = 'price-tier-kind-guidance';
  const unitsHelpId = 'price-tier-units-help';
  const minimumHelpId = 'price-tier-minimum-help';
  const additionalCostHelpId = 'price-tier-additional-cost-help';
  const validationId = 'price-tier-source-validation';
  const minimumRelationshipInvalid =
    sourceValidationError?.toLowerCase().includes('minimum order quantity') ?? false;
  const unitsRelationshipInvalid =
    sourceValidationError?.toLowerCase().includes('units per offer') ?? false;

  const ready =
    product !== null &&
    product.isActive || tier !== null;

  const valid =
    Boolean(product) &&
    form.name.trim().length > 0 &&
    parsed.priceAmount !== null &&
    parsed.unitsPerOffer !== null &&
    parsed.minimumOrderQuantity !== null &&
    parsed.additionalCostPerOffer !== null &&
    sourceValidationError === null;

  if (!open) return null;

  function changeKind(kind: ProductPriceTier['kind']) {
    setForm((current) => {
      if (kind === 'package') {
        return {
          ...current,
          kind,
          priceBasis: 'per-offer',
          minimumOrderQuantity: alignMinimumToOfferSize(
            current.minimumOrderQuantity,
            current.unitsPerOffer,
          ),
        };
      }

      if (kind === 'bulk') {
        return {
          ...current,
          kind,
          priceBasis: 'per-unit',
          unitsPerOffer: '1',
        };
      }

      return { ...current, kind };
    });
  }

  function changePriceBasis(priceBasis: ProductPriceTier['priceBasis']) {
    setForm((current) => {
      if (priceBasis === 'per-unit') {
        return { ...current, priceBasis, unitsPerOffer: '1' };
      }

      return {
        ...current,
        priceBasis,
        minimumOrderQuantity: alignMinimumToOfferSize(
          current.minimumOrderQuantity,
          current.unitsPerOffer,
        ),
      };
    });
  }

  function changeUnitsPerOffer(unitsPerOffer: string) {
    setForm((current) => ({
      ...current,
      unitsPerOffer,
      minimumOrderQuantity:
        current.priceBasis === 'per-offer'
          ? alignMinimumToOfferSize(current.minimumOrderQuantity, unitsPerOffer)
          : current.minimumOrderQuantity,
    }));
  }

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
      aria-labelledby={editorTitleId}
      aria-busy={saving}
      onSubmit={submit}
    >
      <div className="panel-heading tier-editor-heading">
        <div>
          <p className="panel-kicker">TIER SOURCE</p>
          <h3 id={editorTitleId}>{tier ? `Edit ${tier.name}` : 'Create price tier'}</h3>
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
        <div className="feedback feedback-error" role="alert">
          New price tiers cannot be created for an archived Product.
        </div>
      )}

      {error && (
        <div className="feedback feedback-error" role="alert">
          {error}
        </div>
      )}

      <div
        id={kindGuideId}
        className="tier-editor-kind-guide"
        aria-label="Tier setup guidance"
      >
        <strong>{kindGuide.title}</strong>
        <span>{kindGuide.description}</span>
        <small>{kindGuide.recommendation}</small>
      </div>

      {specializedWarnings.length > 0 && (
        <div className="tier-editor-advisory" role="status" aria-live="polite">
          <strong>Review this {form.kind} setup</strong>
          <ul>
            {specializedWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {sourceValidationError && (
        <div
          id={validationId}
          className="feedback feedback-error tier-editor-validation"
          role="alert"
        >
          <strong>Tier source needs attention.</strong> {sourceValidationError}
        </div>
      )}

      <div className="tier-editor-grid">
        <label className="field field-wide">
          <span>Tier name</span>
          <input
            value={form.name}
            required
            aria-required="true"
            disabled={saving || createBlocked}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Bulk 20+"
          />
        </label>

        <label className="field">
          <span>Tier kind</span>
          <select
            value={form.kind}
            aria-describedby={kindGuideId}
            disabled={saving || createBlocked}
            onChange={(event) =>
              changeKind(event.target.value as ProductPriceTier['kind'])
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
            aria-describedby={kindGuideId}
            disabled={saving || createBlocked}
            onChange={(event) =>
              changePriceBasis(event.target.value as ProductPriceTier['priceBasis'])
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
            required
            aria-required="true"
            aria-invalid={form.priceAmount.trim() !== '' && parsed.priceAmount === null}
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
            required
            aria-required="true"
            aria-invalid={
              (form.unitsPerOffer.trim() !== '' && parsed.unitsPerOffer === null) ||
              unitsRelationshipInvalid
            }
            aria-describedby={
              unitsRelationshipInvalid ? `${unitsHelpId} ${validationId}` : unitsHelpId
            }
            disabled={saving || createBlocked || form.priceBasis === 'per-unit'}
            onChange={(event) => changeUnitsPerOffer(event.target.value)}
          />
          <small id={unitsHelpId} className="tier-editor-field-help">
            {form.priceBasis === 'per-unit'
              ? 'Per-unit tiers always represent exactly 1 Product unit per offer.'
              : 'For packages or bundles, enter the number of Product units sold together.'}
          </small>
        </label>

        <label className="field">
          <span>Minimum order quantity</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={form.minimumOrderQuantity}
            required
            aria-required="true"
            aria-invalid={
              (form.minimumOrderQuantity.trim() !== '' &&
                parsed.minimumOrderQuantity === null) ||
              minimumRelationshipInvalid
            }
            aria-describedby={
              minimumRelationshipInvalid
                ? `${minimumHelpId} ${validationId}`
                : minimumHelpId
            }
            disabled={saving || createBlocked}
            onChange={(event) =>
              setForm({ ...form, minimumOrderQuantity: event.target.value })
            }
          />
          <small id={minimumHelpId} className="tier-editor-field-help">
            {form.priceBasis === 'per-offer'
              ? 'Must cover at least one full offer and be a whole multiple of Units per offer.'
              : form.kind === 'bulk'
                ? 'This is the quantity threshold where the Bulk price becomes available.'
                : 'This is the minimum Product quantity required to use this tier.'}
          </small>
        </label>

        <label className="field">
          <span>Additional cost per offer (PHP)</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.additionalCostPerOffer}
            required
            aria-required="true"
            aria-invalid={
              form.additionalCostPerOffer.trim() !== '' &&
              parsed.additionalCostPerOffer === null
            }
            aria-describedby={additionalCostHelpId}
            disabled={saving || createBlocked}
            onChange={(event) =>
              setForm({ ...form, additionalCostPerOffer: event.target.value })
            }
          />
          <small id={additionalCostHelpId} className="tier-editor-field-help">
            Add packaging, ribbon, box, personalization, or other cost that applies once per offer.
          </small>
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
          Product: {product?.id ?? 'None selected'} · Domain validation remains authoritative. Kind and basis changes only keep structural quantity fields coherent before save.
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
