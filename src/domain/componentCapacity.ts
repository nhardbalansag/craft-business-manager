export interface ComponentCapacityInput {
  availableQuantity: number;
  quantityPerParent: number;
}

export interface ComponentCapacityMathResult extends ComponentCapacityInput {
  capacityPieces: number;
}

export type ComponentCapacityErrorCode =
  | 'INVALID_AVAILABLE_QUANTITY'
  | 'INVALID_QUANTITY_PER_PARENT'
  | 'DERIVED_CAPACITY_INVALID';

export class ComponentCapacityError extends Error {
  readonly code: ComponentCapacityErrorCode;
  readonly input: unknown;

  constructor(code: ComponentCapacityErrorCode, message: string, input: unknown) {
    super(message);
    this.name = 'ComponentCapacityError';
    this.code = code;
    this.input = input;
  }
}

/**
 * Derives how many parent Products can currently be assembled from one discrete
 * component source.
 *
 * Formula:
 *   floor(available component pc / required component pc per parent)
 */
export function deriveComponentCapacity(
  input: ComponentCapacityInput,
): ComponentCapacityMathResult {
  if (!Number.isFinite(input.availableQuantity) || input.availableQuantity < 0) {
    throw new ComponentCapacityError(
      'INVALID_AVAILABLE_QUANTITY',
      'Available component quantity must be finite and non-negative.',
      input.availableQuantity,
    );
  }

  if (
    !Number.isFinite(input.quantityPerParent) ||
    !Number.isInteger(input.quantityPerParent) ||
    input.quantityPerParent <= 0
  ) {
    throw new ComponentCapacityError(
      'INVALID_QUANTITY_PER_PARENT',
      'Component quantity per parent must be a finite positive integer.',
      input.quantityPerParent,
    );
  }

  const capacityPieces = Math.floor(input.availableQuantity / input.quantityPerParent);

  if (!Number.isFinite(capacityPieces) || capacityPieces < 0 || !Number.isInteger(capacityPieces)) {
    throw new ComponentCapacityError(
      'DERIVED_CAPACITY_INVALID',
      'Derived component capacity must be a finite non-negative integer.',
      capacityPieces,
    );
  }

  return {
    availableQuantity: input.availableQuantity,
    quantityPerParent: input.quantityPerParent,
    capacityPieces,
  };
}
