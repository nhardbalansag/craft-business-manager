import { validateBusinessDatasetIntegrity, type BusinessDatasetValidationIssue } from '../domain/businessDatasetValidation';
import type { BusinessDataset } from '../domain/types';
import type { WorkbookCodec } from './workbookCodec';
import {
  assertWorkbookSchema,
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
  WORKBOOK_SCHEMA_BY_NAME,
  WORKBOOK_SHEETS,
  WorkbookSchemaError,
  type WorkbookNeutralDocument,
  type WorkbookNeutralSheet,
  type WorkbookRowOrderMode,
  type WorkbookSchemaIssue,
  type WorkbookSheetContract,
} from './workbookSchema';

export interface WorkbookExportMetadata {
  exportedAt: string;
  applicationVersion?: string;
}

export type BusinessDatasetWorkbookExportErrorCode =
  | 'INVALID_DATASET'
  | 'INVALID_EXPORT_METADATA'
  | 'INVALID_GENERATED_WORKBOOK';

export class BusinessDatasetWorkbookExportError extends Error {
  readonly code: BusinessDatasetWorkbookExportErrorCode;
  readonly datasetIssues?: readonly BusinessDatasetValidationIssue[];
  readonly workbookIssues?: readonly WorkbookSchemaIssue[];
  readonly causeValue?: unknown;

  constructor(
    code: BusinessDatasetWorkbookExportErrorCode,
    message: string,
    context: {
      datasetIssues?: readonly BusinessDatasetValidationIssue[];
      workbookIssues?: readonly WorkbookSchemaIssue[];
      causeValue?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'BusinessDatasetWorkbookExportError';
    this.code = code;
    this.datasetIssues = context.datasetIssues;
    this.workbookIssues = context.workbookIssues;
    this.causeValue = context.causeValue;
  }
}

function validateExportMetadata(metadata: WorkbookExportMetadata): void {
  if (
    !metadata ||
    typeof metadata.exportedAt !== 'string' ||
    !metadata.exportedAt.trim() ||
    Number.isNaN(Date.parse(metadata.exportedAt))
  ) {
    throw new BusinessDatasetWorkbookExportError(
      'INVALID_EXPORT_METADATA',
      'exportedAt must be explicit, nonblank ISO-compatible text.',
      { causeValue: metadata?.exportedAt },
    );
  }

  if (
    metadata.applicationVersion !== undefined &&
    (typeof metadata.applicationVersion !== 'string' || !metadata.applicationVersion.trim())
  ) {
    throw new BusinessDatasetWorkbookExportError(
      'INVALID_EXPORT_METADATA',
      'applicationVersion must be nonblank text when supplied.',
      { causeValue: metadata.applicationVersion },
    );
  }
}

function optional<T>(value: T | undefined): T | undefined {
  return value;
}

function canonicalText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : String(value ?? '');
}

function compareExactText(left: unknown, right: unknown): number {
  return String(left ?? '').localeCompare(String(right ?? ''));
}

function compareValue(left: unknown, right: unknown, mode: WorkbookRowOrderMode): number {
  if (mode === 'text-ci-exact') {
    const canonical = canonicalText(left).localeCompare(canonicalText(right));
    return canonical !== 0 ? canonical : compareExactText(left, right);
  }

  if (mode === 'text') return compareExactText(left, right);

  if (mode === 'number') {
    const leftNumber = typeof left === 'number' ? left : Number(left);
    const rightNumber = typeof right === 'number' ? right : Number(right);
    return leftNumber - rightNumber;
  }

  const leftTime = typeof left === 'string' ? Date.parse(left) : Number.NaN;
  const rightTime = typeof right === 'string' ? Date.parse(right) : Number.NaN;
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return compareExactText(left, right);
}

function sortRows(
  rows: readonly Readonly<Record<string, unknown>>[],
  contract: WorkbookSheetContract,
): Readonly<Record<string, unknown>>[] {
  if (!contract.rowOrder || contract.rowOrder.length === 0) return [...rows];

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      for (const order of contract.rowOrder ?? []) {
        const compared = compareValue(left.row[order.key], right.row[order.key], order.mode);
        if (compared !== 0) return compared;
      }
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function sheet(
  name: keyof typeof WORKBOOK_SCHEMA_BY_NAME,
  rows: readonly Readonly<Record<string, unknown>>[],
): WorkbookNeutralSheet {
  const contract = WORKBOOK_SCHEMA_BY_NAME[name];
  return {
    name,
    columns: contract.columns.map((column) => column.key),
    rows: sortRows(rows, contract),
  };
}

function materialRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.materials.map((material) => ({
    id: material.id,
    name: material.name,
    group: material.group,
    baseUnit: material.baseUnit,
    purchaseQuantity: material.purchaseQuantity,
    purchaseUnit: material.purchaseUnit,
    packageCost: material.packageCost,
    manualBaseUnitsPerPurchaseUnit: optional(material.manualBaseUnitsPerPurchaseUnit),
    onHandQuantity: material.onHandQuantity,
    onHandUnit: material.onHandUnit,
    sourceVendorName: optional(material.source?.vendorName),
    sourceDetail: optional(material.source?.source),
    sourcePurchaseLink: optional(material.source?.purchaseLink),
    sourceContactNumber: optional(material.source?.contactNumber),
    sourceSocialPage: optional(material.source?.socialPage),
    sourceNotes: optional(material.source?.notes),
    notes: optional(material.notes),
    isActive: material.isActive,
  }));
}

function calibrationRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.materialCalibrations.map((calibration) => ({
    id: calibration.id,
    materialId: calibration.materialId,
    measuredVolume: calibration.measuredVolume,
    volumeUnit: calibration.volumeUnit,
    knownWeight: calibration.knownWeight,
    weightUnit: calibration.weightUnit,
    recordedAt: calibration.recordedAt,
    notes: optional(calibration.notes),
  }));
}

function mixPresetRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.mixPresets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    basis: preset.basis,
    notes: optional(preset.notes),
    isActive: preset.isActive,
  }));
}

function mixPresetCategoryRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.mixPresets.flatMap((preset) =>
    preset.compatibleCategories.map((category, index) => ({
      mixPresetId: preset.id,
      categoryOrder: index + 1,
      category,
    })),
  );
}

function mixPresetLineRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.mixPresets.flatMap((preset) =>
    preset.lines.map((line, index) => ({
      mixPresetId: preset.id,
      lineOrder: index + 1,
      materialId: line.materialId,
      role: line.role,
      parts: line.parts,
    })),
  );
}

function productRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    mixPresetId: optional(product.mixPresetId),
    safetyWasteRate: product.safetyWasteRate,
    notes: optional(product.notes),
    isActive: product.isActive,
  }));
}

function yieldSampleRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.yieldSamples.map((sample) => ({
    id: sample.id,
    productId: sample.productId,
    mixPresetId: optional(sample.mixPresetId),
    goodPieces: sample.goodPieces,
    rejectedPieces: sample.rejectedPieces,
    recordedAt: sample.recordedAt,
    notes: optional(sample.notes),
  }));
}

function yieldSampleInputRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.yieldSamples.flatMap((sample) =>
    sample.materialInputs.map((input, index) => ({
      yieldSampleId: sample.id,
      inputOrder: index + 1,
      materialId: input.materialId,
      quantity: input.quantity,
      unit: input.unit,
    })),
  );
}

function recipeItemRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.recipeItems.map((item) => ({
    id: item.id,
    productId: item.productId,
    materialId: item.materialId,
    quantityPerProduct: item.quantityPerProduct,
    unit: item.unit,
    role: item.role,
    notes: optional(item.notes),
  }));
}

function productComponentRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.productComponents.map((component) => ({
    id: component.id,
    parentProductId: component.parentProductId,
    sourceType: component.sourceType,
    sourceId: component.sourceId,
    role: component.role,
    quantityPerParent: component.quantityPerParent,
    notes: optional(component.notes),
  }));
}

function productStockRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.productStocks.map((stock) => ({
    productId: stock.productId,
    onHandQuantity: stock.onHandQuantity,
    notes: optional(stock.notes),
  }));
}

function productFinancialProfileRows(dataset: BusinessDataset): Readonly<Record<string, unknown>>[] {
  return dataset.productFinancialProfiles.map((profile) => ({
    productId: profile.productId,
    laborCostPerUnit: profile.laborCostPerUnit,
    overheadCostPerUnit: profile.overheadCostPerUnit,
    pricingMethod: profile.pricingPolicy === null ? undefined : profile.pricingPolicy.method,
    pricingValue: profile.pricingPolicy === null ? undefined : profile.pricingPolicy.value,
    notes: optional(profile.notes),
  }));
}

export function createBusinessDatasetWorkbookDocument(
  dataset: BusinessDataset,
  metadata: WorkbookExportMetadata,
): WorkbookNeutralDocument {
  const validation = validateBusinessDatasetIntegrity(dataset);
  if (!validation.valid) {
    throw new BusinessDatasetWorkbookExportError(
      'INVALID_DATASET',
      `Business dataset export rejected with ${validation.issues.length} validation issue(s).`,
      { datasetIssues: validation.issues },
    );
  }

  validateExportMetadata(metadata);

  const rowsBySheet: Record<string, readonly Readonly<Record<string, unknown>>[]> = {
    _Meta: [
      {
        formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
        workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
        datasetSchemaVersion: dataset.schemaVersion,
        exportedAt: metadata.exportedAt,
        applicationVersion: optional(metadata.applicationVersion),
      },
    ],
    Materials: materialRows(dataset),
    Calibrations: calibrationRows(dataset),
    MixPresets: mixPresetRows(dataset),
    MixPresetCategories: mixPresetCategoryRows(dataset),
    MixPresetLines: mixPresetLineRows(dataset),
    Products: productRows(dataset),
    YieldSamples: yieldSampleRows(dataset),
    YieldSampleInputs: yieldSampleInputRows(dataset),
    RecipeItems: recipeItemRows(dataset),
    ProductComponents: productComponentRows(dataset),
    ProductStocks: productStockRows(dataset),
    ProductFinancialProfiles: productFinancialProfileRows(dataset),
  };

  const document: WorkbookNeutralDocument = {
    sheets: WORKBOOK_SHEETS.map((contract) => sheet(contract.name, rowsBySheet[contract.name] ?? [])),
  };

  try {
    assertWorkbookSchema(document);
  } catch (error) {
    if (error instanceof WorkbookSchemaError) {
      throw new BusinessDatasetWorkbookExportError(
        'INVALID_GENERATED_WORKBOOK',
        `Generated workbook failed schema self-validation with ${error.issues.length} issue(s).`,
        { workbookIssues: error.issues, causeValue: error },
      );
    }
    throw error;
  }

  return document;
}

export function exportBusinessDatasetToXlsx(
  dataset: BusinessDataset,
  metadata: WorkbookExportMetadata,
  codec: WorkbookCodec,
): Uint8Array {
  return codec.encode(createBusinessDatasetWorkbookDocument(dataset, metadata));
}
