import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import { MaterialInventoryError } from '../../domain/materialInventory';
import { InMemoryMaterialRepository } from './InMemoryMaterialRepository';
import { MaterialService } from './MaterialService';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster of Paris',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 0.6,
    onHandUnit: 'kg',
    isActive: true,
    ...overrides,
  };
}

describe('MaterialService inventory validation boundary', () => {
  it('allows zero inventory as a valid material state', async () => {
    const repository = new InMemoryMaterialRepository();
    const service = new MaterialService(repository);

    const created = await service.createMaterial(material({ onHandQuantity: 0 }));
    expect(created.onHandQuantity).toBe(0);
  });

  it('rejects negative inventory before create persistence', async () => {
    const repository = new InMemoryMaterialRepository();
    const service = new MaterialService(repository);

    await expect(service.createMaterial(material({ onHandQuantity: -1 }))).rejects.toMatchObject({
      code: 'NEGATIVE_ON_HAND_QUANTITY',
    });
    expect(await service.listMaterials()).toEqual([]);
  });

  it('rejects an update that would make inventory negative', async () => {
    const repository = new InMemoryMaterialRepository([material()]);
    const service = new MaterialService(repository);

    await expect(service.updateMaterial('MAT-PLASTER', { onHandQuantity: -0.1 })).rejects.toBeInstanceOf(
      MaterialInventoryError,
    );

    expect((await service.getMaterial('MAT-PLASTER'))?.onHandQuantity).toBe(0.6);
  });
});
