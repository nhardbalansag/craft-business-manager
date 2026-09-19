import { describe, expect, it } from 'vitest';
import type { Material } from './materials';
import {
  MATERIAL_GROUPS,
  MATERIAL_PACKAGE_UNITS,
  MaterialContractError,
  isMaterialCupWeightBridge,
  isMaterialGroup,
  isMaterialPackageUnit,
  isMaterialPurchaseUnit,
  parseMaterialGroup,
  parseMaterialPurchaseUnit,
  validateMaterialContract,
} from './materials';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster of Paris',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 0.5,
    onHandUnit: 'kg',
    notes: 'Example material',
    isActive: true,
    ...overrides,
  };
}

describe('material classification', () => {
  it('defines the complete material group taxonomy', () => {
    expect(MATERIAL_GROUPS).toEqual([
      'plaster',
      'wax',
      'liquid',
      'fragrance',
      'colorant',
      'wick',
      'container',
      'paint',
      'packaging',
      'accessory',
      'other',
    ]);
  });

  it('recognizes supported material groups at runtime', () => {
    for (const group of MATERIAL_GROUPS) {
      expect(isMaterialGroup(group)).toBe(true);
      expect(parseMaterialGroup(group)).toBe(group);
    }

    expect(isMaterialGroup('food')).toBe(false);
    expect(isMaterialGroup(null)).toBe(false);
    expect(() => parseMaterialGroup('food')).toThrow(MaterialContractError);
  });

  it('defines reusable package labels separately from measurement units', () => {
    expect(MATERIAL_PACKAGE_UNITS).toContain('bag');
    expect(MATERIAL_PACKAGE_UNITS).toContain('box');
    expect(MATERIAL_PACKAGE_UNITS).toContain('pack');
    expect(MATERIAL_PACKAGE_UNITS).toContain('bottle');

    expect(isMaterialPackageUnit('box')).toBe(true);
    expect(isMaterialPackageUnit('kg')).toBe(false);
  });

  it('accepts both standard measurement units and package labels as purchase units', () => {
    expect(isMaterialPurchaseUnit('kg')).toBe(true);
    expect(isMaterialPurchaseUnit('pc')).toBe(true);
    expect(isMaterialPurchaseUnit('box')).toBe(true);
    expect(isMaterialPurchaseUnit('pack')).toBe(true);
    expect(isMaterialPurchaseUnit('crate')).toBe(false);

    expect(parseMaterialPurchaseUnit('kg')).toBe('kg');
    expect(parseMaterialPurchaseUnit('box')).toBe('box');
    expect(() => parseMaterialPurchaseUnit('crate')).toThrow(MaterialContractError);
  });

  it('recognizes only cup -> gram as the material-specific cross-dimension bridge', () => {
    expect(isMaterialCupWeightBridge('cup', 'g')).toBe(true);
    expect(isMaterialCupWeightBridge('mL', 'g')).toBe(false);
    expect(isMaterialCupWeightBridge('cup', 'mL')).toBe(false);
    expect(isMaterialCupWeightBridge('kg', 'g')).toBe(false);
  });
});

describe('material contract validation', () => {
  it('accepts a weight-based plaster material using standard units', () => {
    expect(() => validateMaterialContract(material())).not.toThrow();
  });

  it('accepts count-based materials', () => {
    expect(() =>
      validateMaterialContract(
        material({
          id: 'MAT-WICK',
          name: 'Cotton Wick',
          group: 'wick',
          baseUnit: 'pc',
          purchaseQuantity: 100,
          purchaseUnit: 'pc',
          packageCost: 80,
          onHandQuantity: 40,
          onHandUnit: 'pc',
        }),
      ),
    ).not.toThrow();
  });

  it('accepts non-standard package labels as source input without inventing a conversion', () => {
    expect(() =>
      validateMaterialContract(
        material({
          id: 'MAT-LABEL',
          name: 'Product Label',
          group: 'packaging',
          baseUnit: 'pc',
          purchaseQuantity: 1,
          purchaseUnit: 'pack',
          packageCost: 120,
          manualBaseUnitsPerPurchaseUnit: 100,
          onHandQuantity: 1,
          onHandUnit: 'pack',
        }),
      ),
    ).not.toThrow();
  });

  it('allows cup source input for gram-based materials so Phase 1.4 can resolve it', () => {
    expect(() =>
      validateMaterialContract(
        material({
          baseUnit: 'g',
          purchaseUnit: 'cup',
          onHandUnit: 'cup',
        }),
      ),
    ).not.toThrow();
  });

  it('requires stable non-empty material identity fields', () => {
    for (const candidate of [material({ id: '   ' }), material({ name: '   ' })]) {
      expect(() => validateMaterialContract(candidate)).toThrow(MaterialContractError);
    }
  });

  it('still rejects every other standard-unit cross-dimension conflict', () => {
    try {
      validateMaterialContract(material({ baseUnit: 'g', purchaseUnit: 'L' }));
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialContractError);
      expect((error as MaterialContractError).code).toBe('INCOMPATIBLE_STANDARD_UNIT');
    }

    expect(() => validateMaterialContract(material({ baseUnit: 'g', onHandUnit: 'mL' }))).toThrow(
      MaterialContractError,
    );
    expect(() => validateMaterialContract(material({ baseUnit: 'pc', onHandUnit: 'cup' }))).toThrow(
      MaterialContractError,
    );
  });

  it('does not treat package labels as universal measurement conversions', () => {
    const candidate = material({
      baseUnit: 'pc',
      purchaseUnit: 'box',
      manualBaseUnitsPerPurchaseUnit: undefined,
      onHandUnit: 'box',
    });

    expect(() => validateMaterialContract(candidate)).not.toThrow();
  });

  it('does not persist derived normalized/costing/calibration values in the contract', () => {
    const candidate = material();
    expect(candidate).not.toHaveProperty('baseUnitsPerPurchaseUnit');
    expect(candidate).not.toHaveProperty('onHandBaseQuantity');
    expect(candidate).not.toHaveProperty('gramsPerCup');
  });
});
