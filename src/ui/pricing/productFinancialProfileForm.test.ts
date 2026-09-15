import { describe, expect, it } from 'vitest';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import {
  ProductFinancialProfileFormError,
  createEmptyProductFinancialProfileForm,
  pricingValueHelp,
  pricingValueLabel,
  productFinancialProfileFormToSource,
  productFinancialProfileToForm,
} from './productFinancialProfileForm';

describe('Phase 4.5A ProductFinancialProfile form mapping', () => {
  it('maps a missing profile to blank labor/overhead and unconfigured pricing', () => {
    expect(productFinancialProfileToForm(null)).toEqual({
      laborCostPerUnit: '',
      overheadCostPerUnit: '',
      pricingMethod: 'unconfigured',
      pricingValue: '',
      notes: '',
    });
  });

  it('preserves explicit zero labor and overhead instead of mapping them to blank', () => {
    const profile: ProductFinancialProfile = {
      productId: 'ART-001',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: null,
    };

    const form = productFinancialProfileToForm(profile);
    expect(form.laborCostPerUnit).toBe('0');
    expect(form.overheadCostPerUnit).toBe('0');
  });

  it('round-trips a fixed PHP profit amount without percentage conversion', () => {
    const profile: ProductFinancialProfile = {
      productId: 'ART-001',
      laborCostPerUnit: 12.5,
      overheadCostPerUnit: 3.25,
      pricingPolicy: { method: 'profit-amount', value: 25.75 },
      notes: 'Retail target',
    };

    const form = productFinancialProfileToForm(profile);
    expect(form.pricingMethod).toBe('profit-amount');
    expect(form.pricingValue).toBe('25.75');
    expect(productFinancialProfileFormToSource('ART-001', form)).toEqual(profile);
  });

  it('maps canonical 0.50 markup to 50 UI percent and back to 0.50', () => {
    const profile: ProductFinancialProfile = {
      productId: 'CANDLE-001',
      laborCostPerUnit: 10,
      overheadCostPerUnit: 5,
      pricingPolicy: { method: 'markup-percent', value: 0.5 },
    };

    const form = productFinancialProfileToForm(profile);
    expect(form.pricingValue).toBe('50');
    expect(productFinancialProfileFormToSource(profile.productId, form).pricingPolicy).toEqual({
      method: 'markup-percent',
      value: 0.5,
    });
  });

  it('maps canonical 0.25 target margin to 25 UI percent and back to 0.25', () => {
    const profile: ProductFinancialProfile = {
      productId: 'CANDLE-002',
      laborCostPerUnit: 8,
      overheadCostPerUnit: 2,
      pricingPolicy: { method: 'margin-percent', value: 0.25 },
    };

    const form = productFinancialProfileToForm(profile);
    expect(form.pricingValue).toBe('25');
    expect(productFinancialProfileFormToSource(profile.productId, form).pricingPolicy).toEqual({
      method: 'margin-percent',
      value: 0.25,
    });
  });

  it('preserves a high-precision percentage through the UI boundary without two-decimal rounding', () => {
    const profile: ProductFinancialProfile = {
      productId: 'DISPLAY-001',
      laborCostPerUnit: 1,
      overheadCostPerUnit: 1,
      pricingPolicy: { method: 'markup-percent', value: 0.33333 },
    };

    const form = productFinancialProfileToForm(profile);
    expect(form.pricingValue).toBe('33.333');
    expect(productFinancialProfileFormToSource(profile.productId, form).pricingPolicy?.value).toBeCloseTo(
      0.33333,
      12,
    );
  });

  it('maps unconfigured pricing to a null source policy', () => {
    const source = productFinancialProfileFormToSource('ART-001', {
      laborCostPerUnit: '0',
      overheadCostPerUnit: '0',
      pricingMethod: 'unconfigured',
      pricingValue: '999',
      notes: '',
    });

    expect(source.pricingPolicy).toBeNull();
  });

  it('rejects blank labor cost instead of coercing it to zero', () => {
    expect(() =>
      productFinancialProfileFormToSource('ART-001', {
        ...createEmptyProductFinancialProfileForm(),
        overheadCostPerUnit: '0',
      }),
    ).toThrowError(ProductFinancialProfileFormError);

    try {
      productFinancialProfileFormToSource('ART-001', {
        ...createEmptyProductFinancialProfileForm(),
        overheadCostPerUnit: '0',
      });
    } catch (error) {
      expect(error).toMatchObject({ code: 'LABOR_COST_REQUIRED' });
    }
  });

  it('rejects blank overhead cost instead of coercing it to zero', () => {
    expect(() =>
      productFinancialProfileFormToSource('ART-001', {
        ...createEmptyProductFinancialProfileForm(),
        laborCostPerUnit: '0',
      }),
    ).toThrowError(ProductFinancialProfileFormError);

    try {
      productFinancialProfileFormToSource('ART-001', {
        ...createEmptyProductFinancialProfileForm(),
        laborCostPerUnit: '0',
      });
    } catch (error) {
      expect(error).toMatchObject({ code: 'OVERHEAD_COST_REQUIRED' });
    }
  });

  it('rejects blank configured policy value', () => {
    expect(() =>
      productFinancialProfileFormToSource('ART-001', {
        laborCostPerUnit: '0',
        overheadCostPerUnit: '0',
        pricingMethod: 'markup-percent',
        pricingValue: '',
        notes: '',
      }),
    ).toThrowError(/Percentage value is required/);
  });

  it('rejects non-finite numeric text rather than coercing it', () => {
    expect(() =>
      productFinancialProfileFormToSource('ART-001', {
        laborCostPerUnit: 'Infinity',
        overheadCostPerUnit: '0',
        pricingMethod: 'unconfigured',
        pricingValue: '',
        notes: '',
      }),
    ).toThrowError(/Labor cost per unit must be a finite number/);
  });

  it('trims notes and converts empty notes to undefined', () => {
    const withNotes = productFinancialProfileFormToSource('ART-001', {
      laborCostPerUnit: '1',
      overheadCostPerUnit: '2',
      pricingMethod: 'unconfigured',
      pricingValue: '',
      notes: '  seasonal profile  ',
    });
    const emptyNotes = productFinancialProfileFormToSource('ART-001', {
      laborCostPerUnit: '1',
      overheadCostPerUnit: '2',
      pricingMethod: 'unconfigured',
      pricingValue: '',
      notes: '   ',
    });

    expect(withNotes.notes).toBe('seasonal profile');
    expect(emptyNotes.notes).toBeUndefined();
  });

  it('provides unambiguous PHP and percentage labels/help text', () => {
    expect(pricingValueLabel('profit-amount')).toBe('Profit per unit (PHP)');
    expect(pricingValueLabel('markup-percent')).toBe('Markup (%)');
    expect(pricingValueLabel('margin-percent')).toBe('Target margin (%)');
    expect(pricingValueHelp('markup-percent')).toContain('50% markup');
    expect(pricingValueHelp('margin-percent')).toContain('not including 100');
  });
});
