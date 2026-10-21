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
  id: 'MAT-YRS5C-PLASTER',
  name: 'Legacy-Compatible Plaster',
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
  id: 'PROD-YRS5C',
  name: 'Legacy-Compatible Product',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

const mix: MixPreset = {
  id: 'MIX-YRS5C',
  name: 'Legacy Saved Mix',
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
    session.yieldMoldFormulaSourceRepository.replaceAll([]),
  ]);

  await session.yieldSampleRepository.replaceAll([
    sample('YLD-YRS5C-MANUAL', '2026-01-10T01:00:00.000Z'),
    sample('YLD-YRS5C-MIX', '2026-01-11T01:00:00.000Z', {
      mixPresetId: mix.id,
    }),
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

describe('YRS5C legacy-compatible Yield history presentation', () => {
  it('explains deterministic legacy resolution without guessing per-row origin', async () => {
    await mount();

    const compatibility = container.querySelector<HTMLDetailsElement>(
      '[aria-label="Legacy Yield sample compatibility"]',
    )!;

    expect(compatibility).not.toBeNull();
    expect(compatibility.textContent).toContain('How legacy samples are shown');
    expect(compatibility.textContent).toContain(
      'Pre-YRS samples keep their original saved meaning',
    );
    expect(compatibility.textContent).toContain(
      'History does not guess source origin from dates or migration age',
    );
    expect(compatibility.textContent).toContain('Saved Mix preset reference');
    expect(compatibility.textContent).toContain('Manual');
    expect(compatibility.textContent).toContain('Mold formula');

    // The UI deliberately avoids falsely tagging individual rows as legacy.
    expect(
      container.querySelector('.history-badges .status-pill[data-legacy]'),
    ).toBeNull();
  });

  it('shows the saved source basis for legacy-compatible Manual and Mix preset rows', async () => {
    await mount();

    const manual = historySample('YLD-YRS5C-MANUAL').querySelector<HTMLElement>(
      '.yield-history-recipe-source',
    )!;
    const mixSample = historySample('YLD-YRS5C-MIX').querySelector<HTMLElement>(
      '.yield-history-recipe-source',
    )!;

    expect(manual.textContent).toContain('Manual');
    expect(manual.textContent).toContain('No saved recipe reference');

    expect(mixSample.textContent).toContain('Mix preset');
    expect(mixSample.textContent).toContain('Legacy Saved Mix');
    expect(mixSample.textContent).toContain('Saved Mix preset reference');

    expect(manual.textContent).not.toContain('Mold formula');
    expect(mixSample.textContent).not.toContain('Mold formula');
  });
});
