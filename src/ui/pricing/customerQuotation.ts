import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';

export interface CustomerQuotationDraft {
  businessName: string;
  quotationReference: string;
  customerName: string;
  customerContact?: string;
  customerAddress?: string;
  validUntil?: string;
  notes?: string;
  terms?: string;
  generatedAtIso: string;
}

export interface CustomerQuotationItemView {
  product: {
    id: string;
    name: string;
    quantity: number;
  };
  pricing: {
    sourceLabel: string;
    tierId: string | null;
    unitSellingPrice: number;
    totalSellingPrice: number;
    offerCount: number | null;
  };
}

export interface CustomerQuotationView {
  businessName: string;
  quotationReference: string;
  generatedAtIso: string;
  validUntil: string | null;
  customer: {
    name: string;
    contact: string | null;
    address: string | null;
  };
  items: CustomerQuotationItemView[];
  subtotal: number;
  total: number;
  /**
   * Compatibility aliases for the original single-product quotation model.
   * New rendering should use items/subtotal/total.
   */
  product: CustomerQuotationItemView['product'];
  pricing: CustomerQuotationItemView['pricing'];
  notes: string | null;
  terms: string | null;
}

export type CustomerQuotationErrorCode =
  | 'PRICING_NOT_READY'
  | 'NO_ITEMS'
  | 'INVALID_BUSINESS_NAME'
  | 'INVALID_REFERENCE'
  | 'INVALID_CUSTOMER_NAME'
  | 'INVALID_PRICE';

export class CustomerQuotationError extends Error {
  readonly code: CustomerQuotationErrorCode;

  constructor(code: CustomerQuotationErrorCode, message: string) {
    super(message);
    this.name = 'CustomerQuotationError';
    this.code = code;
  }
}

function optionalText(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

export function customerQuotationSourceLabel(
  result: ProductPriceResolutionResult,
): string {
  if (result.mode === 'default') return 'Default / Single';
  return result.selectedTier?.tier.name ?? result.selectedTierId ?? 'Selected price tier';
}

function buildItem(result: ProductPriceResolutionResult): CustomerQuotationItemView {
  if (result.status !== 'ready') {
    throw new CustomerQuotationError(
      'PRICING_NOT_READY',
      `Customer quotation pricing is not ready for ${result.productName}.`,
    );
  }

  if (
    result.unitSellingPrice === null ||
    result.totalSellingPrice === null ||
    !Number.isFinite(result.unitSellingPrice) ||
    !Number.isFinite(result.totalSellingPrice) ||
    result.unitSellingPrice < 0 ||
    result.totalSellingPrice < 0
  ) {
    throw new CustomerQuotationError(
      'INVALID_PRICE',
      `Resolved quotation prices for ${result.productName} must be finite non-negative amounts.`,
    );
  }

  return {
    product: {
      id: result.productId,
      name: result.productName,
      quantity: result.quantity,
    },
    pricing: {
      sourceLabel: customerQuotationSourceLabel(result),
      tierId: result.selectedTierId,
      unitSellingPrice: result.unitSellingPrice,
      totalSellingPrice: result.totalSellingPrice,
      offerCount: result.offerCount,
    },
  };
}

export function buildCustomerQuotationView(
  resultOrResults:
    | ProductPriceResolutionResult
    | readonly ProductPriceResolutionResult[],
  draft: CustomerQuotationDraft,
): CustomerQuotationView {
  const results: ProductPriceResolutionResult[] = Array.isArray(resultOrResults)
    ? [...resultOrResults]
    : [resultOrResults as ProductPriceResolutionResult];

  if (results.length === 0) {
    throw new CustomerQuotationError(
      'NO_ITEMS',
      'Customer quotation requires at least one Product.',
    );
  }

  const businessName = draft.businessName.trim();
  if (!businessName) {
    throw new CustomerQuotationError('INVALID_BUSINESS_NAME', 'Business name is required.');
  }

  const quotationReference = draft.quotationReference.trim();
  if (!quotationReference) {
    throw new CustomerQuotationError('INVALID_REFERENCE', 'Quotation number is required.');
  }

  const customerName = draft.customerName.trim();
  if (!customerName) {
    throw new CustomerQuotationError('INVALID_CUSTOMER_NAME', 'Customer name is required.');
  }

  const items = results.map(buildItem);
  const subtotal = items.reduce(
    (sum, item) => sum + item.pricing.totalSellingPrice,
    0,
  );

  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new CustomerQuotationError(
      'INVALID_PRICE',
      'Combined quotation total must be a finite non-negative amount.',
    );
  }

  return {
    businessName,
    quotationReference,
    generatedAtIso: draft.generatedAtIso,
    validUntil: optionalText(draft.validUntil),
    customer: {
      name: customerName,
      contact: optionalText(draft.customerContact),
      address: optionalText(draft.customerAddress),
    },
    items,
    subtotal,
    total: subtotal,
    product: items[0]!.product,
    pricing: items[0]!.pricing,
    notes: optionalText(draft.notes),
    terms: optionalText(draft.terms),
  };
}
