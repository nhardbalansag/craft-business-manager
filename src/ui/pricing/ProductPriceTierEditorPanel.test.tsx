// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { ProductPriceTierEditorPanel } from './ProductPriceTierEditorPanel';

let container: HTMLDivElement;
let root: Root;

const product: Product = {
  id: 'ART-001',
  name: 'Paintable Star',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

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

function field(label: string) {
  const parent = Array.from(container.querySelectorAll('label')).find((item) =>
    item.querySelector('span')?.textContent?.trim().startsWith(label),
  );
  if (!parent) throw new Error(`Missing field: ${label}`);
  return parent.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input,select,textarea',
  )!;
}

async function fill(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')!.set!.call(
      element,
      value,
    );
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input', {
        bubbles: true,
      }),
    );
  });
}

async function mount(onSubmit = vi.fn()) {
  await act(async () => {
    root.render(
      <ProductPriceTierEditorPanel
        product={product}
        tier={null}
        open
        saving={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
  });
  return onSubmit;
}

describe('TP6C ProductPriceTierEditorPanel kind-aware UX', () => {
  it('applies Package structural defaults and keeps per-offer minimums coherent', async () => {
    const onSubmit = await mount();

    await fill(field('Tier kind'), 'package');

    expect((field('Price basis') as HTMLSelectElement).value).toBe('per-offer');
    expect(container.textContent).toContain('Package · fixed bundle');
    expect(container.textContent).toContain(
      'This Package currently contains one Product unit per offer',
    );

    await fill(field('Units per offer'), '6');

    expect((field('Minimum order quantity') as HTMLInputElement).value).toBe('6');

    await fill(field('Tier name'), '6-piece Package');
    await fill(field('Price amount'), '270');
    await fill(field('Additional cost per offer'), '20');

    const form = container.querySelector<HTMLFormElement>('[aria-label="Price tier editor"]')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith({
      name: '6-piece Package',
      kind: 'package',
      priceBasis: 'per-offer',
      priceAmount: 270,
      unitsPerOffer: 6,
      minimumOrderQuantity: 6,
      additionalCostPerOffer: 20,
      notes: undefined,
    });
  });

  it('uses authoritative domain preflight for invalid per-offer minimum multiples', async () => {
    await mount();

    await fill(field('Tier kind'), 'package');
    await fill(field('Units per offer'), '6');
    await fill(field('Minimum order quantity'), '7');
    await fill(field('Tier name'), 'Party Pack');
    await fill(field('Price amount'), '300');

    expect(container.textContent).toContain(
      'Per-offer minimum order quantity must be a whole multiple of units per offer.',
    );

    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);
  });

  it('applies Bulk structural defaults and explains the quantity threshold', async () => {
    await mount();

    await fill(field('Tier kind'), 'package');
    await fill(field('Units per offer'), '6');
    await fill(field('Tier kind'), 'bulk');

    expect((field('Price basis') as HTMLSelectElement).value).toBe('per-unit');
    expect((field('Units per offer') as HTMLInputElement).value).toBe('1');
    expect((field('Units per offer') as HTMLInputElement).disabled).toBe(true);
    expect(container.textContent).toContain('Bulk · quantity threshold');
    expect(container.textContent).toContain(
      'use minimum order quantity as the volume threshold',
    );
  });

  it('keeps Custom tiers explicit and does not imply automatic selection', async () => {
    await mount();

    await fill(field('Tier kind'), 'custom');

    expect(container.textContent).toContain('Custom · explicit special offer');
    expect(container.textContent).toContain('never selected automatically');
  });
});
