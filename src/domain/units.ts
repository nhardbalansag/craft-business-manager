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
  /**
   * Standard factor to the canonical unit for this dimension.
   * Phase 1.1B will use these factors in the conversion engine.
   */
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
    throw new Error(
      `Incompatible unit dimensions: ${from} (${getUnitDimension(from)}) cannot use standard conversion to ${to} (${getUnitDimension(to)}).`,
    );
  }
}

export function isCanonicalUnit(unit: Unit): unit is BaseUnit {
  return UNIT_CATALOG[unit].isCanonical;
}
