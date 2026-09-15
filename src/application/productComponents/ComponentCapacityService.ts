import {
  ComponentCapacityError,
  deriveComponentCapacity,
  type ComponentCapacityErrorCode,
} from '../../domain/componentCapacity';
import {
  ProductComponentError,
  type ProductComponent,
  type ProductComponentErrorCode,
  type ProductComponentRole,
  type ProductComponentSourceType,
  validateProductComponentContract,
} from '../../domain/productComponents';
import type {
  ComponentSourceAvailability,
  ComponentSourceAvailabilityIssueCode,
} from './ComponentSourceAvailabilityService';

export type ComponentCapacityStatus = 'ready' | 'partial' | 'not-ready';

export type ComponentCapacityIssueCode =
  | 'INVALID_COMPONENT'
  | 'SOURCE_AVAILABILITY_PARTIAL'
  | 'SOURCE_AVAILABILITY_NOT_READY'
  | 'AVAILABLE_QUANTITY_INVALID'
  | 'DERIVED_CAPACITY_INVALID';

export type ComponentCapacityUnderlyingCode =
  | ProductComponentErrorCode
  | ComponentSourceAvailabilityIssueCode
  | ComponentCapacityErrorCode;

export interface ComponentCapacityIssue {
  code: ComponentCapacityIssueCode;
  message: string;
  underlyingCode?: ComponentCapacityUnderlyingCode;
}

export interface ComponentCapacityResult {
  componentId: string;
  parentProductId: string;
  role: ProductComponentRole;
  sourceType: ProductComponentSourceType;
  sourceId: string;
  quantityPerParent: number;
  status: ComponentCapacityStatus;
  availableQuantity: number | null;
  unit: 'pc';
  capacityPieces: number | null;
  sourceAvailability: ComponentSourceAvailability | null;
  issues: ComponentCapacityIssue[];
}

export interface ComponentCapacityAvailabilityProvider {
  resolveComponent(
    component: Pick<ProductComponent, 'sourceType' | 'sourceId'>,
  ): Promise<ComponentSourceAvailability>;
}

function cloneAvailability(value: ComponentSourceAvailability): ComponentSourceAvailability {
  return {
    ...value,
    issues: value.issues.map((issue) => ({ ...issue })),
    materialInventoryNormalization: value.materialInventoryNormalization
      ? { ...value.materialInventoryNormalization }
      : undefined,
    productStock: value.productStock ? { ...value.productStock } : value.productStock,
  };
}

function baseResult(component: ProductComponent): Pick<
  ComponentCapacityResult,
  'componentId' | 'parentProductId' | 'role' | 'sourceType' | 'sourceId' | 'quantityPerParent' | 'unit'
> {
  return {
    componentId: component.id.trim(),
    parentProductId: component.parentProductId.trim(),
    role: component.role,
    sourceType: component.sourceType,
    sourceId: component.sourceId.trim(),
    quantityPerParent: component.quantityPerParent,
    unit: 'pc',
  };
}

/**
 * Phase 3.4A per-component assembly-capacity view.
 *
 * Source quantity/readiness belongs to Phase 3.2C. This service only validates the
 * component line, delegates availability, and derives floor(available / required).
 * It never synthesizes overall Product capacity or identifies limiting resources.
 */
export class ComponentCapacityService {
  constructor(private readonly availability: ComponentCapacityAvailabilityProvider) {}

  async capacityForComponent(component: ProductComponent): Promise<ComponentCapacityResult> {
    try {
      validateProductComponentContract(component);
    } catch (error) {
      if (error instanceof ProductComponentError) {
        return {
          ...baseResult(component),
          status: 'not-ready',
          availableQuantity: null,
          capacityPieces: null,
          sourceAvailability: null,
          issues: [
            {
              code: 'INVALID_COMPONENT',
              message: error.message,
              underlyingCode: error.code,
            },
          ],
        };
      }
      throw error;
    }

    const sourceAvailability = await this.availability.resolveComponent(component);
    const availabilitySnapshot = cloneAvailability(sourceAvailability);

    if (sourceAvailability.status === 'partial') {
      return {
        ...baseResult(component),
        sourceId: sourceAvailability.sourceId,
        status: 'partial',
        availableQuantity: null,
        capacityPieces: null,
        sourceAvailability: availabilitySnapshot,
        issues: [
          {
            code: 'SOURCE_AVAILABILITY_PARTIAL',
            message:
              sourceAvailability.issues[0]?.message ??
              `Current availability for component source ${sourceAvailability.sourceId} is unresolved.`,
            underlyingCode: sourceAvailability.issues[0]?.code,
          },
        ],
      };
    }

    if (sourceAvailability.status === 'not-ready') {
      return {
        ...baseResult(component),
        sourceId: sourceAvailability.sourceId,
        status: 'not-ready',
        availableQuantity: null,
        capacityPieces: null,
        sourceAvailability: availabilitySnapshot,
        issues: [
          {
            code: 'SOURCE_AVAILABILITY_NOT_READY',
            message:
              sourceAvailability.issues[0]?.message ??
              `Component source ${sourceAvailability.sourceId} is not ready for current capacity calculation.`,
            underlyingCode: sourceAvailability.issues[0]?.code,
          },
        ],
      };
    }

    if (sourceAvailability.availableQuantity === null) {
      return {
        ...baseResult(component),
        sourceId: sourceAvailability.sourceId,
        status: 'partial',
        availableQuantity: null,
        capacityPieces: null,
        sourceAvailability: availabilitySnapshot,
        issues: [
          {
            code: 'AVAILABLE_QUANTITY_INVALID',
            message: `Ready availability for component source ${sourceAvailability.sourceId} did not provide a quantity.`,
            underlyingCode: 'INVALID_AVAILABLE_QUANTITY',
          },
        ],
      };
    }

    try {
      const derived = deriveComponentCapacity({
        availableQuantity: sourceAvailability.availableQuantity,
        quantityPerParent: component.quantityPerParent,
      });

      return {
        ...baseResult(component),
        sourceId: sourceAvailability.sourceId,
        status: 'ready',
        availableQuantity: derived.availableQuantity,
        capacityPieces: derived.capacityPieces,
        sourceAvailability: availabilitySnapshot,
        issues: [],
      };
    } catch (error) {
      if (error instanceof ComponentCapacityError) {
        return {
          ...baseResult(component),
          sourceId: sourceAvailability.sourceId,
          status: 'partial',
          availableQuantity:
            Number.isFinite(sourceAvailability.availableQuantity) &&
            sourceAvailability.availableQuantity >= 0
              ? sourceAvailability.availableQuantity
              : null,
          capacityPieces: null,
          sourceAvailability: availabilitySnapshot,
          issues: [
            {
              code:
                error.code === 'DERIVED_CAPACITY_INVALID'
                  ? 'DERIVED_CAPACITY_INVALID'
                  : 'AVAILABLE_QUANTITY_INVALID',
              message: error.message,
              underlyingCode: error.code,
            },
          ],
        };
      }
      throw error;
    }
  }
}
