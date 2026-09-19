import type { ProductCategory } from './products';
import { isProductCategory } from './products';
import type { Unit } from './units';
import { getUnitDimension, isSupportedUnit } from './units';

export const MIX_RATIO_BASES = ['weight', 'volume'] as const;
export type RatioBasis = (typeof MIX_RATIO_BASES)[number];

export const MIX_PRESET_LINE_ROLES = ['primary', 'secondary', 'additive'] as const;
export type MixPresetLineRole = (typeof MIX_PRESET_LINE_ROLES)[number];

export interface MixPresetLine {
  materialId: string;
  role: MixPresetLineRole;
  /** Relative ratio parts; never an absolute recipe quantity. */
  parts: number;
}

export interface MixPreset {
  id: string;
  name: string;
  compatibleCategories: ProductCategory[];
  basis: RatioBasis;
  lines: MixPresetLine[];
  notes?: string;
  isActive: boolean;
}

export interface MixRatioAnchor {
  materialId: string;
  quantity: number;
  unit: Unit;
}

export interface ResolvedMixLine extends MixPresetLine {
  quantity: number;
  unit: Unit;
  isAnchor: boolean;
}

export interface ResolvedMixRatio {
  presetId: string;
  basis: RatioBasis;
  anchorMaterialId: string;
  anchorQuantity: number;
  unit: Unit;
  /** Anchor quantity divided by the anchor line's ratio parts. */
  quantityPerPart: number;
  lines: ResolvedMixLine[];
}

const MIX_RATIO_BASIS_SET: ReadonlySet<string> = new Set(MIX_RATIO_BASES);
const MIX_PRESET_LINE_ROLE_SET: ReadonlySet<string> = new Set(MIX_PRESET_LINE_ROLES);

export type MixPresetErrorCode =
  | 'INVALID_ID'
  | 'INVALID_NAME'
  | 'INVALID_COMPATIBLE_CATEGORIES'
  | 'INVALID_BASIS'
  | 'EMPTY_LINES'
  | 'INVALID_MATERIAL_ID'
  | 'INVALID_ROLE'
  | 'INVALID_PARTS'
  | 'DUPLICATE_MATERIAL'
  | 'INVALID_PRIMARY_COUNT'
  | 'INVALID_ACTIVE_STATE'
  | 'INVALID_ANCHOR_MATERIAL'
  | 'INVALID_ANCHOR_QUANTITY'
  | 'INVALID_ANCHOR_UNIT'
  | 'ANCHOR_UNIT_BASIS_MISMATCH';

export class MixPresetError extends Error {
  readonly code: MixPresetErrorCode;
  readonly input?: unknown;

  constructor(code: MixPresetErrorCode, message: string, input?: unknown) {
    super(message);
    this.name = 'MixPresetError';
    this.code = code;
    this.input = input;
  }
}

export function isRatioBasis(value: unknown): value is RatioBasis {
  return typeof value === 'string' && MIX_RATIO_BASIS_SET.has(value);
}

export function isMixPresetLineRole(value: unknown): value is MixPresetLineRole {
  return typeof value === 'string' && MIX_PRESET_LINE_ROLE_SET.has(value);
}

export function cloneMixPreset(preset: MixPreset): MixPreset {
  return {
    ...preset,
    compatibleCategories: [...preset.compatibleCategories],
    lines: preset.lines.map((line) => ({ ...line })),
  };
}

export function isMixPresetCompatibleWithCategory(
  preset: MixPreset,
  category: ProductCategory,
): boolean {
  return preset.compatibleCategories.includes(category);
}

/**
 * Validates the authoritative Phase 2.1B mix-preset source contract.
 * Referenced material existence/activity is intentionally owned by application services in 2.1C.
 */
export function validateMixPresetContract(preset: MixPreset): void {
  if (!preset.id.trim()) {
    throw new MixPresetError('INVALID_ID', 'Mix preset ID is required.', preset.id);
  }

  if (!preset.name.trim()) {
    throw new MixPresetError('INVALID_NAME', 'Mix preset name is required.', preset.name);
  }

  if (!Array.isArray(preset.compatibleCategories) || preset.compatibleCategories.length === 0) {
    throw new MixPresetError(
      'INVALID_COMPATIBLE_CATEGORIES',
      'At least one compatible product category is required.',
      preset.compatibleCategories,
    );
  }

  const seenCategories = new Set<string>();
  for (const category of preset.compatibleCategories) {
    if (!isProductCategory(category) || seenCategories.has(category)) {
      throw new MixPresetError(
        'INVALID_COMPATIBLE_CATEGORIES',
        `Invalid or duplicate compatible product category: ${String(category)}.`,
        category,
      );
    }
    seenCategories.add(category);
  }

  if (!isRatioBasis(preset.basis)) {
    throw new MixPresetError('INVALID_BASIS', `Unsupported ratio basis: ${String(preset.basis)}.`, preset.basis);
  }

  if (!Array.isArray(preset.lines) || preset.lines.length === 0) {
    throw new MixPresetError('EMPTY_LINES', 'A mix preset requires at least one material line.', preset.lines);
  }

  const seenMaterials = new Set<string>();
  let primaryCount = 0;

  for (const line of preset.lines) {
    const materialId = line.materialId.trim();
    if (!materialId) {
      throw new MixPresetError('INVALID_MATERIAL_ID', 'Mix preset material ID is required.', line.materialId);
    }

    const materialKey = materialId.toLowerCase();
    if (seenMaterials.has(materialKey)) {
      throw new MixPresetError(
        'DUPLICATE_MATERIAL',
        `Material ${line.materialId} appears more than once in the mix preset.`,
        line.materialId,
      );
    }
    seenMaterials.add(materialKey);

    if (!isMixPresetLineRole(line.role)) {
      throw new MixPresetError('INVALID_ROLE', `Unsupported mix line role: ${String(line.role)}.`, line.role);
    }

    if (line.role === 'primary') {
      primaryCount += 1;
    }

    if (!Number.isFinite(line.parts) || line.parts <= 0) {
      throw new MixPresetError(
        'INVALID_PARTS',
        'Mix line parts must be a finite number greater than zero.',
        line.parts,
      );
    }
  }

  if (primaryCount !== 1) {
    throw new MixPresetError(
      'INVALID_PRIMARY_COUNT',
      `A mix preset must contain exactly one primary line. Received: ${primaryCount}.`,
      primaryCount,
    );
  }

  if (typeof preset.isActive !== 'boolean') {
    throw new MixPresetError('INVALID_ACTIVE_STATE', 'Mix preset active state must be a boolean.', preset.isActive);
  }
}

export function resolveMixRatio(preset: MixPreset, anchor: MixRatioAnchor): ResolvedMixRatio {
  validateMixPresetContract(preset);

  const anchorMaterialKey = anchor.materialId.trim().toLowerCase();
  const anchorLine = preset.lines.find(
    (line) => line.materialId.trim().toLowerCase() === anchorMaterialKey,
  );

  if (!anchorLine) {
    throw new MixPresetError(
      'INVALID_ANCHOR_MATERIAL',
      `Anchor material ${anchor.materialId} is not part of mix preset ${preset.id}.`,
      anchor.materialId,
    );
  }

  if (!Number.isFinite(anchor.quantity) || anchor.quantity <= 0) {
    throw new MixPresetError(
      'INVALID_ANCHOR_QUANTITY',
      'Anchor quantity must be a finite number greater than zero.',
      anchor.quantity,
    );
  }

  if (!isSupportedUnit(anchor.unit)) {
    throw new MixPresetError('INVALID_ANCHOR_UNIT', `Unsupported anchor unit: ${String(anchor.unit)}.`, anchor.unit);
  }

  const unitDimension = getUnitDimension(anchor.unit);
  if (unitDimension !== preset.basis) {
    throw new MixPresetError(
      'ANCHOR_UNIT_BASIS_MISMATCH',
      `Anchor unit ${anchor.unit} has ${unitDimension} dimension but preset ${preset.id} uses ${preset.basis} ratios.`,
      anchor.unit,
    );
  }

  const quantityPerPart = anchor.quantity / anchorLine.parts;

  return {
    presetId: preset.id,
    basis: preset.basis,
    anchorMaterialId: anchorLine.materialId,
    anchorQuantity: anchor.quantity,
    unit: anchor.unit,
    quantityPerPart,
    lines: preset.lines.map((line) => ({
      ...line,
      quantity: line.parts * quantityPerPart,
      unit: anchor.unit,
      isAnchor: line === anchorLine,
    })),
  };
}
