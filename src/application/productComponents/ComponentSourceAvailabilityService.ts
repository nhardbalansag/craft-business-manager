import type { MaterialCalibrationEvidence } from '../../domain/materialCalibration';
import {
  MaterialCostingError,
  type MaterialCostingErrorCode,
} from '../../domain/materialCosting';
import {
  MaterialInventoryError,
  normalizeMaterialOnHand,
  type MaterialInventoryErrorCode,
  type MaterialOnHandNormalization,
} from '../../domain/materialInventory';
import type {
  ProductComponent,
  ProductComponentSourceType,
} from '../../domain/productComponents';
import {
  cloneProductStock,
  ProductStockError,
  type ProductStock,
  type ProductStockErrorCode,
  validateProductStockContract,
} from '../../domain/productStock';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { ProductRepository } from '../products/ProductRepository';
import type { ProductStockRepository } from '../productStocks/ProductStockRepository';

export type ComponentSourceAvailabilityStatus = 'ready' | 'partial' | 'not-ready';

export type ComponentSourceAvailabilityIssueCode =
  | 'SOURCE_MATERIAL_NOT_FOUND'
  | 'SOURCE_MATERIAL_INACTIVE'
  | 'SOURCE_MATERIAL_NOT_COUNT_BASED'
  | 'SOURCE_MATERIAL_INVENTORY_UNRESOLVED'
  | 'SOURCE_MATERIAL_NEGATIVE_ON_HAND'
  | 'SOURCE_PRODUCT_NOT_FOUND'
  | 'SOURCE_PRODUCT_INACTIVE'
  | 'SOURCE_PRODUCT_STOCK_MISSING'
  | 'SOURCE_PRODUCT_STOCK_INVALID';

export type ComponentSourceAvailabilityUnderlyingCode =
  | MaterialInventoryErrorCode
  | MaterialCostingErrorCode
  | ProductStockErrorCode;

export interface ComponentSourceAvailabilityIssue {
  code: ComponentSourceAvailabilityIssueCode;
  message: string;
  underlyingCode?: ComponentSourceAvailabilityUnderlyingCode;
}

export interface ComponentSourceAvailability {
  sourceType: ProductComponentSourceType;
  sourceId: string;
  status: ComponentSourceAvailabilityStatus;
  availableQuantity: number | null;
  unit: 'pc';
  issues: ComponentSourceAvailabilityIssue[];
  materialInventoryNormalization?: MaterialOnHandNormalization;
  productStock?: ProductStock | null;
}

export type ComponentAvailabilityCalibrationEvidenceProvider = (
  materialId: string,
) => Promise<readonly MaterialCalibrationEvidence[]>;

function unresolved(
  sourceType: ProductComponentSourceType,
  sourceId: string,
  status: Exclude<ComponentSourceAvailabilityStatus, 'ready'>,
  issue: ComponentSourceAvailabilityIssue,
  extras: Pick<
    ComponentSourceAvailability,
    'materialInventoryNormalization' | 'productStock'
  > = {},
): ComponentSourceAvailability {
  return {
    sourceType,
    sourceId,
    status,
    availableQuantity: null,
    unit: 'pc',
    issues: [issue],
    ...extras,
  };
}

/**
 * Resolves current availability for either Phase 3 component source type.
 *
 * This is a derived application view only. It never mutates inventory/stock,
 * reserves quantities, computes assembly capacity, or persists readiness.
 */
export class ComponentSourceAvailabilityService {
  constructor(
    private readonly materials: MaterialRepository,
    private readonly products: ProductRepository,
    private readonly productStocks: ProductStockRepository,
    private readonly calibrationEvidenceProvider: ComponentAvailabilityCalibrationEvidenceProvider = async () => [],
  ) {}

  async resolveComponent(
    component: Pick<ProductComponent, 'sourceType' | 'sourceId'>,
  ): Promise<ComponentSourceAvailability> {
    return this.resolveSource(component.sourceType, component.sourceId);
  }

  async resolveSource(
    sourceType: ProductComponentSourceType,
    sourceId: string,
  ): Promise<ComponentSourceAvailability> {
    return sourceType === 'material'
      ? this.resolveMaterial(sourceId)
      : this.resolveProduct(sourceId);
  }

  private async resolveMaterial(sourceId: string): Promise<ComponentSourceAvailability> {
    const requestedId = sourceId.trim();
    const material = await this.materials.findById(requestedId);

    if (!material) {
      return unresolved('material', requestedId, 'not-ready', {
        code: 'SOURCE_MATERIAL_NOT_FOUND',
        message: `Component material source not found: ${requestedId}.`,
      });
    }

    if (!material.isActive) {
      return unresolved('material', material.id, 'not-ready', {
        code: 'SOURCE_MATERIAL_INACTIVE',
        message: `Component material source is archived/inactive: ${material.id}.`,
      });
    }

    if (material.baseUnit !== 'pc') {
      return unresolved('material', material.id, 'not-ready', {
        code: 'SOURCE_MATERIAL_NOT_COUNT_BASED',
        message: `Component material ${material.id} must use canonical base unit pc; found ${material.baseUnit}.`,
      });
    }

    const evidence = await this.calibrationEvidenceProvider(material.id);

    try {
      const normalization = normalizeMaterialOnHand(material, evidence);

      if (normalization.normalizedBaseQuantity < 0) {
        return unresolved(
          'material',
          material.id,
          'partial',
          {
            code: 'SOURCE_MATERIAL_NEGATIVE_ON_HAND',
            message: `Component material ${material.id} has negative normalized on-hand stock and cannot provide current availability.`,
          },
          { materialInventoryNormalization: normalization },
        );
      }

      return {
        sourceType: 'material',
        sourceId: material.id,
        status: 'ready',
        availableQuantity: normalization.normalizedBaseQuantity,
        unit: 'pc',
        issues: [],
        materialInventoryNormalization: normalization,
      };
    } catch (error) {
      if (error instanceof MaterialInventoryError || error instanceof MaterialCostingError) {
        return unresolved('material', material.id, 'partial', {
          code: 'SOURCE_MATERIAL_INVENTORY_UNRESOLVED',
          message: error.message,
          underlyingCode: error.code,
        });
      }
      throw error;
    }
  }

  private async resolveProduct(sourceId: string): Promise<ComponentSourceAvailability> {
    const requestedId = sourceId.trim();
    const product = await this.products.findById(requestedId);

    if (!product) {
      return unresolved('product', requestedId, 'not-ready', {
        code: 'SOURCE_PRODUCT_NOT_FOUND',
        message: `Component Product source not found: ${requestedId}.`,
      });
    }

    if (!product.isActive) {
      return unresolved('product', product.id, 'not-ready', {
        code: 'SOURCE_PRODUCT_INACTIVE',
        message: `Component Product source is archived/inactive: ${product.id}.`,
      });
    }

    const stock = await this.productStocks.findByProductId(product.id);
    if (!stock) {
      return unresolved(
        'product',
        product.id,
        'partial',
        {
          code: 'SOURCE_PRODUCT_STOCK_MISSING',
          message: `Current ProductStock is unresolved for component Product ${product.id}.`,
        },
        { productStock: null },
      );
    }

    try {
      validateProductStockContract(stock);
    } catch (error) {
      if (error instanceof ProductStockError) {
        return unresolved(
          'product',
          product.id,
          'partial',
          {
            code: 'SOURCE_PRODUCT_STOCK_INVALID',
            message: error.message,
            underlyingCode: error.code,
          },
          { productStock: cloneProductStock(stock) },
        );
      }
      throw error;
    }

    return {
      sourceType: 'product',
      sourceId: product.id,
      status: 'ready',
      availableQuantity: stock.onHandQuantity,
      unit: 'pc',
      issues: [],
      productStock: cloneProductStock(stock),
    };
  }
}
