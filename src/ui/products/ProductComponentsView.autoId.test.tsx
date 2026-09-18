// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import { ProductComponentsView } from './ProductComponentsView';

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
