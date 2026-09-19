import { describe, expect, it } from 'vitest';
import type { Material } from '../domain/materials';
import type { MixPreset } from '../domain/mixPresets';
import type { Product } from '../domain/products';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from './mixPresets/InMemoryMixPresetRepository';
import { MixPresetApplicationError, MixPresetService } from './mixPresets/MixPresetService';
import { InMemoryProductRepository } from './products/InMemoryProductRepository';
import { ProductApplicationError, ProductService } from './products/ProductService';

function material(id: string, overrides: Partial<Material> = {}): Material {
  return {
    id,
    name: id,
    group: id.toLowerCase().includes('water') ? 'liquid' : id.toLowerCase().includes('wax') ? 'wax' : 'plaster',
    baseUnit: id.toLowerCase().includes('water') ? 'mL' : 'g',
    purchaseQuantity: 1,
    purchaseUnit: id.toLowerCase().includes('water') ? 'L' : 'kg',
    packageCost: 100,
    onHandQuantity: 1,
    onHandUnit: id.toLowerCase().includes('water') ? 'L' : 'kg',
    isActive: true,
    ...overrides,
  };
}

function preset(overrides: Partial<MixPreset> = {}): MixPreset {
  return {
    id: 'MIX-PLASTER-2-1',
    name: 'Plaster 2:1',
    compatibleCategories: ['paintable-art', 'candle-pot'],
    basis: 'volume',
    lines: [
      { materialId: 'MAT-PLASTER', role: 'primary', parts: 2 },
      { materialId: 'MAT-WATER', role: 'secondary', parts: 1 },
    ],
    isActive: true,
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'ART-001',
    name: 'Paintable Star',
    category: 'paintable-art',
    mixPresetId: 'MIX-PLASTER-2-1',
    safetyWasteRate: 0.05,
    isActive: true,
    ...overrides,
  };
}

function setup() {
  const materialRepository = new InMemoryMaterialRepository([
    material('MAT-PLASTER'),
    material('MAT-WATER'),
    material('MAT-WAX'),
  ]);
  const mixPresetRepository = new InMemoryMixPresetRepository();
  const productRepository = new InMemoryProductRepository();
  const productService = new ProductService(productRepository, mixPresetRepository);
  const mixPresetService = new MixPresetService(
    mixPresetRepository,
    materialRepository,
    productRepository,
  );
  return {
    materialRepository,
    mixPresetRepository,
    productRepository,
    productService,
    mixPresetService,
  };
}

async function expectProductError(promise: Promise<unknown>, code: ProductApplicationError['code']) {
  try {
    await promise;
    throw new Error('Expected ProductApplicationError.');
  } catch (error) {
    expect(error).toBeInstanceOf(ProductApplicationError);
    expect((error as ProductApplicationError).code).toBe(code);
  }
}

async function expectMixError(promise: Promise<unknown>, code: MixPresetApplicationError['code']) {
  try {
    await promise;
    throw new Error('Expected MixPresetApplicationError.');
  } catch (error) {
    expect(error).toBeInstanceOf(MixPresetApplicationError);
    expect((error as MixPresetApplicationError).code).toBe(code);
  }
}

describe('Phase 2.1C repositories', () => {
  it('returns defensive product clones', async () => {
    const repository = new InMemoryProductRepository([product({ mixPresetId: undefined })]);
    const first = await repository.findById('art-001');
    expect(first).not.toBeNull();
    first!.name = 'Mutated';
    expect((await repository.findById('ART-001'))?.name).toBe('Paintable Star');
  });

  it('deep-clones nested mix arrays', async () => {
    const repository = new InMemoryMixPresetRepository([preset()]);
    const first = await repository.findById('mix-plaster-2-1');
    expect(first).not.toBeNull();
    first!.lines[0].parts = 999;
    first!.compatibleCategories.push('candle');
    const stored = await repository.findById('MIX-PLASTER-2-1');
    expect(stored?.lines[0].parts).toBe(2);
    expect(stored?.compatibleCategories).toEqual(['paintable-art', 'candle-pot']);
  });
});

describe('ProductService', () => {
  it('creates, normalizes, retrieves, lists, filters, searches, updates and archives products', async () => {
    const { mixPresetService, productService } = setup();
    await mixPresetService.createMixPreset(preset());
    const created = await productService.createProduct(
      product({ id: ' ART-001 ', name: ' Paintable Star ', notes: '  demo  ' }),
    );
    expect(created).toMatchObject({ id: 'ART-001', name: 'Paintable Star', notes: 'demo' });

    await productService.createProduct(
      product({ id: 'POT-001', name: 'Candle Pot', category: 'candle-pot' }),
    );
    expect((await productService.listProducts({ category: 'paintable-art' })).map((item) => item.id)).toEqual([
      'ART-001',
    ]);
    expect((await productService.listProducts({ query: 'plaster-2-1' })).length).toBe(2);

    const updated = await productService.updateProduct('art-001', { name: 'Paintable Moon' });
    expect(updated.name).toBe('Paintable Moon');
    const archived = await productService.archiveProduct('ART-001');
    expect(archived.isActive).toBe(false);
    expect((await productService.listProducts({ active: false })).map((item) => item.id)).toContain('ART-001');
  });

  it('reserves product IDs and names case-insensitively, including archived records', async () => {
    const { mixPresetService, productService } = setup();
    await mixPresetService.createMixPreset(preset());
    await productService.createProduct(product());
    await productService.archiveProduct('ART-001');
    await expectProductError(
      productService.createProduct(product({ id: 'art-001', name: 'Other name' })),
      'DUPLICATE_PRODUCT_ID',
    );
    await expectProductError(
      productService.createProduct(product({ id: 'ART-002', name: 'paintable star' })),
      'DUPLICATE_PRODUCT_NAME',
    );
  });

  it('validates product-to-mix existence, activity, and category compatibility', async () => {
    const { mixPresetRepository, productService } = setup();
    await expectProductError(productService.createProduct(product()), 'MIX_PRESET_NOT_FOUND');

    await mixPresetRepository.insert(preset({ isActive: false }));
    await expectProductError(productService.createProduct(product()), 'MIX_PRESET_INACTIVE');

    await mixPresetRepository.replace(
      preset({ isActive: true, compatibleCategories: ['candle'] }),
    );
    await expectProductError(productService.createProduct(product()), 'MIX_PRESET_CATEGORY_MISMATCH');

    await mixPresetRepository.replace(preset({ isActive: false }));
    await expect(productService.createProduct(product({ isActive: false }))).resolves.toMatchObject({
      isActive: false,
    });
  });
});

describe('MixPresetService', () => {
  it('creates, retrieves, lists, filters, searches and archives valid presets', async () => {
    const { mixPresetService } = setup();
    const created = await mixPresetService.createMixPreset(
      preset({ id: ' MIX-A ', name: ' Plaster Standard ', notes: '  production  ' }),
    );
    expect(created).toMatchObject({ id: 'MIX-A', name: 'Plaster Standard', notes: 'production' });

    await mixPresetService.createMixPreset(
      preset({
        id: 'MIX-WAX',
        name: 'Wax only',
        compatibleCategories: ['candle'],
        basis: 'weight',
        lines: [{ materialId: 'MAT-WAX', role: 'primary', parts: 100 }],
      }),
    );
    expect((await mixPresetService.listMixPresets({ basis: 'weight' })).map((item) => item.id)).toEqual([
      'MIX-WAX',
    ]);
    expect((await mixPresetService.listMixPresets({ category: 'paintable-art' })).map((item) => item.id)).toEqual([
      'MIX-A',
    ]);
    expect((await mixPresetService.listMixPresets({ query: 'mat-water' })).map((item) => item.id)).toEqual([
      'MIX-A',
    ]);

    const archived = await mixPresetService.archiveMixPreset('mix-wax');
    expect(archived.isActive).toBe(false);
  });

  it('validates referenced material existence and active state', async () => {
    const { materialRepository, mixPresetService } = setup();
    await expectMixError(
      mixPresetService.createMixPreset(
        preset({ lines: [{ materialId: 'MISSING', role: 'primary', parts: 1 }] }),
      ),
      'MATERIAL_NOT_FOUND',
    );

    const water = await materialRepository.findById('MAT-WATER');
    await materialRepository.replace({ ...water!, isActive: false });
    await expectMixError(mixPresetService.createMixPreset(preset()), 'MATERIAL_INACTIVE');
    await expect(
      mixPresetService.createMixPreset(preset({ id: 'MIX-HISTORY', name: 'Historical', isActive: false })),
    ).resolves.toMatchObject({ isActive: false });
  });

  it('reserves mix IDs and names case-insensitively, including archived records', async () => {
    const { mixPresetService } = setup();
    await mixPresetService.createMixPreset(preset());
    await mixPresetService.archiveMixPreset('MIX-PLASTER-2-1');
    await expectMixError(
      mixPresetService.createMixPreset(preset({ id: 'mix-plaster-2-1', name: 'Other' })),
      'DUPLICATE_MIX_PRESET_ID',
    );
    await expectMixError(
      mixPresetService.createMixPreset(preset({ id: 'MIX-OTHER', name: 'plaster 2:1' })),
      'DUPLICATE_MIX_PRESET_NAME',
    );
  });

  it('prevents archiving or making a mix incompatible while an active product depends on it', async () => {
    const { mixPresetService, productService } = setup();
    await mixPresetService.createMixPreset(preset());
    await productService.createProduct(product());

    await expectMixError(
      mixPresetService.archiveMixPreset('MIX-PLASTER-2-1'),
      'ACTIVE_PRODUCT_DEPENDENCY',
    );
    await expectMixError(
      mixPresetService.updateMixPreset('MIX-PLASTER-2-1', { compatibleCategories: ['candle-pot'] }),
      'ACTIVE_PRODUCT_DEPENDENCY',
    );

    await productService.archiveProduct('ART-001');
    await expect(mixPresetService.archiveMixPreset('MIX-PLASTER-2-1')).resolves.toMatchObject({
      isActive: false,
    });
  });
});
