import { describe, expect, it } from 'vitest';
import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import type { CustomerQuotationView } from './customerQuotation';
import { buildOwnerQuotationView } from './ownerQuotation';
import { summarizeOwnerQuotationMaterials } from './ownerQuotationMaterials';
import { renderOwnerQuotationHtml } from './ownerQuotationPrint';

const customer: CustomerQuotationView = {
  businessName: 'My Lovely Craft', quotationReference: 'QT-MATERIALS',
  generatedAtIso: '2026-10-22T01:00:00.000Z', validUntil: null,
  customer: { name: 'Event Buyer', contact: null, address: null },
  notes: null, terms: null,
  items: [
    { product: { id: 'ART-1', name: 'Paintable Toy', quantity: 10 },
      pricing: { sourceLabel: 'Default / Single', tierId: null, unitSellingPrice: 20, totalSellingPrice: 200, offerCount: 10 } },
    { product: { id: 'ART-2', name: 'Paintable Party Kit', quantity: 5 },
      pricing: { sourceLabel: 'Default / Single', tierId: null, unitSellingPrice: 18, totalSellingPrice: 90, offerCount: 5 } },
  ],
  subtotal: 290, total: 290,
  product: { id: 'ART-1', name: 'Paintable Toy', quantity: 10 },
  pricing: { sourceLabel: 'Default / Single', tierId: null, unitSellingPrice: 20, totalSellingPrice: 200, offerCount: 10 },
};

function direct(materialId: string, grams: number, costPerGram: number) {
  return {
    materialId, baseUnit: 'g' as const, status: 'ready',
    plannedBaseQuantityPerProduct: grams,
    costPerBaseUnit: costPerGram,
    pricingDirectMaterialCostPerUnit: grams * costPerGram,
  };
}
function directCost(lines: ReturnType<typeof direct>[], status: 'ready' | 'partial' = 'ready') {
  return { status, lines };
}
function materialComponent(sourceMaterialId: string, sourceMaterialName: string, quantityPerParent: number, costPerPc: number) {
  return {
    sourceType: 'material' as const,
    line: {
      sourceMaterialId, sourceMaterialName, quantityPerParent,
      costPerPc, componentCostContribution: costPerPc * quantityPerParent,
      status: 'ready',
    },
  };
}
function resolution(
  productId: string, quantity: number, sale: number, unitCost: number,
  materials: ReturnType<typeof directCost>,
  components: unknown[],
): ProductPriceResolutionResult {
  return {
    productId, productName: productId, productIsActive: true, quantity,
    mode: 'default', selectedTierId: null, status: 'ready', offerCount: quantity,
    unitSellingPrice: sale / quantity, totalSellingPrice: sale,
    integratedQuote: {
      totalFullyLoadedUnitCost: unitCost,
      fullyLoadedUnitCost: {
        status: 'ready',
        directMaterialMode: 'costed',
        directMaterialCost: materials,
        componentLines: components,
      },
    } as unknown as ProductPriceResolutionResult['integratedQuote'],
    selectedTier: null, eligibleTierIds: [], tierEligibility: [], warnings: [], issues: [],
  };
}

function example() {
  const child = {
    sourceType: 'product',
    line: {
      childProductId: 'CHILD-1', childProductName: 'Prepared Insert',
      quantityPerParent: 2, status: 'ready',
      childDirectMaterialMode: 'costed',
      childDirectMaterialCost: directCost([direct('PLASTER', 4, .05)]),
      breakdown: [materialComponent('ACC', 'Shredded Paper', 1, .5)],
    },
  };
  return buildOwnerQuotationView(customer, [
    resolution('ART-1', 10, 200, 7,
      directCost([direct('PLASTER', 30, .05), direct('GLUE', 5, .1)]),
      [materialComponent('PKG', 'Kraft Box', 1, 2), child]),
    resolution('ART-2', 5, 90, 6,
      directCost([direct('PLASTER', 10, .05)]),
      [materialComponent('PKG', 'Kraft Box', 2, 2)]),
  ], [
    { id: 'PLASTER', name: 'Plaster of Paris' },
    { id: 'GLUE', name: 'Craft Glue' },
    { id: 'PKG', name: 'Kraft Box' },
    { id: 'ACC', name: 'Shredded Paper' },
  ]);
}

describe('Confidential quotation material detail and aggregates', () => {
  it('shows direct Yield/recipe and material Components with order quantities and costs', () => {
    const view = example();
    expect(view.materialBreakdownComplete).toBe(true);
    expect(view.items[0].materialBreakdownComplete).toBe(true);
    const lines = view.items[0].materialLines!;
    expect(lines).toHaveLength(5);
    expect(lines.find((line) => line.materialId === 'PLASTER' && line.source.startsWith('Yield'))).toMatchObject({
      materialName: 'Plaster of Paris', unit: 'g', quantityPerProduct: 30,
      totalQuantity: 300, unitCost: .05, totalCost: 15,
    });
    expect(lines.find((line) => line.materialId === 'PKG')).toMatchObject({
      materialName: 'Kraft Box', unit: 'pc', quantityPerProduct: 1,
      totalQuantity: 10, unitCost: 2, totalCost: 20,
    });
    expect(lines.find((line) => line.materialId === 'PLASTER' && line.source.includes('Prepared Insert'))).toMatchObject({
      totalQuantity: 80, totalCost: 4,
    });
    expect(lines.find((line) => line.materialId === 'ACC')).toMatchObject({
      totalQuantity: 20, totalCost: 10,
    });
    expect(view.items[0].materialCostTotal).toBeCloseTo(54);
    expect(view.items[0].totalProductCost).toBe(70);
    expect(view.items[1].materialCostTotal).toBeCloseTo(22.5);
    expect(view.items[1].totalProductCost).toBe(30);
  });

  it('aggregates a shared material across products and nested components without double-counting', () => {
    const view = example();
    expect(view.materials).toHaveLength(4);
    expect(view.materials?.find((line) => line.materialId === 'PLASTER')).toMatchObject({
      materialName: 'Plaster of Paris', unit: 'g', totalQuantity: 430,
      totalCost: 21.5, unitCost: .05, contributingProducts: 2,
    });
    expect(view.materials?.find((line) => line.materialId === 'PKG')).toMatchObject({
      totalQuantity: 20, totalCost: 40, contributingProducts: 2,
    });
    expect(view.totalMaterialCost).toBeCloseTo(76.5);
    expect(view.totalProductCost).toBe(100);
    expect(view.totalProfit).toBe(190);
  });

  it('renders the detailed tables and consolidated totals only in the owner PDF', () => {
    const view = example();
    const html = renderOwnerQuotationHtml(view);
    expect(html).toContain('Material Cost Breakdown — Per Quoted Product');
    expect(html).toContain('Consolidated Materials — Entire Quotation');
    expect(html).toContain('Plaster of Paris');
    expect(html).toContain('Kraft Box');
    expect(html).toContain('Prepared Insert');
    expect(html).toContain('430 g');
    expect(html).toContain('₱76.50');
    expect(html).toContain('₱54.00');
    expect(html).toContain('₱22.50');
    expect(html).toContain('₱100.00'); // Total product costs include non-material charges
    expect(html).toContain('Other saved costs');
  });

  it('treats partial direct cost evidence as unknown rather than a complete material total', () => {
    const broken = resolution('ART-1', 10, 200, 7,
      directCost([direct('PLASTER', 30, .05)], 'partial'),
      [materialComponent('PKG', 'Kraft Box', 1, 2)]);
    const one = { ...customer, items: [customer.items[0]], total: 200 };
    const view = buildOwnerQuotationView(one, [broken], [{ id: 'PLASTER', name: 'Plaster of Paris' }]);
    expect(view.items[0].materialLines).toHaveLength(2);
    expect(view.items[0].materialCostTotal).toBeNull();
    expect(view.totalMaterialCost).toBeNull();
    expect(view.materialBreakdownComplete).toBe(false);
    expect(renderOwnerQuotationHtml(view)).toContain('Material breakdown is incomplete');
    expect(renderOwnerQuotationHtml(view)).toContain('Not available');
  });

  it('marks an unresolved material component and consolidated cost as unavailable', () => {
    const broken = resolution('ART-1', 10, 200, 7,
      directCost([direct('PLASTER', 30, .05)]),
      [{ sourceType: 'material', line: {
        sourceMaterialId: 'PKG', sourceMaterialName: 'Kraft Box',
        quantityPerParent: 1, status: 'not-ready', costPerPc: null,
        componentCostContribution: null,
      } }],
    );
    const one = { ...customer, items: [customer.items[0]], total: 200 };
    const view = buildOwnerQuotationView(one, [broken]);
    expect(view.items[0].materialLines?.find((line) => line.materialId === 'PKG')?.totalCost).toBeNull();
    expect(view.materials?.find((line) => line.materialId === 'PKG')?.totalCost).toBeNull();
    expect(view.totalMaterialCost).toBeNull();
  });

  it('keeps units separate and shows a weighted cost when the same material has different source rates', () => {
    const summary = summarizeOwnerQuotationMaterials([
      { productId: 'A', materialBreakdownComplete: true, materialLines: [{
        materialId: 'M', materialName: 'Universal Supply', unit: 'g', source: 'Yield',
        quantityPerProduct: 10, totalQuantity: 10, unitCost: 2, totalCost: 20,
      }] },
      { productId: 'B', materialBreakdownComplete: true, materialLines: [
        { materialId: 'm', materialName: 'Universal Supply', unit: 'g', source: 'Yield',
          quantityPerProduct: 30, totalQuantity: 30, unitCost: 1, totalCost: 30 },
        { materialId: 'M', materialName: 'Universal Supply', unit: 'pc', source: 'Component',
          quantityPerProduct: 2, totalQuantity: 2, unitCost: 5, totalCost: 10 },
      ] },
    ]);
    expect(summary.materials).toHaveLength(2);
    expect(summary.materials.find((m) => m.unit === 'g')).toMatchObject({
      totalQuantity: 40, totalCost: 50, unitCost: 1.25, contributingProducts: 2,
    });
    expect(summary.materials.find((m) => m.unit === 'pc')).toMatchObject({
      totalQuantity: 2, totalCost: 10, contributingProducts: 1,
    });
    expect(summary.totalMaterialCost).toBe(60);
  });
});
