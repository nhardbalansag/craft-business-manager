import { describe, expect, it } from 'vitest';
import type { Material } from './materials';
import {
  cloneProductComponent,
  getProductComponentSourceKey,
  hasSameProductComponentSource,
  isProductComponentRole,
  isProductComponentSourceType,
  normalizeProductComponent,
  ProductComponentError,
  type ProductComponent,
  validateMaterialBackedProductComponent,
  validateProductComponentContract,
} from './productComponents';

const glassVessel: Material = {
  id: 'MAT-GLASS',
  name: 'Glass Vessel',
  group: 'container',
  baseUnit: 'pc',
  purchaseQuantity: 12,
  purchaseUnit: 'pc',
  packageCost: 240,
  onHandQuantity: 12,
  onHandUnit: 'pc',
  isActive: true,
};

const wax: Material = {
  id: 'MAT-WAX',
  name: 'Soy Wax',
  group: 'wax',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 200,
  onHandQuantity: 1,
  onHandUnit: 'kg',
  isActive: true,
};

const materialComponent: ProductComponent = {
  id: 'PC-CANDLE-GLASS',
  parentProductId: 'CND-001',
  sourceType: 'material',
  sourceId: 'MAT-GLASS',
  role: 'vessel',
  quantityPerParent: 1,
  notes: 'Main candle vessel',
};

const productComponent: ProductComponent = {
  id: 'PC-SET-HEART',
  parentProductId: 'SET-001',
  sourceType: 'product',
  sourceId: 'ART-HEART',
  role: 'molded-component',
  quantityPerParent: 3,
};

describe('product component contract', () => {
  it('accepts material-backed and product-backed source records', () => {
    expect(() => validateProductComponentContract(materialComponent)).not.toThrow();
    expect(() => validateProductComponentContract(productComponent)).not.toThrow();
  });

  it('exposes only the planned source types and structural roles', () => {
    expect(isProductComponentSourceType('material')).toBe(true);
    expect(isProductComponentSourceType('product')).toBe(true);
    expect(isProductComponentSourceType('recipe')).toBe(false);

    expect(isProductComponentRole('vessel')).toBe(true);
    expect(isProductComponentRole('molded-component')).toBe(true);
    expect(isProductComponentRole('decorative-component')).toBe(true);
    expect(isProductComponentRole('insert')).toBe(true);
    expect(isProductComponentRole('accessory')).toBe(true);
    expect(isProductComponentRole('other')).toBe(true);
    expect(isProductComponentRole('packaging')).toBe(false);
    expect(isProductComponentRole('decoration')).toBe(false);
  });

  it('rejects blank component, parent, and source identities', () => {
    expect(() => validateProductComponentContract({ ...materialComponent, id: '   ' })).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'INVALID_ID' }),
    );
    expect(() =>
      validateProductComponentContract({ ...materialComponent, parentProductId: ' ' }),
    ).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'INVALID_PARENT_PRODUCT_ID' }),
    );
    expect(() =>
      validateProductComponentContract({ ...materialComponent, sourceId: '\t' }),
    ).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'INVALID_SOURCE_ID' }),
    );
  });

  it('rejects unsupported source types and roles at runtime', () => {
    expect(() =>
      validateProductComponentContract({
        ...materialComponent,
        sourceType: 'inventory' as ProductComponent['sourceType'],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'INVALID_SOURCE_TYPE' }),
    );

    expect(() =>
      validateProductComponentContract({
        ...materialComponent,
        role: 'packaging' as ProductComponent['role'],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'INVALID_ROLE' }),
    );
  });

  it('enforces finite positive whole-piece quantities', () => {
    expect(() =>
      validateProductComponentContract({ ...materialComponent, quantityPerParent: Number.NaN }),
    ).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'NON_FINITE_QUANTITY' }),
    );
    expect(() =>
      validateProductComponentContract({ ...materialComponent, quantityPerParent: Number.POSITIVE_INFINITY }),
    ).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'NON_FINITE_QUANTITY' }),
    );
    expect(() =>
      validateProductComponentContract({ ...materialComponent, quantityPerParent: 1.5 }),
    ).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'NON_INTEGER_QUANTITY' }),
    );
    expect(() =>
      validateProductComponentContract({ ...materialComponent, quantityPerParent: 0 }),
    ).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'NON_POSITIVE_QUANTITY' }),
    );
    expect(() =>
      validateProductComponentContract({ ...materialComponent, quantityPerParent: -1 }),
    ).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'NON_POSITIVE_QUANTITY' }),
    );
  });

  it('normalizes identity text and omits blank notes without changing source facts', () => {
    const normalized = normalizeProductComponent({
      ...productComponent,
      id: '  PC-SET-HEART  ',
      parentProductId: '  SET-001 ',
      sourceId: ' ART-HEART  ',
      notes: '   ',
    });

    expect(normalized).toEqual({
      ...productComponent,
      id: 'PC-SET-HEART',
      parentProductId: 'SET-001',
      sourceId: 'ART-HEART',
      notes: undefined,
    });

    const withNotes = normalizeProductComponent({ ...productComponent, notes: '  front accent  ' });
    expect(withNotes.notes).toBe('front accent');
  });

  it('clones source records independently', () => {
    const clone = cloneProductComponent(materialComponent);
    expect(clone).toEqual(materialComponent);
    expect(clone).not.toBe(materialComponent);
  });

  it('defines duplicate identity by parent + source type + source ID, case-insensitively', () => {
    const sameSourceDifferentRole: ProductComponent = {
      ...materialComponent,
      id: 'PC-OTHER',
      parentProductId: ' cnd-001 ',
      sourceId: ' mat-glass ',
      role: 'accessory',
      quantityPerParent: 2,
    };

    expect(hasSameProductComponentSource(materialComponent, sameSourceDifferentRole)).toBe(true);
    expect(getProductComponentSourceKey(materialComponent)).toBe('cnd-001::material::mat-glass');

    expect(
      hasSameProductComponentSource(materialComponent, {
        ...sameSourceDifferentRole,
        sourceType: 'product',
      }),
    ).toBe(false);
    expect(
      hasSameProductComponentSource(materialComponent, {
        ...sameSourceDifferentRole,
        parentProductId: 'CND-002',
      }),
    ).toBe(false);
  });

  it('accepts count-based material-backed components', () => {
    expect(() => validateMaterialBackedProductComponent(materialComponent, glassVessel)).not.toThrow();
  });

  it('rejects material compatibility checks for product-backed lines', () => {
    expect(() => validateMaterialBackedProductComponent(productComponent, glassVessel)).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'SOURCE_TYPE_MISMATCH' }),
    );
  });

  it('rejects a material whose identity does not match the component source', () => {
    expect(() => validateMaterialBackedProductComponent(materialComponent, { ...glassVessel, id: 'MAT-CUP' })).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'SOURCE_ID_MISMATCH' }),
    );
  });

  it('rejects continuous materials as discrete component sources', () => {
    const waxComponent: ProductComponent = {
      ...materialComponent,
      id: 'PC-CANDLE-WAX',
      sourceId: 'MAT-WAX',
      role: 'other',
    };

    expect(() => validateMaterialBackedProductComponent(waxComponent, wax)).toThrowError(
      expect.objectContaining<Partial<ProductComponentError>>({ code: 'NON_COUNT_MATERIAL_SOURCE' }),
    );
  });
});
