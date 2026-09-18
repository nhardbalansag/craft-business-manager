import { cloneFixedRecipeItem } from './fixedRecipeItems';
import { cloneMaterial } from './materials';
import { cloneMixPreset } from './mixPresets';
import { cloneProductComponent } from './productComponents';
import { cloneProductFinancialProfile } from './productFinancialProfile';
import { cloneProductStock } from './productStock';
import { cloneProduct } from './products';
import type { BusinessDataset } from './types';
import { cloneYieldSample } from './yieldSamples';

/** First formally specified complete persisted business-source dataset. */
export const CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 2 as const;

/**
 * Every authoritative Phase 1–4 source collection that must survive persistence.
 *
 * Derived costing, yield-learning, production, capacity, and pricing outputs do not
 * belong here because they are recalculated from this source evidence.
 */
export const BUSINESS_DATASET_SOURCE_COLLECTION_KEYS = [
  'materials',
  'materialCalibrations',
  'mixPresets',
  'products',
  'yieldSamples',
  'recipeItems',
  'productComponents',
  'productStocks',
  'productFinancialProfiles',
] as const satisfies readonly (keyof BusinessDataset)[];

export type BusinessDatasetSourceCollectionKey =
  (typeof BUSINESS_DATASET_SOURCE_COLLECTION_KEYS)[number];

export type BusinessDatasetCompletenessErrorCode =
  | 'INVALID_DATASET'
  | 'INVALID_SCHEMA_VERSION'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'MISSING_SOURCE_COLLECTION'
  | 'INVALID_SOURCE_COLLECTION';

export class BusinessDatasetCompletenessError extends Error {
  readonly code: BusinessDatasetCompletenessErrorCode;
  readonly collection?: BusinessDatasetSourceCollectionKey;
  readonly schemaVersion?: number;
  readonly input?: unknown;

  constructor(
    code: BusinessDatasetCompletenessErrorCode,
    message: string,
    context: {
      collection?: BusinessDatasetSourceCollectionKey;
      schemaVersion?: number;
      input?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'BusinessDatasetCompletenessError';
    this.code = code;
    this.collection = context.collection;
    this.schemaVersion = context.schemaVersion;
    this.input = context.input;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates only the complete persisted-dataset envelope required by Phase 5.1A.
 *
 * It deliberately does not validate individual source rows, duplicate identities,
 * references, or Product composition graphs. Those constraints belong to 5.1C and
 * the existing authoritative domain/application contracts.
 */
export function assertBusinessDatasetCompleteness(
  input: unknown,
): asserts input is BusinessDataset {
  if (!isRecord(input)) {
    throw new BusinessDatasetCompletenessError(
      'INVALID_DATASET',
      'Business dataset must be an object.',
      { input },
    );
  }

  const schemaVersion = input.schemaVersion;
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 1
  ) {
    throw new BusinessDatasetCompletenessError(
      'INVALID_SCHEMA_VERSION',
      'Business dataset schemaVersion must be a positive integer.',
      { input: schemaVersion },
    );
  }

  if (schemaVersion !== CURRENT_BUSINESS_DATASET_SCHEMA_VERSION) {
    throw new BusinessDatasetCompletenessError(
      'UNSUPPORTED_SCHEMA_VERSION',
      `Unsupported business dataset schema version ${schemaVersion}. Expected ${CURRENT_BUSINESS_DATASET_SCHEMA_VERSION}.`,
      { schemaVersion, input: schemaVersion },
    );
  }

  for (const collection of BUSINESS_DATASET_SOURCE_COLLECTION_KEYS) {
    if (!(collection in input)) {
      throw new BusinessDatasetCompletenessError(
        'MISSING_SOURCE_COLLECTION',
        `Business dataset is missing required source collection ${collection}.`,
        { collection },
      );
    }

    if (!Array.isArray(input[collection])) {
      throw new BusinessDatasetCompletenessError(
        'INVALID_SOURCE_COLLECTION',
        `Business dataset source collection ${collection} must be an array.`,
        { collection, input: input[collection] },
      );
    }
  }
}

/** Returns the canonical empty persisted source dataset for the current schema. */
export function createEmptyBusinessDataset(): BusinessDataset {
  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [],
    materialCalibrations: [],
    mixPresets: [],
    products: [],
    yieldSamples: [],
    recipeItems: [],
    productComponents: [],
    productStocks: [],
    productFinancialProfiles: [],
  };
}

/**
 * Creates a defensive copy of the complete persisted source dataset.
 *
 * Every collection and every mutable nested source structure is copied so the
 * persistence boundary cannot accidentally share mutable ownership with live state.
 */
export function cloneBusinessDataset(dataset: BusinessDataset): BusinessDataset {
  assertBusinessDatasetCompleteness(dataset);

  return {
    schemaVersion: dataset.schemaVersion,
    materials: dataset.materials.map(cloneMaterial),
    materialCalibrations: dataset.materialCalibrations.map((evidence) => ({ ...evidence })),
    mixPresets: dataset.mixPresets.map(cloneMixPreset),
    products: dataset.products.map(cloneProduct),
    yieldSamples: dataset.yieldSamples.map(cloneYieldSample),
    recipeItems: dataset.recipeItems.map(cloneFixedRecipeItem),
    productComponents: dataset.productComponents.map(cloneProductComponent),
    productStocks: dataset.productStocks.map(cloneProductStock),
    productFinancialProfiles: dataset.productFinancialProfiles.map(
      cloneProductFinancialProfile,
    ),
  };
}

/**
 * Establishes canonical dataset ownership without silently repairing source rows.
 *
 * Phase 5.1A normalization means complete-envelope validation plus defensive cloning.
 * Row/domain/reference normalization and validation remain owned by later Phase 5
 * tasks and the existing source contracts.
 */
export function normalizeBusinessDataset(input: unknown): BusinessDataset {
  assertBusinessDatasetCompleteness(input);
  return cloneBusinessDataset(input);
}
