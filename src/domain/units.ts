export type UnitDimension = 'weight' | 'volume' | 'count';

export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb';
export type VolumeUnit = 'mL' | 'L' | 'cup' | 'tbsp' | 'tsp' | 'fl-oz';
export type CountUnit = 'pc';

export type Unit = WeightUnit | VolumeUnit | CountUnit;
export type BaseUnit = 'g' | 'mL' | 'pc';
export type InputUnit = Unit;

export interface UnitDefinition {
  symbol: Unit;
  label: string;
  dimension: UnitDimension;
  canonicalUnit: BaseUnit;
  /** Standard factor from this unit to the canonical unit for its dimension. */
  toCanonicalFactor: number;
  isCanonical: boolean;
}

export const UNIT_CATALOG = {
  g: {
    symbol: 'g',
    label: 'Gram',
    dimension: 'weight',
    canonicalUnit: 'g',
    toCanonicalFactor: 1,
    isCanonical: true,
  },
  kg: {
    symbol: 'kg',
    label: 'Kilogram',
    dimension: 'weight',
    canonicalUnit: 'g',
    toCanonicalFactor: 1000,
    isCanonical: false,
  },
  oz: {
    symbol: 'oz',
    label: 'Ounce',
    dimension: 'weight',
    canonicalUnit: 'g',
    toCanonicalFactor: 28.3495,
    isCanonical: false,
  },
  lb: {
    symbol: 'lb',
    label: 'Pound',
    dimension: 'weight',
    canonicalUnit: 'g',
    toCanonicalFactor: 453.592,
    isCanonical: false,
  },
  mL: {
    symbol: 'mL',
    label: 'Milliliter',
    dimension: 'volume',
    canonicalUnit: 'mL',
    toCanonicalFactor: 1,
    isCanonical: true,
  },
  L: {
    symbol: 'L',
    label: 'Liter',
    dimension: 'volume',
    canonicalUnit: 'mL',
    toCanonicalFactor: 1000,
    isCanonical: false,
  },
  cup: {
    symbol: 'cup',
    label: 'Cup',
    dimension: 'volume',
    canonicalUnit: 'mL',
    toCanonicalFactor: 240,
    isCanonical: false,
  },
  tbsp: {
    symbol: 'tbsp',
    label: 'Tablespoon',
    dimension: 'volume',
    canonicalUnit: 'mL',
    toCanonicalFactor: 15,
    isCanonical: false,
  },
  tsp: {
    symbol: 'tsp',
    label: 'Teaspoon',
    dimension: 'volume',
    canonicalUnit: 'mL',
    toCanonicalFactor: 5,
    isCanonical: false,
  },
  'fl-oz': {
    symbol: 'fl-oz',
    label: 'US Fluid Ounce',
    dimension: 'volume',
    canonicalUnit: 'mL',
    toCanonicalFactor: 29.5735,
    isCanonical: false,
  },
  pc: {
    symbol: 'pc',
    label: 'Piece',
    dimension: 'count',
    canonicalUnit: 'pc',
    toCanonicalFactor: 1,
    isCanonical: true,
  },
} as const satisfies Record<Unit, UnitDefinition>;

export const SUPPORTED_UNITS = Object.keys(UNIT_CATALOG) as Unit[];

export const CANONICAL_UNIT_BY_DIMENSION: Readonly<Record<UnitDimension, BaseUnit>> = {
  weight: 'g',
  volume: 'mL',
  count: 'pc',
};

export type UnitConversionErrorCode =
  | 'INCOMPATIBLE_UNITS'
  | 'NON_FINITE_QUANTITY'
  | 'INVALID_DECIMAL_PLACES';

export class UnitConversionError extends Error {
  readonly code: UnitConversionErrorCode;
  readonly from?: Unit;
  readonly to?: Unit;
  readonly quantity?: number;

  constructor(
    code: UnitConversionErrorCode,
    message: string,
    context: { from?: Unit; to?: Unit; quantity?: number } = {},
  ) {
    super(message);
    this.name = 'UnitConversionError';
    this.code = code;
    this.from = context.from;
    this.to = context.to;
    this.quantity = context.quantity;
  }
}

export function getUnitDefinition(unit: Unit): UnitDefinition {
  return UNIT_CATALOG[unit];
}

export function getUnitDimension(unit: Unit): UnitDimension {
  return UNIT_CATALOG[unit].dimension;
}

export function getCanonicalUnit(unit: Unit): BaseUnit {
  return UNIT_CATALOG[unit].canonicalUnit;
}

export function areUnitsCompatible(from: Unit, to: Unit): boolean {
  return getUnitDimension(from) === getUnitDimension(to);
}

export function assertUnitsCompatible(from: Unit, to: Unit): void {
  if (!areUnitsCompatible(from, to)) {
    throw new UnitConversionError(
      'INCOMPATIBLE_UNITS',
      `Incompatible unit dimensions: ${from} (${getUnitDimension(from)}) cannot use standard conversion to ${to} (${getUnitDimension(to)}).`,
      { from, to },
    );
  }
}

export function isCanonicalUnit(unit: Unit): unit is BaseUnit {
  return UNIT_CATALOG[unit].isCanonical;
}

function assertFiniteQuantity(quantity: number): void {
  if (!Number.isFinite(quantity)) {
    throw new UnitConversionError(
      'NON_FINITE_QUANTITY',
      `Quantity must be a finite number. Received: ${String(quantity)}.`,
      { quantity },
    );
  }
}

/**
 * Returns the multiplicative factor for a standard same-dimension conversion.
 * Example: kg -> g = 1000; cup -> mL = 240; g -> kg = 0.001.
 */
export function getStandardConversionFactor(from: Unit, to: Unit): number {
  assertUnitsCompatible(from, to);

  const fromDefinition = getUnitDefinition(from);
  const toDefinition = getUnitDefinition(to);

  return fromDefinition.toCanonicalFactor / toDefinition.toCanonicalFactor;
}

/**
 * Converts a finite quantity between compatible standard units.
 *
 * This is deliberately dimension-safe. Weight <-> volume conversions require
 * material-specific calibration/density rules and are not handled here.
 * Negative quantities are preserved mathematically; business rules such as
 * "inventory cannot be negative" belong to higher-level validation.
 */
export function convertQuantity(quantity: number, from: Unit, to: Unit): number {
  assertFiniteQuantity(quantity);
  return quantity * getStandardConversionFactor(from, to);
}

/** Converts an entered quantity to the canonical unit for its dimension. */
export function toCanonicalQuantity(quantity: number, unit: Unit): number {
  return convertQuantity(quantity, unit, getCanonicalUnit(unit));
}

/** Converts a canonical quantity into a compatible display/input unit. */
export function fromCanonicalQuantity(quantity: number, targetUnit: Unit): number {
  return convertQuantity(quantity, getCanonicalUnit(targetUnit), targetUnit);
}

/**
 * Explicit rounding helper for display/export boundaries.
 * Conversion functions themselves do not silently round stored calculations.
 */
export function roundQuantity(quantity: number, decimalPlaces = 6): number {
  assertFiniteQuantity(quantity);

  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 12) {
    throw new UnitConversionError(
      'INVALID_DECIMAL_PLACES',
      `Decimal places must be an integer between 0 and 12. Received: ${decimalPlaces}.`,
      { quantity },
    );
  }

  const factor = 10 ** decimalPlaces;
  return Math.round((quantity + Number.EPSILON) * factor) / factor;
}
