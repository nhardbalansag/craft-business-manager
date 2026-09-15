import { describe, expect, it } from 'vitest';
import type { LimitingResource } from '../../application/production/AssemblyCapacityTraceService';
import {
  UNAVAILABLE_BATCH_FINANCIAL_VALUE,
  buildFinancialLimiterRows,
  capacityFeasibilityLabel,
  financialReadinessLabel,
  formatBatchMoney,
  formatBatchPercent,
} from './plannedBatchFinancialView';

function directLimiter(): LimitingResource {
  return {
    resourceType: 'material-requirement',
    capacityPieces: 5,
    materialId: 'WAX',
    materialName: 'Soy Wax',
    baseUnit: 'g',
    normalizedOnHandBaseQuantity: 500,
    plannedBaseQuantityPerProduct: 100,
    path: [
      { kind: 'product', id: 'CANDLE', name: 'Candle' },
      { kind: 'material', id: 'WAX', name: 'Soy Wax' },
    ],
  };
}

function materialComponentLimiter(): LimitingResource {
  return {
    resourceType: 'material-backed-component',
    capacityPieces: 5,
    componentId: 'JAR-LINE',
    parentProductId: 'CANDLE',
    parentProductName: 'Candle',
    role: 'vessel',
    materialId: 'JAR',
    materialName: 'Glass Jar',
    availableQuantity: 5,
    quantityPerParent: 1,
    path: [
      { kind: 'product', id: 'CANDLE', name: 'Candle' },
      { kind: 'material', id: 'JAR', name: 'Glass Jar' },
    ],
  };
}

function productComponentLimiter(): LimitingResource {
  return {
    resourceType: 'product-backed-component',
    capacityPieces: 5,
    componentId: 'POT-LINE',
    parentProductId: 'CANDLE',
    parentProductName: 'Candle',
    role: 'vessel',
    productId: 'POT',
    productName: 'Handmade Pot',
    availableQuantity: 10,
    quantityPerParent: 2,
    path: [
      { kind: 'product', id: 'CANDLE', name: 'Candle' },
      { kind: 'product', id: 'POT', name: 'Handmade Pot' },
    ],
  };
}

describe('Phase 4.5C planned batch financial view helpers', () => {
  it('formats PHP zero and finite negative values without sanitizing them', () => {
    expect(formatBatchMoney(0)).toBe('PHP 0.00');
    expect(formatBatchMoney(-125.5)).toBe('PHP -125.50');
  });

  it('keeps null and non-finite money unavailable instead of inventing zero', () => {
    expect(formatBatchMoney(null)).toBe(UNAVAILABLE_BATCH_FINANCIAL_VALUE);
    expect(formatBatchMoney(undefined)).toBe(UNAVAILABLE_BATCH_FINANCIAL_VALUE);
    expect(formatBatchMoney(Number.NaN)).toBe(UNAVAILABLE_BATCH_FINANCIAL_VALUE);
    expect(formatBatchMoney(Number.POSITIVE_INFINITY)).toBe(UNAVAILABLE_BATCH_FINANCIAL_VALUE);
  });

  it('formats canonical batch-margin rates as human percentages', () => {
    expect(formatBatchPercent(0)).toBe('0%');
    expect(formatBatchPercent(0.25)).toBe('25%');
    expect(formatBatchPercent(-0.125)).toBe('-12.5%');
  });

  it('keeps null and non-finite percentages unavailable', () => {
    expect(formatBatchPercent(null)).toBe(UNAVAILABLE_BATCH_FINANCIAL_VALUE);
    expect(formatBatchPercent(undefined)).toBe(UNAVAILABLE_BATCH_FINANCIAL_VALUE);
    expect(formatBatchPercent(Number.NaN)).toBe(UNAVAILABLE_BATCH_FINANCIAL_VALUE);
  });

  it('maps every capacity-feasibility state to a deterministic label', () => {
    expect(capacityFeasibilityLabel('within-current-capacity')).toBe('Within current capacity');
    expect(capacityFeasibilityLabel('over-current-capacity')).toBe('Over current capacity');
    expect(capacityFeasibilityLabel('capacity-unresolved')).toBe('Capacity unresolved');
  });

  it('maps ready, partial, and not-ready evidence labels deterministically', () => {
    expect(financialReadinessLabel('ready')).toBe('Ready');
    expect(financialReadinessLabel('partial')).toBe('Partial');
    expect(financialReadinessLabel('not-ready')).toBe('Not ready');
  });

  it('maps a direct Material requirement limiter without changing authoritative evidence', () => {
    expect(buildFinancialLimiterRows({ limitingResources: [directLimiter()] })).toEqual([
      {
        resourceType: 'material-requirement',
        typeLabel: 'Direct material',
        sourceId: 'WAX',
        sourceName: 'Soy Wax',
        capacityPieces: 5,
        evidence: '500 g on hand · 100 g required per parent',
        pathLabel: 'Candle → Soy Wax',
      },
    ]);
  });

  it('maps a purchased Material-backed component limiter', () => {
    const [row] = buildFinancialLimiterRows({ limitingResources: [materialComponentLimiter()] });
    expect(row).toMatchObject({
      resourceType: 'material-backed-component',
      typeLabel: 'Purchased component',
      sourceId: 'JAR',
      sourceName: 'Glass Jar',
      capacityPieces: 5,
      evidence: '5 pc available · 1 pc required per parent',
      pathLabel: 'Candle → Glass Jar',
    });
  });

  it('maps a handmade Product-backed component limiter', () => {
    const [row] = buildFinancialLimiterRows({ limitingResources: [productComponentLimiter()] });
    expect(row).toMatchObject({
      resourceType: 'product-backed-component',
      typeLabel: 'Handmade Product component',
      sourceId: 'POT',
      sourceName: 'Handmade Pot',
      capacityPieces: 5,
      evidence: '10 pc available · 2 pc required per parent',
      pathLabel: 'Candle → Handmade Pot',
    });
  });

  it('preserves every tied authoritative limiter without selecting one winner', () => {
    const rows = buildFinancialLimiterRows({
      limitingResources: [directLimiter(), materialComponentLimiter(), productComponentLimiter()],
    });

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.resourceType)).toEqual([
      'material-requirement',
      'material-backed-component',
      'product-backed-component',
    ]);
    expect(rows.every((row) => row.capacityPieces === 5)).toBe(true);
  });

  it('keeps an intentionally empty 4.4C top-level limiter set empty', () => {
    expect(buildFinancialLimiterRows({ limitingResources: [] })).toEqual([]);
    expect(buildFinancialLimiterRows(null)).toEqual([]);
  });

  it('formats authoritative non-reconciling financial values independently without deriving replacements', () => {
    expect(formatBatchMoney(997.25)).toBe('PHP 997.25');
    expect(formatBatchMoney(1500)).toBe('PHP 1,500.00');
    expect(formatBatchMoney(-211.375)).toBe('PHP -211.38');
    expect(formatBatchPercent(-0.141)).toBe('-14.1%');
  });
});
