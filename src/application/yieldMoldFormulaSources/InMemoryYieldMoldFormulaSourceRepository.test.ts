import { describe, expect, it } from 'vitest';
import type { YieldMoldFormulaSource } from '../../domain/yieldMoldFormulaSource';
import { InMemoryYieldMoldFormulaSourceRepository } from './InMemoryYieldMoldFormulaSourceRepository';

function source(
  overrides: Partial<YieldMoldFormulaSource> = {},
): YieldMoldFormulaSource {
  return {
    yieldSampleId: 'YLD-001',
    moldId: 'MOLD-001',
    moldYieldProfileId: 'PMYP-001',
    ...overrides,
  };
}

describe('YRS2A InMemoryYieldMoldFormulaSourceRepository', () => {
  it('reads by Yield Sample identity trim-aware and case-insensitively', async () => {
    const repository =
      new InMemoryYieldMoldFormulaSourceRepository([source()]);

    await expect(
      repository.findByYieldSampleId(' yld-001 '),
    ).resolves.toEqual(source());
  });

  it('returns clones instead of mutable internal references', async () => {
    const repository =
      new InMemoryYieldMoldFormulaSourceRepository([source()]);
    const first = await repository.findByYieldSampleId('YLD-001');
    if (!first) throw new Error('Expected source.');

    first.moldId = 'MUTATED';

    await expect(
      repository.findByYieldSampleId('YLD-001'),
    ).resolves.toEqual(source());
  });

  it('supports infrastructure delete for future coordinated correction/rollback', async () => {
    const repository =
      new InMemoryYieldMoldFormulaSourceRepository([source()]);

    await repository.delete(' yld-001 ');

    await expect(
      repository.findByYieldSampleId('YLD-001'),
    ).resolves.toBeNull();
  });

  it('supports collection replacement for future physical hydration', async () => {
    const repository =
      new InMemoryYieldMoldFormulaSourceRepository([source()]);

    await repository.replaceAll([
      source({
        yieldSampleId: 'YLD-002',
        moldId: 'MOLD-002',
        moldYieldProfileId: 'PMYP-002',
      }),
    ]);

    await expect(repository.list()).resolves.toEqual([
      {
        yieldSampleId: 'YLD-002',
        moldId: 'MOLD-002',
        moldYieldProfileId: 'PMYP-002',
      },
    ]);
    await expect(
      repository.findByYieldSampleId('YLD-001'),
    ).resolves.toBeNull();
  });
});
