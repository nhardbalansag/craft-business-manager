import { describe, expect, it } from 'vitest';
import { CalibrationApplicationError, CalibrationService } from './calibrations/CalibrationService';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';
import { calculateMaterialInventoryValuation } from '../domain/materialInventory';
import type { Material } from '../domain/materials';

function workflow() {
  const materialRepository = new InMemoryMaterialRepository();
  const calibrationRepository = new InMemoryCalibrationRepository();
  const materialService = new MaterialService(materialRepository, async (materialId) => {
    const key = materialId.trim().toLocaleLowerCase();
    return (await calibrationRepository.list()).filter(
      (record) => record.materialId.trim().toLocaleLowerCase() === key,
    );
  });
  const calibrationService = new CalibrationService(calibrationRepository, materialRepository);

  return { materialRepository, calibrationRepository, materialService, calibrationService };
}

function plasterMaterial(): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster of Paris',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 500,
    onHandUnit: 'g',
    source: {
      vendorName: 'Divisoria Craft Supply',
      source: '168 Mall branch',
      purchaseLink: 'https://example.com/plaster',
      contactNumber: '0917 555 0101',
      socialPage: '@divisoriacrafts',
      notes: 'Ask for wholesale price',
    },
    notes: 'White casting plaster',
    isActive: true,
  };
}

describe('Phase 1 integrated materials workflow', () => {
  it('runs a calibrated plaster workflow from purchase/source entry through cup stock valuation', async () => {
    const { materialService, calibrationService } = workflow();

    await materialService.createMaterial(plasterMaterial());

    const first = await calibrationService.createCalibration({
      id: 'CAL-PLASTER-001',
      materialId: 'MAT-PLASTER',
      measuredVolume: 5,
      volumeUnit: 'cup',
      knownWeight: 1,
      weightUnit: 'kg',
      recordedAt: '2026-09-14T08:00:00.000Z',
      notes: 'Initial real batch measurement',
    });
    expect(first.gramsPerCup).toBeCloseTo(200, 10);

    const updated = await materialService.updateMaterial('MAT-PLASTER', {
      onHandQuantity: 3,
      onHandUnit: 'cup',
    });
    const evidence = await calibrationService.listCalibrations('MAT-PLASTER');
    const valuation = calculateMaterialInventoryValuation(updated, evidence);

    expect(valuation.normalizedBaseQuantity).toBeCloseTo(600, 10);
    expect(valuation.costPerBaseUnit).toBeCloseTo(0.066, 10);
    expect(valuation.inventoryValue).toBeCloseTo(39.6, 10);

    expect((await materialService.listMaterials({ query: '168 mall' })).map(({ id }) => id)).toEqual([
      'MAT-PLASTER',
    ]);
    expect((await materialService.listMaterials({ query: 'divisoriacrafts' })).map(({ id }) => id)).toEqual([
      'MAT-PLASTER',
    ]);
  });

  it('uses the latest calibration and prevents deleting the last calibration required by saved cup stock', async () => {
    const { materialService, calibrationService } = workflow();
    await materialService.createMaterial(plasterMaterial());

    await calibrationService.createCalibration({
      id: 'CAL-PLASTER-001',
      materialId: 'MAT-PLASTER',
      measuredVolume: 5,
      volumeUnit: 'cup',
      knownWeight: 1,
      weightUnit: 'kg',
      recordedAt: '2026-09-14T08:00:00.000Z',
    });
    await calibrationService.createCalibration({
      id: 'CAL-PLASTER-002',
      materialId: 'MAT-PLASTER',
      measuredVolume: 5,
      volumeUnit: 'cup',
      knownWeight: 1.05,
      weightUnit: 'kg',
      recordedAt: '2026-09-14T09:00:00.000Z',
    });

    await materialService.updateMaterial('MAT-PLASTER', {
      onHandQuantity: 3,
      onHandUnit: 'cup',
    });

    expect((await calibrationService.getEffectiveCalibration('MAT-PLASTER'))?.gramsPerCup).toBeCloseTo(210, 10);

    const material = await materialService.getMaterial('MAT-PLASTER');
    expect(material).not.toBeNull();
    const evidence = await calibrationService.listCalibrations('MAT-PLASTER');
    expect(calculateMaterialInventoryValuation(material!, evidence).normalizedBaseQuantity).toBeCloseTo(630, 10);

    await expect(calibrationService.deleteCalibration('CAL-PLASTER-002')).resolves.toBeUndefined();
    expect((await calibrationService.getEffectiveCalibration('MAT-PLASTER'))?.gramsPerCup).toBeCloseTo(200, 10);

    await expect(calibrationService.deleteCalibration('CAL-PLASTER-001')).rejects.toMatchObject({
      code: 'CALIBRATION_IN_USE',
      calibrationId: 'CAL-PLASTER-001',
      materialId: 'MAT-PLASTER',
    } satisfies Partial<CalibrationApplicationError>);

    await materialService.updateMaterial('MAT-PLASTER', {
      onHandQuantity: 600,
      onHandUnit: 'g',
    });
    await expect(calibrationService.deleteCalibration('CAL-PLASTER-001')).resolves.toBeUndefined();
    expect(await calibrationService.getEffectiveCalibration('MAT-PLASTER')).toBeNull();
  });

  it('runs count-package and volume-standard workflows without calibration', async () => {
    const { materialService, calibrationService } = workflow();

    const labels = await materialService.createMaterial({
      id: 'MAT-LABEL',
      name: 'Product Label',
      group: 'packaging',
      baseUnit: 'pc',
      purchaseQuantity: 1,
      purchaseUnit: 'pack',
      packageCost: 120,
      manualBaseUnitsPerPurchaseUnit: 100,
      onHandQuantity: 0.5,
      onHandUnit: 'pack',
      source: { vendorName: 'Print Shop', source: 'Quiapo branch' },
      isActive: true,
    });
    const labelValue = calculateMaterialInventoryValuation(labels);
    expect(labelValue.normalizedBaseQuantity).toBe(50);
    expect(labelValue.costPerBaseUnit).toBeCloseTo(1.2, 10);
    expect(labelValue.inventoryValue).toBeCloseTo(60, 10);

    const fragrance = await materialService.createMaterial({
      id: 'MAT-FRAG',
      name: 'Vanilla Fragrance Oil',
      group: 'fragrance',
      baseUnit: 'mL',
      purchaseQuantity: 1,
      purchaseUnit: 'L',
      packageCost: 400,
      onHandQuantity: 250,
      onHandUnit: 'mL',
      source: { vendorName: 'Candle Supply PH' },
      isActive: true,
    });
    const fragranceValue = calculateMaterialInventoryValuation(fragrance);
    expect(fragranceValue.normalizedBaseQuantity).toBe(250);
    expect(fragranceValue.costPerBaseUnit).toBeCloseTo(0.4, 10);
    expect(fragranceValue.inventoryValue).toBeCloseTo(100, 10);

    expect(await calibrationService.listCalibrations()).toEqual([]);

    await materialService.archiveMaterial('MAT-LABEL');
    expect((await materialService.listMaterials({ active: false })).map(({ id }) => id)).toEqual(['MAT-LABEL']);
    expect((await materialService.listMaterials({ active: true })).map(({ id }) => id)).toEqual(['MAT-FRAG']);
  });

  it('keeps supplier-only edits financially neutral', async () => {
    const { materialService } = workflow();
    await materialService.createMaterial(plasterMaterial());

    const before = await materialService.getMaterial('MAT-PLASTER');
    expect(before).not.toBeNull();
    const beforeValue = calculateMaterialInventoryValuation(before!);

    const after = await materialService.updateMaterial('MAT-PLASTER', {
      source: {
        vendorName: 'New Vendor Name',
        source: 'Different branch',
        purchaseLink: 'https://example.com/new-plaster-link',
        contactNumber: '0999 000 0000',
      },
    });
    const afterValue = calculateMaterialInventoryValuation(after);

    expect(afterValue).toEqual(beforeValue);
    expect(after.source?.vendorName).toBe('New Vendor Name');
  });
});
