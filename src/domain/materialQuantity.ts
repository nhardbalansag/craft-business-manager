import type { MaterialCalibrationEvidence } from './materialCalibration';
import { selectLatestMaterialCupWeightCalibration } from './materialCalibration';
import type { Material } from './materials';
import { isMaterialCupWeightBridge } from './materials';
import { calculateMaterialPackageCosting } from './materialCosting';
import type { InputUnit } from './units';
import { areUnitsCompatible, getStandardConversionFactor } from './units';

export type MaterialQuantityConversionSource = 'standard' | 'calibration' | 'manual';

export interface MaterialQuantityNormalization {
  sourceQuantity: number;
  sourceUnit: InputUnit;
  baseUnit: Material['baseUnit'];
  normalizedBaseQuantity: number;
  conversionSource: MaterialQuantityConversionSource;
  calibrationId: string | null;
}

export type MaterialQuantityErrorCode =
  | 'NON_FINITE_QUANTITY'
  | 'MISSING_MATERIAL_CALIBRATION'
  | 'UNRESOLVED_CROSS_DIMENSION_UNIT';

export class MaterialQuantityError extends Error {
  readonly code: MaterialQuantityErrorCode;
  readonly materialId: string;

  constructor(code: MaterialQuantityErrorCode, message: string, materialId: string) {
    super(message);
    this.name = 'MaterialQuantityError';
    this.code = code;
    this.materialId = materialId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function calibrationsForMaterial(
  materialId: string,
  calibrations: readonly MaterialCalibrationEvidence[],
): MaterialCalibrationEvidence[] {
  const key = comparable(materialId);
  return calibrations.filter((record) => comparable(record.materialId) === key);
}

/**
 * Normalizes a measured material quantity into the material's canonical Phase 1 base unit.
 *
 * Precedence:
 * - compatible same-dimension units -> standard conversion;
 * - dry cup -> gram -> latest material calibration;
 * - dry cup -> gram with no calibration -> explicit manual g/cup fallback when the
 *   material itself is purchased by cup;
 * - all other cross-dimension conversions -> controlled error.
 *
 * This helper deliberately does not impose positivity. Callers own their business rule
 * for whether zero/negative quantities are permitted.
 */
export function normalizeMaterialQuantity(
  material: Material,
  quantity: number,
  unit: InputUnit,
  calibrations: readonly MaterialCalibrationEvidence[] = [],
): MaterialQuantityNormalization {
  if (!Number.isFinite(quantity)) {
    throw new MaterialQuantityError(
      'NON_FINITE_QUANTITY',
      `Quantity for ${material.name} must be a finite number.`,
      material.id,
    );
  }

  if (areUnitsCompatible(unit, material.baseUnit)) {
    const factor = getStandardConversionFactor(unit, material.baseUnit);
    return {
      sourceQuantity: quantity,
      sourceUnit: unit,
      baseUnit: material.baseUnit,
      normalizedBaseQuantity: quantity * factor,
      conversionSource: 'standard',
      calibrationId: null,
    };
  }

  if (isMaterialCupWeightBridge(unit, material.baseUnit)) {
    const materialCalibrations = calibrationsForMaterial(material.id, calibrations);
    if (materialCalibrations.length > 0) {
      const calibration = selectLatestMaterialCupWeightCalibration(material, materialCalibrations);
      return {
        sourceQuantity: quantity,
        sourceUnit: unit,
        baseUnit: material.baseUnit,
        normalizedBaseQuantity: quantity * calibration.gramsPerCup,
        conversionSource: 'calibration',
        calibrationId: calibration.evidence.id,
      };
    }

    if (material.purchaseUnit === 'cup' && material.manualBaseUnitsPerPurchaseUnit !== undefined) {
      const packageCosting = calculateMaterialPackageCosting(material, []);
      return {
        sourceQuantity: quantity,
        sourceUnit: unit,
        baseUnit: material.baseUnit,
        normalizedBaseQuantity:
          quantity * packageCosting.effectiveBaseUnitsPerPurchaseUnit,
        conversionSource: 'manual',
        calibrationId: null,
      };
    }

    throw new MaterialQuantityError(
      'MISSING_MATERIAL_CALIBRATION',
      `A cup-to-weight calibration is required to normalize ${material.name}.`,
      material.id,
    );
  }

  throw new MaterialQuantityError(
    'UNRESOLVED_CROSS_DIMENSION_UNIT',
    `Unit ${unit} cannot be converted to ${material.baseUnit} for ${material.name}.`,
    material.id,
  );
}
