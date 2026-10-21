import { describe, expect, it } from 'vitest';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import { InMemoryPlasterMoldYieldProfileRepository } from './InMemoryPlasterMoldYieldProfileRepository';

function profile(
  id: string,
  overrides: Partial<PlasterMoldYieldProfile> = {},
): PlasterMoldYieldProfile {
  return {
    id,
    moldId: 'MOLD-1',
    waterMaterialId: 'MAT-WATER',
    plasterMaterialId: 'MAT-PLASTER',
    glueMaterialId: 'MAT-GLUE',
    waterFillWeightGrams: 50,
    waterAdjustmentRate: 0.3,
    plasterFactor: 0.75,
    glueFactor: 0.05,
    piecesPerPour: 1,
    isActive: true,
    ...overrides,
  };
}

describe('InMemoryPlasterMoldYieldProfileRepository', () => {
  it('uses trim-aware case-insensitive identity lookups', async () => {
    const repository = new InMemoryPlasterMoldYieldProfileRepository([
      profile('PMYP-0001'),
    ]);

    expect(await repository.findById(' pmyp-0001 ')).toEqual(profile('PMYP-0001'));
  });

  it('defensively clones reads and writes', async () => {
    const seed = profile('PMYP-0001', { notes: 'original' });
    const repository = new InMemoryPlasterMoldYieldProfileRepository([seed]);

    seed.notes = 'mutated outside';

    const first = await repository.findById('PMYP-0001');
    expect(first?.notes).toBe('original');

    if (!first) throw new Error('Expected seeded profile.');
    first.notes = 'mutated read';

    expect((await repository.findById('PMYP-0001'))?.notes).toBe('original');
  });

  it('supports atomic collection replacement for later persistence wiring', async () => {
    const repository = new InMemoryPlasterMoldYieldProfileRepository([
      profile('PMYP-OLD'),
    ]);

    await repository.replaceAll([
      profile('PMYP-NEW-1'),
      profile('PMYP-NEW-2', { isActive: false }),
    ]);

    expect((await repository.list()).map((item) => item.id)).toEqual([
      'PMYP-NEW-1',
      'PMYP-NEW-2',
    ]);
    expect(await repository.findById('PMYP-OLD')).toBeNull();
  });
});
