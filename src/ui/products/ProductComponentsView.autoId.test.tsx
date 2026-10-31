// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import { ProductComponentsView } from './ProductComponentsView';
import * as candidateFilter from './componentProductCandidates';
import * as compositionPreview from './productCompositionPreview';

const product: Product = {
  id: 'LEGACY-PRODUCT',
  name: 'Legacy Candle',
  category: 'candle',
  safetyWasteRate: 0,
  isActive: true,
};

const pieceMaterial: Material = {
  id: 'LEGACY-JAR',
  name: 'Glass jar',
  group: 'container',
  baseUnit: 'pc',
  purchaseQuantity: 1,
  purchaseUnit: 'pc',
  packageCost: 10,
  onHandQuantity: 5,
  onHandUnit: 'pc',
  isActive: true,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.productRepository.replaceAll([product]),
    session.materialRepository.replaceAll([pieceMaterial]),
    session.productComponentRepository.replaceAll([]),
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

function componentForm() {
  return container.querySelector<HTMLFormElement>('.component-editor-form')!;
}

function field(label: string) {
  const wrapper = Array.from(componentForm().querySelectorAll('label')).find(
    (item) => item.querySelector('span')?.textContent === label,
  );
  if (!wrapper) throw new Error(`No field: ${label}`);
  return wrapper.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')!;
}

async function fill(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

describe('ProductComponentsView automatic identity', () => {
  it('defers product graph work until needed and keeps it out of role, quantity and notes edits', async () => {
    const child: Product = { ...product, id: 'CHILD', name: 'Child product' };
    const candidates = vi.spyOn(candidateFilter, 'componentProductCandidates');
    const preview = vi.spyOn(compositionPreview, 'buildProductCompositionPreview');
    await act(async () => root.render(<ProductComponentsView products={[product, child]} materials={[pieceMaterial]} catalogLoading={false} />));
    expect(candidates).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    await fill(field('Source type'), 'product');
    expect(candidates).toHaveBeenCalledOnce();
    expect(field('Product source').textContent).toContain('Child product');
    await fill(field('Role'), 'accessory');
    await fill(field('Quantity per parent'), '3');
    await fill(field('Notes'), 'Assembly note');
    await fill(field('Product source'), 'CHILD');
    expect(candidates).toHaveBeenCalledOnce();
    expect(preview).not.toHaveBeenCalled();
    const show = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Show assembly tree')!;
    await act(async () => show.click());
    expect(preview).toHaveBeenCalledOnce();
  });

  it('blocks duplicate component submissions while a save is pending', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const create = session.productComponentService.createComponent.bind(session.productComponentService);
    const saving = vi.spyOn(session.productComponentService, 'createComponent').mockImplementation(async (candidate) => {
      await gate;
      return create(candidate);
    });
    await act(async () => root.render(<ProductComponentsView products={[product]} materials={[pieceMaterial]} catalogLoading={false} />));
    await fill(field('Material source'), 'LEGACY-JAR');
    await act(async () => {
      componentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      componentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(saving).toHaveBeenCalledOnce();
    expect(componentForm().querySelector('fieldset')?.disabled).toBe(true);
    await act(async () => release());
    expect(await session.productComponentService.listComponents()).toHaveLength(1);
    expect(container.textContent).toContain('Component added.');
    expect(componentForm().querySelector('fieldset')?.disabled).toBe(false);
  });

  it('shows the chosen parent Product photo and enlarges it without changing the composition', async () => {
    const photo = 'data:image/jpeg;base64,/9j/AAAA';
    const brochure = 'data:image/jpeg;base64,/9j/BBBB';
    await act(async () => root.render(
      <ProductComponentsView
        products={[{ ...product, imageDataUrl: photo, brochureImageDataUrl: brochure }]}
        materials={[pieceMaterial]}
        catalogLoading={false}
      />,
    ));
    await flush();

    const chosen = container.querySelector('[aria-label="Selected component Product photo"]')!;
    expect(chosen.textContent).toContain('Legacy Candle');
    expect(chosen.querySelector('img')?.getAttribute('src')).toBe(photo);
    await act(async () => chosen.querySelector<HTMLButtonElement>('[aria-label="View full-size image of Legacy Candle"]')!.click());
    expect(document.body.querySelector<HTMLImageElement>('.product-image-zoom-canvas img')?.getAttribute('src')).toBe(brochure);
    await act(async () => document.body.querySelector<HTMLButtonElement>('[aria-label="Close enlarged product image"]')!.click());
    expect(field('Component ID').value).toBe('COMP-0001');
  });

  it('assigns a Component ID automatically while leaving legacy source IDs untouched', async () => {
    await act(async () => root.render(
      <ProductComponentsView
        products={[product]}
        materials={[pieceMaterial]}
        catalogLoading={false}
      />,
    ));
    await flush();

    expect(field('Component ID').value).toBe('COMP-0001');
    expect((field('Component ID') as HTMLInputElement).readOnly).toBe(true);
    await fill(field('Material source'), 'LEGACY-JAR');

    await act(async () => {
      componentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(await session.productComponentService.listComponents()).toEqual([
      expect.objectContaining({
        id: 'COMP-0001',
        parentProductId: 'LEGACY-PRODUCT',
        sourceId: 'LEGACY-JAR',
      }),
    ]);
  });
});
