import type { InputUnit } from './units';
import { isSupportedUnit } from './units';

export interface YieldSampleMaterialInput {
  materialId: string;
  quantity: number;
  unit: InputUnit;
}

/**
 * Source evidence from one real production/sample batch.
 *
 * Quantities and units are preserved exactly as measured. Canonical material
 * quantities, per-good-piece requirements, defect rate, cost, and capacity are
 * derived later and are intentionally not persisted on this contract.
 */
export interface YieldSample {
  id: string;
  productId: string;
  mixPresetId?: string;
  materialInputs: YieldSampleMaterialInput[];
  goodPieces: number;
  rejectedPieces: number;
  recordedAt: string;
  notes?: string;
}

export type YieldSampleContractErrorCode =
  | 'INVALID_ID'
  | 'INVALID_PRODUCT_ID'
  | 'INVALID_MIX_PRESET_ID'
  | 'EMPTY_MATERIAL_INPUTS'
  | 'INVALID_MATERIAL_ID'
  | 'INVALID_QUANTITY'
  | 'INVALID_UNIT'
  | 'DUPLICATE_MATERIAL'
  | 'INVALID_GOOD_PIECES'
  | 'INVALID_REJECTED_PIECES'
  | 'INVALID_RECORDED_AT';

export class YieldSampleContractError extends Error {
  readonly code: YieldSampleContractErrorCode;
  readonly input?: unknown;

  constructor(code: YieldSampleContractErrorCode, message: string, input?: unknown) {
    super(message);
    this.name = 'YieldSampleContractError';
    this.code = code;
    this.input = input;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

export function cloneYieldSample(sample: YieldSample): YieldSample {
  return {
    ...sample,
    materialInputs: sample.materialInputs.map((input) => ({ ...input })),
  };
}

export function normalizeYieldSampleEvidence(sample: YieldSample): YieldSample {
  return {
    ...sample,
    id: sample.id.trim(),
    productId: sample.productId.trim(),
    mixPresetId: sample.mixPresetId?.trim() || undefined,
    materialInputs: sample.materialInputs.map((input) => ({
      ...input,
      materialId: input.materialId.trim(),
    })),
    recordedAt: sample.recordedAt.trim(),
    notes: sample.notes?.trim() || undefined,
  };
}

export function validateYieldSampleContract(sample: YieldSample): void {
  if (!sample.id.trim()) {
    throw new YieldSampleContractError('INVALID_ID', 'Yield sample ID is required.', sample.id);
  }

  if (!sample.productId.trim()) {
    throw new YieldSampleContractError(
      'INVALID_PRODUCT_ID',
      'Yield sample product ID is required.',
      sample.productId,
    );
  }

  if (sample.mixPresetId !== undefined && !sample.mixPresetId.trim()) {
    throw new YieldSampleContractError(
      'INVALID_MIX_PRESET_ID',
      'Yield sample mix preset ID cannot be blank when supplied.',
      sample.mixPresetId,
    );
  }

  if (!Array.isArray(sample.materialInputs) || sample.materialInputs.length === 0) {
    throw new YieldSampleContractError(
      'EMPTY_MATERIAL_INPUTS',
      'A yield sample must record at least one material input.',
      sample.materialInputs,
    );
  }

  const seenMaterials = new Set<string>();
  for (const input of sample.materialInputs) {
    if (!input.materialId.trim()) {
      throw new YieldSampleContractError(
        'INVALID_MATERIAL_ID',
        'Every yield sample material input requires a material ID.',
        input.materialId,
      );
    }

    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new YieldSampleContractError(
        'INVALID_QUANTITY',
        `Yield sample quantity must be a positive finite number for ${input.materialId}.`,
        input.quantity,
      );
    }

    if (!isSupportedUnit(input.unit)) {
      throw new YieldSampleContractError(
        'INVALID_UNIT',
        `Unsupported yield sample unit for ${input.materialId}: ${String(input.unit)}.`,
        input.unit,
      );
    }

    const materialKey = comparable(input.materialId);
    if (seenMaterials.has(materialKey)) {
      throw new YieldSampleContractError(
        'DUPLICATE_MATERIAL',
        `Yield sample contains the material more than once: ${input.materialId}.`,
        input.materialId,
      );
    }
    seenMaterials.add(materialKey);
  }

  if (!Number.isInteger(sample.goodPieces) || sample.goodPieces <= 0) {
    throw new YieldSampleContractError(
      'INVALID_GOOD_PIECES',
      'Good pieces must be a positive integer for a usable yield sample.',
      sample.goodPieces,
    );
  }

  if (!Number.isInteger(sample.rejectedPieces) || sample.rejectedPieces < 0) {
    throw new YieldSampleContractError(
      'INVALID_REJECTED_PIECES',
      'Rejected pieces must be a non-negative integer.',
      sample.rejectedPieces,
    );
  }

  if (!sample.recordedAt.trim() || !Number.isFinite(Date.parse(sample.recordedAt))) {
    throw new YieldSampleContractError(
      'INVALID_RECORDED_AT',
      'Yield sample recordedAt must be a valid date/time value.',
      sample.recordedAt,
    );
  }
}
