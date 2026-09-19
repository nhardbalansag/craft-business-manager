import { describe, expect, it } from 'vitest';
import { PricingError } from './pricing';
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

describe('costing primitives', () => {
  it('calculates package cost per normalized base unit', () => {
    expect(costPerBaseUnit(100, 1, 1000)).toBeCloseTo(0.1);
    expect(costPerBaseUnit(100, 0, 1000)).toBe(0);
  });

  it('calculates canonical material usage per good piece once batch normalization is known', () => {
    expect(baseQuantityPerGoodPiece(800, 8)).toBe(100);
    expect(baseQuantityPerGoodPiece(800, 0)).toBe(0);
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

  it('delegates fixed-profit, markup, and target-margin prices to the Phase 4 engine', () => {
    expect(sellingPrice(37, { method: 'profit-amount', value: 30 })).toBe(67);
    expect(sellingPrice(100, { method: 'markup-percent', value: 0.5 })).toBe(150);
    expect(sellingPrice(100, { method: 'margin-percent', value: 0.25 })).toBeCloseTo(133.333333);
  });

  it('fails closed for an invalid target margin instead of returning fake zero', () => {
    expect(() => sellingPrice(100, { method: 'margin-percent', value: 1 })).toThrow(PricingError);
  });

  it('fails closed for a negative legacy pricing value instead of clamping it', () => {
    expect(() => sellingPrice(100, { method: 'markup-percent', value: -0.25 })).toThrow(
      PricingError,
    );
  });

  it('delegates profit per piece to validated Phase 4 unit-profit behavior', () => {
    expect(profitPerPiece(37, 67)).toBe(30);
    expect(() => profitPerPiece(-1, 10)).toThrow(PricingError);
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
