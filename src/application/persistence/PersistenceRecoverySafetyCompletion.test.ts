import { describe, expect, it, vi } from 'vitest';
import type { BusinessDataset } from '../../domain/types';
import {
  createBusinessDatasetWorkbookDocument,
  exportBusinessDatasetToXlsx,
} from '../../storage/businessDatasetWorkbookExport';
import type { WorkbookCodec } from '../../storage/workbookCodec';
import {
  summarizeWorkbookImportRecovery,
  type WorkbookRecoveryActionCode,
  type WorkbookRecoveryCategory,
} from '../../storage/workbookRecoveryDiagnostics';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import type { WorkbookNeutralDocument } from '../../storage/workbookSchema';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import { InMemoryProductFinancialProfileRepository } from '../productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import { ValidatedAtomicDatasetHydrationService } from './ValidatedAtomicDatasetHydrationService';

const METADATA = {
  exportedAt: '2026-09-16T12:30:00.000Z',
  applicationVersion: '5.4c3-completion',
} as const;

type MutableSheet = {
  name: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

type MutableWorkbook = {
  sheets: MutableSheet[];
};

function liveDataset(): BusinessDataset {
  return {
    schemaVersion: 1,
    materials: [
      {
        id: 'live-material',
        name: 'Live plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 88,
        onHandQuantity: 2,
        onHandUnit: 'kg',
        isActive: true,
      },
    ],
    materialCalibrations: [],
    mixPresets: [],
    products: [
      {
        id: 'live-product',
        name: 'Live paintable figure',
        category: 'paintable-art',
        safetyWasteRate: 0.04,
        isActive: true,
      },
    ],
    yieldSamples: [],
    recipeItems: [],
    productComponents: [],
    productStocks: [{ productId: 'live-product', onHandQuantity: 7 }],
    productFinancialProfiles: [],
  };
}

function importDataset(): BusinessDataset {
  return {
    schemaVersion: 1,
    materials: [
      {
        id: 'mat-plaster',
        name: 'Fine plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 66,
        onHandQuantity: 1.5,
        onHandUnit: 'kg',
        isActive: true,
      },
    ],
    materialCalibrations: [],
    mixPresets: [],
    products: [
      {
        id: 'product-a',
        name: 'Primary candle',
        category: 'candle',
        safetyWasteRate: 0,
        isActive: true,
      },
      {
        id: 'product-b',
        name: 'Nested candle component',
        category: 'candle',
        safetyWasteRate: 0,
        isActive: true,
      },
    ],
    yieldSamples: [],
    recipeItems: [],
    productComponents: [
      {
        id: 'component-a-b',
        parentProductId: 'product-a',
        sourceType: 'product',
        sourceId: 'product-b',
        role: 'molded-component',
        quantityPerParent: 1,
      },
    ],
    productStocks: [],
    productFinancialProfiles: [],
  };
}

function mutableDocument(): MutableWorkbook {
  return structuredClone(
    createBusinessDatasetWorkbookDocument(importDataset(), METADATA),
  ) as MutableWorkbook;
}

function sheet(document: MutableWorkbook, name: string): MutableSheet {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing test sheet ${name}.`);
  return found;
}

function workbookCodecFor(document: WorkbookNeutralDocument): WorkbookCodec {
  return {
    encode: () => new Uint8Array(),
    decode: () => structuredClone(document),
  };
}

function overLimitDocument(): WorkbookNeutralDocument {
  return {
    sheets: Array.from({ length: 33 }, (_, index) => ({
      name: `Sheet${index + 1}`,
      columns: [],
      rows: [],
    })),
  };
}

async function createHarness(codec: WorkbookCodec) {
  const repositories = {
    materials: new InMemoryMaterialRepository(),
    calibrations: new InMemoryCalibrationRepository(),
    mixPresets: new InMemoryMixPresetRepository(),
    products: new InMemoryProductRepository(),
    yieldSamples: new InMemoryYieldSampleRepository(),
    recipeItems: new InMemoryFixedRecipeItemRepository(),
    productComponents: new InMemoryProductComponentRepository(),
    productStocks: new InMemoryProductStockRepository(),
    productFinancialProfiles: new InMemoryProductFinancialProfileRepository(),
  };
  const snapshot = new CompleteSourceSnapshotService(repositories);
  const hydration = new ValidatedAtomicDatasetHydrationService(repositories, snapshot);
  const seeded = await hydration.hydrate(liveDataset());
  expect(seeded).toEqual({ status: 'hydrated' });

  const hydrateSpy = vi.fn((dataset: BusinessDataset) => hydration.hydrate(dataset));
  const coordinator = new PersistenceCoordinator(snapshot, { hydrate: hydrateSpy }, codec);

  return { snapshot, coordinator, hydrateSpy };
}

async function expectRejectedWithoutStateChange(
  codec: WorkbookCodec,
  bytes: Uint8Array,
  expectedCategory: WorkbookRecoveryCategory,
  options: {
    issueCode?: string;
    action?: WorkbookRecoveryActionCode;
    backupRestoreRecommended?: boolean;
  } = {},
) {
  const harness = await createHarness(codec);
  const before = await harness.snapshot.snapshot();
  const result = await harness.coordinator.importAndApplyWorkbook(bytes);

  expect(result).toMatchObject({ status: 'rejected', stage: 'import' });
  if (result.status !== 'rejected' || result.stage !== 'import') {
    throw new Error('Expected an import-stage rejection.');
  }

  if (options.issueCode !== undefined) {
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: options.issueCode })]),
    );
  }

  const rawIssues = [...result.issues];
  const firstIssue = result.issues[0];
  const summary = summarizeWorkbookImportRecovery(result.issues);

  expect(summary.primaryCategory).toBe(expectedCategory);
  expect(summary.liveStateChanged).toBe(false);
  expect(summary.issueCount).toBe(result.issues.length);
  if (options.action !== undefined) {
    expect(summary.recommendedActions).toContain(options.action);
  }
  if (options.backupRestoreRecommended !== undefined) {
    expect(summary.backupRestoreRecommended).toBe(options.backupRestoreRecommended);
  }

  expect(result.issues).toEqual(rawIssues);
  expect(result.issues[0]).toBe(firstIssue);
  expect(harness.hydrateSpy).not.toHaveBeenCalled();
  expect(await harness.snapshot.snapshot()).toEqual(before);

  return { result, summary };
}

function encodeMutation(mutator: (document: MutableWorkbook) => void): Uint8Array {
  const codec = new SheetJsWorkbookCodec();
  const document = mutableDocument();
  mutator(document);
  return codec.encode(document as WorkbookNeutralDocument);
}

describe('Phase 5.4C3 recovery safety completion gate', () => {
  it('rejects truncated real XLSX bytes as corrupt/unreadable and preserves live state', async () => {
    const codec = new SheetJsWorkbookCodec();
    const valid = exportBusinessDatasetToXlsx(importDataset(), METADATA, codec);
    const truncated = valid.slice(0, Math.max(1, Math.floor(valid.byteLength / 2)));

    await expectRejectedWithoutStateChange(
      codec,
      truncated,
      'unreadable-or-corrupt-workbook',
      {
        issueCode: 'XLSX_DECODE_FAILED',
        action: 'restore-known-good-backup',
        backupRestoreRecommended: true,
      },
    );
  });

  it('rejects random non-XLSX bytes in a controlled way and preserves live state', async () => {
    const codec = new SheetJsWorkbookCodec();
    const { summary } = await expectRejectedWithoutStateChange(
      codec,
      new Uint8Array([1, 2, 3]),
      'workbook-structure',
      {
        issueCode: 'MISSING_META_SHEET',
        action: 'repair-workbook-structure',
        backupRestoreRecommended: true,
      },
    );

    expect(summary.primaryCategory).not.toBe('invalid-business-data');
  });

  it('rejects a real XLSX missing a required sheet without hydration', async () => {
    const bytes = encodeMutation((document) => {
      document.sheets = document.sheets.filter((candidate) => candidate.name !== 'Products');
    });

    await expectRejectedWithoutStateChange(
      new SheetJsWorkbookCodec(),
      bytes,
      'workbook-structure',
      { issueCode: 'MISSING_REQUIRED_SHEET' },
    );
  });

  it('rejects a real XLSX missing a required header without hydration', async () => {
    const bytes = encodeMutation((document) => {
      const products = sheet(document, 'Products');
      products.columns = products.columns.filter((column) => column !== 'name');
    });

    await expectRejectedWithoutStateChange(
      new SheetJsWorkbookCodec(),
      bytes,
      'workbook-structure',
      { issueCode: 'MISSING_REQUIRED_COLUMN' },
    );
  });

  it('rejects a real XLSX with a duplicate authoritative header without hydration', async () => {
    const bytes = encodeMutation((document) => {
      sheet(document, 'Products').columns.push('name');
    });

    await expectRejectedWithoutStateChange(
      new SheetJsWorkbookCodec(),
      bytes,
      'workbook-structure',
      { issueCode: 'DUPLICATE_COLUMN' },
    );
  });

  it('rejects malformed number and boolean values as invalid workbook values', async () => {
    const bytes = encodeMutation((document) => {
      const materials = sheet(document, 'Materials');
      materials.rows[0].purchaseQuantity = 'not-a-number';
      materials.rows[0].isActive = 'true';
    });

    const { result } = await expectRejectedWithoutStateChange(
      new SheetJsWorkbookCodec(),
      bytes,
      'invalid-workbook-values',
      { issueCode: 'INVALID_CELL_TYPE', action: 'correct-source-data' },
    );

    if (result.status === 'rejected' && result.stage === 'import') {
      expect(result.issues.filter((issue) => issue.code === 'INVALID_CELL_TYPE').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('rejects invalid enum and unit tokens as invalid workbook values', async () => {
    const bytes = encodeMutation((document) => {
      const material = sheet(document, 'Materials').rows[0];
      material.group = 'not-a-material-group';
      material.baseUnit = 'not-a-unit';
    });

    const { result } = await expectRejectedWithoutStateChange(
      new SheetJsWorkbookCodec(),
      bytes,
      'invalid-workbook-values',
      { action: 'correct-source-data' },
    );

    if (result.status === 'rejected' && result.stage === 'import') {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_ENUM_TOKEN' }),
          expect.objectContaining({ code: 'INVALID_UNIT_TOKEN' }),
        ]),
      );
    }
  });

  it('rejects formula cells in authoritative source data without hydration', async () => {
    const document = mutableDocument();
    sheet(document, 'Materials').rows[0].notes = {
      formula: '1+1',
      cachedValue: 'unsafe',
    };

    await expectRejectedWithoutStateChange(
      workbookCodecFor(document as WorkbookNeutralDocument),
      new Uint8Array([10]),
      'invalid-workbook-values',
      { issueCode: 'FORMULA_CELL_NOT_ALLOWED' },
    );
  });

  it('rejects orphan normalized child rows without hydration', async () => {
    const document = mutableDocument();
    sheet(document, 'MixPresetCategories').rows.push({
      mixPresetId: 'missing-mix',
      categoryOrder: 1,
      category: 'candle',
    });

    await expectRejectedWithoutStateChange(
      workbookCodecFor(document as WorkbookNeutralDocument),
      new Uint8Array([11]),
      'invalid-workbook-values',
      { issueCode: 'ORPHAN_CHILD_ROW' },
    );
  });

  it('rejects invalid source references as invalid business data without hydration', async () => {
    const document = mutableDocument();
    sheet(document, 'Products').rows[0].mixPresetId = 'missing-mix';

    await expectRejectedWithoutStateChange(
      workbookCodecFor(document as WorkbookNeutralDocument),
      new Uint8Array([12]),
      'invalid-business-data',
      { issueCode: 'MISSING_REFERENCE', action: 'correct-source-data' },
    );
  });

  it('rejects product composition cycles as invalid business data without hydration', async () => {
    const document = mutableDocument();
    sheet(document, 'ProductComponents').rows.push({
      id: 'component-b-a',
      parentProductId: 'product-b',
      sourceType: 'product',
      sourceId: 'product-a',
      role: 'molded-component',
      quantityPerParent: 1,
      notes: undefined,
    });

    await expectRejectedWithoutStateChange(
      workbookCodecFor(document as WorkbookNeutralDocument),
      new Uint8Array([13]),
      'invalid-business-data',
      { issueCode: 'INVALID_COMPONENT_GRAPH' },
    );
  });

  it('rejects future workbook versions distinctly from corruption and business-data errors', async () => {
    const document = mutableDocument();
    sheet(document, '_Meta').rows[0].workbookFormatVersion = 3;

    const { summary } = await expectRejectedWithoutStateChange(
      workbookCodecFor(document as WorkbookNeutralDocument),
      new Uint8Array([14]),
      'unsupported-or-incompatible-version',
      {
        issueCode: 'UNSUPPORTED_FUTURE_VERSION',
        action: 'open-with-compatible-or-newer-app',
        backupRestoreRecommended: false,
      },
    );

    expect(summary.primaryCategory).not.toBe('unreadable-or-corrupt-workbook');
  });

  it('keeps resource-limit rejection distinct and stops before hydration', async () => {
    const { result, summary } = await expectRejectedWithoutStateChange(
      workbookCodecFor(overLimitDocument()),
      new Uint8Array([15]),
      'resource-limit',
      {
        issueCode: 'WORKSHEET_COUNT_EXCEEDED',
        action: 'reduce-workbook-size',
        backupRestoreRecommended: false,
      },
    );

    if (result.status === 'rejected' && result.stage === 'import') {
      expect(result.issues[0]).toMatchObject({
        stage: 'resource-limit',
        limitKind: 'worksheet-count',
        actual: 33,
        maximum: 32,
      });
    }
    expect(summary.primaryCategory).not.toBe('invalid-business-data');
  });

  it('keeps the current v1/v1 workbook path successful after all Phase 5.4 safety layers', async () => {
    const codec = new SheetJsWorkbookCodec();
    const harness = await createHarness(codec);
    const bytes = exportBusinessDatasetToXlsx(importDataset(), METADATA, codec);

    const result = await harness.coordinator.importAndApplyWorkbook(bytes);

    expect(result.status).toBe('hydrated');
    expect(harness.hydrateSpy).toHaveBeenCalledTimes(1);
    expect(await harness.snapshot.snapshot()).toEqual(importDataset());
  });
});
