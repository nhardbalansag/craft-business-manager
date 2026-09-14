import { describe, expect, it } from 'vitest';
import type { MaterialCalibrationEvidence } from '../../domain/materialCalibration';
import type { Material } from '../../domain/materials';
import type { WasteAdjustedMaterialRequirement } from '../../domain/productionRequirements';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import type { ProductionRequirementPlanResult } from './ProductionRequirementService';
import { ProductionCapacityService, type ProductionRequirementCapacityProvider } from './ProductionCapacityService';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 1,
    onHandUnit: 'kg',
    isActive: true,
    ...overrides,
  };
}

function requirement(
  materialId: string,
  baseUnit: Material['baseUnit'],
  plannedBaseQuantityPerProduct: number,
): WasteAdjustedMaterialRequirement {
  return {
    materialId,
    baseUnit,
    source: 'fixed',
    effectiveBaseQuantityPerProduct: plannedBaseQuantityPerProduct,
    safetyWasteRate: 0,
    safetyWasteMultiplier: 1,
    wasteReserveBaseQuantityPerProduct: 0,
    plannedBaseQuantityPerProduct,
    plannedBatchBaseQuantity: 0,
    contributions: [
      {
        source: 'fixed',
        sourceId: `RI-${materialId}`,
        role: 'consumable',
        conversionSource: 'standard',
        calibrationId: null,
        effectiveBaseQuantityPerProduct: plannedBaseQuantityPerProduct,
        wasteReserveBaseQuantityPerProduct: 0,
        plannedBaseQuantityPerProduct,
        plannedBatchBaseQuantity: 0,
      },
    ],
  };
}

function plan(overrides: Partial<ProductionRequirementPlanResult> = {}): ProductionRequirementPlanResult {
  return {
    productId: 'ART-001',
    productIsActive: true,
    status: 'ready',
    effectiveYieldSampleId: null,
    skippedInvalidYieldSampleIds: [],
    issues: [],
    plannedQuantity: 0,
    safetyWasteRate: 0,
    safetyWastePercentage: 0,
    safetyWasteMultiplier: 1,
    observedDefectRateIncluded: false,
    requirements: [requirement('MAT-PLASTER', 'g', 75)],
    ...overrides,
  };
}

function provider(value: ProductionRequirementPlanResult): ProductionRequirementCapacityProvider {
  return {
    async plan(_productId: string, plannedQuantity: number) {
      expect(plannedQuantity).toBe(0);
      return value;
    },
  };
}

describe('ProductionCapacityService', () => {
  it('combines waste-adjusted requirements with normalized Phase 1 inventory', async () => {
    const materials = new InMemoryMaterialRepository([
      material({ onHandQuantity: 1, onHandUnit: 'kg' }),
      material({
        id: 'MAT-WATER',
        name: 'Water',
        group: 'liquid',
        baseUnit: 'mL',
        purchaseQuantity: 1,
        purchaseUnit: 'L',
        packageCost: 0,
        onHandQuantity: 0.5,
        onHandUnit: 'L',
      }),
      material({
        id: 'MAT-BRUSH',
        name: 'Brush',
        group: 'accessory',
        baseUnit: 'pc',
        purchaseQuantity: 10,
        purchaseUnit: 'pc',
        packageCost: 20,
        onHandQuantity: 8,
        onHandUnit: 'pc',
      }),
    ]);

    const result = await new ProductionCapacityService(
      provider(
        plan({
          requirements: [
            requirement('MAT-PLASTER', 'g', 78.75),
            requirement('MAT-WATER', 'mL', 47.25),
            requirement('MAT-BRUSH', 'pc', 1),
          ],
          safetyWasteRate: 0.05,
          safetyWastePercentage: 5,
          safetyWasteMultiplier: 1.05,
        }),
      ),
      materials,
      new InMemoryCalibrationRepository(),
    ).estimate('ART-001');

    expect(result.status).toBe('ready');
    expect(result.produciblePieces).toBe(8);
    expect(result.limitingMaterialIds).toEqual(['MAT-BRUSH']);
    expect(result.materials).toEqual([
      expect.objectContaining({ materialId: 'MAT-BRUSH', capacityPieces: 8, inventoryConversionSource: 'standard' }),
      expect.objectContaining({ materialId: 'MAT-PLASTER', normalizedOnHandBaseQuantity: 1000, capacityPieces: 12 }),
      expect.objectContaining({ materialId: 'MAT-WATER', normalizedOnHandBaseQuantity: 500, capacityPieces: 10 }),
    ]);
  });

  it('uses material calibration when stock is entered in cups', async () => {
    const plaster = material({ onHandQuantity: 3, onHandUnit: 'cup' });
    const calibration: MaterialCalibrationEvidence = {
      id: 'CAL-PLASTER-001',
      materialId: plaster.id,
      measuredVolume: 5,
      volumeUnit: 'cup',
      knownWeight: 1,
      weightUnit: 'kg',
      recordedAt: '2026-09-14T00:00:00.000Z',
    };

    const result = await new ProductionCapacityService(
      provider(plan({ requirements: [requirement(plaster.id, 'g', 78.75)] })),
      new InMemoryMaterialRepository([plaster]),
      new InMemoryCalibrationRepository([calibration]),
    ).estimate('ART-001');

    expect(result.status).toBe('ready');
    expect(result.produciblePieces).toBe(7);
    expect(result.materials[0]).toMatchObject({
      normalizedOnHandBaseQuantity: 600,
      inventoryConversionSource: 'calibration',
      inventoryCalibrationId: 'CAL-PLASTER-001',
      capacityPieces: 7,
      isLimiting: true,
    });
  });

  it('returns partial without publishing an overall capacity when a required material is missing', async () => {
    const result = await new ProductionCapacityService(
      provider(
        plan({
          requirements: [
            requirement('MAT-PLASTER', 'g', 75),
            requirement('MAT-MISSING', 'pc', 1),
          ],
        }),
      ),
      new InMemoryMaterialRepository([material()]),
      new InMemoryCalibrationRepository(),
    ).estimate('ART-001');

    expect(result.status).toBe('partial');
    expect(result.produciblePieces).toBeNull();
    expect(result.limitingMaterialIds).toEqual([]);
    expect(result.materials[0]).toMatchObject({ materialId: 'MAT-PLASTER', capacityPieces: 13, isLimiting: false });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'MATERIAL_NOT_FOUND', materialId: 'MAT-MISSING' }));
  });

  it('returns partial when current cup inventory cannot be normalized', async () => {
    const plaster = material({ onHandQuantity: 3, onHandUnit: 'cup' });
    const result = await new ProductionCapacityService(
      provider(plan()),
      new InMemoryMaterialRepository([plaster]),
      new InMemoryCalibrationRepository(),
    ).estimate('ART-001');

    expect(result.status).toBe('not-ready');
    expect(result.produciblePieces).toBeNull();
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'INVENTORY_NOT_DERIVABLE',
      materialId: 'MAT-PLASTER',
    }));
  });

  it('does not publish final capacity when upstream recipe requirements are partial', async () => {
    const result = await new ProductionCapacityService(
      provider(
        plan({
          status: 'partial',
          issues: [{ code: 'FIXED_ITEM_NOT_DERIVABLE', sourceId: 'RI-BROKEN', message: 'Broken recipe line.' }],
        }),
      ),
      new InMemoryMaterialRepository([material()]),
      new InMemoryCalibrationRepository(),
    ).estimate('ART-001');

    expect(result.status).toBe('partial');
    expect(result.produciblePieces).toBeNull();
    expect(result.limitingMaterialIds).toEqual([]);
    expect(result.materials[0]).toMatchObject({ capacityPieces: 13, isLimiting: false });
    expect(result.issues[0]).toMatchObject({
      code: 'UPSTREAM_REQUIREMENT_ISSUE',
      sourceCode: 'FIXED_ITEM_NOT_DERIVABLE',
      sourceId: 'RI-BROKEN',
    });
  });

  it('returns not-ready when upstream planning has no requirements', async () => {
    const result = await new ProductionCapacityService(
      provider(plan({ status: 'not-ready', requirements: [], issues: [{ code: 'NO_REQUIREMENTS', message: 'No requirements.' }] })),
      new InMemoryMaterialRepository([material()]),
      new InMemoryCalibrationRepository(),
    ).estimate('ART-001');

    expect(result.status).toBe('not-ready');
    expect(result.produciblePieces).toBeNull();
    expect(result.materials).toEqual([]);
  });

  it('blocks an archived required material for an active product', async () => {
    const result = await new ProductionCapacityService(
      provider(plan()),
      new InMemoryMaterialRepository([material({ isActive: false })]),
      new InMemoryCalibrationRepository(),
    ).estimate('ART-001');

    expect(result.status).toBe('not-ready');
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'MATERIAL_INACTIVE' }));
  });

  it('allows zero stock as a valid ready capacity of zero', async () => {
    const result = await new ProductionCapacityService(
      provider(plan()),
      new InMemoryMaterialRepository([material({ onHandQuantity: 0, onHandUnit: 'g' })]),
      new InMemoryCalibrationRepository(),
    ).estimate('ART-001');

    expect(result.status).toBe('ready');
    expect(result.produciblePieces).toBe(0);
    expect(result.limitingMaterialIds).toEqual(['MAT-PLASTER']);
  });
});
