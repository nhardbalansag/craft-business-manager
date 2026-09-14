import { describe, expect, it } from 'vitest';
import {
  SAFETY_WASTE_RATE_MAX_EXCLUSIVE,
  SafetyWastePolicyError,
  deriveProductSafetyWastePolicy,
  validateSafetyWasteRate,
} from './safetyWastePolicy';

describe('safety waste policy validation', () => {
  it.each([0, 0.03, 0.05, 0.1, 0.999999])('accepts valid rate %s', (rate) => {
    expect(validateSafetyWasteRate(rate)).toBe(rate);
  });

  it('uses an exclusive upper bound of 1', () => {
    expect(SAFETY_WASTE_RATE_MAX_EXCLUSIVE).toBe(1);

    for (const rate of [1, 1.1, 2]) {
      expect(() => validateSafetyWasteRate(rate)).toThrowError(SafetyWastePolicyError);
      try {
        validateSafetyWasteRate(rate);
      } catch (error) {
        expect(error).toBeInstanceOf(SafetyWastePolicyError);
        expect((error as SafetyWastePolicyError).code).toBe('RATE_NOT_BELOW_ONE');
      }
    }
  });

  it('rejects negative rates', () => {
    expect(() => validateSafetyWasteRate(-0.01)).toThrowError(
      expect.objectContaining<Partial<SafetyWastePolicyError>>({ code: 'NEGATIVE_RATE' }),
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite rate %s',
    (rate) => {
      expect(() => validateSafetyWasteRate(rate)).toThrowError(
        expect.objectContaining<Partial<SafetyWastePolicyError>>({ code: 'NON_FINITE_RATE' }),
      );
    },
  );
});

describe('derived product safety waste policy', () => {
  it('derives display percentage and planning multiplier without applying it to quantities', () => {
    expect(
      deriveProductSafetyWastePolicy({ id: 'ART-001', safetyWasteRate: 0.05 }),
    ).toEqual({
      productId: 'ART-001',
      rate: 0.05,
      percentage: 5,
      multiplier: 1.05,
      purpose: 'planning-reserve',
      observedDefectRateIncluded: false,
    });
  });

  it('keeps zero waste explicit instead of substituting a default', () => {
    expect(
      deriveProductSafetyWastePolicy({ id: 'CND-001', safetyWasteRate: 0 }),
    ).toMatchObject({
      rate: 0,
      percentage: 0,
      multiplier: 1,
      observedDefectRateIncluded: false,
    });
  });

  it('does not accept observed defect rate as policy input', () => {
    const policy = deriveProductSafetyWastePolicy({ id: 'ART-001', safetyWasteRate: 0.07 });
    expect(policy.rate).toBe(0.07);
    expect(policy.observedDefectRateIncluded).toBe(false);
    expect(policy).not.toHaveProperty('defectRate');
  });
});
