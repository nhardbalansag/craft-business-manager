// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
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

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Pricing workspace unavailable');
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
});
