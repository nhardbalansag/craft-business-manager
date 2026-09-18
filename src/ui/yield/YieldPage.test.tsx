// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import type { YieldSample } from '../../domain/yieldSamples';
import { YieldPage } from './YieldPage';

let container: HTMLDivElement;
let root: Root;

const plaster: Material = {
  id: 'MAT-PLASTER',
  name: 'Plaster of Paris',
  group: 'plaster',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 100,
  onHandQuantity: 5,
  onHandUnit: 'kg',
  isActive: true,
};

const product: Product = {
  id: 'ART-001',
  name: 'Paintable Star',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

function sample(overrides: Partial<YieldSample> = {}): YieldSample {
  return {
    id: 'YS-001',
    productId: 'ART-001',
    materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 800, unit: 'g' }],
    goodPieces: 8,
    rejectedPieces: 2,
    recordedAt: '2026-09-16T01:00:00.000Z',
    notes: 'production batch',
    ...overrides,
  };
}

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

async function seed(active = true) {
  await session.materialRepository.replaceAll([plaster]);
  await session.productRepository.replaceAll([{ ...product, isActive: active }]);
}

async function mount() {
  await act(async () => root.render(<YieldPage />));
}

function form() {
  return container.querySelector<HTMLFormElement>('[aria-label="Yield sample"]');
}

function history() {
  return container.querySelector<HTMLElement>('[aria-label="Yield history"]');
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
}

describe('Yield workspace UI/UX', () => {
  it('makes unavailable copied materials visible and requires a valid replacement', async () => {
    await seed();
    await session.materialRepository.replaceAll([plaster, { ...plaster, id: 'ARCHIVED', name: 'Old plaster', isActive: false }]);
    await session.yieldSampleRepository.replaceAll([sample({ materialInputs: [{ materialId: 'ARCHIVED', quantity: 100, unit: 'g' }] })]);
    await mount();
    await click('Use as new draft');
    expect(field('Sample ID').value).toBe('YLD-0001');
    expect((field('Sample ID') as HTMLInputElement).readOnly).toBe(true);
    const material = container.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')!;
    expect(material.selectedOptions[0].textContent).toContain('Old plaster (unavailable)');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    await fill(material, plaster.id);
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });

  it('protects a draft when switching products, resetting, or copying history', async () => {
    await seed();
    await session.productRepository.replaceAll([product, { ...product, id: 'ART-002', name: 'Z Moon' }]);
    await session.yieldSampleRepository.replaceAll([sample()]);
    await mount();
    expect(field('Sample ID').value).toBe('YLD-0001');
    await fill(field('Notes'), 'Unsaved draft');
    const productSelect = container.querySelector<HTMLSelectElement>('.yield-product-bar select')!;
    await fill(productSelect, 'ART-002');
    expect(productSelect.value).toBe('ART-001');
    expect(field('Sample ID').value).toBe('YLD-0001');
    expect(document.activeElement).toBe(container.querySelector('.yield-draft-confirm'));
    await click('Keep editing');
    await click('Use as new draft');
    expect(field('Sample ID').value).toBe('YLD-0001');
    await click('Keep editing');
    await click('Reset sample');
    expect(field('Sample ID').value).toBe('YLD-0001');
    await click('Discard draft and continue');
    expect(field('Sample ID').value).toBe('YLD-0001');
    await click('Use as new draft');
    expect(field('Good pieces').value).toBe('8');
    await fill(productSelect, 'ART-002');
    await click('Discard draft and continue');
    expect(productSelect.value).toBe('ART-002');
    expect(field('Good pieces').value).toBe('1');
  });

  it('ignores an older history response after switching back to another product', async () => {
    await seed();
    await session.productRepository.replaceAll([product, { ...product, id: 'ART-002', name: 'Z Moon' }]);
    await session.yieldSampleRepository.replaceAll([sample()]);
    await mount();
    let release!: (samples: YieldSample[]) => void;
    vi.spyOn(session.yieldHistoryService, 'listHistory').mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const productSelect = container.querySelector<HTMLSelectElement>('.yield-product-bar select')!;
    await fill(productSelect, 'ART-002');
    expect(container.querySelector('[aria-label="Yield history snapshot"]')?.textContent).toContain('Loading batch evidence');
    expect(container.querySelector('[aria-label="Effective yield learning"]')?.textContent).not.toContain('YS-001');
    await fill(productSelect, 'ART-001');
    await act(async () => release([sample({ id: 'MOON-SAMPLE', productId: 'ART-002' })]));
    expect(history()?.textContent).toContain('YS-001');
    expect(history()?.textContent).not.toContain('MOON-SAMPLE');
  });

  it('blocks repeat saves and locks the product until recording finishes', async () => {
    await seed();
    await mount();
    expect(field('Sample ID').value).toBe('YLD-0001');
    await fill(container.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')!, plaster.id);
    await fill(container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 1"]')!, '100');
    const record = session.yieldSampleEvidenceService.recordSample.bind(session.yieldSampleEvidenceService);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const spy = vi.spyOn(session.yieldSampleEvidenceService, 'recordSample').mockImplementation(async (input) => { await gate; return record(input); });
    await submit();
    await submit();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(container.querySelector<HTMLSelectElement>('.yield-product-bar select')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toContain('Recording');
    await act(async () => release());
    expect(await session.yieldSampleEvidenceService.listSamples({ productId: product.id })).toHaveLength(1);
    expect(container.querySelector<HTMLSelectElement>('.yield-product-bar select')?.disabled).toBe(false);
  });

  it('requires a valid date and never previews percentages from invalid piece counts', async () => {
    await seed();
    await mount();
    await fill(container.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')!, plaster.id);
    await fill(container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 1"]')!, '100');
    await fill(field('Recorded at'), '');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    await fill(field('Recorded at'), '2026-09-18T10:00');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    await fill(field('Rejected pieces'), '-1');
    expect(container.querySelector('[aria-label="Draft yield preview"]')?.textContent).not.toContain('%');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it('preserves the entered evidence when saving fails and allows a retry', async () => {
    await seed();
    await mount();
    expect(field('Sample ID').value).toBe('YLD-0001');
    await fill(container.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')!, plaster.id);
    await fill(container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 1"]')!, '100');
    vi.spyOn(session.yieldSampleEvidenceService, 'recordSample').mockRejectedValueOnce(new Error('Save failed'));
    await submit();
    expect(field('Sample ID').value).toBe('YLD-0001');
    expect(form()?.textContent).toContain('Save failed');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    await submit();
    expect(await session.yieldSampleEvidenceService.listSamples({ productId: product.id })).toHaveLength(1);
  });

  it('shows a real loading state before presenting the batch workspace', async () => {
    await seed();
    let release!: (value: Product[]) => void;
    vi.spyOn(session.productService, 'listProducts').mockImplementationOnce(
      () => new Promise((resolve) => { release = resolve; }),
    );

    await mount();
    expect(container.textContent).toContain('Loading yield workspace');
    expect(container.textContent).not.toContain('Create a product first');

    await act(async () => release([product]));
    expect(form()).not.toBeNull();
    expect(container.textContent).toContain('Record a yield sample');
  });

  it('guides batch evidence, previews good yield and defect rate, then refreshes effective learning after save', async () => {
    await seed();
    await mount();

    const guide = container.querySelector('[aria-label="Yield workflow"]')!;
    expect(guide.textContent).toContain('Choose the product');
    expect(guide.textContent).toContain('Record the real batch');
    expect(guide.textContent).toContain('Review effective learning');
    expect(container.textContent).toContain('Included in workbook exports');

    expect(field('Sample ID').value).toBe('YLD-0001');
    await fill(container.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')!, 'MAT-PLASTER');
    await fill(container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 1"]')!, '800');
    await fill(field('Good pieces'), '8');
    await fill(field('Rejected pieces'), '2');

    const preview = container.querySelector('[aria-label="Draft yield preview"]')!;
    expect(preview.textContent).toContain('80%');
    expect(preview.textContent).toContain('20%');
    expect(form()!.textContent).toContain('Ready to record');

    await submit();

    const saved = await session.yieldSampleEvidenceService.listSamples({ productId: 'ART-001' });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: 'YLD-0001', goodPieces: 8, rejectedPieces: 2 });
    expect(field('Sample ID').value).toBe('YLD-0002');
    const effective = container.querySelector('[aria-label="Effective yield learning"]')!;
    expect(effective.textContent).toContain('Sample YLD-0001');
    expect(effective.textContent).toContain('100 g / good piece');
    expect(effective.textContent).toContain('80%');
  });

  it('generates the next Yield ID from all products while preserving legacy IDs', async () => {
    await seed();
    await session.productRepository.replaceAll([
      product,
      { ...product, id: 'ART-002', name: 'Moon', isActive: true },
    ]);
    await session.yieldSampleRepository.replaceAll([
      sample({ id: 'YS-CUSTOM', productId: 'ART-001' }),
      sample({ id: 'YLD-0007', productId: 'ART-002', recordedAt: '2026-09-17T01:00:00.000Z' }),
    ]);

    await mount();

    expect(field('Sample ID').value).toBe('YLD-0008');
    expect((field('Sample ID') as HTMLInputElement).readOnly).toBe(true);
    expect(await session.yieldSampleEvidenceService.getSample('YS-CUSTOM')).toMatchObject({ productId: 'ART-001' });
    expect(await session.yieldSampleEvidenceService.getSample('YLD-0007')).toMatchObject({ productId: 'ART-002' });
  });

  it('lets the user prefer an older Yield sample and return to automatic latest-valid selection', async () => {
    await seed();
    await session.yieldSampleRepository.replaceAll([
      sample({
        id: 'YS-OLD',
        materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 800, unit: 'g' }],
        goodPieces: 8,
        rejectedPieces: 0,
        recordedAt: '2026-09-15T01:00:00.000Z',
      }),
      sample({
        id: 'YS-NEW',
        materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 600, unit: 'g' }],
        goodPieces: 8,
        rejectedPieces: 0,
        recordedAt: '2026-09-16T01:00:00.000Z',
      }),
    ]);

    await mount();

    const effective = container.querySelector<HTMLElement>('[aria-label="Effective yield learning"]')!;
    expect(effective.textContent).toContain('Sample YS-NEW');

    const older = history()!.querySelector<HTMLElement>('[aria-label="Yield sample YS-OLD"]')!;
    await click('Use as preferred yield', older);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(effective.textContent).toContain('Sample YS-OLD');
    expect(effective.textContent).toContain('Preferred effective');
    expect(await session.productRepository.findById('ART-001')).toMatchObject({
      preferredYieldSampleId: 'YS-OLD',
    });

    await click('Use latest valid automatically', effective);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(effective.textContent).toContain('Sample YS-NEW');
    expect((await session.productRepository.findById('ART-001'))?.preferredYieldSampleId).toBeUndefined();
  });

  it('supports searchable and sortable batch history without changing the effective sample', async () => {
    await seed();
    await session.yieldSampleRepository.replaceAll([
      sample({
        id: 'YS-OLD',
        materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 900, unit: 'g' }],
        goodPieces: 9,
        rejectedPieces: 1,
        recordedAt: '2026-09-15T01:00:00.000Z',
        notes: 'older batch',
      }),
      sample({
        id: 'YS-NEW',
        recordedAt: '2026-09-16T01:00:00.000Z',
        notes: 'new batch',
      }),
    ]);

    await mount();
    expect(container.querySelector('[aria-label="Effective yield learning"]')?.textContent).toContain('YS-NEW');

    const search = history()!.querySelector<HTMLInputElement>('[aria-label="Search yield history"]')!;
    await fill(search, 'older batch');
    const visibleArticles = history()!.querySelectorAll('article');
    expect(visibleArticles).toHaveLength(1);
    expect(visibleArticles[0].textContent).toContain('YS-OLD');
    expect(visibleArticles[0].textContent).not.toContain('YS-NEW');

    await fill(search, '');
    const sort = history()!.querySelector<HTMLSelectElement>('[aria-label="Sort yield history"]')!;
    await fill(sort, 'oldest');
    expect(history()!.querySelector('article')?.getAttribute('aria-label')).toBe('Yield sample YS-OLD');
    expect(container.querySelector('[aria-label="Effective yield learning"]')?.textContent).toContain('YS-NEW');
  });

  it('recovers a failed initial catalog read without showing a false empty-product state', async () => {
    await seed();
    vi.spyOn(session.productService, 'listProducts').mockRejectedValueOnce(new Error('Product catalog failed'));

    await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Yield workspace unavailable');
    expect(container.textContent).not.toContain('Create a product first');

    await click('Retry loading');
    expect(form()).not.toBeNull();
    expect(container.textContent).toContain('Paintable Star');
  });

  it('keeps archived products in history-only mode while preserving their effective evidence', async () => {
    await seed(false);
    await session.yieldSampleRepository.replaceAll([sample({ id: 'YS-ARCHIVED' })]);

    await mount();

    expect(container.textContent).toContain('history view only');
    expect(container.textContent).toContain('Archived products keep their history');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(history()!.textContent).toContain('YS-ARCHIVED');
    expect(container.querySelector('[aria-label="Effective yield learning"]')?.textContent).toContain('YS-ARCHIVED');
  });
});
