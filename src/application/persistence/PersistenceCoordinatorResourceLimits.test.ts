import { describe, expect, it, vi } from 'vitest';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import type { WorkbookCodec } from '../../storage/workbookCodec';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendLegacyBusinessDataset } from '../../domain/physicalBusinessDataset';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../../domain/physicalBusinessDatasetV5';
import { createBusinessDatasetWorkbookDocument } from '../../storage/businessDatasetWorkbookExport';
import { createBusinessDatasetV2WorkbookDocument } from '../../storage/businessDatasetV2Workbook';
import { createPhysicalBusinessDatasetWorkbookDocument } from '../../storage/physicalBusinessDatasetWorkbook';
import { createPhysicalBusinessDatasetV3WorkbookDocument } from '../../storage/physicalBusinessDatasetV3Workbook';
import { createPhysicalBusinessDatasetV4WorkbookDocument } from '../../storage/physicalBusinessDatasetV4Workbook';
import { createPhysicalBusinessDatasetV5WorkbookDocument } from '../../storage/physicalBusinessDatasetV5Workbook';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import {
  WorkbookResourceLimitError,
  createWorkbookResourceLimitIssue,
} from '../../storage/workbookResourceLimits';

describe('PersistenceCoordinator resource-limit safety', () => {
  const metadata = { exportedAt: '2026-10-30T00:00:00.000Z' };
  const core = createEmptyBusinessDataset();
  const tiered = createEmptyBusinessDatasetV2();
  const physicalV3 = extendBusinessDatasetV2(tiered);
  const physicalV4 = extendPhysicalBusinessDatasetV3(physicalV3);
  const currentPhysical = { physicalIdentification: true, tieredPricing: true,
    plasterMoldYieldProfiles: true, yieldMoldFormulaSources: true };
  const paths = [
    { name: 'legacy core', options: {}, document: createBusinessDatasetWorkbookDocument(core, metadata) },
    { name: 'legacy physical', options: { physicalIdentification: true },
      document: createPhysicalBusinessDatasetWorkbookDocument(extendLegacyBusinessDataset(core), metadata) },
    { name: 'tiered core', options: { tieredPricing: true },
      document: createBusinessDatasetV2WorkbookDocument(tiered, metadata) },
    { name: 'tiered physical', options: { physicalIdentification: true, tieredPricing: true },
      document: createPhysicalBusinessDatasetV3WorkbookDocument(physicalV3, metadata) },
    { name: 'profile physical', options: { physicalIdentification: true, tieredPricing: true, plasterMoldYieldProfiles: true },
      document: createPhysicalBusinessDatasetV4WorkbookDocument(physicalV4, metadata) },
    { name: 'provenance physical', options: currentPhysical,
      document: createPhysicalBusinessDatasetV5WorkbookDocument(extendPhysicalBusinessDatasetV4(physicalV4), metadata) },
    { name: 'core fallback in current physical session', options: currentPhysical,
      document: createBusinessDatasetV2WorkbookDocument(tiered, metadata) },
  ];

  it.each(paths)('honors live size increases and decreases for $name', async ({ options, document }) => {
    let maximum = 48 * 1024 * 1024;
    const bytes = new Uint8Array(54_594_185);
    const realCodec = new SheetJsWorkbookCodec();
    const decode = vi.fn((input: Parameters<WorkbookCodec['decode']>[0]) =>
      input.byteLength === bytes.byteLength ? document : realCodec.decode(input));
    const hydrate = vi.fn(async () => ({ status: 'hydrated' as const }));
    const coordinator = new PersistenceCoordinator({ snapshot: vi.fn() }, { hydrate }, {
      encode: (input) => realCodec.encode(input), decode,
    }, { ...options, maxWorkbookBytes: () => maximum });

    expect(await coordinator.importAndApplyWorkbook(bytes)).toMatchObject({
      status: 'rejected', stage: 'import', issues: [{
        code: 'WORKBOOK_BYTES_EXCEEDED', actual: 54_594_185, maximum,
      }],
    });
    expect(decode).not.toHaveBeenCalled();
    expect(hydrate).not.toHaveBeenCalled();

    maximum = 64 * 1024 * 1024;
    expect(await coordinator.importAndApplyWorkbook(bytes)).toMatchObject({ status: 'hydrated' });
    expect(hydrate).toHaveBeenCalledOnce();
    decode.mockClear();

    maximum = 48 * 1024 * 1024;
    expect(await coordinator.importAndApplyWorkbook(bytes)).toMatchObject({ status: 'rejected' });
    expect(decode).not.toHaveBeenCalled();
    expect(hydrate).toHaveBeenCalledOnce();
  });

  it('accepts the reported workbook size with defaults and still validates the document', async () => {
    const hydrate = vi.fn(async () => ({ status: 'hydrated' as const }));
    const decode = vi.fn(() => createBusinessDatasetWorkbookDocument(core, metadata));
    const coordinator = new PersistenceCoordinator({ snapshot: vi.fn() }, { hydrate }, {
      encode: () => new Uint8Array(), decode,
    });
    expect(await coordinator.importAndApplyWorkbook(new Uint8Array(54_594_185)))
      .toMatchObject({ status: 'hydrated' });
    expect(hydrate).toHaveBeenCalledOnce();
    decode.mockReturnValue({ sheets: [] });
    expect(await coordinator.importAndApplyWorkbook(new Uint8Array([1])))
      .toMatchObject({ status: 'rejected', stage: 'import' });
    expect(hydrate).toHaveBeenCalledOnce();
  });

  it('uses the exact configured boundary with the real XLSX codec', async () => {
    const codec = new SheetJsWorkbookCodec();
    const bytes = codec.encode(createBusinessDatasetWorkbookDocument(core, metadata));
    const hydrate = vi.fn(async () => ({ status: 'hydrated' as const }));
    let maximum = bytes.byteLength - 1;
    const coordinator = new PersistenceCoordinator({ snapshot: vi.fn() }, { hydrate }, codec,
      { maxWorkbookBytes: () => maximum });
    expect(await coordinator.importAndApplyWorkbook(bytes)).toMatchObject({ status: 'rejected' });
    expect(hydrate).not.toHaveBeenCalled();
    maximum = bytes.byteLength;
    expect(await coordinator.importAndApplyWorkbook(bytes)).toMatchObject({ status: 'hydrated' });
  });

  it('returns a controlled import rejection and never calls hydration after an early codec range limit', async () => {
    const snapshot = vi.fn();
    const hydrate = vi.fn();
    const codec: WorkbookCodec = {
      encode: () => new Uint8Array(),
      decode: () => {
        throw new WorkbookResourceLimitError(
          createWorkbookResourceLimitIssue('sheet-rows', 50_001, 50_000, 'Materials'),
        );
      },
    };
    const coordinator = new PersistenceCoordinator({ snapshot }, { hydrate }, codec);

    const result = await coordinator.importAndApplyWorkbook(new Uint8Array([1, 2, 3]));

    expect(result).toEqual({
      status: 'rejected',
      stage: 'import',
      issues: [
        expect.objectContaining({
          stage: 'resource-limit',
          code: 'SHEET_ROWS_EXCEEDED',
          sheetName: 'Materials',
          actual: 50_001,
          maximum: 50_000,
        }),
      ],
    });
    expect(hydrate).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
  });
});
