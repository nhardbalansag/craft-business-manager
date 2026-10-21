import {
  BUSINESS_DATASET_SOURCE_COLLECTION_KEYS,
  cloneBusinessDataset,
  createEmptyBusinessDataset,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
} from './businessDataset';
import {
  cloneProductPriceTier,
  type ProductPriceTier,
} from './productPriceTiers';
import type { BusinessDataset } from './types';

export const BUSINESS_DATASET_V2_SCHEMA_VERSION = 2 as const;

export interface BusinessDatasetV2
  extends Omit<BusinessDataset, 'schemaVersion'> {
  schemaVersion: typeof BUSINESS_DATASET_V2_SCHEMA_VERSION;
  productPriceTiers: ProductPriceTier[];
}

export const BUSINESS_DATASET_V2_SOURCE_COLLECTION_KEYS = [
  ...BUSINESS_DATASET_SOURCE_COLLECTION_KEYS,
  'productPriceTiers',
] as const satisfies readonly (keyof BusinessDatasetV2)[];

export type BusinessDatasetV2SourceCollectionKey =
  (typeof BUSINESS_DATASET_V2_SOURCE_COLLECTION_KEYS)[number];

export type BusinessDatasetV2CompletenessErrorCode =
  | 'INVALID_DATASET'
  | 'INVALID_SCHEMA_VERSION'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'MISSING_SOURCE_COLLECTION'
  | 'INVALID_SOURCE_COLLECTION';

export class BusinessDatasetV2CompletenessError extends Error {
  readonly code: BusinessDatasetV2CompletenessErrorCode;
  readonly collection?: BusinessDatasetV2SourceCollectionKey;
  readonly schemaVersion?: number;
  readonly input?: unknown;

  constructor(
    code: BusinessDatasetV2CompletenessErrorCode,
    message: string,
    context: {
      collection?: BusinessDatasetV2SourceCollectionKey;
      schemaVersion?: number;
      input?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'BusinessDatasetV2CompletenessError';
    this.code = code;
    this.collection = context.collection;
    this.schemaVersion = context.schemaVersion;
    this.input = context.input;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertBusinessDatasetV2Completeness(
  input: unknown,
): asserts input is BusinessDatasetV2 {
  if (!isRecord(input)) {
    throw new BusinessDatasetV2CompletenessError(
      'INVALID_DATASET',
      'Business dataset v2 must be an object.',
      { input },
    );
  }

  const schemaVersion = input.schemaVersion;
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 1
  ) {
    throw new BusinessDatasetV2CompletenessError(
      'INVALID_SCHEMA_VERSION',
      'Business dataset v2 schemaVersion must be a positive integer.',
      { input: schemaVersion },
    );
  }

  if (schemaVersion !== BUSINESS_DATASET_V2_SCHEMA_VERSION) {
    throw new BusinessDatasetV2CompletenessError(
      'UNSUPPORTED_SCHEMA_VERSION',
      `Unsupported business dataset v2 schema version ${schemaVersion}. Expected ${BUSINESS_DATASET_V2_SCHEMA_VERSION}.`,
      { schemaVersion, input: schemaVersion },
    );
  }

  for (const collection of BUSINESS_DATASET_V2_SOURCE_COLLECTION_KEYS) {
    if (!(collection in input)) {
      throw new BusinessDatasetV2CompletenessError(
        'MISSING_SOURCE_COLLECTION',
        `Business dataset v2 is missing required source collection ${collection}.`,
        { collection },
      );
    }

    if (!Array.isArray(input[collection])) {
      throw new BusinessDatasetV2CompletenessError(
        'INVALID_SOURCE_COLLECTION',
        `Business dataset v2 source collection ${collection} must be an array.`,
        { collection, input: input[collection] },
      );
    }
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

export function createEmptyBusinessDatasetV2(): BusinessDatasetV2 {
  const base = createEmptyBusinessDataset();
  return {
    ...base,
    schemaVersion: BUSINESS_DATASET_V2_SCHEMA_VERSION,
    productPriceTiers: [],
  };
}

export function cloneBusinessDatasetV2(
  dataset: BusinessDatasetV2,
): BusinessDatasetV2 {
  assertBusinessDatasetV2Completeness(dataset);
  const base = cloneBusinessDataset(baseDatasetV1(dataset));

  return {
    ...base,
    schemaVersion: BUSINESS_DATASET_V2_SCHEMA_VERSION,
    productPriceTiers: dataset.productPriceTiers.map(cloneProductPriceTier),
  };
}

export function normalizeBusinessDatasetV2(input: unknown): BusinessDatasetV2 {
  assertBusinessDatasetV2Completeness(input);
  return cloneBusinessDatasetV2(input);
}
