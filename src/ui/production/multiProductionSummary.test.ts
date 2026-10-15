import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import type { Material } from '../../domain/materials';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import type { ProductionRequirementPlanResult } from '../../application/production/ProductionRequirementService';
import type { PlasterMoldOperationalPreviewResult } from '../../application/plasterMoldYieldProfiles/PlasterMoldOperationalPreviewService';
import { summarizeMultiProduction, type MultiProductionEntry } from './multiProductionSummary';
import { renderMultiProductionSheet } from './multiProductionPrint';

const material = (id: string, onHandQuantity = 50): Material => ({
  id, name: id, group: 'plaster', baseUnit: 'g',
  purchaseQuantity: 100, purchaseUnit: 'g', packageCost: 20,
  onHandQuantity, onHandUnit: 'g', isActive: true,
});
const product = (id: string): Product => ({
  id, name: id, category: 'paintable-art', safetyWasteRate: 0, isActive: true,
});
const plan = (id: string, qty: number, grams: number) => ({
  productId: id, plannedQuantity: qty, status: 'ready',
  requirements: [{ materialId: 'PLASTER', baseUnit: 'g', plannedBatchBaseQuantity: grams }],
}) as ProductionRequirementPlanResult;
const profile = (id: string, plasterFactor = .75): PlasterMoldYieldProfile => ({
  id: `PROFILE-${id}`, moldId: `MOLD-${id}`,
  waterMaterialId: 'WATER', plasterMaterialId: 'PLASTER', glueMaterialId: 'GLUE',
  waterFillWeightGrams: 50, waterAdjustmentRate: .3, plasterFactor, glueFactor: .05,
  piecesPerPour: 2, isActive: true,
});
const formula = (id: string, qty: number, water: number, plaster: number, glue: number) => ({
  productId: id, profileId: `PROFILE-${id}`, moldId: `MOLD-${id}`,
  moldName: `Mold ${id}`, status: 'ready',
  requiredPours: Math.ceil(qty / 2),
  materials: [
    { role: 'water', materialId: 'WATER', materialName: 'WATER', targetBatchGrams: water },
    { role: 'plaster', materialId: 'PLASTER', materialName: 'PLASTER', targetBatchGrams: plaster },
    { role: 'glue', materialId: 'GLUE', materialName: 'GLUE', targetBatchGrams: glue },
  ],
}) as PlasterMoldOperationalPreviewResult;
const entry = (id: string, qty: number, direct: number, water: number, plaster: number, glue: number, factor = .75): MultiProductionEntry => ({
  product: product(id), quantity: qty, plan: plan(id, qty, direct),
  profile: profile(id, factor), formula: formula(id, qty, water, plaster, glue),
});

describe('multi-product Production totals', () => {
  const materials = [material('PLASTER', 50), material('WATER', 1000), material('GLUE', 10)];

  it('combines identical ratios, preserves complete Mold pours and shares stock once', () => {
    const summary = summarizeMultiProduction([
      entry('BEAR', 3, 40, 70, 52.5, 3.5),
      entry('LION', 5, 30, 105, 78.75, 5.25),
    ], materials);
    expect(summary.finishedPieces).toBe(8);
    expect(summary.directMaterials.find(row => row.materialId === 'PLASTER')).toMatchObject({
      required: 70, available: 50, shortage: 20,
    });
    expect(summary.mixtureGroups).toHaveLength(1);
    expect(summary.mixtureGroups[0].requiredPours).toBe(5);
    expect(summary.mixtureGroups[0].totalMixtureGrams).toBe(315);
    expect(summary.formulaMaterials.find(row => row.materialId === 'PLASTER')).toMatchObject({
      required: 131.25, available: 50, shortage: 81.25,
    });
    expect(summary.ready).toBe(true);
  });

  it('keeps differing ratios in separate mixture groups while aggregating purchasing quantities', () => {
    const summary = summarizeMultiProduction([
      entry('BEAR', 3, 40, 70, 52.5, 3.5),
      entry('SEAHORSE', 4, 30, 70, 35, 3.5, .5),
    ], materials);
    expect(summary.mixtureGroups).toHaveLength(2);
    expect(summary.formulaMaterials.find(row => row.materialId === 'PLASTER')?.required).toBe(87.5);
    expect(summary.directMaterials.find(row => row.materialId === 'PLASTER')?.required).toBe(70);
  });

  it('reports incomplete requirements and unresolved stock without pretending shortages are zero', () => {
    const missing = entry('BEAR', 1, 10, 35, 26.25, 1.75);
    missing.plan = null;
    missing.error = 'No recipe source';
    const summary = summarizeMultiProduction([missing], [material('WATER'), material('GLUE')]);
    expect(summary.ready).toBe(false);
    expect(summary.warnings.join(' ')).toContain('No recipe source');
    expect(summary.directMaterials).toHaveLength(0);
    expect(summary.formulaMaterials.find(row => row.materialId === 'PLASTER')?.shortage).toBeNull();
  });

  it('prints combined stock without mixing groups and escapes user-editable Product names', () => {
    const first = entry('BEAR', 3, 40, 70, 52.5, 3.5);
    first.product = { ...first.product, name: 'Bear <Special>' };
    const summary = summarizeMultiProduction([first], materials);
    const html = renderMultiProductionSheet([first], summary);
    expect(html).toContain('Bear &lt;Special&gt;');
    expect(html).toContain('Total direct materials');
    expect(html).toContain('Theoretical Mold Formula material purchasing totals');
    expect(html).not.toContain('Compatible Mold Formula mixing groups');
    expect(html).not.toContain('Mixture group 1');
    // The two paths are explicitly separate and must not be added together.
    expect(html).toContain('must NOT be added together');
    expect(html).toContain('52.5 g');
  });
});
