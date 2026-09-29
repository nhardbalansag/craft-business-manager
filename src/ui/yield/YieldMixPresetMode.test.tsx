// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Material } from '../../domain/materials';
import type { MixPreset } from '../../domain/mixPresets';
import { YieldMixPresetMode } from './YieldMixPresetMode';

let container: HTMLDivElement;
let root: Root;

const materials: Material[] = [
  {
    id: 'MAT-PLASTER',
    name: 'Plaster of Paris',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 100,
    onHandQuantity: 1000,
    onHandUnit: 'g',
    isActive: true,
  },
  {
    id: 'MAT-WATER',
    name: 'Water',
    group: 'liquid',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 1,
    onHandQuantity: 1000,
    onHandUnit: 'g',
    isActive: true,
  },
];

const preset: MixPreset = {
  id: 'MIX-2-1',
  name: 'Standard Plaster Mix',
  compatibleCategories: ['paintable-art'],
  basis: 'weight',
  lines: [
    { materialId: 'MAT-PLASTER', role: 'primary', parts: 2 },
    { materialId: 'MAT-WATER', role: 'secondary', parts: 1 },
  ],
  notes: 'Two parts plaster to one part water.',
  isActive: true,
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

describe('YRS3B YieldMixPresetMode', () => {
  it('shows only active compatible choices supplied by the Yield workflow and previews the selected ratio', async () => {
    await act(async () =>
      root.render(
        <YieldMixPresetMode
          presets={[preset]}
          materials={materials}
          selectedPresetId={preset.id}
          selectedPreset={preset}
          onChange={() => undefined}
        />,
      ),
    );

    const select = container.querySelector<HTMLSelectElement>(
      '[aria-label="Yield Mix preset"]',
    )!;
    expect(select.value).toBe('MIX-2-1');
    expect(container.textContent).toContain('Standard Plaster Mix');
    expect(container.textContent).toContain('Weight ratio');
    expect(container.textContent).toContain('Plaster of Paris');
    expect(container.textContent).toContain('2 parts');
    expect(container.textContent).toContain('Water');
    expect(container.textContent).toContain('1 part');
    expect(container.textContent).toContain(
      'Actual material quantities below remain authoritative',
    );
  });

  it('reports source changes without mutating actual Yield evidence itself', async () => {
    const onChange = vi.fn();

    await act(async () =>
      root.render(
        <YieldMixPresetMode
          presets={[preset]}
          materials={materials}
          selectedPresetId=""
          onChange={onChange}
        />,
      ),
    );

    const select = container.querySelector<HTMLSelectElement>(
      '[aria-label="Yield Mix preset"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )!.set!.call(select, preset.id);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('MIX-2-1');
  });

  it('gives an explicit empty state when no active compatible preset exists', async () => {
    await act(async () =>
      root.render(
        <YieldMixPresetMode
          presets={[]}
          materials={materials}
          selectedPresetId=""
          onChange={() => undefined}
        />,
      ),
    );

    expect(
      container.querySelector<HTMLSelectElement>(
        '[aria-label="Yield Mix preset"]',
      )?.disabled,
    ).toBe(true);
    expect(container.textContent).toContain(
      'No active compatible Mix preset is available.',
    );
    expect(container.textContent).toContain('Manual or Mold formula');
  });

  it('shows a copied unavailable preset but keeps it invalid for new evidence', async () => {
    const archived = { ...preset, id: 'MIX-OLD', isActive: false };

    await act(async () =>
      root.render(
        <YieldMixPresetMode
          presets={[]}
          materials={materials}
          selectedPresetId={archived.id}
          selectedPreset={archived}
          onChange={() => undefined}
        />,
      ),
    );

    expect(container.textContent).toContain('MIX-OLD');
    expect(container.textContent).toContain('unavailable');
    expect(container.textContent).toContain(
      'Select an active compatible preset before recording.',
    );
  });

  it('keeps a missing copied preset identity visible instead of silently clearing it', async () => {
    await act(async () =>
      root.render(
        <YieldMixPresetMode
          presets={[preset]}
          materials={materials}
          selectedPresetId="MIX-MISSING"
          onChange={() => undefined}
        />,
      ),
    );

    const select = container.querySelector<HTMLSelectElement>(
      '[aria-label="Yield Mix preset"]',
    )!;
    expect(select.value).toBe('MIX-MISSING');
    expect(container.textContent).toContain('MIX-MISSING · unavailable');
    expect(container.textContent).toContain(
      'Referenced Mix preset MIX-MISSING is unavailable.',
    );
  });
});
