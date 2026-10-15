import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import { estimateEssentialOil } from './scentedCandleOil';

const material = (group: Material['group'], overrides: Partial<Material> = {}): Material => ({
  id: group, name: group, group, baseUnit: 'g', purchaseQuantity: 1, purchaseUnit: 'kg',
  packageCost: 100, onHandQuantity: 1, onHandUnit: 'kg', isActive: true, ...overrides,
});
describe('essential oil percentage on wax weight', () => {
  const wax = material('wax', { essentialOilPercent: 6 });
  const oil = material('fragrance', { packageCost: 500 });

  it('calculates essential oil on wax (not mixture) and estimated costs', () => {
    expect(estimateEssentialOil(wax, 200, 'g', oil)).toEqual({
      waxGrams: 200, percentage: 6, oilGrams: 12, totalGrams: 212,
      estimatedMaterialCost: 26,
    });
    expect(estimateEssentialOil(wax, 0.2, 'kg', oil)?.oilGrams).toBeCloseTo(12);
  });
  it('does not guess a rate or density or compute non-finite amounts', () => {
    expect(estimateEssentialOil(material('wax'), 200, 'g', oil)).toBeNull();
    expect(estimateEssentialOil(wax, 100, 'mL', oil)).toBeNull();
    expect(estimateEssentialOil(wax, -50, 'g', oil)).toBeNull();
    expect(estimateEssentialOil(wax, Number.POSITIVE_INFINITY, 'g', oil)).toBeNull();
  });
  it('does not invent missing oil purchase costs', () => {
    expect(estimateEssentialOil(wax, 200, 'g', null)?.estimatedMaterialCost).toBeNull();
    expect(estimateEssentialOil(wax, 200, 'g', material('fragrance', { purchaseQuantity: 0 }))?.estimatedMaterialCost).toBeNull();
    expect(estimateEssentialOil(material('wax', { essentialOilPercent: 0 }), 200, 'g', oil)?.oilGrams).toBe(0);
  });
});
