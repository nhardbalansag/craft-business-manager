// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import type { Product } from '../../domain/products';
import { PricingPage } from './PricingPage';

let container: HTMLDivElement;
let root: Root;

const product: Product = {
  id: 'ART-001',
  name: 'Paintable Star',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.materialRepository.replaceAll([]),
    session.productRepository.replaceAll([]),
    session.mixPresetRepository.replaceAll([]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
    session.productPriceTierRepository.replaceAll([]),
  ]);
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

async function seed() {
  await session.productRepository.replaceAll([product]);
}

async function mount() {
  await act(async () => root.render(<PricingPage />));
}

function resolutionFixture(
  quantity: number,
  selectedTierId?: string,
): ProductPriceResolutionResult {
  const tier = {
    tier: {
      id: 'TIER-0001',
      productId: 'ART-001',
      name: 'Bulk 20+',
      kind: 'bulk' as const,
      priceBasis: 'per-unit' as const,
      priceAmount: 40,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      isActive: true,
    },
    status: 'ready' as const,
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

  const eligible = Number.isInteger(quantity) && quantity >= 20;
  const explicit = selectedTierId === 'TIER-0001' && eligible;

  return {
    productId: 'ART-001',
    productName: 'Paintable Star',
    productIsActive: true,
    quantity,
    mode: selectedTierId === undefined ? 'default' : 'explicit-tier',
    selectedTierId: selectedTierId ?? null,
    status: selectedTierId !== undefined && !explicit ? 'not-ready' : 'ready',
    offerCount: explicit ? quantity : selectedTierId === undefined ? quantity : null,
    unitSellingPrice: explicit ? 40 : selectedTierId === undefined ? 70 : null,
    totalSellingPrice: explicit
      ? 40 * quantity
      : selectedTierId === undefined
        ? 70 * quantity
        : null,
    integratedQuote: {
      productId: 'ART-001',
      productName: 'Paintable Star',
      productIsActive: true,
      status: 'ready',
      sellingPrice: 70,
      tierPricing: {
        productId: 'ART-001',
        productName: 'Paintable Star',
        productIsActive: true,
        tiers: [tier],
        issues: [],
      },
      integrationIssues: [],
    },
    selectedTier: explicit ? tier : null,
    eligibleTierIds: eligible ? ['TIER-0001'] : [],
    tierEligibility: [{
      tierId: 'TIER-0001',
      productId: 'ART-001',
      productMatches: true,
      eligible,
      offerCount: eligible ? quantity : null,
      issues: eligible
        ? []
        : [{
            code: 'QUANTITY_BELOW_MINIMUM',
            message: `Quantity ${quantity} is below the minimum order quantity of 20 for tier TIER-0001.`,
            productId: 'ART-001',
            tierId: 'TIER-0001',
            quantity,
          }],
    }],
    warnings: [],
    issues:
      selectedTierId !== undefined && !explicit
        ? [{
            code: 'SELECTED_TIER_INELIGIBLE',
            message: `Selected tier TIER-0001 is not eligible for quantity ${quantity}.`,
            productId: 'ART-001',
            quantity,
            tierId: 'TIER-0001',
          }]
        : [],
  } as unknown as ProductPriceResolutionResult;
}

function form() {
  return container.querySelector<HTMLFormElement>('[aria-label="Pricing financial profile"]');
}

function field(label: string, scope: ParentNode = form()!) {
  const parent = Array.from(scope.querySelectorAll('label')).find((item) =>
    item.querySelector('span')?.textContent?.trim().startsWith(label),
  );
  if (!parent) throw new Error(`Missing field: ${label}`);
  return parent.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')!;
}

async function fill(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

async function click(text: string, scope: ParentNode = container) {
  const button = Array.from(scope.querySelectorAll('button')).find(
    (item) => item.getAttribute('aria-label') === text || item.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Missing button: ${text}`);
  await act(async () => button.click());
}

async function submit() {
  await act(async () => form()!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await act(async () => Promise.resolve());
}

describe('Pricing workspace UI/UX', () => {
  it('shows truthful loading guidance and the three-step pricing workflow', async () => {
    await seed();
    let release!: (value: Product[]) => void;
    vi.spyOn(session.productService, 'listProducts').mockImplementationOnce(
      () => new Promise((resolve) => { release = resolve; }),
    );

    await mount();

    expect(container.textContent).toContain('Included in workbook exports');
    expect(container.querySelector('[aria-label="Pricing workflow"]')?.textContent).toContain('Choose the product');
    expect(container.querySelector('[aria-label="Pricing workflow"]')?.textContent).toContain('Set financial inputs');
    expect(container.querySelector('[aria-label="Pricing workflow"]')?.textContent).toContain('Review saved unit economics');
    expect(container.textContent).toContain('Loading pricing workspace');
    expect(container.textContent).not.toContain('Create a Product first');

    await act(async () => release([product]));
    expect(form()).not.toBeNull();
    expect(container.textContent).toContain('Paintable Star');
  });

  it('keeps Product Catalog hidden until opened as a modal and closes it after Product selection', async () => {
    const secondProduct: Product = {
      id: 'CND-002',
      name: 'Event Candle',
      category: 'candle',
      safetyWasteRate: 0.03,
      isActive: true,
    };
    await session.productRepository.replaceAll([product, secondProduct]);

    await mount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain('Open Product Catalog');

    await click('Open Product Catalog');

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.textContent).toContain('PRODUCT CATALOG');
    expect(dialog?.textContent).toContain('Paintable Star');
    expect(dialog?.textContent).toContain('Event Candle');
    expect(dialog?.querySelector('[aria-label="Search pricing products"]')).not.toBeNull();
    expect(dialog?.querySelector('[aria-label="Filter pricing products by status"]')).not.toBeNull();

    await click('Price Event Candle', dialog!);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(form()?.textContent).toContain('Event Candle');
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain(
      'CND-002',
    );
  });

  it('closes the Product Catalog modal with Escape', async () => {
    await seed();
    await mount();
    await act(async () => Promise.resolve());

    await click('Open Product Catalog');
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('previews draft inputs, marks unsaved changes, and saves canonical markup source values', async () => {
    await seed();
    await mount();

    const saveButton = form()!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(saveButton.disabled).toBe(true);

    await fill(field('Labor cost per unit'), '10');
    await fill(field('Overhead cost per unit'), '5');
    await fill(field('Pricing method'), 'markup-percent');
    await fill(field('Markup (%)'), '50');

    const preview = container.querySelector('[aria-label="Draft financial input preview"]')!;
    expect(preview.textContent).toContain('PHP 15.00');
    expect(preview.textContent).toContain('Markup · 50%');
    expect(preview.textContent).toContain('Ready to save');
    expect(container.textContent).toContain('Unsaved changes');
    expect(container.textContent).toContain('Unsaved financial changes are not included below');
    expect(saveButton.disabled).toBe(false);

    await submit();

    const saved = await session.productFinancialProfileService.getProfile('ART-001');
    expect(saved).toMatchObject({
      productId: 'ART-001',
      laborCostPerUnit: 10,
      overheadCostPerUnit: 5,
      pricingPolicy: { method: 'markup-percent', value: 0.5 },
    });
    expect(container.textContent).toContain('Financial profile saved for Paintable Star');
    expect(container.textContent).not.toContain('Unsaved financial changes are not included below');
  });

  it('resets an edited draft back to the authoritative saved profile', async () => {
    await seed();
    await session.productFinancialProfileRepository.replaceAll([{
      productId: 'ART-001',
      laborCostPerUnit: 12,
      overheadCostPerUnit: 3,
      pricingPolicy: { method: 'profit-amount', value: 20 },
      notes: 'saved assumption',
    }]);

    await mount();

    expect((field('Labor cost per unit') as HTMLInputElement).value).toBe('12');
    await fill(field('Labor cost per unit'), '25');
    expect(container.textContent).toContain('Unsaved changes');

    await click('Reset changes', form()!);

    expect((field('Labor cost per unit') as HTMLInputElement).value).toBe('12');
    expect((field('Profit per unit (PHP)') as HTMLInputElement).value).toBe('20');
    expect(container.textContent).not.toContain('Unsaved financial changes are not included below');
  });

  it('recovers a failed initial catalog load without presenting a false empty-product state', async () => {
    await seed();
    vi.spyOn(session.productService, 'listProducts').mockRejectedValueOnce(new Error('Product catalog failed'));

    await mount();

    expect(
      container.querySelector('[aria-label="Selected pricing Product"]')?.textContent,
    ).toContain('Pricing workspace unavailable');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Product catalog failed',
    );
    expect(container.textContent).not.toContain('Create a Product first');

    await click('Retry loading');

    expect(form()).not.toBeNull();
    expect(container.textContent).toContain('Paintable Star');
  });

  it('keeps the saved quote refreshable while technical component traces stay secondary', async () => {
    await seed();
    const quoteSpy = vi.spyOn(session.productPricingQuoteService, 'quoteProduct');

    await mount();
    await act(async () => Promise.resolve());

    expect(container.querySelector('[aria-label="Pricing result summary"]')).not.toBeNull();
    expect(container.textContent).toContain('Saved pricing result');
    expect(container.textContent).toContain('Cost trace details');

    const refresh = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Refresh saved quote') || button.textContent?.includes('Retry quote'),
    );
    expect(refresh).toBeDefined();
    await act(async () => refresh!.click());
    expect(quoteSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
  it('loads Default / Single and tier alternatives through the TP7 integrated quote boundary', async () => {
    await seed();
    await session.productPriceTierRepository.replaceAll([
      {
        id: 'TIER-0001',
        productId: 'ART-001',
        name: 'Bulk 20+',
        kind: 'bulk',
        priceBasis: 'per-unit',
        priceAmount: 40,
        unitsPerOffer: 1,
        minimumOrderQuantity: 20,
        additionalCostPerOffer: 0,
        notes: 'Read-only TP6A source',
        isActive: true,
      },
    ]);
    const integratedQuoteSpy = vi.spyOn(
      session.productPricingQuoteIntegrationService,
      'quoteProduct',
    );
    const tierQuoteSpy = vi.spyOn(
      session.productPriceTierQuoteService,
      'quoteProduct',
    );

    await mount();
    await act(async () => Promise.resolve());

    const catalog = container.querySelector('[aria-label="Tier pricing catalog"]');
    expect(catalog).not.toBeNull();
    expect(catalog?.textContent).toContain('Bulk 20+');
    expect(catalog?.textContent).toContain('Read-only TP6A source');
    expect(catalog?.textContent).toContain('Authoritative tier economics are unavailable');
    expect(integratedQuoteSpy).toHaveBeenCalledWith('ART-001');
    expect(tierQuoteSpy).toHaveBeenCalledWith('ART-001');
    expect(container.querySelector('[aria-label="Pricing result summary"]')).not.toBeNull();
    expect(catalog?.textContent).toContain('Create tier');
    expect(catalog?.textContent).toContain('Edit tier');
    expect(catalog?.textContent).toContain('Archive tier');
    expect(catalog?.textContent).not.toContain('Restore tier');
  });

  it('creates, edits, and archives a tier through the Pricing workspace while keeping the stable tier ID', async () => {
    await seed();
    await mount();
    await act(async () => Promise.resolve());

    await click('Create tier');

    const tierForm = container.querySelector<HTMLFormElement>(
      '[aria-label="Price tier editor"]',
    );
    expect(tierForm).not.toBeNull();

    await fill(field('Tier name', tierForm!), 'Bulk 20+');
    await fill(field('Tier kind', tierForm!), 'bulk');
    await fill(field('Price basis', tierForm!), 'per-unit');
    expect((field('Pricing method', tierForm!) as HTMLSelectElement).value).toBe('profit-per-unit');
    await fill(field('Profit per unit', tierForm!), '10');
    await fill(field('Units per offer', tierForm!), '1');
    await fill(field('Minimum order quantity', tierForm!), '20');
    await fill(field('Additional cost per offer', tierForm!), '0');
    await fill(field('Notes', tierForm!), 'Wholesale counter price');

    await act(async () => {
      tierForm!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const created = await session.productPriceTierService.listTiersByProduct('ART-001');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      id: 'TIER-0001',
      name: 'Bulk 20+',
      pricingMethod: 'profit-per-unit',
      pricingValue: 10,
      minimumOrderQuantity: 20,
      notes: 'Wholesale counter price',
      isActive: true,
    });
    expect(container.textContent).toContain('created as TIER-0001');

    await click('Edit tier Bulk 20+');
    const editForm = container.querySelector<HTMLFormElement>(
      '[aria-label="Price tier editor"]',
    )!;
    expect(editForm.textContent).toContain('TIER-0001');
    await fill(field('Tier name', editForm), 'Bulk 25+');
    await fill(field('Profit per unit', editForm), '8');
    await fill(field('Minimum order quantity', editForm), '25');

    await act(async () => {
      editForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const updated = await session.productPriceTierService.getTier('TIER-0001');
    expect(updated).toMatchObject({
      id: 'TIER-0001',
      name: 'Bulk 25+',
      pricingMethod: 'profit-per-unit',
      pricingValue: 8,
      minimumOrderQuantity: 25,
      isActive: true,
    });
    expect(container.textContent).toContain('Price tier Bulk 25+ updated');

    await click('Archive tier Bulk 25+');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await session.productPriceTierService.getTier('TIER-0001')).toMatchObject({
      id: 'TIER-0001',
      isActive: false,
    });
    expect(container.textContent).toContain('Price tier Bulk 25+ archived');
    expect(
      container.querySelector('[aria-label="Price tier Bulk 25+"]')?.textContent,
    ).toContain('Archived');
    expect(container.textContent).not.toContain('Restore tier');
  });

  it('does not expose Create tier for an archived selected Product', async () => {
    await session.productRepository.replaceAll([{ ...product, isActive: false }]);

    await mount();
    await act(async () => Promise.resolve());

    const catalog = container.querySelector('[aria-label="Tier pricing catalog"]');
    expect(catalog).not.toBeNull();
    expect(
      Array.from(catalog!.querySelectorAll('button')).some(
        (button) => button.textContent?.trim() === 'Create tier',
      ),
    ).toBe(false);
  });

  it('resolves Default first, then manually previews a quantity-eligible tier through TP8C', async () => {
    await seed();
    const resolveSpy = vi
      .spyOn(session.productPriceResolutionService, 'resolve')
      .mockImplementation(async (request) =>
        resolutionFixture(request.quantity, request.selectedTierId),
      );

    await mount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const preview = container.querySelector<HTMLElement>(
      '.pricing-resolution-section',
    );
    expect(preview).not.toBeNull();

    const defaultRadio = preview!.querySelector<HTMLInputElement>(
      'input[value="default"]',
    )!;
    expect(defaultRadio.checked).toBe(true);
    expect(preview!.textContent).toContain('Default / Single');
    expect(preview!.textContent).toContain('PHP 70.00');

    const quantity = field('Order quantity', preview!);
    await fill(quantity, '20');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveSpy).toHaveBeenCalledWith({
      productId: 'ART-001',
      quantity: 20,
    });

    const tierRadio = preview!.querySelector<HTMLInputElement>(
      'input[value="TIER-0001"]',
    )!;
    expect(tierRadio.disabled).toBe(false);

    await act(async () => tierRadio.click());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveSpy).toHaveBeenCalledWith({
      productId: 'ART-001',
      quantity: 20,
      selectedTierId: 'TIER-0001',
    });
    expect(
      container.querySelector('[aria-label="Resolved order pricing preview"]')
        ?.textContent,
    ).toContain('PHP 800.00');
    expect(preview!.textContent).toContain(
      'Production projections continue to use Default / Single pricing',
    );
  });

});
