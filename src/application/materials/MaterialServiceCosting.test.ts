import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import { MaterialCostingError } from '../../domain/materialCosting';
import { InMemoryMaterialRepository } from './InMemoryMaterialRepository';
import { MaterialService } from './MaterialService';

function material(overrides: Partial<Material> = {}): Material {
  return {
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
    isActive: true,
    ...overrides,
  };
}

describe('MaterialService package costing boundary', () => {
  it('persists a package-label material when a valid manual conversion exists', async () => {
    const service = new MaterialService(new InMemoryMaterialRepository());
    const created = await service.createMaterial(material());

    expect(created.manualBaseUnitsPerPurchaseUnit).toBe(100);
    expect(await service.getMaterial('MAT-LABEL')).toEqual(created);
  });

  it('rejects a package-label material when its conversion is missing', async () => {
    const service = new MaterialService(new InMemoryMaterialRepository());

    await expect(
      service.createMaterial(material({ manualBaseUnitsPerPurchaseUnit: undefined })),
    ).rejects.toMatchObject({ code: 'MISSING_PACKAGE_CONVERSION' });
  });

  it('rejects zero purchase quantity before persistence', async () => {
    const service = new MaterialService(new InMemoryMaterialRepository());

    await expect(service.createMaterial(material({ purchaseQuantity: 0 }))).rejects.toBeInstanceOf(
      MaterialCostingError,
    );
    expect(await service.listMaterials()).toEqual([]);
  });

  it('accepts a manual override on a standard unit purchase', async () => {
    const service = new MaterialService(new InMemoryMaterialRepository());

    const created = await service.createMaterial(
      material({
        id: 'MAT-PLASTER',
        name: 'Plaster of Paris',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 95,
        manualBaseUnitsPerPurchaseUnit: 950,
        onHandUnit: 'g',
      }),
    );

    expect(created.manualBaseUnitsPerPurchaseUnit).toBe(950);
  });
});
