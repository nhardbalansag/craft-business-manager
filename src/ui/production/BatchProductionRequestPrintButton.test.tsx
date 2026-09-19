// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import { BatchProductionRequestPrintButton } from './BatchProductionRequestPrintButton';
import type { BatchPrintWindow } from './batchProductionRequestPrint';

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.materialRepository.replaceAll([]),
    session.productRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.mixPresetRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
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

async function seed() {
  await session.productService.createProduct({
    id: 'CANDLE',
    name: 'Workshop Candle',
    category: 'candle',
    safetyWasteRate: 0,
    isActive: true,
  });
  await session.materialService.createMaterial({
    id: 'WAX',
    name: 'Soy wax',
    group: 'wax',
    baseUnit: 'g',
    purchaseQuantity: 100,
    purchaseUnit: 'g',
    packageCost: 100,
    onHandQuantity: 100,
    onHandUnit: 'g',
    isActive: true,
  });
  await session.fixedRecipeItemService.createItem({
    id: 'RECIPE',
    productId: 'CANDLE',
    materialId: 'WAX',
    quantityPerProduct: 10,
    unit: 'g',
    role: 'consumable',
  });
  await session.productFinancialProfileService.upsertProfile({
    productId: 'CANDLE',
    laborCostPerUnit: 1,
    overheadCostPerUnit: 1,
    pricingPolicy: { method: 'profit-amount', value: 5 },
  });
}

function printWindow(): BatchPrintWindow {
  return {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
    focus: vi.fn(),
    print: vi.fn(),
  };
}

describe('BatchProductionRequestPrintButton', () => {
  it('refreshes authoritative evidence, prepares the current batch sheet, and leaves source data unchanged', async () => {
    await seed();
    const result = await session.plannedBatchCapacityFeasibilityService.assessBatch('CANDLE', 5);
    const before = await session.completeSourceSnapshotService.snapshot();
    const targetWindow = printWindow();
    const onPrint = vi.fn();

    await act(async () => {
      root.render(
        <BatchProductionRequestPrintButton
          result={result}
          openPrintWindow={() => targetWindow}
          onPrint={onPrint}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Print / Save Batch Sheet'),
    );
    expect(button).toBeTruthy();

    await act(async () => {
      button!.click();
    });
    await vi.waitFor(() => expect(onPrint).toHaveBeenCalledOnce());

    const [view, usedWindow] = onPrint.mock.calls[0]!;
    expect(usedWindow).toBe(targetWindow);
    expect(view).toMatchObject({
      product: { id: 'CANDLE', name: 'Workshop Candle' },
      plannedQuantity: 5,
    });
    expect(view.materials).toHaveLength(1);
    expect(view.materials[0]).toMatchObject({ materialId: 'WAX', materialName: 'Soy wax' });
    expect(view.financials.status).toBe(result.financials.status);
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(before);
    expect(container.textContent).toContain(
      'Printing does not reserve or deduct stock and does not create a persisted production order.',
    );
  });

  it('reports a blocked popup without changing the workspace', async () => {
    await seed();
    const result = await session.plannedBatchCapacityFeasibilityService.assessBatch('CANDLE', 2);
    const before = await session.completeSourceSnapshotService.snapshot();

    await act(async () => {
      root.render(
        <BatchProductionRequestPrintButton
          result={result}
          openPrintWindow={() => null}
          onPrint={vi.fn()}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Print / Save Batch Sheet'),
    )!;
    await act(async () => button.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Allow pop-ups');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(before);
  });
});
