// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import { MaterialsPage } from './MaterialsPage';
import { inventoryOverview, materialInventoryRow } from './materialInventoryView';
import type { Material } from '../../domain/materials';

let container: HTMLDivElement;
let root: Root;
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
async function mount() {
  await act(async () => root.render(<MaterialsPage />));
}
function catalog() {
  return container.querySelector<HTMLElement>('[aria-label="Material inventory"]')!;
}
function form() {
  return container.querySelector<HTMLFormElement>('[aria-label="Material details"]')!;
}
function field(label: string, scope: ParentNode = form()) {
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
async function navigate(view: 'inventory' | 'editor') {
  await act(async () => container.querySelector<HTMLButtonElement>(`[aria-controls="material-${view}-view"]`)!.click());
}
async function submit() {
  await act(async () => form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
const plaster: Material = {
  id: 'PLASTER',
  name: 'Plaster of Paris',
  group: 'plaster',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 100,
  onHandQuantity: 500,
  onHandUnit: 'g',
  source: {
    vendorName: 'Craft supplier',
    purchaseLink: 'https://example.com/plaster',
    contactNumber: '123456',
    notes: 'Wholesale packs',
  },
  isActive: true,
};
async function seed() {
  await session.materialService.createMaterial(plaster);
  await session.materialService.createMaterial({
    ...plaster,
    id: 'WAX',
    name: 'Soy wax',
    group: 'wax',
    onHandQuantity: 0,
    source: undefined,
  });
  await session.materialService.createMaterial({
    id: 'JAR',
    name: 'Glass jar',
    group: 'container',
    baseUnit: 'pc',
    purchaseQuantity: 1,
    purchaseUnit: 'box',
    packageCost: 100,
    manualBaseUnitsPerPurchaseUnit: 10,
    onHandQuantity: 2,
    onHandUnit: 'box',
    isActive: true,
  });
}

describe('Materials workspace interactions', () => {
  it('shows a loading state instead of a false empty collection, then guides first creation', async () => {
    let release!: (value: Material[]) => void;
    vi.spyOn(session.materialService, 'listMaterials').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await mount();
    expect(catalog().textContent).toContain('Loading materials');
    expect(catalog().textContent).not.toContain('Start with your first supply');
    await act(async () => release([]));
    await click('Add your first material');
    expect(document.activeElement).toBe(field('Material name'));
    await fill(field('Material ID'), 'PAINT');
    await fill(field('Material name'), 'Paint');
    await fill(field('Package cost'), '100');
    await fill(field('On-hand quantity'), '500');
    await submit();
    expect(await session.materialService.getMaterial('PAINT')).toMatchObject({
      name: 'Paint',
      packageCost: 100,
      onHandQuantity: 500,
    });
    expect(container.querySelector('#material-inventory-view')?.hasAttribute('hidden')).toBe(false);
    expect(catalog().textContent).toContain('PHP 0.10 / g');
    expect(document.activeElement).toBe(catalog().querySelector('h2'));
  });

  it('filters locally by stock, group and supplier without racing repository reads or changing totals', async () => {
    await seed();
    const list = vi.spyOn(session.materialService, 'listMaterials');
    await mount();
    const summary = container.querySelector('[aria-label="Active inventory summary"]')?.textContent;
    await click('Out of stock', catalog());
    expect(catalog().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(catalog().querySelector('tbody')?.textContent).toContain('Soy wax');
    await click('Clear filters', catalog());
    await fill(catalog().querySelector('input')!, 'Wholesale');
    expect(catalog().querySelectorAll('tbody tr')).toHaveLength(1);
    await fill(field('Group', catalog()), 'wax');
    expect(catalog().textContent).toContain('No matching materials');
    expect(container.querySelector('[aria-label="Active inventory summary"]')?.textContent).toBe(summary);
    expect(list).toHaveBeenCalledOnce();
    await click('Clear filters', catalog());
    expect(catalog().querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('sorts by normalized stock value and keeps supplier re-order links accessible', async () => {
    await seed();
    await mount();
    await fill(field('Sort by', catalog()), 'value');
    expect(catalog().querySelector('tbody tr')?.textContent).toContain('Glass jar');
    expect(catalog().querySelector('tbody tr')?.textContent).toContain('20 pc');
    const link = catalog().querySelector<HTMLAnchorElement>('[aria-label="Re-order Plaster of Paris"]')!;
    expect(link.href).toBe('https://example.com/plaster');
    expect(link.rel).toContain('noopener');
  });

  it('preserves unsaved edits and filters while browsing inventory', async () => {
    await seed();
    await mount();
    await click('Edit Plaster of Paris');
    expect((field('Material ID') as HTMLInputElement).disabled).toBe(true);
    await fill(field('Material name'), 'Draft plaster');
    await navigate('inventory');
    await fill(catalog().querySelector('input')!, 'Soy');
    await navigate('editor');
    expect(field('Material name').value).toBe('Draft plaster');
    expect(catalog().querySelector('input')?.value).toBe('Soy');
    expect((await session.materialService.getMaterial('PLASTER'))?.name).toBe('Plaster of Paris');
  });

  it('does not interpret blank costs or stock counts as a known zero', async () => {
    await seed();
    await mount();
    await click('Edit Plaster of Paris');
    await fill(field('Package cost'), '');
    expect(container.querySelector('[aria-label="Live material preview"]')?.textContent).toContain('Unavailable');
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Use 0 for a known zero');
    expect((await session.materialService.getMaterial('PLASTER'))?.packageCost).toBe(100);
    expect(document.activeElement).toBe(container.querySelector('[role="alert"]'));
    await fill(field('Package cost'), '0');
    await fill(field('On-hand quantity'), '');
    await submit();
    expect((await session.materialService.getMaterial('PLASTER'))?.onHandQuantity).toBe(500);
    await fill(field('On-hand quantity'), '0');
    await submit();
    expect(await session.materialService.getMaterial('PLASTER')).toMatchObject({ packageCost: 0, onHandQuantity: 0 });
  });

  it('clears unit-specific manual factors when purchase units change', async () => {
    await seed();
    await mount();
    await click('Edit Glass jar');
    expect(field('Manual conversion').value).toBe('10');
    await fill(field('Purchase unit'), 'pack');
    expect(field('On-hand unit').value).toBe('pack');
    expect(field('Manual conversion').value).toBe('');
    expect((field('Manual conversion') as HTMLInputElement).required).toBe(true);
    await fill(field('Manual conversion'), '20');
    await submit();
    expect(await session.materialService.getMaterial('JAR')).toMatchObject({
      purchaseUnit: 'pack',
      manualBaseUnitsPerPurchaseUnit: 20,
      onHandUnit: 'pack',
    });
    expect(catalog().textContent).toContain('40 pc');
  });

  it('uses saved cup calibration before manual fallback for stock and purchase cost', async () => {
    await seed();
    await session.calibrationService.createCalibration({
      id: 'CAL',
      materialId: 'PLASTER',
      measuredVolume: 1,
      volumeUnit: 'cup',
      knownWeight: 100,
      weightUnit: 'g',
      recordedAt: '2026-09-17T00:00:00Z',
    });
    await session.materialService.updateMaterial('PLASTER', {
      purchaseUnit: 'cup',
      manualBaseUnitsPerPurchaseUnit: 50,
      onHandQuantity: 2,
      onHandUnit: 'cup',
    });
    await mount();
    const row = Array.from(catalog().querySelectorAll('tbody tr')).find((item) =>
      item.textContent?.includes('Plaster of Paris'),
    )!;
    expect(row.textContent).toContain('200 g');
    expect(row.textContent).toContain('PHP 1.00 / g');
    expect(row.textContent).toContain('(calibration)');
    await click('Edit Plaster of Paris');
    expect(form().textContent).toContain('Saved calibration takes precedence');
    expect((field('Manual conversion') as HTMLInputElement).required).toBe(false);
  });

  it('archives and restores without deleting the source record', async () => {
    await seed();
    await mount();
    await click('Archive Soy wax');
    expect((await session.materialService.getMaterial('WAX'))?.isActive).toBe(false);
    await fill(field('Status', catalog()), 'archived');
    await click('Restore Soy wax');
    expect((await session.materialService.getMaterial('WAX'))?.isActive).toBe(true);
    expect(container.textContent).toContain('Restored Soy wax.');
  });

  it('keeps material relationship guards authoritative', async () => {
    await seed();
    await session.productService.createProduct({
      id: 'CANDLE',
      name: 'Candle',
      category: 'candle',
      safetyWasteRate: 0,
      isActive: true,
    });
    await session.productComponentService.createComponent({
      id: 'VESSEL',
      parentProductId: 'CANDLE',
      sourceType: 'material',
      sourceId: 'JAR',
      role: 'vessel',
      quantityPerParent: 1,
    });
    await mount();
    await click('Archive Glass jar');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect((await session.materialService.getMaterial('JAR'))?.isActive).toBe(true);
  });

  it('prevents duplicate submissions and freezes the edited source while saving', async () => {
    await seed();
    await mount();
    await click('Edit Plaster of Paris');
    const update = session.materialService.updateMaterial.bind(session.materialService);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi.spyOn(session.materialService, 'updateMaterial').mockImplementation(async (...args) => {
      await pending;
      return update(...args);
    });
    await act(async () => {
      form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(spy).toHaveBeenCalledOnce();
    expect(form().querySelector('fieldset')?.disabled).toBe(true);
    await act(async () => release());
    expect(form().querySelector('fieldset')?.disabled).toBe(false);
  });

  it('recovers loading failures without showing an empty inventory', async () => {
    await seed();
    vi.spyOn(session.calibrationService, 'listCalibrations').mockRejectedValueOnce(
      new Error('Calibration read failed'),
    );
    await mount();
    expect(catalog().textContent).toContain('Inventory unavailable');
    expect(form().querySelector('fieldset')?.disabled).toBe(true);
    await click('Retry loading');
    expect(catalog().querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('retains a failed edit for correction', async () => {
    await seed();
    await mount();
    await click('Edit Plaster of Paris');
    await fill(field('Material name'), 'Soy wax');
    await submit();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(field('Material name').value).toBe('Soy wax');
    await fill(field('Material name'), 'New plaster');
    await submit();
    expect((await session.materialService.getMaterial('PLASTER'))?.name).toBe('New plaster');
  });

  it('distinguishes a successful write from a failed subsequent refresh', async () => {
    await seed();
    await mount();
    await click('Edit Plaster of Paris');
    await fill(field('On-hand quantity'), '750');
    vi.spyOn(session.materialService, 'listMaterials').mockRejectedValueOnce(new Error('Refresh failed'));
    await submit();
    expect(container.textContent).toContain('Updated Plaster of Paris.');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Refresh failed');
    expect((await session.materialService.getMaterial('PLASTER'))?.onHandQuantity).toBe(750);
    await click('Retry loading');
    expect(catalog().textContent).toContain('750 g');
  });

  it('ignores an older catalog load when Strict Mode restarts its effect', async () => {
    await seed();
    const current = await session.materialService.listMaterials();
    let release!: (value: Material[]) => void;
    vi.spyOn(session.materialService, 'listMaterials')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce(current);
    await act(async () =>
      root.render(
        <StrictMode>
          <MaterialsPage />
        </StrictMode>,
      ),
    );
    expect(catalog().querySelectorAll('tbody tr')).toHaveLength(3);
    await act(async () => release([]));
    expect(catalog().querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('labels incomplete stock value as a known subtotal and surfaces unresolved conversions', async () => {
    const invalid = {
      ...plaster,
      id: 'UNRESOLVED',
      name: 'Unknown cup material',
      purchaseUnit: 'cup' as const,
      source: undefined,
    };
    const known = materialInventoryRow(plaster, []);
    const unknown = materialInventoryRow(invalid, []);
    expect(inventoryOverview([known, unknown])).toMatchObject({
      activeCount: 2,
      needsAttention: 1,
      unvalued: 1,
      knownValue: 50,
    });
    expect(inventoryOverview([known, { ...unknown, material: { ...invalid, isActive: false } }])).toMatchObject({
      activeCount: 1,
      unvalued: 0,
      knownValue: 50,
    });
    await session.materialRepository.replaceAll([plaster, invalid]);
    await mount();
    expect(container.querySelector('[aria-label="Active inventory summary"]')?.textContent).toContain(
      'Known stock value',
    );
    expect(container.textContent).toContain('1 unvalued materials excluded');
    await click('Check conversions', catalog());
    expect(catalog().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(catalog().textContent).toContain('Unknown cup material');
    expect(catalog().textContent).toContain('Unavailable');
  });
});
