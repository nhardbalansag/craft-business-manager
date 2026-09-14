import { describe, expect, it } from 'vitest';
import {
  baseQuantityPerGoodPiece,
  costPerBaseUnit,
  limitingCapacity,
  plannedTotals,
  produciblePieces,
  profitPerPiece,
  sellingPrice,
  totalUnitCost,
  wasteAdjustedRequirement,
} from './costing';
import type { MoldYieldSample } from './types';

const moldSample: MoldYieldSample = {
  id: 'sample-1',
  productId: 'ART-001',
  primaryMaterialId: 'MAT-PLASTER',
  primaryBaseQuantityUsed: 800,
  goodPieces: 8,
  rejectedPieces: 1,
  recordedAt: '2026-09-14T00:00:00.000Z',
};

describe('costing primitives', () => {
  it('calculates package cost per normalized base unit', () => {
    expect(costPerBaseUnit(100, 1, 1000)).toBeCloseTo(0.1);
    expect(costPerBaseUnit(100, 0, 1000)).toBe(0);
  });

  it('learns material usage per good piece from a real mold sample', () => {
    expect(baseQuantityPerGoodPiece(moldSample)).toBe(100);
    expect(baseQuantityPerGoodPiece({ ...moldSample, goodPieces: 0 })).toBe(0);
  });

  it('applies safety waste to the material requirement', () => {
    expect(wasteAdjustedRequirement(100, 0.05)).toBeCloseTo(105);
    expect(wasteAdjustedRequirement(100, -0.5)).toBe(100);
  });

  it('estimates producible pieces using waste-adjusted requirements', () => {
    expect(produciblePieces(1000, 100, 0)).toBe(10);
    expect(produciblePieces(1000, 100, 0.05)).toBe(9);
    expect(produciblePieces(1000, 0, 0.05)).toBe(0);
  });

  it('uses the most constrained applicable capacity', () => {
    expect(limitingCapacity([null, 20, 25, 25])).toBe(20);
    expect(limitingCapacity([undefined, null])).toBeNull();
    expect(limitingCapacity([10, -2, 12])).toBe(0);
  });

  it('supports a multi-vessel candle capacity calculation without fake unlimited values', () => {
    const heartMoldCapacity = 60 / 3;
    const starMoldCapacity = 50 / 2;
    const flowerMoldCapacity = 100 / 4;

    expect(limitingCapacity([heartMoldCapacity, starMoldCapacity, flowerMoldCapacity])).toBe(20);
  });

  it('adds only non-negative unit-cost components', () => {
    expect(totalUnitCost([18, 4, 3, 12])).toBe(37);
    expect(totalUnitCost([18, -4, 3])).toBe(21);
  });

  it('calculates fixed-profit, markup, and target-margin selling prices', () => {
    expect(sellingPrice(37, { method: 'profit-amount', value: 30 })).toBe(67);
    expect(sellingPrice(100, { method: 'markup-percent', value: 0.5 })).toBe(150);
    expect(sellingPrice(100, { method: 'margin-percent', value: 0.25 })).toBeCloseTo(133.333333);
    expect(sellingPrice(100, { method: 'margin-percent', value: 1 })).toBe(0);
  });

  it('calculates profit per piece', () => {
    expect(profitPerPiece(37, 67)).toBe(30);
  });

  it('calculates planned production totals using whole sellable pieces', () => {
    expect(plannedTotals(37, 67, 10.8)).toEqual({
      quantity: 10,
      productionCost: 370,
      revenue: 670,
      profit: 300,
    });

    expect(plannedTotals(37, 67, -5)).toEqual({
      quantity: 0,
      productionCost: 0,
      revenue: 0,
      profit: 0,
    });
  });
});
