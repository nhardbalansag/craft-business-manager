// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductPriceTierQuoteResult } from '../../application/productPriceTiers/ProductPriceTierQuoteService';
import { ProductPriceTierCatalogPanel } from './ProductPriceTierCatalogPanel';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function quote(): ProductPriceTierQuoteResult {
  return {
    productId: 'PROD-A',
    productName: 'Paintable Star',
    productIsActive: true,
    status: 'ready',
    costStatus: 'ready',
    defaultPricingStatus: 'ready',
    defaultSellingPrice: 50,
    knownFullyLoadedUnitCostSubtotal: 30,
    totalFullyLoadedUnitCost: 30,
    fullyLoadedUnitCost: {
      productId: 'PROD-A',
      productName: 'Paintable Star',
      productIsActive: true,
      status: 'ready',
      directMaterialCost: null,
      directMaterialMode: 'neutral-component-only',
      directMaterialCostSubtotal: 0,
      materialComponentCostSubtotal: 0,
      productComponentCostSubtotal: 0,
      inputMaterialComponentSubtotal: 0,
      laborCostPerUnit: 15,
      overheadCostPerUnit: 15,
      knownFullyLoadedUnitCostSubtotal: 30,
      totalFullyLoadedUnitCost: 30,
      componentLines: [],
      issues: [],
    },
    tiers: [
      {
        tier: {
          id: 'TIER-0001',
          productId: 'PROD-A',
          name: 'Bulk 20+',
          kind: 'bulk',
          priceBasis: 'per-unit',
          priceAmount: 40,
          unitsPerOffer: 1,
          minimumOrderQuantity: 20,
          additionalCostPerOffer: 0,
          notes: 'Wholesale counter price',
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
        defaultComparison: {
          defaultSellingPrice: 50,
          defaultEquivalentOfferPrice: 50,
          discountAmountVsDefault: 10,
          discountRateVsDefault: 0.2,
        },
        belowCost: false,
        warnings: [],
        issues: [],
      },
      {
        tier: {
          id: 'TIER-OLD',
          productId: 'PROD-A',
          name: 'Old Event Price',
          kind: 'custom',
          priceBasis: 'per-unit',
          priceAmount: 20,
          unitsPerOffer: 1,
          minimumOrderQuantity: 10,
          additionalCostPerOffer: 0,
          isActive: false,
        },
        status: 'ready',
        economics: {
          fullyLoadedUnitCost: 30,
          unitsPerOffer: 1,
          baseOfferCost: 30,
          additionalCostPerOffer: 0,
          totalOfferCost: 30,
          offerSellingPrice: 20,
          effectiveUnitSellingPrice: 20,
          profitPerOffer: -10,
          effectiveProfitPerUnit: -10,
          effectiveMarkup: -1 / 3,
          effectiveMargin: -0.5,
        },
        defaultComparison: {
          defaultSellingPrice: 50,
          defaultEquivalentOfferPrice: 50,
          discountAmountVsDefault: 30,
          discountRateVsDefault: 0.6,
        },
        belowCost: true,
        warnings: [
          {
            code: 'BELOW_COST',
            message: 'Product price tier TIER-OLD sells below its current fully loaded offer cost.',
            productId: 'PROD-A',
            tierId: 'TIER-OLD',
          },
        ],
        issues: [],
      },
    ],
    issues: [],
  };
}

describe('TP6A ProductPriceTierCatalogPanel', () => {
  it('renders saved tier source terms and read-only economics for active and archived tiers', async () => {
    await act(async () => {
      root.render(
        <ProductPriceTierCatalogPanel
          productName="Paintable Star"
          quote={quote()}
          loading={false}
          error={null}
        />,
      );
    });

    const catalog = container.querySelector('[aria-label="Tier pricing catalog"]');
    expect(catalog).not.toBeNull();

    const text = catalog!.textContent ?? '';
    expect(text).toContain('Price tier catalog');
    expect(text).toContain('Bulk 20+');
    expect(text).toContain('Old Event Price');
    expect(text).toContain('Active');
    expect(text).toContain('Archived');
    expect(text).toContain('PHP 40.00 / unit');
    expect(text).toContain('PHP 30.00');
    expect(text).toContain('PHP 10.00');
    expect(text).toContain('33.3333%');
    expect(text).toContain('25%');
    expect(text).toContain('Tier savings vs Default');
    expect(text).toContain('20%');
    expect(text).toContain('Wholesale counter price');
    expect(text).toContain('sells below its current fully loaded offer cost');
  });

  it('keeps the catalog explicitly read-only and does not expose tier mutation controls', async () => {
    await act(async () => {
      root.render(
        <ProductPriceTierCatalogPanel
          productName="Paintable Star"
          quote={quote()}
          loading={false}
          error={null}
        />,
      );
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Read-only Package, Bulk, and Custom offer economics');
    expect(text).toContain('no tier is automatically selected');
    expect(text).not.toContain('Create tier');
    expect(text).not.toContain('Edit tier');
    expect(text).not.toContain('Archive tier');
  });

  it('shows a truthful no-tier state while preserving Default / Single pricing', async () => {
    const empty = { ...quote(), tiers: [] };

    await act(async () => {
      root.render(
        <ProductPriceTierCatalogPanel
          productName="Paintable Star"
          quote={empty}
          loading={false}
          error={null}
        />,
      );
    });

    expect(container.textContent).toContain('No price tiers saved for Paintable Star');
    expect(container.textContent).toContain('Default / Single pricing continues to work exactly as before');
    expect(container.querySelector('[aria-label="Tier catalog summary"]')?.textContent).toContain('0');
  });

  it('shows that unsaved financial inputs are excluded from authoritative tier economics', async () => {
    await act(async () => {
      root.render(
        <ProductPriceTierCatalogPanel
          productName="Paintable Star"
          quote={quote()}
          loading={false}
          error={null}
          hasUnsavedChanges
        />,
      );
    });

    expect(container.textContent).toContain(
      'Unsaved financial changes are not included in tier economics.',
    );
  });
  it('exposes TP6B create/edit/archive callbacks only when mutation actions are supplied', async () => {
    const onCreateTier = vi.fn();
    const onEditTier = vi.fn();
    const onArchiveTier = vi.fn();
    const source = quote();

    await act(async () => {
      root.render(
        <ProductPriceTierCatalogPanel
          productName="Paintable Star"
          quote={source}
          loading={false}
          error={null}
          onCreateTier={onCreateTier}
          onEditTier={onEditTier}
          onArchiveTier={onArchiveTier}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const create = buttons.find((button) => button.textContent?.trim() === 'Create tier');
    const editActive = buttons.find(
      (button) => button.getAttribute('aria-label') === 'Edit tier Bulk 20+',
    );
    const archiveActive = buttons.find(
      (button) => button.getAttribute('aria-label') === 'Archive tier Bulk 20+',
    );
    const editArchived = buttons.find(
      (button) => button.getAttribute('aria-label') === 'Edit tier Old Event Price',
    );
    const archiveArchived = buttons.find(
      (button) => button.getAttribute('aria-label') === 'Archive tier Old Event Price',
    );

    expect(create).toBeDefined();
    expect(editActive).toBeDefined();
    expect(archiveActive).toBeDefined();
    expect(editArchived).toBeDefined();
    expect(archiveArchived).toBeUndefined();

    await act(async () => create!.click());
    await act(async () => editActive!.click());
    await act(async () => archiveActive!.click());

    expect(onCreateTier).toHaveBeenCalledOnce();
    expect(onEditTier).toHaveBeenCalledWith(source.tiers[0]!.tier);
    expect(onArchiveTier).toHaveBeenCalledWith(source.tiers[0]!.tier);
  });

  it('exposes semantic headings, busy state, and named tier diagnostics', async () => {
    const source = quote();

    await act(async () => {
      root.render(
        <ProductPriceTierCatalogPanel
          productName="Paintable Star"
          quote={source}
          loading={false}
          error={null}
          onEditTier={vi.fn()}
          onArchiveTier={vi.fn()}
        />,
      );
    });

    const catalog = container.querySelector<HTMLElement>('[aria-label="Tier pricing catalog"]')!;
    expect(catalog.getAttribute('aria-labelledby')).toBe('tier-pricing-catalog-heading');
    expect(catalog.getAttribute('aria-busy')).toBe('false');
    expect(container.querySelector('#tier-pricing-catalog-heading')?.textContent).toBe(
      'Price tier catalog',
    );

    const bulkCard = container.querySelector<HTMLElement>('[aria-label="Price tier Bulk 20+"]')!;
    const bulkHeadingId = bulkCard.getAttribute('aria-labelledby');
    expect(bulkHeadingId).toBe('price-tier-TIER-0001-heading');
    expect(container.querySelector(`#${bulkHeadingId}`)?.textContent).toBe('Bulk 20+');

    const warning = container.querySelector<HTMLElement>(
      '[aria-label="Pricing warnings for Old Event Price"]',
    );
    expect(warning?.getAttribute('role')).toBe('status');

    const editButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Edit tier Bulk 20+"]',
    );
    const archiveButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Archive tier Bulk 20+"]',
    );
    expect(editButton?.type).toBe('button');
    expect(archiveButton?.type).toBe('button');
  });
});
