import { describe, expect, it } from 'vitest';
import {
  CANONICAL_UNIT_BY_DIMENSION,
  SUPPORTED_UNITS,
  UNIT_CATALOG,
  UnitConversionError,
  areUnitsCompatible,
  assertUnitsCompatible,
  convertQuantity,
  fromCanonicalQuantity,
  getCanonicalUnit,
  getStandardConversionFactor,
  getUnitDimension,
  getUnitDefinition,
  isCanonicalUnit,
  roundQuantity,
  toCanonicalQuantity,
} from './units';

describe('unit catalog and dimensional rules', () => {
  it('defines one canonical unit for each dimension', () => {
    expect(CANONICAL_UNIT_BY_DIMENSION).toEqual({
      weight: 'g',
      volume: 'mL',
      count: 'pc',
    });

    expect(isCanonicalUnit('g')).toBe(true);
    expect(isCanonicalUnit('mL')).toBe(true);
    expect(isCanonicalUnit('pc')).toBe(true);
    expect(isCanonicalUnit('kg')).toBe(false);
  });

  it('exposes the full supported user-facing unit set', () => {
    expect(SUPPORTED_UNITS).toEqual([
      'g',
      'kg',
      'oz',
      'lb',
      'mL',
      'L',
      'cup',
      'tbsp',
      'tsp',
      'fl-oz',
      'pc',
    ]);
  });

  it('classifies units by weight, volume, and count', () => {
    expect(getUnitDimension('kg')).toBe('weight');
    expect(getUnitDimension('cup')).toBe('volume');
    expect(getUnitDimension('pc')).toBe('count');
  });

  it('maps every unit to its canonical unit', () => {
    expect(getCanonicalUnit('lb')).toBe('g');
    expect(getCanonicalUnit('tsp')).toBe('mL');
    expect(getCanonicalUnit('pc')).toBe('pc');
  });

  it('keeps the standard reference factors in one catalog', () => {
    expect(getUnitDefinition('kg').toCanonicalFactor).toBe(1000);
    expect(getUnitDefinition('oz').toCanonicalFactor).toBe(28.3495);
    expect(getUnitDefinition('lb').toCanonicalFactor).toBe(453.592);
    expect(getUnitDefinition('L').toCanonicalFactor).toBe(1000);
    expect(getUnitDefinition('cup').toCanonicalFactor).toBe(240);
    expect(getUnitDefinition('tbsp').toCanonicalFactor).toBe(15);
    expect(getUnitDefinition('tsp').toCanonicalFactor).toBe(5);
    expect(getUnitDefinition('fl-oz').toCanonicalFactor).toBe(29.5735);
    expect(getUnitDefinition('pc').toCanonicalFactor).toBe(1);
  });

  it('allows standard conversion only within the same dimension', () => {
    expect(areUnitsCompatible('kg', 'g')).toBe(true);
    expect(areUnitsCompatible('cup', 'mL')).toBe(true);
    expect(areUnitsCompatible('pc', 'pc')).toBe(true);

    expect(areUnitsCompatible('cup', 'g')).toBe(false);
    expect(areUnitsCompatible('mL', 'g')).toBe(false);
    expect(areUnitsCompatible('pc', 'mL')).toBe(false);
  });

  it('rejects cross-dimension standard conversion explicitly', () => {
    expect(() => assertUnitsCompatible('kg', 'g')).not.toThrow();
    expect(() => assertUnitsCompatible('cup', 'mL')).not.toThrow();

    expect(() => assertUnitsCompatible('cup', 'g')).toThrow(/Incompatible unit dimensions/);
    expect(() => assertUnitsCompatible('mL', 'g')).toThrow(/Incompatible unit dimensions/);
  });

  it('does not encode dry cup-to-gram as a universal standard conversion', () => {
    expect(UNIT_CATALOG.cup.dimension).toBe('volume');
    expect(UNIT_CATALOG.cup.canonicalUnit).toBe('mL');
    expect(areUnitsCompatible('cup', 'g')).toBe(false);
  });
});

describe('standard conversion engine', () => {
  it('calculates conversion factors through the canonical unit', () => {
    expect(getStandardConversionFactor('kg', 'g')).toBe(1000);
    expect(getStandardConversionFactor('g', 'kg')).toBe(0.001);
    expect(getStandardConversionFactor('L', 'mL')).toBe(1000);
    expect(getStandardConversionFactor('cup', 'tbsp')).toBe(16);
    expect(getStandardConversionFactor('pc', 'pc')).toBe(1);
  });

  it('converts supported weight units', () => {
    expect(convertQuantity(2.5, 'kg', 'g')).toBe(2500);
    expect(convertQuantity(1000, 'g', 'kg')).toBe(1);
    expect(convertQuantity(2, 'oz', 'g')).toBeCloseTo(56.699);
    expect(convertQuantity(2, 'lb', 'g')).toBeCloseTo(907.184);
  });

  it('converts supported volume units', () => {
    expect(convertQuantity(1.5, 'L', 'mL')).toBe(1500);
    expect(convertQuantity(2, 'cup', 'mL')).toBe(480);
    expect(convertQuantity(3, 'tbsp', 'mL')).toBe(45);
    expect(convertQuantity(3, 'tsp', 'mL')).toBe(15);
    expect(convertQuantity(2, 'fl-oz', 'mL')).toBeCloseTo(59.147);
    expect(convertQuantity(240, 'mL', 'cup')).toBe(1);
  });

  it('normalizes to canonical units and converts back for display', () => {
    expect(toCanonicalQuantity(2.5, 'kg')).toBe(2500);
    expect(toCanonicalQuantity(1.5, 'L')).toBe(1500);
    expect(toCanonicalQuantity(36, 'pc')).toBe(36);

    expect(fromCanonicalQuantity(2500, 'kg')).toBe(2.5);
    expect(fromCanonicalQuantity(1500, 'L')).toBe(1.5);
    expect(fromCanonicalQuantity(36, 'pc')).toBe(36);
  });

  it('preserves zero, fractional, and negative mathematical quantities', () => {
    expect(convertQuantity(0, 'kg', 'g')).toBe(0);
    expect(convertQuantity(0.25, 'cup', 'mL')).toBe(60);
    expect(convertQuantity(-2, 'kg', 'g')).toBe(-2000);
  });

  it('rejects non-finite quantities with a controlled domain error', () => {
    for (const quantity of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      try {
        convertQuantity(quantity, 'kg', 'g');
        throw new Error('Expected conversion to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(UnitConversionError);
        expect((error as UnitConversionError).code).toBe('NON_FINITE_QUANTITY');
      }
    }
  });

  it('rejects cross-dimension conversions with a controlled domain error', () => {
    try {
      convertQuantity(1, 'cup', 'g');
      throw new Error('Expected conversion to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(UnitConversionError);
      expect((error as UnitConversionError).code).toBe('INCOMPATIBLE_UNITS');
      expect((error as UnitConversionError).from).toBe('cup');
      expect((error as UnitConversionError).to).toBe('g');
    }
  });

  it('rounds only when explicitly requested', () => {
    const raw = convertQuantity(1, 'g', 'oz');
    expect(raw).toBeCloseTo(0.035274, 6);
    expect(roundQuantity(raw, 4)).toBe(0.0353);
    expect(roundQuantity(1.005, 2)).toBe(1.01);
  });

  it('rejects invalid rounding precision', () => {
    for (const decimalPlaces of [-1, 1.5, 13]) {
      try {
        roundQuantity(1.2345, decimalPlaces);
        throw new Error('Expected rounding to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(UnitConversionError);
        expect((error as UnitConversionError).code).toBe('INVALID_DECIMAL_PLACES');
      }
    }
  });
});
