import {
  cloneBusinessDatasetV2,
  type BusinessDatasetV2,
} from './businessDatasetV2';
import {
  validateBusinessDatasetV2Integrity,
  type BusinessDatasetV2ValidationIssue,
} from './businessDatasetV2Validation';
import {
  validatePhysicalIdentificationSources,
  type PhysicalBusinessDataset,
} from './physicalBusinessDataset';
import { cloneMold, type Mold } from './molds';
import { cloneStorageLocation, type StorageLocation } from './storageLocations';

export const PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION = 3 as const;

export interface PhysicalBusinessDatasetV3
  extends Omit<BusinessDatasetV2, 'schemaVersion'> {
  schemaVersion: typeof PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION;
  storageLocations: StorageLocation[];
  molds: Mold[];
}

export interface PhysicalBusinessDatasetV3ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface PhysicalBusinessDatasetV3ValidationResult {
  valid: boolean;
  issues: readonly PhysicalBusinessDatasetV3ValidationIssue[];
}

export function toBusinessDatasetV2(
  dataset: PhysicalBusinessDatasetV3,
): BusinessDatasetV2 {
  return cloneBusinessDatasetV2({
    schemaVersion: 2,
    materials: dataset.materials,
    materialCalibrations: dataset.materialCalibrations,
    mixPresets: dataset.mixPresets,
    products: dataset.products,
    yieldSamples: dataset.yieldSamples,
    recipeItems: dataset.recipeItems,
    productComponents: dataset.productComponents,
    productStocks: dataset.productStocks,
    productFinancialProfiles: dataset.productFinancialProfiles,
    productPriceTiers: dataset.productPriceTiers,
  });
}

export function extendBusinessDatasetV2(
  dataset: BusinessDatasetV2,
  storageLocations: readonly StorageLocation[] = [],
  molds: readonly Mold[] = [],
): PhysicalBusinessDatasetV3 {
  const core = cloneBusinessDatasetV2(dataset);
  return {
    ...core,
    schemaVersion: PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION,
    storageLocations: storageLocations.map(cloneStorageLocation),
    molds: molds.map(cloneMold),
  };
}

export function clonePhysicalBusinessDatasetV3(
  dataset: PhysicalBusinessDatasetV3,
): PhysicalBusinessDatasetV3 {
  return extendBusinessDatasetV2(
    toBusinessDatasetV2(dataset),
    dataset.storageLocations,
    dataset.molds,
  );
}

function legacyPhysicalView(
  dataset: PhysicalBusinessDatasetV3,
): PhysicalBusinessDataset {
  return {
    schemaVersion: 2,
    materials: dataset.materials,
    materialCalibrations: dataset.materialCalibrations,
    mixPresets: dataset.mixPresets,
    products: dataset.products,
    yieldSamples: dataset.yieldSamples,
    recipeItems: dataset.recipeItems,
    productComponents: dataset.productComponents,
    productStocks: dataset.productStocks,
    productFinancialProfiles: dataset.productFinancialProfiles,
    storageLocations: dataset.storageLocations,
    molds: dataset.molds,
  };
}

function mapCoreIssue(
  issue: BusinessDatasetV2ValidationIssue,
): PhysicalBusinessDatasetV3ValidationIssue {
  return {
    code: issue.code,
    path: issue.path,
    message: issue.message,
  };
}

export function validatePhysicalBusinessDatasetV3Integrity(
  input: unknown,
): PhysicalBusinessDatasetV3ValidationResult {
  if (
    typeof input !== 'object' ||
    input === null ||
    !Array.isArray(
      (input as Partial<PhysicalBusinessDatasetV3>).storageLocations,
    ) ||
    !Array.isArray((input as Partial<PhysicalBusinessDatasetV3>).molds)
  ) {
    return {
      valid: false,
      issues: [
        {
          code: 'INVALID_DATASET',
          path: '$',
          message:
            'Physical business dataset v3 must include storageLocations and molds arrays.',
        },
      ],
    };
  }

  const dataset = input as PhysicalBusinessDatasetV3;
  if (
    dataset.schemaVersion !== PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION
  ) {
    return {
      valid: false,
      issues: [
        {
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          path: 'schemaVersion',
          message:
            `Physical business dataset schema version must be ${PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION}.`,
        },
      ],
    };
  }

  const coreValidation = validateBusinessDatasetV2Integrity({
    ...dataset,
    schemaVersion: 2,
  });

  const physicalIssues = validatePhysicalIdentificationSources(
    legacyPhysicalView(dataset),
  );

  const issues: PhysicalBusinessDatasetV3ValidationIssue[] = [
    ...coreValidation.issues.map(mapCoreIssue),
    ...physicalIssues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    })),
  ];

  return {
    valid: issues.length === 0,
    issues,
  };
}
