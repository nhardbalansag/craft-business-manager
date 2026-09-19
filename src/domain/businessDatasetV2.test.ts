import { describe, expect, it } from 'vitest';
import {
  BUSINESS_DATASET_V2_SCHEMA_VERSION,
  BUSINESS_DATASET_V2_SOURCE_COLLECTION_KEYS,
  BusinessDatasetV2CompletenessError,
  assertBusinessDatasetV2Completeness,
  cloneBusinessDatasetV2,
  createEmptyBusinessDatasetV2,
  normalizeBusinessDatasetV2,
  type BusinessDatasetV2,
} from './businessDatasetV2';
import { validateBusinessDatasetV2Integrity } from './businessDatasetV2Validation';

function dataset(): BusinessDatasetV2 {
  const value = createEmptyBusinessDatasetV2();

  value.products = [
    {
      id: 'PROD-A',
      name: 'Product A',
      category: 'candle',
      safetyWasteRate: 0,
      isActive: true,
    },
    {
      id: 'PROD-ARCHIVED',
      name: 'Archived Product',
      category: 'candle',
      safetyWasteRate: 0,
      isActive: false,
    },
  ];

  value.productPriceTiers = [
    {
      id: 'TIER-0001',
      productId: 'PROD-A',
      name: 'Bulk 20+',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 40,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      notes: 'Wholesale',
      isActive: true,
    },
    {
      id: 'TIER-HISTORICAL',
      productId: 'PROD-ARCHIVED',
      name: 'Historical package',
      kind: 'package',
      priceBasis: 'per-offer',
      priceAmount: 270,
      unitsPerOffer: 6,
      minimumOrderQuantity: 6,
      additionalCostPerOffer: 20,
      isActive: false,
    },
  ];

  return value;
}

describe('BusinessDataset v2', () => {
  it('defines schema v2 with productPriceTiers as the tenth authoritative source collection', () => {
    const value = createEmptyBusinessDatasetV2();

    expect(value.schemaVersion).toBe(BUSINESS_DATASET_V2_SCHEMA_VERSION);
    expect(BUSINESS_DATASET_V2_SCHEMA_VERSION).toBe(2);
    expect(value.productPriceTiers).toEqual([]);
    expect(BUSINESS_DATASET_V2_SOURCE_COLLECTION_KEYS).toContain(
      'productPriceTiers',
    );
    expect(BUSINESS_DATASET_V2_SOURCE_COLLECTION_KEYS).toHaveLength(10);
  });

  it('requires the explicit v2 schema and productPriceTiers collection', () => {
    const missing = createEmptyBusinessDatasetV2() as unknown as Record<
      string,
      unknown
    >;
    delete missing.productPriceTiers;

    expect(() => assertBusinessDatasetV2Completeness(missing)).toThrowError(
      expect.objectContaining({
        name: 'BusinessDatasetV2CompletenessError',
        code: 'MISSING_SOURCE_COLLECTION',
        collection: 'productPriceTiers',
      }),
    );

    const legacy = {
      ...createEmptyBusinessDatasetV2(),
      schemaVersion: 1,
    };

    expect(() => assertBusinessDatasetV2Completeness(legacy)).toThrowError(
      BusinessDatasetV2CompletenessError,
    );
    expect(() => assertBusinessDatasetV2Completeness(legacy)).toThrowError(
      expect.objectContaining({
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        schemaVersion: 1,
      }),
    );
  });

  it('defensively clones tier rows and all existing source collections', () => {
    const source = dataset();
    const cloned = cloneBusinessDatasetV2(source);

    cloned.products[0]!.name = 'Changed Product';
    cloned.productPriceTiers[0]!.name = 'Changed tier';
    cloned.productPriceTiers[0]!.notes = 'Changed notes';

    expect(source.products[0]?.name).toBe('Product A');
    expect(source.productPriceTiers[0]?.name).toBe('Bulk 20+');
    expect(source.productPriceTiers[0]?.notes).toBe('Wholesale');

    source.productPriceTiers[1]!.priceAmount = 999;
    expect(cloned.productPriceTiers[1]?.priceAmount).toBe(270);
  });

  it('normalizes ownership by completeness validation plus defensive cloning only', () => {
    const source = dataset();
    const normalized = normalizeBusinessDatasetV2(source);

    expect(normalized).toEqual(source);
    expect(normalized).not.toBe(source);
    expect(normalized.productPriceTiers).not.toBe(source.productPriceTiers);
    expect(normalized.productPriceTiers[0]).not.toBe(
      source.productPriceTiers[0],
    );
  });

  it('accepts valid active and archived-Product tier source records', () => {
    expect(validateBusinessDatasetV2Integrity(dataset())).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('rejects invalid tier source rows with field-specific paths', () => {
    const value = dataset();
    value.productPriceTiers[0]!.priceAmount = -1;

    const result = validateBusinessDatasetV2Integrity(value);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_RECORD',
          collection: 'productPriceTiers',
          index: 0,
          entityId: 'TIER-0001',
          field: 'priceAmount',
          path: 'productPriceTiers[0].priceAmount',
        }),
      ]),
    );
  });

  it('rejects trim-aware case-insensitive duplicate tier IDs globally', () => {
    const value = dataset();
    value.productPriceTiers.push({
      ...value.productPriceTiers[0]!,
      id: ' tier-0001 ',
      productId: 'PROD-ARCHIVED',
      name: 'Duplicate ID',
      isActive: false,
    });

    const result = validateBusinessDatasetV2Integrity(value);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DUPLICATE_IDENTITY',
          collection: 'productPriceTiers',
          index: 2,
          field: 'id',
          path: 'productPriceTiers[2].id',
        }),
      ]),
    );
  });

  it('requires every tier Product reference to exist but permits archived Products', () => {
    const archived = dataset();
    expect(validateBusinessDatasetV2Integrity(archived).valid).toBe(true);

    const missing = dataset();
    missing.productPriceTiers[0]!.productId = 'MISSING';

    const result = validateBusinessDatasetV2Integrity(missing);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_REFERENCE',
          collection: 'productPriceTiers',
          index: 0,
          field: 'productId',
          path: 'productPriceTiers[0].productId',
        }),
      ]),
    );
  });

  it('retains all existing v1 validation guarantees inside v2', () => {
    const value = dataset();
    value.products[0]!.safetyWasteRate = -1;

    const result = validateBusinessDatasetV2Integrity(value);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_RECORD',
          collection: 'products',
          path: 'products[0].safetyWasteRate',
        }),
      ]),
    );
  });
});
