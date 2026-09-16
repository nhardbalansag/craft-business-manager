// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XLSX_WORKBOOK_MIME_TYPE, type BrowserWorkbookExportResult } from '../../application/persistence/BrowserWorkbookExportCommand';
import type { PersistenceWorkbookHydrated } from '../../application/persistence/PersistenceCoordinator';
import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from '../../domain/businessDataset';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
} from '../../storage/workbookSchema';
import { WorkbookPersistenceStatusPanel } from './WorkbookPersistenceStatusPanel';
import {
  createWorkbookPersistenceSessionStatus,
  recordSuccessfulWorkbookExport,
  recordSuccessfulWorkbookImport,
} from './workbookPersistenceSession';

const hydrated: PersistenceWorkbookHydrated = {
  status: 'hydrated',
  metadata: {
    formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
    workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
    datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    exportedAt: '2026-09-17T00:15:00.000Z',
  },
};

const exported: BrowserWorkbookExportResult = {
  status: 'download-dispatched',
  fileName: 'craft-business-manager-2026-09-17-020000.xlsx',
  byteLength: 2_048,
  mimeType: XLSX_WORKBOOK_MIME_TYPE,
  metadata: { exportedAt: '2026-09-17T02:00:00.000Z' },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(status = createWorkbookPersistenceSessionStatus()) {
  await act(async () => root.render(<WorkbookPersistenceStatusPanel status={status} />));
}

describe('WorkbookPersistenceStatusPanel Phase 5.5C1', () => {
  it('shows the current supported contract and truthful empty session state', async () => {
    await render();

    const text = container.textContent ?? '';
    expect(text).toContain(CRAFT_BUSINESS_WORKBOOK_FORMAT_ID);
    expect(text).toContain(`Workbook v${CURRENT_WORKBOOK_FORMAT_VERSION}`);
    expect(text).toContain(`Dataset schema v${CURRENT_BUSINESS_DATASET_SCHEMA_VERSION}`);
    expect(text).toContain('No imported workbook identity is known in this browser session.');
    expect(text).toContain('No workbook copy has been downloaded successfully in this browser session.');
  });

  it('shows browser-known imported identity and keeps workbook metadata time distinct from observed import time', async () => {
    const status = recordSuccessfulWorkbookImport(createWorkbookPersistenceSessionStatus(), {
      selection: { name: 'my-craft-data.xlsx', byteLength: 1_536 },
      result: hydrated,
      observedAt: new Date('2026-09-17T01:30:00.000Z'),
    });

    await render(status);

    const text = container.textContent ?? '';
    expect(text).toContain('my-craft-data.xlsx');
    expect(text).toContain('1.5 KB');
    expect(text).toContain('Imported into this session 2026-09-17 01:30:00 UTC');
    expect(text).toContain('Workbook metadata exported 2026-09-17 00:15:00 UTC');
    expect(text).toContain('identity labels, not managed filesystem paths');
    expect(text).toContain('does not claim dirty/clean');
  });

  it('shows a downloaded copy separately without replacing the imported workbook identity', async () => {
    const imported = recordSuccessfulWorkbookImport(createWorkbookPersistenceSessionStatus(), {
      selection: { name: 'active-import.xlsx', byteLength: 1_024 },
      result: hydrated,
      observedAt: new Date('2026-09-17T01:30:00.000Z'),
    });
    const status = recordSuccessfulWorkbookExport(imported, {
      result: exported,
      observedAt: new Date('2026-09-17T02:05:00.000Z'),
    });

    await render(status);

    const text = container.textContent ?? '';
    expect(text).toContain('active-import.xlsx');
    expect(text).toContain(exported.fileName);
    expect(text).toContain('2.0 KB');
    expect(text).toContain('Download dispatched 2026-09-17 02:05:00 UTC');
    expect(text).toContain('Downloading a copy does not overwrite the imported workbook');
  });
});
