import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import type { WasteAdjustedDirectMaterialCostResult } from '../../application/productCosts/WasteAdjustedDirectMaterialCostService';
import type { FullyLoadedProductUnitCostComponentLine } from '../../application/productCosts/FullyLoadedProductUnitCostService';
import type { RecursiveFullyLoadedProductComponentCostLine } from '../../application/productCosts/RecursiveFullyLoadedProductComponentCostService';
import type { Material } from '../../domain/materials';

/** Material consumption and costing for the private quotation report only. */
export interface OwnerQuotationMaterialLine {
  materialId: string;
  materialName: string;
  unit: Material['baseUnit'];
  source: string;
  quantityPerProduct: number;
  totalQuantity: number;
  unitCost: number | null;
  totalCost: number | null;
}

export interface OwnerQuotationMaterialTotal {
  materialId: string;
  materialName: string;
  unit: Material['baseUnit'];
  totalQuantity: number;
  unitCost: number | null;
  totalCost: number | null;
  contributingProducts: number;
}

/** A missing/partial price-cost graph must not be represented as zero materials. */
export interface OwnerQuotationMaterialBreakdown {
  lines: OwnerQuotationMaterialLine[];
  totalMaterialCost: number | null;
  complete: boolean;
}

const valid = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const idKey = (id: string): string => id.trim().toLocaleLowerCase();

type QuoteCost = ProductPriceResolutionResult['integratedQuote']['fullyLoadedUnitCost'];

function costBreakdown(
  result: QuoteCost | undefined,
  quantity: number,
  materials: readonly Pick<Material, 'id' | 'name'>[],
): OwnerQuotationMaterialBreakdown {
  const lines: OwnerQuotationMaterialLine[] = [];
  let complete = Boolean(result && Array.isArray(result.componentLines));
  if (!result || !Array.isArray(result.componentLines)) {
    return { lines, totalMaterialCost: null, complete: false };
  }

  const names = new Map(materials.map((material) => [idKey(material.id), material.name]));

  function addMaterial(
    materialId: string,
    fallbackName: string | null,
    unit: Material['baseUnit'],
    source: string,
    quantityPerProduct: number,
    costPerUnit: number | null,
    totalCostPerProduct: number | null,
    multiplier: number,
  ) {
    const usage = quantityPerProduct * multiplier;
    const cost = totalCostPerProduct === null ? null : totalCostPerProduct * multiplier * quantity;
    if (!valid(usage) || !valid(cost) && cost !== null || !valid(multiplier)) complete = false;
    if (cost === null) complete = false;

    lines.push({
      materialId,
      materialName: names.get(idKey(materialId)) ?? fallbackName ?? materialId,
      unit,
      source,
      quantityPerProduct: valid(usage) ? usage : 0,
      totalQuantity: valid(usage * quantity) ? usage * quantity : 0,
      unitCost: valid(costPerUnit) ? costPerUnit : null,
      totalCost: valid(cost) ? cost : null,
    });
  }

  function addDirect(
    direct: WasteAdjustedDirectMaterialCostResult | null,
    mode: 'costed' | 'neutral-component-only' | 'unresolved',
    multiplier: number,
    source: string,
  ) {
    if (mode === 'neutral-component-only' && direct?.lines.length === 0) return;
    if (!direct || direct.status !== 'ready' || mode !== 'costed') complete = false;
    if (!direct) return;
    for (const line of direct.lines) {
      const ready = line.status === 'ready' &&
        valid(line.pricingDirectMaterialCostPerUnit) &&
        valid(line.costPerBaseUnit);
      addMaterial(
        line.materialId, null, line.baseUnit, source,
        line.plannedBaseQuantityPerProduct,
        ready ? line.costPerBaseUnit : null,
        ready ? line.pricingDirectMaterialCostPerUnit : null,
        multiplier,
      );
    }
  }

  function addComponent(
    component: FullyLoadedProductUnitCostComponentLine,
    multiplier: number,
    source: string,
  ) {
    if (component.sourceType === 'material') {
      const line = component.line;
      const ready = line.status === 'ready' &&
        valid(line.costPerPc) && valid(line.componentCostContribution);
      addMaterial(
        line.sourceMaterialId, line.sourceMaterialName, 'pc',
        source === 'Root' ? 'Material component' : `${source} / Material component`,
        line.quantityPerParent, ready ? line.costPerPc : null,
        ready ? line.componentCostContribution : null,
        multiplier,
      );
    } else {
      addChild(component.line, multiplier, source);
    }
  }

  function addChild(
    child: RecursiveFullyLoadedProductComponentCostLine,
    multiplier: number,
    source: string,
  ) {
    const next = multiplier * child.quantityPerParent;
    const childPath = source === 'Root'
      ? `Product component: ${child.childProductName ?? child.childProductId}`
      : `${source} / ${child.childProductName ?? child.childProductId}`;
    if (!valid(next) || child.status !== 'ready') complete = false;
    if (!valid(next)) return;
    addDirect(child.childDirectMaterialCost, child.childDirectMaterialMode, next, childPath);
    for (const part of child.breakdown) {
      // These lines were already costed for one child Product. Apply each
      // parent/child usage multiplier only once at each recursive level.
      if (part.sourceType === 'material') {
        const line = part.line;
        const ready = line.status === 'ready' &&
          valid(line.costPerPc) && valid(line.componentCostContribution);
        addMaterial(
          line.sourceMaterialId, line.sourceMaterialName, 'pc',
          `${childPath} / Material component`,
          line.quantityPerParent,
          ready ? line.costPerPc : null,
          ready ? line.componentCostContribution : null,
          next,
        );
      } else {
        addChild(part.line, next, childPath);
      }
    }
  }

  addDirect(result.directMaterialCost, result.directMaterialMode, 1, 'Yield / recipe (includes safety waste)');
  for (const component of result.componentLines) addComponent(component, 1, 'Root');

  const total = complete
    ? lines.reduce((sum, line) => sum + (line.totalCost ?? 0), 0)
    : null;
  return {
    lines,
    totalMaterialCost: total !== null && valid(total) ? total : null,
    complete: complete && total !== null && valid(total),
  };
}

export function resolveOwnerQuotationMaterials(
  resolution: ProductPriceResolutionResult,
  materials: readonly Pick<Material, 'id' | 'name'>[] = [],
): OwnerQuotationMaterialBreakdown {
  return costBreakdown(
    resolution.integratedQuote?.fullyLoadedUnitCost,
    resolution.quantity,
    materials,
  );
}

/** Sum usage across all quoted Products, consolidating the same material+unit.
 * Partial/missing costs are never treated as zero when computing totals.
 */
export function summarizeOwnerQuotationMaterials(
  items: readonly {
    productId: string;
    materialLines: readonly OwnerQuotationMaterialLine[];
    materialBreakdownComplete: boolean;
  }[],
): { materials: OwnerQuotationMaterialTotal[]; totalMaterialCost: number | null; complete: boolean } {
  const summary = new Map<string, OwnerQuotationMaterialTotal & { incomplete: boolean; productIds: Set<string> }>();
  let complete = items.every((item) => item.materialBreakdownComplete);
  for (const item of items) {
    for (const line of item.materialLines) {
      const key = `${idKey(line.materialId)}\u0000${line.unit}`;
      const current = summary.get(key) ?? {
        materialId: line.materialId,
        materialName: line.materialName,
        unit: line.unit,
        totalQuantity: 0,
        unitCost: null,
        totalCost: 0,
        contributingProducts: 0,
        incomplete: false,
        productIds: new Set<string>(),
      };
      current.totalQuantity += line.totalQuantity;
      current.productIds.add(item.productId);
      current.contributingProducts = current.productIds.size;
      if (line.totalCost === null || !valid(line.totalCost)) {
        current.incomplete = true;
      } else {
        current.totalCost = (current.totalCost ?? 0) + line.totalCost;
      }
      summary.set(key, current);
    }
  }
  const materials = [...summary.values()].map((material): OwnerQuotationMaterialTotal => {
    const quantity = material.totalQuantity;
    const cost = material.incomplete || !valid(material.totalCost) || !valid(quantity)
      ? null : material.totalCost;
    if (cost === null) complete = false;
    return {
      materialId: material.materialId,
      materialName: material.materialName,
      unit: material.unit,
      totalQuantity: valid(quantity) ? quantity : 0,
      unitCost: cost !== null && quantity > 0 ? cost / quantity : null,
      totalCost: cost,
      contributingProducts: material.contributingProducts,
    };
  }).sort((a, b) => a.materialName.localeCompare(b.materialName) ||
    a.materialId.localeCompare(b.materialId) || a.unit.localeCompare(b.unit));
  return {
    materials,
    totalMaterialCost: complete ? materials.reduce((sum, line) => sum + line.totalCost!, 0) : null,
    complete,
  };
}
