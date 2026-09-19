import { describe, expect, it } from 'vitest';
import type { MaterialBackedComponentCostLine } from '../../application/productComponents/MaterialBackedComponentCostService';
import type { RecursiveFullyLoadedProductComponentCostLine } from '../../application/productCosts/RecursiveFullyLoadedProductComponentCostService';
import type { FullyLoadedProductUnitCostComponentLine } from '../../application/productCosts/FullyLoadedProductUnitCostService';
import {
  UNAVAILABLE_FINANCIAL_VALUE,
  buildProductComponentTrace,
  formatPercent,
  formatPhp,
  formatPricingPolicyValue,
  materialComponentTraceRows,
  pricingPolicyLabel,
  quoteReadinessLabel,
} from './productPricingQuoteView';

function materialLine(overrides: Partial<MaterialBackedComponentCostLine> = {}): MaterialBackedComponentCostLine {
  return {
    componentId: 'JAR-LINE',
    parentProductId: 'CANDLE',
    role: 'vessel',
    sourceMaterialId: 'JAR',
    sourceMaterialName: 'Glass Jar',
    quantityPerParent: 1,
    status: 'ready',
    costPerPc: 12,
    componentCostContribution: 12,
    costingTrace: null,
    sourceAvailability: null,
    issues: [],
    ...overrides,
  };
}

function productLine(
  overrides: Partial<RecursiveFullyLoadedProductComponentCostLine> = {},
): RecursiveFullyLoadedProductComponentCostLine {
  return {
    componentId: 'POT-LINE',
    parentProductId: 'CANDLE',
    role: 'vessel',
    childProductId: 'POT',
    childProductName: 'Handmade Pot',
    quantityPerParent: 1,
    path: ['CANDLE', 'POT'],
    status: 'ready',
    childDirectMaterialCost: null,
    childDirectMaterialMode: 'neutral-component-only',
    childMaterialComponentCostSubtotal: 4,
    childProductComponentCostSubtotal: 3,
    childLaborCostPerUnit: 10,
    childOverheadCostPerUnit: 5,
    knownChildProductionCostSubtotal: 22,
    childFullyLoadedUnitCost: 22,
    knownComponentCostContribution: 22,
    componentCostContribution: 22,
    breakdown: [],
    issues: [],
    ...overrides,
  };
}

describe('Phase 4.5B pricing quote view helpers', () => {
  it('formats PHP zero and finite negative values without turning them into unavailable values', () => {
    expect(formatPhp(0)).toBe('PHP 0.00');
    expect(formatPhp(-12.5)).toBe('PHP -12.50');
  });

  it('keeps unavailable money explicit instead of inventing zero', () => {
    expect(formatPhp(null)).toBe(UNAVAILABLE_FINANCIAL_VALUE);
    expect(formatPhp(undefined)).toBe(UNAVAILABLE_FINANCIAL_VALUE);
    expect(formatPhp(Number.NaN)).toBe(UNAVAILABLE_FINANCIAL_VALUE);
  });

  it('formats canonical decimal rates as human percentages', () => {
    expect(formatPercent(0.25)).toBe('25%');
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(-0.1)).toBe('-10%');
  });

  it('keeps unavailable percentages explicit', () => {
    expect(formatPercent(null)).toBe(UNAVAILABLE_FINANCIAL_VALUE);
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe(UNAVAILABLE_FINANCIAL_VALUE);
  });

  it('labels pricing policies and quote readiness deterministically', () => {
    expect(pricingPolicyLabel(null)).toBe('Not configured');
    expect(pricingPolicyLabel({ method: 'profit-amount', value: 25 })).toBe('Fixed profit');
    expect(pricingPolicyLabel({ method: 'markup-percent', value: 0.5 })).toBe('Markup');
    expect(pricingPolicyLabel({ method: 'margin-percent', value: 0.25 })).toBe('Target margin');
    expect(quoteReadinessLabel('ready')).toBe('Ready');
    expect(quoteReadinessLabel('partial')).toBe('Partial');
    expect(quoteReadinessLabel('not-ready')).toBe('Not ready');
  });

  it('formats fixed-profit policy values as PHP', () => {
    expect(formatPricingPolicyValue({ method: 'profit-amount', value: 25.5 })).toBe('PHP 25.50');
  });

  it('formats markup and margin policy values as human percentages', () => {
    expect(formatPricingPolicyValue({ method: 'markup-percent', value: 0.5 })).toBe('50%');
    expect(formatPricingPolicyValue({ method: 'margin-percent', value: 0.25 })).toBe('25%');
    expect(formatPricingPolicyValue(null)).toBe(UNAVAILABLE_FINANCIAL_VALUE);
  });

  it('preserves root and nested Product-component paths recursively', () => {
    const nested = productLine({
      componentId: 'INSERT-LINE',
      parentProductId: 'POT',
      role: 'insert',
      childProductId: 'INSERT',
      childProductName: 'Insert',
      path: ['CANDLE', 'POT', 'INSERT'],
    });
    const root = productLine({
      breakdown: [{ sourceType: 'product', line: nested }],
    });

    const trace = buildProductComponentTrace([{ sourceType: 'product', line: root }]);

    expect(trace).toHaveLength(1);
    expect(trace[0].path).toEqual(['CANDLE', 'POT']);
    expect(trace[0].children).toHaveLength(1);
    expect(trace[0].children[0].path).toEqual(['CANDLE', 'POT', 'INSERT']);
    expect(trace[0].children[0].childProductName).toBe('Insert');
  });

  it('preserves authoritative quantities, statuses, contribution values, and issue messages', () => {
    const line = productLine({
      quantityPerParent: 3,
      status: 'partial',
      childFullyLoadedUnitCost: null,
      knownComponentCostContribution: 66,
      componentCostContribution: null,
      issues: [
        {
          code: 'NESTED_PRODUCT_COMPONENT_PARTIAL',
          message: 'Nested handmade component is only partially costed.',
          componentId: 'POT-LINE',
          productId: 'POT',
          path: ['CANDLE', 'POT'],
        },
      ],
    });

    const [node] = buildProductComponentTrace([{ sourceType: 'product', line }]);

    expect(node.quantityPerParent).toBe(3);
    expect(node.status).toBe('partial');
    expect(node.childFullyLoadedUnitCost).toBeNull();
    expect(node.knownComponentCostContribution).toBe(66);
    expect(node.componentCostContribution).toBeNull();
    expect(node.issues).toEqual(['Nested handmade component is only partially costed.']);
  });

  it('keeps Material-backed breakdown rows separate from Product child nodes', () => {
    const nestedMaterial = materialLine({
      componentId: 'WICK-LINE',
      parentProductId: 'POT',
      role: 'accessory',
      sourceMaterialId: 'WICK',
      sourceMaterialName: 'Wick',
      quantityPerParent: 2,
      componentCostContribution: 4,
    });
    const root = productLine({
      breakdown: [{ sourceType: 'material', line: nestedMaterial }],
    });

    const [node] = buildProductComponentTrace([{ sourceType: 'product', line: root }]);

    expect(node.children).toHaveLength(0);
    expect(node.materialComponents).toHaveLength(1);
    expect(node.materialComponents[0].sourceMaterialName).toBe('Wick');
    expect(node.materialComponents[0].componentCostContribution).toBe(4);
  });

  it('passes authoritative financial values through instead of locally reconciling totals', () => {
    const deliberatelyNonReconciling = productLine({
      childMaterialComponentCostSubtotal: 1,
      childProductComponentCostSubtotal: 2,
      childLaborCostPerUnit: 3,
      childOverheadCostPerUnit: 4,
      knownChildProductionCostSubtotal: 999,
      childFullyLoadedUnitCost: 777,
      knownComponentCostContribution: 555,
      componentCostContribution: 444,
    });

    const [node] = buildProductComponentTrace([
      { sourceType: 'product', line: deliberatelyNonReconciling },
    ]);

    expect(node.knownChildProductionCostSubtotal).toBe(999);
    expect(node.childFullyLoadedUnitCost).toBe(777);
    expect(node.knownComponentCostContribution).toBe(555);
    expect(node.componentCostContribution).toBe(444);
  });

  it('maps root Material-backed component lines without altering their authoritative values', () => {
    const line = materialLine({
      quantityPerParent: 4,
      costPerPc: 7.5,
      componentCostContribution: 30,
      issues: [{ code: 'DERIVED_COST_INVALID', message: 'Example diagnostic.' }],
    });
    const components: FullyLoadedProductUnitCostComponentLine[] = [
      { sourceType: 'material', line },
    ];

    const rows = materialComponentTraceRows(components);

    expect(rows).toHaveLength(1);
    expect(rows[0].quantityPerParent).toBe(4);
    expect(rows[0].costPerPc).toBe(7.5);
    expect(rows[0].componentCostContribution).toBe(30);
    expect(rows[0].issues).toEqual(['Example diagnostic.']);
  });
});
