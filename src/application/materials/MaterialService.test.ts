import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import { MaterialContractError } from '../../domain/materials';
import { MaterialInventoryError } from '../../domain/materialInventory';
import { InMemoryMaterialRepository } from './InMemoryMaterialRepository';
import { MaterialApplicationError, MaterialService } from './MaterialService';

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
    notes: 'Sample material',
    isActive: true,
    ...overrides,
  };
}

function service(seed: Material[] = []) {
  return new MaterialService(new InMemoryMaterialRepository(seed));
}

describe('MaterialService create/update/retrieve', () => {
  it('creates a validated material and normalizes identity text', async () => {
    const materials = service();
    const created = await materials.createMaterial(
      material({ id: '  MAT-PLASTER  ', name: '  Plaster of Paris  ', notes: '  Brand A  ' }),
    );

    expect(created.id).toBe('MAT-PLASTER');
    expect(created.name).toBe('Plaster of Paris');
    expect(created.notes).toBe('Brand A');
    expect(await materials.getMaterial('mat-plaster')).toEqual(created);
  });

  it('rejects duplicate IDs case-insensitively, including archived records', async () => {
    const materials = service([material({ isActive: false })]);

    await expect(
      materials.createMaterial(material({ id: 'mat-plaster', name: 'Different Material' })),
    ).rejects.toMatchObject({ code: 'DUPLICATE_MATERIAL_ID' });
  });

  it('rejects duplicate material names case-insensitively', async () => {
    const materials = service([material()]);

    await expect(
      materials.createMaterial(material({ id: 'MAT-002', name: 'plaster OF paris' })),
    ).rejects.toMatchObject({ code: 'DUPLICATE_MATERIAL_NAME' });
  });

  it('runs domain contract validation before persistence', async () => {
    const materials = service();

    await expect(
      materials.createMaterial(material({ baseUnit: 'g', purchaseUnit: 'L' })),
    ).rejects.toBeInstanceOf(MaterialContractError);

    expect(await materials.listMaterials()).toEqual([]);
  });

  it('rejects unresolved package-label on-hand units before persistence', async () => {
    const materials = service();
    const candidate = material({
      id: 'MAT-LABEL',
      name: 'Product Label',
      group: 'packaging',
      baseUnit: 'pc',
      purchaseQuantity: 1,
      purchaseUnit: 'pack',
      packageCost: 120,
      manualBaseUnitsPerPurchaseUnit: 100,
      onHandQuantity: 1,
      onHandUnit: 'box',
    });

    await expect(materials.createMaterial(candidate)).rejects.toBeInstanceOf(MaterialInventoryError);
    expect(await materials.listMaterials()).toEqual([]);
  });

  it('accepts a matching package-label on-hand unit with a known conversion', async () => {
    const materials = service();
    const candidate = material({
      id: 'MAT-LABEL',
      name: 'Product Label',
      group: 'packaging',
      baseUnit: 'pc',
      purchaseQuantity: 1,
      purchaseUnit: 'pack',
      packageCost: 120,
      manualBaseUnitsPerPurchaseUnit: 100,
      onHandQuantity: 0.5,
      onHandUnit: 'pack',
    });

    await expect(materials.createMaterial(candidate)).resolves.toEqual(candidate);
  });

  it('updates an existing material while preserving its stable ID', async () => {
    const materials = service([material()]);

    const updated = await materials.updateMaterial('mat-plaster', {
      name: 'Premium Plaster',
      group: 'plaster',
      purchaseQuantity: 2,
      packageCost: 120,
    });

    expect(updated.id).toBe('MAT-PLASTER');
    expect(updated.name).toBe('Premium Plaster');
    expect(updated.purchaseQuantity).toBe(2);
    expect(updated.packageCost).toBe(120);
    expect(await materials.getMaterial('MAT-PLASTER')).toEqual(updated);
  });

  it('prevents an update from taking another material name', async () => {
    const materials = service([
      material(),
      material({
        id: 'MAT-WAX',
        name: 'Soy Wax',
        group: 'wax',
        purchaseUnit: 'kg',
        packageCost: 180,
      }),
    ]);

    await expect(materials.updateMaterial('MAT-WAX', { name: ' plaster of paris ' })).rejects.toMatchObject({
      code: 'DUPLICATE_MATERIAL_NAME',
    });
  });

  it('throws a controlled application error when updating a missing material', async () => {
    const materials = service();

    try {
      await materials.updateMaterial('MAT-MISSING', { name: 'Missing' });
      throw new Error('Expected update to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialApplicationError);
      expect((error as MaterialApplicationError).code).toBe('MATERIAL_NOT_FOUND');
    }
  });

  it('returns null when retrieving a material that does not exist', async () => {
    expect(await service().getMaterial('MAT-MISSING')).toBeNull();
  });
});

describe('MaterialService listing/filtering/archive', () => {
  const seed = [
    material({ id: 'MAT-PLASTER', name: 'Plaster of Paris', group: 'plaster', isActive: true }),
    material({
      id: 'MAT-WAX',
      name: 'Soy Wax',
      group: 'wax',
      purchaseUnit: 'kg',
      packageCost: 180,
      notes: 'Candle wax pellets',
      isActive: true,
    }),
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
      isActive: false,
    }),
  ];

  it('lists materials alphabetically by name', async () => {
    const listed = await service(seed).listMaterials();
    expect(listed.map(({ name }) => name)).toEqual(['Cotton Wick', 'Plaster of Paris', 'Soy Wax']);
  });

  it('filters by material group and active state', async () => {
    const materials = service(seed);

    expect((await materials.listMaterials({ group: 'wax' })).map(({ id }) => id)).toEqual(['MAT-WAX']);
    expect((await materials.listMaterials({ active: false })).map(({ id }) => id)).toEqual(['MAT-WICK']);
    expect((await materials.listMaterials({ active: true })).map(({ id }) => id)).toEqual([
      'MAT-PLASTER',
      'MAT-WAX',
    ]);
  });

  it('searches ID, name, and notes case-insensitively', async () => {
    const materials = service(seed);

    expect((await materials.listMaterials({ query: 'wax' })).map(({ id }) => id)).toEqual(['MAT-WAX']);
    expect((await materials.listMaterials({ query: 'PELLETS' })).map(({ id }) => id)).toEqual(['MAT-WAX']);
    expect((await materials.listMaterials({ query: 'mat-wick' })).map(({ id }) => id)).toEqual(['MAT-WICK']);
  });

  it('archives instead of deleting and archive is idempotent', async () => {
    const materials = service(seed);

    const archived = await materials.archiveMaterial('MAT-WAX');
    expect(archived.isActive).toBe(false);

    const archivedAgain = await materials.archiveMaterial('mat-wax');
    expect(archivedAgain).toEqual(archived);
    expect((await materials.listMaterials({ active: false })).map(({ id }) => id)).toEqual([
      'MAT-WICK',
      'MAT-WAX',
    ]);
  });

  it('does not expose repository objects for external mutation', async () => {
    const materials = service(seed);
    const fetched = await materials.getMaterial('MAT-PLASTER');
    expect(fetched).not.toBeNull();

    if (fetched) fetched.name = 'Mutated Outside Service';

    expect((await materials.getMaterial('MAT-PLASTER'))?.name).toBe('Plaster of Paris');
  });
});
