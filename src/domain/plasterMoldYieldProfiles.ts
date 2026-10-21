/**
 * Authoritative plaster-mold formula configuration for one physical Mold.
 *
 * This source record stores only user-entered/configured evidence. Adjusted water,
 * plaster quantity, glue quantity, total mixture, per-piece values, and requested-
 * quantity estimates are always derived and must not be persisted here.
 */
export interface PlasterMoldYieldProfile {
  id: string;
  moldId: string;
  waterMaterialId: string;
  plasterMaterialId: string;
  glueMaterialId: string;
  waterFillWeightGrams: number;
  waterAdjustmentRate: number;
  plasterFactor: number;
  glueFactor: number;
  piecesPerPour: number;
  notes?: string;
  isActive: boolean;
}

export type PlasterMoldYieldProfileErrorCode =
  | 'INVALID_ID'
  | 'INVALID_MOLD_ID'
  | 'INVALID_WATER_MATERIAL_ID'
  | 'INVALID_PLASTER_MATERIAL_ID'
  | 'INVALID_GLUE_MATERIAL_ID'
  | 'NON_FINITE_WATER_FILL_WEIGHT'
  | 'NON_POSITIVE_WATER_FILL_WEIGHT'
  | 'NON_FINITE_WATER_ADJUSTMENT_RATE'
  | 'NEGATIVE_WATER_ADJUSTMENT_RATE'
  | 'WATER_ADJUSTMENT_RATE_NOT_BELOW_ONE'
  | 'NON_FINITE_PLASTER_FACTOR'
  | 'NEGATIVE_PLASTER_FACTOR'
  | 'NON_FINITE_GLUE_FACTOR'
  | 'NEGATIVE_GLUE_FACTOR'
  | 'NON_FINITE_PIECES_PER_POUR'
  | 'NON_INTEGER_PIECES_PER_POUR'
  | 'NON_POSITIVE_PIECES_PER_POUR'
  | 'INVALID_ACTIVE_STATE';

export class PlasterMoldYieldProfileError extends Error {
  readonly code: PlasterMoldYieldProfileErrorCode;
  readonly profileId?: string;
  readonly moldId?: string;
  readonly input?: unknown;

  constructor(
    code: PlasterMoldYieldProfileErrorCode,
    message: string,
    context: {
      profileId?: string;
      moldId?: string;
      input?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'PlasterMoldYieldProfileError';
    this.code = code;
    this.profileId = context.profileId;
    this.moldId = context.moldId;
    this.input = context.input;
  }
}

export function clonePlasterMoldYieldProfile(
  profile: PlasterMoldYieldProfile,
): PlasterMoldYieldProfile {
  return { ...profile };
}

/**
 * Normalizes textual source fields without changing configured numeric evidence.
 */
export function normalizePlasterMoldYieldProfile(
  profile: PlasterMoldYieldProfile,
): PlasterMoldYieldProfile {
  const notes = profile.notes?.trim();

  return {
    ...profile,
    id: profile.id.trim(),
    moldId: profile.moldId.trim(),
    waterMaterialId: profile.waterMaterialId.trim(),
    plasterMaterialId: profile.plasterMaterialId.trim(),
    glueMaterialId: profile.glueMaterialId.trim(),
    notes: notes ? notes : undefined,
  };
}

/**
 * Validates intrinsic PlasterMoldYieldProfile source fields only.
 *
 * Mold/Material existence, active-state policy, material role distinctness,
 * weight compatibility, and one-active-profile-per-Mold validation are deliberately
 * deferred to MY1C.
 */
export function validatePlasterMoldYieldProfileContract(
  profile: PlasterMoldYieldProfile,
): void {
  const context = {
    profileId: profile.id,
    moldId: profile.moldId,
  };

  if (!profile.id.trim()) {
    throw new PlasterMoldYieldProfileError(
      'INVALID_ID',
      'Plaster mold yield profile ID is required.',
      { ...context, input: profile.id },
    );
  }

  if (!profile.moldId.trim()) {
    throw new PlasterMoldYieldProfileError(
      'INVALID_MOLD_ID',
      'Plaster mold yield profile Mold ID is required.',
      { ...context, input: profile.moldId },
    );
  }

  if (!profile.waterMaterialId.trim()) {
    throw new PlasterMoldYieldProfileError(
      'INVALID_WATER_MATERIAL_ID',
      'Water Material ID is required.',
      { ...context, input: profile.waterMaterialId },
    );
  }

  if (!profile.plasterMaterialId.trim()) {
    throw new PlasterMoldYieldProfileError(
      'INVALID_PLASTER_MATERIAL_ID',
      'Plaster Material ID is required.',
      { ...context, input: profile.plasterMaterialId },
    );
  }

  if (!profile.glueMaterialId.trim()) {
    throw new PlasterMoldYieldProfileError(
      'INVALID_GLUE_MATERIAL_ID',
      'Glue Material ID is required.',
      { ...context, input: profile.glueMaterialId },
    );
  }

  if (!Number.isFinite(profile.waterFillWeightGrams)) {
    throw new PlasterMoldYieldProfileError(
      'NON_FINITE_WATER_FILL_WEIGHT',
      'Mold water fill weight must be finite.',
      { ...context, input: profile.waterFillWeightGrams },
    );
  }

  if (profile.waterFillWeightGrams <= 0) {
    throw new PlasterMoldYieldProfileError(
      'NON_POSITIVE_WATER_FILL_WEIGHT',
      'Mold water fill weight must be greater than zero.',
      { ...context, input: profile.waterFillWeightGrams },
    );
  }

  if (!Number.isFinite(profile.waterAdjustmentRate)) {
    throw new PlasterMoldYieldProfileError(
      'NON_FINITE_WATER_ADJUSTMENT_RATE',
      'Water adjustment rate must be finite.',
      { ...context, input: profile.waterAdjustmentRate },
    );
  }

  if (profile.waterAdjustmentRate < 0) {
    throw new PlasterMoldYieldProfileError(
      'NEGATIVE_WATER_ADJUSTMENT_RATE',
      'Water adjustment rate cannot be negative.',
      { ...context, input: profile.waterAdjustmentRate },
    );
  }

  if (profile.waterAdjustmentRate >= 1) {
    throw new PlasterMoldYieldProfileError(
      'WATER_ADJUSTMENT_RATE_NOT_BELOW_ONE',
      'Water adjustment rate must be less than 1 (100%).',
      { ...context, input: profile.waterAdjustmentRate },
    );
  }

  if (!Number.isFinite(profile.plasterFactor)) {
    throw new PlasterMoldYieldProfileError(
      'NON_FINITE_PLASTER_FACTOR',
      'Plaster factor must be finite.',
      { ...context, input: profile.plasterFactor },
    );
  }

  if (profile.plasterFactor < 0) {
    throw new PlasterMoldYieldProfileError(
      'NEGATIVE_PLASTER_FACTOR',
      'Plaster factor cannot be negative.',
      { ...context, input: profile.plasterFactor },
    );
  }

  if (!Number.isFinite(profile.glueFactor)) {
    throw new PlasterMoldYieldProfileError(
      'NON_FINITE_GLUE_FACTOR',
      'Glue factor must be finite.',
      { ...context, input: profile.glueFactor },
    );
  }

  if (profile.glueFactor < 0) {
    throw new PlasterMoldYieldProfileError(
      'NEGATIVE_GLUE_FACTOR',
      'Glue factor cannot be negative.',
      { ...context, input: profile.glueFactor },
    );
  }

  if (!Number.isFinite(profile.piecesPerPour)) {
    throw new PlasterMoldYieldProfileError(
      'NON_FINITE_PIECES_PER_POUR',
      'Pieces per pour must be finite.',
      { ...context, input: profile.piecesPerPour },
    );
  }

  if (!Number.isInteger(profile.piecesPerPour)) {
    throw new PlasterMoldYieldProfileError(
      'NON_INTEGER_PIECES_PER_POUR',
      'Pieces per pour must be a whole-piece count.',
      { ...context, input: profile.piecesPerPour },
    );
  }

  if (profile.piecesPerPour <= 0) {
    throw new PlasterMoldYieldProfileError(
      'NON_POSITIVE_PIECES_PER_POUR',
      'Pieces per pour must be greater than zero.',
      { ...context, input: profile.piecesPerPour },
    );
  }

  if (typeof profile.isActive !== 'boolean') {
    throw new PlasterMoldYieldProfileError(
      'INVALID_ACTIVE_STATE',
      'Plaster mold yield profile active state must be a boolean.',
      { ...context, input: profile.isActive },
    );
  }
}
