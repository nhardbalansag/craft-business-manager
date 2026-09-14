import { describe, expect, it } from 'vitest';
import { MaterialSourceContractError } from '../../domain/materialSource';
import type { Material } from '../../domain/materials';
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
    onHandQuantity: 0.5,
    onHandUnit: 'kg',
    isActive: true,
    ...overrides,
  };
}

describe('MaterialService supplier/source metadata', () => {
  it('normalizes and persists lightweight source metadata with the material', async () => {
    const service = new MaterialService(new InMemoryMaterialRepository());

    const created = await service.createMaterial(
      material({
        source: {
          vendorName: '  Divisoria Craft Supply  ',
          source: '  168 Mall branch  ',
          purchaseLink: ' https://example.com/plaster ',
          contactNumber: ' 0917 555 0101 ',
          socialPage: ' @divisoriacrafts ',
          notes: '  Ask for wholesale price  ',
        },
      }),
    );

    expect(created.source).toEqual({
      vendorName: 'Divisoria Craft Supply',
      source: '168 Mall branch',
      purchaseLink: 'https://example.com/plaster',
      contactNumber: '0917 555 0101',
      socialPage: '@divisoriacrafts',
      notes: 'Ask for wholesale price',
    });
  });

  it('drops an all-blank source object instead of persisting meaningless metadata', async () => {
    const service = new MaterialService(new InMemoryMaterialRepository());
    const created = await service.createMaterial(material({ source: { vendorName: ' ', notes: '' } }));
    expect(created.source).toBeUndefined();
  });

  it('rejects an invalid purchase link before persistence', async () => {
    const service = new MaterialService(new InMemoryMaterialRepository());

    await expect(
      service.createMaterial(material({ source: { vendorName: 'Seller', purchaseLink: 'javascript:alert(1)' } })),
    ).rejects.toBeInstanceOf(MaterialSourceContractError);

    expect(await service.listMaterials()).toEqual([]);
  });

  it('includes supplier/source details in existing material search', async () => {
    const service = new MaterialService(
      new InMemoryMaterialRepository([
        material({
          source: {
            vendorName: 'Divisoria Craft Supply',
            source: '168 Mall',
            socialPage: '@divisoriacrafts',
          },
        }),
      ]),
    );

    expect((await service.listMaterials({ query: 'divisoria' })).map(({ id }) => id)).toEqual(['MAT-PLASTER']);
    expect((await service.listMaterials({ query: '168 mall' })).map(({ id }) => id)).toEqual(['MAT-PLASTER']);
    expect((await service.listMaterials({ query: '@DIVISORIACRAFTS' })).map(({ id }) => id)).toEqual(['MAT-PLASTER']);
  });

  it('does not expose nested source metadata for external mutation', async () => {
    const service = new MaterialService(
      new InMemoryMaterialRepository([
        material({ source: { vendorName: 'Original Supplier', contactNumber: '0917' } }),
      ]),
    );

    const fetched = await service.getMaterial('MAT-PLASTER');
    expect(fetched?.source?.vendorName).toBe('Original Supplier');

    if (fetched?.source) fetched.source.vendorName = 'Mutated Outside Service';

    expect((await service.getMaterial('MAT-PLASTER'))?.source?.vendorName).toBe('Original Supplier');
  });
});
