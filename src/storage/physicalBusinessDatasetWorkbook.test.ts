import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDataset } from '../domain/businessDataset';
import { extendLegacyBusinessDataset } from '../domain/physicalBusinessDataset';
import { exportBusinessDatasetToXlsx } from './businessDatasetWorkbookExport';
import {
  createPhysicalBusinessDatasetWorkbookDocument,
  exportPhysicalBusinessDatasetToXlsx,
  importPhysicalBusinessDatasetFromXlsx,
} from './physicalBusinessDatasetWorkbook';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';

const codec = new SheetJsWorkbookCodec();
const metadata = { exportedAt: '2026-09-17T03:00:00.000Z', applicationVersion: 'test' };

function byId<T extends { id: string }>(records: readonly T[]): T[] {
  return [...records].sort(
    (a, b) =>
      a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id),
  );
}

describe('physical business workbook v2', () => {
  it('round-trips products, hierarchical storage locations, and molds with canonical row ordering', () => {
    const base = createEmptyBusinessDataset();
    base.products.push({
      id: 'PRD-001',
      name: 'Dinosaur Mold Toy',
      category: 'paintable-art',
      safetyWasteRate: 0.05,
      isActive: true,
    });

    const dataset = extendLegacyBusinessDataset(
      base,
      [
        { id: 'LOC-RACK-A', name: 'Rack A', type: 'rack', isActive: true },
        { id: 'LOC-SHELF-2', name: 'Shelf 2', type: 'shelf', parentId: 'LOC-RACK-A', isActive: true },
        { id: 'LOC-BIN-04', name: 'Bin 04', type: 'bin', parentId: 'LOC-SHELF-2', isActive: true },
      ],
      [
        {
          id: 'MOLD-0012',
          productId: 'PRD-001',
          name: 'Dinosaur Mold #1',
          storageLocationId: 'LOC-BIN-04',
          isActive: true,
        },
      ],
    );

    const bytes = exportPhysicalBusinessDatasetToXlsx(dataset, metadata, codec);
    const imported = importPhysicalBusinessDatasetFromXlsx(bytes, codec);

    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.metadata.workbookFormatVersion).toBe(2);
    expect(imported.metadata.datasetSchemaVersion).toBe(2);
    expect(imported.dataset.products).toEqual(dataset.products);
    expect(imported.dataset.storageLocations).toEqual(byId(dataset.storageLocations));
    expect(imported.dataset.molds).toEqual(byId(dataset.molds));
  });

  it('imports a pre-Preferred-Yield physical v2 workbook without changing existing records', () => {
    const base = createEmptyBusinessDataset();
    base.products.push({
      id: 'PRD-LEGACY',
      name: 'Legacy Dinosaur',
      category: 'paintable-art',
      safetyWasteRate: 0.05,
      notes: 'existing product record',
      isActive: true,
    });

    const dataset = extendLegacyBusinessDataset(
      base,
      [
        { id: 'LOC-RACK-A', name: 'Rack A', type: 'rack', isActive: true },
        { id: 'LOC-SHELF-1', name: 'Shelf 1', type: 'shelf', parentId: 'LOC-RACK-A', isActive: true },
        { id: 'LOC-BIN-01', name: 'Bin 01', type: 'bin', parentId: 'LOC-SHELF-1', isActive: true },
      ],
      [
        {
          id: 'MOLD-0001',
          productId: 'PRD-LEGACY',
          name: 'Legacy Dinosaur Mold',
          storageLocationId: 'LOC-BIN-01',
          notes: 'existing mold record',
          isActive: true,
        },
      ],
    );

    const currentDocument = createPhysicalBusinessDatasetWorkbookDocument(dataset, metadata);
    const legacyDocument = structuredClone(currentDocument) as {
      sheets: Array<{
        name: string;
        columns: string[];
        rows: Array<Record<string, unknown>>;
      }>;
    };
    const products = legacyDocument.sheets.find((sheet) => sheet.name === 'Products')!;
    products.columns = products.columns.filter((column) => column !== 'preferredYieldSampleId');
    products.rows = products.rows.map((row) => {
      const { preferredYieldSampleId: _preferredYieldSampleId, ...legacyRow } = row;
      return legacyRow;
    });

    const imported = importPhysicalBusinessDatasetFromXlsx(codec.encode(legacyDocument), codec);

    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.dataset.products).toEqual(dataset.products);
    expect(imported.dataset.products[0].preferredYieldSampleId).toBeUndefined();
    expect(imported.dataset.storageLocations).toEqual(byId(dataset.storageLocations));
    expect(imported.dataset.molds).toEqual(byId(dataset.molds));
  });

  it('promotes a valid v1 workbook with empty physical collections', () => {
    const legacy = createEmptyBusinessDataset();
    const v1Bytes = exportBusinessDatasetToXlsx(legacy, metadata, codec);

    const imported = importPhysicalBusinessDatasetFromXlsx(v1Bytes, codec);

    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.metadata.workbookFormatVersion).toBe(2);
    expect(imported.dataset.schemaVersion).toBe(2);
    expect(imported.dataset.storageLocations).toEqual([]);
    expect(imported.dataset.molds).toEqual([]);
  });

  it('rejects missing product and storage references before export', () => {
    const dataset = extendLegacyBusinessDataset(
      createEmptyBusinessDataset(),
      [],
      [
        {
          id: 'MOLD-404',
          productId: 'PRD-MISSING',
          name: 'Unresolved mold',
          storageLocationId: 'LOC-MISSING',
          isActive: true,
        },
      ],
    );

    expect(() => exportPhysicalBusinessDatasetToXlsx(dataset, metadata, codec)).toThrow(
      /validation issue/i,
    );
  });
});
