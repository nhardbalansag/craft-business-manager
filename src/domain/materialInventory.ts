import type { Material } from './materials';
import { isMaterialPackageUnit } from './materials';
import { calculateMaterialPackageCosting } from './materialCosting';
import { getStandardConversionFactor, isSupportedUnit } from './units';

export type OnHandConversionSource = 'standard' | 'purchase-package';

export interface MaterialOnHandNormalization {
  enteredQuantity: number;
  enteredUnit: Material['onHandUnit'];
  baseUnit: Material['baseUnit'];
  baseUnitsPerOnHandUnit: number;
  normalizedBaseQuantity: number;
  conversionSource: OnHandConversionSource;
}

export type MaterialInventoryErrorCode =
  | 'NON_FINITE_ON_HAND_QUANTITY'
  | 'UNRESOLVED_PACKAGE_ON_HAND_UNIT';

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
 * Rules:
 * - standard same-dimension units use the shared unit conversion engine;
 * - a package label can be normalized only when it is the material's purchase unit,
 *   because only that package has an authoritative effective package conversion;
 * - dry cross-dimension cases such as cup -> g remain unavailable until Phase 1.4.
 *
 * Negative quantities are preserved mathematically here. Phase 1.3C owns the
 * business rule that inventory cannot be negative.
 */
export function normalizeMaterialOnHand(material: Material): MaterialOnHandNormalization {
  if (!Number.isFinite(material.onHandQuantity)) {
    throw new MaterialInventoryError(
      'NON_FINITE_ON_HAND_QUANTITY',
      `On-hand quantity for ${material.name} must be a finite number.`,
      material.id,
    );
  }

  if (isSupportedUnit(material.onHandUnit)) {
    const factor = getStandardConversionFactor(material.onHandUnit, material.baseUnit);
    return {
      enteredQuantity: material.onHandQuantity,
      enteredUnit: material.onHandUnit,
      baseUnit: material.baseUnit,
      baseUnitsPerOnHandUnit: factor,
      normalizedBaseQuantity: material.onHandQuantity * factor,
      conversionSource: 'standard',
    };
  }

  if (isMaterialPackageUnit(material.onHandUnit)) {
    if (material.onHandUnit !== material.purchaseUnit) {
      throw new MaterialInventoryError(
        'UNRESOLVED_PACKAGE_ON_HAND_UNIT',
        `On-hand unit ${material.onHandUnit} for ${material.name} cannot be normalized because the material is purchased as ${material.purchaseUnit}. Enter stock in ${material.baseUnit} or the configured purchase package.`,
        material.id,
      );
    }

    const packageCosting = calculateMaterialPackageCosting(material);
    const factor = packageCosting.effectiveBaseUnitsPerPurchaseUnit;

    return {
      enteredQuantity: material.onHandQuantity,
      enteredUnit: material.onHandUnit,
      baseUnit: material.baseUnit,
      baseUnitsPerOnHandUnit: factor,
      normalizedBaseQuantity: material.onHandQuantity * factor,
      conversionSource: 'purchase-package',
    };
  }

  // Material's TypeScript contract makes this unreachable for typed application data,
  // but keeping the guard explicit protects future untyped import boundaries.
  throw new MaterialInventoryError(
    'UNRESOLVED_PACKAGE_ON_HAND_UNIT',
    `On-hand unit ${String(material.onHandUnit)} for ${material.name} cannot be normalized.`,
    material.id,
  );
}
