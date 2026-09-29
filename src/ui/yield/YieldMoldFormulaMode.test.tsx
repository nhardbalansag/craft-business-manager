// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlasterMoldYieldDraft } from './plasterMoldYieldDraft';
import { YieldMoldFormulaMode } from './YieldMoldFormulaMode';

let container: HTMLDivElement;
let root: Root;

const draft: PlasterMoldYieldDraft = {
  sourceKind: 'plaster-mold-formula',
  estimateKind: 'theoretical',
  moldId: 'MOLD-DINO',
  moldName: 'Dino 4-Cavity Mold',
  productId: 'PROD-DINO',
  profileId: 'PMYP-DINO',
  requestedQuantity: 12,
  requiredPours: 3,
  producedCapacityPieces: 12,
  extraCapacityPieces: 0,
  totalMixtureGrams: 300,
  materialInputs: [
    {
      role: 'water',
      materialId: 'MAT-WATER',
      quantity: 120,
      unit: 'g',
    },
    {
      role: 'plaster',
      materialId: 'MAT-PLASTER',
      quantity: 171,
      unit: 'g',
    },
    {
      role: 'glue',
      materialId: 'MAT-GLUE',
      quantity: 9,
      unit: 'g',
    },
  ],
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

describe('YRS3C YieldMoldFormulaMode', () => {
  it('shows an explicit empty source state before a formula draft is attached', async () => {
    await act(async () =>
      root.render(
        <YieldMoldFormulaMode
          draft={null}
          selectedProductId="PROD-DINO"
        />,
      ),
    );

    expect(
      container.querySelector('[aria-label="Mold Formula recipe source"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain(
      'No Mold Formula is attached to this draft yet.',
    );
    expect(container.textContent).toContain('MOLD FORMULA ASSIST above');
    expect(container.textContent).toContain(
      'Actual batch evidence stays separate.',
    );
  });

  it('shows only provenance identity for an attached formula source', async () => {
    await act(async () =>
      root.render(
        <YieldMoldFormulaMode
          draft={draft}
          selectedProductId="PROD-DINO"
        />,
      ),
    );

    const summary = container.querySelector(
      '[aria-label="Selected Mold Formula summary"]',
    )!;

    expect(summary.textContent).toContain('Dino 4-Cavity Mold');
    expect(summary.textContent).toContain('MOLD-DINO');
    expect(summary.textContent).toContain('PMYP-DINO');
    expect(summary.textContent).toContain('Mold + profile provenance');
    expect(summary.textContent).toContain(
      'will not carry a Mix preset reference',
    );

    // YRS4 owns planned pieces and theoretical quantity preview inside the mode.
    expect(summary.textContent).not.toContain('12');
    expect(summary.textContent).not.toContain('300');
  });

  it('fails visibly if an attached formula belongs to another Product', async () => {
    await act(async () =>
      root.render(
        <YieldMoldFormulaMode
          draft={draft}
          selectedProductId="PROD-OTHER"
        />,
      ),
    );

    expect(container.textContent).toContain(
      'This Mold Formula belongs to another Product.',
    );
    expect(
      container.querySelector('[role="alert"]'),
    ).not.toBeNull();
  });
});
