import type { BaseUnit } from '../../domain/units';
import type { Material } from '../../domain/materials';
import type { Mold } from '../../domain/molds';
import {
  calculatePlasterMoldFormula,
  type PlasterMoldFormulaResult,
} from '../../domain/plasterMoldFormula';
import {
  clonePlasterMoldYieldProfile,
  validatePlasterMoldYieldProfileContract,
  type PlasterMoldYieldProfile,
} from '../../domain/plasterMoldYieldProfiles';
import { validatePlasterMoldYieldProfileReferences } from '../../domain/plasterMoldYieldProfileValidation';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { MoldRepository } from '../molds/MoldRepository';

export interface PlasterMoldYieldCalculatorProfileProvider {
  getActiveProfileForMold(moldId: string): Promise<PlasterMoldYieldProfile | null>;
}

export type PlasterMoldFormulaMaterialRole = 'water' | 'plaster' | 'glue';

export interface PlasterMoldFormulaMaterialIdentity {
  role: PlasterMoldFormulaMaterialRole;
  materialId: string;
  materialName: string;
  baseUnit: BaseUnit;
}

export interface PlasterMoldYieldCalculatorResult {
  estimateKind: 'theoretical';
  mold: {
    id: string;
    productId: string;
    name: string;
    isActive: true;
  };
  profile: PlasterMoldYieldProfile;
  materials: {
    water: PlasterMoldFormulaMaterialIdentity;
    plaster: PlasterMoldFormulaMaterialIdentity;
    glue: PlasterMoldFormulaMaterialIdentity;
  };
  formula: PlasterMoldFormulaResult;
  productSafetyWasteApplied: false;
  yieldEvidenceCreated: false;
}

export type PlasterMoldYieldCalculatorErrorCode =
  | 'MOLD_NOT_FOUND'
  | 'MOLD_INACTIVE'
  | 'ACTIVE_PROFILE_NOT_FOUND'
  | 'PROFILE_MOLD_MISMATCH'
  | 'PROFILE_SOURCE_INVALID';

export class PlasterMoldYieldCalculatorError extends Error {
  readonly code: PlasterMoldYieldCalculatorErrorCode;
  readonly moldId: string;
  readonly profileId?: string;
  readonly underlyingCode?: string;

  constructor(
    code: PlasterMoldYieldCalculatorErrorCode,
    message: string,
    context: {
      moldId: string;
      profileId?: string;
      underlyingCode?: string;
    },
  ) {
    super(message);
    this.name = 'PlasterMoldYieldCalculatorError';
    this.code = code;
    this.moldId = context.moldId;
    this.profileId = context.profileId;
    this.underlyingCode = context.underlyingCode;
  }
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function materialIdentity(
  role: PlasterMoldFormulaMaterialRole,
  material: Material,
): PlasterMoldFormulaMaterialIdentity {
  return {
    role,
    materialId: material.id,
    materialName: material.name,
    baseUnit: material.baseUnit,
  };
}

function sourceValidationCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

/**
 * MY4 application engine for theoretical plaster-mold recipe estimates.
 *
 * Availability is controlled only by an active PlasterMoldYieldProfile for the Mold.
 * Product category is intentionally not consulted. The engine does not apply Product
 * safety waste, inspect inventory/costing, or create Yield Sample evidence.
 */
export class PlasterMoldYieldCalculatorService {
  constructor(
    private readonly molds: MoldRepository,
    private readonly materials: MaterialRepository,
    private readonly profiles: PlasterMoldYieldCalculatorProfileProvider,
  ) {}

  async calculateForMold(
    moldId: string,
    requestedQuantity?: number,
  ): Promise<PlasterMoldYieldCalculatorResult> {
    const requestedMoldId = moldId.trim();
    const mold = await this.molds.findById(requestedMoldId);

    if (!mold) {
      throw new PlasterMoldYieldCalculatorError(
        'MOLD_NOT_FOUND',
        `Mold ${requestedMoldId} was not found for plaster formula calculation.`,
        { moldId: requestedMoldId },
      );
    }

    if (!mold.isActive) {
      throw new PlasterMoldYieldCalculatorError(
        'MOLD_INACTIVE',
        `Mold ${mold.id} is archived and cannot be used for an active plaster formula estimate.`,
        { moldId: mold.id },
      );
    }

    const profile = await this.profiles.getActiveProfileForMold(mold.id);
    if (!profile) {
      throw new PlasterMoldYieldCalculatorError(
        'ACTIVE_PROFILE_NOT_FOUND',
        `Mold ${mold.id} has no active PlasterMoldYieldProfile.`,
        { moldId: mold.id },
      );
    }

    if (comparable(profile.moldId) !== comparable(mold.id)) {
      throw new PlasterMoldYieldCalculatorError(
        'PROFILE_MOLD_MISMATCH',
        `Active plaster mold yield profile ${profile.id} belongs to Mold ${profile.moldId}, not Mold ${mold.id}.`,
        { moldId: mold.id, profileId: profile.id },
      );
    }

    if (!profile.isActive) {
      throw new PlasterMoldYieldCalculatorError(
        'PROFILE_SOURCE_INVALID',
        `Plaster mold yield profile ${profile.id} was resolved as active but is archived.`,
        {
          moldId: mold.id,
          profileId: profile.id,
          underlyingCode: 'PROFILE_INACTIVE',
        },
      );
    }

    try {
      validatePlasterMoldYieldProfileContract(profile);
    } catch (error) {
      throw new PlasterMoldYieldCalculatorError(
        'PROFILE_SOURCE_INVALID',
        error instanceof Error
          ? error.message
          : `Plaster mold yield profile ${profile.id} is invalid.`,
        {
          moldId: mold.id,
          profileId: profile.id,
          underlyingCode: sourceValidationCode(error),
        },
      );
    }

    const allMaterials = await this.materials.list();
    const referenceValidation = validatePlasterMoldYieldProfileReferences({
      profiles: [profile],
      molds: [mold],
      materials: allMaterials,
    });

    if (!referenceValidation.valid) {
      const issue = referenceValidation.issues[0];
      throw new PlasterMoldYieldCalculatorError(
        'PROFILE_SOURCE_INVALID',
        issue?.message ??
          `Plaster mold yield profile ${profile.id} has invalid source references.`,
        {
          moldId: mold.id,
          profileId: profile.id,
          underlyingCode: issue?.code,
        },
      );
    }

    const materialById = new Map(
      allMaterials.map((material) => [comparable(material.id), material]),
    );

    const water = materialById.get(comparable(profile.waterMaterialId))!;
    const plaster = materialById.get(comparable(profile.plasterMaterialId))!;
    const glue = materialById.get(comparable(profile.glueMaterialId))!;

    const formula = calculatePlasterMoldFormula({
      waterFillWeightGrams: profile.waterFillWeightGrams,
      waterAdjustmentRate: profile.waterAdjustmentRate,
      plasterFactor: profile.plasterFactor,
      glueFactor: profile.glueFactor,
      piecesPerPour: profile.piecesPerPour,
      ...(requestedQuantity === undefined ? {} : { requestedQuantity }),
    });

    return {
      estimateKind: 'theoretical',
      mold: {
        id: mold.id,
        productId: mold.productId,
        name: mold.name,
        isActive: true,
      },
      profile: clonePlasterMoldYieldProfile(profile),
      materials: {
        water: materialIdentity('water', water),
        plaster: materialIdentity('plaster', plaster),
        glue: materialIdentity('glue', glue),
      },
      formula: structuredClone(formula),
      productSafetyWasteApplied: false,
      yieldEvidenceCreated: false,
    };
  }
}
