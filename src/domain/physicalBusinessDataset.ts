import { cloneBusinessDataset } from './businessDataset';
import { cloneMold, validateMoldContract, type Mold } from './molds';
import { cloneStorageLocation, validateStorageLocationContract, type StorageLocation } from './storageLocations';
import type { BusinessDataset } from './types';

export const CURRENT_PHYSICAL_DATASET_SCHEMA_VERSION = 2 as const;

export interface PhysicalBusinessDataset extends Omit<BusinessDataset, 'schemaVersion'> {
  schemaVersion: typeof CURRENT_PHYSICAL_DATASET_SCHEMA_VERSION;
  storageLocations: StorageLocation[];
  molds: Mold[];
}

export interface PhysicalDatasetValidationIssue {
  code:
    | 'INVALID_BASE_DATASET'
    | 'INVALID_RECORD'
    | 'DUPLICATE_IDENTITY'
    | 'MISSING_REFERENCE'
    | 'INVALID_HIERARCHY';
  path: string;
  message: string;
}

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function toLegacyBusinessDataset(dataset: PhysicalBusinessDataset): BusinessDataset {
  return cloneBusinessDataset({
    schemaVersion: 1,
    materials: dataset.materials,
    materialCalibrations: dataset.materialCalibrations,
    mixPresets: dataset.mixPresets,
    products: dataset.products,
    yieldSamples: dataset.yieldSamples,
    recipeItems: dataset.recipeItems,
    productComponents: dataset.productComponents,
    productStocks: dataset.productStocks,
    productFinancialProfiles: dataset.productFinancialProfiles,
  });
}

export function extendLegacyBusinessDataset(
  dataset: BusinessDataset,
  storageLocations: readonly StorageLocation[] = [],
  molds: readonly Mold[] = [],
): PhysicalBusinessDataset {
  const legacy = cloneBusinessDataset(dataset);
  return {
    ...legacy,
    schemaVersion: CURRENT_PHYSICAL_DATASET_SCHEMA_VERSION,
    storageLocations: storageLocations.map(cloneStorageLocation),
    molds: molds.map(cloneMold),
  };
}

export function clonePhysicalBusinessDataset(dataset: PhysicalBusinessDataset): PhysicalBusinessDataset {
  return extendLegacyBusinessDataset(
    toLegacyBusinessDataset(dataset),
    dataset.storageLocations,
    dataset.molds,
  );
}

export function validatePhysicalIdentificationSources(
  dataset: PhysicalBusinessDataset,
): readonly PhysicalDatasetValidationIssue[] {
  const issues: PhysicalDatasetValidationIssue[] = [];

  dataset.storageLocations.forEach((location, index) => {
    try {
      validateStorageLocationContract(location);
    } catch (error) {
      issues.push({
        code: 'INVALID_RECORD',
        path: `storageLocations[${index}]`,
        message: error instanceof Error ? error.message : 'Invalid storage location.',
      });
    }
  });

  dataset.molds.forEach((mold, index) => {
    try {
      validateMoldContract(mold);
    } catch (error) {
      issues.push({
        code: 'INVALID_RECORD',
        path: `molds[${index}]`,
        message: error instanceof Error ? error.message : 'Invalid mold.',
      });
    }
  });

  const locationIds = new Map<string, number>();
  const siblingNames = new Map<string, number>();
  dataset.storageLocations.forEach((location, index) => {
    const idKey = canonical(location.id);
    if (idKey) {
      const first = locationIds.get(idKey);
      if (first !== undefined) {
        issues.push({
          code: 'DUPLICATE_IDENTITY',
          path: `storageLocations[${index}].id`,
          message: `Storage location ID duplicates storageLocations[${first}].id.`,
        });
      } else locationIds.set(idKey, index);
    }

    const siblingKey = `${location.type}:${canonical(location.parentId ?? '')}:${canonical(location.name)}`;
    if (location.name.trim()) {
      const first = siblingNames.get(siblingKey);
      if (first !== undefined) {
        issues.push({
          code: 'DUPLICATE_IDENTITY',
          path: `storageLocations[${index}].name`,
          message: `Storage location name duplicates a sibling at storageLocations[${first}].name.`,
        });
      } else siblingNames.set(siblingKey, index);
    }
  });

  const locationsById = new Map(
    dataset.storageLocations.map((location) => [canonical(location.id), location] as const),
  );

  dataset.storageLocations.forEach((location, index) => {
    const expectedParentType = location.type === 'shelf' ? 'rack' : location.type === 'bin' ? 'shelf' : null;
    if (!expectedParentType) {
      if (location.parentId) {
        issues.push({
          code: 'INVALID_HIERARCHY',
          path: `storageLocations[${index}].parentId`,
          message: 'Rack storage locations cannot have a parent.',
        });
      }
      return;
    }

    if (!location.parentId) {
      issues.push({
        code: 'INVALID_HIERARCHY',
        path: `storageLocations[${index}].parentId`,
        message: `${location.type} storage locations require a ${expectedParentType} parent.`,
      });
      return;
    }

    const parent = locationsById.get(canonical(location.parentId));
    if (!parent) {
      issues.push({
        code: 'MISSING_REFERENCE',
        path: `storageLocations[${index}].parentId`,
        message: `Storage parent does not exist: ${location.parentId}.`,
      });
      return;
    }
    if (parent.type !== expectedParentType) {
      issues.push({
        code: 'INVALID_HIERARCHY',
        path: `storageLocations[${index}].parentId`,
        message: `${location.type} ${location.id} must belong to a ${expectedParentType}.`,
      });
    }
    if (location.isActive && !parent.isActive) {
      issues.push({
        code: 'INVALID_HIERARCHY',
        path: `storageLocations[${index}].parentId`,
        message: `Active storage location ${location.id} cannot belong to archived parent ${parent.id}.`,
      });
    }
  });

  for (const location of dataset.storageLocations) {
    const seen = new Set<string>();
    let current: StorageLocation | undefined = location;
    while (current?.parentId) {
      const key = canonical(current.id);
      if (seen.has(key)) {
        const index = dataset.storageLocations.findIndex((item) => canonical(item.id) === canonical(location.id));
        issues.push({
          code: 'INVALID_HIERARCHY',
          path: `storageLocations[${index}].parentId`,
          message: `Storage hierarchy contains a cycle involving ${location.id}.`,
        });
        break;
      }
      seen.add(key);
      current = locationsById.get(canonical(current.parentId));
    }
  }

  const productIds = new Set(dataset.products.map((product) => canonical(product.id)));
  const moldIds = new Map<string, number>();
  const moldNames = new Map<string, number>();
  dataset.molds.forEach((mold, index) => {
    const idKey = canonical(mold.id);
    const firstId = moldIds.get(idKey);
    if (firstId !== undefined) {
      issues.push({
        code: 'DUPLICATE_IDENTITY',
        path: `molds[${index}].id`,
        message: `Mold ID duplicates molds[${firstId}].id.`,
      });
    } else moldIds.set(idKey, index);

    const nameKey = `${canonical(mold.productId)}:${canonical(mold.name)}`;
    const firstName = moldNames.get(nameKey);
    if (firstName !== undefined) {
      issues.push({
        code: 'DUPLICATE_IDENTITY',
        path: `molds[${index}].name`,
        message: `Mold name duplicates another mold for product ${mold.productId}.`,
      });
    } else moldNames.set(nameKey, index);

    if (!productIds.has(canonical(mold.productId))) {
      issues.push({
        code: 'MISSING_REFERENCE',
        path: `molds[${index}].productId`,
        message: `Referenced Product does not exist: ${mold.productId}.`,
      });
    }
    if (mold.storageLocationId && !locationsById.has(canonical(mold.storageLocationId))) {
      issues.push({
        code: 'MISSING_REFERENCE',
        path: `molds[${index}].storageLocationId`,
        message: `Referenced Storage Location does not exist: ${mold.storageLocationId}.`,
      });
    }
  });

  return issues;
}
