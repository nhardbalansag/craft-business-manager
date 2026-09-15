import type { ProductComponent } from '../../domain/productComponents';
import type { ProductStock } from '../../domain/productStock';
import type { Product } from '../../domain/products';

export type ProductStockRowState = 'missing' | 'zero' | 'available';

export interface ProductStockRow {
  productId: string;
  productName: string;
  productCategory: Product['category'];
  productIsActive: boolean;
  stockState: ProductStockRowState;
  onHandQuantity: number | null;
  notes?: string;
  stockRecordExists: boolean;
  usedAsChild: boolean;
  parentProductIds: string[];
  parentProductNames: string[];
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

export function buildProductStockRows(
  products: readonly Product[],
  components: readonly ProductComponent[],
  stocks: readonly ProductStock[],
): ProductStockRow[] {
  const productsByKey = new Map(products.map((product) => [comparable(product.id), product]));
  const stocksByProductKey = new Map(stocks.map((stock) => [comparable(stock.productId), stock]));
  const parentIdsByChildKey = new Map<string, Set<string>>();

  for (const component of components) {
    if (component.sourceType !== 'product') continue;

    const childKey = comparable(component.sourceId);
    if (!productsByKey.has(childKey)) continue;

    const parents = parentIdsByChildKey.get(childKey) ?? new Set<string>();
    const parent = productsByKey.get(comparable(component.parentProductId));
    parents.add(parent?.id ?? component.parentProductId);
    parentIdsByChildKey.set(childKey, parents);
  }

  const relevantKeys = new Set<string>();
  for (const childKey of parentIdsByChildKey.keys()) relevantKeys.add(childKey);
  for (const stock of stocks) {
    const productKey = comparable(stock.productId);
    if (productsByKey.has(productKey)) relevantKeys.add(productKey);
  }

  return [...relevantKeys]
    .map((productKey): ProductStockRow | null => {
      const product = productsByKey.get(productKey);
      if (!product) return null;

      const stock = stocksByProductKey.get(productKey) ?? null;
      const parentIds = [...(parentIdsByChildKey.get(productKey) ?? new Set<string>())]
        .sort(compareText);
      const parentPairs = parentIds
        .map((parentId) => {
          const parent = productsByKey.get(comparable(parentId));
          return {
            id: parent?.id ?? parentId,
            name: parent?.name ?? parentId,
          };
        })
        .sort((left, right) => compareText(left.name, right.name) || compareText(left.id, right.id));

      const onHandQuantity = stock?.onHandQuantity ?? null;
      const stockState: ProductStockRowState = stock === null
        ? 'missing'
        : stock.onHandQuantity === 0
          ? 'zero'
          : 'available';

      return {
        productId: product.id,
        productName: product.name,
        productCategory: product.category,
        productIsActive: product.isActive,
        stockState,
        onHandQuantity,
        notes: stock?.notes,
        stockRecordExists: stock !== null,
        usedAsChild: parentPairs.length > 0,
        parentProductIds: parentPairs.map((parent) => parent.id),
        parentProductNames: parentPairs.map((parent) => parent.name),
      };
    })
    .filter((row): row is ProductStockRow => row !== null)
    .sort((left, right) =>
      compareText(left.productName, right.productName) || compareText(left.productId, right.productId),
    );
}
