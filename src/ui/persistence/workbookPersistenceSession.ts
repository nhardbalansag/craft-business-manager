import type { BrowserWorkbookExportResult } from '../../application/persistence/BrowserWorkbookExportCommand';
import type { PendingBrowserWorkbookSelection } from '../../application/persistence/BrowserWorkbookImportCommand';
import type { PersistenceWorkbookHydrated } from '../../application/persistence/PersistenceCoordinator';
import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from '../../domain/businessDataset';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
} from '../../storage/workbookSchema';

export interface WorkbookPersistenceContractStatus {
  readonly formatId: typeof CRAFT_BUSINESS_WORKBOOK_FORMAT_ID;
  readonly workbookFormatVersion: typeof CURRENT_WORKBOOK_FORMAT_VERSION;
  readonly datasetSchemaVersion: typeof CURRENT_BUSINESS_DATASET_SCHEMA_VERSION;
}

export interface ImportedWorkbookSessionStatus {
  readonly fileName: string;
  readonly byteLength: number;
  readonly importedAt: string;
  readonly metadata: PersistenceWorkbookHydrated['metadata'];
}

export interface ExportedWorkbookSessionStatus {
  readonly fileName: string;
  readonly byteLength: number;
  readonly downloadedAt: string;
  readonly metadata: BrowserWorkbookExportResult['metadata'];
}

export interface WorkbookPersistenceSessionStatus {
  readonly contract: WorkbookPersistenceContractStatus;
  readonly activeImportedWorkbook: ImportedWorkbookSessionStatus | null;
  readonly lastSuccessfulExport: ExportedWorkbookSessionStatus | null;
}

export interface SuccessfulWorkbookImportObservation {
  readonly selection: PendingBrowserWorkbookSelection;
  readonly result: PersistenceWorkbookHydrated;
  readonly observedAt: Date;
}

export interface SuccessfulWorkbookExportObservation {
  readonly result: BrowserWorkbookExportResult;
  readonly observedAt: Date;
}

export const CURRENT_WORKBOOK_PERSISTENCE_CONTRACT: WorkbookPersistenceContractStatus =
  Object.freeze({
    formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
    workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
    datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
  });

function observedIso(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Persistence session status requires a valid observation date.');
  }
  return date.toISOString();
}

function cloneImportMetadata(
  metadata: PersistenceWorkbookHydrated['metadata'],
): PersistenceWorkbookHydrated['metadata'] {
  return Object.freeze({ ...metadata });
}

function cloneExportMetadata(
  metadata: BrowserWorkbookExportResult['metadata'],
): BrowserWorkbookExportResult['metadata'] {
  return Object.freeze({ ...metadata });
}

/**
 * Browser-session persistence status. This is deliberately UI state only: it is not part of the
 * authoritative BusinessDataset or workbook and does not imply a managed native file path.
 */
export function createWorkbookPersistenceSessionStatus(): WorkbookPersistenceSessionStatus {
  return Object.freeze({
    contract: CURRENT_WORKBOOK_PERSISTENCE_CONTRACT,
    activeImportedWorkbook: null,
    lastSuccessfulExport: null,
  });
}

/** Record only a successfully hydrated browser import. Rejections/failures never call this. */
export function recordSuccessfulWorkbookImport(
  current: WorkbookPersistenceSessionStatus,
  observation: SuccessfulWorkbookImportObservation,
): WorkbookPersistenceSessionStatus {
  const activeImportedWorkbook: ImportedWorkbookSessionStatus = Object.freeze({
    fileName: observation.selection.name,
    byteLength: observation.selection.byteLength,
    importedAt: observedIso(observation.observedAt),
    metadata: cloneImportMetadata(observation.result.metadata),
  });

  return Object.freeze({
    contract: current.contract,
    activeImportedWorkbook,
    lastSuccessfulExport: current.lastSuccessfulExport,
  });
}

/**
 * Record only a successfully dispatched browser download. Exporting a copy does not replace the
 * browser-known imported workbook identity.
 */
export function recordSuccessfulWorkbookExport(
  current: WorkbookPersistenceSessionStatus,
  observation: SuccessfulWorkbookExportObservation,
): WorkbookPersistenceSessionStatus {
  const lastSuccessfulExport: ExportedWorkbookSessionStatus = Object.freeze({
    fileName: observation.result.fileName,
    byteLength: observation.result.byteLength,
    downloadedAt: observedIso(observation.observedAt),
    metadata: cloneExportMetadata(observation.result.metadata),
  });

  return Object.freeze({
    contract: current.contract,
    activeImportedWorkbook: current.activeImportedWorkbook,
    lastSuccessfulExport,
  });
}
