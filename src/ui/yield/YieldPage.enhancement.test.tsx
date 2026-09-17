// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import type { YieldSample } from '../../domain/yieldSamples';
import { YieldPage } from './YieldPage';

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
    id: 'YS-REJECT',
    productId: product.id,
    materialInputs: [{ materialId: plaster.id, quantity: 800, unit: 'g' }],
    goodPieces: 8,
    rejectedPieces: 2,
    recordedAt: '2026-09-16T01:00:00.000Z',
    notes: 'newer batch with rejects',
    ...overrides,
  };
}

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
    session.materialRepository.replaceAll([plaster]),
    session.productRepository.replaceAll([product]),
    session.mixPresetRepository.replaceAll([]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([
      sample({
        id: 'YS-CLEAN',
        materialInputs: [{ materialId: plaster.id, quantity: 1000, unit: 'g' }],
        goodPieces: 10,
        rejectedPieces: 0,
        recordedAt: '2026-09-15T01:00:00.000Z',
        notes: 'clean batch',
      }),
      sample(),
    ]),
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
  await act(async () => root.render(<YieldPage />));
  await flush();
}

async function fill(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
  await flush();
}

async function click(text: string, scope: ParentNode = container) {
  const button = Array.from(scope.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Missing button: ${text}`);
  await act(async () => button.click());
  await flush();
}

function formField(label: string) {
  const form = container.querySelector<HTMLFormElement>('[aria-label="Yield sample"]')!;
  const wrapper = Array.from(form.querySelectorAll('label')).find(
    (item) => item.querySelector('span')?.textContent?.trim().startsWith(label),
  );
  if (!wrapper) throw new Error(`Missing field: ${label}`);
  return wrapper.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')!;
}

describe('Yield history enhanced workflows', () => {
  it('summarizes production evidence and filters history by batch outcome', async () => {
    await mount();

    const snapshot = container.querySelector('[aria-label="Yield history snapshot"]')!;
    expect(snapshot.textContent).toContain('Recorded batches');
    expect(snapshot.textContent).toContain('2');
    expect(snapshot.textContent).toContain('Effective good yield');
    expect(snapshot.textContent).toContain('80%');
    expect(snapshot.textContent).toContain('Historical good-piece rate');
    expect(snapshot.textContent).toContain('90%');

    const history = container.querySelector<HTMLElement>('[aria-label="Yield history"]')!;
    const outcome = history.querySelector<HTMLSelectElement>('[aria-label="Filter yield history by outcome"]')!;
    await fill(outcome, 'clean');

    const articles = history.querySelectorAll('article');
    expect(articles).toHaveLength(1);
    expect(articles[0].textContent).toContain('YS-CLEAN');
    expect(articles[0].textContent).toContain('Zero rejects');
    expect(history.textContent).toContain('Showing 1 of 2 samples');

    await click('Clear filters', history);
    expect(history.querySelectorAll('article')).toHaveLength(2);
  });

  it('starts a new draft from prior evidence and requires confirmation before correction deletion', async () => {
    await mount();

    const history = container.querySelector<HTMLElement>('[aria-label="Yield history"]')!;
    const rejectSample = history.querySelector<HTMLElement>('[aria-label="Yield sample YS-REJECT"]')!;
    await click('Use as new draft', rejectSample);

    expect(formField('Sample ID').value).toBe('');
    expect(formField('Good pieces').value).toBe('8');
    expect(formField('Rejected pieces').value).toBe('2');
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')?.value).toBe('MAT-PLASTER');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 1"]')?.value).toBe('800');
    expect(container.textContent).toContain('New draft started from YS-REJECT');

    await click('Delete as correction', rejectSample);
    expect((await session.yieldSampleEvidenceService.listSamples({ productId: product.id }))).toHaveLength(2);
    expect(rejectSample.querySelector('[aria-label="Confirm deletion of YS-REJECT"]')).not.toBeNull();

    await click('Keep sample', rejectSample);
    expect((await session.yieldSampleEvidenceService.listSamples({ productId: product.id }))).toHaveLength(2);

    await click('Delete as correction', rejectSample);
    await click('Confirm correction delete', rejectSample);
    expect((await session.yieldSampleEvidenceService.listSamples({ productId: product.id }))).toHaveLength(1);
    expect(container.querySelector('[aria-label="Yield sample YS-REJECT"]')).toBeNull();
  });
});
