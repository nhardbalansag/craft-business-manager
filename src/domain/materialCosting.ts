import type { Material } from './materials';
import { isMaterialCupWeightBridge, isMaterialPackageUnit } from './materials';
import {
  selectLatestMaterialCupWeightCalibration,
  type MaterialCalibrationEvidence,
} from './materialCalibration';
import { areUnitsCompatible, getStandardConversionFactor, isSupportedUnit } from './units';

export type PackageConversionSource = 'manual' | 'standard' | 'calibration';

export interface MaterialPackageCosting {
  standardBaseUnitsPerPurchaseUnit: number | null;
  manualBaseUnitsPerPurchaseUnit: number | null;
  calibrationBaseUnitsPerPurchaseUnit: number | null;
  effectiveBaseUnitsPerPurchaseUnit: number;
  effectiveConversionSource: PackageConversionSource;
  effectiveCalibrationId: string | null;
  packageBaseQuantity: number;
  costPerBaseUnit: number;
}

export type MaterialCostingErrorCode =
  | 'NON_FINITE_PURCHASE_QUANTITY'
  | 'NON_POSITIVE_PURCHASE_QUANTITY'
  | 'NON_FINITE_PACKAGE_COST'
  | 'NEGATIVE_PACKAGE_COST'
  | 'INVALID_MANUAL_CONVERSION'
  | 'MISSING_PACKAGE_CONVERSION'
  | 'MISSING_MATERIAL_CALIBRATION';

export class MaterialCostingError extends Error {
  readonly code: MaterialCostingErrorCode;
  readonly materialId: string;

  constructor(code: MaterialCostingErrorCode, message: string, materialId: string) {
    super(message);
    this.name = 'MaterialCostingError';
    this.code = code;
    this.materialId = materialId;
  }
}

function standardConversion(material: Material): number | null {
  if (!isSupportedUnit(material.purchaseUnit)) return null;
  if (!areUnitsCompatible(material.purchaseUnit, material.baseUnit)) return null;
  return getStandardConversionFactor(material.purchaseUnit, material.baseUnit);
}

function manualConversion(material: Material): number | null {
  const value = material.manualBaseUnitsPerPurchaseUnit;
  return value === undefined ? null : value;
}

function calibratedCupWeightConversion(
  material: Material,
  evidenceRecords: readonly MaterialCalibrationEvidence[],
): { factor: number; calibrationId: string } | null {
  if (!isMaterialCupWeightBridge(material.purchaseUnit, material.baseUnit)) return null;
  if (evidenceRecords.length === 0) return null;

  const calibration = selectLatestMaterialCupWeightCalibration(material, evidenceRecords);
  return {
    factor: calibration.gramsPerCup,
    calibrationId: calibration.evidence.id,
  };
}

/**
 * Derives package conversion and cost values from authoritative Material source data.
 *
 * Precedence is explicit:
 *
 * Ordinary same-dimension/package conversion:
 *   manual conversion -> standard same-dimension conversion -> controlled error
 *
 * Dry cup -> gram conversion:
 *   material calibration -> manual g/cup fallback -> controlled error
 *
 * Derived values are intentionally not persisted on Material.
 */
export function calculateMaterialPackageCosting(
  material: Material,
  evidenceRecords: readonly MaterialCalibrationEvidence[] = [],
): MaterialPackageCosting {
  if (!Number.isFinite(material.purchaseQuantity)) {
    throw new MaterialCostingError(
      'NON_FINITE_PURCHASE_QUANTITY',
      `Purchase quantity for ${material.name} must be a finite number.`,
      material.id,
    );
  }

  if (material.purchaseQuantity <= 0) {
    throw new MaterialCostingError(
      'NON_POSITIVE_PURCHASE_QUANTITY',
      `Purchase quantity for ${material.name} must be greater than zero.`,
      material.id,
    );
  }

  if (!Number.isFinite(material.packageCost)) {
    throw new MaterialCostingError(
      'NON_FINITE_PACKAGE_COST',
      `Package cost for ${material.name} must be a finite number.`,
      material.id,
    );
  }

  if (material.packageCost < 0) {
    throw new MaterialCostingError(
      'NEGATIVE_PACKAGE_COST',
      `Package cost for ${material.name} cannot be negative.`,
      material.id,
    );
  }

  const standard = standardConversion(material);
  const manual = manualConversion(material);

  if (manual !== null && (!Number.isFinite(manual) || manual <= 0)) {
    throw new MaterialCostingError(
      'INVALID_MANUAL_CONVERSION',
      `Manual conversion for ${material.name} must be a finite number greater than zero.`,
      material.id,
    );
  }

  const calibration = calibratedCupWeightConversion(material, evidenceRecords);
  const isCupWeightBridge = isMaterialCupWeightBridge(material.purchaseUnit, material.baseUnit);

  let effectiveBaseUnitsPerPurchaseUnit: number;
  let effectiveConversionSource: PackageConversionSource;
  let effectiveCalibrationId: string | null = null;

  if (isCupWeightBridge) {
    if (calibration) {
      effectiveBaseUnitsPerPurchaseUnit = calibration.factor;
      effectiveConversionSource = 'calibration';
      effectiveCalibrationId = calibration.calibrationId;
    } else if (manual !== null) {
      effectiveBaseUnitsPerPurchaseUnit = manual;
      effectiveConversionSource = 'manual';
    } else {
      throw new MaterialCostingError(
        'MISSING_MATERIAL_CALIBRATION',
        `A cup-to-weight calibration is required for ${material.name}, or provide an explicit manual ${material.baseUnit}/cup conversion.`,
        material.id,
      );
    }
  } else if (manual !== null) {
    effectiveBaseUnitsPerPurchaseUnit = manual;
    effectiveConversionSource = 'manual';
  } else if (standard !== null) {
    effectiveBaseUnitsPerPurchaseUnit = standard;
    effectiveConversionSource = 'standard';
  } else {
    const packageLabel = isMaterialPackageUnit(material.purchaseUnit)
      ? material.purchaseUnit
      : String(material.purchaseUnit);
    throw new MaterialCostingError(
      'MISSING_PACKAGE_CONVERSION',
      `A manual conversion is required for ${material.name}: define how many ${material.baseUnit} are in 1 ${packageLabel}.`,
      material.id,
    );
  }

  const packageBaseQuantity = material.purchaseQuantity * effectiveBaseUnitsPerPurchaseUnit;

  return {
    standardBaseUnitsPerPurchaseUnit: standard,
    manualBaseUnitsPerPurchaseUnit: manual,
    calibrationBaseUnitsPerPurchaseUnit: calibration?.factor ?? null,
    effectiveBaseUnitsPerPurchaseUnit,
    effectiveConversionSource,
    effectiveCalibrationId,
    packageBaseQuantity,
    costPerBaseUnit: material.packageCost / packageBaseQuantity,
  };
}
