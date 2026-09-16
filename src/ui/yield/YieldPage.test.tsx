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

    await fill(field('Sample ID'), 'YS-UI-001');
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
    expect(saved[0]).toMatchObject({ id: 'YS-UI-001', goodPieces: 8, rejectedPieces: 2 });
    const effective = container.querySelector('[aria-label="Effective yield learning"]')!;
    expect(effective.textContent).toContain('Sample YS-UI-001');
    expect(effective.textContent).toContain('100 g / good piece');
    expect(effective.textContent).toContain('80%');
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
