import type { Material } from './materials';
import { isMaterialCupWeightBridge, isMaterialPackageUnit } from './materials';
import {
  selectLatestMaterialCupWeightCalibration,
  type MaterialCalibrationEvidence,
} from './materialCalibration';
import { calculateMaterialPackageCosting } from './materialCosting';
import { areUnitsCompatible, getStandardConversionFactor, isSupportedUnit } from './units';

export type OnHandConversionSource = 'standard' | 'calibration' | 'manual' | 'purchase-package';

export interface MaterialOnHandNormalization {
  enteredQuantity: number;
  enteredUnit: Material['onHandUnit'];
  baseUnit: Material['baseUnit'];
  baseUnitsPerOnHandUnit: number;
  normalizedBaseQuantity: number;
  conversionSource: OnHandConversionSource;
  calibrationId: string | null;
  purchasePackageConversionSource: 'manual' | 'standard' | 'calibration' | null;
}

export interface MaterialInventoryValuation {
  normalizedBaseQuantity: number;
  baseUnit: Material['baseUnit'];
  costPerBaseUnit: number;
  inventoryValue: number;
}

export type MaterialInventoryErrorCode =
  | 'NON_FINITE_ON_HAND_QUANTITY'
  | 'UNRESOLVED_PACKAGE_ON_HAND_UNIT'
  | 'UNRESOLVED_CROSS_DIMENSION_UNIT'
  | 'MISSING_MATERIAL_CALIBRATION'
  | 'NEGATIVE_ON_HAND_QUANTITY';

export class MaterialInventoryError extends Error {
  readonly code: MaterialInventoryErrorCode;
  readonly materialId: string;

  constructor(code: MaterialInventoryErrorCode, message: string, materialId: string) {
    super(message);
    this.name = 'MaterialInventoryError';
    this.code = code;
    this.materialId = materialId;
  }
}

/**
 * Normalizes the user-entered on-hand quantity into the material's canonical base unit.
 *
 * Precedence:
 * - compatible standard units -> standard conversion;
 * - dry cup -> gram -> latest material calibration;
 * - dry cup -> gram with no calibration -> manual g/cup fallback only when cup is
 *   the material's configured purchase unit;
 * - configured package label -> the package's effective conversion;
 * - everything else -> controlled error.
 *
 * Negative quantities are preserved mathematically here. Higher-level inventory
 * valuation owns the business rule that inventory cannot be negative.
 */
export function normalizeMaterialOnHand(
  material: Material,
  evidenceRecords: readonly MaterialCalibrationEvidence[] = [],
): MaterialOnHandNormalization {
  if (!Number.isFinite(material.onHandQuantity)) {
    throw new MaterialInventoryError(
      'NON_FINITE_ON_HAND_QUANTITY',
      `On-hand quantity for ${material.name} must be a finite number.`,
      material.id,
    );
  }

  if (isSupportedUnit(material.onHandUnit)) {
    if (areUnitsCompatible(material.onHandUnit, material.baseUnit)) {
      const factor = getStandardConversionFactor(material.onHandUnit, material.baseUnit);
      return {
        enteredQuantity: material.onHandQuantity,
        enteredUnit: material.onHandUnit,
        baseUnit: material.baseUnit,
        baseUnitsPerOnHandUnit: factor,
        normalizedBaseQuantity: material.onHandQuantity * factor,
        conversionSource: 'standard',
        calibrationId: null,
        purchasePackageConversionSource: null,
      };
    }

    if (isMaterialCupWeightBridge(material.onHandUnit, material.baseUnit)) {
      if (evidenceRecords.length > 0) {
        const calibration = selectLatestMaterialCupWeightCalibration(material, evidenceRecords);
        return {
          enteredQuantity: material.onHandQuantity,
          enteredUnit: material.onHandUnit,
          baseUnit: material.baseUnit,
          baseUnitsPerOnHandUnit: calibration.gramsPerCup,
          normalizedBaseQuantity: material.onHandQuantity * calibration.gramsPerCup,
          conversionSource: 'calibration',
          calibrationId: calibration.evidence.id,
          purchasePackageConversionSource: null,
        };
      }

      if (material.purchaseUnit === 'cup' && material.manualBaseUnitsPerPurchaseUnit !== undefined) {
        const packageCosting = calculateMaterialPackageCosting(material, evidenceRecords);
        return {
          enteredQuantity: material.onHandQuantity,
          enteredUnit: material.onHandUnit,
          baseUnit: material.baseUnit,
          baseUnitsPerOnHandUnit: packageCosting.effectiveBaseUnitsPerPurchaseUnit,
          normalizedBaseQuantity:
            material.onHandQuantity * packageCosting.effectiveBaseUnitsPerPurchaseUnit,
          conversionSource: 'manual',
          calibrationId: null,
          purchasePackageConversionSource: null,
        };
      }

      throw new MaterialInventoryError(
        'MISSING_MATERIAL_CALIBRATION',
        `A cup-to-weight calibration is required to normalize ${material.name} stock entered in cups.`,
        material.id,
      );
    }

    throw new MaterialInventoryError(
      'UNRESOLVED_CROSS_DIMENSION_UNIT',
      `On-hand unit ${material.onHandUnit} cannot be converted to ${material.baseUnit} for ${material.name}.`,
      material.id,
    );
  }

  if (isMaterialPackageUnit(material.onHandUnit)) {
    if (material.onHandUnit !== material.purchaseUnit) {
      throw new MaterialInventoryError(
        'UNRESOLVED_PACKAGE_ON_HAND_UNIT',
        `On-hand unit ${material.onHandUnit} for ${material.name} cannot be normalized because the material is purchased as ${material.purchaseUnit}. Enter stock in ${material.baseUnit} or the configured purchase package.`,
        material.id,
      );
    }

    const packageCosting = calculateMaterialPackageCosting(material, evidenceRecords);
    const factor = packageCosting.effectiveBaseUnitsPerPurchaseUnit;

    return {
      enteredQuantity: material.onHandQuantity,
      enteredUnit: material.onHandUnit,
      baseUnit: material.baseUnit,
      baseUnitsPerOnHandUnit: factor,
      normalizedBaseQuantity: material.onHandQuantity * factor,
      conversionSource: 'purchase-package',
      calibrationId: packageCosting.effectiveCalibrationId,
      purchasePackageConversionSource: packageCosting.effectiveConversionSource,
    };
  }

  throw new MaterialInventoryError(
    'UNRESOLVED_PACKAGE_ON_HAND_UNIT',
    `On-hand unit ${String(material.onHandUnit)} for ${material.name} cannot be normalized.`,
    material.id,
  );
}

/**
 * Calculates the current value of a material's on-hand inventory.
 *
 * Formula:
 *   inventory value = normalized on-hand base quantity × cost per base unit
 */
export function calculateMaterialInventoryValuation(
  material: Material,
  evidenceRecords: readonly MaterialCalibrationEvidence[] = [],
): MaterialInventoryValuation {
  const normalized = normalizeMaterialOnHand(material, evidenceRecords);

  if (normalized.normalizedBaseQuantity < 0) {
    throw new MaterialInventoryError(
      'NEGATIVE_ON_HAND_QUANTITY',
      `On-hand quantity for ${material.name} cannot be negative.`,
      material.id,
    );
  }

  const costing = calculateMaterialPackageCosting(material, evidenceRecords);

  return {
    normalizedBaseQuantity: normalized.normalizedBaseQuantity,
    baseUnit: normalized.baseUnit,
    costPerBaseUnit: costing.costPerBaseUnit,
    inventoryValue: normalized.normalizedBaseQuantity * costing.costPerBaseUnit,
  };
}
