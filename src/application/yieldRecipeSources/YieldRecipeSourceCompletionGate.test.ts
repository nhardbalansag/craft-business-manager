import { beforeEach, describe, expect, it } from 'vitest';
import {
  calibrationRepository,
  fixedRecipeItemRepository,
  materialRepository,
  mixPresetRepository,
  moldRepository,
  persistenceCoordinator,
  physicalSourceSnapshotServiceV5,
  plasterMoldYieldProfileRepository,
  productComponentRepository,
  productFinancialProfileRepository,
  productPriceTierRepository,
  productRepository,
  productStockRepository,
  storageLocationRepository,
  yieldLearningService,
  yieldMoldFormulaSourceRepository,
  yieldMoldFormulaSourceService,
  yieldRecipeSourceRecordingService,
  yieldSampleRepository,
} from '../session';
import {
  YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
  YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS,
} from '../../storage/physicalBusinessDatasetV5Workbook';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import type { YieldSample } from '../../domain/yieldSamples';

const codec = new SheetJsWorkbookCodec();

async function resetSharedSourceGraph(): Promise<void> {
  await Promise.all([
    calibrationRepository.replaceAll([]),
    fixedRecipeItemRepository.replaceAll([]),
    materialRepository.replaceAll([]),
    mixPresetRepository.replaceAll([]),
    moldRepository.replaceAll([]),
    plasterMoldYieldProfileRepository.replaceAll([]),
    productComponentRepository.replaceAll([]),
    productFinancialProfileRepository.replaceAll([]),
    productPriceTierRepository.replaceAll([]),
    productRepository.replaceAll([]),
    productStockRepository.replaceAll([]),
    storageLocationRepository.replaceAll([]),
    yieldMoldFormulaSourceRepository.replaceAll([]),
    yieldSampleRepository.replaceAll([]),
  ]);
}

async function seedYrs6SourceGraph(): Promise<void> {
  await materialRepository.replaceAll([
    {
      id: 'MAT-WATER-YRS6',
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
      id: 'MAT-PLASTER-YRS6',
      name: 'Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 100,
      onHandQuantity: 5000,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'MAT-GLUE-YRS6',
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
  ]);

  await productRepository.replaceAll([
    {
      id: 'PROD-YRS6',
      name: 'YRS6 Paintable Dino',
      category: 'paintable-art',
      safetyWasteRate: 0.05,
      isActive: true,
    },
  ]);

  await mixPresetRepository.replaceAll([
    {
      id: 'MIX-YRS6',
      name: 'YRS6 Standard Mix',
      compatibleCategories: ['paintable-art'],
      basis: 'weight',
      lines: [
        {
          materialId: 'MAT-PLASTER-YRS6',
          role: 'primary',
          parts: 1,
        },
      ],
      isActive: true,
    },
  ]);

  await moldRepository.replaceAll([
    {
      id: 'MOLD-YRS6',
      productId: 'PROD-YRS6',
      name: 'YRS6 Dino Mold',
      isActive: true,
    },
  ]);

  await plasterMoldYieldProfileRepository.replaceAll([
    {
      id: 'PMYP-YRS6',
      moldId: 'MOLD-YRS6',
      waterMaterialId: 'MAT-WATER-YRS6',
      plasterMaterialId: 'MAT-PLASTER-YRS6',
      glueMaterialId: 'MAT-GLUE-YRS6',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 4,
      isActive: true,
    },
  ]);
}

function sample(
  id: string,
  recordedAt: string,
): Omit<YieldSample, 'mixPresetId'> {
  return {
    id,
    productId: 'PROD-YRS6',
    materialInputs: [
      {
        materialId: 'MAT-PLASTER-YRS6',
        quantity: 100,
        unit: 'g',
      },
    ],
    goodPieces: 4,
    rejectedPieces: 1,
    recordedAt,
  };
}

describe('YRS6 integrated regression and completion gate', () => {
  beforeEach(async () => {
    await resetSharedSourceGraph();
    await seedYrs6SourceGraph();
  });

  it('preserves all three recipe-source meanings, measured learning, and physical-v5 provenance through workbook round-trip', async () => {
    const manual = await yieldRecipeSourceRecordingService.record({
      sample: sample('YLD-YRS6-MANUAL', '2026-09-30T01:00:00.000Z'),
      source: { kind: 'manual' },
    });

    const preset = await yieldRecipeSourceRecordingService.record({
      sample: sample('YLD-YRS6-MIX', '2026-09-30T02:00:00.000Z'),
      source: {
        kind: 'mix-preset',
        mixPresetId: 'MIX-YRS6',
      },
    });

    const formula = await yieldRecipeSourceRecordingService.record({
      sample: sample('YLD-YRS6-FORMULA', '2026-09-30T03:00:00.000Z'),
      source: {
        kind: 'mold-formula',
        moldId: 'MOLD-YRS6',
        moldYieldProfileId: 'PMYP-YRS6',
      },
    });

    expect(manual.recipeSource).toEqual({ kind: 'manual' });
    expect(preset.recipeSource).toEqual({
      kind: 'mix-preset',
      mixPresetId: 'MIX-YRS6',
    });
    expect(formula.recipeSource).toEqual({
      kind: 'mold-formula',
      moldId: 'MOLD-YRS6',
      moldYieldProfileId: 'PMYP-YRS6',
    });

    expect(manual.sample.mixPresetId).toBeUndefined();
    expect(preset.sample.mixPresetId).toBe('MIX-YRS6');
    expect(formula.sample.mixPresetId).toBeUndefined();
    expect(formula.moldFormulaSource).toEqual({
      yieldSampleId: 'YLD-YRS6-FORMULA',
      moldId: 'MOLD-YRS6',
      moldYieldProfileId: 'PMYP-YRS6',
    });

    // Formula planning values remain derived. The authoritative YieldSample
    // still contains only actual measured batch evidence plus legacy MixPreset
    // provenance when that source mode is used.
    expect(formula.sample).not.toHaveProperty('recipeSource');
    expect(formula.sample).not.toHaveProperty('plannedPieces');
    expect(formula.sample).not.toHaveProperty('waterGrams');
    expect(formula.sample).not.toHaveProperty('plasterGrams');
    expect(formula.sample).not.toHaveProperty('glueGrams');
    expect(formula.sample).not.toHaveProperty('requiredPours');

    const learningBefore = await Promise.all([
      yieldLearningService.deriveBySampleId('YLD-YRS6-MANUAL'),
      yieldLearningService.deriveBySampleId('YLD-YRS6-MIX'),
      yieldLearningService.deriveBySampleId('YLD-YRS6-FORMULA'),
    ]);

    // Same measured evidence produces the same learned requirement regardless
    // of recipe-source provenance.
    expect(learningBefore[0].materialRequirements).toEqual(
      learningBefore[1].materialRequirements,
    );
    expect(learningBefore[1].materialRequirements).toEqual(
      learningBefore[2].materialRequirements,
    );
    expect(
      learningBefore[2].materialRequirements[0].baseQuantityPerGoodPiece,
    ).toBe(25);
    expect(learningBefore[0].defectRate).toBe(0.2);
    expect(learningBefore[1].defectRate).toBe(0.2);
    expect(learningBefore[2].defectRate).toBe(0.2);

    const snapshotBefore = await physicalSourceSnapshotServiceV5.snapshot();
    expect(snapshotBefore.schemaVersion).toBe(5);
    expect(snapshotBefore.yieldSamples).toHaveLength(3);
    expect(snapshotBefore.yieldMoldFormulaSources).toEqual([
      {
        yieldSampleId: 'YLD-YRS6-FORMULA',
        moldId: 'MOLD-YRS6',
        moldYieldProfileId: 'PMYP-YRS6',
      },
    ]);

    const exported = await persistenceCoordinator.exportCurrentWorkbook();
    const document = codec.decode(exported.bytes);
    const provenanceSheet = document.sheets.find(
      (sheet) => sheet.name === YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
    );

    expect(provenanceSheet).toBeDefined();
    expect(provenanceSheet?.columns).toEqual([
      ...YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS,
    ]);
    expect(provenanceSheet?.rows).toEqual([
      {
        yieldSampleId: 'YLD-YRS6-FORMULA',
        moldId: 'MOLD-YRS6',
        moldYieldProfileId: 'PMYP-YRS6',
      },
    ]);

    await resetSharedSourceGraph();

    const imported = await persistenceCoordinator.importAndApplyWorkbook(
      exported.bytes,
    );

    expect(imported).toMatchObject({
      status: 'hydrated',
      metadata: {
        workbookFormatVersion: 5,
        datasetSchemaVersion: 5,
      },
    });

    const snapshotAfter = await physicalSourceSnapshotServiceV5.snapshot();
    expect(snapshotAfter).toEqual(snapshotBefore);

    await expect(
      yieldMoldFormulaSourceService.resolveRecipeSourceForYieldSample(
        'YLD-YRS6-MANUAL',
      ),
    ).resolves.toEqual({ kind: 'manual' });
    await expect(
      yieldMoldFormulaSourceService.resolveRecipeSourceForYieldSample(
        'YLD-YRS6-MIX',
      ),
    ).resolves.toEqual({
      kind: 'mix-preset',
      mixPresetId: 'MIX-YRS6',
    });
    await expect(
      yieldMoldFormulaSourceService.resolveRecipeSourceForYieldSample(
        'YLD-YRS6-FORMULA',
      ),
    ).resolves.toEqual({
      kind: 'mold-formula',
      moldId: 'MOLD-YRS6',
      moldYieldProfileId: 'PMYP-YRS6',
    });

    const learningAfter = await Promise.all([
      yieldLearningService.deriveBySampleId('YLD-YRS6-MANUAL'),
      yieldLearningService.deriveBySampleId('YLD-YRS6-MIX'),
      yieldLearningService.deriveBySampleId('YLD-YRS6-FORMULA'),
    ]);

    expect(learningAfter).toEqual(learningBefore);
  });
});
