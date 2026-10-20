// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Product } from '../../domain/products';
import { ProductsWorkspacePage } from './ProductsWorkspacePage';

const product: Product = {
  id: 'PRD-1',
  name: 'Dinosaur Toy',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.materialRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.mixPresetRepository.replaceAll([]),
    session.productRepository.replaceAll([product]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
    session.storageLocationRepository.replaceAll([]),
    session.moldRepository.replaceAll([]),
    session.plasterMoldYieldProfileRepository.replaceAll([]),
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

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('ProductsWorkspacePage', () => {
  it('puts Back to product catalog beside Save product and preserves an unsaved edit', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Dinosaur Toy"]')!.click());
    const actions = container.querySelector<HTMLElement>('.product-editor-savebar-actions')!;
    const bottomBack = actions.querySelector<HTMLButtonElement>('.product-editor-bottom-back')!;
    const save = actions.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(bottomBack.textContent).toContain('Back to product catalog');
    expect(bottomBack.type).toBe('button');
    expect(save.textContent).toContain('Save product');
    expect(bottomBack.nextElementSibling).toBe(save);

    const name = container.querySelector<HTMLInputElement>('input[placeholder="Paintable star"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Draft dinosaur');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => bottomBack.click());
    expect(container.querySelector('.product-catalog.is-editor-shell-open')).toBeNull();
    expect(container.querySelector('.product-resume-draft')?.textContent).toContain('Continue your unsaved draft');
    expect((await session.productService.getProduct('PRD-1'))?.name).toBe('Dinosaur Toy');

    await act(async () => container.querySelector<HTMLButtonElement>('.product-resume-draft button')!.click());
    expect(name.value).toBe('Draft dinosaur');
    expect(container.querySelector('.product-catalog.is-editor-shell-open')).not.toBeNull();
  });

  it('puts Back to product catalog beside Create product without submitting an unfinished new item', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="+ New product"]')!.click());

    const actions = container.querySelector<HTMLElement>('.product-editor-savebar-actions')!;
    const back = actions.querySelector<HTMLButtonElement>('.product-editor-bottom-back')!;
    const create = actions.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(back.type).toBe('button');
    expect(back.textContent).toContain('Back to product catalog');
    expect(create.textContent).toContain('Create product');
    expect(back.nextElementSibling).toBe(create);

    const name = container.querySelector<HTMLInputElement>('input[placeholder="Paintable star"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Draft new candle');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => back.click());
    expect(container.querySelector('.product-catalog.is-editor-shell-open')).toBeNull();
    expect(container.querySelector('.product-resume-draft')?.textContent).toContain('A new product is in progress');
    expect(await session.productService.listProducts()).toHaveLength(1);

    await act(async () => container.querySelector<HTMLButtonElement>('.product-resume-draft button')!.click());
    expect(name.value).toBe('Draft new candle');
  });

  it('preserves the product draft and catalog layout when visiting molds and storage', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Dinosaur Toy"]')!.click());
    const name = container.querySelector<HTMLInputElement>('input[placeholder="Paintable star"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Draft dinosaur');
      name.dispatchEvent(new Event('input', { bubbles: true }));
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Compact')!.click();
    });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-controls="products-physical-area"]')!.click());
    await flush();
    expect(container.querySelector('#products-catalog-area')?.hasAttribute('hidden')).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-controls="products-catalog-area"]')!.click());
    expect(name.value).toBe('Draft dinosaur');
    expect(container.querySelector('.product-card-grid.is-compact')).not.toBeNull();
    expect((await session.productService.getProduct('PRD-1'))?.name).toBe('Dinosaur Toy');
  });

  it('places Yield and Pricing inside Products and opens the selected Product', async () => {
    await session.productRepository.replaceAll([product, { ...product, id: 'PRD-2', name: 'Rose Candle' }]);
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    const outerTabs = container.querySelector('[aria-label="Products workshop areas"]')!;
    expect(outerTabs.textContent).not.toContain('Pricing & quotations');
    const views = container.querySelector('[aria-label="Product workspace views"]')!;
    expect(Array.from(views.querySelectorAll('strong')).map((element) => element.textContent))
      .toEqual(['Products', 'Yield', 'Components', 'Finished stock', 'Pricing']);

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Rose Candle"]')!.click());
    const name = container.querySelector<HTMLInputElement>('input[placeholder="Paintable star"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Draft rose');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => views.querySelector<HTMLButtonElement>('[aria-controls="products-view-pricing"]')!.click());
    await flush();
    const selected = container.querySelector('[aria-label="Selected pricing Product"]')!;
    expect(selected.querySelector('h2')?.textContent).toBe('Rose Candle');
    expect(selected.textContent).toContain('PRD-2');
    expect(container.querySelector('[aria-label="Financial source summary"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Tier pricing summary"]')).not.toBeNull();
    expect(container.textContent).toContain('Open Order Price Preview');

    await act(async () => views.querySelector<HTMLButtonElement>('[aria-controls="products-view-products"]')!.click());
    expect(container.querySelector('#products-view-pricing')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('[aria-label="Selected pricing Product"]')).not.toBeNull();
    expect(name.value).toBe('Draft rose');

    // Direct Pricing action changes the shared Product without searching in the Pricing catalog.
    await act(async () => container.querySelector<HTMLButtonElement>('.product-editor-back')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Pricing for Dinosaur Toy"]')!.click());
    await flush();
    expect(container.querySelector('[aria-label="Selected pricing Product"] h2')?.textContent).toBe('Dinosaur Toy');
  });

  it('uses the current Products selection in Yield without a second product search', async () => {
    await session.productRepository.replaceAll([product, { ...product, id: 'PRD-2', name: 'Rose Candle' }]);
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    const tabs = container.querySelector('[aria-label="Product workspace views"]')!;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Rose Candle"]')!.click());
    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-yield"]')!.click());
    await flush();

    const yieldPanel = container.querySelector<HTMLElement>('#products-view-yield')!;
    expect(yieldPanel.hasAttribute('hidden')).toBe(false);
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Rose Candle');
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('PRD-2');
    expect(yieldPanel.querySelector('[aria-label="Search products for yield"]')).toBeNull();
    expect(yieldPanel.querySelector('[aria-label="Yield sample"]')).not.toBeNull();

    await act(async () => yieldPanel.querySelector<HTMLButtonElement>('.yield-change-product')!.click());
    expect(container.querySelector('#products-view-products')?.hasAttribute('hidden')).toBe(false);
    await act(async () => container.querySelector<HTMLButtonElement>('.product-editor-back')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Dinosaur Toy"]')!.click());
    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-yield"]')!.click());
    await flush();
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Dinosaur Toy');
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('PRD-1');

    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-pricing"]')!.click());
    await flush();
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain('Dinosaur Toy');
  });

  it('keeps an unsaved Yield batch until an external Products selection is confirmed', async () => {
    await session.productRepository.replaceAll([product, { ...product, id: 'PRD-2', name: 'Rose Candle' }]);
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    const tabs = container.querySelector('[aria-label="Product workspace views"]')!;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Dinosaur Toy"]')!.click());
    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-yield"]')!.click());
    await flush();

    const yieldPanel = container.querySelector<HTMLElement>('#products-view-yield')!;
    const pieces = Array.from(yieldPanel.querySelectorAll<HTMLInputElement>('[type="number"]'))
      .find((input) => input.closest('label')?.textContent?.includes('Good pieces'))!;
    expect(pieces).toBeDefined();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(pieces, '9');
      pieces.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-products"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('.product-editor-back')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Rose Candle"]')!.click());
    await flush();

    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-yield"]')!.click());
    await flush();
    expect(yieldPanel.querySelector('[role="alert"]')?.textContent).toContain('Keep your unsaved batch?');
    expect(pieces.value).toBe('9');
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Dinosaur Toy');

    const keep = Array.from(yieldPanel.querySelectorAll<HTMLButtonElement>('.yield-draft-confirm button'))
      .find((button) => button.textContent?.includes('Keep editing'))!;
    await act(async () => keep.click());
    await flush();
    expect(yieldPanel.querySelector('.yield-draft-confirm')).toBeNull();
    expect(pieces.value).toBe('9');
    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-pricing"]')!.click());
    await flush();
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain('Dinosaur Toy');
  });

  it('selects a newly saved Product across already-visited Yield, Components and Pricing tabs', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();
    const tabs = container.querySelector('[aria-label="Product workspace views"]')!;
    const tab = async (name: string) => {
      await act(async () => tabs.querySelector<HTMLButtonElement>(`[aria-controls="products-view-${name}"]`)!.click());
      await flush();
    };

    // All workspaces cache Dinosaur Toy before the new Product exists.
    await tab('yield');
    expect(container.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Dinosaur Toy');
    await tab('pricing');
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain('Dinosaur Toy');
    await tab('components');
    expect(container.querySelector<HTMLSelectElement>('.composition-parent-panel select')?.value).toBe('PRD-1');

    await tab('products');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="+ New product"]')!.click());
    const form = container.querySelector<HTMLFormElement>('[aria-label="Product details"]')!;
    const name = form.querySelector<HTMLInputElement>('input[name="name"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Fresh Rose Candle');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await flush();
    const created = (await session.productService.listProducts()).find((item) => item.name === 'Fresh Rose Candle')!;
    expect(created?.id).toBeTruthy();
    expect(container.querySelector('.product-editor-state')?.textContent).toContain('All changes saved');

    await tab('yield');
    expect(container.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Fresh Rose Candle');
    expect(container.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain(created.id);
    await tab('components');
    expect(container.querySelector<HTMLSelectElement>('.composition-parent-panel select')?.value).toBe(created.id);
    expect(container.querySelector('.composition-parent-panel')?.textContent).toContain('Fresh Rose Candle');
    await tab('pricing');
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain('Fresh Rose Candle');
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain(created.id);
  });

  it('does not lose an unfinished Yield batch when saving and selecting a new Product', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();
    const tabs = container.querySelector('[aria-label="Product workspace views"]')!;
    const tab = async (name: string) => {
      await act(async () => tabs.querySelector<HTMLButtonElement>(`[aria-controls="products-view-${name}"]`)!.click());
      await flush();
    };
    await tab('yield');
    const yieldPanel = container.querySelector<HTMLElement>('#products-view-yield')!;
    const goodPieces = Array.from(yieldPanel.querySelectorAll<HTMLInputElement>('input[type="number"]'))
      .find((input) => input.closest('label')?.textContent?.includes('Good pieces'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(goodPieces, '7');
      goodPieces.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await tab('products');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="+ New product"]')!.click());
    const form = container.querySelector<HTMLFormElement>('[aria-label="Product details"]')!;
    const name = form.querySelector<HTMLInputElement>('input[name="name"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Ocean Theme');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await flush();

    await tab('yield');
    expect(yieldPanel.querySelector('.yield-draft-confirm')?.textContent).toContain('Keep your unsaved batch?');
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Dinosaur Toy');
    expect(goodPieces.value).toBe('7');

    // Explicitly confirming a switch is the only way the old evidence draft is replaced.
    const discard = Array.from(yieldPanel.querySelectorAll<HTMLButtonElement>('.yield-draft-confirm button'))
      .find((button) => button.textContent?.includes('Discard draft and continue'))!;
    await act(async () => discard.click());
    await flush();
    expect(yieldPanel.querySelector('.yield-draft-confirm')).toBeNull();
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Ocean Theme');
  });

  it('refreshes saved Pricing cost and quantities after adding, editing and removing Components', async () => {
    await session.materialRepository.replaceAll([{
      id: 'PKG-01', name: 'Gift packaging',
      group: 'packaging', baseUnit: 'pc', purchaseQuantity: 10, purchaseUnit: 'pc',
      packageCost: 100, onHandQuantity: 100, onHandUnit: 'pc', isActive: true,
    }]);

    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();
    const tabs = container.querySelector('[aria-label="Product workspace views"]')!;
    const tab = async (name: string) => {
      await act(async () => tabs.querySelector<HTMLButtonElement>(`[aria-controls="products-view-${name}"]`)!.click());
      await flush();
    };
    const purchasedCost = () => {
      const rows = Array.from(container.querySelectorAll<HTMLElement>('.pricing-quote-section .pricing-summary-row'));
      const row = rows.find((candidate) => candidate.querySelector('strong')?.textContent === 'Purchased components');
      if (!row) throw new Error('Pricing breakdown is missing Purchased components');
      return row.querySelector('span')?.textContent;
    };
    const componentsForm = () => container.querySelector<HTMLFormElement>('.component-editor-form')!;
    const componentField = (label: string) => {
      const parent = Array.from(componentsForm().querySelectorAll('label')).find(
        (item) => item.querySelector('span')?.textContent === label,
      );
      if (!parent) throw new Error(`Missing Component field: ${label}`);
      return parent.querySelector<HTMLInputElement | HTMLSelectElement>('input,select')!;
    };
    const fill = async (element: HTMLInputElement | HTMLSelectElement, value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')!.set!.call(element, value);
        element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      });
    };
    const save = async () => {
      await act(async () => componentsForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await flush();
    };

    // Pricing is already mounted and its initial cost quote is loaded.
    await tab('pricing');
    expect(purchasedCost()).toBe('PHP 0.00');
    await tab('components');
    expect(container.querySelector<HTMLSelectElement>('.composition-parent-panel select')?.value).toBe('PRD-1');

    await fill(componentField('Material source'), 'PKG-01');
    await fill(componentField('Quantity per parent'), '2');
    await save();
    expect(container.querySelector('.component-card strong')?.textContent).toContain('2 × Gift packaging');
    await tab('pricing');
    expect(purchasedCost()).toBe('PHP 20.00');

    // Editing the same component must refresh the already-mounted Pricing panel.
    await tab('components');
    await act(async () => container.querySelector<HTMLButtonElement>('.component-card .row-actions button')!.click());
    await fill(componentField('Quantity per parent'), '3');
    await save();
    await tab('pricing');
    expect(purchasedCost()).toBe('PHP 30.00');

    // Deleting the component must remove its former price contribution.
    await tab('components');
    const remove = Array.from(container.querySelectorAll<HTMLButtonElement>('.component-card .row-actions button'))
      .find((button) => button.textContent === 'Remove')!;
    await act(async () => remove.click());
    await flush();
    expect(container.querySelector('.component-card')).toBeNull();
    await tab('pricing');
    expect(purchasedCost()).toBe('PHP 0.00');
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain('Dinosaur Toy');
  });

  it('recalculates Pricing after recording a new Yield batch while Pricing remains mounted', async () => {
    await session.materialRepository.replaceAll([{
      id: 'MAT-PLASTER', name: 'Plaster of Paris', group: 'plaster',
      baseUnit: 'g', purchaseQuantity: 1, purchaseUnit: 'kg',
      packageCost: 100, onHandQuantity: 5, onHandUnit: 'kg', isActive: true,
    }]);
    await session.productFinancialProfileRepository.replaceAll([{
      productId: 'PRD-1',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: { method: 'profit-amount', value: 10 },
    }]);
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();
    const tabs = container.querySelector('[aria-label="Product workspace views"]')!;
    const tab = async (name: string) => {
      await act(async () => tabs.querySelector<HTMLButtonElement>(`[aria-controls="products-view-${name}"]`)!.click());
      await flush();
    };
    const directCost = () => {
      const rows = Array.from(container.querySelectorAll<HTMLElement>('.pricing-quote-section .pricing-summary-row'));
      const row = rows.find((candidate) => candidate.querySelector('strong')?.textContent === 'Direct materials');
      if (!row) throw new Error('Direct materials row missing');
      return row.querySelector('span')?.textContent;
    };
    const fill = async (element: HTMLInputElement | HTMLSelectElement, value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')!.set!.call(element, value);
        element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      });
    };
    await tab('pricing');
    const previous = directCost();
    await tab('yield');
    const yieldForm = container.querySelector<HTMLFormElement>('[aria-label="Yield sample"]')!;
    await fill(yieldForm.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')!, 'MAT-PLASTER');
    await fill(yieldForm.querySelector<HTMLInputElement>('[aria-label="Yield quantity 1"]')!, '800');
    const field = (label: string) => Array.from(yieldForm.querySelectorAll('label')).find(
      (item) => item.querySelector('span')?.textContent?.trim().startsWith(label),
    )!.querySelector<HTMLInputElement>('input')!;
    await fill(field('Good pieces'), '8');
    await fill(field('Rejected pieces'), '2');
    expect(yieldForm.textContent).toContain('Ready to record');
    await act(async () => yieldForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await flush();
    expect((await session.yieldSampleEvidenceService.listSamples({ productId: 'PRD-1' }))).toHaveLength(1);

    // The current saved pricing quote is invalidated by successful Yield persistence.
    await tab('pricing');
    const authoritative = await session.productPricingQuoteIntegrationService.quoteProduct('PRD-1');
    expect(authoritative.fullyLoadedUnitCost.directMaterialCost.baseDirectMaterialCostSubtotal).toBeGreaterThan(0);
    expect(directCost()).not.toBe(previous);
    expect(directCost()).toBe('PHP 10.00');
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain('Dinosaur Toy');
  });

  it('recalculates Pricing when preferred Yield is changed, restored to automatic, or corrected', async () => {
    await session.materialRepository.replaceAll([{
      id: 'MAT-PLASTER', name: 'Plaster of Paris', group: 'plaster',
      baseUnit: 'g', purchaseQuantity: 1, purchaseUnit: 'kg',
      packageCost: 100, onHandQuantity: 5, onHandUnit: 'kg', isActive: true,
    }]);
    await session.yieldSampleRepository.replaceAll([
      {
        id: 'YLD-OLD', productId: 'PRD-1',
        materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 800, unit: 'g' }],
        goodPieces: 8, rejectedPieces: 0, recordedAt: '2026-09-15T01:00:00.000Z',
      },
      {
        id: 'YLD-NEW', productId: 'PRD-1',
        materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 400, unit: 'g' }],
        goodPieces: 8, rejectedPieces: 0, recordedAt: '2026-09-16T01:00:00.000Z',
      },
    ]);
    await session.productFinancialProfileRepository.replaceAll([{
      productId: 'PRD-1',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: { method: 'profit-amount', value: 10 },
    }]);
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();
    const tabs = container.querySelector('[aria-label="Product workspace views"]')!;
    const tab = async (name: string) => {
      await act(async () => tabs.querySelector<HTMLButtonElement>(`[aria-controls="products-view-${name}"]`)!.click());
      await flush();
    };
    const directCost = () => {
      const rows = Array.from(container.querySelectorAll<HTMLElement>('.pricing-quote-section .pricing-summary-row'));
      const row = rows.find((candidate) => candidate.querySelector('strong')?.textContent === 'Direct materials');
      if (!row) throw new Error('Direct materials row missing');
      return row.querySelector('span')?.textContent;
    };
    await tab('pricing');
    const automatic = directCost();
    expect(automatic).toBe('PHP 5.00');
    await tab('yield');
    const older = container.querySelector<HTMLElement>('[aria-label="Yield sample YLD-OLD"]')!;
    const prefer = Array.from(older.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Use as preferred yield')!;
    await act(async () => prefer.click());
    await flush();
    expect(container.querySelector('[aria-label="Effective yield learning"]')?.textContent).toContain('Sample YLD-OLD');
    await tab('pricing');
    expect(directCost()).toBe('PHP 10.00');

    await tab('yield');
    const automaticButton = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="Effective yield learning"] button'))
      .find((button) => button.textContent === 'Use latest valid automatically')!;
    await act(async () => automaticButton.click());
    await flush();
    await tab('pricing');
    expect(directCost()).toBe(automatic);

    // A correction removes the now automatically selected newer sample,
    // making the older batch the effective pricing evidence.
    await tab('yield');
    const newer = container.querySelector<HTMLElement>('[aria-label="Yield sample YLD-NEW"]')!;
    const askDelete = Array.from(newer.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Delete as correction')!;
    await act(async () => askDelete.click());
    const confirm = Array.from(newer.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Confirm correction delete')!;
    await act(async () => confirm.click());
    await flush();
    await tab('pricing');
    expect(directCost()).toBe('PHP 10.00');
  });

  it('makes the Mold and Storage workspace reachable from the Products section', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    const physicalButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Molds & storage'),
    );
    expect(physicalButton).toBeTruthy();

    await act(async () => physicalButton!.click());
    await flush();

    expect(container.querySelector('[aria-label="Physical identification and storage"]')).not.toBeNull();
    expect(container.textContent).toContain('Molds & storage');
    expect(container.textContent).toContain('Molds');
    expect(container.textContent).toContain('Storage');
    expect(container.textContent).toContain('MOLD DIRECTORY');
    expect(container.querySelector('[aria-label="Plaster mold formula configuration"]')).toBeNull();
    expect(container.textContent).toContain('Dinosaur Toy');
  });
});
