export const PLASTER_MOLD_FORMULA_UNIT = 'g' as const;

export interface PlasterMoldFormulaInput {
  /** Measured water weight required to fill the physical mold. */
  waterFillWeightGrams: number;
  /** Fraction removed from measured mold water weight. Must be >= 0 and < 1. */
  waterAdjustmentRate: number;
  /** Plaster quantity as a factor of adjusted water. */
  plasterFactor: number;
  /** Glue quantity as an additional factor of adjusted water. */
  glueFactor: number;
  /** Number of finished mold cavities filled by one complete pour. */
  piecesPerPour: number;
  /** Optional requested finished-piece quantity used only for estimate planning. */
  requestedQuantity?: number;
}

export interface PlasterMoldFormulaQuantities {
  adjustedWaterGrams: number;
  plasterGrams: number;
  glueGrams: number;
  totalMixtureGrams: number;
}

export interface PlasterMoldRequestedQuantityEstimate {
  requestedQuantity: number;
  requiredPours: number;
  producedCapacityPieces: number;
  extraCapacityPieces: number;
  totals: PlasterMoldFormulaQuantities;
}

export interface PlasterMoldFormulaResult {
  unit: typeof PLASTER_MOLD_FORMULA_UNIT;
  waterFillWeightGrams: number;
  waterAdjustmentRate: number;
  plasterFactor: number;
  glueFactor: number;
  piecesPerPour: number;
  perPour: PlasterMoldFormulaQuantities;
  perPiece: PlasterMoldFormulaQuantities;
  requestedQuantityEstimate?: PlasterMoldRequestedQuantityEstimate;
}

export type PlasterMoldFormulaErrorCode =
  | 'INVALID_WATER_FILL_WEIGHT'
  | 'INVALID_WATER_ADJUSTMENT_RATE'
  | 'INVALID_PLASTER_FACTOR'
  | 'INVALID_GLUE_FACTOR'
  | 'INVALID_PIECES_PER_POUR'
  | 'INVALID_REQUESTED_QUANTITY'
  | 'DERIVED_QUANTITY_INVALID';

export class PlasterMoldFormulaError extends Error {
  readonly code: PlasterMoldFormulaErrorCode;
  readonly input?: unknown;

  constructor(code: PlasterMoldFormulaErrorCode, message: string, input?: unknown) {
    super(message);
    this.name = 'PlasterMoldFormulaError';
    this.code = code;
    this.input = input;
  }
}

export function validatePlasterMoldFormulaInput(input: PlasterMoldFormulaInput): void {
  if (!Number.isFinite(input.waterFillWeightGrams) || input.waterFillWeightGrams <= 0) {
    throw new PlasterMoldFormulaError(
      'INVALID_WATER_FILL_WEIGHT',
      'Mold water fill weight must be a finite number greater than zero.',
      input.waterFillWeightGrams,
    );
  }

  if (
    !Number.isFinite(input.waterAdjustmentRate) ||
    input.waterAdjustmentRate < 0 ||
    input.waterAdjustmentRate >= 1
  ) {
    throw new PlasterMoldFormulaError(
      'INVALID_WATER_ADJUSTMENT_RATE',
      'Water adjustment rate must be finite, non-negative, and less than 1.',
      input.waterAdjustmentRate,
    );
  }

  if (!Number.isFinite(input.plasterFactor) || input.plasterFactor < 0) {
    throw new PlasterMoldFormulaError(
      'INVALID_PLASTER_FACTOR',
      'Plaster factor must be a finite non-negative number.',
      input.plasterFactor,
    );
  }

  if (!Number.isFinite(input.glueFactor) || input.glueFactor < 0) {
    throw new PlasterMoldFormulaError(
      'INVALID_GLUE_FACTOR',
      'Glue factor must be a finite non-negative number.',
      input.glueFactor,
    );
  }

  if (!Number.isInteger(input.piecesPerPour) || input.piecesPerPour <= 0) {
    throw new PlasterMoldFormulaError(
      'INVALID_PIECES_PER_POUR',
      'Pieces per pour must be a positive integer.',
      input.piecesPerPour,
    );
  }

  if (
    input.requestedQuantity !== undefined &&
    (!Number.isInteger(input.requestedQuantity) || input.requestedQuantity <= 0)
  ) {
    throw new PlasterMoldFormulaError(
      'INVALID_REQUESTED_QUANTITY',
      'Requested quantity must be a positive integer when supplied.',
      input.requestedQuantity,
    );
  }
}

function assertDerivedQuantities(
  quantities: PlasterMoldFormulaQuantities,
): PlasterMoldFormulaQuantities {
  for (const [name, value] of Object.entries(quantities)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new PlasterMoldFormulaError(
        'DERIVED_QUANTITY_INVALID',
        `Derived plaster mold formula quantity must be finite and non-negative: ${name}.`,
        value,
      );
    }
  }

  return quantities;
}

/**
 * Pure plaster-mold estimate derived from physical mold water-fill evidence.
 *
 * This calculation is theoretical recipe guidance only. It does not apply Product
 * safety waste and does not create or replace actual Yield Sample evidence.
 */
export function calculatePlasterMoldFormula(
  input: PlasterMoldFormulaInput,
): PlasterMoldFormulaResult {
  validatePlasterMoldFormulaInput(input);

  const adjustedWaterGrams =
    input.waterFillWeightGrams * (1 - input.waterAdjustmentRate);
  const plasterGrams = adjustedWaterGrams * input.plasterFactor;
  const glueGrams = adjustedWaterGrams * input.glueFactor;

  const perPour = assertDerivedQuantities({
    adjustedWaterGrams,
    plasterGrams,
    glueGrams,
    totalMixtureGrams: adjustedWaterGrams + plasterGrams + glueGrams,
  });

  const perPiece = assertDerivedQuantities({
    adjustedWaterGrams: perPour.adjustedWaterGrams / input.piecesPerPour,
    plasterGrams: perPour.plasterGrams / input.piecesPerPour,
    glueGrams: perPour.glueGrams / input.piecesPerPour,
    totalMixtureGrams: perPour.totalMixtureGrams / input.piecesPerPour,
  });

  let requestedQuantityEstimate: PlasterMoldRequestedQuantityEstimate | undefined;

  if (input.requestedQuantity !== undefined) {
    const requiredPours = Math.ceil(input.requestedQuantity / input.piecesPerPour);
    const producedCapacityPieces = requiredPours * input.piecesPerPour;
    const extraCapacityPieces = producedCapacityPieces - input.requestedQuantity;

    const totals = assertDerivedQuantities({
      adjustedWaterGrams: perPour.adjustedWaterGrams * requiredPours,
      plasterGrams: perPour.plasterGrams * requiredPours,
      glueGrams: perPour.glueGrams * requiredPours,
      totalMixtureGrams: perPour.totalMixtureGrams * requiredPours,
    });

    if (
      !Number.isFinite(requiredPours) ||
      !Number.isInteger(requiredPours) ||
      requiredPours <= 0 ||
      !Number.isFinite(producedCapacityPieces) ||
      !Number.isInteger(producedCapacityPieces) ||
      producedCapacityPieces <= 0 ||
      !Number.isFinite(extraCapacityPieces) ||
      !Number.isInteger(extraCapacityPieces) ||
      extraCapacityPieces < 0
    ) {
      throw new PlasterMoldFormulaError(
        'DERIVED_QUANTITY_INVALID',
        'Derived requested-quantity estimate must remain finite and integer-safe.',
        { requiredPours, producedCapacityPieces, extraCapacityPieces },
      );
    }

    requestedQuantityEstimate = {
      requestedQuantity: input.requestedQuantity,
      requiredPours,
      producedCapacityPieces,
      extraCapacityPieces,
      totals,
    };
  }

  return {
    unit: PLASTER_MOLD_FORMULA_UNIT,
    waterFillWeightGrams: input.waterFillWeightGrams,
    waterAdjustmentRate: input.waterAdjustmentRate,
    plasterFactor: input.plasterFactor,
    glueFactor: input.glueFactor,
    piecesPerPour: input.piecesPerPour,
    perPour,
    perPiece,
    ...(requestedQuantityEstimate ? { requestedQuantityEstimate } : {}),
  };
}
