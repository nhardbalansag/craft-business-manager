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
  it('pages the full history, resets filters to page one, and clamps after deleting the last page', async () => {
    await session.yieldSampleRepository.replaceAll(Array.from({ length: 11 }, (_, index) => sample({
      id: `YS-${String(index + 1).padStart(2, '0')}`,
      recordedAt: `2026-09-${String(index + 1).padStart(2, '0')}T01:00:00.000Z`,
      rejectedPieces: index === 0 ? 0 : 2,
    })));
    await mount();
    const history = container.querySelector<HTMLElement>('[aria-label="Yield history"]')!;
    expect(history.querySelectorAll('article')).toHaveLength(5);
    expect(history.textContent).toContain('Batches 1–5 of 11');
    await click('Next page', history);
    expect(history.textContent).toContain('Batches 6–10 of 11');
    expect(document.activeElement?.textContent).toBe('Recorded batches');
    await fill(history.querySelector<HTMLInputElement>('[aria-label="Search yield history"]')!, 'YS-01');
    expect(history.querySelectorAll('article')).toHaveLength(1);
    expect(history.textContent).toContain('Batches 1–1 of 1 matching');
    await click('Clear filters', history);
    await click('Next page', history);
    await fill(history.querySelector<HTMLSelectElement>('[aria-label="Filter yield history by outcome"]')!, 'clean');
    expect(history.textContent).toContain('Batches 1–1 of 1 matching');
    await click('Clear filters', history);
    await click('Next page', history);
    await fill(history.querySelector<HTMLSelectElement>('[aria-label="Sort yield history"]')!, 'oldest');
    expect(history.querySelector('article')?.getAttribute('aria-label')).toBe('Yield sample YS-01');
    expect(history.textContent).toContain('Page 1 of 3');
    await click('Clear filters', history);
    await click('Next page', history);
    await click('Next page', history);
    expect(history.querySelectorAll('article')).toHaveLength(1);
    await click('Delete as correction', history);
    const listHistory = session.yieldHistoryService.listHistory.bind(session.yieldHistoryService);
    let finishRefresh!: (samples: YieldSample[]) => void;
    let refreshDelayed = false;
    vi.spyOn(session.yieldHistoryService, 'listHistory').mockImplementation(async (productId) => {
      const samples = await listHistory(productId);
      if (samples.length === 10 && !refreshDelayed) {
        refreshDelayed = true;
        return new Promise((resolve) => { finishRefresh = resolve; });
      }
      return samples;
    });
    await click('Confirm correction delete', history);
    expect(history.textContent).toContain('Loading yield history');
    await act(async () => finishRefresh(await listHistory(product.id)));
    await flush();
    expect(history.querySelectorAll('article')).toHaveLength(5);
    expect(history.textContent).toContain('Batches 6–10 of 10');
    expect(history.textContent).toContain('Page 2 of 2');
    expect(history.querySelector('[role="status"]')?.textContent).toContain('deleted as a correction');
    expect(document.activeElement?.textContent).toContain('deleted as a correction');
  });

  it('keeps preference feedback beside saved results and provides keyboard section shortcuts', async () => {
    await mount();
    const history = container.querySelector<HTMLElement>('[aria-label="Yield history"]')!;
    await click('Use as preferred yield', history.querySelector('[aria-label="Yield sample YS-CLEAN"]')!);
    expect(history.querySelector('[role="status"]')?.textContent).toContain('YS-CLEAN is now preferred');
    expect(container.querySelector('[aria-label="Yield sample"] [role="status"]')).toBeNull();
    await click('Use latest valid automatically');
    expect(container.querySelector('[aria-label="Effective yield learning"] [role="status"]')?.textContent).toContain('Automatic Yield selection restored');
    const nav = container.querySelector('[aria-label="Yield sections"]')!;
    for (const label of ['Batch evidence', 'Effective learning', 'Recorded batches']) {
      await click(label, nav);
      expect(document.activeElement?.textContent).toBe(label);
    }
  });

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
    expect(document.activeElement?.textContent).toBe('Batch evidence');

    expect(formField('Sample ID').value).toBe('YLD-0001');
    expect((formField('Sample ID') as HTMLInputElement).readOnly).toBe(true);
    expect(formField('Good pieces').value).toBe('8');
    expect(formField('Rejected pieces').value).toBe('2');
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')?.value).toBe('MAT-PLASTER');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 1"]')?.value).toBe('800');
    expect(container.textContent).toContain('New draft started from YS-REJECT');
    expect(container.textContent).toContain('fresh Sample ID will be assigned automatically');

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
