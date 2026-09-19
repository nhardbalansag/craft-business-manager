import { describe, expect, it } from 'vitest';
import type { ProductPriceTier } from '../../domain/productPriceTiers';
import { InMemoryProductPriceTierRepository } from './InMemoryProductPriceTierRepository';

function tier(overrides: Partial<ProductPriceTier> = {}): ProductPriceTier {
  return {
    id: 'TIER-0001',
    productId: 'PROD-0001',
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

describe('InMemoryProductPriceTierRepository', () => {
  it('seeds defensively and returns defensive list clones', async () => {
    const source = tier({ notes: 'source' });
    const repository = new InMemoryProductPriceTierRepository([source]);

    source.name = 'mutated outside';
    const first = await repository.list();
    first[0].name = 'mutated result';

    expect(await repository.list()).toEqual([tier({ notes: 'source' })]);
  });

  it('finds IDs case-insensitively and ignores surrounding whitespace', async () => {
    const repository = new InMemoryProductPriceTierRepository([
      tier({ id: 'TIER-0010', name: 'Event tier' }),
    ]);

    expect(await repository.findById(' tier-0010 ')).toEqual(
      tier({ id: 'TIER-0010', name: 'Event tier' }),
    );
    expect(await repository.findById('TIER-MISSING')).toBeNull();
  });

  it('inserts a defensive clone', async () => {
    const repository = new InMemoryProductPriceTierRepository();
    const input = tier({ id: 'TIER-0002', name: 'Package 6' });

    await repository.insert(input);
    input.name = 'changed after insert';

    expect(await repository.findById('TIER-0002')).toEqual(
      tier({ id: 'TIER-0002', name: 'Package 6' }),
    );
  });

  it('replaces the stored tier by normalized identity without leaking references', async () => {
    const repository = new InMemoryProductPriceTierRepository([tier()]);
    const replacement = tier({
      id: 'tier-0001',
      name: 'Updated Bulk 24+',
      minimumOrderQuantity: 24,
    });

    await repository.replace(replacement);
    replacement.name = 'changed after replace';

    expect(await repository.list()).toEqual([
      tier({
        id: 'tier-0001',
        name: 'Updated Bulk 24+',
        minimumOrderQuantity: 24,
      }),
    ]);
  });

  it('keeps explicit legacy/custom identities available at the repository boundary', async () => {
    const repository = new InMemoryProductPriceTierRepository([
      tier({ id: 'WHOLESALE-OLD', name: 'Legacy wholesale' }),
      tier({ id: 'TIER-EVENT-VIP', name: 'VIP event package' }),
    ]);

    expect((await repository.findById('wholesale-old'))?.id).toBe('WHOLESALE-OLD');
    expect((await repository.findById('tier-event-vip'))?.id).toBe('TIER-EVENT-VIP');
  });
  it('atomically replaces the complete tier collection with defensive clones', async () => {
    const repository = new InMemoryProductPriceTierRepository([
      tier({ id: 'TIER-OLD', name: 'Old tier' }),
    ]);
    const next = tier({
      id: 'TIER-NEW',
      name: 'New package',
      kind: 'package',
      priceBasis: 'per-offer',
      priceAmount: 250,
      unitsPerOffer: 5,
      minimumOrderQuantity: 5,
    });

    await repository.replaceAll([next]);

    expect(await repository.findById('TIER-OLD')).toBeNull();
    expect(await repository.findById('tier-new')).toEqual(next);

    next.name = 'caller mutation';
    expect((await repository.findById('TIER-NEW'))?.name).toBe('New package');

    await repository.replaceAll([]);
    expect(await repository.list()).toEqual([]);
  });

});
