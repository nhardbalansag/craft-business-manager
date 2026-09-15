import {
  MaterialCalibrationError,
  type MaterialCalibrationErrorCode,
  type MaterialCalibrationEvidence,
} from '../../domain/materialCalibration';
import {
  calculateMaterialPackageCosting,
  MaterialCostingError,
  type MaterialCostingErrorCode,
  type PackageConversionSource,
} from '../../domain/materialCosting';
import {
  ProductComponentError,
  type ProductComponent,
  type ProductComponentErrorCode,
  type ProductComponentRole,
  validateProductComponentContract,
} from '../../domain/productComponents';
import type { MaterialPurchaseUnit } from '../../domain/materials';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type {
  ComponentSourceAvailability,
  ComponentSourceAvailabilityIssueCode,
} from './ComponentSourceAvailabilityService';

export type MaterialBackedComponentCostStatus = 'ready' | 'not-ready';

export type MaterialBackedComponentCostIssueCode =
  | 'INVALID_COMPONENT'
  | 'NOT_MATERIAL_BACKED_COMPONENT'
  | 'SOURCE_MATERIAL_NOT_READY'
  | 'SOURCE_MATERIAL_NOT_FOUND'
  | 'MATERIAL_COST_NOT_DERIVABLE'
  | 'DERIVED_COST_INVALID';

export type MaterialBackedComponentCostUnderlyingCode =
  | ProductComponentErrorCode
  | ComponentSourceAvailabilityIssueCode
  | MaterialCostingErrorCode
  | MaterialCalibrationErrorCode;

export interface MaterialBackedComponentCostIssue {
  code: MaterialBackedComponentCostIssueCode;
  message: string;
  underlyingCode?: MaterialBackedComponentCostUnderlyingCode;
}

export interface MaterialBackedComponentCostTrace {
  packageCost: number;
  purchaseQuantity: number;
  purchaseUnit: MaterialPurchaseUnit;
  baseUnit: 'pc';
  standardBaseUnitsPerPurchaseUnit: number | null;
  manualBaseUnitsPerPurchaseUnit: number | null;
  calibrationBaseUnitsPerPurchaseUnit: number | null;
  effectiveBaseUnitsPerPurchaseUnit: number;
  packageBaseQuantity: number;
  packageConversionSource: PackageConversionSource;
  costingCalibrationId: string | null;
}

export interface MaterialBackedComponentCostLine {
  componentId: string;
  parentProductId: string;
  role: ProductComponentRole;
  sourceMaterialId: string;
  sourceMaterialName: string | null;
  quantityPerParent: number;
  status: MaterialBackedComponentCostStatus;
  costPerPc: number | null;
  componentCostContribution: number | null;
  costingTrace: MaterialBackedComponentCostTrace | null;
  sourceAvailability: ComponentSourceAvailability | null;
  issues: MaterialBackedComponentCostIssue[];
}

export interface ComponentSourceAvailabilityProvider {
  resolveComponent(
    component: Pick<ProductComponent, 'sourceType' | 'sourceId'>,
  ): Promise<ComponentSourceAvailability>;
}

export type MaterialBackedComponentCalibrationEvidenceProvider = (
  materialId: string,
) => Promise<readonly MaterialCalibrationEvidence[]>;

function baseLine(component: ProductComponent): Omit<
  MaterialBackedComponentCostLine,
  'status' | 'costPerPc' | 'componentCostContribution' | 'costingTrace' | 'sourceAvailability' | 'issues'
> {
  return {
    componentId: component.id.trim(),
    parentProductId: component.parentProductId.trim(),
    role: component.role,
    sourceMaterialId: component.sourceId.trim(),
    sourceMaterialName: null,
    quantityPerParent: component.quantityPerParent,
  };
}

function notReady(
  component: ProductComponent,
  issue: MaterialBackedComponentCostIssue,
  context: {
    sourceMaterialId?: string;
    sourceMaterialName?: string | null;
    sourceAvailability?: ComponentSourceAvailability | null;
  } = {},
): MaterialBackedComponentCostLine {
  return {
    ...baseLine(component),
    sourceMaterialId: context.sourceMaterialId ?? component.sourceId.trim(),
    sourceMaterialName: context.sourceMaterialName ?? null,
    status: 'not-ready',
    costPerPc: null,
    componentCostContribution: null,
    costingTrace: null,
    sourceAvailability: context.sourceAvailability ?? null,
    issues: [issue],
  };
}

/**
 * Derives the current cost of one material-backed ProductComponent line.
 *
 * Phase 1 calculateMaterialPackageCosting() remains the sole package-cost engine.
 * 3.2C remains the source-eligibility authority. Current stock quantity/readiness
 * does not participate in cost mathematics, so a `partial` availability result
 * does not block an otherwise derivable cost basis.
 */
export class MaterialBackedComponentCostService {
  constructor(
    private readonly materials: MaterialRepository,
    private readonly availability: ComponentSourceAvailabilityProvider,
    private readonly calibrationEvidenceProvider: MaterialBackedComponentCalibrationEvidenceProvider = async () => [],
  ) {}

  async costComponent(component: ProductComponent): Promise<MaterialBackedComponentCostLine> {
    try {
      validateProductComponentContract(component);
    } catch (error) {
      if (error instanceof ProductComponentError) {
        return notReady(component, {
          code: 'INVALID_COMPONENT',
          message: error.message,
          underlyingCode: error.code,
        });
      }
      throw error;
    }

    if (component.sourceType !== 'material') {
      return notReady(component, {
        code: 'NOT_MATERIAL_BACKED_COMPONENT',
        message: `Component ${component.id} is ${component.sourceType}-backed and is outside Phase 3.3A material-backed costing.`,
      });
    }

    const sourceAvailability = await this.availability.resolveComponent(component);
    const material = await this.materials.findById(sourceAvailability.sourceId);

    if (sourceAvailability.status === 'not-ready') {
      return notReady(
        component,
        {
          code: 'SOURCE_MATERIAL_NOT_READY',
          message:
            sourceAvailability.issues[0]?.message ??
            `Material source ${sourceAvailability.sourceId} is not ready for component costing.`,
          underlyingCode: sourceAvailability.issues[0]?.code,
        },
        {
          sourceMaterialId: sourceAvailability.sourceId,
          sourceMaterialName: material?.name ?? null,
          sourceAvailability,
        },
      );
    }

    if (!material) {
      return notReady(
        component,
        {
          code: 'SOURCE_MATERIAL_NOT_FOUND',
          message: `Material ${sourceAvailability.sourceId} was not found for component costing.`,
        },
        {
          sourceMaterialId: sourceAvailability.sourceId,
          sourceAvailability,
        },
      );
    }

    const evidence = await this.calibrationEvidenceProvider(material.id);

    try {
      const costing = calculateMaterialPackageCosting(material, evidence);
      const costPerPc = costing.costPerBaseUnit;
      const componentCostContribution = costPerPc * component.quantityPerParent;

      if (
        !Number.isFinite(costPerPc) ||
        costPerPc < 0 ||
        !Number.isFinite(componentCostContribution) ||
        componentCostContribution < 0
      ) {
        return notReady(
          component,
          {
            code: 'DERIVED_COST_INVALID',
            message: `Derived component cost for ${component.id} is not a finite non-negative value.`,
          },
          {
            sourceMaterialId: material.id,
            sourceMaterialName: material.name,
            sourceAvailability,
          },
        );
      }

      return {
        ...baseLine(component),
        sourceMaterialId: material.id,
        sourceMaterialName: material.name,
        status: 'ready',
        costPerPc,
        componentCostContribution,
        costingTrace: {
          packageCost: material.packageCost,
          purchaseQuantity: material.purchaseQuantity,
          purchaseUnit: material.purchaseUnit,
          baseUnit: 'pc',
          standardBaseUnitsPerPurchaseUnit: costing.standardBaseUnitsPerPurchaseUnit,
          manualBaseUnitsPerPurchaseUnit: costing.manualBaseUnitsPerPurchaseUnit,
          calibrationBaseUnitsPerPurchaseUnit: costing.calibrationBaseUnitsPerPurchaseUnit,
          effectiveBaseUnitsPerPurchaseUnit: costing.effectiveBaseUnitsPerPurchaseUnit,
          packageBaseQuantity: costing.packageBaseQuantity,
          packageConversionSource: costing.effectiveConversionSource,
          costingCalibrationId: costing.effectiveCalibrationId,
        },
        sourceAvailability,
        issues: [],
      };
    } catch (error) {
      if (error instanceof MaterialCostingError || error instanceof MaterialCalibrationError) {
        return notReady(
          component,
          {
            code: 'MATERIAL_COST_NOT_DERIVABLE',
            message: error.message,
            underlyingCode: error.code,
          },
          {
            sourceMaterialId: material.id,
            sourceMaterialName: material.name,
            sourceAvailability,
          },
        );
      }
      throw error;
    }
  }
}
