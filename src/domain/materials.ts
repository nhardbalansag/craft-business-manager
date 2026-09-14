import type { BaseUnit, InputUnit } from './units';
import { areUnitsCompatible, isSupportedUnit } from './units';

export const MATERIAL_GROUPS = [
  'plaster',
  'wax',
  'liquid',
  'fragrance',
  'colorant',
  'wick',
  'container',
  'paint',
  'packaging',
  'accessory',
  'other',
] as const;

export type MaterialGroup = (typeof MATERIAL_GROUPS)[number];

export const MATERIAL_PACKAGE_UNITS = [
  'bag',
  'bottle',
  'box',
  'can',
  'jar',
  'pack',
  'pouch',
  'roll',
  'set',
  'sheet',
  'spool',
  'tube',
] as const;

export type MaterialPackageUnit = (typeof MATERIAL_PACKAGE_UNITS)[number];
export type MaterialPurchaseUnit = InputUnit | MaterialPackageUnit;

export interface Material {
  id: string;
  name: string;
  group: MaterialGroup;
  baseUnit: BaseUnit;

  /** Quantity printed/defined for one purchased package, e.g. 1 kg or 100 pc. */
  purchaseQuantity: number;
  /** Standard measurement unit or package label such as bag/box/pack. */
  purchaseUnit: MaterialPurchaseUnit;
  /** Actual amount paid for the purchased package, before later landed-cost extensions. */
  packageCost: number;
  /**
   * Optional source input used when purchaseUnit has no universal standard conversion.
   * Example: 1 box = 50 pc -> manualBaseUnitsPerPurchaseUnit = 50.
   * For a weight-based material purchased by cup, this may act as an explicit
   * manual g/cup fallback when no material calibration exists.
   */
  manualBaseUnitsPerPurchaseUnit?: number;

  /** User-entered current stock quantity. Normalized base quantity is derived later. */
  onHandQuantity: number;
  onHandUnit: MaterialPurchaseUnit;

  notes?: string;
  isActive: boolean;
}

const MATERIAL_GROUP_SET: ReadonlySet<string> = new Set(MATERIAL_GROUPS);
const MATERIAL_PACKAGE_UNIT_SET: ReadonlySet<string> = new Set(MATERIAL_PACKAGE_UNITS);

export function isMaterialGroup(value: unknown): value is MaterialGroup {
  return typeof value === 'string' && MATERIAL_GROUP_SET.has(value);
}

export function isMaterialPackageUnit(value: unknown): value is MaterialPackageUnit {
  return typeof value === 'string' && MATERIAL_PACKAGE_UNIT_SET.has(value);
}

export function isMaterialPurchaseUnit(value: unknown): value is MaterialPurchaseUnit {
  return isSupportedUnit(value) || isMaterialPackageUnit(value);
}

/**
 * The only standard-unit cross-dimension bridge allowed by the material contract.
 * It is not itself a conversion: Phase 1.4 must resolve it through material-specific
 * calibration or an explicit manual g/cup fallback.
 */
export function isMaterialCupWeightBridge(unit: MaterialPurchaseUnit, baseUnit: BaseUnit): boolean {
  return unit === 'cup' && baseUnit === 'g';
}

export class MaterialContractError extends Error {
  readonly code:
    | 'INVALID_ID'
    | 'INVALID_NAME'
    | 'INVALID_GROUP'
    | 'INVALID_BASE_UNIT'
    | 'INVALID_PURCHASE_UNIT'
    | 'INCOMPATIBLE_STANDARD_UNIT';
  readonly input?: unknown;

  constructor(
    code: MaterialContractError['code'],
    message: string,
    input?: unknown,
  ) {
    super(message);
    this.name = 'MaterialContractError';
    this.code = code;
    this.input = input;
  }
}

export function parseMaterialGroup(value: unknown): MaterialGroup {
  if (!isMaterialGroup(value)) {
    throw new MaterialContractError('INVALID_GROUP', `Unsupported material group: ${String(value)}.`, value);
  }
  return value;
}

export function parseMaterialPurchaseUnit(value: unknown): MaterialPurchaseUnit {
  if (!isMaterialPurchaseUnit(value)) {
    throw new MaterialContractError(
      'INVALID_PURCHASE_UNIT',
      `Unsupported material purchase unit: ${String(value)}.`,
      value,
    );
  }
  return value;
}

function validateStandardMaterialUnit(
  unit: MaterialPurchaseUnit,
  baseUnit: BaseUnit,
  fieldName: 'Purchase' | 'On-hand',
): void {
  if (
    isSupportedUnit(unit) &&
    !areUnitsCompatible(unit, baseUnit) &&
    !isMaterialCupWeightBridge(unit, baseUnit)
  ) {
    throw new MaterialContractError(
      'INCOMPATIBLE_STANDARD_UNIT',
      `${fieldName} unit ${unit} is incompatible with base unit ${baseUnit}.`,
      unit,
    );
  }
}

/**
 * Validates the identity/classification portion of a material record.
 * Numeric costing and inventory rules are intentionally handled by later domain layers.
 */
export function validateMaterialContract(material: Material): void {
  if (!material.id.trim()) {
    throw new MaterialContractError('INVALID_ID', 'Material ID is required.', material.id);
  }

  if (!material.name.trim()) {
    throw new MaterialContractError('INVALID_NAME', 'Material name is required.', material.name);
  }

  if (!isMaterialGroup(material.group)) {
    throw new MaterialContractError('INVALID_GROUP', `Unsupported material group: ${String(material.group)}.`, material.group);
  }

  if (!['g', 'mL', 'pc'].includes(material.baseUnit)) {
    throw new MaterialContractError('INVALID_BASE_UNIT', `Unsupported material base unit: ${material.baseUnit}.`, material.baseUnit);
  }

  if (!isMaterialPurchaseUnit(material.purchaseUnit) || !isMaterialPurchaseUnit(material.onHandUnit)) {
    throw new MaterialContractError('INVALID_PURCHASE_UNIT', 'Material purchase/on-hand unit is unsupported.');
  }

  validateStandardMaterialUnit(material.purchaseUnit, material.baseUnit, 'Purchase');
  validateStandardMaterialUnit(material.onHandUnit, material.baseUnit, 'On-hand');
}
