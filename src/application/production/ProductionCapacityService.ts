import { MaterialCalibrationError, type MaterialCalibrationEvidence } from '../../domain/materialCalibration';
import { MaterialCostingError } from '../../domain/materialCosting';
import {
  MaterialInventoryError,
  normalizeMaterialOnHand,
  type OnHandConversionSource,
} from '../../domain/materialInventory';
import {
  deriveInventoryLimitedCapacity,
  type MaterialCapacityResult,
} from '../../domain/productionCapacity';
import type { Material } from '../../domain/materials';
import type { CalibrationRepository } from '../calibrations/CalibrationRepository';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type {
  ProductionRequirementPlanResult,
  ProductionRequirementService,
} from './ProductionRequirementService';

export type ProductionCapacityReadinessStatus = 'ready' | 'partial' | 'not-ready';

export type ProductionCapacityIssueCode =
  | 'UPSTREAM_REQUIREMENT_ISSUE'
  | 'MATERIAL_NOT_FOUND'
  | 'MATERIAL_INACTIVE'
  | 'BASE_UNIT_MISMATCH'
  | 'INVENTORY_NOT_DERIVABLE'
  | 'NEGATIVE_INVENTORY';

export interface ProductionCapacityIssue {
  code: ProductionCapacityIssueCode;
  message: string;
  materialId?: string;
  sourceCode?: string;
  sourceId?: string;
}

export interface MaterialProductionCapacity extends MaterialCapacityResult {
  enteredOnHandQuantity: number;
  enteredOnHandUnit: Material['onHandUnit'];
  inventoryConversionSource: OnHandConversionSource;
  inventoryCalibrationId: string | null;
}

export interface ProductionCapacityResult {
  productId: string;
  productIsActive: boolean;
  status: ProductionCapacityReadinessStatus;
  requirementStatus: ProductionRequirementPlanResult['status'];
  effectiveYieldSampleId: string | null;
  skippedInvalidYieldSampleIds: string[];
  safetyWasteRate: number;
  safetyWastePercentage: number;
  safetyWasteMultiplier: number;
  observedDefectRateIncluded: false;
  produciblePieces: number | null;
  limitingMaterialIds: string[];
  materials: MaterialProductionCapacity[];
  issues: ProductionCapacityIssue[];
}

export interface ProductionRequirementCapacityProvider {
  plan(productId: string, plannedQuantity: number): ReturnType<ProductionRequirementService['plan']>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function calibrationForMaterial(
  materialId: string,
  evidence: readonly MaterialCalibrationEvidence[],
): MaterialCalibrationEvidence[] {
  const key = comparable(materialId);
  return evidence.filter((record) => comparable(record.materialId) === key);
}

function isExpectedInventoryFailure(error: unknown): boolean {
  return (
    error instanceof MaterialInventoryError ||
    error instanceof MaterialCalibrationError ||
    error instanceof MaterialCostingError
  );
}

/**
 * Derives current direct-material production capacity.
 *
 * The service deliberately asks Phase 2.4B for a zero-quantity plan because capacity
 * depends on the waste-adjusted per-product requirements, not on a requested batch
 * size. It then resolves current Phase 1 inventory for every required material.
 *
 * If any required inventory or upstream recipe requirement is unresolved, known
 * per-material capacities may still be returned for diagnosis, but overall capacity
 * and limiting materials remain null/empty until the full direct-material picture is
 * reliable.
 */
export class ProductionCapacityService {
  constructor(
    private readonly productionRequirements: ProductionRequirementCapacityProvider,
    private readonly materials: MaterialRepository,
    private readonly calibrations: CalibrationRepository,
  ) {}

  async estimate(productId: string): Promise<ProductionCapacityResult> {
    const plan = await this.productionRequirements.plan(productId, 0);
    const evidence = await this.calibrations.list();

    const issues: ProductionCapacityIssue[] = plan.issues.map((issue) => ({
      code: 'UPSTREAM_REQUIREMENT_ISSUE',
      sourceCode: issue.code,
      sourceId: issue.sourceId,
      message: issue.message,
    }));

    if (plan.requirements.length === 0) {
      return this.result(plan, 'not-ready', null, [], [], issues);
    }

    const capacityInputs: Array<{
      material: Material;
      enteredOnHandQuantity: number;
      enteredOnHandUnit: Material['onHandUnit'];
      inventoryConversionSource: OnHandConversionSource;
      inventoryCalibrationId: string | null;
      materialId: string;
      baseUnit: Material['baseUnit'];
      normalizedOnHandBaseQuantity: number;
      plannedBaseQuantityPerProduct: number;
    }> = [];

    for (const requirement of plan.requirements) {
      const material = await this.materials.findById(requirement.materialId);
      if (!material) {
        issues.push({
          code: 'MATERIAL_NOT_FOUND',
          materialId: requirement.materialId,
          message: `Required material ${requirement.materialId} was not found.`,
        });
        continue;
      }

      if (plan.productIsActive && !material.isActive) {
        issues.push({
          code: 'MATERIAL_INACTIVE',
          materialId: material.id,
          message: `Active product ${plan.productId} cannot use archived material ${material.id} for current production capacity.`,
        });
        continue;
      }

      if (material.baseUnit !== requirement.baseUnit) {
        issues.push({
          code: 'BASE_UNIT_MISMATCH',
          materialId: material.id,
          message: `Material ${material.id} uses base unit ${material.baseUnit}, but the production requirement uses ${requirement.baseUnit}.`,
        });
        continue;
      }

      try {
        const normalized = normalizeMaterialOnHand(
          material,
          calibrationForMaterial(material.id, evidence),
        );

        if (normalized.normalizedBaseQuantity < 0) {
          issues.push({
            code: 'NEGATIVE_INVENTORY',
            materialId: material.id,
            message: `Current normalized inventory for material ${material.id} cannot be negative.`,
          });
          continue;
        }

        capacityInputs.push({
          material,
          enteredOnHandQuantity: normalized.enteredQuantity,
          enteredOnHandUnit: normalized.enteredUnit,
          inventoryConversionSource: normalized.conversionSource,
          inventoryCalibrationId: normalized.calibrationId,
          materialId: material.id,
          baseUnit: material.baseUnit,
          normalizedOnHandBaseQuantity: normalized.normalizedBaseQuantity,
          plannedBaseQuantityPerProduct: requirement.plannedBaseQuantityPerProduct,
        });
      } catch (error) {
        if (!isExpectedInventoryFailure(error)) throw error;
        issues.push({
          code: 'INVENTORY_NOT_DERIVABLE',
          materialId: material.id,
          message: error instanceof Error ? error.message : `Inventory for ${material.id} cannot be normalized.`,
        });
      }
    }

    if (capacityInputs.length === 0) {
      return this.result(plan, 'not-ready', null, [], [], issues);
    }

    const derived = deriveInventoryLimitedCapacity(plan.productId, capacityInputs);
    const complete =
      plan.status === 'ready' &&
      capacityInputs.length === plan.requirements.length &&
      issues.length === 0;

    const metadata = new Map(
      capacityInputs.map((entry) => [comparable(entry.materialId), entry] as const),
    );

    const materialResults: MaterialProductionCapacity[] = derived.materials.map((entry) => {
      const source = metadata.get(comparable(entry.materialId));
      if (!source) throw new Error(`Missing inventory metadata for ${entry.materialId}.`);
      return {
        ...entry,
        isLimiting: complete ? entry.isLimiting : false,
        enteredOnHandQuantity: source.enteredOnHandQuantity,
        enteredOnHandUnit: source.enteredOnHandUnit,
        inventoryConversionSource: source.inventoryConversionSource,
        inventoryCalibrationId: source.inventoryCalibrationId,
      };
    });

    return this.result(
      plan,
      complete ? 'ready' : 'partial',
      complete ? derived.produciblePieces : null,
      complete ? derived.limitingMaterialIds : [],
      materialResults,
      issues,
    );
  }

  private result(
    plan: ProductionRequirementPlanResult,
    status: ProductionCapacityReadinessStatus,
    produciblePieces: number | null,
    limitingMaterialIds: string[],
    materials: MaterialProductionCapacity[],
    issues: ProductionCapacityIssue[],
  ): ProductionCapacityResult {
    return {
      productId: plan.productId,
      productIsActive: plan.productIsActive,
      status,
      requirementStatus: plan.status,
      effectiveYieldSampleId: plan.effectiveYieldSampleId,
      skippedInvalidYieldSampleIds: [...plan.skippedInvalidYieldSampleIds],
      safetyWasteRate: plan.safetyWasteRate,
      safetyWastePercentage: plan.safetyWastePercentage,
      safetyWasteMultiplier: plan.safetyWasteMultiplier,
      observedDefectRateIncluded: false,
      produciblePieces,
      limitingMaterialIds: [...limitingMaterialIds],
      materials: materials.map((entry) => ({ ...entry })),
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
