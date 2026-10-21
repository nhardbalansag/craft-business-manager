import { describe, expect, it } from 'vitest';
import type { PlasterMoldYieldCalculatorResult } from '../../application/plasterMoldYieldProfiles/PlasterMoldYieldCalculatorService';
import { buildPlasterMoldYieldDraft } from './plasterMoldYieldDraft';

function estimate(): PlasterMoldYieldCalculatorResult {
  return {
    estimateKind: 'theoretical',
    mold: {
      id: 'MOLD-1',
      productId: 'PROD-1',
      name: 'Dinosaur Mold',
      isActive: true,
    },
    profile: {
      id: 'PMYP-1',
      moldId: 'MOLD-1',
      waterMaterialId: 'MAT-WATER',
      plasterMaterialId: 'MAT-PLASTER',
      glueMaterialId: 'MAT-GLUE',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 4,
      isActive: true,
    },
    materials: {
      water: {
        role: 'water',
        materialId: 'MAT-WATER',
        materialName: 'Water',
        baseUnit: 'g',
      },
      plaster: {
        role: 'plaster',
        materialId: 'MAT-PLASTER',
        materialName: 'Plaster',
        baseUnit: 'g',
      },
      glue: {
        role: 'glue',
        materialId: 'MAT-GLUE',
        materialName: 'Glue',
        baseUnit: 'g',
      },
    },
    formula: {
      unit: 'g',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 4,
      perPour: {
        adjustedWaterGrams: 35,
        plasterGrams: 26.25,
        glueGrams: 1.75,
        totalMixtureGrams: 63,
      },
      perPiece: {
        adjustedWaterGrams: 8.75,
        plasterGrams: 6.5625,
        glueGrams: 0.4375,
        totalMixtureGrams: 15.75,
      },
      requestedQuantityEstimate: {
        requestedQuantity: 21,
        requiredPours: 6,
        producedCapacityPieces: 24,
        extraCapacityPieces: 3,
        totals: {
          adjustedWaterGrams: 210,
          plasterGrams: 157.5,
          glueGrams: 10.5,
          totalMixtureGrams: 378,
        },
      },
    },
    productSafetyWasteApplied: false,
    yieldEvidenceCreated: false,
  };
}

describe('MY6 plaster mold formula -> Yield draft mapping', () => {
  it('maps requested-quantity totals to editable gram inputs without creating outcome evidence', () => {
    const draft = buildPlasterMoldYieldDraft(estimate());

    expect(draft).toEqual({
      sourceKind: 'plaster-mold-formula',
      estimateKind: 'theoretical',
      moldId: 'MOLD-1',
      moldName: 'Dinosaur Mold',
      productId: 'PROD-1',
      profileId: 'PMYP-1',
      requestedQuantity: 21,
      requiredPours: 6,
      producedCapacityPieces: 24,
      extraCapacityPieces: 3,
      totalMixtureGrams: 378,
      materialInputs: [
        { role: 'water', materialId: 'MAT-WATER', quantity: 210, unit: 'g' },
        { role: 'plaster', materialId: 'MAT-PLASTER', quantity: 157.5, unit: 'g' },
        { role: 'glue', materialId: 'MAT-GLUE', quantity: 10.5, unit: 'g' },
      ],
    });

    expect(draft).not.toHaveProperty('goodPieces');
    expect(draft).not.toHaveProperty('rejectedPieces');
    expect(draft).not.toHaveProperty('yieldSample');
  });

  it('falls back to exactly one theoretical pour when no requested quantity was supplied', () => {
    const source = estimate();
    delete source.formula.requestedQuantityEstimate;

    const draft = buildPlasterMoldYieldDraft(source);

    expect(draft.requestedQuantity).toBeUndefined();
    expect(draft.requiredPours).toBe(1);
    expect(draft.producedCapacityPieces).toBe(4);
    expect(draft.extraCapacityPieces).toBe(0);
    expect(draft.totalMixtureGrams).toBe(63);
    expect(draft.materialInputs.map((input) => input.quantity)).toEqual([
      35,
      26.25,
      1.75,
    ]);
  });
});
