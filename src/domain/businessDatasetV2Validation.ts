import {
  validateBusinessDatasetIntegrity,
  type BusinessDatasetValidationIssue,
  type BusinessDatasetValidationIssueCode,
} from './businessDatasetValidation';
import {
  assertBusinessDatasetV2Completeness,
  BUSINESS_DATASET_V2_SOURCE_COLLECTION_KEYS,
  BusinessDatasetV2CompletenessError,
  type BusinessDatasetV2,
  type BusinessDatasetV2CompletenessErrorCode,
  type BusinessDatasetV2SourceCollectionKey,
} from './businessDatasetV2';
import {
  ProductPriceTierError,
  validateProductPriceTierContract,
  type ProductPriceTier,
} from './productPriceTiers';
import {
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
} from './businessDataset';
import type { BusinessDataset } from './types';

export type BusinessDatasetV2ValidationIssueCode =
  | BusinessDatasetValidationIssueCode
  | BusinessDatasetV2CompletenessErrorCode;

export interface BusinessDatasetV2ValidationIssue {
  code: BusinessDatasetV2ValidationIssueCode;
  collection?: BusinessDatasetV2SourceCollectionKey;
  index?: number;
  entityId?: string;
  field?: string;
  path: string;
  message: string;
}

export interface BusinessDatasetV2ValidationResult {
  valid: boolean;
  issues: readonly BusinessDatasetV2ValidationIssue[];
}

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function readString(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === 'string' ? candidate : undefined;
}

function tierField(errorCode: string | undefined): string | undefined {
  switch (errorCode) {
    case 'INVALID_ID':
      return 'id';
    case 'INVALID_PRODUCT_ID':
      return 'productId';
    case 'INVALID_NAME':
      return 'name';
    case 'INVALID_KIND':
      return 'kind';
    case 'INVALID_PRICE_BASIS':
      return 'priceBasis';
    case 'NON_FINITE_PRICE_AMOUNT':
    case 'NEGATIVE_PRICE_AMOUNT':
      return 'priceAmount';
    case 'NON_FINITE_UNITS_PER_OFFER':
    case 'NON_INTEGER_UNITS_PER_OFFER':
    case 'NON_POSITIVE_UNITS_PER_OFFER':
    case 'PER_UNIT_UNITS_PER_OFFER_MISMATCH':
      return 'unitsPerOffer';
    case 'NON_FINITE_MINIMUM_ORDER_QUANTITY':
    case 'NON_INTEGER_MINIMUM_ORDER_QUANTITY':
    case 'NON_POSITIVE_MINIMUM_ORDER_QUANTITY':
    case 'MINIMUM_BELOW_OFFER_SIZE':
    case 'MINIMUM_NOT_OFFER_MULTIPLE':
      return 'minimumOrderQuantity';
    case 'NON_FINITE_ADDITIONAL_COST_PER_OFFER':
    case 'NEGATIVE_ADDITIONAL_COST_PER_OFFER':
      return 'additionalCostPerOffer';
    case 'INVALID_ACTIVE_STATE':
      return 'isActive';
    default:
      return undefined;
  }
}

function baseDatasetV1(dataset: BusinessDatasetV2): BusinessDataset {
  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: dataset.materials,
    materialCalibrations: dataset.materialCalibrations,
    mixPresets: dataset.mixPresets,
    products: dataset.products,
    yieldSamples: dataset.yieldSamples,
    recipeItems: dataset.recipeItems,
    productComponents: dataset.productComponents,
    productStocks: dataset.productStocks,
    productFinancialProfiles: dataset.productFinancialProfiles,
  };
}

function mapBaseIssue(
  issue: BusinessDatasetValidationIssue,
): BusinessDatasetV2ValidationIssue {
  return {
    ...issue,
    collection: issue.collection,
  };
}

function completenessIssue(
  error: BusinessDatasetV2CompletenessError,
): BusinessDatasetV2ValidationIssue {
  const path =
    error.collection !== undefined
      ? error.collection
      : error.code === 'INVALID_SCHEMA_VERSION' ||
          error.code === 'UNSUPPORTED_SCHEMA_VERSION'
        ? 'schemaVersion'
        : '$';

  return {
    code: error.code,
    collection: error.collection,
    path,
    message: error.message,
  };
}

function validateTierRows(
  dataset: BusinessDatasetV2,
  issues: BusinessDatasetV2ValidationIssue[],
): void {
  for (let index = 0; index < dataset.productPriceTiers.length; index += 1) {
    const tier = dataset.productPriceTiers[index] as ProductPriceTier;
    try {
      validateProductPriceTierContract(tier);
    } catch (error) {
      if (!(error instanceof ProductPriceTierError) && !(error instanceof TypeError)) {
        throw error;
      }

      const code =
        error instanceof ProductPriceTierError ? error.code : undefined;
      const field = tierField(code);
      issues.push({
        code: 'INVALID_RECORD',
        collection: 'productPriceTiers',
        index,
        entityId: readString(tier, 'id'),
        field,
        path: field
          ? `productPriceTiers[${index}].${field}`
          : `productPriceTiers[${index}]`,
        message:
          error instanceof Error
            ? error.message
            : 'Invalid Product price tier source record.',
      });
    }
  }
}

function validateTierDuplicates(
  dataset: BusinessDatasetV2,
  issues: BusinessDatasetV2ValidationIssue[],
): void {
  const firstById = new Map<string, number>();

  for (let index = 0; index < dataset.productPriceTiers.length; index += 1) {
    const tier = dataset.productPriceTiers[index];
    const id = readString(tier, 'id');
    if (!id?.trim()) continue;

    const key = canonical(id);
    const first = firstById.get(key);
    if (first === undefined) {
      firstById.set(key, index);
      continue;
    }

    issues.push({
      code: 'DUPLICATE_IDENTITY',
      collection: 'productPriceTiers',
      index,
      entityId: id,
      field: 'id',
      path: `productPriceTiers[${index}].id`,
      message: `Product price tier ID duplicates productPriceTiers[${first}].id using trim-aware, case-insensitive identity.`,
    });
  }
}

function validateTierReferences(
  dataset: BusinessDatasetV2,
  issues: BusinessDatasetV2ValidationIssue[],
): void {
  const productIds = new Set(
    dataset.products
      .map((product) => readString(product, 'id'))
      .filter((id): id is string => Boolean(id?.trim()))
      .map(canonical),
  );

  for (let index = 0; index < dataset.productPriceTiers.length; index += 1) {
    const tier = dataset.productPriceTiers[index];
    const productId = readString(tier, 'productId');
    if (!productId?.trim()) continue;
    if (productIds.has(canonical(productId))) continue;

    issues.push({
      code: 'MISSING_REFERENCE',
      collection: 'productPriceTiers',
      index,
      entityId: readString(tier, 'id'),
      field: 'productId',
      path: `productPriceTiers[${index}].productId`,
      message: `Referenced Product does not exist: ${productId.trim()}.`,
    });
  }
}

const COLLECTION_ORDER = new Map<BusinessDatasetV2SourceCollectionKey, number>(
  BUSINESS_DATASET_V2_SOURCE_COLLECTION_KEYS.map((collection, index) => [
    collection,
    index,
  ]),
);

function sortIssues(
  issues: readonly BusinessDatasetV2ValidationIssue[],
): BusinessDatasetV2ValidationIssue[] {
  return [...issues].sort((left, right) => {
    const leftCollection =
      left.collection === undefined
        ? -1
        : COLLECTION_ORDER.get(left.collection) ?? Number.MAX_SAFE_INTEGER;
    const rightCollection =
      right.collection === undefined
        ? -1
        : COLLECTION_ORDER.get(right.collection) ?? Number.MAX_SAFE_INTEGER;

    if (leftCollection !== rightCollection) {
      return leftCollection - rightCollection;
    }

    const leftIndex = left.index ?? -1;
    const rightIndex = right.index ?? -1;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;

    const byPath = left.path.localeCompare(right.path);
    if (byPath !== 0) return byPath;

    return left.code.localeCompare(right.code);
  });
}

export function validateBusinessDatasetV2Integrity(
  input: unknown,
): BusinessDatasetV2ValidationResult {
  try {
    assertBusinessDatasetV2Completeness(input);
  } catch (error) {
    if (error instanceof BusinessDatasetV2CompletenessError) {
      return { valid: false, issues: [completenessIssue(error)] };
    }
    throw error;
  }

  const dataset: BusinessDatasetV2 = input;
  const baseValidation = validateBusinessDatasetIntegrity(baseDatasetV1(dataset));
  const issues: BusinessDatasetV2ValidationIssue[] =
    baseValidation.issues.map(mapBaseIssue);

  validateTierRows(dataset, issues);
  validateTierDuplicates(dataset, issues);
  validateTierReferences(dataset, issues);

  const sorted = sortIssues(issues);
  return {
    valid: sorted.length === 0,
    issues: sorted,
  };
}
