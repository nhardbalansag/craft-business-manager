import { describe, expect, it } from 'vitest';
import type { MaterialCalibrationEvidence } from './materialCalibration';
import type { Material } from './materials';
import {
  deriveFixedRecipeItemRequirement,
  FixedRecipeItemError,
  type FixedRecipeItem,
  validateFixedRecipeItemContract,
} from './fixedRecipeItems';

const wax: Material = {
  id: 'MAT-WAX',
  name: 'Soy Wax',
  group: 'wax',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 200,
  onHandQuantity: 1,
  onHandUnit: 'kg',
  isActive: true,
};

const plaster: Material = {
  id: 'MAT-PLASTER',
  name: 'Casting Plaster',
  group: 'plaster',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 66,
  onHandQuantity: 1,
  onHandUnit: 'kg',
  isActive: true,
};

const vessel: Material = {
  id: 'MAT-GLASS',
  name: 'Glass Vessel',
  group: 'container',
  baseUnit: 'pc',
  purchaseQuantity: 12,
  purchaseUnit: 'pc',
  packageCost: 240,
  onHandQuantity: 12,
  onHandUnit: 'pc',
  isActive: true,
};

const baseItem: FixedRecipeItem = {
  id: 'RI-001',
  productId: 'CND-001',
  materialId: 'MAT-WAX',
  quantityPerProduct: 250,
  unit: 'g',
  role: 'consumable',
};

const plasterCalibration: MaterialCalibrationEvidence = {
  id: 'CAL-PLASTER-1',
  materialId: 'MAT-PLASTER',
  measuredVolume: 5,
  volumeUnit: 'cup',
  knownWeight: 1000,
  weightUnit: 'g',
  recordedAt: '2026-09-14T08:00:00.000Z',
};

describe('fixed recipe item contract', () => {
  it('accepts authoritative source fields without derived values', () => {
    expect(() => validateFixedRecipeItemContract(baseItem)).not.toThrow();
  });

  it('rejects zero/non-finite quantities and unsupported roles/units', () => {
    expect(() => validateFixedRecipeItemContract({ ...baseItem, quantityPerProduct: 0 })).toThrowError(
      expect.objectContaining<Partial<FixedRecipeItemError>>({ code: 'NON_POSITIVE_QUANTITY' }),
    );
    expect(() => validateFixedRecipeItemContract({ ...baseItem, quantityPerProduct: Number.NaN })).toThrowError(
      expect.objectContaining<Partial<FixedRecipeItemError>>({ code: 'NON_FINITE_QUANTITY' }),
    );
    expect(() => validateFixedRecipeItemContract({ ...baseItem, role: 'vessel' as FixedRecipeItem['role'] })).toThrowError(
      expect.objectContaining<Partial<FixedRecipeItemError>>({ code: 'INVALID_ROLE' }),
    );
    expect(() => validateFixedRecipeItemContract({ ...baseItem, unit: 'pack' as FixedRecipeItem['unit'] })).toThrowError(
      expect.objectContaining<Partial<FixedRecipeItemError>>({ code: 'INVALID_UNIT' }),
    );
  });

  it('normalizes fixed recipe quantities using standard Phase 1 conversion', () => {
    const result = deriveFixedRecipeItemRequirement(
      { ...baseItem, quantityPerProduct: 0.25, unit: 'kg' },
      wax,
    );

    expect(result.baseUnit).toBe('g');
    expect(result.baseQuantityPerProduct).toBe(250);
    expect(result.conversionSource).toBe('standard');
    expect(result.sourceQuantity).toBe(0.25);
    expect(result.sourceUnit).toBe('kg');
  });

  it('uses material-specific cup calibration for a fixed plaster quantity', () => {
    const result = deriveFixedRecipeItemRequirement(
      {
        id: 'RI-PLASTER',
        productId: 'ART-001',
        materialId: 'MAT-PLASTER',
        quantityPerProduct: 0.5,
        unit: 'cup',
        role: 'consumable',
      },
      plaster,
      [plasterCalibration],
    );

    expect(result.baseQuantityPerProduct).toBe(100);
    expect(result.conversionSource).toBe('calibration');
    expect(result.calibrationId).toBe('CAL-PLASTER-1');
  });

  it('rejects purchased vessel/container materials because they belong to Phase 3', () => {
    expect(() =>
      deriveFixedRecipeItemRequirement(
        {
          id: 'RI-VESSEL',
          productId: 'CND-001',
          materialId: 'MAT-GLASS',
          quantityPerProduct: 1,
          unit: 'pc',
          role: 'other',
        },
        vessel,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<FixedRecipeItemError>>({
        code: 'PHASE3_COMPONENT_MATERIAL',
      }),
    );
  });
});
