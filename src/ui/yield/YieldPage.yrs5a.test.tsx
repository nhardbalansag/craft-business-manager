// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Material } from '../../domain/materials';
import type { MixPreset } from '../../domain/mixPresets';
import type { Product } from '../../domain/products';
import type { YieldSample } from '../../domain/yieldSamples';
import { YieldPage } from './YieldPage';

let container: HTMLDivElement;
let root: Root;

const plaster: Material = {
  id: 'MAT-YRS5A-PLASTER',
  name: 'History Plaster',
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
  id: 'PROD-YRS5A',
  name: 'YRS5A History Product',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

const mix: MixPreset = {
  id: 'MIX-YRS5A',
  name: 'Standard History Mix',
  compatibleCategories: ['paintable-art'],
  basis: 'weight',
  lines: [
    {
      materialId: plaster.id,
      role: 'primary',
      parts: 1,
    },
  ],
  isActive: true,
};

function sample(
  id: string,
  recordedAt: string,
  overrides: Partial<YieldSample> = {},
): YieldSample {
  return {
    id,
    productId: product.id,
    materialInputs: [
      {
        materialId: plaster.id,
        quantity: 100,
        unit: 'g',
      },
    ],
    goodPieces: 4,
    rejectedPieces: 0,
    recordedAt,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.materialRepository.replaceAll([plaster]),
    session.productRepository.replaceAll([product]),
    session.mixPresetRepository.replaceAll([mix]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
    session.storageLocationRepository.replaceAll([]),
    session.moldRepository.replaceAll([]),
    session.plasterMoldYieldProfileRepository.replaceAll([]),
  ]);

  await session.yieldSampleRepository.replaceAll([
    sample('YLD-MANUAL', '2026-09-27T01:00:00.000Z'),
    sample('YLD-MIX', '2026-09-28T01:00:00.000Z', {
      mixPresetId: mix.id,
    }),
    sample('YLD-FORMULA', '2026-09-29T01:00:00.000Z'),
  ]);
  await session.yieldMoldFormulaSourceRepository.replaceAll([
    {
      yieldSampleId: 'YLD-FORMULA',
      moldId: 'MOLD-YRS5A',
      moldYieldProfileId: 'PMYP-YRS5A',
    },
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
}

function historySample(id: string): HTMLElement {
  return container.querySelector<HTMLElement>(
    `[aria-label="Yield sample ${id}"]`,
  )!;
}

async function fill(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      'value',
    )!.set!.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input', {
        bubbles: true,
      }),
    );
  });
}

describe('YRS5A Yield history resolved source labels', () => {
  it('renders authoritative Manual, Mix preset, and Mold formula labels', async () => {
    await mount();

    const manual = historySample('YLD-MANUAL');
    const mixSample = historySample('YLD-MIX');
    const formula = historySample('YLD-FORMULA');

    const manualSource = manual.querySelector<HTMLElement>(
      '.yield-history-recipe-source',
    )!;
    const mixSource = mixSample.querySelector<HTMLElement>(
      '.yield-history-recipe-source',
    )!;
    const formulaSource = formula.querySelector<HTMLElement>(
      '.yield-history-recipe-source',
    )!;

    expect(manualSource.textContent).toContain('Recipe source');
    expect(manualSource.textContent).toContain('Manual');

    expect(mixSource.textContent).toContain('Recipe source');
    expect(mixSource.textContent).toContain('Mix preset');
    expect(mixSource.textContent).toContain('Standard History Mix');

    expect(formulaSource.textContent).toContain('Recipe source');
    expect(formulaSource.textContent).toContain('Mold formula');

    // YRS5B owns Mold/profile traceability details.
    expect(formulaSource.textContent).not.toContain('MOLD-YRS5A');
    expect(formulaSource.textContent).not.toContain('PMYP-YRS5A');
  });

  it('includes resolved source labels in Yield history search', async () => {
    await mount();

    const search = container.querySelector<HTMLInputElement>(
      '[aria-label="Search yield history"]',
    )!;

    await fill(search, 'mold formula');

    const history = container.querySelector<HTMLElement>(
      '[aria-label="Yield history"]',
    )!;
    const articles = history.querySelectorAll('article');

    expect(articles).toHaveLength(1);
    expect(articles[0].getAttribute('aria-label')).toBe(
      'Yield sample YLD-FORMULA',
    );
    expect(history.textContent).toContain('Showing 1 of 3 samples');
  });
});
