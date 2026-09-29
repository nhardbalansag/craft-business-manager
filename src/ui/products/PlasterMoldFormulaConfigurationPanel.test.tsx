// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Material } from '../../domain/materials';
import type { Mold } from '../../domain/molds';
import { PlasterMoldFormulaConfigurationPanel } from './PlasterMoldFormulaConfigurationPanel';

const mold: Mold = {
  id: 'MOLD-1',
  productId: 'PROD-1',
  name: 'Dinosaur Mold',
  isActive: true,
};

function material(
  id: string,
  name: string,
  overrides: Partial<Material> = {},
): Material {
  return {
    id,
    name,
    group: 'other',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 100,
    onHandQuantity: 1000,
    onHandUnit: 'g',
    isActive: true,
    ...overrides,
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

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.moldRepository.replaceAll([mold]),
    session.materialRepository.replaceAll([
      material('MAT-WATER', 'Water', { group: 'liquid' }),
      material('MAT-PLASTER', 'Plaster of Paris', { group: 'plaster' }),
      material('MAT-GLUE', 'White Glue'),
      material('MAT-VOLUME', 'Volume Only', {
        baseUnit: 'mL',
        purchaseUnit: 'mL',
        onHandUnit: 'mL',
      }),
    ]),
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
  await act(async () => {
    root.render(<PlasterMoldFormulaConfigurationPanel molds={[mold]} />);
  });
  await flush();
}

function field(
  label: string,
): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const wrapper = Array.from(container.querySelectorAll('label')).find(
    (item) => item.querySelector(':scope > span')?.textContent === label,
  );
  if (!wrapper) throw new Error(`No field: ${label}`);
  const control = wrapper.querySelector('input,select,textarea');
  if (!control) throw new Error(`No control for field: ${label}`);
  return control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
}

async function fill(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  await act(async () => {
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await flush();
}

async function click(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === text,
  );
  if (!button) throw new Error(`No button: ${text}`);
  await act(async () => {
    button.click();
  });
  await flush();
}

async function submitForm() {
  const form = container.querySelector(
    'form[aria-label="Mold formula profile form"]',
  ) as HTMLFormElement;
  await act(async () => {
    form.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true }),
    );
  });
  await flush();
}

describe('MY5 PlasterMoldFormulaConfigurationPanel', () => {
  it('creates a profile from weight-compatible Materials and shows the MY4 estimate', async () => {
    await mount();

    expect(container.textContent).toContain('Not configured');
    expect(container.textContent).toContain('PMYP-0001');

    const waterOptions = Array.from(
      (field('Water material') as HTMLSelectElement).options,
    ).map((option) => option.textContent);
    expect(waterOptions).toContain('Water · MAT-WATER');
    expect(waterOptions).not.toContain('Volume Only · MAT-VOLUME');

    await fill(field('Water material'), 'MAT-WATER');
    await fill(field('Plaster material'), 'MAT-PLASTER');
    await fill(field('Glue material'), 'MAT-GLUE');
    await fill(field('Mold water fill (g)'), '50');
    await fill(field('Water adjustment (%)'), '30');
    await fill(field('Plaster factor'), '0.75');
    await fill(field('Glue factor'), '0.05');
    await fill(field('Pieces per pour'), '4');
    await submitForm();

    expect(await session.plasterMoldYieldProfileService.getProfile('PMYP-0001'))
      .toMatchObject({
        moldId: 'MOLD-1',
        waterFillWeightGrams: 50,
        waterAdjustmentRate: 0.3,
        plasterFactor: 0.75,
        glueFactor: 0.05,
        piecesPerPour: 4,
        isActive: true,
      });

    expect(container.textContent).toContain('Active · PMYP-0001');
    expect(container.textContent).toContain('63 g');
    expect(container.textContent).toContain('15.75 g');

    await fill(field('Requested pieces'), '21');
    expect(container.textContent).toContain('Required pours');
    expect(container.textContent).toContain('24');
    expect(container.textContent).toContain('378 g');
    expect(container.textContent).toContain(
      'Product safety waste is not applied',
    );
  });

  it('edits the active profile without changing its stable profile ID', async () => {
    await session.plasterMoldYieldProfileService.createProfile({
      id: 'PMYP-0042',
      moldId: 'MOLD-1',
      waterMaterialId: 'MAT-WATER',
      plasterMaterialId: 'MAT-PLASTER',
      glueMaterialId: 'MAT-GLUE',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 1,
      isActive: true,
    });

    await mount();
    expect(container.textContent).toContain('Active · PMYP-0042');

    await fill(field('Pieces per pour'), '3');
    await click('Save formula changes');

    expect(await session.plasterMoldYieldProfileService.getProfile('PMYP-0042'))
      .toMatchObject({ id: 'PMYP-0042', piecesPerPour: 3, isActive: true });
  });

  it('archives the active profile and can restore historical configuration', async () => {
    await session.plasterMoldYieldProfileService.createProfile({
      id: 'PMYP-0001',
      moldId: 'MOLD-1',
      waterMaterialId: 'MAT-WATER',
      plasterMaterialId: 'MAT-PLASTER',
      glueMaterialId: 'MAT-GLUE',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 2,
      isActive: true,
    });

    await mount();
    await click('Archive profile');

    expect(await session.plasterMoldYieldProfileService.getProfile('PMYP-0001'))
      .toMatchObject({ isActive: false });
    expect(container.textContent).toContain('Not configured');
    expect(container.textContent).toContain('1 archived for this Mold');

    await click('Restore');

    expect(await session.plasterMoldYieldProfileService.getProfile('PMYP-0001'))
      .toMatchObject({ isActive: true });
    expect(container.textContent).toContain('Active · PMYP-0001');
  });

  it('surfaces distinct-material validation instead of creating an invalid profile', async () => {
    await mount();

    await fill(field('Water material'), 'MAT-WATER');
    await fill(field('Plaster material'), 'MAT-WATER');
    await fill(field('Glue material'), 'MAT-GLUE');
    await fill(field('Mold water fill (g)'), '50');
    await submitForm();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'distinct Material IDs',
    );
    expect(await session.plasterMoldYieldProfileService.listProfiles()).toEqual([]);
  });

  it('renders a useful empty state when no active Mold exists', async () => {
    await act(async () => {
      root.render(<PlasterMoldFormulaConfigurationPanel molds={[]} />);
    });
    await flush();

    expect(container.textContent).toContain('Add an active Mold first.');
    expect(container.querySelector('form')).toBeNull();
  });
});
