// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import type { ProductPriceTierQuoteLine } from '../../application/productPriceTiers/ProductPriceTierQuoteService';
import { ProductPriceResolutionPanel } from './ProductPriceResolutionPanel';

let container: HTMLDivElement;
let root: Root;

const bulkLine: ProductPriceTierQuoteLine = {
  tier: {
    id: 'TIER-0001',
    productId: 'P',
    name: 'Bulk 20+',
    kind: 'bulk',
    priceBasis: 'per-unit',
    priceAmount: 40,
    unitsPerOffer: 1,
    minimumOrderQuantity: 20,
    additionalCostPerOffer: 0,
    isActive: true,
  },
  status: 'ready',
  economics: {
    fullyLoadedUnitCost: 30,
    unitsPerOffer: 1,
    baseOfferCost: 30,
    additionalCostPerOffer: 0,
    totalOfferCost: 30,
    offerSellingPrice: 40,
    effectiveUnitSellingPrice: 40,
    profitPerOffer: 10,
    effectiveProfitPerUnit: 10,
    effectiveMarkup: 1 / 3,
    effectiveMargin: 0.25,
  },
  defaultComparison: null,
  belowCost: false,
  warnings: [],
  issues: [],
};

const packageLine: ProductPriceTierQuoteLine = {
  tier: {
    id: 'TIER-0002',
    productId: 'P',
    name: 'Package 6',
    kind: 'package',
    priceBasis: 'per-offer',
    priceAmount: 210,
    unitsPerOffer: 6,
    minimumOrderQuantity: 6,
    additionalCostPerOffer: 0,
    isActive: true,
  },
  status: 'ready',
  economics: {
    fullyLoadedUnitCost: 30,
    unitsPerOffer: 6,
    baseOfferCost: 180,
    additionalCostPerOffer: 0,
    totalOfferCost: 180,
    offerSellingPrice: 210,
    effectiveUnitSellingPrice: 35,
    profitPerOffer: 30,
    effectiveProfitPerUnit: 5,
    effectiveMarkup: 1 / 6,
    effectiveMargin: 1 / 7,
  },
  defaultComparison: null,
  belowCost: false,
  warnings: [],
  issues: [],
};

function result(
  overrides: Partial<ProductPriceResolutionResult> = {},
): ProductPriceResolutionResult {
  return {
    productId: 'P',
    productName: 'Product P',
    productIsActive: true,
    quantity: 20,
    mode: 'default',
    selectedTierId: null,
    status: 'ready',
    offerCount: 20,
    unitSellingPrice: 70,
    totalSellingPrice: 1400,
    integratedQuote: {
      productId: 'P',
      productName: 'Product P',
      productIsActive: true,
      status: 'ready',
      costStatus: 'ready',
      sellingPriceStatus: 'ready',
      metricsStatus: 'ready',
      financialProfile: null,
      fullyLoadedUnitCost: {} as ProductPriceResolutionResult['integratedQuote']['fullyLoadedUnitCost'],
      unitEconomics: {} as ProductPriceResolutionResult['integratedQuote']['unitEconomics'],
      knownFullyLoadedUnitCostSubtotal: 30,
      totalFullyLoadedUnitCost: 30,
      pricingPolicy: null,
      sellingPrice: 70,
      profitPerUnit: 40,
      effectiveMarkup: 4 / 3,
      effectiveMargin: 4 / 7,
      issues: [],
      tierPricing: {
        productId: 'P',
        productName: 'Product P',
        productIsActive: true,
        status: 'ready',
        costStatus: 'ready',
        defaultPricingStatus: 'ready',
        defaultSellingPrice: 70,
        knownFullyLoadedUnitCostSubtotal: 30,
        totalFullyLoadedUnitCost: 30,
        fullyLoadedUnitCost: {} as ProductPriceResolutionResult['integratedQuote']['fullyLoadedUnitCost'],
        tiers: [bulkLine, packageLine],
        issues: [],
      },
      integrationIssues: [],
    },
    selectedTier: null,
    eligibleTierIds: ['TIER-0001'],
    tierEligibility: [
      {
        tierId: 'TIER-0001',
        productId: 'P',
        productMatches: true,
        eligible: true,
        offerCount: 20,
        issues: [],
      },
      {
        tierId: 'TIER-0002',
        productId: 'P',
        productMatches: true,
        eligible: false,
        offerCount: null,
        issues: [{
          code: 'QUANTITY_NOT_OFFER_MULTIPLE',
          message: 'Quantity 20 must be a whole multiple of 6 units per offer for tier TIER-0002.',
          productId: 'P',
          tierId: 'TIER-0002',
          quantity: 20,
        }],
      },
    ],
    warnings: [],
    issues: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TP8D ProductPriceResolutionPanel', () => {
  it('keeps Default / Single selected by default and exposes manual ready-tier selection', async () => {
    const onSelect = vi.fn();

    await act(async () =>
      root.render(
        <ProductPriceResolutionPanel
          productName="Product P"
          quantity="20"
          selectedTierId={null}
          result={result()}
          loading={false}
          error={null}
          onQuantityChange={vi.fn()}
          onSelectPricingSource={onSelect}
        />,
      ),
    );

    const defaultRadio = container.querySelector<HTMLInputElement>(
      'input[value="default"]',
    )!;
    const bulkRadio = container.querySelector<HTMLInputElement>(
      'input[value="TIER-0001"]',
    )!;
    const packageRadio = container.querySelector<HTMLInputElement>(
      'input[value="TIER-0002"]',
    )!;

    expect(defaultRadio.checked).toBe(true);
    expect(bulkRadio.disabled).toBe(false);
    expect(packageRadio.disabled).toBe(true);
    expect(container.textContent).toContain('Ready to select');
    expect(container.textContent).toContain('Quantity 20 must be a whole multiple of 6 units per offer');
    expect(container.textContent).toContain('Production projections continue to use Default / Single pricing');

    await act(async () => bulkRadio.click());
    expect(onSelect).toHaveBeenCalledWith('TIER-0001');
  });

  it('enables customer quotation only for ready saved pricing', async () => {
    const onCreateQuotation = vi.fn();

    await act(async () =>
      root.render(
        <ProductPriceResolutionPanel
          productName="Product P"
          quantity="20"
          selectedTierId={null}
          result={result()}
          loading={false}
          error={null}
          onQuantityChange={vi.fn()}
          onSelectPricingSource={vi.fn()}
          onCreateQuotation={onCreateQuotation}
        />,
      ),
    );

    const quotationButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Customer quotation',
    ) as HTMLButtonElement;

    expect(quotationButton).toBeDefined();
    expect(quotationButton.disabled).toBe(false);

    await act(async () => quotationButton.click());
    expect(onCreateQuotation).toHaveBeenCalledOnce();

    await act(async () =>
      root.render(
        <ProductPriceResolutionPanel
          productName="Product P"
          quantity="20"
          selectedTierId={null}
          result={result()}
          loading={false}
          error={null}
          hasUnsavedChanges
          onQuantityChange={vi.fn()}
          onSelectPricingSource={vi.fn()}
          onCreateQuotation={onCreateQuotation}
        />,
      ),
    );

    const disabledButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Customer quotation',
    ) as HTMLButtonElement;

    expect(disabledButton.disabled).toBe(true);
  });

  it('renders an explicit tier total and preserves below-cost warnings', async () => {
    const belowCost = {
      ...bulkLine,
      belowCost: true,
      warnings: [{
        code: 'BELOW_COST' as const,
        message: 'Bulk 20+ sells below its current fully loaded offer cost.',
        productId: 'P',
        tierId: 'TIER-0001',
      }],
    };

    const explicit = result({
      mode: 'explicit-tier',
      selectedTierId: 'TIER-0001',
      offerCount: 20,
      unitSellingPrice: 40,
      totalSellingPrice: 800,
      selectedTier: belowCost,
      warnings: belowCost.warnings,
      integratedQuote: {
        ...result().integratedQuote,
        tierPricing: {
          ...result().integratedQuote.tierPricing!,
          tiers: [belowCost, packageLine],
        },
      },
    });

    await act(async () =>
      root.render(
        <ProductPriceResolutionPanel
          productName="Product P"
          quantity="20"
          selectedTierId="TIER-0001"
          result={explicit}
          loading={false}
          error={null}
          onQuantityChange={vi.fn()}
          onSelectPricingSource={vi.fn()}
        />,
      ),
    );

    expect(
      container.querySelector('[aria-label="Resolved order pricing preview"]')
        ?.textContent,
    ).toContain('Bulk 20+');
    expect(container.textContent).toContain('PHP 40.00');
    expect(container.textContent).toContain('PHP 800.00');
    expect(
      container.querySelector('[aria-label="Resolved pricing warnings"]')
        ?.textContent,
    ).toContain('sells below its current fully loaded offer cost');
  });
});
