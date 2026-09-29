import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import { InMemoryPlasterMoldYieldProfileRepository } from './InMemoryPlasterMoldYieldProfileRepository';
import { PlasterMoldYieldCalculatorService } from './PlasterMoldYieldCalculatorService';
import { PlasterMoldYieldProfileService } from './PlasterMoldYieldProfileService';
import { PlasterMoldOperationalPreviewService } from './PlasterMoldOperationalPreviewService';

function material(
  id: string,
  name: string,
  packageCost: number,
  onHandQuantity: number,
  overrides: Partial<Material> = {},
): Material {
  return {
    id,
    name,
    group: 'other',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost,
    onHandQuantity,
    onHandUnit: 'g',
    isActive: true,
    ...overrides,
  };
}

function setup(materials?: Material[]) {
  const moldRepository = new InMemoryMoldRepository([
    {
      id: 'MOLD-1',
      productId: 'PROD-1',
      name: 'Four Cavity Mold',
      isActive: true,
    },
  ]);
  const materialRepository = new InMemoryMaterialRepository(
    materials ?? [
      material('MAT-WATER', 'Water', 20, 1000, { group: 'liquid' }),
      material('MAT-PLASTER', 'Plaster', 100, 1000, { group: 'plaster' }),
      material('MAT-GLUE', 'Glue', 200, 1000),
    ],
  );
  const profileRepository =
    new InMemoryPlasterMoldYieldProfileRepository([
      {
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
      },
    ]);
  const profileService = new PlasterMoldYieldProfileService(
    profileRepository,
    moldRepository,
    materialRepository,
  );
  const calculator = new PlasterMoldYieldCalculatorService(
    moldRepository,
    materialRepository,
    profileService,
  );
  const calibrations = new InMemoryCalibrationRepository();

  return {
    service: new PlasterMoldOperationalPreviewService(
      calculator,
      materialRepository,
      calibrations,
    ),
    materials: materialRepository,
  };
}

describe('MY7 PlasterMoldOperationalPreviewService', () => {
  it('derives formula material cost, current-stock capacity and requested-batch feasibility', async () => {
    const { service } = setup();

    const result = await service.preview('MOLD-1', 21);

    expect(result).toMatchObject({
      estimateKind: 'mold-formula-operational-preview',
      moldId: 'MOLD-1',
      profileId: 'PMYP-1',
      requestedQuantity: 21,
      requiredPours: 6,
      producedCapacityPieces: 24,
      extraCapacityPieces: 3,
      status: 'ready',
      feasibility: 'within-current-stock',
      maxCompletePoursFromCurrentStock: 28,
      maxProducedPiecesFromCurrentStock: 112,
      productSafetyWasteApplied: false,
      yieldEvidenceUsed: false,
      productionPathReplaced: false,
    });

    expect(result.estimatedMaterialCostPerPour).toBeCloseTo(3.675);
    expect(result.estimatedMaterialCostPerPiece).toBeCloseTo(0.91875);
    expect(result.estimatedTargetBatchMaterialCost).toBeCloseTo(22.05);

    expect(result.materials).toEqual([
      expect.objectContaining({
        role: 'water',
        perPourGrams: 35,
        targetBatchGrams: 210,
        costPerGram: 0.02,
        costPerPour: 0.7,
        normalizedOnHandGrams: 1000,
        completePourCapacity: 28,
        producedPieceCapacity: 112,
        targetShortfallGrams: 0,
        isLimiting: true,
      }),
      expect.objectContaining({
        role: 'plaster',
        perPourGrams: 26.25,
        targetBatchGrams: 157.5,
        costPerGram: 0.1,
        costPerPour: 2.625,
        completePourCapacity: 38,
        isLimiting: false,
      }),
      expect.objectContaining({
        role: 'glue',
        perPourGrams: 1.75,
        targetBatchGrams: 10.5,
        costPerGram: 0.2,
        costPerPour: 0.35,
        completePourCapacity: 571,
        isLimiting: false,
      }),
    ]);
    expect(result.limitingMaterialIds).toEqual(['MAT-WATER']);
  });

  it('reports insufficient stock and exact theoretical shortfalls without reserving inventory', async () => {
    const { service, materials } = setup([
      material('MAT-WATER', 'Water', 20, 100, { group: 'liquid' }),
      material('MAT-PLASTER', 'Plaster', 100, 120, { group: 'plaster' }),
      material('MAT-GLUE', 'Glue', 200, 5),
    ]);
    const before = await materials.list();

    const result = await service.preview('MOLD-1', 21);

    expect(result.feasibility).toBe('insufficient-current-stock');
    expect(result.maxCompletePoursFromCurrentStock).toBe(2);
    expect(result.maxProducedPiecesFromCurrentStock).toBe(8);
    expect(
      result.materials.find((line) => line.materialId === 'MAT-WATER')
        ?.targetShortfallGrams,
    ).toBe(110);
    expect(
      result.materials.find((line) => line.materialId === 'MAT-PLASTER')
        ?.targetShortfallGrams,
    ).toBe(37.5);
    expect(
      result.materials.find((line) => line.materialId === 'MAT-GLUE')
        ?.targetShortfallGrams,
    ).toBe(5.5);
    expect(await materials.list()).toEqual(before);
  });

  it('remains partial when costing is unavailable but still exposes inventory capacity', async () => {
    const { service } = setup([
      material('MAT-WATER', 'Water', 20, 1000, {
        group: 'liquid',
        purchaseQuantity: 1,
        purchaseUnit: 'bag',
      }),
      material('MAT-PLASTER', 'Plaster', 100, 1000, { group: 'plaster' }),
      material('MAT-GLUE', 'Glue', 200, 1000),
    ]);

    const result = await service.preview('MOLD-1', 4);

    expect(result.status).toBe('partial');
    expect(result.estimatedMaterialCostPerPour).toBeNull();
    expect(result.maxCompletePoursFromCurrentStock).toBe(28);
    expect(result.feasibility).toBe('within-current-stock');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MATERIAL_COST_NOT_DERIVABLE',
          materialId: 'MAT-WATER',
        }),
      ]),
    );
  });

  it('reports unresolved capacity when an on-hand unit cannot be normalized while retaining known costs', async () => {
    const { service } = setup([
      material('MAT-WATER', 'Water', 20, 1, {
        group: 'liquid',
        onHandUnit: 'bag',
        purchaseUnit: 'g',
      }),
      material('MAT-PLASTER', 'Plaster', 100, 1000, { group: 'plaster' }),
      material('MAT-GLUE', 'Glue', 200, 1000),
    ]);

    const result = await service.preview('MOLD-1', 4);

    expect(result.status).toBe('partial');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.maxCompletePoursFromCurrentStock).toBeNull();
    expect(result.estimatedMaterialCostPerPour).toBeCloseTo(3.675);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MATERIAL_INVENTORY_NOT_DERIVABLE',
          materialId: 'MAT-WATER',
        }),
      ]),
    );
  });

  it('uses one complete pour as the operational target when requested quantity is omitted', async () => {
    const { service } = setup();

    const result = await service.preview('MOLD-1');

    expect(result.requestedQuantity).toBeUndefined();
    expect(result.requiredPours).toBe(1);
    expect(result.producedCapacityPieces).toBe(4);
    expect(result.estimatedTargetBatchMaterialCost).toBeCloseTo(3.675);
    expect(result.materials.map((line) => line.targetBatchGrams)).toEqual([
      35,
      26.25,
      1.75,
    ]);
  });

  it('supports the Production workspace zero-quantity exploration without inventing a pour requirement', async () => {
    const { service } = setup();

    const result = await service.preview('MOLD-1', 0);

    expect(result.requestedQuantity).toBe(0);
    expect(result.requiredPours).toBe(0);
    expect(result.producedCapacityPieces).toBe(0);
    expect(result.extraCapacityPieces).toBe(0);
    expect(result.estimatedTargetBatchMaterialCost).toBe(0);
    expect(result.materials.map((line) => line.targetBatchGrams)).toEqual([
      0,
      0,
      0,
    ]);
    expect(result.estimatedMaterialCostPerPour).toBeCloseTo(3.675);
    expect(result.maxProducedPiecesFromCurrentStock).toBe(112);
  });

});
