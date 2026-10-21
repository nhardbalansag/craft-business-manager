import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDatasetV2 } from './businessDatasetV2';
import { extendBusinessDatasetV2 } from './physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from './physicalBusinessDatasetV4';
import {
  PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION,
  clonePhysicalBusinessDatasetV5,
  extendPhysicalBusinessDatasetV4,
  toPhysicalBusinessDatasetV4,
  validatePhysicalBusinessDatasetV5Integrity,
} from './physicalBusinessDatasetV5';

function validV4() {
  const core = createEmptyBusinessDatasetV2();

  core.materials = [
    {
      id: 'WATER',
      name: 'Water',
      group: 'liquid',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 10,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'PLASTER',
      name: 'Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 100,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'GLUE',
      name: 'Glue',
      group: 'other',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 50,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
  ];

  core.products = [
    {
      id: 'PROD-001',
      name: 'Paintable Dino',
      category: 'paintable-art',
      safetyWasteRate: 0.05,
      isActive: true,
    },
  ];

  core.yieldSamples = [
    {
      id: 'YLD-001',
      productId: 'PROD-001',
      materialInputs: [
        {
          materialId: 'PLASTER',
          quantity: 100,
          unit: 'g',
        },
      ],
      goodPieces: 4,
      rejectedPieces: 0,
      recordedAt: '2026-09-29T11:00:00.000Z',
    },
  ];

  const v3 = extendBusinessDatasetV2(
    core,
    [],
    [
      {
        id: 'MOLD-001',
        productId: 'PROD-001',
        name: 'Dino Mold',
        isActive: true,
      },
    ],
  );

  return extendPhysicalBusinessDatasetV3(v3, [
    {
      id: 'PMYP-001',
      moldId: 'MOLD-001',
      waterMaterialId: 'WATER',
      plasterMaterialId: 'PLASTER',
      glueMaterialId: 'GLUE',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 4,
      isActive: true,
    },
  ]);
}

function validV5() {
  return extendPhysicalBusinessDatasetV4(validV4(), [
    {
      yieldSampleId: 'YLD-001',
      moldId: 'MOLD-001',
      moldYieldProfileId: 'PMYP-001',
    },
  ]);
}

describe('YRS2C PhysicalBusinessDatasetV5', () => {
  it('extends physical v4 with an empty provenance collection by default', () => {
    const dataset = extendPhysicalBusinessDatasetV4(validV4());

    expect(dataset.schemaVersion).toBe(
      PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION,
    );
    expect(dataset.yieldMoldFormulaSources).toEqual([]);
    expect(dataset.plasterMoldYieldProfiles).toHaveLength(1);
    expect(dataset.molds).toHaveLength(1);
  });

  it('preserves all v4 sources while adding canonical Mold Formula provenance', () => {
    const dataset = validV5();

    expect(
      validatePhysicalBusinessDatasetV5Integrity(dataset),
    ).toEqual({
      valid: true,
      issues: [],
    });

    expect(dataset.yieldMoldFormulaSources).toEqual([
      {
        yieldSampleId: 'YLD-001',
        moldId: 'MOLD-001',
        moldYieldProfileId: 'PMYP-001',
      },
    ]);
    expect(dataset.yieldSamples[0].id).toBe('YLD-001');
  });

  it('downcasts to an exact physical-v4 source shape without provenance', () => {
    const v4 = toPhysicalBusinessDatasetV4(validV5());

    expect(v4.schemaVersion).toBe(4);
    expect(v4).not.toHaveProperty('yieldMoldFormulaSources');
    expect(
      validatePhysicalBusinessDatasetV5Integrity(v4),
    ).toMatchObject({
      valid: false,
    });
  });

  it('deep-clones v5 provenance and inherited nested sources', () => {
    const original = validV5();
    const clone = clonePhysicalBusinessDatasetV5(original);

    clone.yieldMoldFormulaSources[0].moldId = 'MUTATED';
    clone.yieldSamples[0].materialInputs[0].quantity = 999;
    clone.plasterMoldYieldProfiles[0].piecesPerPour = 99;

    expect(original.yieldMoldFormulaSources[0].moldId).toBe(
      'MOLD-001',
    );
    expect(
      original.yieldSamples[0].materialInputs[0].quantity,
    ).toBe(100);
    expect(
      original.plasterMoldYieldProfiles[0].piecesPerPour,
    ).toBe(4);
  });

  it('requires the v5 provenance collection and exact schema version', () => {
    const missing = {
      ...toPhysicalBusinessDatasetV4(validV5()),
      schemaVersion: 5,
    };

    expect(
      validatePhysicalBusinessDatasetV5Integrity(missing),
    ).toEqual({
      valid: false,
      issues: [
        expect.objectContaining({
          code: 'INVALID_DATASET',
          path: '$',
        }),
      ],
    });

    const wrongVersion = {
      ...validV5(),
      schemaVersion: 4,
    };

    expect(
      validatePhysicalBusinessDatasetV5Integrity(wrongVersion),
    ).toEqual({
      valid: false,
      issues: [
        expect.objectContaining({
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          path: 'schemaVersion',
        }),
      ],
    });
  });

  it('retains inherited v4 integrity failures', () => {
    const dataset = validV5();
    dataset.plasterMoldYieldProfiles[0].glueMaterialId =
      'MISSING';

    const result =
      validatePhysicalBusinessDatasetV5Integrity(dataset);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_GLUE_MATERIAL_REFERENCE',
        }),
      ]),
    );
  });

  it('reports intrinsic provenance failures at the source-row boundary', () => {
    const dataset = validV5();
    dataset.yieldMoldFormulaSources[0].yieldSampleId = '   ';

    const result =
      validatePhysicalBusinessDatasetV5Integrity(dataset);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'INVALID_YIELD_SAMPLE_ID',
        path: 'yieldMoldFormulaSources[0]',
      }),
    ]);
  });

  it('validates Yield, Mold and profile references through the complete v5 graph', () => {
    const missingYield = validV5();
    missingYield.yieldSamples = [];

    expect(
      validatePhysicalBusinessDatasetV5Integrity(missingYield)
        .issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_YIELD_SAMPLE_REFERENCE',
          path:
            'yieldMoldFormulaSources[0].yieldSampleId',
        }),
      ]),
    );

    const missingMold = validV5();
    missingMold.yieldMoldFormulaSources[0].moldId =
      'MISSING';

    expect(
      validatePhysicalBusinessDatasetV5Integrity(missingMold)
        .issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_MOLD_REFERENCE',
          path: 'yieldMoldFormulaSources[0].moldId',
        }),
      ]),
    );

    const missingProfile = validV5();
    missingProfile.yieldMoldFormulaSources[0]
      .moldYieldProfileId = 'MISSING';

    expect(
      validatePhysicalBusinessDatasetV5Integrity(
        missingProfile,
      ).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_MOLD_YIELD_PROFILE_REFERENCE',
          path:
            'yieldMoldFormulaSources[0].moldYieldProfileId',
        }),
      ]),
    );
  });

  it('rejects MixPreset/Mold Formula source conflict and duplicate provenance identity', () => {
    const conflict = validV5();
    conflict.mixPresets = [
      {
        id: 'MIX-001',
        name: 'Standard',
        compatibleCategories: ['paintable-art'],
        basis: 'weight',
        lines: [
          {
            materialId: 'PLASTER',
            role: 'primary',
            parts: 1,
          },
        ],
        isActive: true,
      },
    ];
    conflict.yieldSamples[0].mixPresetId = 'MIX-001';

    expect(
      validatePhysicalBusinessDatasetV5Integrity(conflict)
        .issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MIX_PRESET_SOURCE_CONFLICT',
        }),
      ]),
    );

    const duplicate = validV5();
    duplicate.yieldMoldFormulaSources.push({
      ...duplicate.yieldMoldFormulaSources[0],
      moldId: 'MOLD-001',
    });

    expect(
      validatePhysicalBusinessDatasetV5Integrity(duplicate)
        .issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DUPLICATE_YIELD_MOLD_FORMULA_SOURCE',
          path:
            'yieldMoldFormulaSources[1].yieldSampleId',
        }),
      ]),
    );
  });

  it('rejects Product ownership and profile-to-Mold mismatches', () => {
    const productMismatch = validV5();
    productMismatch.products.push({
      id: 'PROD-OTHER',
      name: 'Other',
      category: 'paintable-art',
      safetyWasteRate: 0,
      isActive: true,
    });
    productMismatch.molds[0].productId = 'PROD-OTHER';

    expect(
      validatePhysicalBusinessDatasetV5Integrity(
        productMismatch,
      ).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MOLD_PRODUCT_MISMATCH',
        }),
      ]),
    );

    const profileMismatch = validV5();
    profileMismatch.plasterMoldYieldProfiles[0].moldId =
      'MOLD-OTHER';

    expect(
      validatePhysicalBusinessDatasetV5Integrity(
        profileMismatch,
      ).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_MOLD_REFERENCE',
        }),
        expect.objectContaining({
          code: 'PROFILE_MOLD_MISMATCH',
        }),
      ]),
    );
  });

  it('accepts archived Mold/profile provenance in historical dataset validation', () => {
    const dataset = validV5();
    dataset.molds[0].isActive = false;
    dataset.plasterMoldYieldProfiles[0].isActive = false;

    expect(
      validatePhysicalBusinessDatasetV5Integrity(dataset),
    ).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('does not mutate the candidate while validating', () => {
    const dataset = validV5();
    const before = structuredClone(dataset);

    validatePhysicalBusinessDatasetV5Integrity(dataset);

    expect(dataset).toEqual(before);
  });
});
