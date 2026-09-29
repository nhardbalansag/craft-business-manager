import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { Mold } from '../../domain/molds';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import { InMemoryPlasterMoldYieldProfileRepository } from './InMemoryPlasterMoldYieldProfileRepository';
import {
  PlasterMoldYieldProfileApplicationError,
  PlasterMoldYieldProfileService,
} from './PlasterMoldYieldProfileService';

function material(
  id: string,
  overrides: Partial<Material> = {},
): Material {
  return {
    id,
    name: id,
    group: 'other',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'g',
    packageCost: 1,
    onHandQuantity: 1,
    onHandUnit: 'g',
    isActive: true,
    ...overrides,
  };
}

function mold(id: string, overrides: Partial<Mold> = {}): Mold {
  return {
    id,
    productId: 'PROD-1',
    name: id,
    isActive: true,
    ...overrides,
  };
}

function profile(
  id = 'PMYP-0001',
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
    notes: 'primary profile',
    isActive: true,
    ...overrides,
  };
}

function setup(options: {
  profiles?: PlasterMoldYieldProfile[];
  molds?: Mold[];
  materials?: Material[];
} = {}) {
  const repository = new InMemoryPlasterMoldYieldProfileRepository(
    options.profiles ?? [],
  );
  const moldRepository = new InMemoryMoldRepository(
    options.molds ?? [mold('MOLD-1'), mold('MOLD-2')],
  );
  const materialRepository = new InMemoryMaterialRepository(
    options.materials ?? [
      material('MAT-WATER', { group: 'liquid' }),
      material('MAT-PLASTER', { group: 'plaster' }),
      material('MAT-GLUE'),
      material('MAT-OTHER'),
    ],
  );
  const service = new PlasterMoldYieldProfileService(
    repository,
    moldRepository,
    materialRepository,
  );

  return { repository, moldRepository, materialRepository, service };
}

describe('PlasterMoldYieldProfileService', () => {
  it('creates normalized source profiles and canonicalizes resolved references', async () => {
    const { service } = setup();

    const created = await service.createProfile(
      profile(' PMYP-0001 ', {
        moldId: ' mold-1 ',
        waterMaterialId: ' mat-water ',
        plasterMaterialId: ' mat-plaster ',
        glueMaterialId: ' mat-glue ',
        notes: '  formula profile  ',
      }),
    );

    expect(created).toMatchObject({
      id: 'PMYP-0001',
      moldId: 'MOLD-1',
      waterMaterialId: 'MAT-WATER',
      plasterMaterialId: 'MAT-PLASTER',
      glueMaterialId: 'MAT-GLUE',
      notes: 'formula profile',
      isActive: true,
    });
  });

  it('rejects duplicate profile IDs case-insensitively', async () => {
    const { service } = setup({ profiles: [profile('PMYP-0001')] });

    await expect(
      service.createProfile(profile(' pmyp-0001 ', { moldId: 'MOLD-2' })),
    ).rejects.toMatchObject({ code: 'DUPLICATE_PROFILE_ID' });
  });

  it('surfaces MY1C missing-reference and weight-compatibility codes', async () => {
    const missing = setup();

    await expect(
      missing.service.createProfile(profile('PMYP-X', { moldId: 'MISSING' })),
    ).rejects.toMatchObject({ code: 'MISSING_MOLD_REFERENCE', field: 'moldId' });

    const incompatible = setup({
      materials: [
        material('MAT-WATER', {
          baseUnit: 'mL',
          purchaseUnit: 'mL',
          onHandUnit: 'mL',
        }),
        material('MAT-PLASTER'),
        material('MAT-GLUE'),
      ],
    });

    await expect(
      incompatible.service.createProfile(profile('PMYP-Y')),
    ).rejects.toMatchObject({
      code: 'WATER_MATERIAL_NOT_WEIGHT_COMPATIBLE',
      field: 'waterMaterialId',
    });
  });

  it('enforces one active profile per Mold while permitting archived history', async () => {
    const { service } = setup();

    await service.createProfile(profile('PMYP-ACTIVE'));

    await expect(
      service.createProfile(profile('PMYP-SECOND')),
    ).rejects.toMatchObject({ code: 'MULTIPLE_ACTIVE_PROFILES_FOR_MOLD' });

    await expect(
      service.createProfile(profile('PMYP-OLD', { isActive: false })),
    ).resolves.toMatchObject({ id: 'PMYP-OLD', isActive: false });
  });

  it('updates, archives, restores, and resolves the active profile for a Mold', async () => {
    const { service } = setup();

    await service.createProfile(profile('PMYP-1'));
    const updated = await service.updateProfile('pmyp-1', {
      piecesPerPour: 4,
      waterFillWeightGrams: 80,
      notes: 'four cavity',
    });

    expect(updated).toMatchObject({
      id: 'PMYP-1',
      piecesPerPour: 4,
      waterFillWeightGrams: 80,
      notes: 'four cavity',
    });
    expect(await service.getActiveProfileForMold(' mold-1 ')).toEqual(updated);

    const archived = await service.archiveProfile('PMYP-1');
    expect(archived.isActive).toBe(false);
    expect(await service.getActiveProfileForMold('MOLD-1')).toBeNull();

    const restored = await service.restoreProfile('PMYP-1');
    expect(restored.isActive).toBe(true);
  });

  it('prevents restoring an archived profile when another active profile owns the Mold', async () => {
    const { service } = setup();

    await service.createProfile(profile('PMYP-ACTIVE'));
    await service.createProfile(profile('PMYP-OLD', { isActive: false }));

    await expect(service.restoreProfile('PMYP-OLD')).rejects.toMatchObject({
      code: 'MULTIPLE_ACTIVE_PROFILES_FOR_MOLD',
    });
  });

  it('lists profiles deterministically with reference, active, and query filters', async () => {
    const { service } = setup();

    await service.createProfile(profile('PMYP-B', { moldId: 'MOLD-2', notes: 'second' }));
    await service.createProfile(profile('PMYP-A', { isActive: false, notes: 'archived alpha' }));
    await service.createProfile(profile('PMYP-C', { moldId: 'MOLD-1', notes: 'active alpha' }));

    expect(
      (await service.listProfiles({ moldId: 'MOLD-1' })).map((item) => item.id),
    ).toEqual(['PMYP-C', 'PMYP-A']);

    expect(
      (await service.listProfiles({ active: false, query: 'alpha' })).map(
        (item) => item.id,
      ),
    ).toEqual(['PMYP-A']);
  });

  it('guards Mold archival while an active profile depends on it', async () => {
    const { service } = setup({ profiles: [profile('PMYP-ACTIVE')] });

    await expect(service.assertMoldCanArchive(' mold-1 ')).rejects.toBeInstanceOf(
      PlasterMoldYieldProfileApplicationError,
    );
    await expect(service.assertMoldCanArchive('MOLD-1')).rejects.toMatchObject({
      code: 'MOLD_IN_USE_BY_ACTIVE_PROFILE',
      profileId: 'PMYP-ACTIVE',
    });

    await expect(service.assertMoldCanArchive('MOLD-2')).resolves.toBeUndefined();
  });

  it('guards Material archival and base-unit changes for active profiles', async () => {
    const { service } = setup({ profiles: [profile('PMYP-ACTIVE')] });

    await expect(service.assertMaterialCanArchive('MAT-WATER')).rejects.toMatchObject({
      code: 'MATERIAL_IN_USE_BY_ACTIVE_PROFILE',
      field: 'waterMaterialId',
    });

    await expect(
      service.assertMaterialUpdatePreservesActiveProfiles(
        material('MAT-PLASTER', {
          baseUnit: 'mL',
          purchaseUnit: 'mL',
          onHandUnit: 'mL',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'ACTIVE_PROFILE_REQUIRES_WEIGHT_MATERIAL',
      field: 'plasterMaterialId',
    });

    await expect(
      service.assertMaterialUpdatePreservesActiveProfiles(material('MAT-OTHER')),
    ).resolves.toBeUndefined();
  });
});
