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
  id: 'MAT-YRS5B-PLASTER',
  name: 'Trace Plaster',
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
  id: 'PROD-YRS5B',
  name: 'Trace Product',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

const formulaSample: YieldSample = {
  id: 'YLD-YRS5B-FORMULA',
  productId: product.id,
  materialInputs: [
    {
      materialId: plaster.id,
      quantity: 120,
      unit: 'g',
    },
  ],
  goodPieces: 4,
  rejectedPieces: 0,
  recordedAt: '2026-09-29T10:00:00.000Z',
};

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  await Promise.all([
    session.materialRepository.replaceAll([plaster]),
    session.productRepository.replaceAll([product]),
    session.mixPresetRepository.replaceAll([]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
    session.storageLocationRepository.replaceAll([]),
    session.moldRepository.replaceAll([
      {
        id: 'MOLD-YRS5B',
        productId: product.id,
        name: 'Dinosaur 4-Cavity Mold',
        isActive: false,
      },
    ]),
    session.plasterMoldYieldProfileRepository.replaceAll([
      {
        id: 'PMYP-YRS5B',
        moldId: 'MOLD-YRS5B',
        waterMaterialId: 'MAT-WATER-YRS5B',
        plasterMaterialId: plaster.id,
        glueMaterialId: 'MAT-GLUE-YRS5B',
        waterFillWeightGrams: 50,
        waterAdjustmentRate: 0.3,
        plasterFactor: 0.75,
        glueFactor: 0.05,
        piecesPerPour: 4,
        isActive: false,
      },
    ]),
    session.yieldSampleRepository.replaceAll([formulaSample]),
    session.yieldMoldFormulaSourceRepository.replaceAll([
      {
        yieldSampleId: formulaSample.id,
        moldId: 'MOLD-YRS5B',
        moldYieldProfileId: 'PMYP-YRS5B',
      },
    ]),
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

async function fill(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      'value',
    )!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('YRS5B Yield history Mold / Profile traceability', () => {
  it('shows stored Mold and profile identity for Mold Formula history', async () => {
    await mount();

    const sample = container.querySelector<HTMLElement>(
      '[aria-label="Yield sample YLD-YRS5B-FORMULA"]',
    )!;
    const source = sample.querySelector<HTMLElement>(
      '.yield-history-recipe-source',
    )!;
    const trace = sample.querySelector<HTMLElement>(
      '[aria-label="Mold Formula traceability YLD-YRS5B-FORMULA"]',
    )!;

    expect(source.textContent).toContain('Recipe source');
    expect(source.textContent).toContain('Mold formula');
    expect(trace.textContent).toContain('Dinosaur 4-Cavity Mold');
    expect(trace.textContent).toContain('MOLD-YRS5B');
    expect(trace.textContent).toContain('Profile PMYP-YRS5B');

    // Historical provenance remains readable after the physical sources archive.
    expect(trace.textContent).toContain('archived');
  });

  it('includes Mold name, Mold ID, and profile ID in history search', async () => {
    await mount();

    const search = container.querySelector<HTMLInputElement>(
      '[aria-label="Search yield history"]',
    )!;

    for (const query of [
      'Dinosaur 4-Cavity Mold',
      'MOLD-YRS5B',
      'PMYP-YRS5B',
    ]) {
      await fill(search, query);
      const history = container.querySelector<HTMLElement>(
        '[aria-label="Yield history"]',
      )!;
      expect(history.querySelectorAll('article')).toHaveLength(1);
      expect(history.textContent).toContain('YLD-YRS5B-FORMULA');
    }
  });
});
