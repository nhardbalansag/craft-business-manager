import { describe, expect, it } from 'vitest';
import {
  CANONICAL_UNIT_BY_DIMENSION,
  SUPPORTED_UNITS,
  UNIT_CATALOG,
  areUnitsCompatible,
  assertUnitsCompatible,
  getCanonicalUnit,
  getUnitDimension,
  getUnitDefinition,
  isCanonicalUnit,
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
