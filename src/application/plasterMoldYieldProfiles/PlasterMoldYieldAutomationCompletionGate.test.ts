import { beforeEach, describe, expect, it } from 'vitest';
import * as session from '../session';
import { buildPlasterMoldYieldDraft } from '../../ui/yield/plasterMoldYieldDraft';

async function resetAuthoritativeState() {
  await Promise.all([
    session.materialRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.mixPresetRepository.replaceAll([]),
    session.productRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
    session.productPriceTierRepository.replaceAll([]),
    session.storageLocationRepository.replaceAll([]),
    session.moldRepository.replaceAll([]),
    session.plasterMoldYieldProfileRepository.replaceAll([]),
  ]);
}

async function seedCanonicalMYSource() {
  await session.materialService.createMaterial({
    id: 'MAT-WATER-MY8',
    name: 'MY8 Water',
    group: 'liquid',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 20,
    onHandQuantity: 1000,
    onHandUnit: 'g',
    isActive: true,
  });
  await session.materialService.createMaterial({
    id: 'MAT-PLASTER-MY8',
    name: 'MY8 Plaster',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 100,
    onHandQuantity: 1000,
    onHandUnit: 'g',
    isActive: true,
  });
  await session.materialService.createMaterial({
    id: 'MAT-GLUE-MY8',
    name: 'MY8 Glue',
    group: 'other',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 200,
    onHandQuantity: 1000,
    onHandUnit: 'g',
    isActive: true,
  });

  await session.productService.createProduct({
    id: 'PROD-MY8',
    name: 'MY8 Paintable Dino',
    category: 'paintable-art',
    safetyWasteRate: 0.1,
    isActive: true,
  });

  await session.moldService.createMold({
    id: 'MOLD-MY8',
    productId: 'PROD-MY8',
    name: 'MY8 Four Cavity Dino Mold',
    isActive: true,
  });

  await session.plasterMoldYieldProfileService.createProfile({
    id: 'PMYP-MY8',
    moldId: 'MOLD-MY8',
    waterMaterialId: 'MAT-WATER-MY8',
    plasterMaterialId: 'MAT-PLASTER-MY8',
    glueMaterialId: 'MAT-GLUE-MY8',
    waterFillWeightGrams: 50,
    waterAdjustmentRate: 0.3,
    plasterFactor: 0.75,
    glueFactor: 0.05,
    piecesPerPour: 4,
    notes: 'MY8 canonical completion gate',
    isActive: true,
  });
}

async function recordActualYieldEvidence() {
  return session.yieldSampleEvidenceService.recordSample({
    id: 'YLD-MY8-ACTUAL',
    productId: 'PROD-MY8',
    materialInputs: [
      {
        materialId: 'MAT-WATER-MY8',
        quantity: 36,
        unit: 'g',
      },
      {
        materialId: 'MAT-PLASTER-MY8',
        quantity: 27.4,
        unit: 'g',
      },
      {
        materialId: 'MAT-GLUE-MY8',
        quantity: 1.8,
        unit: 'g',
      },
    ],
    goodPieces: 4,
    rejectedPieces: 0,
    recordedAt: '2026-09-29T06:00:00.000Z',
    notes: 'Measured real MY8 batch',
  });
}

function requirementByMaterial(
  plan: Awaited<ReturnType<typeof session.productionRequirementService.plan>>,
  materialId: string,
) {
  const found = plan.requirements.find(
    (requirement) =>
      requirement.materialId.toLocaleLowerCase() ===
      materialId.toLocaleLowerCase(),
  );
  if (!found) throw new Error(`Missing production requirement: ${materialId}`);
  return found;
}

beforeEach(async () => {
  await resetAuthoritativeState();
});

describe('MY8 Plaster Mold Yield Automation integrated completion gate', () => {
  it('keeps theoretical formula, Yield evidence, Production safety waste, persistence, cost and capacity semantics distinct end-to-end', async () => {
    await seedCanonicalMYSource();

    const formulaBeforeEvidence =
      await session.plasterMoldYieldCalculatorService.calculateForMold(
        'MOLD-MY8',
        21,
      );

    expect(formulaBeforeEvidence).toMatchObject({
      estimateKind: 'theoretical',
      productSafetyWasteApplied: false,
      yieldEvidenceCreated: false,
      formula: {
        piecesPerPour: 4,
        perPour: {
          adjustedWaterGrams: 35,
          plasterGrams: 26.25,
          glueGrams: 1.75,
          totalMixtureGrams: 63,
        },
        requestedQuantityEstimate: {
          requestedQuantity: 21,
          requiredPours: 6,
          producedCapacityPieces: 24,
          extraCapacityPieces: 3,
          totals: {
            adjustedWaterGrams: 210,
            plasterGrams: 157.5,
            glueGrams: 10.5,
            totalMixtureGrams: 378,
          },
        },
      },
    });

    const draft = buildPlasterMoldYieldDraft(formulaBeforeEvidence);
    expect(draft).toMatchObject({
      sourceKind: 'plaster-mold-formula',
      estimateKind: 'theoretical',
      moldId: 'MOLD-MY8',
      profileId: 'PMYP-MY8',
      requestedQuantity: 21,
      requiredPours: 6,
      producedCapacityPieces: 24,
      extraCapacityPieces: 3,
      totalMixtureGrams: 378,
      materialInputs: [
        { materialId: 'MAT-WATER-MY8', quantity: 210, unit: 'g' },
        { materialId: 'MAT-PLASTER-MY8', quantity: 157.5, unit: 'g' },
        { materialId: 'MAT-GLUE-MY8', quantity: 10.5, unit: 'g' },
      ],
    });
    expect(draft).not.toHaveProperty('goodPieces');
    expect(draft).not.toHaveProperty('rejectedPieces');
    expect(
      await session.yieldSampleEvidenceService.listSamples({
        productId: 'PROD-MY8',
      }),
    ).toEqual([]);

    await recordActualYieldEvidence();

    const productionBeforeRoundTrip =
      await session.productionRequirementService.plan('PROD-MY8', 21);

    expect(productionBeforeRoundTrip).toMatchObject({
      productId: 'PROD-MY8',
      status: 'ready',
      effectiveYieldSampleId: 'YLD-MY8-ACTUAL',
      plannedQuantity: 21,
      safetyWasteRate: 0.1,
      safetyWastePercentage: 10,
      safetyWasteMultiplier: 1.1,
      observedDefectRateIncluded: false,
    });

    const waterProduction = requirementByMaterial(
      productionBeforeRoundTrip,
      'MAT-WATER-MY8',
    );
    const plasterProduction = requirementByMaterial(
      productionBeforeRoundTrip,
      'MAT-PLASTER-MY8',
    );
    const glueProduction = requirementByMaterial(
      productionBeforeRoundTrip,
      'MAT-GLUE-MY8',
    );

    // Real Yield evidence is authoritative here:
    // Water   36 / 4 = 9 g/piece; 10% safety waste => 9.9; × 21 = 207.9 g.
    // Plaster 27.4 / 4 = 6.85;    10% safety waste => 7.535; × 21 = 158.235 g.
    // Glue    1.8 / 4 = 0.45;     10% safety waste => 0.495; × 21 = 10.395 g.
    expect(waterProduction.effectiveBaseQuantityPerProduct).toBeCloseTo(9);
    expect(waterProduction.plannedBatchBaseQuantity).toBeCloseTo(207.9);
    expect(plasterProduction.effectiveBaseQuantityPerProduct).toBeCloseTo(6.85);
    expect(plasterProduction.plannedBatchBaseQuantity).toBeCloseTo(158.235);
    expect(glueProduction.effectiveBaseQuantityPerProduct).toBeCloseTo(0.45);
    expect(glueProduction.plannedBatchBaseQuantity).toBeCloseTo(10.395);

    // The Production path must not silently switch back to theoretical Mold Formula totals.
    expect(waterProduction.plannedBatchBaseQuantity).not.toBeCloseTo(210);
    expect(plasterProduction.plannedBatchBaseQuantity).not.toBeCloseTo(157.5);
    expect(glueProduction.plannedBatchBaseQuantity).not.toBeCloseTo(10.5);

    const operationalBeforeRoundTrip =
      await session.plasterMoldOperationalPreviewService.preview(
        'MOLD-MY8',
        21,
      );

    expect(operationalBeforeRoundTrip).toMatchObject({
      estimateKind: 'mold-formula-operational-preview',
      requestedQuantity: 21,
      requiredPours: 6,
      producedCapacityPieces: 24,
      extraCapacityPieces: 3,
      status: 'ready',
      feasibility: 'within-current-stock',
      maxCompletePoursFromCurrentStock: 28,
      maxProducedPiecesFromCurrentStock: 112,
      productSafetyWasteApplied: false,
      yieldEvidenceUsed: false,
      productionPathReplaced: false,
    });
    expect(
      operationalBeforeRoundTrip.estimatedMaterialCostPerPour,
    ).toBeCloseTo(3.675);
    expect(
      operationalBeforeRoundTrip.estimatedMaterialCostPerPiece,
    ).toBeCloseTo(0.91875);
    expect(
      operationalBeforeRoundTrip.estimatedTargetBatchMaterialCost,
    ).toBeCloseTo(22.05);
    expect(operationalBeforeRoundTrip.limitingMaterialIds).toEqual([
      'MAT-WATER-MY8',
    ]);

    const sourceBeforeRoundTrip =
      await session.physicalSourceSnapshotServiceV4.snapshot();
    const workbook = await session.persistenceCoordinator.exportCurrentWorkbook();

    expect(workbook.status).toBe('exported');
    expect(workbook.bytes.byteLength).toBeGreaterThan(0);

    await resetAuthoritativeState();

    expect(
      await session.plasterMoldYieldProfileService.listProfiles(),
    ).toEqual([]);
    expect(
      await session.yieldSampleEvidenceService.listSamples(),
    ).toEqual([]);

    const hydration = await session.persistenceCoordinator.importAndApplyWorkbook(
      workbook.bytes,
    );

    expect(hydration.status).toBe('hydrated');

    const sourceAfterRoundTrip =
      await session.physicalSourceSnapshotServiceV4.snapshot();
    expect(sourceAfterRoundTrip).toEqual(sourceBeforeRoundTrip);

    const formulaAfterRoundTrip =
      await session.plasterMoldYieldCalculatorService.calculateForMold(
        'MOLD-MY8',
        21,
      );
    expect(formulaAfterRoundTrip).toEqual(formulaBeforeEvidence);

    const restoredYield = await session.yieldSampleEvidenceService.listSamples({
      productId: 'PROD-MY8',
    });
    expect(restoredYield).toEqual([
      expect.objectContaining({
        id: 'YLD-MY8-ACTUAL',
        productId: 'PROD-MY8',
        goodPieces: 4,
        rejectedPieces: 0,
      }),
    ]);

    const productionAfterRoundTrip =
      await session.productionRequirementService.plan('PROD-MY8', 21);
    expect(productionAfterRoundTrip).toEqual(productionBeforeRoundTrip);

    const operationalAfterRoundTrip =
      await session.plasterMoldOperationalPreviewService.preview(
        'MOLD-MY8',
        21,
      );
    expect(operationalAfterRoundTrip).toEqual(operationalBeforeRoundTrip);
  });

  it('keeps active profile relationship guards effective at the completion boundary', async () => {
    await seedCanonicalMYSource();

    await expect(
      session.moldService.archiveMold('MOLD-MY8'),
    ).rejects.toMatchObject({
      code: 'MOLD_IN_USE_BY_ACTIVE_PROFILE',
    });

    await expect(
      session.materialService.archiveMaterial('MAT-PLASTER-MY8'),
    ).rejects.toMatchObject({
      code: 'MATERIAL_IN_USE_BY_ACTIVE_PROFILE',
    });

    await expect(
      session.materialService.updateMaterial('MAT-GLUE-MY8', {
        baseUnit: 'mL',
        purchaseUnit: 'mL',
        onHandUnit: 'mL',
      }),
    ).rejects.toMatchObject({
      code: 'ACTIVE_PROFILE_REQUIRES_WEIGHT_MATERIAL',
    });

    expect(
      await session.plasterMoldYieldProfileService.getActiveProfileForMold(
        'MOLD-MY8',
      ),
    ).toMatchObject({
      id: 'PMYP-MY8',
      isActive: true,
    });
  });
});
