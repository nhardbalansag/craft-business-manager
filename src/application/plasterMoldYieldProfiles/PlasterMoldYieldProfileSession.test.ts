import { describe, expect, it } from 'vitest';
import {
  materialRepository,
  materialService,
  moldRepository,
  moldService,
  plasterMoldYieldProfileRepository,
  plasterMoldYieldProfileService,
  productRepository,
  productService,
} from '../session';
import { InMemoryPlasterMoldYieldProfileRepository } from './InMemoryPlasterMoldYieldProfileRepository';
import { PlasterMoldYieldProfileService } from './PlasterMoldYieldProfileService';

describe('MY2C shared plaster mold yield profile session wiring', () => {
  it('exposes the shared profile repository/service over Mold and Material repositories', () => {
    expect(plasterMoldYieldProfileRepository).toBeInstanceOf(
      InMemoryPlasterMoldYieldProfileRepository,
    );
    expect(plasterMoldYieldProfileService).toBeInstanceOf(
      PlasterMoldYieldProfileService,
    );
    expect(moldRepository).toBeDefined();
    expect(materialRepository).toBeDefined();
  });

  it('supports shared-session CRUD and protects active Mold/Material references', async () => {
    const suffix = 'MY2C';
    const productId = `PROD-${suffix}`;
    const moldId = `MOLD-${suffix}`;
    const waterId = `MAT-WATER-${suffix}`;
    const plasterId = `MAT-PLASTER-${suffix}`;
    const glueId = `MAT-GLUE-${suffix}`;
    const profileId = `PMYP-${suffix}`;

    if (!(await productRepository.findById(productId))) {
      await productService.createProduct({
        id: productId,
        name: 'MY2C Profile Product',
        category: 'paintable-art',
        safetyWasteRate: 0,
        isActive: true,
      });
    }

    for (const material of [
      {
        id: waterId,
        name: 'MY2C Water',
        group: 'liquid' as const,
      },
      {
        id: plasterId,
        name: 'MY2C Plaster',
        group: 'plaster' as const,
      },
      {
        id: glueId,
        name: 'MY2C Glue',
        group: 'other' as const,
      },
    ]) {
      if (!(await materialRepository.findById(material.id))) {
        await materialService.createMaterial({
          ...material,
          baseUnit: 'g',
          purchaseQuantity: 1000,
          purchaseUnit: 'g',
          packageCost: 100,
          onHandQuantity: 1000,
          onHandUnit: 'g',
          isActive: true,
        });
      }
    }

    if (!(await moldRepository.findById(moldId))) {
      await moldService.createMold({
        id: moldId,
        productId,
        name: 'MY2C Mold',
        isActive: true,
      });
    }

    if (!(await plasterMoldYieldProfileRepository.findById(profileId))) {
      await plasterMoldYieldProfileService.createProfile({
        id: profileId,
        moldId: moldId.toLowerCase(),
        waterMaterialId: waterId.toLowerCase(),
        plasterMaterialId: plasterId.toLowerCase(),
        glueMaterialId: glueId.toLowerCase(),
        waterFillWeightGrams: 50,
        waterAdjustmentRate: 0.3,
        plasterFactor: 0.75,
        glueFactor: 0.05,
        piecesPerPour: 2,
        notes: ' shared session ',
        isActive: true,
      });
    }

    const active = await plasterMoldYieldProfileService.getActiveProfileForMold(moldId);
    expect(active).toMatchObject({
      id: profileId,
      moldId,
      waterMaterialId: waterId,
      plasterMaterialId: plasterId,
      glueMaterialId: glueId,
      notes: 'shared session',
      isActive: true,
    });

    await expect(moldService.archiveMold(moldId)).rejects.toMatchObject({
      code: 'MOLD_IN_USE_BY_ACTIVE_PROFILE',
      profileId,
    });
    await expect(materialService.archiveMaterial(waterId)).rejects.toMatchObject({
      code: 'MATERIAL_IN_USE_BY_ACTIVE_PROFILE',
      profileId,
    });

    const archived = await plasterMoldYieldProfileService.archiveProfile(profileId);
    expect(archived.isActive).toBe(false);

    const restored = await plasterMoldYieldProfileService.restoreProfile(profileId);
    expect(restored.isActive).toBe(true);
  });
});
