import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyBusinessDataset,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
} from '../../domain/businessDataset';
import type { BusinessDataset } from '../../domain/types';
import { createBusinessDatasetWorkbookDocument } from '../../storage/businessDatasetWorkbookExport';
import { SafeInMemoryWorkbookTransport } from '../../storage/SafeInMemoryWorkbookTransport';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import {
  CURRENT_WORKBOOK_FORMAT_VERSION,
  type WorkbookNeutralDocument,
} from '../../storage/workbookSchema';
import { WorkbookTransportSaveError } from '../../storage/WorkbookTransport';
import {
  completeSourceSnapshotService,
  materialService,
  persistenceCoordinator,
  validatedAtomicDatasetHydrationService,
} from '../session';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import { PersistenceLifecycleOperationalError } from './PersistenceLifecycle';

const METADATA = {
  exportedAt: '2026-09-17T03:30:00.000Z',
  applicationVersion: '5.6a3-completion',
} as const;

interface MutableSheet {
  name: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

interface MutableWorkbook {
  sheets: MutableSheet[];
}

function liveDataset(): BusinessDataset {
  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [
      {
        id: 'live-material',
        name: 'Live Casting Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 88,
        onHandQuantity: 2,
        onHandUnit: 'kg',
        notes: 'Authoritative state that must survive rejected imports.',
        isActive: true,
      },
    ],
    materialCalibrations: [],
    mixPresets: [],
    products: [
      {
        id: 'live-product',
        name: 'Live Paintable Figure',
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

function candidateDataset(): BusinessDataset {
  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [
      {
        id: 'candidate-material',
        name: 'Candidate Soy Wax',
        group: 'wax',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 190,
        onHandQuantity: 3,
        onHandUnit: 'kg',
        isActive: true,
      },
    ],
    materialCalibrations: [],
    mixPresets: [],
    products: [
      {
        id: 'candidate-product',
        name: 'Candidate Candle',
        category: 'candle',
        safetyWasteRate: 0.05,
        isActive: true,
      },
    ],
    yieldSamples: [],
    recipeItems: [],
    productComponents: [],
    productStocks: [],
    productFinancialProfiles: [],
  };
}

function mutableCandidateDocument(): MutableWorkbook {
  return structuredClone(
    createBusinessDatasetWorkbookDocument(candidateDataset(), METADATA),
  ) as MutableWorkbook;
}

function sheet(document: MutableWorkbook, name: string): MutableSheet {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing test sheet ${name}.`);
  return found;
}

function encodeMutation(mutator: (document: MutableWorkbook) => void): Uint8Array {
  const document = mutableCandidateDocument();
  mutator(document);
  return new SheetJsWorkbookCodec().encode(document as WorkbookNeutralDocument);
}

async function hydrate(dataset: BusinessDataset): Promise<void> {
  const result = await validatedAtomicDatasetHydrationService.hydrate(dataset);
  expect(result).toEqual({ status: 'hydrated' });
}

async function expectImportRejectionPreservesState(
  bytes: Uint8Array,
  issueCode: string,
) {
  await hydrate(liveDataset());
  const before = await completeSourceSnapshotService.snapshot();

  const result = await persistenceCoordinator.importAndApplyWorkbook(bytes);

  expect(result).toMatchObject({ status: 'rejected', stage: 'import' });
  if (result.status !== 'rejected' || result.stage !== 'import') {
    throw new Error('Expected an import-stage rejection.');
  }

  expect(result.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: issueCode })]),
  );
  expect(await completeSourceSnapshotService.snapshot()).toEqual(before);

  // Prove the already-wired application graph remains usable after the rejected import.
  await expect(materialService.getMaterial('live-material')).resolves.toEqual(
    expect.objectContaining({
      id: 'live-material',
      name: 'Live Casting Plaster',
      packageCost: 88,
    }),
  );

  return result;
}

beforeEach(async () => {
  await hydrate(createEmptyBusinessDataset());
});

afterEach(async () => {
  await hydrate(createEmptyBusinessDataset());
});

describe('Phase 5.6A3 rejection, safe-save, and 5.6A completion integration gate', () => {
  it('Scenario G: rejects invalid business references through real XLSX bytes and preserves live source state', async () => {
    const bytes = encodeMutation((document) => {
      sheet(document, 'Products').rows[0].mixPresetId = 'missing-mix-preset';
    });

    await expectImportRejectionPreservesState(bytes, 'MISSING_REFERENCE');
  });

  it('Scenario G: rejects invalid canonical workbook structure through real XLSX bytes and preserves live source state', async () => {
    const bytes = encodeMutation((document) => {
      document.sheets = document.sheets.filter((candidate) => candidate.name !== 'Products');
    });

    await expectImportRejectionPreservesState(bytes, 'MISSING_REQUIRED_SHEET');
  });

  it('Scenario G: rejects invalid row values through real XLSX bytes and preserves live source state', async () => {
    const bytes = encodeMutation((document) => {
      sheet(document, 'Materials').rows[0].purchaseQuantity = 'not-a-number';
    });

    await expectImportRejectionPreservesState(bytes, 'INVALID_CELL_TYPE');
  });

  it('Scenario H: rejects unsupported future workbook/dataset versions before hydration with received and expected version context', async () => {
    const bytes = encodeMutation((document) => {
      const meta = sheet(document, '_Meta').rows[0];
      meta.workbookFormatVersion = CURRENT_WORKBOOK_FORMAT_VERSION + 1;
      meta.datasetSchemaVersion = CURRENT_BUSINESS_DATASET_SCHEMA_VERSION + 1;
    });

    const result = await expectImportRejectionPreservesState(bytes, 'UNSUPPORTED_FUTURE_VERSION');

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'compatibility',
          code: 'UNSUPPORTED_FUTURE_VERSION',
          compatibilityStatus: 'unsupported-future',
          sourceVersion: {
            workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION + 1,
            datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION + 1,
          },
          targetVersion: {
            workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
            datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
          },
        }),
      ]),
    );
  });

  it('Scenario J: preserves prior primary bytes and exact transport failure truth for backup, stage, and commit faults', async () => {
    await hydrate(liveDataset());
    const priorPrimary = new Uint8Array([9, 8, 7, 6]);

    const cases = [
      { stage: 'backup' as const, code: 'BACKUP_FAILED' as const, backupCreated: false },
      { stage: 'stage' as const, code: 'STAGE_FAILED' as const, backupCreated: true },
      { stage: 'commit' as const, code: 'COMMIT_FAILED' as const, backupCreated: true },
    ];

    for (const scenario of cases) {
      const snapshot = vi.fn(() => completeSourceSnapshotService.snapshot());
      const coordinator = new PersistenceCoordinator(
        { snapshot },
        validatedAtomicDatasetHydrationService,
        new SheetJsWorkbookCodec(),
        { clock: () => new Date('2026-09-17T03:35:00.000Z') },
      );
      const fault = new Error(`synthetic ${scenario.stage} failure`);
      const transport = new SafeInMemoryWorkbookTransport(priorPrimary, {
        clock: () => new Date('2026-09-17T03:36:00.000Z'),
        faultInjector: (stage) => {
          if (stage === scenario.stage) throw fault;
        },
      });

      let caught: unknown;
      try {
        await coordinator.saveCurrentWorkbook(transport, { backup: 'required' });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(PersistenceLifecycleOperationalError);
      expect(caught).toMatchObject({
        stage: 'transport-save',
        code: 'TRANSPORT_SAVE_FAILED',
      });

      const transportError = (caught as PersistenceLifecycleOperationalError).causeValue;
      expect(transportError).toBeInstanceOf(WorkbookTransportSaveError);
      expect(transportError).toMatchObject({
        stage: scenario.stage,
        code: scenario.code,
        commitState: 'not-committed',
        causeValue: fault,
      });

      // The coordinator must not manufacture a successful receipt or retry export as rollback.
      expect(snapshot).toHaveBeenCalledTimes(1);

      // Pre-commit faults retain the old primary as the recoverable authoritative workbook.
      await expect(transport.loadWorkbook()).resolves.toEqual(priorPrimary);
      expect(transport.peekStagedWorkbook()).toBeUndefined();

      const backupReferences = transport.listBackupReferences();
      if (scenario.backupCreated) {
        expect(backupReferences).toHaveLength(1);
        await expect(transport.loadBackup(backupReferences[0])).resolves.toEqual(priorPrimary);
      } else {
        expect(backupReferences).toEqual([]);
      }

      expect(transport.capabilities).toEqual({
        backup: 'supported',
        stagedReplacement: true,
        replacement: 'atomic',
      });
    }
  });
});
