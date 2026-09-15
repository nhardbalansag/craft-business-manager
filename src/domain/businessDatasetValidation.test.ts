import { describe, expect, it } from 'vitest';
import {
  createEmptyBusinessDataset,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
} from './businessDataset';
import {
  validateBusinessDatasetIntegrity,
  type BusinessDatasetValidationIssueCode,
} from './businessDatasetValidation';
import type { BusinessDataset } from './types';

function makeDataset(): BusinessDataset {
  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [
      {
        id: 'mat-plaster',
        name: 'Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1000,
        purchaseUnit: 'g',
        packageCost: 66,
        onHandQuantity: 750,
        onHandUnit: 'g',
        isActive: true,
      },
      {
        id: 'mat-vessel',
        name: 'Glass vessel',
        group: 'container',
        baseUnit: 'pc',
        purchaseQuantity: 12,
        purchaseUnit: 'pc',
        packageCost: 120,
        onHandQuantity: 8,
        onHandUnit: 'pc',
        isActive: true,
      },
    ],
    materialCalibrations: [
      {
        id: 'cal-plaster-1',
        materialId: 'mat-plaster',
        measuredVolume: 5,
        volumeUnit: 'cup',
        knownWeight: 1000,
        weightUnit: 'g',
        recordedAt: '2026-09-15T10:00:00.000Z',
      },
    ],
    mixPresets: [
      {
        id: 'mix-plaster',
        name: 'Plaster mix',
        compatibleCategories: ['candle-pot'],
        basis: 'weight',
        lines: [{ materialId: 'mat-plaster', role: 'primary', parts: 1 }],
        isActive: true,
      },
    ],
    products: [
      {
        id: 'prod-pot',
        name: 'Candle pot',
        category: 'candle-pot',
        mixPresetId: 'mix-plaster',
        safetyWasteRate: 0.05,
        isActive: true,
      },
      {
        id: 'prod-candle',
        name: 'Event candle',
        category: 'candle',
        safetyWasteRate: 0.03,
        isActive: true,
      },
    ],
    yieldSamples: [
      {
        id: 'yield-pot-1',
        productId: 'prod-pot',
        mixPresetId: 'mix-plaster',
        materialInputs: [{ materialId: 'mat-plaster', quantity: 500, unit: 'g' }],
        goodPieces: 5,
        rejectedPieces: 1,
        recordedAt: '2026-09-15T11:00:00.000Z',
      },
    ],
    recipeItems: [
      {
        id: 'recipe-pot-finish',
        productId: 'prod-pot',
        materialId: 'mat-plaster',
        quantityPerProduct: 5,
        unit: 'g',
        role: 'finish',
      },
    ],
    productComponents: [
      {
        id: 'component-pot-vessel',
        parentProductId: 'prod-pot',
        sourceType: 'material',
        sourceId: 'mat-vessel',
        role: 'vessel',
        quantityPerParent: 1,
      },
      {
        id: 'component-candle-pot',
        parentProductId: 'prod-candle',
        sourceType: 'product',
        sourceId: 'prod-pot',
        role: 'vessel',
        quantityPerParent: 1,
      },
    ],
    productStocks: [
      {
        productId: 'prod-pot',
        onHandQuantity: 0,
      },
    ],
    productFinancialProfiles: [
      {
        productId: 'prod-candle',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: { method: 'markup-percent', value: 0 },
      },
    ],
  };
}

function expectIssue(
  dataset: unknown,
  code: BusinessDatasetValidationIssueCode,
  path: string,
): void {
  const result = validateBusinessDatasetIntegrity(dataset);
  expect(result.valid).toBe(false);
  expect(result.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code, path }),
    ]),
  );
}

describe('BusinessDataset complete integrity validation', () => {
  it('accepts a complete valid non-empty dataset with zero issues', () => {
    expect(validateBusinessDatasetIntegrity(makeDataset())).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('accepts the canonical empty dataset', () => {
    expect(validateBusinessDatasetIntegrity(createEmptyBusinessDataset())).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('resolves durable references trim-aware and case-insensitively', () => {
    const dataset = makeDataset();
    dataset.materialCalibrations[0].materialId = ' MAT-PLASTER ';
    dataset.mixPresets[0].lines[0].materialId = ' MAT-PLASTER ';
    dataset.products[0].mixPresetId = ' MIX-PLASTER ';
    dataset.yieldSamples[0].productId = ' PROD-POT ';
    dataset.yieldSamples[0].mixPresetId = ' MIX-PLASTER ';
    dataset.yieldSamples[0].materialInputs[0].materialId = ' MAT-PLASTER ';
    dataset.recipeItems[0].productId = ' PROD-POT ';
    dataset.recipeItems[0].materialId = ' MAT-PLASTER ';
    dataset.productComponents[0].parentProductId = ' PROD-POT ';
    dataset.productComponents[0].sourceId = ' MAT-VESSEL ';
    dataset.productComponents[1].parentProductId = ' PROD-CANDLE ';
    dataset.productComponents[1].sourceId = ' PROD-POT ';
    dataset.productStocks[0].productId = ' PROD-POT ';
    dataset.productFinancialProfiles[0].productId = ' PROD-CANDLE ';

    expect(validateBusinessDatasetIntegrity(dataset)).toEqual({ valid: true, issues: [] });
  });

  it('keeps archived historical relationships round-trippable', () => {
    const dataset = makeDataset();
    dataset.materials.forEach((material) => { material.isActive = false; });
    dataset.mixPresets.forEach((preset) => { preset.isActive = false; });
    dataset.products.forEach((product) => { product.isActive = false; });

    expect(validateBusinessDatasetIntegrity(dataset)).toEqual({ valid: true, issues: [] });
  });

  it('validates historical calibration evidence independently from the Material current base unit', () => {
    const dataset = makeDataset();
    const material = dataset.materials[0];
    material.baseUnit = 'mL';
    material.purchaseUnit = 'mL';
    material.onHandUnit = 'mL';

    expect(validateBusinessDatasetIntegrity(dataset)).toEqual({ valid: true, issues: [] });
  });

  it('preserves missing versus explicit zero/null Product stock and financial source evidence', () => {
    const explicit = makeDataset();
    explicit.productFinancialProfiles[0].pricingPolicy = null;
    expect(validateBusinessDatasetIntegrity(explicit)).toEqual({ valid: true, issues: [] });

    const missing = makeDataset();
    missing.productStocks = [];
    missing.productFinancialProfiles = [];
    expect(validateBusinessDatasetIntegrity(missing)).toEqual({ valid: true, issues: [] });
  });

  it('does not mutate the candidate while validating', () => {
    const dataset = makeDataset();
    const before = JSON.stringify(dataset);

    validateBusinessDatasetIntegrity(dataset);

    expect(JSON.stringify(dataset)).toBe(before);
  });

  it('fails closed on unsupported schema versions and malformed source collections', () => {
    expectIssue({ ...makeDataset(), schemaVersion: 2 }, 'UNSUPPORTED_SCHEMA_VERSION', 'schemaVersion');
    expectIssue({ ...makeDataset(), productStocks: {} }, 'INVALID_SOURCE_COLLECTION', 'productStocks');
  });

  it('converts malformed source rows into controlled record diagnostics', () => {
    const dataset = makeDataset();
    (dataset.materials as unknown[])[0] = null;

    expectIssue(dataset, 'INVALID_RECORD', 'materials[0]');
  });

  it('applies authoritative source validation to every persisted collection', () => {
    const material = makeDataset();
    material.materials[0].packageCost = -1;
    expectIssue(material, 'INVALID_RECORD', 'materials[0].packageCost');

    const calibration = makeDataset();
    calibration.materialCalibrations[0].measuredVolume = 0;
    expectIssue(calibration, 'INVALID_RECORD', 'materialCalibrations[0].measuredVolume');

    const mixPreset = makeDataset();
    mixPreset.mixPresets[0].basis = 'count' as never;
    expectIssue(mixPreset, 'INVALID_RECORD', 'mixPresets[0].basis');

    const product = makeDataset();
    product.products[0].safetyWasteRate = 1;
    expectIssue(product, 'INVALID_RECORD', 'products[0].safetyWasteRate');

    const yieldSample = makeDataset();
    yieldSample.yieldSamples[0].goodPieces = 0;
    expectIssue(yieldSample, 'INVALID_RECORD', 'yieldSamples[0].goodPieces');

    const recipeItem = makeDataset();
    recipeItem.recipeItems[0].quantityPerProduct = 0;
    expectIssue(recipeItem, 'INVALID_RECORD', 'recipeItems[0].quantityPerProduct');

    const component = makeDataset();
    component.productComponents[0].quantityPerParent = 0.5;
    expectIssue(component, 'INVALID_RECORD', 'productComponents[0].quantityPerParent');

    const stock = makeDataset();
    stock.productStocks[0].onHandQuantity = -1;
    expectIssue(stock, 'INVALID_RECORD', 'productStocks[0].onHandQuantity');

    const financial = makeDataset();
    financial.productFinancialProfiles[0].pricingPolicy = {
      method: 'margin-percent',
      value: 1,
    };
    expectIssue(financial, 'INVALID_RECORD', 'productFinancialProfiles[0].pricingPolicy.value');
  });

  it('detects trim-aware case-insensitive duplicate IDs before hydration', () => {
    const material = makeDataset();
    material.materials.push({ ...material.materials[0], id: ' MAT-PLASTER ', name: 'Other plaster' });
    expectIssue(material, 'DUPLICATE_IDENTITY', 'materials[2].id');

    const calibration = makeDataset();
    calibration.materialCalibrations.push({ ...calibration.materialCalibrations[0], id: ' CAL-PLASTER-1 ' });
    expectIssue(calibration, 'DUPLICATE_IDENTITY', 'materialCalibrations[1].id');

    const mixPreset = makeDataset();
    mixPreset.mixPresets.push({ ...mixPreset.mixPresets[0], id: ' MIX-PLASTER ', name: 'Other mix', lines: mixPreset.mixPresets[0].lines.map((line) => ({ ...line })), compatibleCategories: [...mixPreset.mixPresets[0].compatibleCategories] });
    expectIssue(mixPreset, 'DUPLICATE_IDENTITY', 'mixPresets[1].id');

    const product = makeDataset();
    product.products.push({ ...product.products[0], id: ' PROD-POT ', name: 'Other pot' });
    expectIssue(product, 'DUPLICATE_IDENTITY', 'products[2].id');

    const yieldSample = makeDataset();
    yieldSample.yieldSamples.push({ ...yieldSample.yieldSamples[0], id: ' YIELD-POT-1 ', materialInputs: yieldSample.yieldSamples[0].materialInputs.map((input) => ({ ...input })) });
    expectIssue(yieldSample, 'DUPLICATE_IDENTITY', 'yieldSamples[1].id');

    const recipe = makeDataset();
    recipe.recipeItems.push({ ...recipe.recipeItems[0], id: ' RECIPE-POT-FINISH ' });
    expectIssue(recipe, 'DUPLICATE_IDENTITY', 'recipeItems[1].id');

    const component = makeDataset();
    component.productComponents.push({ ...component.productComponents[0], id: ' COMPONENT-POT-VESSEL ' });
    expectIssue(component, 'DUPLICATE_IDENTITY', 'productComponents[2].id');
  });

  it('detects duplicate names, composite recipe identity, and one-record-per-Product sources', () => {
    const materialName = makeDataset();
    materialName.materials.push({ ...materialName.materials[1], id: 'mat-vessel-2', name: ' GLASS VESSEL ' });
    expectIssue(materialName, 'DUPLICATE_IDENTITY', 'materials[2].name');

    const mixName = makeDataset();
    mixName.mixPresets.push({ ...mixName.mixPresets[0], id: 'mix-other', name: ' PLASTER MIX ', lines: mixName.mixPresets[0].lines.map((line) => ({ ...line })), compatibleCategories: [...mixName.mixPresets[0].compatibleCategories] });
    expectIssue(mixName, 'DUPLICATE_IDENTITY', 'mixPresets[1].name');

    const productName = makeDataset();
    productName.products.push({ ...productName.products[1], id: 'prod-other', name: ' EVENT CANDLE ' });
    expectIssue(productName, 'DUPLICATE_IDENTITY', 'products[2].name');

    const recipeIdentity = makeDataset();
    recipeIdentity.recipeItems.push({ ...recipeIdentity.recipeItems[0], id: 'recipe-pot-finish-2', productId: ' PROD-POT ', materialId: ' MAT-PLASTER ' });
    expectIssue(recipeIdentity, 'DUPLICATE_IDENTITY', 'recipeItems[1].materialId');

    const stock = makeDataset();
    stock.productStocks.push({ productId: ' PROD-POT ', onHandQuantity: 2 });
    expectIssue(stock, 'DUPLICATE_IDENTITY', 'productStocks[1].productId');

    const financial = makeDataset();
    financial.productFinancialProfiles.push({ ...financial.productFinancialProfiles[0], productId: ' PROD-CANDLE ', pricingPolicy: null });
    expectIssue(financial, 'DUPLICATE_IDENTITY', 'productFinancialProfiles[1].productId');
  });

  const missingReferenceCases: Array<{
    name: string;
    path: string;
    mutate: (dataset: BusinessDataset) => void;
  }> = [
    {
      name: 'calibration -> Material',
      path: 'materialCalibrations[0].materialId',
      mutate: (dataset) => { dataset.materialCalibrations[0].materialId = 'missing-material'; },
    },
    {
      name: 'mix line -> Material',
      path: 'mixPresets[0].lines[0].materialId',
      mutate: (dataset) => { dataset.mixPresets[0].lines[0].materialId = 'missing-material'; },
    },
    {
      name: 'Product -> MixPreset',
      path: 'products[0].mixPresetId',
      mutate: (dataset) => { dataset.products[0].mixPresetId = 'missing-mix'; },
    },
    {
      name: 'YieldSample -> Product',
      path: 'yieldSamples[0].productId',
      mutate: (dataset) => { dataset.yieldSamples[0].productId = 'missing-product'; },
    },
    {
      name: 'YieldSample -> MixPreset',
      path: 'yieldSamples[0].mixPresetId',
      mutate: (dataset) => { dataset.yieldSamples[0].mixPresetId = 'missing-mix'; },
    },
    {
      name: 'YieldSample input -> Material',
      path: 'yieldSamples[0].materialInputs[0].materialId',
      mutate: (dataset) => { dataset.yieldSamples[0].materialInputs[0].materialId = 'missing-material'; },
    },
    {
      name: 'RecipeItem -> Product',
      path: 'recipeItems[0].productId',
      mutate: (dataset) => { dataset.recipeItems[0].productId = 'missing-product'; },
    },
    {
      name: 'RecipeItem -> Material',
      path: 'recipeItems[0].materialId',
      mutate: (dataset) => { dataset.recipeItems[0].materialId = 'missing-material'; },
    },
    {
      name: 'ProductComponent parent -> Product',
      path: 'productComponents[0].parentProductId',
      mutate: (dataset) => { dataset.productComponents[0].parentProductId = 'missing-product'; },
    },
    {
      name: 'material ProductComponent source -> Material',
      path: 'productComponents[0].sourceId',
      mutate: (dataset) => { dataset.productComponents[0].sourceId = 'missing-material'; },
    },
    {
      name: 'product ProductComponent source -> Product',
      path: 'productComponents[1].sourceId',
      mutate: (dataset) => { dataset.productComponents[1].sourceId = 'missing-product'; },
    },
    {
      name: 'ProductStock -> Product',
      path: 'productStocks[0].productId',
      mutate: (dataset) => { dataset.productStocks[0].productId = 'missing-product'; },
    },
    {
      name: 'ProductFinancialProfile -> Product',
      path: 'productFinancialProfiles[0].productId',
      mutate: (dataset) => { dataset.productFinancialProfiles[0].productId = 'missing-product'; },
    },
  ];

  it.each(missingReferenceCases)('rejects missing durable reference: $name', ({ mutate, path }) => {
    const dataset = makeDataset();
    mutate(dataset);
    expectIssue(dataset, 'MISSING_REFERENCE', path);
  });

  it('reuses Product composition validation for duplicate parent/source identity', () => {
    const dataset = makeDataset();
    dataset.productComponents.push({
      ...dataset.productComponents[0],
      id: 'component-pot-vessel-duplicate',
      role: 'accessory',
    });

    const result = validateBusinessDatasetIntegrity(dataset);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_COMPONENT_GRAPH',
          collection: 'productComponents',
          field: 'sourceId',
        }),
      ]),
    );
  });

  it('reuses Product composition validation for direct self-reference', () => {
    const dataset = makeDataset();
    dataset.productComponents[1].sourceId = 'prod-candle';

    expectIssue(dataset, 'INVALID_COMPONENT_GRAPH', 'productComponents[1].sourceId');
  });

  it('reuses Product composition validation for transitive cycles', () => {
    const dataset = makeDataset();
    dataset.productComponents.push({
      id: 'component-pot-candle',
      parentProductId: 'prod-pot',
      sourceType: 'product',
      sourceId: 'prod-candle',
      role: 'insert',
      quantityPerParent: 1,
    });

    const result = validateBusinessDatasetIntegrity(dataset);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'INVALID_COMPONENT_GRAPH')).toBe(true);
  });

  it('accepts the valid nested acyclic Product graph', () => {
    expect(validateBusinessDatasetIntegrity(makeDataset()).issues).toEqual([]);
  });

  it('returns deterministic collection/index/path ordering for independent errors', () => {
    const dataset = makeDataset();
    dataset.materials.push({ ...dataset.materials[0], id: ' MAT-PLASTER ', name: 'Duplicate material row' });
    dataset.products[1].mixPresetId = 'missing-mix';
    dataset.productStocks[0].onHandQuantity = -1;

    const first = validateBusinessDatasetIntegrity(dataset);
    const second = validateBusinessDatasetIntegrity(dataset);

    expect(first).toEqual(second);
    expect(first.issues.map((issue) => issue.path)).toEqual([
      'materials[2].id',
      'products[1].mixPresetId',
      'productStocks[0].onHandQuantity',
    ]);
  });
});
