import type { Material } from './materials';
import { isMaterialPackageUnit } from './materials';
import { getStandardConversionFactor, isSupportedUnit } from './units';

export type PackageConversionSource = 'manual' | 'standard';

export interface MaterialPackageCosting {
  standardBaseUnitsPerPurchaseUnit: number | null;
  manualBaseUnitsPerPurchaseUnit: number | null;
  effectiveBaseUnitsPerPurchaseUnit: number;
  effectiveConversionSource: PackageConversionSource;
  packageBaseQuantity: number;
  costPerBaseUnit: number;
}

export type MaterialCostingErrorCode =
  | 'NON_FINITE_PURCHASE_QUANTITY'
  | 'NON_POSITIVE_PURCHASE_QUANTITY'
  | 'NON_FINITE_PACKAGE_COST'
  | 'NEGATIVE_PACKAGE_COST'
  | 'INVALID_MANUAL_CONVERSION'
  | 'MISSING_PACKAGE_CONVERSION';

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
  return getStandardConversionFactor(material.purchaseUnit, material.baseUnit);
}

function manualConversion(material: Material): number | null {
  const value = material.manualBaseUnitsPerPurchaseUnit;
  return value === undefined ? null : value;
}

/**
 * Derives package conversion and cost values from authoritative Material source data.
 *
 * Precedence is explicit:
 *   manual conversion -> standard same-dimension conversion -> controlled error
 *
 * Derived values are intentionally not persisted on Material.
 */
export function calculateMaterialPackageCosting(material: Material): MaterialPackageCosting {
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

  if (manual === null && standard === null) {
    const packageLabel = isMaterialPackageUnit(material.purchaseUnit)
      ? material.purchaseUnit
      : String(material.purchaseUnit);
    throw new MaterialCostingError(
      'MISSING_PACKAGE_CONVERSION',
      `A manual conversion is required for ${material.name}: define how many ${material.baseUnit} are in 1 ${packageLabel}.`,
      material.id,
    );
  }

  const effectiveBaseUnitsPerPurchaseUnit = manual ?? standard!;
  const packageBaseQuantity = material.purchaseQuantity * effectiveBaseUnitsPerPurchaseUnit;

  return {
    standardBaseUnitsPerPurchaseUnit: standard,
    manualBaseUnitsPerPurchaseUnit: manual,
    effectiveBaseUnitsPerPurchaseUnit,
    effectiveConversionSource: manual !== null ? 'manual' : 'standard',
    packageBaseQuantity,
    costPerBaseUnit: material.packageCost / packageBaseQuantity,
  };
}
