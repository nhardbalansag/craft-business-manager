// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Material } from '../../domain/materials';
import { CalibrationPage } from './CalibrationPage';

let container: HTMLDivElement;
let root: Root;

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
  isActive: true,
};

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

async function seedMaterial() {
  await session.materialService.createMaterial(plaster);
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

async function mount() {
  await act(async () => root.render(<CalibrationPage />));
}

function form() {
  return container.querySelector<HTMLFormElement>('[aria-label="Calibration sample"]')!;
}

function history() {
  return container.querySelector<HTMLElement>('[aria-label="Calibration history"]')!;
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

async function submit() {
  await act(async () => form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

describe('Calibration workspace UI/UX', () => {
  it('shows a real loading state instead of a false no-materials message', async () => {
    await seedMaterial();
    let release!: (value: Material[]) => void;
    vi.spyOn(session.materialService, 'listMaterials').mockImplementationOnce(
      () => new Promise((resolve) => { release = resolve; }),
    );

    await mount();
    expect(container.textContent).toContain('Loading calibration workspace');
    expect(container.textContent).not.toContain('Add a weight-based material first');

    await act(async () => release([plaster]));
    expect(form()).not.toBeNull();
    expect(container.textContent).toContain('Choose the material');
  });

  it('guides measurement, previews the derived result, and saves evidence as the latest calibration', async () => {
    await seedMaterial();
    await mount();

    const guide = container.querySelector('[aria-label="Calibration workflow"]')!;
    expect(guide.textContent).toContain('Choose the material');
    expect(guide.textContent).toContain('Measure a known volume');
    expect(guide.textContent).toContain('Weigh that same sample');
    expect(container.textContent).toContain('Included in workbook exports');
    expect(container.textContent).not.toContain('Excel save/load arrives in Phase 5');

    await fill(field('Weight quantity'), '125');
    expect(form().textContent).toContain('Ready to save');
    expect(form().textContent).toContain('125 g/cup');

    await submit();

    const saved = await session.calibrationService.listCalibrations('PLASTER');
    expect(saved).toHaveLength(1);
    expect(history().textContent).toContain('Effective calibration');
    expect(history().textContent).toContain('125 g/cup');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('latest valid sample');
  });

  it('compares a draft measurement with the current calibration and supports searchable sortable evidence history', async () => {
    await seedMaterial();
    await session.calibrationService.createCalibration({
      id: 'CAL-OLD',
      materialId: 'PLASTER',
      measuredVolume: 1,
      volumeUnit: 'cup',
      knownWeight: 100,
      weightUnit: 'g',
      recordedAt: '2026-09-15T01:00:00.000Z',
      notes: 'older batch',
    });
    await session.calibrationService.createCalibration({
      id: 'CAL-NEW',
      materialId: 'PLASTER',
      measuredVolume: 1,
      volumeUnit: 'cup',
      knownWeight: 120,
      weightUnit: 'g',
      recordedAt: '2026-09-16T01:00:00.000Z',
      notes: 'new batch',
    });

    await mount();
    expect(history().textContent).toContain('120 g/cup');

    await fill(field('Weight quantity'), '132');
    expect(form().textContent).toContain('10% higher than the current effective calibration');

    const search = history().querySelector<HTMLInputElement>('[aria-label="Search calibration history"]')!;
    await fill(search, 'older batch');
    expect(history().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(history().querySelector('tbody')?.textContent).toContain('CAL-OLD');

    await fill(search, '');
    const sort = history().querySelector<HTMLSelectElement>('[aria-label="Sort calibration history"]')!;
    await fill(sort, 'oldest');
    expect(history().querySelector('tbody tr strong')?.textContent).toBe('CAL-OLD');
  });

  it('recovers a failed initial calibration read without presenting an empty workspace', async () => {
    await seedMaterial();
    vi.spyOn(session.calibrationService, 'listCalibrations').mockRejectedValueOnce(new Error('Calibration read failed'));

    await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Calibration unavailable');
    expect(container.textContent).not.toContain('No calibration samples yet');

    await click('Retry loading');
    expect(form()).not.toBeNull();
    expect(history().textContent).toContain('Plaster of Paris');
  });

  it('keeps non-weight materials out of the calibration selector and resets a draft without changing saved evidence', async () => {
    await seedMaterial();
    await session.calibrationService.createCalibration({
      id: 'CAL-SAVED',
      materialId: 'PLASTER',
      measuredVolume: 1,
      volumeUnit: 'cup',
      knownWeight: 110,
      weightUnit: 'g',
      recordedAt: '2026-09-16T01:00:00.000Z',
    });

    await mount();
    const materialSelect = field('Material') as HTMLSelectElement;
    expect(Array.from(materialSelect.options).map((option) => option.value)).toEqual(['PLASTER']);

    await fill(field('Weight quantity'), '140');
    expect(form().textContent).toContain('140 g/cup');
    await click('Reset sample', form());
    expect(field('Weight quantity').value).toBe('');
    expect(form().textContent).toContain('Waiting for weight');
    expect(await session.calibrationService.listCalibrations('PLASTER')).toHaveLength(1);
    expect(history().textContent).toContain('110 g/cup');
  });
});
