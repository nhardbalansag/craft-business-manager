import type { PlasterMoldYieldCalculatorResult } from '../../application/plasterMoldYieldProfiles/PlasterMoldYieldCalculatorService';

export type PlasterMoldYieldDraftMaterialRole = 'water' | 'plaster' | 'glue';

export interface PlasterMoldYieldDraftMaterialInput {
  role: PlasterMoldYieldDraftMaterialRole;
  materialId: string;
  quantity: number;
  unit: 'g';
}

export interface PlasterMoldYieldDraft {
  sourceKind: 'plaster-mold-formula';
  estimateKind: 'theoretical';
  moldId: string;
  moldName: string;
  productId: string;
  profileId: string;
  requestedQuantity?: number;
  requiredPours: number;
  producedCapacityPieces: number;
  extraCapacityPieces: number;
  totalMixtureGrams: number;
  materialInputs: readonly PlasterMoldYieldDraftMaterialInput[];
}

/**
 * Converts an MY4 theoretical estimate into a Yield-form draft payload.
 *
 * This function deliberately does not produce good/rejected piece evidence and
 * does not return a YieldSample. MY6 only uses it to pre-fill editable draft
 * material quantities before the user measures/confirms the real batch.
 */
export function buildPlasterMoldYieldDraft(
  estimate: PlasterMoldYieldCalculatorResult,
): PlasterMoldYieldDraft {
  const requested = estimate.formula.requestedQuantityEstimate;
  const totals = requested?.totals ?? estimate.formula.perPour;

  return {
    sourceKind: 'plaster-mold-formula',
    estimateKind: 'theoretical',
    moldId: estimate.mold.id,
    moldName: estimate.mold.name,
    productId: estimate.mold.productId,
    profileId: estimate.profile.id,
    ...(requested
      ? { requestedQuantity: requested.requestedQuantity }
      : {}),
    requiredPours: requested?.requiredPours ?? 1,
    producedCapacityPieces:
      requested?.producedCapacityPieces ?? estimate.formula.piecesPerPour,
    extraCapacityPieces: requested?.extraCapacityPieces ?? 0,
    totalMixtureGrams: totals.totalMixtureGrams,
    materialInputs: [
      {
        role: 'water',
        materialId: estimate.materials.water.materialId,
        quantity: totals.adjustedWaterGrams,
        unit: 'g',
      },
      {
        role: 'plaster',
        materialId: estimate.materials.plaster.materialId,
        quantity: totals.plasterGrams,
        unit: 'g',
      },
      {
        role: 'glue',
        materialId: estimate.materials.glue.materialId,
        quantity: totals.glueGrams,
        unit: 'g',
      },
    ],
  };
}
