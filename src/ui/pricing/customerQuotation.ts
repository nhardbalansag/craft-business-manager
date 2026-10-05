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
  notes: string | null;
  terms: string | null;
}

export type CustomerQuotationErrorCode =
  | 'PRICING_NOT_READY'
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

function sourceLabel(result: ProductPriceResolutionResult): string {
  if (result.mode === 'default') return 'Default / Single';
  return result.selectedTier?.tier.name ?? result.selectedTierId ?? 'Selected price tier';
}

export function buildCustomerQuotationView(
  result: ProductPriceResolutionResult,
  draft: CustomerQuotationDraft,
): CustomerQuotationView {
  if (result.status !== 'ready') {
    throw new CustomerQuotationError(
      'PRICING_NOT_READY',
      'Customer quotation requires a ready resolved selling price.',
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
      'Resolved quotation prices must be finite non-negative amounts.',
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
    product: {
      id: result.productId,
      name: result.productName,
      quantity: result.quantity,
    },
    pricing: {
      sourceLabel: sourceLabel(result),
      tierId: result.selectedTierId,
      unitSellingPrice: result.unitSellingPrice,
      totalSellingPrice: result.totalSellingPrice,
      offerCount: result.offerCount,
    },
    notes: optionalText(draft.notes),
    terms: optionalText(draft.terms),
  };
}
