// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Product } from '../../domain/products';
import { PhysicalIdentificationWorkspace } from './PhysicalIdentificationWorkspace';

const product: Product = {
  id: 'PRD-1',
  name: 'Dinosaur Toy',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.productRepository.replaceAll([product]),
    session.storageLocationRepository.replaceAll([]),
    session.moldRepository.replaceAll([]),
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

async function mount() {
  await act(async () => {
    root.render(<PhysicalIdentificationWorkspace products={[product]} />);
  });
  await flush();
}

function currentForm(): HTMLFormElement {
  return container.querySelector('form')!;
}

function field(label: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const form = currentForm();
  const wrapper = Array.from(form.querySelectorAll('label')).find(
    (item) => item.querySelector('span')?.textContent === label,
  );
  if (!wrapper) throw new Error(`No field: ${label}`);
  return wrapper.querySelector('input,select,textarea')!;
}

async function fill(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

async function click(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === text || item.querySelector('strong')?.textContent?.trim() === text,
  );
  if (!button) throw new Error(`No button: ${text}`);
  await act(async () => button.click());
  await flush();
}

async function clickLabel(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`No button label: ${label}`);
  await act(async () => button.click());
  await flush();
}

async function submit() {
  await act(async () => {
    currentForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await flush();
}

async function createLocation(id: string, name: string, type: 'rack' | 'shelf' | 'bin', parentId = '') {
  await fill(field('Location ID'), id);
  await fill(field('Name'), name);
  await fill(field('Type'), type);
  if (type !== 'rack') await fill(field(type === 'shelf' ? 'Rack parent' : 'Shelf parent'), parentId);
  await submit();
}

describe('PhysicalIdentificationWorkspace', () => {
  it('summarizes physical records and makes unassigned molds a one-click working view', async () => {
    await session.storageLocationService.createLocation({
      id: 'RACK-A',
      name: 'Rack A',
      type: 'rack',
      isActive: true,
    });
    await session.moldService.createMold({
      id: 'MOLD-ASSIGNED',
      productId: 'PRD-1',
      name: 'Assigned Dinosaur Mold',
      storageLocationId: 'RACK-A',
      isActive: true,
    });
    await session.moldService.createMold({
      id: 'MOLD-LOOSE',
      productId: 'PRD-1',
      name: 'Loose Dinosaur Mold',
      isActive: true,
    });

    await mount();

    expect(container.querySelector('[aria-label="Show active molds"]')?.textContent).toContain('2');
    expect(container.querySelector('[aria-label="Show unassigned molds"]')?.textContent).toContain('1');
    expect(container.querySelector('[aria-label="Show active storage locations"]')?.textContent).toContain('1');

    await clickLabel('Show unassigned molds');

    const cards = Array.from(container.querySelectorAll('.physical-id-card'));
    expect(cards).toHaveLength(1);
    expect(cards[0]?.textContent).toContain('Loose Dinosaur Mold');
    expect(cards[0]?.textContent).toContain('Needs storage');
    expect(cards[0]?.textContent).toContain('Unassigned — choose a storage location');
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Mold storage assignment filter"]')?.value).toBe('unassigned');
  });

  it('creates Rack → Shelf → Bin records and then creates a mold assigned to the resolved path', async () => {
    await mount();
    await click('Storage');

    await createLocation('RACK-A', 'Rack A', 'rack');
    await createLocation('SHELF-2', 'Shelf 2', 'shelf', 'RACK-A');
    await createLocation('BIN-04', 'Bin 04', 'bin', 'SHELF-2');

    expect(await session.storageLocationService.formatPath('BIN-04')).toBe('Rack A / Shelf 2 / Bin 04');
    expect(container.textContent).toContain('Rack A / Shelf 2 / Bin 04');

    await click('Molds');
    await fill(field('Mold ID'), 'MOLD-0012');
    await fill(field('Mold name'), 'Dinosaur Mold');
    await fill(field('Product'), 'PRD-1');
    await fill(field('Storage location'), 'BIN-04');
    await submit();

    expect(await session.moldService.getMold('MOLD-0012')).toMatchObject({
      id: 'MOLD-0012',
      productId: 'PRD-1',
      storageLocationId: 'BIN-04',
    });
    expect(container.textContent).toContain('Dinosaur Toy');
    expect(container.textContent).toContain('Rack A / Shelf 2 / Bin 04');
  });

  it('opens mold and storage label previews from the persisted records', async () => {
    await session.storageLocationService.createLocation({
      id: 'RACK-A',
      name: 'Rack A',
      type: 'rack',
      isActive: true,
    });
    await session.moldService.createMold({
      id: 'MOLD-1',
      productId: 'PRD-1',
      name: 'Dinosaur Mold',
      storageLocationId: 'RACK-A',
      isActive: true,
    });
    await mount();

    await click('Print mold label');
    expect(container.textContent).toContain('Print mold label');
    expect(container.textContent).toContain('CBM:MOLD:MOLD-1');
    expect(container.textContent).toContain('Product: Dinosaur Toy (PRD-1)');
    expect(container.textContent).toContain('Location: Rack A');
    await click('Close');

    await click('Storage');
    await click('Print storage label');
    expect(container.textContent).toContain('Print storage label');
    expect(container.textContent).toContain('CBM:LOCATION:RACK-A');
    expect(container.textContent).toContain('Rack A');
  });

  it('surfaces archive protection when a storage location is assigned to an active mold', async () => {
    await session.storageLocationService.createLocation({
      id: 'RACK-A',
      name: 'Rack A',
      type: 'rack',
      isActive: true,
    });
    await session.moldService.createMold({
      id: 'MOLD-1',
      productId: 'PRD-1',
      name: 'Dinosaur Mold',
      storageLocationId: 'RACK-A',
      isActive: true,
    });
    await mount();
    await click('Storage');
    await click('Archive');

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('assigned to active mold MOLD-1');
    expect((await session.storageLocationService.getLocation('RACK-A'))?.isActive).toBe(true);
  });
});
