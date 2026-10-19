// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import type { Product } from '../../domain/products';
import { CustomerQuotationDialog } from './CustomerQuotationDialog';

let container: HTMLDivElement;
let root: Root;

const products: Product[] = [
  {
    id: 'PROD-A',
    name: 'Rose Candle',
    category: 'candle',
    safetyWasteRate: 0.03,
    isActive: true,
  },
  {
    id: 'PROD-B',
    name: 'Paintable Bear',
    category: 'paintable-art',
    safetyWasteRate: 0.05,
    isActive: true,
  },
];

function result(
  productId: string,
  productName: string,
  quantity: number,
  unitSellingPrice: number,
): ProductPriceResolutionResult {
  return {
    productId,
    productName,
    productIsActive: true,
    quantity,
    mode: 'default',
    selectedTierId: null,
    status: 'ready',
    offerCount: quantity,
    unitSellingPrice,
    totalSellingPrice: unitSellingPrice * quantity,
    integratedQuote: {
      productId,
      productName,
      productIsActive: true,
      sellingPrice: unitSellingPrice,
      tierPricing: {
        productId,
        productName,
        productIsActive: true,
        tiers: [],
        issues: [],
      },
      integrationIssues: [],
    } as unknown as ProductPriceResolutionResult['integratedQuote'],
    selectedTier: null,
    eligibleTierIds: [],
    tierEligibility: [],
    warnings: [],
    issues: [],
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

describe('CustomerQuotationDialog multi-product workflow', () => {
  it('previews the saved photo for its corresponding quotation item', async () => {
    const photo = `data:image/jpeg;base64,/9j/${'AAAA'.repeat(25)}`;
    const withPhotos = products.map((p) => p.id === 'PROD-A' ? { ...p, imageDataUrl: photo } : p);
    await act(async () => root.render(
      <CustomerQuotationDialog
        open
        result={result('PROD-A', 'Rose Candle', 1, 70)}
        products={withPhotos}
        resolvePrice={async (request) => result(request.productId, 'Paintable Bear', request.quantity, 120)}
        onClose={vi.fn()}
      />,
    ));
    expect(container.querySelector<HTMLImageElement>('.customer-quotation-item-image img')?.src).toBe(photo);
    expect(container.textContent).toContain('Included in printed quotation');
  });


  it('adds a different Product, resolves its price, and prevents duplicate Product selection', async () => {
    const startingResult = result('PROD-A', 'Rose Candle', 1, 70);
    const resolvePrice = vi.fn(async (request: { productId: string; quantity: number }) =>
      result(
        request.productId,
        request.productId === 'PROD-B' ? 'Paintable Bear' : 'Rose Candle',
        request.quantity,
        request.productId === 'PROD-B' ? 120 : 70,
      ),
    );

    await act(async () =>
      root.render(
        <CustomerQuotationDialog
          open
          result={startingResult}
          products={products}
          resolvePrice={resolvePrice}
          onClose={vi.fn()}
        />,
      ),
    );

    const dialog = container.querySelector<HTMLElement>(
      '[aria-labelledby="customer-quotation-title"]',
    )!;
    expect(dialog.textContent).toContain('1 item');
    expect(dialog.textContent).toContain('₱70.00');

    const itemList = dialog.querySelector<HTMLElement>('.customer-quotation-item-list')!;
    const addRow = dialog.querySelector<HTMLElement>('.customer-quotation-add-product-row')!;
    const addButton = addRow.querySelector<HTMLButtonElement>('button')!;
    expect(itemList.nextElementSibling).toBe(addRow);
    expect(addRow.nextElementSibling?.className).not.toContain('customer-quotation-item-list');
    expect(addButton.textContent).toContain('Add another product');
    expect(addButton.disabled).toBe(false);
    expect(dialog.querySelector('.customer-quotation-section-heading button')).toBeNull();
    await act(async () => addButton.click());
    expect(itemList.children).toHaveLength(2);
    expect(itemList.nextElementSibling).toBe(addRow);
    expect(addButton.disabled).toBe(false);

    const secondItem = dialog.querySelector<HTMLElement>(
      '[aria-label="Quotation item 2"]',
    )!;
    await act(async () => secondItem.querySelector<HTMLButtonElement>(
      '[aria-label="Find product for quotation item 2"]',
    )!.click());
    expect(secondItem.querySelector('[role="listbox"]')?.textContent).not.toContain('Rose Candle');
    expect(secondItem.textContent).toContain('already in quotation');

    await act(async () => secondItem.querySelector<HTMLButtonElement>(
      '[role="option"]',
    )!.click());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolvePrice).toHaveBeenCalledWith({
      productId: 'PROD-B',
      quantity: 1,
    });
    expect(secondItem.textContent).toContain('₱120.00');
    expect(dialog.textContent).toContain('2 items');
    expect(dialog.textContent).toContain('₱190.00');
    expect(addButton.disabled).toBe(true);
    expect(dialog.querySelector('.customer-quotation-all-products-note')?.textContent)
      .toContain('All active Products are already included');

    // Removing an item frees a Product slot and the button remains at the bottom.
    const removeSecond = secondItem.querySelector<HTMLButtonElement>(
      '[aria-label="Remove quotation item 2"]',
    )!;
    await act(async () => removeSecond.click());
    expect(itemList.children).toHaveLength(1);
    expect(itemList.nextElementSibling).toBe(addRow);
    expect(addButton.disabled).toBe(false);
  });
});
