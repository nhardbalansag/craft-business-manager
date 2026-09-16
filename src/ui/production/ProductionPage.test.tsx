// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import { ProductionPage } from './ProductionPage';
import { capacityPlan, parsePlannedQuantity, stockShortfall } from './productionPlanningView';

let container: HTMLDivElement;
let root: Root;
const openProducts = vi.fn();

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
  openProducts.mockClear();
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
    onHandQuantity: 50,
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
async function mount() {
  await act(async () => root.render(<ProductionPage onOpenProducts={openProducts} />));
}
function button(text: string) {
  const found = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes(text));
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
async function quantity(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function overview() {
  return container.querySelector('#production-overview')!;
}

// Exercise actual production services through the rendered planning workflow.
describe('production planning interactions', () => {
  it('guides an empty workshop to Products without publishing false readiness', async () => {
    await mount();
    expect(container.textContent).toContain('Add a product to start planning');
    expect(container.textContent).not.toContain('Estimate is ready');
    await click('Go to Products');
    expect(openProducts).toHaveBeenCalledOnce();
  });

  it('recovers from catalog loading failures', async () => {
    vi.spyOn(session.productService, 'listProducts').mockRejectedValueOnce(new Error('Catalog unavailable'));
    await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Catalog unavailable');
    await click('Try again');
    expect(container.textContent).toContain('Add a product to start planning');
  });

  it('shows shortages, toggles calculations, and only changes quantity on an explicit capacity action', async () => {
    await seed();
    const before = await session.completeSourceSnapshotService.snapshot();
    await mount();
    expect(overview().textContent).toContain('Within current capacity');
    await click('25');
    expect(overview().textContent).toContain('Over current capacity');
    expect(overview().textContent).toContain('20 pieces above current capacity');
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('25');
    await click('Review preparation list');
    const preparation = container.querySelector<HTMLElement>('#production-preparation')!;
    expect(preparation.hidden).toBe(false);
    expect(preparation.textContent).toContain('200 g short');
    const table = preparation.querySelector('table')!;
    expect(table.querySelectorAll('th')).toHaveLength(5);
    expect(table.querySelectorAll('tbody tr:first-child td')).toHaveLength(5);
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(table.querySelectorAll('th')).toHaveLength(9);
    expect(table.querySelectorAll('tbody tr:first-child td')).toHaveLength(9);
    await click('Use current capacity');
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('5');
    expect(preparation.textContent).toContain('Covered');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(before);
  });

  it('clears stale figures while a request is pending, cancels invalid input, and ignores late responses', async () => {
    await seed();
    await mount();
    const assess = session.plannedBatchCapacityFeasibilityService.assessBatch.bind(
      session.plannedBatchCapacityFeasibilityService,
    );
    const lateResult = await assess('CANDLE', 25);
    let resolve!: (value: typeof lateResult) => void;
    vi.spyOn(session.plannedBatchCapacityFeasibilityService, 'assessBatch').mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await click('25');
    expect(overview().textContent).toContain('Calculating your batch');
    expect(overview().textContent).not.toContain('PHP');
    await quantity('');
    expect(container.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    expect(overview().textContent).not.toContain('Calculating');
    await act(async () => resolve(lateResult));
    expect(overview().textContent).not.toContain('PHP');
    await quantity('0');
    expect(overview().textContent).toContain('Estimates for all 0 requested pieces');
    expect(overview().textContent).toContain('Unavailable');
    expect(overview().textContent).not.toContain('NaN');
    expect(overview().textContent).not.toContain('Infinity');
  });

  it('recovers a failed estimate through Retry estimate', async () => {
    await seed();
    vi.spyOn(session.plannedBatchCapacityFeasibilityService, 'assessBatch').mockRejectedValueOnce(
      new Error('Estimate unavailable'),
    );
    await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Estimate unavailable');
    expect(overview().textContent).not.toContain('PHP');
    await click('Retry estimate');
    expect(overview().textContent).toContain('Within current capacity');
  });

  it('keeps incomplete financial data visibly partial', async () => {
    await seed();
    await session.productFinancialProfileRepository.replaceAll([]);
    await mount();
    expect(overview().textContent).toContain('Financial data is incomplete');
    expect(overview().textContent).toContain('Unavailable');
    expect(overview().textContent).not.toContain('Estimate is ready');
  });

  it('distinguishes missing component stock from explicit zero', async () => {
    await seed();
    await session.productService.createProduct({
      id: 'POT',
      name: 'Handmade pot',
      category: 'candle-pot',
      safetyWasteRate: 0,
      isActive: true,
    });
    await session.productComponentService.createComponent({
      id: 'VESSEL',
      parentProductId: 'CANDLE',
      sourceType: 'product',
      sourceId: 'POT',
      role: 'vessel',
      quantityPerParent: 1,
    });
    await mount();
    await act(async () => {
      const select = container.querySelector('select')!;
      select.value = 'CANDLE';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(overview().textContent).toContain('Capacity unresolved');
    expect(button('Use current capacity').disabled).toBe(true);
    await click('Materials to prepare');
    expect(container.querySelector('#production-preparation')?.textContent).toContain('Stock not recorded');
    expect(container.querySelector('#production-preparation')?.textContent).toContain('Check stock');
    await session.productStockRepository.replaceAll([{ productId: 'POT', onHandQuantity: 0 }]);
    await click('10');
    expect(container.querySelector('#production-preparation')?.textContent).toContain('10 pc short');
  });
});

describe('planning input and capacity boundaries', () => {
  it('accepts zero but rejects blank, fractional, negative, non-finite and unsafe quantities', () => {
    expect(parsePlannedQuantity('0')).toBe(0);
    expect(parsePlannedQuantity('25')).toBe(25);
    for (const input of ['', ' ', '1.5', '-1', 'Infinity', '9007199254740992'])
      expect(parsePlannedQuantity(input)).toBeNull();
  });
  it('does not turn unknown stock into a shortage of zero', () => {
    expect(stockShortfall(10, null)).toBeNull();
    expect(stockShortfall(10, 0)).toBe(10);
    expect(stockShortfall(10, 12)).toBe(0);
  });
  it('handles zero capacity without division by zero and preserves unresolved capacity', async () => {
    await seed();
    await session.materialService.updateMaterial('WAX', { onHandQuantity: 0 });
    const result = await session.plannedBatchCapacityFeasibilityService.assessBatch('CANDLE', 10);
    expect(capacityPlan(result)).toEqual({ capacity: 0, percentage: 100, remaining: 0 });
    expect(capacityPlan({ ...result, plannedQuantity: 0 })).toEqual({ capacity: 0, percentage: 0, remaining: 0 });
    expect(capacityPlan({ ...result, feasibility: 'capacity-unresolved' })).toBeNull();
  });
});
