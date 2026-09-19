import {
  assertBusinessDatasetCompleteness,
  BUSINESS_DATASET_SOURCE_COLLECTION_KEYS,
  BusinessDatasetCompletenessError,
  type BusinessDatasetCompletenessErrorCode,
  type BusinessDatasetSourceCollectionKey,
} from './businessDataset';
import { validateFixedRecipeItemContract } from './fixedRecipeItems';
import {
  validateMaterialCalibrationEvidence,
  type MaterialCalibrationEvidence,
} from './materialCalibration';
import { calculateMaterialInventoryValuation } from './materialInventory';
import { validateMaterialContract } from './materials';
import { validateMixPresetContract } from './mixPresets';
import {
  ProductCompositionGraphError,
  validateProductCompositionGraph,
} from './productCompositionGraph';
import { validateProductComponentContract } from './productComponents';
import { validateProductFinancialProfileContract } from './productFinancialProfile';
import { validateProductStockContract } from './productStock';
import { validatePricingPolicy } from './pricing';
import { validateProductContract } from './products';
import type { BusinessDataset } from './types';
import { validateYieldSampleContract } from './yieldSamples';

export type BusinessDatasetValidationIssueCode =
  | BusinessDatasetCompletenessErrorCode
  | 'INVALID_RECORD'
  | 'DUPLICATE_IDENTITY'
  | 'MISSING_REFERENCE'
  | 'REFERENCE_MISMATCH'
  | 'INVALID_COMPONENT_GRAPH';

export interface BusinessDatasetValidationIssue {
  code: BusinessDatasetValidationIssueCode;
  collection?: BusinessDatasetSourceCollectionKey;
  index?: number;
  entityId?: string;
  field?: string;
  path: string;
  message: string;
}

export interface BusinessDatasetValidationResult {
  valid: boolean;
  issues: readonly BusinessDatasetValidationIssue[];
}

type CodedError = Error & { readonly code: string };

type FieldResolver = (errorCode: string | undefined) => string | undefined;

type EntityIdReader<T> = (row: T) => string | undefined;

const COLLECTION_ORDER = new Map<BusinessDatasetSourceCollectionKey, number>(
  BUSINESS_DATASET_SOURCE_COLLECTION_KEYS.map((collection, index) => [collection, index]),
);

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function readString(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === 'string' ? candidate : undefined;
}

function entityPath(
  collection: BusinessDatasetSourceCollectionKey,
  index: number,
  field?: string,
): string {
  return field ? `${collection}[${index}].${field}` : `${collection}[${index}]`;
}

function isCodedError(error: unknown): error is CodedError {
  return (
    error instanceof Error &&
    typeof (error as Error & { code?: unknown }).code === 'string'
  );
}

function isExpectedSourceValidationError(error: unknown): error is Error {
  return isCodedError(error) || error instanceof TypeError;
}

function errorCode(error: unknown): string | undefined {
  return isCodedError(error) ? error.code : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Invalid source record.';
}

function addRecordIssue<T>(
  issues: BusinessDatasetValidationIssue[],
  collection: BusinessDatasetSourceCollectionKey,
  rows: readonly T[],
  index: number,
  error: unknown,
  fieldResolver: FieldResolver,
  entityIdReader: EntityIdReader<T>,
): void {
  const field = fieldResolver(errorCode(error));
  issues.push({
    code: 'INVALID_RECORD',
    collection,
    index,
    entityId: entityIdReader(rows[index]),
    field,
    path: entityPath(collection, index, field),
    message: errorMessage(error),
  });
}

function validateRows<T>(
  issues: BusinessDatasetValidationIssue[],
  collection: BusinessDatasetSourceCollectionKey,
  rows: readonly T[],
  validator: (row: T) => void,
  fieldResolver: FieldResolver,
  entityIdReader: EntityIdReader<T>,
): boolean[] {
  const valid = new Array<boolean>(rows.length).fill(false);

  for (let index = 0; index < rows.length; index += 1) {
    try {
      validator(rows[index]);
      valid[index] = true;
    } catch (error) {
      if (!isExpectedSourceValidationError(error)) throw error;
      addRecordIssue(
        issues,
        collection,
        rows,
        index,
        error,
        fieldResolver,
        entityIdReader,
      );
    }
  }

  return valid;
}

function addDuplicateIssues<T>(
  issues: BusinessDatasetValidationIssue[],
  collection: BusinessDatasetSourceCollectionKey,
  rows: readonly T[],
  keyReader: (row: T) => string | undefined,
  field: string,
  label: string,
  entityIdReader: EntityIdReader<T>,
): void {
  const firstByIdentity = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const rawKey = keyReader(rows[index]);
    if (rawKey === undefined || !rawKey.trim()) continue;

    const key = canonical(rawKey);
    const firstIndex = firstByIdentity.get(key);
    if (firstIndex === undefined) {
      firstByIdentity.set(key, index);
      continue;
    }

    issues.push({
      code: 'DUPLICATE_IDENTITY',
      collection,
      index,
      entityId: entityIdReader(rows[index]),
      field,
      path: entityPath(collection, index, field),
      message: `${label} duplicates ${entityPath(collection, firstIndex, field)} using trim-aware, case-insensitive identity.`,
    });
  }
}

function identitySet<T>(rows: readonly T[], idReader: (row: T) => string | undefined): Set<string> {
  const identities = new Set<string>();
  for (const row of rows) {
    const id = idReader(row);
    if (id !== undefined && id.trim()) identities.add(canonical(id));
  }
  return identities;
}

function addMissingReference(
  issues: BusinessDatasetValidationIssue[],
  collection: BusinessDatasetSourceCollectionKey,
  index: number,
  entityId: string | undefined,
  field: string,
  referencedId: string | undefined,
  targetIdentities: ReadonlySet<string>,
  targetLabel: string,
): void {
  if (referencedId === undefined || !referencedId.trim()) return;
  if (targetIdentities.has(canonical(referencedId))) return;

  issues.push({
    code: 'MISSING_REFERENCE',
    collection,
    index,
    entityId,
    field,
    path: entityPath(collection, index, field),
    message: `Referenced ${targetLabel} does not exist: ${referencedId.trim()}.`,
  });
}

function materialField(errorCodeValue: string | undefined): string | undefined {
  switch (errorCodeValue) {
    case 'INVALID_ID':
      return 'id';
    case 'INVALID_NAME':
      return 'name';
    case 'INVALID_GROUP':
      return 'group';
    case 'INVALID_BASE_UNIT':
      return 'baseUnit';
    case 'NON_FINITE_PURCHASE_QUANTITY':
    case 'NON_POSITIVE_PURCHASE_QUANTITY':
      return 'purchaseQuantity';
    case 'NON_FINITE_PACKAGE_COST':
    case 'NEGATIVE_PACKAGE_COST':
      return 'packageCost';
    case 'INVALID_MANUAL_CONVERSION':
      return 'manualBaseUnitsPerPurchaseUnit';
    case 'NON_FINITE_ON_HAND_QUANTITY':
    case 'NEGATIVE_ON_HAND_QUANTITY':
      return 'onHandQuantity';
    case 'UNRESOLVED_PACKAGE_ON_HAND_UNIT':
    case 'UNRESOLVED_CROSS_DIMENSION_UNIT':
      return 'onHandUnit';
    case 'MISSING_PACKAGE_CONVERSION':
    case 'MISSING_MATERIAL_CALIBRATION':
      return 'purchaseUnit';
    default:
      return undefined;
  }
}

function calibrationField(errorCodeValue: string | undefined): string | undefined {
  switch (errorCodeValue) {
    case 'INVALID_CALIBRATION_ID':
      return 'id';
    case 'INVALID_MATERIAL_ID':
      return 'materialId';
    case 'NON_FINITE_VOLUME':
    case 'NON_POSITIVE_VOLUME':
      return 'measuredVolume';
    case 'INVALID_VOLUME_UNIT':
      return 'volumeUnit';
    case 'NON_FINITE_WEIGHT':
    case 'NON_POSITIVE_WEIGHT':
      return 'knownWeight';
    case 'INVALID_WEIGHT_UNIT':
      return 'weightUnit';
    case 'INVALID_RECORDED_AT':
      return 'recordedAt';
    default:
      return undefined;
  }
}

function mixPresetField(errorCodeValue: string | undefined): string | undefined {
  switch (errorCodeValue) {
    case 'INVALID_ID':
      return 'id';
    case 'INVALID_NAME':
      return 'name';
    case 'INVALID_COMPATIBLE_CATEGORIES':
      return 'compatibleCategories';
    case 'INVALID_BASIS':
      return 'basis';
    case 'EMPTY_LINES':
    case 'INVALID_MATERIAL_ID':
    case 'INVALID_ROLE':
    case 'INVALID_PARTS':
    case 'DUPLICATE_MATERIAL':
    case 'INVALID_PRIMARY_COUNT':
      return 'lines';
    case 'INVALID_ACTIVE_STATE':
      return 'isActive';
    default:
      return undefined;
  }
}

function productField(errorCodeValue: string | undefined): string | undefined {
  switch (errorCodeValue) {
    case 'INVALID_ID':
      return 'id';
    case 'INVALID_NAME':
      return 'name';
    case 'INVALID_CATEGORY':
      return 'category';
    case 'INVALID_MIX_PRESET_ID':
      return 'mixPresetId';
    case 'INVALID_PREFERRED_YIELD_SAMPLE_ID':
      return 'preferredYieldSampleId';
    case 'INVALID_SAFETY_WASTE_RATE':
      return 'safetyWasteRate';
    case 'INVALID_ACTIVE_STATE':
      return 'isActive';
    default:
      return undefined;
  }
}

function yieldSampleField(errorCodeValue: string | undefined): string | undefined {
  switch (errorCodeValue) {
    case 'INVALID_ID':
      return 'id';
    case 'INVALID_PRODUCT_ID':
      return 'productId';
    case 'INVALID_MIX_PRESET_ID':
      return 'mixPresetId';
    case 'EMPTY_MATERIAL_INPUTS':
    case 'INVALID_MATERIAL_ID':
    case 'INVALID_QUANTITY':
    case 'INVALID_UNIT':
    case 'DUPLICATE_MATERIAL':
      return 'materialInputs';
    case 'INVALID_GOOD_PIECES':
      return 'goodPieces';
    case 'INVALID_REJECTED_PIECES':
      return 'rejectedPieces';
    case 'INVALID_RECORDED_AT':
      return 'recordedAt';
    default:
      return undefined;
  }
}

function recipeItemField(errorCodeValue: string | undefined): string | undefined {
  switch (errorCodeValue) {
    case 'INVALID_ID':
      return 'id';
    case 'INVALID_PRODUCT_ID':
      return 'productId';
    case 'INVALID_MATERIAL_ID':
      return 'materialId';
    case 'NON_FINITE_QUANTITY':
    case 'NON_POSITIVE_QUANTITY':
      return 'quantityPerProduct';
    case 'INVALID_UNIT':
      return 'unit';
    case 'INVALID_ROLE':
      return 'role';
    default:
      return undefined;
  }
}

function productComponentField(errorCodeValue: string | undefined): string | undefined {
  switch (errorCodeValue) {
    case 'INVALID_ID':
      return 'id';
    case 'INVALID_PARENT_PRODUCT_ID':
      return 'parentProductId';
    case 'INVALID_SOURCE_TYPE':
      return 'sourceType';
    case 'INVALID_SOURCE_ID':
      return 'sourceId';
    case 'NON_FINITE_QUANTITY':
    case 'NON_INTEGER_QUANTITY':
    case 'NON_POSITIVE_QUANTITY':
      return 'quantityPerParent';
    case 'INVALID_ROLE':
      return 'role';
    default:
      return undefined;
  }
}

function productStockField(errorCodeValue: string | undefined): string | undefined {
  switch (errorCodeValue) {
    case 'INVALID_PRODUCT_ID':
      return 'productId';
    case 'NON_FINITE_ON_HAND_QUANTITY':
    case 'NON_INTEGER_ON_HAND_QUANTITY':
    case 'NEGATIVE_ON_HAND_QUANTITY':
      return 'onHandQuantity';
    default:
      return undefined;
  }
}

function financialProfileField(errorCodeValue: string | undefined): string | undefined {
  switch (errorCodeValue) {
    case 'INVALID_PRODUCT_ID':
      return 'productId';
    case 'NON_FINITE_LABOR_COST':
    case 'NEGATIVE_LABOR_COST':
      return 'laborCostPerUnit';
    case 'NON_FINITE_OVERHEAD_COST':
    case 'NEGATIVE_OVERHEAD_COST':
      return 'overheadCostPerUnit';
    case 'INVALID_PRICING_METHOD':
      return 'pricingPolicy.method';
    case 'NON_FINITE_POLICY_VALUE':
    case 'NEGATIVE_POLICY_VALUE':
    case 'INVALID_MARGIN_RATE':
      return 'pricingPolicy.value';
    default:
      return undefined;
  }
}

function validateMaterialValuations(
  dataset: BusinessDataset,
  materialRowsValid: readonly boolean[],
  calibrationRowsValid: readonly boolean[],
  issues: BusinessDatasetValidationIssue[],
): void {
  for (let index = 0; index < dataset.materials.length; index += 1) {
    if (!materialRowsValid[index]) continue;

    const material = dataset.materials[index];
    const materialKey = canonical(material.id);
    const evidence: MaterialCalibrationEvidence[] = [];

    for (let calibrationIndex = 0; calibrationIndex < dataset.materialCalibrations.length; calibrationIndex += 1) {
      if (!calibrationRowsValid[calibrationIndex]) continue;
      const calibration = dataset.materialCalibrations[calibrationIndex];
      if (canonical(calibration.materialId) === materialKey) evidence.push(calibration);
    }

    try {
      calculateMaterialInventoryValuation(material, evidence);
    } catch (error) {
      if (!isExpectedSourceValidationError(error)) throw error;
      addRecordIssue(
        issues,
        'materials',
        dataset.materials,
        index,
        error,
        materialField,
        (row) => readString(row, 'id'),
      );
    }
  }
}

function validateDuplicates(dataset: BusinessDataset, issues: BusinessDatasetValidationIssue[]): void {
  addDuplicateIssues(issues, 'materials', dataset.materials, (row) => readString(row, 'id'), 'id', 'Material ID', (row) => readString(row, 'id'));
  addDuplicateIssues(issues, 'materials', dataset.materials, (row) => readString(row, 'name'), 'name', 'Material name', (row) => readString(row, 'id'));

  addDuplicateIssues(issues, 'materialCalibrations', dataset.materialCalibrations, (row) => readString(row, 'id'), 'id', 'Calibration ID', (row) => readString(row, 'id'));

  addDuplicateIssues(issues, 'mixPresets', dataset.mixPresets, (row) => readString(row, 'id'), 'id', 'Mix preset ID', (row) => readString(row, 'id'));
  addDuplicateIssues(issues, 'mixPresets', dataset.mixPresets, (row) => readString(row, 'name'), 'name', 'Mix preset name', (row) => readString(row, 'id'));

  addDuplicateIssues(issues, 'products', dataset.products, (row) => readString(row, 'id'), 'id', 'Product ID', (row) => readString(row, 'id'));
  addDuplicateIssues(issues, 'products', dataset.products, (row) => readString(row, 'name'), 'name', 'Product name', (row) => readString(row, 'id'));

  addDuplicateIssues(issues, 'yieldSamples', dataset.yieldSamples, (row) => readString(row, 'id'), 'id', 'Yield sample ID', (row) => readString(row, 'id'));

  addDuplicateIssues(issues, 'recipeItems', dataset.recipeItems, (row) => readString(row, 'id'), 'id', 'Recipe item ID', (row) => readString(row, 'id'));
  addDuplicateIssues(
    issues,
    'recipeItems',
    dataset.recipeItems,
    (row) => {
      const productId = readString(row, 'productId');
      const materialId = readString(row, 'materialId');
      if (!productId?.trim() || !materialId?.trim()) return undefined;
      return `${canonical(productId)}::${canonical(materialId)}`;
    },
    'materialId',
    'Recipe product/material identity',
    (row) => readString(row, 'id'),
  );

  addDuplicateIssues(issues, 'productComponents', dataset.productComponents, (row) => readString(row, 'id'), 'id', 'Product component ID', (row) => readString(row, 'id'));

  addDuplicateIssues(issues, 'productStocks', dataset.productStocks, (row) => readString(row, 'productId'), 'productId', 'Product stock Product ID', (row) => readString(row, 'productId'));

  addDuplicateIssues(issues, 'productFinancialProfiles', dataset.productFinancialProfiles, (row) => readString(row, 'productId'), 'productId', 'Financial profile Product ID', (row) => readString(row, 'productId'));
}

function validateReferences(dataset: BusinessDataset, issues: BusinessDatasetValidationIssue[]): void {
  const materialIds = identitySet(dataset.materials, (row) => readString(row, 'id'));
  const mixPresetIds = identitySet(dataset.mixPresets, (row) => readString(row, 'id'));
  const productIds = identitySet(dataset.products, (row) => readString(row, 'id'));
  const yieldSamplesById = new Map(
    dataset.yieldSamples
      .map((sample) => [readString(sample, 'id'), readString(sample, 'productId')] as const)
      .filter((entry): entry is readonly [string, string | undefined] => Boolean(entry[0]?.trim()))
      .map(([sampleId, productId]) => [canonical(sampleId), productId]),
  );

  for (let index = 0; index < dataset.materialCalibrations.length; index += 1) {
    const row = dataset.materialCalibrations[index];
    addMissingReference(
      issues,
      'materialCalibrations',
      index,
      readString(row, 'id'),
      'materialId',
      readString(row, 'materialId'),
      materialIds,
      'Material',
    );
  }

  for (let index = 0; index < dataset.mixPresets.length; index += 1) {
    const row = dataset.mixPresets[index];
    if (!Array.isArray(row?.lines)) continue;
    for (let lineIndex = 0; lineIndex < row.lines.length; lineIndex += 1) {
      addMissingReference(
        issues,
        'mixPresets',
        index,
        readString(row, 'id'),
        `lines[${lineIndex}].materialId`,
        readString(row.lines[lineIndex], 'materialId'),
        materialIds,
        'Material',
      );
    }
  }

  for (let index = 0; index < dataset.products.length; index += 1) {
    const row = dataset.products[index];
    const productId = readString(row, 'id');
    addMissingReference(
      issues,
      'products',
      index,
      productId,
      'mixPresetId',
      readString(row, 'mixPresetId'),
      mixPresetIds,
      'MixPreset',
    );

    const preferredYieldSampleId = readString(row, 'preferredYieldSampleId');
    addMissingReference(
      issues,
      'products',
      index,
      productId,
      'preferredYieldSampleId',
      preferredYieldSampleId,
      new Set(yieldSamplesById.keys()),
      'Yield sample',
    );

    if (preferredYieldSampleId?.trim() && yieldSamplesById.has(canonical(preferredYieldSampleId))) {
      const preferredProductId = yieldSamplesById.get(canonical(preferredYieldSampleId));
      if (
        productId?.trim() &&
        preferredProductId?.trim() &&
        canonical(productId) !== canonical(preferredProductId)
      ) {
        issues.push({
          code: 'REFERENCE_MISMATCH',
          collection: 'products',
          index,
          entityId: productId,
          field: 'preferredYieldSampleId',
          path: entityPath('products', index, 'preferredYieldSampleId'),
          message: `Preferred Yield sample ${preferredYieldSampleId.trim()} belongs to Product ${preferredProductId.trim()}, not ${productId.trim()}.`,
        });
      }
    }
  }

  for (let index = 0; index < dataset.yieldSamples.length; index += 1) {
    const row = dataset.yieldSamples[index];
    const entityId = readString(row, 'id');
    addMissingReference(issues, 'yieldSamples', index, entityId, 'productId', readString(row, 'productId'), productIds, 'Product');
    addMissingReference(issues, 'yieldSamples', index, entityId, 'mixPresetId', readString(row, 'mixPresetId'), mixPresetIds, 'MixPreset');

    if (!Array.isArray(row?.materialInputs)) continue;
    for (let inputIndex = 0; inputIndex < row.materialInputs.length; inputIndex += 1) {
      addMissingReference(
        issues,
        'yieldSamples',
        index,
        entityId,
        `materialInputs[${inputIndex}].materialId`,
        readString(row.materialInputs[inputIndex], 'materialId'),
        materialIds,
        'Material',
      );
    }
  }

  for (let index = 0; index < dataset.recipeItems.length; index += 1) {
    const row = dataset.recipeItems[index];
    const entityId = readString(row, 'id');
    addMissingReference(issues, 'recipeItems', index, entityId, 'productId', readString(row, 'productId'), productIds, 'Product');
    addMissingReference(issues, 'recipeItems', index, entityId, 'materialId', readString(row, 'materialId'), materialIds, 'Material');
  }

  for (let index = 0; index < dataset.productComponents.length; index += 1) {
    const row = dataset.productComponents[index];
    const entityId = readString(row, 'id');
    addMissingReference(issues, 'productComponents', index, entityId, 'parentProductId', readString(row, 'parentProductId'), productIds, 'Product');

    const sourceType = readString(row, 'sourceType');
    if (sourceType === 'material') {
      addMissingReference(issues, 'productComponents', index, entityId, 'sourceId', readString(row, 'sourceId'), materialIds, 'Material');
    } else if (sourceType === 'product') {
      addMissingReference(issues, 'productComponents', index, entityId, 'sourceId', readString(row, 'sourceId'), productIds, 'Product');
    }
  }

  for (let index = 0; index < dataset.productStocks.length; index += 1) {
    const row = dataset.productStocks[index];
    addMissingReference(issues, 'productStocks', index, readString(row, 'productId'), 'productId', readString(row, 'productId'), productIds, 'Product');
  }

  for (let index = 0; index < dataset.productFinancialProfiles.length; index += 1) {
    const row = dataset.productFinancialProfiles[index];
    addMissingReference(issues, 'productFinancialProfiles', index, readString(row, 'productId'), 'productId', readString(row, 'productId'), productIds, 'Product');
  }
}

function graphIssueIndex(dataset: BusinessDataset, error: ProductCompositionGraphError): number | undefined {
  if (error.componentId) {
    const componentKey = canonical(error.componentId);
    const index = dataset.productComponents.findIndex(
      (component) => canonical(component.id) === componentKey,
    );
    if (index >= 0) return index;
  }

  const cyclePath = error.cyclePath;
  if (cyclePath && cyclePath.length >= 2) {
    for (let pathIndex = 0; pathIndex < cyclePath.length - 1; pathIndex += 1) {
      const parent = canonical(cyclePath[pathIndex]);
      const source = canonical(cyclePath[pathIndex + 1]);
      const index = dataset.productComponents.findIndex(
        (component) =>
          component.sourceType === 'product' &&
          canonical(component.parentProductId) === parent &&
          canonical(component.sourceId) === source,
      );
      if (index >= 0) return index;
    }
  }

  return undefined;
}

function validateComponentGraph(
  dataset: BusinessDataset,
  componentRowsValid: readonly boolean[],
  issues: BusinessDatasetValidationIssue[],
): void {
  const components = dataset.productComponents.filter((_, index) => componentRowsValid[index]);

  try {
    validateProductCompositionGraph(components);
  } catch (error) {
    if (!(error instanceof ProductCompositionGraphError)) throw error;

    const index = graphIssueIndex(dataset, error);
    const field = 'sourceId';
    issues.push({
      code: 'INVALID_COMPONENT_GRAPH',
      collection: 'productComponents',
      index,
      entityId: index === undefined ? error.componentId : readString(dataset.productComponents[index], 'id'),
      field,
      path: index === undefined ? 'productComponents' : entityPath('productComponents', index, field),
      message: error.message,
    });
  }
}

function sortIssues(issues: BusinessDatasetValidationIssue[]): BusinessDatasetValidationIssue[] {
  return [...issues].sort((left, right) => {
    const leftCollection = left.collection === undefined ? -1 : COLLECTION_ORDER.get(left.collection) ?? Number.MAX_SAFE_INTEGER;
    const rightCollection = right.collection === undefined ? -1 : COLLECTION_ORDER.get(right.collection) ?? Number.MAX_SAFE_INTEGER;
    if (leftCollection !== rightCollection) return leftCollection - rightCollection;

    const leftIndex = left.index ?? -1;
    const rightIndex = right.index ?? -1;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;

    const byPath = left.path.localeCompare(right.path);
    if (byPath !== 0) return byPath;

    const byCode = left.code.localeCompare(right.code);
    if (byCode !== 0) return byCode;

    return left.message.localeCompare(right.message);
  });
}

function completenessIssue(error: BusinessDatasetCompletenessError): BusinessDatasetValidationIssue {
  const path =
    error.collection !== undefined
      ? error.collection
      : error.code === 'INVALID_SCHEMA_VERSION' || error.code === 'UNSUPPORTED_SCHEMA_VERSION'
        ? 'schemaVersion'
        : '$';

  return {
    code: error.code,
    collection: error.collection,
    path,
    message: error.message,
  };
}

/**
 * Validates one complete persisted BusinessDataset candidate before repository hydration.
 *
 * This boundary is intentionally pure and storage-neutral. It validates source records,
 * duplicate identities, durable references, and the authoritative Product composition
 * graph without creating repositories or mutating the candidate.
 */
export function validateBusinessDatasetIntegrity(input: unknown): BusinessDatasetValidationResult {
  try {
    assertBusinessDatasetCompleteness(input);
  } catch (error) {
    if (error instanceof BusinessDatasetCompletenessError) {
      return { valid: false, issues: [completenessIssue(error)] };
    }
    throw error;
  }

  const dataset: BusinessDataset = input;
  const issues: BusinessDatasetValidationIssue[] = [];

  const materialRowsValid = validateRows(
    issues,
    'materials',
    dataset.materials,
    validateMaterialContract,
    materialField,
    (row) => readString(row, 'id'),
  );

  const calibrationRowsValid = validateRows(
    issues,
    'materialCalibrations',
    dataset.materialCalibrations,
    validateMaterialCalibrationEvidence,
    calibrationField,
    (row) => readString(row, 'id'),
  );

  validateRows(
    issues,
    'mixPresets',
    dataset.mixPresets,
    validateMixPresetContract,
    mixPresetField,
    (row) => readString(row, 'id'),
  );

  validateRows(
    issues,
    'products',
    dataset.products,
    validateProductContract,
    productField,
    (row) => readString(row, 'id'),
  );

  validateRows(
    issues,
    'yieldSamples',
    dataset.yieldSamples,
    validateYieldSampleContract,
    yieldSampleField,
    (row) => readString(row, 'id'),
  );

  validateRows(
    issues,
    'recipeItems',
    dataset.recipeItems,
    validateFixedRecipeItemContract,
    recipeItemField,
    (row) => readString(row, 'id'),
  );

  const componentRowsValid = validateRows(
    issues,
    'productComponents',
    dataset.productComponents,
    validateProductComponentContract,
    productComponentField,
    (row) => readString(row, 'id'),
  );

  validateRows(
    issues,
    'productStocks',
    dataset.productStocks,
    validateProductStockContract,
    productStockField,
    (row) => readString(row, 'productId'),
  );

  validateRows(
    issues,
    'productFinancialProfiles',
    dataset.productFinancialProfiles,
    (profile) => {
      validateProductFinancialProfileContract(profile);
      if (profile.pricingPolicy !== null) validatePricingPolicy(profile.pricingPolicy);
    },
    financialProfileField,
    (row) => readString(row, 'productId'),
  );

  validateMaterialValuations(dataset, materialRowsValid, calibrationRowsValid, issues);
  validateDuplicates(dataset, issues);
  validateReferences(dataset, issues);
  validateComponentGraph(dataset, componentRowsValid, issues);

  const sortedIssues = sortIssues(issues);
  return {
    valid: sortedIssues.length === 0,
    issues: sortedIssues,
  };
}
