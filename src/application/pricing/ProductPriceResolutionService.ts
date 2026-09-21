import {
  evaluateProductPriceResolutionQuantity,
  evaluateProductPriceTierQuantityEligibility,
  type ProductPriceResolutionQuantityIssueCode,
  type ProductPriceTierQuantityEligibilityIssue,
} from '../../domain/productPriceTierQuantityEligibility';
import type {
  ProductPriceTierQuoteLine,
  ProductPriceTierQuoteWarning,
} from '../productPriceTiers/ProductPriceTierQuoteService';
import type {
  IntegratedProductPricingQuoteResult,
} from './ProductPricingQuoteIntegrationService';

export type ProductPriceResolutionMode = 'default' | 'explicit-tier';
export type ProductPriceResolutionStatus = 'ready' | 'not-ready';

export type ProductPriceResolutionIssueCode =
  | ProductPriceResolutionQuantityIssueCode
  | 'REQUEST_PRODUCT_MISMATCH'
  | 'DEFAULT_PRICING_NOT_READY'
  | 'DEFAULT_SELLING_PRICE_INVALID'
  | 'TIER_PRICING_UNAVAILABLE'
  | 'TIER_PRICING_PRODUCT_MISMATCH'
  | 'SELECTED_TIER_ID_INVALID'
  | 'SELECTED_TIER_NOT_FOUND'
  | 'SELECTED_TIER_PRODUCT_MISMATCH'
  | 'SELECTED_TIER_INELIGIBLE'
  | 'SELECTED_TIER_ECONOMICS_UNAVAILABLE'
  | 'RESOLVED_PRICE_INVALID';

export interface ProductPriceResolutionIssue {
  code: ProductPriceResolutionIssueCode;
  message: string;
  productId: string;
  quantity: number;
  tierId?: string;
}

export interface ProductPriceResolutionTierEligibility {
  tierId: string;
  productId: string;
  productMatches: boolean;
  eligible: boolean;
  offerCount: number | null;
  issues: ProductPriceTierQuantityEligibilityIssue[];
}

export interface ProductPriceResolutionRequest {
  productId: string;
  quantity: number;
  selectedTierId?: string;
}

export interface ProductPriceResolutionResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  quantity: number;
  mode: ProductPriceResolutionMode;
  selectedTierId: string | null;
  status: ProductPriceResolutionStatus;
  offerCount: number | null;
  unitSellingPrice: number | null;
  totalSellingPrice: number | null;
  integratedQuote: IntegratedProductPricingQuoteResult;
  selectedTier: ProductPriceTierQuoteLine | null;
  eligibleTierIds: string[];
  tierEligibility: ProductPriceResolutionTierEligibility[];
  warnings: ProductPriceTierQuoteWarning[];
  issues: ProductPriceResolutionIssue[];
}

export interface ProductPriceResolutionQuoteProvider {
  quoteProduct(productId: string): Promise<IntegratedProductPricingQuoteResult>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function resolutionIssue(
  code: ProductPriceResolutionIssueCode,
  message: string,
  productId: string,
  quantity: number,
  tierId?: string,
): ProductPriceResolutionIssue {
  return {
    code,
    message,
    productId,
    quantity,
    ...(tierId ? { tierId } : {}),
  };
}

function unresolvedResult(
  quote: IntegratedProductPricingQuoteResult,
  quantity: number,
  mode: ProductPriceResolutionMode,
  selectedTierId: string | null,
  tierEligibility: ProductPriceResolutionTierEligibility[],
  issues: ProductPriceResolutionIssue[],
  selectedTier: ProductPriceTierQuoteLine | null = null,
): ProductPriceResolutionResult {
  return {
    productId: quote.productId,
    productName: quote.productName,
    productIsActive: quote.productIsActive,
    quantity,
    mode,
    selectedTierId,
    status: 'not-ready',
    offerCount: null,
    unitSellingPrice: null,
    totalSellingPrice: null,
    integratedQuote: structuredClone(quote),
    selectedTier: selectedTier ? structuredClone(selectedTier) : null,
    eligibleTierIds: tierEligibility
      .filter((candidate) => candidate.productMatches && candidate.eligible)
      .map((candidate) => candidate.tierId),
    tierEligibility: structuredClone(tierEligibility),
    warnings: selectedTier
      ? selectedTier.warnings.map((warning) => ({ ...warning }))
      : [],
    issues: issues.map((candidate) => ({ ...candidate })),
  };
}

function buildTierEligibility(
  quote: IntegratedProductPricingQuoteResult,
  quantity: number,
): ProductPriceResolutionTierEligibility[] {
  if (!quote.tierPricing) return [];

  return quote.tierPricing.tiers.map((line) => {
    const productMatches =
      comparable(line.tier.productId) === comparable(quote.productId);

    if (!productMatches) {
      return {
        tierId: line.tier.id,
        productId: line.tier.productId,
        productMatches: false,
        eligible: false,
        offerCount: null,
        issues: [],
      };
    }

    const eligibility = evaluateProductPriceTierQuantityEligibility(
      line.tier,
      quantity,
    );

    return {
      tierId: line.tier.id,
      productId: line.tier.productId,
      productMatches: true,
      eligible: eligibility.eligible,
      offerCount: eligibility.offerCount,
      issues: eligibility.issues.map((candidate) => ({ ...candidate })),
    };
  });
}

function tierEconomicsResolvable(line: ProductPriceTierQuoteLine): boolean {
  if (!line.economics) return false;

  if (
    !finiteNonNegative(line.economics.offerSellingPrice) ||
    !finiteNonNegative(line.economics.effectiveUnitSellingPrice)
  ) {
    return false;
  }

  if (line.status === 'ready') return true;

  if (line.status !== 'partial') return false;

  return line.issues.every(
    (candidate) =>
      candidate.code === 'DEFAULT_QUOTE_PARTIAL' ||
      candidate.code === 'DEFAULT_QUOTE_NOT_READY',
  );
}

/**
 * TP8C explicit pricing-source resolver.
 *
 * Quantity can make saved tiers structurally eligible, but it never chooses one.
 * An omitted selectedTierId resolves Default / Single. A supplied ID resolves
 * exactly that tier or fails closed. No cheapest/highest-threshold ranking exists.
 */
export class ProductPriceResolutionService {
  constructor(
    private readonly quotes: ProductPriceResolutionQuoteProvider,
  ) {}

  async resolve(
    request: ProductPriceResolutionRequest,
  ): Promise<ProductPriceResolutionResult> {
    const requestedProductId = request.productId.trim();
    const explicitTierRequested = request.selectedTierId !== undefined;
    const selectedTierId = explicitTierRequested
      ? request.selectedTierId!.trim()
      : null;
    const mode: ProductPriceResolutionMode = explicitTierRequested
      ? 'explicit-tier'
      : 'default';

    const quote = await this.quotes.quoteProduct(requestedProductId);
    const quantityValidation =
      evaluateProductPriceResolutionQuantity(request.quantity);
    const issues: ProductPriceResolutionIssue[] = [];

    if (
      comparable(requestedProductId) !== comparable(quote.productId)
    ) {
      issues.push(
        resolutionIssue(
          'REQUEST_PRODUCT_MISMATCH',
          `Requested Product ${requestedProductId} does not match integrated pricing evidence for Product ${quote.productId}.`,
          quote.productId,
          request.quantity,
        ),
      );
    }

    for (const candidate of quantityValidation.issues) {
      issues.push(
        resolutionIssue(
          candidate.code,
          candidate.message,
          quote.productId,
          request.quantity,
          selectedTierId ?? undefined,
        ),
      );
    }

    if (explicitTierRequested && !selectedTierId) {
      issues.push(
        resolutionIssue(
          'SELECTED_TIER_ID_INVALID',
          'Explicit tier resolution requires a non-blank tier ID.',
          quote.productId,
          request.quantity,
        ),
      );
    }

    if (issues.length > 0) {
      return unresolvedResult(
        quote,
        request.quantity,
        mode,
        selectedTierId,
        [],
        issues,
      );
    }

    const tierEligibility = buildTierEligibility(quote, request.quantity);

    if (mode === 'default') {
      if (
        quote.status !== 'ready' ||
        quote.sellingPriceStatus !== 'ready'
      ) {
        issues.push(
          resolutionIssue(
            'DEFAULT_PRICING_NOT_READY',
            `Default / Single pricing is not ready for Product ${quote.productId}.`,
            quote.productId,
            request.quantity,
          ),
        );
        return unresolvedResult(
          quote,
          request.quantity,
          mode,
          null,
          tierEligibility,
          issues,
        );
      }

      if (
        quote.sellingPrice === null ||
        !finiteNonNegative(quote.sellingPrice)
      ) {
        issues.push(
          resolutionIssue(
            'DEFAULT_SELLING_PRICE_INVALID',
            `Default / Single selling price is invalid for Product ${quote.productId}.`,
            quote.productId,
            request.quantity,
          ),
        );
        return unresolvedResult(
          quote,
          request.quantity,
          mode,
          null,
          tierEligibility,
          issues,
        );
      }

      const totalSellingPrice = quote.sellingPrice * request.quantity;
      if (!finiteNonNegative(totalSellingPrice)) {
        issues.push(
          resolutionIssue(
            'RESOLVED_PRICE_INVALID',
            `Default / Single pricing produced an invalid total selling price for Product ${quote.productId}.`,
            quote.productId,
            request.quantity,
          ),
        );
        return unresolvedResult(
          quote,
          request.quantity,
          mode,
          null,
          tierEligibility,
          issues,
        );
      }

      return {
        productId: quote.productId,
        productName: quote.productName,
        productIsActive: quote.productIsActive,
        quantity: request.quantity,
        mode,
        selectedTierId: null,
        status: 'ready',
        offerCount: request.quantity,
        unitSellingPrice: quote.sellingPrice,
        totalSellingPrice,
        integratedQuote: structuredClone(quote),
        selectedTier: null,
        eligibleTierIds: tierEligibility
          .filter((candidate) => candidate.productMatches && candidate.eligible)
          .map((candidate) => candidate.tierId),
        tierEligibility: structuredClone(tierEligibility),
        warnings: [],
        issues: [],
      };
    }

    if (!quote.tierPricing) {
      const integrationIssue = quote.integrationIssues.find(
        (candidate) => candidate.code === 'TIER_PRICING_PRODUCT_MISMATCH',
      );
      issues.push(
        resolutionIssue(
          integrationIssue
            ? 'TIER_PRICING_PRODUCT_MISMATCH'
            : 'TIER_PRICING_UNAVAILABLE',
          integrationIssue?.message ??
            quote.integrationIssues[0]?.message ??
            `Tier pricing is unavailable for Product ${quote.productId}.`,
          quote.productId,
          request.quantity,
          selectedTierId!,
        ),
      );
      return unresolvedResult(
        quote,
        request.quantity,
        mode,
        selectedTierId,
        tierEligibility,
        issues,
      );
    }

    if (
      comparable(quote.tierPricing.productId) !== comparable(quote.productId)
    ) {
      issues.push(
        resolutionIssue(
          'TIER_PRICING_PRODUCT_MISMATCH',
          `Tier pricing evidence belongs to Product ${quote.tierPricing.productId}, not Product ${quote.productId}.`,
          quote.productId,
          request.quantity,
          selectedTierId!,
        ),
      );
      return unresolvedResult(
        quote,
        request.quantity,
        mode,
        selectedTierId,
        tierEligibility,
        issues,
      );
    }

    const selectedTier = quote.tierPricing.tiers.find(
      (line) => comparable(line.tier.id) === comparable(selectedTierId!),
    );

    if (!selectedTier) {
      issues.push(
        resolutionIssue(
          'SELECTED_TIER_NOT_FOUND',
          `Product price tier ${selectedTierId} was not found for Product ${quote.productId}.`,
          quote.productId,
          request.quantity,
          selectedTierId!,
        ),
      );
      return unresolvedResult(
        quote,
        request.quantity,
        mode,
        selectedTierId,
        tierEligibility,
        issues,
      );
    }

    if (
      comparable(selectedTier.tier.productId) !== comparable(quote.productId)
    ) {
      issues.push(
        resolutionIssue(
          'SELECTED_TIER_PRODUCT_MISMATCH',
          `Selected tier ${selectedTier.tier.id} belongs to Product ${selectedTier.tier.productId}, not Product ${quote.productId}.`,
          quote.productId,
          request.quantity,
          selectedTier.tier.id,
        ),
      );
      return unresolvedResult(
        quote,
        request.quantity,
        mode,
        selectedTierId,
        tierEligibility,
        issues,
        selectedTier,
      );
    }

    const selectedEligibility =
      evaluateProductPriceTierQuantityEligibility(
        selectedTier.tier,
        request.quantity,
      );

    if (!selectedEligibility.eligible || selectedEligibility.offerCount === null) {
      issues.push(
        resolutionIssue(
          'SELECTED_TIER_INELIGIBLE',
          `Selected tier ${selectedTier.tier.id} is not eligible for quantity ${request.quantity}.`,
          quote.productId,
          request.quantity,
          selectedTier.tier.id,
        ),
      );
      return unresolvedResult(
        quote,
        request.quantity,
        mode,
        selectedTierId,
        tierEligibility,
        issues,
        selectedTier,
      );
    }

    if (!tierEconomicsResolvable(selectedTier)) {
      issues.push(
        resolutionIssue(
          'SELECTED_TIER_ECONOMICS_UNAVAILABLE',
          `Selected tier ${selectedTier.tier.id} does not have resolvable tier economics.`,
          quote.productId,
          request.quantity,
          selectedTier.tier.id,
        ),
      );
      return unresolvedResult(
        quote,
        request.quantity,
        mode,
        selectedTierId,
        tierEligibility,
        issues,
        selectedTier,
      );
    }

    const economics = selectedTier.economics!;
    const offerCount = selectedEligibility.offerCount;
    const totalSellingPrice =
      selectedTier.tier.priceBasis === 'per-offer'
        ? economics.offerSellingPrice * offerCount
        : economics.effectiveUnitSellingPrice * request.quantity;
    const unitSellingPrice = totalSellingPrice / request.quantity;

    if (
      !finiteNonNegative(totalSellingPrice) ||
      !finiteNonNegative(unitSellingPrice)
    ) {
      issues.push(
        resolutionIssue(
          'RESOLVED_PRICE_INVALID',
          `Selected tier ${selectedTier.tier.id} produced invalid resolved selling-price values.`,
          quote.productId,
          request.quantity,
          selectedTier.tier.id,
        ),
      );
      return unresolvedResult(
        quote,
        request.quantity,
        mode,
        selectedTierId,
        tierEligibility,
        issues,
        selectedTier,
      );
    }

    return {
      productId: quote.productId,
      productName: quote.productName,
      productIsActive: quote.productIsActive,
      quantity: request.quantity,
      mode,
      selectedTierId: selectedTier.tier.id,
      status: 'ready',
      offerCount,
      unitSellingPrice,
      totalSellingPrice,
      integratedQuote: structuredClone(quote),
      selectedTier: structuredClone(selectedTier),
      eligibleTierIds: tierEligibility
        .filter((candidate) => candidate.productMatches && candidate.eligible)
        .map((candidate) => candidate.tierId),
      tierEligibility: structuredClone(tierEligibility),
      warnings: selectedTier.warnings.map((warning) => ({ ...warning })),
      issues: [],
    };
  }
}
