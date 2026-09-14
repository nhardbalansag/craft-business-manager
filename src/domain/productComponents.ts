import type { Material } from './materials';

export const PRODUCT_COMPONENT_SOURCE_TYPES = ['material', 'product'] as const;
export type ProductComponentSourceType = (typeof PRODUCT_COMPONENT_SOURCE_TYPES)[number];

export const PRODUCT_COMPONENT_ROLES = [
  'vessel',
  'molded-component',
  'decorative-component',
  'insert',
  'accessory',
  'other',
] as const;

export type ProductComponentRole = (typeof PRODUCT_COMPONENT_ROLES)[number];

/**
 * Authoritative Phase 3 composition source record.
 *
 * A component is a discrete physical requirement for one parent product. Derived
 * cost, availability, and capacity never belong on this source contract.
 */
export interface ProductComponent {
  id: string;
  parentProductId: string;
  sourceType: ProductComponentSourceType;
  sourceId: string;
  role: ProductComponentRole;
  quantityPerParent: number;
  notes?: string;
}

const SOURCE_TYPE_SET: ReadonlySet<string> = new Set(PRODUCT_COMPONENT_SOURCE_TYPES);
const ROLE_SET: ReadonlySet<string> = new Set(PRODUCT_COMPONENT_ROLES);

export type ProductComponentErrorCode =
  | 'INVALID_ID'
  | 'INVALID_PARENT_PRODUCT_ID'
  | 'INVALID_SOURCE_TYPE'
  | 'INVALID_SOURCE_ID'
  | 'NON_FINITE_QUANTITY'
  | 'NON_INTEGER_QUANTITY'
  | 'NON_POSITIVE_QUANTITY'
  | 'INVALID_ROLE'
  | 'SOURCE_TYPE_MISMATCH'
  | 'SOURCE_ID_MISMATCH'
  | 'NON_COUNT_MATERIAL_SOURCE';

export class ProductComponentError extends Error {
  readonly code: ProductComponentErrorCode;
  readonly componentId?: string;
  readonly parentProductId?: string;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly input?: unknown;

  constructor(
    code: ProductComponentErrorCode,
    message: string,
    context: {
      componentId?: string;
      parentProductId?: string;
      sourceType?: string;
      sourceId?: string;
      input?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ProductComponentError';
    this.code = code;
    this.componentId = context.componentId;
    this.parentProductId = context.parentProductId;
    this.sourceType = context.sourceType;
    this.sourceId = context.sourceId;
    this.input = context.input;
  }
}

export function isProductComponentSourceType(value: unknown): value is ProductComponentSourceType {
  return typeof value === 'string' && SOURCE_TYPE_SET.has(value);
}

export function isProductComponentRole(value: unknown): value is ProductComponentRole {
  return typeof value === 'string' && ROLE_SET.has(value);
}

export function cloneProductComponent(component: ProductComponent): ProductComponent {
  return { ...component };
}

/**
 * Normalizes identity/source text for the future repository/service boundary.
 * Blank notes are omitted instead of persisted as meaningless source data.
 */
export function normalizeProductComponent(component: ProductComponent): ProductComponent {
  const notes = component.notes?.trim();

  return {
    ...component,
    id: component.id.trim(),
    parentProductId: component.parentProductId.trim(),
    sourceId: component.sourceId.trim(),
    notes: notes ? notes : undefined,
  };
}

/**
 * Phase 3 duplicate-source identity policy.
 *
 * One parent may have only one line for a given source kind/source identity.
 * Role is intentionally excluded: change/combine the line instead of duplicating
 * the same physical source under another role.
 */
export function getProductComponentSourceKey(component: ProductComponent): string {
  return [
    component.parentProductId.trim().toLowerCase(),
    component.sourceType,
    component.sourceId.trim().toLowerCase(),
  ].join('::');
}

export function hasSameProductComponentSource(
  left: ProductComponent,
  right: ProductComponent,
): boolean {
  return getProductComponentSourceKey(left) === getProductComponentSourceKey(right);
}

/**
 * Validates only the authoritative component source shape.
 *
 * Product graph/self/cycle rules are Phase 3.1B. Repository identity existence,
 * active-state relationships, and duplicate persistence enforcement are Phase 3.1C.
 */
export function validateProductComponentContract(component: ProductComponent): void {
  if (!component.id.trim()) {
    throw new ProductComponentError('INVALID_ID', 'Product component ID is required.', {
      componentId: component.id,
      input: component.id,
    });
  }

  if (!component.parentProductId.trim()) {
    throw new ProductComponentError(
      'INVALID_PARENT_PRODUCT_ID',
      'Parent product ID is required.',
      {
        componentId: component.id,
        parentProductId: component.parentProductId,
        input: component.parentProductId,
      },
    );
  }

  if (!isProductComponentSourceType(component.sourceType)) {
    throw new ProductComponentError(
      'INVALID_SOURCE_TYPE',
      `Unsupported component source type: ${String(component.sourceType)}.`,
      {
        componentId: component.id,
        parentProductId: component.parentProductId,
        sourceType: String(component.sourceType),
        sourceId: component.sourceId,
        input: component.sourceType,
      },
    );
  }

  if (!component.sourceId.trim()) {
    throw new ProductComponentError('INVALID_SOURCE_ID', 'Component source ID is required.', {
      componentId: component.id,
      parentProductId: component.parentProductId,
      sourceType: component.sourceType,
      sourceId: component.sourceId,
      input: component.sourceId,
    });
  }

  if (!Number.isFinite(component.quantityPerParent)) {
    throw new ProductComponentError(
      'NON_FINITE_QUANTITY',
      'Component quantity per parent must be finite.',
      {
        componentId: component.id,
        parentProductId: component.parentProductId,
        sourceType: component.sourceType,
        sourceId: component.sourceId,
        input: component.quantityPerParent,
      },
    );
  }

  if (!Number.isInteger(component.quantityPerParent)) {
    throw new ProductComponentError(
      'NON_INTEGER_QUANTITY',
      'Component quantity per parent must be a whole-piece count.',
      {
        componentId: component.id,
        parentProductId: component.parentProductId,
        sourceType: component.sourceType,
        sourceId: component.sourceId,
        input: component.quantityPerParent,
      },
    );
  }

  if (component.quantityPerParent <= 0) {
    throw new ProductComponentError(
      'NON_POSITIVE_QUANTITY',
      'Component quantity per parent must be greater than zero.',
      {
        componentId: component.id,
        parentProductId: component.parentProductId,
        sourceType: component.sourceType,
        sourceId: component.sourceId,
        input: component.quantityPerParent,
      },
    );
  }

  if (!isProductComponentRole(component.role)) {
    throw new ProductComponentError(
      'INVALID_ROLE',
      `Unsupported product component role: ${String(component.role)}.`,
      {
        componentId: component.id,
        parentProductId: component.parentProductId,
        sourceType: component.sourceType,
        sourceId: component.sourceId,
        input: component.role,
      },
    );
  }
}

/**
 * Enforces the Phase 3 discrete-material boundary without requiring repositories.
 * Purchased/material-backed components must resolve to count-based Material stock.
 */
export function validateMaterialBackedProductComponent(
  component: ProductComponent,
  material: Material,
): void {
  validateProductComponentContract(component);

  if (component.sourceType !== 'material') {
    throw new ProductComponentError(
      'SOURCE_TYPE_MISMATCH',
      `Component ${component.id} is ${component.sourceType}-backed, not material-backed.`,
      {
        componentId: component.id,
        parentProductId: component.parentProductId,
        sourceType: component.sourceType,
        sourceId: component.sourceId,
      },
    );
  }

  if (component.sourceId.trim().toLowerCase() !== material.id.trim().toLowerCase()) {
    throw new ProductComponentError(
      'SOURCE_ID_MISMATCH',
      `Component ${component.id} references ${component.sourceId}, not material ${material.id}.`,
      {
        componentId: component.id,
        parentProductId: component.parentProductId,
        sourceType: component.sourceType,
        sourceId: component.sourceId,
      },
    );
  }

  if (material.baseUnit !== 'pc') {
    throw new ProductComponentError(
      'NON_COUNT_MATERIAL_SOURCE',
      `Material ${material.name} cannot be a discrete product component because its base unit is ${material.baseUnit}, not pc.`,
      {
        componentId: component.id,
        parentProductId: component.parentProductId,
        sourceType: component.sourceType,
        sourceId: material.id,
        input: material.baseUnit,
      },
    );
  }
}
