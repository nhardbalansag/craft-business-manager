import { describe, expect, it } from 'vitest';
import {
  ProductPriceTierError,
  type ProductPriceTier,
} from '../../domain/productPriceTiers';
import type { Product } from '../../domain/products';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductPriceTierRepository } from './InMemoryProductPriceTierRepository';
import {
  ProductPriceTierApplicationError,
  ProductPriceTierService,
  type ProductPriceTierCreate,
} from './ProductPriceTierService';

function product(id: string, isActive = true): Product {
  return {
    id,
    name: `Product ${id}`,
    category: 'candle',
    safetyWasteRate: 0,
    isActive,
  };
}

function tier(overrides: Partial<ProductPriceTier> = {}): ProductPriceTier {
  return {
    id: 'TIER-0001',
    productId: 'PROD-A',
    name: 'Bulk 20+',
    kind: 'bulk',
    priceBasis: 'per-unit',
    priceAmount: 40,
    unitsPerOffer: 1,
    minimumOrderQuantity: 20,
    additionalCostPerOffer: 0,
    isActive: true,
    ...overrides,
  };
}

function createInput(overrides: Partial<ProductPriceTierCreate> = {}): ProductPriceTierCreate {
  const { id: _id, ...input } = tier();
  return { ...input, ...overrides };
}

function setup(products: Product[] = [], tiers: ProductPriceTier[] = []) {
  const productRepository = new InMemoryProductRepository(products);
  const tierRepository = new InMemoryProductPriceTierRepository(tiers);
  const tierService = new ProductPriceTierService(tierRepository, productRepository);

  return { productRepository, tierRepository, tierService };
}

describe('ProductPriceTierService', () => {
  it('creates a normalized tier with the next global TIER identifier and canonical Product identity', async () => {
    const { tierService } = setup(
      [product('Prod-A')],
      [
        tier({ id: 'TIER-0009', productId: 'Prod-A' }),
        tier({ id: 'WHOLESALE-OLD', productId: 'Prod-A', name: 'Legacy wholesale' }),
      ],
    );

    const created = await tierService.createTier(
      createInput({
        productId: '  prod-a  ',
        name: '  Event package  ',
        notes: '  gift box included  ',
      }),
    );

    expect(created).toMatchObject({
      id: 'TIER-0010',
      productId: 'Prod-A',
      name: 'Event package',
      notes: 'gift box included',
    });
  });

  it('allocates tier IDs globally across Products while ignoring custom identifiers', async () => {
    const { tierService } = setup(
      [product('PROD-A'), product('PROD-B')],
      [
        tier({ id: 'tier-0042', productId: 'PROD-A' }),
        tier({ id: 'TIER-EVENT-VIP', productId: 'PROD-B' }),
      ],
    );

    const created = await tierService.createTier(
      createInput({ productId: 'PROD-B', name: 'Bulk 50+', minimumOrderQuantity: 50 }),
    );

    expect(created.id).toBe('TIER-0043');
  });

  it('rejects normal creation for missing or archived Products', async () => {
    const missing = setup();
    await expect(
      missing.tierService.createTier(createInput({ productId: 'missing' })),
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      productId: 'missing',
    });

    const archived = setup([product('archived', false)]);
    await expect(
      archived.tierService.createTier(createInput({ productId: 'archived' })),
    ).rejects.toMatchObject({
      code: 'PRODUCT_INACTIVE',
      productId: 'archived',
    });
  });

  it('enforces the ProductPriceTier domain contract on create and update writes', async () => {
    const { tierService } = setup([product('PROD-A')]);

    await expect(
      tierService.createTier(createInput({ priceAmount: -1 })),
    ).rejects.toBeInstanceOf(ProductPriceTierError);

    const created = await tierService.createTier(createInput());
    await expect(
      tierService.updateTier(created.id, { minimumOrderQuantity: 0 }),
    ).rejects.toBeInstanceOf(ProductPriceTierError);
  });

  it('keeps seeded legacy/custom and archived-Product tier history loadable', async () => {
    const historical = tier({
      id: 'WHOLESALE-OLD',
      productId: 'ARCHIVED',
      name: 'Historical wholesale',
      isActive: false,
    });
    const { tierService } = setup([product('ARCHIVED', false)], [historical]);

    expect(await tierService.getTier(' wholesale-old ')).toEqual(historical);
    expect(await tierService.listTiersByProduct(' archived ')).toEqual([historical]);
  });

  it('updates tier source data, canonicalizes a changed Product relationship, and keeps the tier ID stable', async () => {
    const { tierService } = setup(
      [product('PROD-A'), product('Product-B')],
      [tier({ id: 'TIER-0012', productId: 'PROD-A' })],
    );

    const updated = await tierService.updateTier('tier-0012', {
      productId: ' product-b ',
      name: '  Package 6  ',
      kind: 'package',
      priceBasis: 'per-offer',
      priceAmount: 270,
      unitsPerOffer: 6,
      minimumOrderQuantity: 6,
      additionalCostPerOffer: 20,
      notes: '  box included  ',
    });

    expect(updated).toEqual(
      tier({
        id: 'TIER-0012',
        productId: 'Product-B',
        name: 'Package 6',
        kind: 'package',
        priceBasis: 'per-offer',
        priceAmount: 270,
        unitsPerOffer: 6,
        minimumOrderQuantity: 6,
        additionalCostPerOffer: 20,
        notes: 'box included',
      }),
    );
  });

  it('rejects moving a tier to a missing or archived Product', async () => {
    const missingTarget = setup(
      [product('PROD-A')],
      [tier({ id: 'TIER-0005', productId: 'PROD-A' })],
    );
    await expect(
      missingTarget.tierService.updateTier('TIER-0005', { productId: 'missing' }),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', productId: 'missing' });

    const archivedTarget = setup(
      [product('PROD-A'), product('ARCHIVED', false)],
      [tier({ id: 'TIER-0005', productId: 'PROD-A' })],
    );
    await expect(
      archivedTarget.tierService.updateTier('TIER-0005', { productId: 'ARCHIVED' }),
    ).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE', productId: 'ARCHIVED' });
  });

  it('allows historical corrections on the same archived Product without reactivating an archived tier', async () => {
    const { tierService } = setup(
      [product('ARCHIVED', false)],
      [
        tier({
          id: 'TIER-OLD',
          productId: 'ARCHIVED',
          name: 'Old wholesale',
          priceAmount: 35,
          isActive: false,
        }),
      ],
    );

    const corrected = await tierService.updateTier('TIER-OLD', {
      priceAmount: 36,
      notes: ' corrected historical price ',
    });

    expect(corrected.priceAmount).toBe(36);
    expect(corrected.notes).toBe('corrected historical price');
    expect(corrected.isActive).toBe(false);

    await expect(
      tierService.updateTier('TIER-OLD', { isActive: true }),
    ).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE', productId: 'ARCHIVED' });
  });

  it('archives idempotently and restores only when the referenced Product is active', async () => {
    const active = setup(
      [product('PROD-A')],
      [tier({ id: 'TIER-0007', productId: 'PROD-A' })],
    );

    const archived = await active.tierService.archiveTier('TIER-0007');
    expect(archived.isActive).toBe(false);
    expect((await active.tierService.archiveTier('TIER-0007')).isActive).toBe(false);
    expect((await active.tierService.restoreTier('TIER-0007')).isActive).toBe(true);

    const archivedProduct = setup(
      [product('ARCHIVED', false)],
      [tier({ id: 'TIER-OLD', productId: 'ARCHIVED', isActive: false })],
    );
    await expect(
      archivedProduct.tierService.restoreTier('TIER-OLD'),
    ).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE', productId: 'ARCHIVED' });
  });

  it('lists, filters, searches, and sorts tiers deterministically', async () => {
    const { tierService } = setup(
      [product('PROD-A'), product('PROD-B')],
      [
        tier({
          id: 'TIER-0003',
          productId: 'PROD-B',
          name: 'VIP Event',
          kind: 'custom',
          priceBasis: 'per-offer',
          priceAmount: 500,
          unitsPerOffer: 10,
          minimumOrderQuantity: 10,
          notes: 'priority packaging',
        }),
        tier({
          id: 'TIER-0002',
          productId: 'PROD-A',
          name: 'Bulk 50+',
          minimumOrderQuantity: 50,
          isActive: false,
        }),
        tier({
          id: 'TIER-0001',
          productId: 'PROD-A',
          name: 'Bulk 20+',
          minimumOrderQuantity: 20,
        }),
      ],
    );

    expect((await tierService.listTiers()).map((item) => item.id)).toEqual([
      'TIER-0001',
      'TIER-0002',
      'TIER-0003',
    ]);
    expect((await tierService.listTiers({ productId: ' prod-a ' })).map((item) => item.id)).toEqual([
      'TIER-0001',
      'TIER-0002',
    ]);
    expect((await tierService.listTiers({ active: false })).map((item) => item.id)).toEqual([
      'TIER-0002',
    ]);
    expect((await tierService.listTiers({ kind: 'custom' })).map((item) => item.id)).toEqual([
      'TIER-0003',
    ]);
    expect((await tierService.listTiers({ priceBasis: 'per-offer' })).map((item) => item.id)).toEqual([
      'TIER-0003',
    ]);
    expect((await tierService.listTiers({ query: 'priority' })).map((item) => item.id)).toEqual([
      'TIER-0003',
    ]);
    expect((await tierService.listTiers({ query: 'bulk' })).map((item) => item.id)).toEqual([
      'TIER-0001',
      'TIER-0002',
    ]);
  });

  it('returns defensive service results', async () => {
    const { tierService } = setup([product('PROD-A')]);
    const created = await tierService.createTier(createInput({ notes: 'original' }));

    created.name = 'mutated outside';
    created.notes = 'changed outside';

    const stored = await tierService.getTier(created.id);
    expect(stored?.name).toBe('Bulk 20+');
    expect(stored?.notes).toBe('original');

    const listed = await tierService.listTiers();
    listed[0]!.priceAmount = 999;
    expect((await tierService.getTier(created.id))?.priceAmount).toBe(40);
  });

  it('uses typed application errors for missing tier operations', async () => {
    const { tierService } = setup();

    await expect(tierService.updateTier('missing', { name: 'x' })).rejects.toBeInstanceOf(
      ProductPriceTierApplicationError,
    );
    await expect(tierService.archiveTier('missing')).rejects.toMatchObject({
      code: 'TIER_NOT_FOUND',
      tierId: 'missing',
    });
    await expect(tierService.restoreTier('missing')).rejects.toMatchObject({
      code: 'TIER_NOT_FOUND',
    });
  });
});
