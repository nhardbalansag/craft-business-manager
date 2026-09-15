import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from '../domain/businessDataset';
import {
  validateBusinessDatasetIntegrity,
  type BusinessDatasetValidationIssue,
} from '../domain/businessDatasetValidation';
import type {
  BusinessDataset,
  FixedRecipeItem,
  Material,
  MaterialCalibrationEvidence,
  MixPreset,
  Product,
  ProductComponent,
  ProductFinancialProfile,
  ProductStock,
  YieldSample,
} from '../domain/types';
import {
  WorkbookCodecError,
  type WorkbookBinaryInput,
  type WorkbookCodec,
} from './workbookCodec';
import {
  CANONICAL_WORKBOOK_SHEET_NAMES,
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
  getPrimaryWorkbookSheetForSourceCollection,
  validateWorkbookSchema,
  type WorkbookNeutralDocument,
  type WorkbookNeutralSheet,
  type WorkbookSchemaIssue,
} from './workbookSchema';

export interface ImportedWorkbookMetadata {
  formatId: string;
  workbookFormatVersion: number;
  datasetSchemaVersion: number;
  exportedAt: string;
  applicationVersion?: string;
}

export type BusinessDatasetWorkbookImportIssueStage =
  | 'codec'
  | 'schema'
  | 'metadata'
  | 'reconstruction'
  | 'dataset';

export interface BusinessDatasetWorkbookImportIssue {
  stage: BusinessDatasetWorkbookImportIssueStage;
  code: string;
  message: string;
  sheetName?: string;
  rowIndex?: number;
  excelRow?: number;
  column?: string;
  path?: string;
  input?: unknown;
}

export type BusinessDatasetWorkbookImportResult =
  | {
      ok: true;
      dataset: BusinessDataset;
      metadata: ImportedWorkbookMetadata;
    }
  | {
      ok: false;
      issues: readonly BusinessDatasetWorkbookImportIssue[];
    };

type ChildEntry = {
  row: Readonly<Record<string, unknown>>;
  rowIndex: number;
  order: number;
};

const STAGE_ORDER: Readonly<Record<BusinessDatasetWorkbookImportIssueStage, number>> = {
  codec: 0,
  schema: 1,
  metadata: 2,
  reconstruction: 3,
  dataset: 4,
};

const SHEET_ORDER = new Map<string, number>(
  CANONICAL_WORKBOOK_SHEET_NAMES.map((name, index) => [name, index]),
);

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function excelRow(rowIndex: number | undefined): number | undefined {
  return rowIndex === undefined ? undefined : rowIndex + 2;
}

function sortIssues(
  issues: readonly BusinessDatasetWorkbookImportIssue[],
): BusinessDatasetWorkbookImportIssue[] {
  return [...issues].sort((left, right) => {
    const stage = STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage];
    if (stage !== 0) return stage;

    const leftSheet = left.sheetName === undefined ? Number.MAX_SAFE_INTEGER : (SHEET_ORDER.get(left.sheetName) ?? Number.MAX_SAFE_INTEGER);
    const rightSheet = right.sheetName === undefined ? Number.MAX_SAFE_INTEGER : (SHEET_ORDER.get(right.sheetName) ?? Number.MAX_SAFE_INTEGER);
    if (leftSheet !== rightSheet) return leftSheet - rightSheet;

    const leftRow = left.rowIndex ?? Number.MAX_SAFE_INTEGER;
    const rightRow = right.rowIndex ?? Number.MAX_SAFE_INTEGER;
    if (leftRow !== rightRow) return leftRow - rightRow;

    const leftLocation = left.column ?? left.path ?? '';
    const rightLocation = right.column ?? right.path ?? '';
    const location = leftLocation.localeCompare(rightLocation);
    if (location !== 0) return location;

    const code = left.code.localeCompare(right.code);
    if (code !== 0) return code;
    return left.message.localeCompare(right.message);
  });
}

function failure(
  issues: readonly BusinessDatasetWorkbookImportIssue[],
): BusinessDatasetWorkbookImportResult {
  return { ok: false, issues: sortIssues(issues) };
}

function sheet(document: WorkbookNeutralDocument, name: string): WorkbookNeutralSheet {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Validated workbook is missing canonical sheet ${name}.`);
  }
  return found;
}

function text(row: Readonly<Record<string, unknown>>, key: string): string {
  return row[key] as string;
}

function numberValue(row: Readonly<Record<string, unknown>>, key: string): number {
  return row[key] as number;
}

function booleanValue(row: Readonly<Record<string, unknown>>, key: string): boolean {
  return row[key] as boolean;
}

function optionalText(
  row: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value;
}

function schemaIssues(
  issues: readonly WorkbookSchemaIssue[],
): BusinessDatasetWorkbookImportIssue[] {
  return issues.map((issue) => ({
    stage: 'schema',
    code: issue.code,
    message: issue.message,
    sheetName: issue.sheetName,
    rowIndex: issue.rowIndex,
    excelRow: excelRow(issue.rowIndex),
    column: issue.column,
    input: issue.input,
  }));
}

function datasetIssues(
  issues: readonly BusinessDatasetValidationIssue[],
): BusinessDatasetWorkbookImportIssue[] {
  return issues.map((issue) => ({
    stage: 'dataset',
    code: issue.code,
    message: issue.message,
    sheetName: issue.collection
      ? getPrimaryWorkbookSheetForSourceCollection(issue.collection)
      : undefined,
    rowIndex: issue.index,
    excelRow: excelRow(issue.index),
    column: issue.field,
    path: issue.path,
  }));
}

function readMetadata(
  document: WorkbookNeutralDocument,
): { metadata?: ImportedWorkbookMetadata; issues: BusinessDatasetWorkbookImportIssue[] } {
  const row = sheet(document, '_Meta').rows[0];
  const exportedAt = text(row, 'exportedAt');
  const issues: BusinessDatasetWorkbookImportIssue[] = [];

  if (!exportedAt.trim() || !Number.isFinite(Date.parse(exportedAt))) {
    issues.push({
      stage: 'metadata',
      code: 'INVALID_EXPORTED_AT',
      message: 'Workbook exportedAt must be nonblank ISO-compatible date/time text.',
      sheetName: '_Meta',
      rowIndex: 0,
      excelRow: 2,
      column: 'exportedAt',
      input: exportedAt,
    });
  }

  const applicationVersion = optionalText(row, 'applicationVersion');

  if (issues.length > 0) return { issues };

  return {
    issues,
    metadata: {
      formatId: text(row, 'formatId'),
      workbookFormatVersion: numberValue(row, 'workbookFormatVersion'),
      datasetSchemaVersion: numberValue(row, 'datasetSchemaVersion'),
      exportedAt,
      applicationVersion,
    },
  };
}

function reconstructMaterialSource(
  row: Readonly<Record<string, unknown>>,
): Material['source'] {
  const source: NonNullable<Material['source']> = {};
  const vendorName = optionalText(row, 'sourceVendorName');
  const sourceDetail = optionalText(row, 'sourceDetail');
  const purchaseLink = optionalText(row, 'sourcePurchaseLink');
  const contactNumber = optionalText(row, 'sourceContactNumber');
  const socialPage = optionalText(row, 'sourceSocialPage');
  const notes = optionalText(row, 'sourceNotes');

  if (vendorName !== undefined) source.vendorName = vendorName;
  if (sourceDetail !== undefined) source.source = sourceDetail;
  if (purchaseLink !== undefined) source.purchaseLink = purchaseLink;
  if (contactNumber !== undefined) source.contactNumber = contactNumber;
  if (socialPage !== undefined) source.socialPage = socialPage;
  if (notes !== undefined) source.notes = notes;

  return Object.keys(source).length > 0 ? source : undefined;
}

function reconstructMaterials(document: WorkbookNeutralDocument): Material[] {
  return sheet(document, 'Materials').rows.map((row) => {
    const material: Material = {
      id: text(row, 'id'),
      name: text(row, 'name'),
      group: text(row, 'group') as Material['group'],
      baseUnit: text(row, 'baseUnit') as Material['baseUnit'],
      purchaseQuantity: numberValue(row, 'purchaseQuantity'),
      purchaseUnit: text(row, 'purchaseUnit') as Material['purchaseUnit'],
      packageCost: numberValue(row, 'packageCost'),
      onHandQuantity: numberValue(row, 'onHandQuantity'),
      onHandUnit: text(row, 'onHandUnit') as Material['onHandUnit'],
      isActive: booleanValue(row, 'isActive'),
    };

    const manualConversion = row.manualBaseUnitsPerPurchaseUnit;
    if (typeof manualConversion === 'number') {
      material.manualBaseUnitsPerPurchaseUnit = manualConversion;
    }
    const source = reconstructMaterialSource(row);
    if (source !== undefined) material.source = source;
    const notes = optionalText(row, 'notes');
    if (notes !== undefined) material.notes = notes;
    return material;
  });
}

function reconstructCalibrations(
  document: WorkbookNeutralDocument,
): MaterialCalibrationEvidence[] {
  return sheet(document, 'Calibrations').rows.map((row) => {
    const evidence: MaterialCalibrationEvidence = {
      id: text(row, 'id'),
      materialId: text(row, 'materialId'),
      measuredVolume: numberValue(row, 'measuredVolume'),
      volumeUnit: text(row, 'volumeUnit') as MaterialCalibrationEvidence['volumeUnit'],
      knownWeight: numberValue(row, 'knownWeight'),
      weightUnit: text(row, 'weightUnit') as MaterialCalibrationEvidence['weightUnit'],
      recordedAt: text(row, 'recordedAt'),
    };
    const notes = optionalText(row, 'notes');
    if (notes !== undefined) evidence.notes = notes;
    return evidence;
  });
}

function reconstructMixPresets(document: WorkbookNeutralDocument): MixPreset[] {
  return sheet(document, 'MixPresets').rows.map((row) => {
    const preset: MixPreset = {
      id: text(row, 'id'),
      name: text(row, 'name'),
      compatibleCategories: [],
      basis: text(row, 'basis') as MixPreset['basis'],
      lines: [],
      isActive: booleanValue(row, 'isActive'),
    };
    const notes = optionalText(row, 'notes');
    if (notes !== undefined) preset.notes = notes;
    return preset;
  });
}

function reconstructProducts(document: WorkbookNeutralDocument): Product[] {
  return sheet(document, 'Products').rows.map((row) => {
    const product: Product = {
      id: text(row, 'id'),
      name: text(row, 'name'),
      category: text(row, 'category') as Product['category'],
      safetyWasteRate: numberValue(row, 'safetyWasteRate'),
      isActive: booleanValue(row, 'isActive'),
    };
    const mixPresetId = optionalText(row, 'mixPresetId');
    if (mixPresetId !== undefined) product.mixPresetId = mixPresetId;
    const notes = optionalText(row, 'notes');
    if (notes !== undefined) product.notes = notes;
    return product;
  });
}

function reconstructYieldSamples(document: WorkbookNeutralDocument): YieldSample[] {
  return sheet(document, 'YieldSamples').rows.map((row) => {
    const sample: YieldSample = {
      id: text(row, 'id'),
      productId: text(row, 'productId'),
      materialInputs: [],
      goodPieces: numberValue(row, 'goodPieces'),
      rejectedPieces: numberValue(row, 'rejectedPieces'),
      recordedAt: text(row, 'recordedAt'),
    };
    const mixPresetId = optionalText(row, 'mixPresetId');
    if (mixPresetId !== undefined) sample.mixPresetId = mixPresetId;
    const notes = optionalText(row, 'notes');
    if (notes !== undefined) sample.notes = notes;
    return sample;
  });
}

function reconstructRecipeItems(document: WorkbookNeutralDocument): FixedRecipeItem[] {
  return sheet(document, 'RecipeItems').rows.map((row) => {
    const item: FixedRecipeItem = {
      id: text(row, 'id'),
      productId: text(row, 'productId'),
      materialId: text(row, 'materialId'),
      quantityPerProduct: numberValue(row, 'quantityPerProduct'),
      unit: text(row, 'unit') as FixedRecipeItem['unit'],
      role: text(row, 'role') as FixedRecipeItem['role'],
    };
    const notes = optionalText(row, 'notes');
    if (notes !== undefined) item.notes = notes;
    return item;
  });
}

function reconstructProductComponents(
  document: WorkbookNeutralDocument,
): ProductComponent[] {
  return sheet(document, 'ProductComponents').rows.map((row) => {
    const component: ProductComponent = {
      id: text(row, 'id'),
      parentProductId: text(row, 'parentProductId'),
      sourceType: text(row, 'sourceType') as ProductComponent['sourceType'],
      sourceId: text(row, 'sourceId'),
      role: text(row, 'role') as ProductComponent['role'],
      quantityPerParent: numberValue(row, 'quantityPerParent'),
    };
    const notes = optionalText(row, 'notes');
    if (notes !== undefined) component.notes = notes;
    return component;
  });
}

function reconstructProductStocks(document: WorkbookNeutralDocument): ProductStock[] {
  return sheet(document, 'ProductStocks').rows.map((row) => {
    const stock: ProductStock = {
      productId: text(row, 'productId'),
      onHandQuantity: numberValue(row, 'onHandQuantity'),
    };
    const notes = optionalText(row, 'notes');
    if (notes !== undefined) stock.notes = notes;
    return stock;
  });
}

function reconstructFinancialProfiles(
  document: WorkbookNeutralDocument,
): ProductFinancialProfile[] {
  return sheet(document, 'ProductFinancialProfiles').rows.map((row) => {
    const method = optionalText(row, 'pricingMethod');
    const value = row.pricingValue;
    const profile: ProductFinancialProfile = {
      productId: text(row, 'productId'),
      laborCostPerUnit: numberValue(row, 'laborCostPerUnit'),
      overheadCostPerUnit: numberValue(row, 'overheadCostPerUnit'),
      pricingPolicy:
        method === undefined
          ? null
          : {
              method: method as NonNullable<ProductFinancialProfile['pricingPolicy']>['method'],
              value: value as number,
            },
    };
    const notes = optionalText(row, 'notes');
    if (notes !== undefined) profile.notes = notes;
    return profile;
  });
}

function indexParents<T extends { id: string }>(parents: readonly T[]): Map<string, T> {
  const indexed = new Map<string, T>();
  for (const parent of parents) {
    const key = canonical(parent.id);
    if (!indexed.has(key)) indexed.set(key, parent);
  }
  return indexed;
}

function collectChildGroups(
  childSheet: WorkbookNeutralSheet,
  parentIds: ReadonlySet<string>,
  foreignKeyColumn: string,
  orderColumn: string,
  issues: BusinessDatasetWorkbookImportIssue[],
): Map<string, ChildEntry[]> {
  const groups = new Map<string, ChildEntry[]>();

  childSheet.rows.forEach((row, rowIndex) => {
    const parentId = text(row, foreignKeyColumn);
    const key = canonical(parentId);
    if (!parentIds.has(key)) {
      issues.push({
        stage: 'reconstruction',
        code: 'ORPHAN_CHILD_ROW',
        message: `${childSheet.name} row references missing parent ${parentId}.`,
        sheetName: childSheet.name,
        rowIndex,
        excelRow: excelRow(rowIndex),
        column: foreignKeyColumn,
        input: parentId,
      });
      return;
    }

    const entries = groups.get(key) ?? [];
    entries.push({ row, rowIndex, order: numberValue(row, orderColumn) });
    groups.set(key, entries);
  });

  for (const [parentKey, entries] of groups) {
    const sorted = [...entries].sort((left, right) => left.order - right.order || left.rowIndex - right.rowIndex);
    const firstByOrder = new Map<number, ChildEntry>();
    let duplicateFound = false;

    for (const entry of sorted) {
      const first = firstByOrder.get(entry.order);
      if (first) {
        duplicateFound = true;
        issues.push({
          stage: 'reconstruction',
          code: 'DUPLICATE_CHILD_ORDER',
          message: `${childSheet.name} contains duplicate ${orderColumn} ${entry.order} for parent ${parentKey}.`,
          sheetName: childSheet.name,
          rowIndex: entry.rowIndex,
          excelRow: excelRow(entry.rowIndex),
          column: orderColumn,
          input: entry.order,
        });
      } else {
        firstByOrder.set(entry.order, entry);
      }
    }

    if (!duplicateFound) {
      const validSequence = sorted.every((entry, index) => entry.order === index + 1);
      if (!validSequence && sorted.length > 0) {
        issues.push({
          stage: 'reconstruction',
          code: 'INVALID_CHILD_ORDER_SEQUENCE',
          message: `${childSheet.name} child order for parent ${parentKey} must be the exact sequence 1..N.`,
          sheetName: childSheet.name,
          rowIndex: sorted[0].rowIndex,
          excelRow: excelRow(sorted[0].rowIndex),
          column: orderColumn,
          input: sorted.map((entry) => entry.order),
        });
      }
    }

    groups.set(parentKey, sorted);
  }

  return groups;
}

function reconstructChildren(
  document: WorkbookNeutralDocument,
  mixPresets: MixPreset[],
  yieldSamples: YieldSample[],
): BusinessDatasetWorkbookImportIssue[] {
  const issues: BusinessDatasetWorkbookImportIssue[] = [];
  const presetsById = indexParents(mixPresets);
  const samplesById = indexParents(yieldSamples);

  const categoryGroups = collectChildGroups(
    sheet(document, 'MixPresetCategories'),
    new Set(presetsById.keys()),
    'mixPresetId',
    'categoryOrder',
    issues,
  );
  const lineGroups = collectChildGroups(
    sheet(document, 'MixPresetLines'),
    new Set(presetsById.keys()),
    'mixPresetId',
    'lineOrder',
    issues,
  );
  const inputGroups = collectChildGroups(
    sheet(document, 'YieldSampleInputs'),
    new Set(samplesById.keys()),
    'yieldSampleId',
    'inputOrder',
    issues,
  );

  if (issues.length > 0) return issues;

  for (const [parentKey, entries] of categoryGroups) {
    const preset = presetsById.get(parentKey);
    if (!preset) continue;
    preset.compatibleCategories = entries.map(
      (entry) => text(entry.row, 'category') as MixPreset['compatibleCategories'][number],
    );
  }

  for (const [parentKey, entries] of lineGroups) {
    const preset = presetsById.get(parentKey);
    if (!preset) continue;
    preset.lines = entries.map((entry) => ({
      materialId: text(entry.row, 'materialId'),
      role: text(entry.row, 'role') as MixPreset['lines'][number]['role'],
      parts: numberValue(entry.row, 'parts'),
    }));
  }

  for (const [parentKey, entries] of inputGroups) {
    const sample = samplesById.get(parentKey);
    if (!sample) continue;
    sample.materialInputs = entries.map((entry) => ({
      materialId: text(entry.row, 'materialId'),
      quantity: numberValue(entry.row, 'quantity'),
      unit: text(entry.row, 'unit') as YieldSample['materialInputs'][number]['unit'],
    }));
  }

  return issues;
}

function reconstructCandidate(
  document: WorkbookNeutralDocument,
  metadata: ImportedWorkbookMetadata,
): { dataset?: BusinessDataset; issues: BusinessDatasetWorkbookImportIssue[] } {
  try {
    const mixPresets = reconstructMixPresets(document);
    const yieldSamples = reconstructYieldSamples(document);
    const reconstructionIssues = reconstructChildren(document, mixPresets, yieldSamples);
    if (reconstructionIssues.length > 0) return { issues: reconstructionIssues };

    return {
      issues: [],
      dataset: {
        schemaVersion: metadata.datasetSchemaVersion,
        materials: reconstructMaterials(document),
        materialCalibrations: reconstructCalibrations(document),
        mixPresets,
        products: reconstructProducts(document),
        yieldSamples,
        recipeItems: reconstructRecipeItems(document),
        productComponents: reconstructProductComponents(document),
        productStocks: reconstructProductStocks(document),
        productFinancialProfiles: reconstructFinancialProfiles(document),
      },
    };
  } catch (error) {
    return {
      issues: [
        {
          stage: 'reconstruction',
          code: 'RECONSTRUCTION_FAILED',
          message:
            error instanceof Error
              ? `Workbook reconstruction failed: ${error.message}`
              : 'Workbook reconstruction failed unexpectedly.',
        },
      ],
    };
  }
}

export function reconstructBusinessDatasetFromWorkbook(
  document: WorkbookNeutralDocument,
): BusinessDatasetWorkbookImportResult {
  const workbookIssues = validateWorkbookSchema(document);
  if (workbookIssues.length > 0) return failure(schemaIssues(workbookIssues));

  const metadataResult = readMetadata(document);
  if (!metadataResult.metadata || metadataResult.issues.length > 0) {
    return failure(metadataResult.issues);
  }

  if (
    metadataResult.metadata.formatId !== CRAFT_BUSINESS_WORKBOOK_FORMAT_ID ||
    metadataResult.metadata.workbookFormatVersion !== CURRENT_WORKBOOK_FORMAT_VERSION ||
    metadataResult.metadata.datasetSchemaVersion !== CURRENT_BUSINESS_DATASET_SCHEMA_VERSION
  ) {
    return failure([
      {
        stage: 'metadata',
        code: 'UNSUPPORTED_CURRENT_VERSION',
        message: 'Workbook metadata does not match the current import contract.',
        sheetName: '_Meta',
        rowIndex: 0,
        excelRow: 2,
      },
    ]);
  }

  const reconstructed = reconstructCandidate(document, metadataResult.metadata);
  if (!reconstructed.dataset || reconstructed.issues.length > 0) {
    return failure(reconstructed.issues);
  }

  const validation = validateBusinessDatasetIntegrity(reconstructed.dataset);
  if (!validation.valid) return failure(datasetIssues(validation.issues));

  return {
    ok: true,
    dataset: reconstructed.dataset,
    metadata: metadataResult.metadata,
  };
}

export function importBusinessDatasetFromXlsx(
  bytes: WorkbookBinaryInput,
  codec: WorkbookCodec,
): BusinessDatasetWorkbookImportResult {
  let document: WorkbookNeutralDocument;
  try {
    document = codec.decode(bytes);
  } catch (error) {
    const code = error instanceof WorkbookCodecError ? error.code : 'WORKBOOK_DECODE_FAILED';
    const message =
      error instanceof Error
        ? `Workbook decode failed: ${error.message}`
        : 'Workbook decode failed unexpectedly.';
    return failure([{ stage: 'codec', code, message }]);
  }

  return reconstructBusinessDatasetFromWorkbook(document);
}
