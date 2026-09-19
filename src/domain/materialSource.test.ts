import { describe, expect, it } from 'vitest';
import {
  MaterialSourceContractError,
  hasMaterialSourceMetadata,
  normalizeMaterialSourceMetadata,
  validateMaterialSourceMetadata,
  type MaterialSourceMetadata,
} from './materialSource';

describe('material source metadata contract', () => {
  it('accepts lightweight supplier/source details without requiring a dedicated supplier entity', () => {
    const source: MaterialSourceMetadata = {
      vendorName: 'Divisoria Craft Supply',
      source: '168 Mall branch',
      purchaseLink: 'https://example.com/plaster',
      contactNumber: '+63 917 123 4567',
      socialPage: '@divisoriacrafts',
      notes: 'Ask for the 1 kg bag price.',
    };

    expect(() => validateMaterialSourceMetadata(source)).not.toThrow();
    expect(hasMaterialSourceMetadata(source)).toBe(true);
  });

  it('allows any single meaningful source field so partial supplier information is still useful', () => {
    expect(() => validateMaterialSourceMetadata({ vendorName: 'Local hardware' })).not.toThrow();
    expect(() => validateMaterialSourceMetadata({ purchaseLink: 'https://example.com/item' })).not.toThrow();
    expect(() => validateMaterialSourceMetadata({ contactNumber: '0917 555 0101' })).not.toThrow();
  });

  it('normalizes whitespace and removes blank fields', () => {
    expect(
      normalizeMaterialSourceMetadata({
        vendorName: '  Craft Store  ',
        source: '   ',
        purchaseLink: ' https://example.com/item ',
        notes: '  Buy white variant  ',
      }),
    ).toEqual({
      vendorName: 'Craft Store',
      purchaseLink: 'https://example.com/item',
      notes: 'Buy white variant',
    });
  });

  it('collapses an all-blank source object to undefined during normalization', () => {
    expect(normalizeMaterialSourceMetadata({ vendorName: ' ', notes: '' })).toBeUndefined();
  });

  it('rejects an empty source object when validating a persisted/imported contract', () => {
    try {
      validateMaterialSourceMetadata({});
      throw new Error('Expected source metadata validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialSourceContractError);
      expect((error as MaterialSourceContractError).code).toBe('EMPTY_SOURCE_METADATA');
    }
  });

  it('rejects non-text source fields at runtime', () => {
    try {
      validateMaterialSourceMetadata({ vendorName: 123 });
      throw new Error('Expected source metadata validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialSourceContractError);
      expect((error as MaterialSourceContractError).code).toBe('INVALID_SOURCE_FIELD');
      expect((error as MaterialSourceContractError).field).toBe('vendorName');
    }
  });

  it('accepts http/https purchase links and rejects unsafe or malformed schemes', () => {
    expect(() => validateMaterialSourceMetadata({ purchaseLink: 'http://example.com/item' })).not.toThrow();
    expect(() => validateMaterialSourceMetadata({ purchaseLink: 'https://example.com/item' })).not.toThrow();

    for (const purchaseLink of ['example.com/item', 'javascript:alert(1)', 'ftp://example.com/item']) {
      try {
        validateMaterialSourceMetadata({ purchaseLink });
        throw new Error('Expected purchase link validation to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(MaterialSourceContractError);
        expect((error as MaterialSourceContractError).code).toBe('INVALID_PURCHASE_LINK');
      }
    }
  });
});
