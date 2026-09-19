import { describe, expect, it } from 'vitest';
import {
  ProductFinancialProfileError,
  type ProductFinancialProfile,
} from '../../domain/productFinancialProfile';
import { PricingError } from '../../domain/pricing';
import type { Product } from '../../domain/products';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductFinancialProfileRepository } from './InMemoryProductFinancialProfileRepository';
import {
  ProductFinancialProfileApplicationError,
  ProductFinancialProfileService,
} from './ProductFinancialProfileService';

function product(id: string, isActive = true): Product {
  return {
    id,
    name: `Product ${id}`,
    category: 'candle',
    safetyWasteRate: 0,
    isActive,
  };
}

function profile(
  productId: string,
  overrides: Partial<Omit<ProductFinancialProfile, 'productId'>> = {},
): ProductFinancialProfile {
  return {
    productId,
    laborCostPerUnit: 10,
    overheadCostPerUnit: 5,
    pricingPolicy: { method: 'markup-percent', value: 0.5 },
    ...overrides,
  };
}

function setup(products: Product[] = [], profiles: ProductFinancialProfile[] = []) {
  const productRepository = new InMemoryProductRepository(products);
  const profileRepository = new InMemoryProductFinancialProfileRepository(profiles);
  const profileService = new ProductFinancialProfileService(
    profileRepository,
    productRepository,
  );
  return { productRepository, profileRepository, profileService };
}

describe('ProductFinancialProfileService', () => {
  it('upserts one profile per Product identity instead of duplicating records', async () => {
    const { profileService, profileRepository } = setup([product('candle-a')]);

    await profileService.upsertProfile(profile('candle-a'));
    const updated = await profileService.upsertProfile(
      profile('CANDLE-A', { laborCostPerUnit: 12 }),
    );

    expect(updated.productId).toBe('candle-a');
    expect(updated.laborCostPerUnit).toBe(12);
    expect(await profileRepository.list()).toHaveLength(1);
  });

  it('canonicalizes Product identity from ProductRepository and supports trimmed lookup', async () => {
    const { profileService } = setup([product('Candle-A')]);

    const saved = await profileService.upsertProfile(profile('  candle-a  '));

    expect(saved.productId).toBe('Candle-A');
    expect((await profileService.getProfile(' CANDLE-A '))?.productId).toBe('Candle-A');
  });

  it('preserves explicit zero labor and overhead as known source values', async () => {
    const { profileService } = setup([product('known-zero')]);

    const saved = await profileService.upsertProfile(
      profile('known-zero', {
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      }),
    );

    expect(saved).toMatchObject({
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: null,
    });
  });

  it('keeps missing profile distinct from an explicit zero-cost profile', async () => {
    const { profileService } = setup([product('configured'), product('missing')]);
    await profileService.upsertProfile(
      profile('configured', {
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      }),
    );

    expect(await profileService.getProfile('configured')).not.toBeNull();
    expect(await profileService.getProfile('missing')).toBeNull();
  });

  it('allows pricing policy to remain explicitly unconfigured', async () => {
    const { profileService } = setup([product('item')]);
    const saved = await profileService.upsertProfile(
      profile('item', { pricingPolicy: null }),
    );
    expect(saved.pricingPolicy).toBeNull();
  });

  it('persists a valid configured pricing policy', async () => {
    const { profileService } = setup([product('item')]);
    const saved = await profileService.upsertProfile(
      profile('item', { pricingPolicy: { method: 'margin-percent', value: 0.25 } }),
    );
    expect(saved.pricingPolicy).toEqual({ method: 'margin-percent', value: 0.25 });
  });

  it('rejects profile writes for a missing Product', async () => {
    const { profileService } = setup();

    await expect(profileService.upsertProfile(profile('missing'))).rejects.toBeInstanceOf(
      ProductFinancialProfileApplicationError,
    );
    await expect(profileService.upsertProfile(profile('missing'))).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      productId: 'missing',
    });
  });

  it('preserves and permits correction of profiles for archived Products', async () => {
    const { profileService } = setup(
      [product('archived', false)],
      [profile('archived', { laborCostPerUnit: 8, notes: 'historical' })],
    );

    expect((await profileService.getProfile('archived'))?.laborCostPerUnit).toBe(8);

    const corrected = await profileService.upsertProfile(
      profile('archived', { laborCostPerUnit: 9, notes: 'corrected after archive' }),
    );
    expect(corrected.laborCostPerUnit).toBe(9);
    expect(corrected.notes).toBe('corrected after archive');
  });

  it('enforces the 4.1A financial profile contract on writes', async () => {
    const { profileService } = setup([product('item')]);

    await expect(
      profileService.upsertProfile(profile('item', { laborCostPerUnit: -1 })),
    ).rejects.toBeInstanceOf(ProductFinancialProfileError);
    await expect(
      profileService.upsertProfile(profile('item', { overheadCostPerUnit: Number.NaN })),
    ).rejects.toBeInstanceOf(ProductFinancialProfileError);
  });

  it('enforces the 4.1B configured pricing policy contract on writes', async () => {
    const { profileService } = setup([product('item')]);

    await expect(
      profileService.upsertProfile(
        profile('item', { pricingPolicy: { method: 'margin-percent', value: 1 } }),
      ),
    ).rejects.toBeInstanceOf(PricingError);
    await expect(
      profileService.upsertProfile(
        profile('item', { pricingPolicy: { method: 'markup-percent', value: -0.1 } }),
      ),
    ).rejects.toBeInstanceOf(PricingError);
  });

  it('normalizes notes before persistence', async () => {
    const { profileService } = setup([product('item')]);
    const saved = await profileService.upsertProfile(profile('item', { notes: '  reviewed  ' }));
    expect(saved.notes).toBe('reviewed');
  });

  it('lists, filters, searches, and sorts profile records deterministically', async () => {
    const { profileService } = setup(
      [product('beta'), product('Alpha'), product('charlie')],
      [
        profile('beta', { notes: 'back shelf', pricingPolicy: null }),
        profile('Alpha', { notes: 'front shelf' }),
        profile('charlie', { pricingPolicy: { method: 'profit-amount', value: 20 } }),
      ],
    );

    expect((await profileService.listProfiles()).map((item) => item.productId)).toEqual([
      'Alpha',
      'beta',
      'charlie',
    ]);
    expect(await profileService.listProfiles({ productId: ' BETA ' })).toEqual([
      profile('beta', { notes: 'back shelf', pricingPolicy: null }),
    ]);
    expect((await profileService.listProfiles({ query: 'front' })).map((item) => item.productId)).toEqual([
      'Alpha',
    ]);
    expect((await profileService.listProfiles({ query: 'profit-amount' })).map((item) => item.productId)).toEqual([
      'charlie',
    ]);
  });

  it('query search matches Product identity case-insensitively', async () => {
    const { profileService } = setup([product('Candle-Deluxe')], [profile('Candle-Deluxe')]);
    expect((await profileService.listProfiles({ query: 'candle-deluxe' }))).toHaveLength(1);
  });

  it('defensively clones repository seed, write, read, and nested pricing-policy values', async () => {
    const seeded = profile('item', {
      pricingPolicy: { method: 'markup-percent', value: 0.4 },
    });
    const repository = new InMemoryProductFinancialProfileRepository([seeded]);

    seeded.laborCostPerUnit = 99;
    seeded.pricingPolicy!.value = 9;
    const seededRead = await repository.findByProductId('item');
    expect(seededRead?.laborCostPerUnit).toBe(10);
    expect(seededRead?.pricingPolicy?.value).toBe(0.4);

    const replacement = profile('item', {
      laborCostPerUnit: 11,
      pricingPolicy: { method: 'margin-percent', value: 0.2 },
    });
    await repository.upsert(replacement);
    replacement.laborCostPerUnit = 100;
    replacement.pricingPolicy!.value = 0.9;

    const firstRead = await repository.findByProductId('item');
    expect(firstRead?.laborCostPerUnit).toBe(11);
    expect(firstRead?.pricingPolicy?.value).toBe(0.2);
    if (firstRead) {
      firstRead.laborCostPerUnit = 200;
      if (firstRead.pricingPolicy) firstRead.pricingPolicy.value = 0.8;
    }

    const secondRead = await repository.findByProductId('item');
    expect(secondRead?.laborCostPerUnit).toBe(11);
    expect(secondRead?.pricingPolicy?.value).toBe(0.2);

    const listed = await repository.list();
    listed[0]!.overheadCostPerUnit = 999;
    if (listed[0]!.pricingPolicy) listed[0]!.pricingPolicy.value = 0.7;
    const afterListMutation = await repository.findByProductId('item');
    expect(afterListMutation?.overheadCostPerUnit).toBe(5);
    expect(afterListMutation?.pricingPolicy?.value).toBe(0.2);
  });

  it('defensively clones service results including nested pricing policy', async () => {
    const { profileService } = setup([product('item')]);
    const saved = await profileService.upsertProfile(profile('item'));

    saved.laborCostPerUnit = 100;
    if (saved.pricingPolicy) saved.pricingPolicy.value = 9;

    const stored = await profileService.getProfile('item');
    expect(stored?.laborCostPerUnit).toBe(10);
    expect(stored?.pricingPolicy?.value).toBe(0.5);

    const listed = await profileService.listProfiles();
    listed[0]!.overheadCostPerUnit = 300;
    if (listed[0]!.pricingPolicy) listed[0]!.pricingPolicy.value = 8;

    const reread = await profileService.getProfile('item');
    expect(reread?.overheadCostPerUnit).toBe(5);
    expect(reread?.pricingPolicy?.value).toBe(0.5);
  });

  it('repository identity is case-insensitive even when seeded directly', async () => {
    const repository = new InMemoryProductFinancialProfileRepository([
      profile('Candle-A'),
      profile('CANDLE-A', { laborCostPerUnit: 15 }),
    ]);
    expect(await repository.list()).toHaveLength(1);
    expect((await repository.findByProductId('candle-a'))?.laborCostPerUnit).toBe(15);
  });
});
