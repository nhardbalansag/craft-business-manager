export const SAFETY_WASTE_RATE_MIN = 0;
export const SAFETY_WASTE_RATE_MAX_EXCLUSIVE = 1;

export type SafetyWastePolicyErrorCode =
  | 'NON_FINITE_RATE'
  | 'NEGATIVE_RATE'
  | 'RATE_NOT_BELOW_ONE';

export class SafetyWastePolicyError extends Error {
  readonly code: SafetyWastePolicyErrorCode;
  readonly rate: number;

  constructor(code: SafetyWastePolicyErrorCode, message: string, rate: number) {
    super(message);
    this.name = 'SafetyWastePolicyError';
    this.code = code;
    this.rate = rate;
  }
}

/**
 * Derived planning policy for one product.
 *
 * Safety waste is intentionally separate from observed yield defect rate. It is a
 * forward-looking production reserve for spills, tool residue, measurement
 * variation, handling loss, and similar normal uncertainty.
 *
 * Phase 2.4A defines/validates the policy only. Applying the multiplier to material
 * requirements belongs to Phase 2.4B.
 */
export interface ProductSafetyWastePolicy {
  productId: string;
  rate: number;
  percentage: number;
  multiplier: number;
  purpose: 'planning-reserve';
  observedDefectRateIncluded: false;
}

export function validateSafetyWasteRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    throw new SafetyWastePolicyError(
      'NON_FINITE_RATE',
      'Safety waste rate must be a finite number.',
      rate,
    );
  }

  if (rate < SAFETY_WASTE_RATE_MIN) {
    throw new SafetyWastePolicyError(
      'NEGATIVE_RATE',
      'Safety waste rate cannot be negative.',
      rate,
    );
  }

  if (rate >= SAFETY_WASTE_RATE_MAX_EXCLUSIVE) {
    throw new SafetyWastePolicyError(
      'RATE_NOT_BELOW_ONE',
      'Safety waste rate must be less than 1 (100%).',
      rate,
    );
  }

  return rate;
}

export function deriveProductSafetyWastePolicy(input: {
  id: string;
  safetyWasteRate: number;
}): ProductSafetyWastePolicy {
  const rate = validateSafetyWasteRate(input.safetyWasteRate);

  return {
    productId: input.id.trim(),
    rate,
    percentage: rate * 100,
    multiplier: 1 + rate,
    purpose: 'planning-reserve',
    observedDefectRateIncluded: false,
  };
}
