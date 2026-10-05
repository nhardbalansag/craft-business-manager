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

describe('YRS4C YieldMoldFormulaMode', () => {
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
    expect(container.textContent).toContain('Formula setup below');
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
      'will keep only its Mold and profile provenance',
    );

    // YRS4 owns planned pieces and theoretical quantity preview inside the mode.
    expect(summary.textContent).not.toContain('12');
    expect(summary.textContent).not.toContain('300');
  });

  it('hosts the relocated MY6 assistant inside the Mold Formula mode', async () => {
    await act(async () =>
      root.render(
        <YieldMoldFormulaMode
          draft={null}
          selectedProductId="PROD-DINO"
          assistant={<div aria-label="Stub MY6 assistant">FORMULA SETUP</div>}
        />,
      ),
    );

    const mode = container.querySelector(
      '[aria-label="Mold Formula recipe source"]',
    )!;
    const assistant = mode.querySelector(
      '[aria-label="Mold Formula assistant"]',
    )!;

    expect(assistant).not.toBeNull();
    expect(assistant.textContent).toContain('FORMULA SETUP');
    expect(container.textContent).toContain('Use Formula setup below');
  });

  it('integrates the real-batch confirmation only after a Formula draft is attached', async () => {
    const onMeasurementConfirmationChange = vi.fn();

    await act(async () =>
      root.render(
        <YieldMoldFormulaMode
          draft={draft}
          selectedProductId="PROD-DINO"
          measurementConfirmed={false}
          onMeasurementConfirmationChange={onMeasurementConfirmationChange}
        />,
      ),
    );

    const confirmation = container.querySelector<HTMLElement>(
      '[aria-label="Actual measurement confirmation"]',
    )!;
    const checkbox = confirmation.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;

    expect(confirmation).not.toBeNull();
    expect(confirmation.textContent).toContain('Required');
    expect(confirmation.textContent).toContain(
      'Changing, adding, or removing any Material line resets this confirmation',
    );
    expect(checkbox.checked).toBe(false);

    await act(async () => checkbox.click());

    expect(onMeasurementConfirmationChange).toHaveBeenCalledOnce();
    expect(onMeasurementConfirmationChange).toHaveBeenCalledWith(true);
  });

  it('shows confirmed state and disables confirmation for a mismatched Product source', async () => {
    const onMeasurementConfirmationChange = vi.fn();

    await act(async () =>
      root.render(
        <YieldMoldFormulaMode
          draft={draft}
          selectedProductId="PROD-OTHER"
          measurementConfirmed={true}
          onMeasurementConfirmationChange={onMeasurementConfirmationChange}
        />,
      ),
    );

    const confirmation = container.querySelector<HTMLElement>(
      '[aria-label="Actual measurement confirmation"]',
    )!;
    const checkbox = confirmation.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;

    expect(confirmation.textContent).toContain('Confirmed');
    expect(confirmation.classList.contains('is-confirmed')).toBe(true);
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
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
