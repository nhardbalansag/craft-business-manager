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

    const addButton = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Add another product',
    )!;
    await act(async () => addButton.click());

    const secondItem = dialog.querySelector<HTMLElement>(
      '[aria-label="Quotation item 2"]',
    )!;
    const productSelect = Array.from(
      secondItem.querySelectorAll<HTMLSelectElement>('select'),
    )[0]!;

    const duplicateOption = Array.from(productSelect.options).find(
      (option) => option.value === 'PROD-A',
    )!;
    expect(duplicateOption.disabled).toBe(true);

    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )!.set!.call(productSelect, 'PROD-B');
      productSelect.dispatchEvent(new Event('change', { bubbles: true }));
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
  });
});
