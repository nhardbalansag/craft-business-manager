import { MaterialCalibrationError, type MaterialCalibrationEvidence } from '../../domain/materialCalibration';
import { MaterialCostingError, calculateMaterialPackageCosting } from '../../domain/materialCosting';
import { MaterialInventoryError, normalizeMaterialOnHand } from '../../domain/materialInventory';
import type { Material } from '../../domain/materials';
import type { CalibrationRepository } from '../calibrations/CalibrationRepository';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type {
  PlasterMoldYieldCalculatorResult,
  PlasterMoldYieldCalculatorService,
  PlasterMoldFormulaMaterialRole,
} from './PlasterMoldYieldCalculatorService';

export type PlasterMoldOperationalPreviewStatus = 'ready' | 'partial' | 'not-ready';
export type PlasterMoldOperationalFeasibility =
  | 'within-current-stock'
  | 'insufficient-current-stock'
  | 'capacity-unresolved';

export type PlasterMoldOperationalIssueCode =
  | 'MATERIAL_NOT_FOUND'
  | 'MATERIAL_COST_NOT_DERIVABLE'
  | 'MATERIAL_INVENTORY_NOT_DERIVABLE'
  | 'NEGATIVE_INVENTORY';

export interface PlasterMoldOperationalIssue {
  code: PlasterMoldOperationalIssueCode;
  materialId: string;
  message: string;
  underlyingCode?: string;
}

export interface PlasterMoldOperationalMaterialLine {
  role: PlasterMoldFormulaMaterialRole;
  materialId: string;
  materialName: string;
  baseUnit: 'g';
  perPourGrams: number;
  perPieceGrams: number;
  targetBatchGrams: number;
  costPerGram: number | null;
  costPerPour: number | null;
  costPerPiece: number | null;
  targetBatchCost: number | null;
  normalizedOnHandGrams: number | null;
  completePourCapacity: number | null;
  producedPieceCapacity: number | null;
  targetShortfallGrams: number | null;
  isLimiting: boolean;
  issues: PlasterMoldOperationalIssue[];
}

export interface PlasterMoldOperationalPreviewResult {
  estimateKind: 'mold-formula-operational-preview';
  moldId: string;
  moldName: string;
  productId: string;
  profileId: string;
  requestedQuantity?: number;
  requiredPours: number;
  producedCapacityPieces: number;
  extraCapacityPieces: number;
  status: PlasterMoldOperationalPreviewStatus;
  feasibility: PlasterMoldOperationalFeasibility;
  estimatedMaterialCostPerPour: number | null;
  estimatedMaterialCostPerPiece: number | null;
  estimatedTargetBatchMaterialCost: number | null;
  maxCompletePoursFromCurrentStock: number | null;
  maxProducedPiecesFromCurrentStock: number | null;
  limitingMaterialIds: string[];
  materials: PlasterMoldOperationalMaterialLine[];
  issues: PlasterMoldOperationalIssue[];
  productSafetyWasteApplied: false;
  yieldEvidenceUsed: false;
  productionPathReplaced: false;
  formula: PlasterMoldYieldCalculatorResult['formula'];
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function expectedOperationalFailure(error: unknown): boolean {
  return (
    error instanceof MaterialCostingError ||
    error instanceof MaterialInventoryError ||
    error instanceof MaterialCalibrationError
  );
}

function sourceCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

function calibrationForMaterial(
  materialId: string,
  records: readonly MaterialCalibrationEvidence[],
): MaterialCalibrationEvidence[] {
  const key = comparable(materialId);
  return records.filter((record) => comparable(record.materialId) === key);
}

function quantityForRole(
  estimate: PlasterMoldYieldCalculatorResult,
  role: PlasterMoldFormulaMaterialRole,
  scope: 'perPour' | 'perPiece' | 'target',
  zeroTarget = false,
): number {
  const target = zeroTarget
    ? {
        adjustedWaterGrams: 0,
        plasterGrams: 0,
        glueGrams: 0,
        totalMixtureGrams: 0,
      }
    : estimate.formula.requestedQuantityEstimate?.totals ??
      estimate.formula.perPour;

  const values =
    scope === 'perPour'
      ? estimate.formula.perPour
      : scope === 'perPiece'
        ? estimate.formula.perPiece
        : target;

  if (role === 'water') return values.adjustedWaterGrams;
  if (role === 'plaster') return values.plasterGrams;
  return values.glueGrams;
}

/**
 * MY7 formula-specific operational preview.
 *
 * This service is deliberately parallel to the existing Production chain. It costs
 * and capacity-checks MY4's theoretical Mold Formula quantities directly and never
 * substitutes them into Effective Recipe Requirements, Product safety waste,
 * Yield learning, planned Production financials, or persisted source data.
 */
export class PlasterMoldOperationalPreviewService {
  constructor(
    private readonly calculator: Pick<
      PlasterMoldYieldCalculatorService,
      'calculateForMold'
    >,
    private readonly materials: MaterialRepository,
    private readonly calibrations: CalibrationRepository,
  ) {}

  async preview(
    moldId: string,
    requestedQuantity?: number,
  ): Promise<PlasterMoldOperationalPreviewResult> {
    const zeroTarget = requestedQuantity === 0;
    const estimate = await this.calculator.calculateForMold(
      moldId,
      zeroTarget ? undefined : requestedQuantity,
    );
    const [allMaterials, allCalibrations] = await Promise.all([
      this.materials.list(),
      this.calibrations.list(),
    ]);
    const materialById = new Map(
      allMaterials.map((material) => [comparable(material.id), material]),
    );

    const roles: PlasterMoldFormulaMaterialRole[] = [
      'water',
      'plaster',
      'glue',
    ];
    const lines: PlasterMoldOperationalMaterialLine[] = [];
    const issues: PlasterMoldOperationalIssue[] = [];

    for (const role of roles) {
      const identity = estimate.materials[role];
      const material = materialById.get(comparable(identity.materialId));

      if (!material) {
        const issue: PlasterMoldOperationalIssue = {
          code: 'MATERIAL_NOT_FOUND',
          materialId: identity.materialId,
          message: `Material ${identity.materialId} was not found for Mold Formula operational preview.`,
        };
        issues.push(issue);
        lines.push(
          this.unresolvedLine(
            estimate,
            role,
            identity.materialId,
            identity.materialName,
            issue,
            zeroTarget,
          ),
        );
        continue;
      }

      const evidence = calibrationForMaterial(material.id, allCalibrations);
      const lineIssues: PlasterMoldOperationalIssue[] = [];
      let costPerGram: number | null = null;
      let normalizedOnHandGrams: number | null = null;

      try {
        costPerGram = calculateMaterialPackageCosting(
          material,
          evidence,
        ).costPerBaseUnit;
      } catch (error) {
        if (!expectedOperationalFailure(error)) throw error;
        const issue: PlasterMoldOperationalIssue = {
          code: 'MATERIAL_COST_NOT_DERIVABLE',
          materialId: material.id,
          message:
            error instanceof Error
              ? error.message
              : `Material ${material.id} cannot be costed.`,
          underlyingCode: sourceCode(error),
        };
        issues.push(issue);
        lineIssues.push(issue);
      }

      try {
        const normalized = normalizeMaterialOnHand(material, evidence);
        if (normalized.normalizedBaseQuantity < 0) {
          const issue: PlasterMoldOperationalIssue = {
            code: 'NEGATIVE_INVENTORY',
            materialId: material.id,
            message: `Current normalized inventory for ${material.name} cannot be negative.`,
          };
          issues.push(issue);
          lineIssues.push(issue);
        } else {
          normalizedOnHandGrams = normalized.normalizedBaseQuantity;
        }
      } catch (error) {
        if (!expectedOperationalFailure(error)) throw error;
        const issue: PlasterMoldOperationalIssue = {
          code: 'MATERIAL_INVENTORY_NOT_DERIVABLE',
          materialId: material.id,
          message:
            error instanceof Error
              ? error.message
              : `Inventory for ${material.id} cannot be normalized.`,
          underlyingCode: sourceCode(error),
        };
        issues.push(issue);
        lineIssues.push(issue);
      }

      lines.push(
        this.resolvedLine(
          estimate,
          role,
          material,
          costPerGram,
          normalizedOnHandGrams,
          lineIssues,
          zeroTarget,
        ),
      );
    }

    const costReady = lines.every((line) => line.costPerGram !== null);
    const capacityRelevant = lines.filter((line) => line.perPourGrams > 0);
    const capacityReady =
      capacityRelevant.length > 0 &&
      capacityRelevant.every((line) => line.completePourCapacity !== null);

    const maxCompletePours = capacityReady
      ? Math.min(
          ...capacityRelevant.map((line) => line.completePourCapacity as number),
        )
      : null;

    const limitingMaterialIds =
      maxCompletePours === null
        ? []
        : capacityRelevant
            .filter((line) => line.completePourCapacity === maxCompletePours)
            .map((line) => line.materialId);

    const materialLines = lines.map((line) => ({
      ...line,
      isLimiting: limitingMaterialIds.some(
        (id) => comparable(id) === comparable(line.materialId),
      ),
      issues: line.issues.map((issue) => ({ ...issue })),
    }));

    const requiredPours = zeroTarget
      ? 0
      : estimate.formula.requestedQuantityEstimate?.requiredPours ?? 1;
    const producedCapacityPieces = zeroTarget
      ? 0
      : estimate.formula.requestedQuantityEstimate?.producedCapacityPieces ??
        estimate.formula.piecesPerPour;
    const extraCapacityPieces = zeroTarget
      ? 0
      : estimate.formula.requestedQuantityEstimate?.extraCapacityPieces ?? 0;

    const feasibility: PlasterMoldOperationalFeasibility =
      maxCompletePours === null
        ? 'capacity-unresolved'
        : maxCompletePours >= requiredPours
          ? 'within-current-stock'
          : 'insufficient-current-stock';

    const status: PlasterMoldOperationalPreviewStatus =
      costReady && capacityReady && issues.length === 0
        ? 'ready'
        : materialLines.every(
              (line) =>
                line.costPerGram === null &&
                line.normalizedOnHandGrams === null,
            )
          ? 'not-ready'
          : 'partial';

    return {
      estimateKind: 'mold-formula-operational-preview',
      moldId: estimate.mold.id,
      moldName: estimate.mold.name,
      productId: estimate.mold.productId,
      profileId: estimate.profile.id,
      ...(requestedQuantity !== undefined ? { requestedQuantity } : {}),
      requiredPours,
      producedCapacityPieces,
      extraCapacityPieces,
      status,
      feasibility,
      estimatedMaterialCostPerPour: costReady
        ? materialLines.reduce(
            (sum, line) => sum + (line.costPerPour as number),
            0,
          )
        : null,
      estimatedMaterialCostPerPiece: costReady
        ? materialLines.reduce(
            (sum, line) => sum + (line.costPerPiece as number),
            0,
          )
        : null,
      estimatedTargetBatchMaterialCost: costReady
        ? materialLines.reduce(
            (sum, line) => sum + (line.targetBatchCost as number),
            0,
          )
        : null,
      maxCompletePoursFromCurrentStock: maxCompletePours,
      maxProducedPiecesFromCurrentStock:
        maxCompletePours === null
          ? null
          : maxCompletePours * estimate.formula.piecesPerPour,
      limitingMaterialIds,
      materials: materialLines,
      issues: issues.map((issue) => ({ ...issue })),
      productSafetyWasteApplied: false,
      yieldEvidenceUsed: false,
      productionPathReplaced: false,
      formula: structuredClone(estimate.formula),
    };
  }

  private resolvedLine(
    estimate: PlasterMoldYieldCalculatorResult,
    role: PlasterMoldFormulaMaterialRole,
    material: Material,
    costPerGram: number | null,
    normalizedOnHandGrams: number | null,
    issues: PlasterMoldOperationalIssue[],
    zeroTarget = false,
  ): PlasterMoldOperationalMaterialLine {
    const perPourGrams = quantityForRole(estimate, role, 'perPour');
    const perPieceGrams = quantityForRole(estimate, role, 'perPiece');
    const targetBatchGrams = quantityForRole(
      estimate,
      role,
      'target',
      zeroTarget,
    );
    const completePourCapacity =
      normalizedOnHandGrams === null || perPourGrams <= 0
        ? null
        : Math.floor(normalizedOnHandGrams / perPourGrams);

    return {
      role,
      materialId: material.id,
      materialName: material.name,
      baseUnit: 'g',
      perPourGrams,
      perPieceGrams,
      targetBatchGrams,
      costPerGram,
      costPerPour:
        costPerGram === null ? null : perPourGrams * costPerGram,
      costPerPiece:
        costPerGram === null ? null : perPieceGrams * costPerGram,
      targetBatchCost:
        costPerGram === null ? null : targetBatchGrams * costPerGram,
      normalizedOnHandGrams,
      completePourCapacity,
      producedPieceCapacity:
        completePourCapacity === null
          ? null
          : completePourCapacity * estimate.formula.piecesPerPour,
      targetShortfallGrams:
        normalizedOnHandGrams === null
          ? null
          : Math.max(0, targetBatchGrams - normalizedOnHandGrams),
      isLimiting: false,
      issues,
    };
  }

  private unresolvedLine(
    estimate: PlasterMoldYieldCalculatorResult,
    role: PlasterMoldFormulaMaterialRole,
    materialId: string,
    materialName: string,
    issue: PlasterMoldOperationalIssue,
    zeroTarget = false,
  ): PlasterMoldOperationalMaterialLine {
    return {
      role,
      materialId,
      materialName,
      baseUnit: 'g',
      perPourGrams: quantityForRole(estimate, role, 'perPour'),
      perPieceGrams: quantityForRole(estimate, role, 'perPiece'),
      targetBatchGrams: quantityForRole(
        estimate,
        role,
        'target',
        zeroTarget,
      ),
      costPerGram: null,
      costPerPour: null,
      costPerPiece: null,
      targetBatchCost: null,
      normalizedOnHandGrams: null,
      completePourCapacity: null,
      producedPieceCapacity: null,
      targetShortfallGrams: null,
      isLimiting: false,
      issues: [{ ...issue }],
    };
  }
}
