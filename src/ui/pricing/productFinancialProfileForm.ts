import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import type { PricingMethod, PricingPolicy } from '../../domain/pricing';

export type PricingMethodSelection = 'unconfigured' | PricingMethod;

export interface ProductFinancialProfileFormState {
  laborCostPerUnit: string;
  overheadCostPerUnit: string;
  pricingMethod: PricingMethodSelection;
  pricingValue: string;
  notes: string;
}

export type ProductFinancialProfileFormErrorCode =
  | 'LABOR_COST_REQUIRED'
  | 'LABOR_COST_INVALID'
  | 'OVERHEAD_COST_REQUIRED'
  | 'OVERHEAD_COST_INVALID'
  | 'PRICING_VALUE_REQUIRED'
  | 'PRICING_VALUE_INVALID';

export class ProductFinancialProfileFormError extends Error {
  readonly code: ProductFinancialProfileFormErrorCode;

  constructor(code: ProductFinancialProfileFormErrorCode, message: string) {
    super(message);
    this.name = 'ProductFinancialProfileFormError';
    this.code = code;
  }
}

export function createEmptyProductFinancialProfileForm(): ProductFinancialProfileFormState {
  return {
    laborCostPerUnit: '',
    overheadCostPerUnit: '',
    pricingMethod: 'unconfigured',
    pricingValue: '',
    notes: '',
  };
}

function parseRequiredFiniteNumber(
  value: string,
  requiredCode: ProductFinancialProfileFormErrorCode,
  invalidCode: ProductFinancialProfileFormErrorCode,
  requiredMessage: string,
  invalidMessage: string,
): number {
  if (!value.trim()) {
    throw new ProductFinancialProfileFormError(requiredCode, requiredMessage);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ProductFinancialProfileFormError(invalidCode, invalidMessage);
  }

  return parsed;
}

function policyValueToDisplay(policy: PricingPolicy): string {
  if (policy.method === 'profit-amount') return String(policy.value);
  return String(policy.value * 100);
}

export function productFinancialProfileToForm(
  profile: ProductFinancialProfile | null,
): ProductFinancialProfileFormState {
  if (!profile) return createEmptyProductFinancialProfileForm();

  return {
    laborCostPerUnit: String(profile.laborCostPerUnit),
    overheadCostPerUnit: String(profile.overheadCostPerUnit),
    pricingMethod: profile.pricingPolicy?.method ?? 'unconfigured',
    pricingValue: profile.pricingPolicy ? policyValueToDisplay(profile.pricingPolicy) : '',
    notes: profile.notes ?? '',
  };
}

export function productFinancialProfileFormToSource(
  productId: string,
  form: ProductFinancialProfileFormState,
): ProductFinancialProfile {
  const laborCostPerUnit = parseRequiredFiniteNumber(
    form.laborCostPerUnit,
    'LABOR_COST_REQUIRED',
    'LABOR_COST_INVALID',
    'Labor cost per unit is required. Enter 0 when labor is intentionally zero.',
    'Labor cost per unit must be a finite number.',
  );

  const overheadCostPerUnit = parseRequiredFiniteNumber(
    form.overheadCostPerUnit,
    'OVERHEAD_COST_REQUIRED',
    'OVERHEAD_COST_INVALID',
    'Overhead cost per unit is required. Enter 0 when overhead is intentionally zero.',
    'Overhead cost per unit must be a finite number.',
  );

  let pricingPolicy: PricingPolicy | null = null;

  if (form.pricingMethod !== 'unconfigured') {
    const displayValue = parseRequiredFiniteNumber(
      form.pricingValue,
      'PRICING_VALUE_REQUIRED',
      'PRICING_VALUE_INVALID',
      form.pricingMethod === 'profit-amount'
        ? 'Profit amount per unit is required for fixed-profit pricing.'
        : 'Percentage value is required for the selected pricing method.',
      form.pricingMethod === 'profit-amount'
        ? 'Profit amount per unit must be a finite number.'
        : 'Percentage value must be a finite number.',
    );

    pricingPolicy = {
      method: form.pricingMethod,
      value: form.pricingMethod === 'profit-amount' ? displayValue : displayValue / 100,
    };
  }

  const notes = form.notes.trim();

  return {
    productId,
    laborCostPerUnit,
    overheadCostPerUnit,
    pricingPolicy,
    notes: notes || undefined,
  };
}

export function pricingValueLabel(method: PricingMethodSelection): string {
  switch (method) {
    case 'profit-amount':
      return 'Profit per unit (PHP)';
    case 'markup-percent':
      return 'Markup (%)';
    case 'margin-percent':
      return 'Target margin (%)';
    case 'unconfigured':
      return 'Pricing value';
  }
}

export function pricingValueHelp(method: PricingMethodSelection): string {
  switch (method) {
    case 'profit-amount':
      return 'Added to the fully loaded unit cost as a fixed PHP profit amount.';
    case 'markup-percent':
      return 'Enter a human percentage, for example 50 for a 50% markup.';
    case 'margin-percent':
      return 'Enter a human percentage from 0 up to but not including 100.';
    case 'unconfigured':
      return 'Choose a pricing method when you are ready to configure selling-price policy.';
  }
}
