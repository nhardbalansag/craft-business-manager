import { describe, expect, it } from 'vitest';
import type { Material } from './materials';
import type { Mold } from './molds';
import type { PlasterMoldYieldProfile } from './plasterMoldYieldProfiles';
import { validatePlasterMoldYieldProfileReferences } from './plasterMoldYieldProfileValidation';

function material(
  id: string,
  overrides: Partial<Material> = {},
): Material {
  return {
    id,
    name: id,
    group: 'other',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'g',
    packageCost: 1,
    onHandQuantity: 1,
    onHandUnit: 'g',
    isActive: true,
    ...overrides,
  };
}

function mold(id: string, overrides: Partial<Mold> = {}): Mold {
  return {
    id,
    productId: 'PROD-001',
    name: id,
    isActive: true,
    ...overrides,
  };
}

function profile(
  overrides: Partial<PlasterMoldYieldProfile> = {},
): PlasterMoldYieldProfile {
  return {
    id: 'PMYP-0001',
    moldId: 'MOLD-001',
    waterMaterialId: 'MAT-WATER',
    plasterMaterialId: 'MAT-PLASTER',
    glueMaterialId: 'MAT-GLUE',
    waterFillWeightGrams: 50,
    waterAdjustmentRate: 0.3,
    plasterFactor: 0.75,
    glueFactor: 0.05,
    piecesPerPour: 1,
    isActive: true,
    ...overrides,
  };
}

function validContext(overrides: {
  profiles?: PlasterMoldYieldProfile[];
  molds?: Mold[];
  materials?: Material[];
} = {}) {
  return {
    profiles: overrides.profiles ?? [profile()],
    molds: overrides.molds ?? [mold('MOLD-001')],
    materials:
      overrides.materials ?? [
        material('MAT-WATER', { group: 'liquid' }),
        material('MAT-PLASTER', { group: 'plaster' }),
        material('MAT-GLUE'),
      ],
  };
}

describe('PlasterMoldYieldProfile referential validation', () => {
  it('accepts an active profile with existing active weight-based references', () => {
    expect(validatePlasterMoldYieldProfileReferences(validContext())).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('matches Mold and Material identities trim-aware and case-insensitively', () => {
    const result = validatePlasterMoldYieldProfileReferences(
      validContext({
        profiles: [
          profile({
            moldId: ' mold-001 ',
            waterMaterialId: ' mat-water ',
            plasterMaterialId: ' MAT-PLASTER ',
            glueMaterialId: 'mat-glue',
          }),
        ],
      }),
    );

    expect(result.valid).toBe(true);
  });

  it('reports missing Mold and Material references independently', () => {
    const result = validatePlasterMoldYieldProfileReferences({
      profiles: [profile()],
      molds: [],
      materials: [],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'MISSING_MOLD_REFERENCE',
      'MISSING_WATER_MATERIAL_REFERENCE',
      'MISSING_PLASTER_MATERIAL_REFERENCE',
      'MISSING_GLUE_MATERIAL_REFERENCE',
    ]);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'plasterMoldYieldProfiles[0].moldId',
      'plasterMoldYieldProfiles[0].waterMaterialId',
      'plasterMoldYieldProfiles[0].plasterMaterialId',
      'plasterMoldYieldProfiles[0].glueMaterialId',
    ]);
  });

  it('requires distinct Water, Plaster, and Glue Material roles', () => {
    const result = validatePlasterMoldYieldProfileReferences(
      validContext({
        profiles: [
          profile({
            waterMaterialId: 'MAT-SAME',
            plasterMaterialId: ' mat-same ',
            glueMaterialId: 'MAT-SAME',
          }),
        ],
        materials: [material('MAT-SAME')],
      }),
    );

    expect(result.issues.filter((issue) => issue.code === 'DUPLICATE_MATERIAL_ROLE')).toEqual([
      expect.objectContaining({ field: 'plasterMaterialId' }),
      expect.objectContaining({ field: 'glueMaterialId' }),
    ]);
  });

  it('requires all formula Materials to use weight-compatible g base units', () => {
    const result = validatePlasterMoldYieldProfileReferences(
      validContext({
        materials: [
          material('MAT-WATER', { baseUnit: 'mL', purchaseUnit: 'mL', onHandUnit: 'mL' }),
          material('MAT-PLASTER'),
          material('MAT-GLUE', { baseUnit: 'pc', purchaseUnit: 'pc', onHandUnit: 'pc' }),
        ],
      }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'WATER_MATERIAL_NOT_WEIGHT_COMPATIBLE',
      'GLUE_MATERIAL_NOT_WEIGHT_COMPATIBLE',
    ]);
  });

  it('does not infer formula eligibility from Material group labels', () => {
    const result = validatePlasterMoldYieldProfileReferences(
      validContext({
        materials: [
          material('MAT-WATER', { group: 'other' }),
          material('MAT-PLASTER', { group: 'liquid' }),
          material('MAT-GLUE', { group: 'packaging' }),
        ],
      }),
    );

    expect(result.valid).toBe(true);
  });

  it('rejects archived Mold or Material references for an active profile', () => {
    const result = validatePlasterMoldYieldProfileReferences(
      validContext({
        molds: [mold('MOLD-001', { isActive: false })],
        materials: [
          material('MAT-WATER', { isActive: false }),
          material('MAT-PLASTER', { isActive: false }),
          material('MAT-GLUE', { isActive: false }),
        ],
      }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'MOLD_INACTIVE',
      'WATER_MATERIAL_INACTIVE',
      'PLASTER_MATERIAL_INACTIVE',
      'GLUE_MATERIAL_INACTIVE',
    ]);
  });

  it('allows an archived profile to retain archived references as historical source configuration', () => {
    const result = validatePlasterMoldYieldProfileReferences(
      validContext({
        profiles: [profile({ isActive: false })],
        molds: [mold('MOLD-001', { isActive: false })],
        materials: [
          material('MAT-WATER', { isActive: false }),
          material('MAT-PLASTER', { isActive: false }),
          material('MAT-GLUE', { isActive: false }),
        ],
      }),
    );

    expect(result.valid).toBe(true);
  });

  it('enforces one active profile per Mold', () => {
    const result = validatePlasterMoldYieldProfileReferences(
      validContext({
        profiles: [
          profile({ id: 'PMYP-0001' }),
          profile({ id: 'PMYP-0002', moldId: ' mold-001 ' }),
        ],
      }),
    );

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MULTIPLE_ACTIVE_PROFILES_FOR_MOLD',
        profileIndex: 1,
        profileId: 'PMYP-0002',
        field: 'moldId',
      }),
    ]);
  });

  it('allows one active profile plus archived profiles for the same Mold', () => {
    const result = validatePlasterMoldYieldProfileReferences(
      validContext({
        profiles: [
          profile({ id: 'PMYP-ACTIVE' }),
          profile({ id: 'PMYP-OLD-1', isActive: false }),
          profile({ id: 'PMYP-OLD-2', isActive: false }),
        ],
      }),
    );

    expect(result.valid).toBe(true);
  });

  it('allows active profiles for different Molds', () => {
    const result = validatePlasterMoldYieldProfileReferences(
      validContext({
        profiles: [
          profile({ id: 'PMYP-0001', moldId: 'MOLD-001' }),
          profile({ id: 'PMYP-0002', moldId: 'MOLD-002' }),
        ],
        molds: [mold('MOLD-001'), mold('MOLD-002')],
      }),
    );

    expect(result.valid).toBe(true);
  });

  it('does not mutate profile, Mold, or Material source collections', () => {
    const context = validContext();
    const snapshot = structuredClone(context);

    validatePlasterMoldYieldProfileReferences(context);

    expect(context).toEqual(snapshot);
  });
});
