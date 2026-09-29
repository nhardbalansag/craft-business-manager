// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import { YieldPage } from './YieldPage';

const product: Product = {
  id: 'PROD-MY6',
  name: 'MY6 Paintable Dino',
  category: 'paintable-art',
  safetyWasteRate: 0.1,
  isActive: true,
};

function material(
  id: string,
  name: string,
  group: Material['group'],
): Material {
  return {
    id,
    name,
    group,
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 100,
    onHandQuantity: 1000,
    onHandUnit: 'g',
    isActive: true,
  };
}

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount() {
  await act(async () => root.render(<YieldPage />));
  await flush();
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
  await flush();
}

async function click(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Missing button: ${text}`);
  await act(async () => button.click());
  await flush();
}

async function selectMoldFormulaSource() {
  const source = container.querySelector<HTMLInputElement>(
    '[aria-label="Recipe source"] input[value="mold-formula"]',
  );
  if (!source) throw new Error('Missing Mold Formula Recipe source option.');
  await act(async () => source.click());
  await flush();
}

function yieldForm(): HTMLFormElement {
  return container.querySelector<HTMLFormElement>(
    '[aria-label="Yield sample"]',
  )!;
}

function field(label: string) {
  const wrapper = Array.from(yieldForm().querySelectorAll('label')).find(
    (item) =>
      item.querySelector('span')?.textContent?.trim().startsWith(label),
  );
  if (!wrapper) throw new Error(`Missing field: ${label}`);
  return wrapper.querySelector<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >('input,select,textarea')!;
}

async function seedFormula() {
  await Promise.all([
    session.materialRepository.replaceAll([
      material('MAT-WATER', 'Water', 'liquid'),
      material('MAT-PLASTER', 'Plaster of Paris', 'plaster'),
      material('MAT-GLUE', 'White Glue', 'other'),
    ]),
    session.productRepository.replaceAll([product]),
    session.mixPresetRepository.replaceAll([]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
    session.storageLocationRepository.replaceAll([]),
    session.moldRepository.replaceAll([
      {
        id: 'MOLD-MY6',
        productId: product.id,
        name: 'Four Cavity Dino Mold',
        isActive: true,
      },
    ]),
    session.plasterMoldYieldProfileRepository.replaceAll([
      {
        id: 'PMYP-MY6',
        moldId: 'MOLD-MY6',
        waterMaterialId: 'MAT-WATER',
        plasterMaterialId: 'MAT-PLASTER',
        glueMaterialId: 'MAT-GLUE',
        waterFillWeightGrams: 50,
        waterAdjustmentRate: 0.3,
        plasterFactor: 0.75,
        glueFactor: 0.05,
        piecesPerPour: 4,
        isActive: true,
      },
    ]),
    session.yieldMoldFormulaSourceRepository.replaceAll([]),
  ]);
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await seedFormula();
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

describe('MY6 Yield Workspace Mold Formula integration', () => {
  it('copies a theoretical formula into a draft without creating Yield evidence', async () => {
    await mount();

    expect(container.textContent).not.toContain('MOLD FORMULA ASSIST');
    await selectMoldFormulaSource();

    expect(
      container.querySelector('[aria-label="Mold Formula assistant"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain('MOLD FORMULA ASSIST');
    expect(container.textContent).toContain('Four Cavity Dino Mold');
    expect(container.textContent).toContain('63 g');

    await click('Use as Yield Sample Draft');

    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Recipe source"] input[value="mold-formula"]',
      )?.checked,
    ).toBe(true);
    const sourceSummary = container.querySelector<HTMLElement>(
      '[aria-label="Selected Mold Formula summary"]',
    )!;
    expect(sourceSummary).not.toBeNull();
    expect(sourceSummary.textContent).toContain('Four Cavity Dino Mold');
    expect(sourceSummary.textContent).toContain('MOLD-MY6');
    expect(sourceSummary.textContent).toContain('PMYP-MY6');
    expect(sourceSummary.textContent).toContain('Mold + profile provenance');

    expect(
      await session.yieldSampleEvidenceService.listSamples({
        productId: product.id,
      }),
    ).toEqual([]);

    expect(
      container.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')
        ?.value,
    ).toBe('MAT-WATER');
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 1"]')
        ?.value,
    ).toBe('35');
    expect(
      container.querySelector<HTMLSelectElement>('[aria-label="Yield material 2"]')
        ?.value,
    ).toBe('MAT-PLASTER');
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 2"]')
        ?.value,
    ).toBe('26.25');
    expect(
      container.querySelector<HTMLSelectElement>('[aria-label="Yield material 3"]')
        ?.value,
    ).toBe('MAT-GLUE');
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 3"]')
        ?.value,
    ).toBe('1.75');

    expect(field('Good pieces').value).toBe('');
    expect(field('Rejected pieces').value).toBe('');
    expect(container.textContent).toContain(
      'Good/rejected pieces were intentionally left blank',
    );
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
  });

  it('scales requested pieces, requires measured confirmation, then records Yield evidence with Mold Formula provenance', async () => {
    await mount();
    await selectMoldFormulaSource();

    const planned = container.querySelector<HTMLInputElement>(
      '[aria-label="Formula planned pieces"]',
    )!;
    await fill(planned, '21');

    expect(container.textContent).toContain('378 g');
    expect(container.textContent).toContain('6 pour(s) · capacity 24 · extra 3');

    await click('Use as Yield Sample Draft');

    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 1"]')
        ?.value,
    ).toBe('210');
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 2"]')
        ?.value,
    ).toBe('157.5');
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Yield quantity 3"]')
        ?.value,
    ).toBe('10.5');

    await fill(field('Good pieces'), '20');
    await fill(field('Rejected pieces'), '4');

    const confirmation = container.querySelector<HTMLInputElement>(
      '.yield-formula-draft-confirmation input[type="checkbox"]',
    )!;
    const record = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    )!;

    expect(confirmation.checked).toBe(false);
    expect(record.disabled).toBe(true);

    await act(async () => confirmation.click());
    await flush();

    expect(confirmation.checked).toBe(true);
    expect(record.disabled).toBe(false);
    expect(
      await session.yieldSampleEvidenceService.listSamples({
        productId: product.id,
      }),
    ).toEqual([]);

    await act(async () =>
      yieldForm().dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      ),
    );
    await flush();

    const saved = await session.yieldSampleEvidenceService.listSamples({
      productId: product.id,
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      productId: product.id,
      goodPieces: 20,
      rejectedPieces: 4,
      materialInputs: [
        { materialId: 'MAT-WATER', quantity: 210, unit: 'g' },
        { materialId: 'MAT-PLASTER', quantity: 157.5, unit: 'g' },
        { materialId: 'MAT-GLUE', quantity: 10.5, unit: 'g' },
      ],
    });
    expect(saved[0].mixPresetId).toBeUndefined();
    expect(
      await session.yieldMoldFormulaSourceService.getSourceForYieldSample(
        saved[0].id,
      ),
    ).toEqual({
      yieldSampleId: saved[0].id,
      moldId: 'MOLD-MY6',
      moldYieldProfileId: 'PMYP-MY6',
    });
  });

  it('invalidates measurement confirmation when a copied Material quantity changes', async () => {
    await mount();
    await selectMoldFormulaSource();
    await click('Use as Yield Sample Draft');

    await fill(field('Good pieces'), '3');
    await fill(field('Rejected pieces'), '1');

    const confirmation = container.querySelector<HTMLInputElement>(
      '.yield-formula-draft-confirmation input[type="checkbox"]',
    )!;
    await act(async () => confirmation.click());
    await flush();
    expect(confirmation.checked).toBe(true);

    const waterQuantity = container.querySelector<HTMLInputElement>(
      '[aria-label="Yield quantity 1"]',
    )!;
    await fill(waterQuantity, '34.8');

    expect(confirmation.checked).toBe(false);
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
  });

  it('protects an existing dirty Yield draft before replacing it with a formula draft', async () => {
    await mount();
    await fill(field('Notes'), 'Keep this batch');
    await selectMoldFormulaSource();


    await click('Use as Yield Sample Draft');

    expect(container.textContent).toContain('Keep your unsaved batch?');
    expect(field('Notes').value).toBe('Keep this batch');

    await click('Keep editing');
    expect(field('Notes').value).toBe('Keep this batch');

    await click('Use as Yield Sample Draft');
    await click('Discard draft and continue');

    expect(field('Notes').value).toBe('');
    expect(
      container.querySelector<HTMLSelectElement>('[aria-label="Yield material 1"]')
        ?.value,
    ).toBe('MAT-WATER');
  });
});
