import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { Mold } from '../../domain/molds';
import {
  PlasterMoldFormulaError,
} from '../../domain/plasterMoldFormula';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import {
  PlasterMoldYieldCalculatorError,
  PlasterMoldYieldCalculatorService,
  type PlasterMoldYieldCalculatorProfileProvider,
} from './PlasterMoldYieldCalculatorService';

function material(
  id: string,
  overrides: Partial<Material> = {},
): Material {
  return {
    id,
    name: id,
    group: 'other',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 1,
    onHandQuantity: 1000,
    onHandUnit: 'g',
    isActive: true,
    ...overrides,
  };
}

function mold(
  id = 'MOLD-1',
  overrides: Partial<Mold> = {},
): Mold {
  return {
    id,
    productId: 'PROD-ANY-CATEGORY',
    name: 'Primary Mold',
    isActive: true,
    ...overrides,
  };
}

function profile(
  overrides: Partial<PlasterMoldYieldProfile> = {},
): PlasterMoldYieldProfile {
  return {
    id: 'PMYP-1',
    moldId: 'MOLD-1',
    waterMaterialId: 'MAT-WATER',
    plasterMaterialId: 'MAT-PLASTER',
    glueMaterialId: 'MAT-GLUE',
    waterFillWeightGrams: 50,
    waterAdjustmentRate: 0.3,
    plasterFactor: 0.75,
    glueFactor: 0.05,
    piecesPerPour: 4,
    isActive: true,
    ...overrides,
  };
}

function setup(options: {
  molds?: Mold[];
  materials?: Material[];
  activeProfile?: PlasterMoldYieldProfile | null;
} = {}) {
  const molds = new InMemoryMoldRepository(
    options.molds ?? [mold()],
  );
  const materials = new InMemoryMaterialRepository(
    options.materials ?? [
      material('MAT-WATER', { name: 'Water', group: 'liquid' }),
      material('MAT-PLASTER', { name: 'Plaster of Paris', group: 'plaster' }),
      material('MAT-GLUE', { name: 'White Glue' }),
    ],
  );
  const activeProfile = options.activeProfile === undefined
    ? profile()
    : options.activeProfile;

  const profiles: PlasterMoldYieldCalculatorProfileProvider = {
    async getActiveProfileForMold() {
      return activeProfile ? { ...activeProfile } : null;
    },
  };

  return new PlasterMoldYieldCalculatorService(molds, materials, profiles);
}

describe('MY4 PlasterMoldYieldCalculatorService', () => {
  it('calculates the canonical multi-cavity requested-quantity estimate from the active profile', async () => {
    const calculator = setup();

    const result = await calculator.calculateForMold(' mold-1 ', 21);

    expect(result).toMatchObject({
      estimateKind: 'theoretical',
      mold: {
        id: 'MOLD-1',
        productId: 'PROD-ANY-CATEGORY',
        name: 'Primary Mold',
        isActive: true,
      },
      profile: {
        id: 'PMYP-1',
        piecesPerPour: 4,
      },
      materials: {
        water: {
          role: 'water',
          materialId: 'MAT-WATER',
          materialName: 'Water',
          baseUnit: 'g',
        },
        plaster: {
          role: 'plaster',
          materialId: 'MAT-PLASTER',
          materialName: 'Plaster of Paris',
          baseUnit: 'g',
        },
        glue: {
          role: 'glue',
          materialId: 'MAT-GLUE',
          materialName: 'White Glue',
          baseUnit: 'g',
        },
      },
      formula: {
        unit: 'g',
        perPour: {
          adjustedWaterGrams: 35,
          plasterGrams: 26.25,
          glueGrams: 1.75,
          totalMixtureGrams: 63,
        },
        perPiece: {
          adjustedWaterGrams: 8.75,
          plasterGrams: 6.5625,
          glueGrams: 0.4375,
          totalMixtureGrams: 15.75,
        },
        requestedQuantityEstimate: {
          requestedQuantity: 21,
          requiredPours: 6,
          producedCapacityPieces: 24,
          extraCapacityPieces: 3,
          totals: {
            adjustedWaterGrams: 210,
            plasterGrams: 157.5,
            glueGrams: 10.5,
            totalMixtureGrams: 378,
          },
        },
      },
      productSafetyWasteApplied: false,
      yieldEvidenceCreated: false,
    });
  });

  it('calculates one-pour/per-piece estimates without requiring a requested quantity', async () => {
    const calculator = setup({
      activeProfile: profile({ piecesPerPour: 1 }),
    });

    const result = await calculator.calculateForMold('MOLD-1');

    expect(result.formula.perPour).toEqual({
      adjustedWaterGrams: 35,
      plasterGrams: 26.25,
      glueGrams: 1.75,
      totalMixtureGrams: 63,
    });
    expect(result.formula.perPiece).toEqual(result.formula.perPour);
    expect(result.formula.requestedQuantityEstimate).toBeUndefined();
  });

  it('is enabled by active Mold profile rather than Product category', async () => {
    const calculator = setup({
      molds: [mold('MOLD-1', { productId: 'PROD-NON-PLASTER-LABEL' })],
    });

    const result = await calculator.calculateForMold('MOLD-1');

    expect(result.mold.productId).toBe('PROD-NON-PLASTER-LABEL');
    expect(result.formula.perPour.plasterGrams).toBe(26.25);
  });

  it('fails distinctly when the Mold does not exist, is archived, or lacks an active profile', async () => {
    await expect(
      setup({ molds: [] }).calculateForMold('MISSING'),
    ).rejects.toMatchObject({ code: 'MOLD_NOT_FOUND' });

    await expect(
      setup({ molds: [mold('MOLD-1', { isActive: false })] })
        .calculateForMold('MOLD-1'),
    ).rejects.toMatchObject({ code: 'MOLD_INACTIVE' });

    await expect(
      setup({ activeProfile: null }).calculateForMold('MOLD-1'),
    ).rejects.toMatchObject({ code: 'ACTIVE_PROFILE_NOT_FOUND' });
  });

  it('fails closed if the active-profile provider returns a profile for another Mold', async () => {
    await expect(
      setup({
        activeProfile: profile({ moldId: 'MOLD-OTHER' }),
      }).calculateForMold('MOLD-1'),
    ).rejects.toMatchObject({
      code: 'PROFILE_MOLD_MISMATCH',
      profileId: 'PMYP-1',
    });
  });

  it('defensively revalidates Material references and weight compatibility', async () => {
    await expect(
      setup({
        materials: [
          material('MAT-WATER', {
            baseUnit: 'mL',
            purchaseUnit: 'mL',
            onHandUnit: 'mL',
          }),
          material('MAT-PLASTER'),
          material('MAT-GLUE'),
        ],
      }).calculateForMold('MOLD-1'),
    ).rejects.toMatchObject({
      code: 'PROFILE_SOURCE_INVALID',
      underlyingCode: 'WATER_MATERIAL_NOT_WEIGHT_COMPATIBLE',
    });

    await expect(
      setup({
        materials: [
          material('MAT-WATER'),
          material('MAT-PLASTER'),
        ],
      }).calculateForMold('MOLD-1'),
    ).rejects.toMatchObject({
      code: 'PROFILE_SOURCE_INVALID',
      underlyingCode: 'MISSING_GLUE_MATERIAL_REFERENCE',
    });
  });

  it('delegates requested-quantity validation to the MY1A formula contract', async () => {
    await expect(
      setup().calculateForMold('MOLD-1', 0),
    ).rejects.toMatchObject({
      name: 'PlasterMoldFormulaError',
      code: 'INVALID_REQUESTED_QUANTITY',
    });

    await expect(
      setup().calculateForMold('MOLD-1', 2.5),
    ).rejects.toBeInstanceOf(PlasterMoldFormulaError);
  });

  it('returns defensive result copies and never exposes Material cost/inventory fields', async () => {
    const calculator = setup();
    const first = await calculator.calculateForMold('MOLD-1', 4);

    expect(first.materials.water).not.toHaveProperty('packageCost');
    expect(first.materials.water).not.toHaveProperty('onHandQuantity');

    first.profile.waterFillWeightGrams = 999;
    first.formula.perPour.adjustedWaterGrams = 999;

    const second = await calculator.calculateForMold('MOLD-1', 4);
    expect(second.profile.waterFillWeightGrams).toBe(50);
    expect(second.formula.perPour.adjustedWaterGrams).toBe(35);
  });

  it('never emits safety-waste or Yield Sample evidence as part of the estimate', async () => {
    const result = await setup().calculateForMold('MOLD-1', 8);

    expect(result.productSafetyWasteApplied).toBe(false);
    expect(result.yieldEvidenceCreated).toBe(false);
    expect(result).not.toHaveProperty('safetyWasteRate');
    expect(result).not.toHaveProperty('yieldSample');
  });

  it('uses an application error for stale intrinsic profile data', async () => {
    await expect(
      setup({
        activeProfile: profile({ waterFillWeightGrams: 0 }),
      }).calculateForMold('MOLD-1'),
    ).rejects.toBeInstanceOf(PlasterMoldYieldCalculatorError);

    await expect(
      setup({
        activeProfile: profile({ waterFillWeightGrams: 0 }),
      }).calculateForMold('MOLD-1'),
    ).rejects.toMatchObject({
      code: 'PROFILE_SOURCE_INVALID',
      underlyingCode: 'NON_POSITIVE_WATER_FILL_WEIGHT',
    });
  });
});
