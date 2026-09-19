import type { ProductPricingQuoteStatus } from '../../application/pricing/ProductPricingQuoteService';
import type { MaterialBackedComponentCostLine } from '../../application/productComponents/MaterialBackedComponentCostService';
import type { RecursiveFullyLoadedProductComponentCostLine } from '../../application/productCosts/RecursiveFullyLoadedProductComponentCostService';
import type { FullyLoadedProductUnitCostComponentLine } from '../../application/productCosts/FullyLoadedProductUnitCostService';
import type { PricingPolicy } from '../../domain/pricing';

export const UNAVAILABLE_FINANCIAL_VALUE = 'Unavailable';

export interface MaterialComponentTraceRow {
  componentId: string;
  role: MaterialBackedComponentCostLine['role'];
  sourceMaterialId: string;
  sourceMaterialName: string | null;
  quantityPerParent: number;
  status: MaterialBackedComponentCostLine['status'];
  costPerPc: number | null;
  componentCostContribution: number | null;
  issues: string[];
}

export interface ProductComponentTraceNode {
  componentId: string;
  role: RecursiveFullyLoadedProductComponentCostLine['role'];
  childProductId: string;
  childProductName: string | null;
  quantityPerParent: number;
  status: RecursiveFullyLoadedProductComponentCostLine['status'];
  path: string[];
  childDirectMaterialMode: RecursiveFullyLoadedProductComponentCostLine['childDirectMaterialMode'];
  baseDirectMaterialCostPerUnit: number | null;
  safetyWasteReserveCostPerUnit: number | null;
  materialComponentCostSubtotal: number;
  productComponentCostSubtotal: number;
  laborCostPerUnit: number | null;
  overheadCostPerUnit: number | null;
  knownChildProductionCostSubtotal: number | null;
  childFullyLoadedUnitCost: number | null;
  knownComponentCostContribution: number | null;
  componentCostContribution: number | null;
  materialComponents: MaterialComponentTraceRow[];
  children: ProductComponentTraceNode[];
  issues: string[];
}

const PHP_NUMBER_FORMAT = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERCENT_NUMBER_FORMAT = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

export function formatPhp(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return UNAVAILABLE_FINANCIAL_VALUE;
  }

  return `PHP ${PHP_NUMBER_FORMAT.format(value)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return UNAVAILABLE_FINANCIAL_VALUE;
  }

  return `${PERCENT_NUMBER_FORMAT.format(value * 100)}%`;
}

export function pricingPolicyLabel(policy: PricingPolicy | null): string {
  if (policy === null) return 'Not configured';

  switch (policy.method) {
    case 'profit-amount':
      return 'Fixed profit';
    case 'markup-percent':
      return 'Markup';
    case 'margin-percent':
      return 'Target margin';
  }
}

export function formatPricingPolicyValue(policy: PricingPolicy | null): string {
  if (policy === null) return UNAVAILABLE_FINANCIAL_VALUE;
  return policy.method === 'profit-amount' ? formatPhp(policy.value) : formatPercent(policy.value);
}

export function quoteReadinessLabel(status: ProductPricingQuoteStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'partial':
      return 'Partial';
    case 'not-ready':
      return 'Not ready';
  }
}

function mapMaterialComponent(line: MaterialBackedComponentCostLine): MaterialComponentTraceRow {
  return {
    componentId: line.componentId,
    role: line.role,
    sourceMaterialId: line.sourceMaterialId,
    sourceMaterialName: line.sourceMaterialName,
    quantityPerParent: line.quantityPerParent,
    status: line.status,
    costPerPc: line.costPerPc,
    componentCostContribution: line.componentCostContribution,
    issues: line.issues.map((issue) => issue.message),
  };
}

function mapProductComponent(
  line: RecursiveFullyLoadedProductComponentCostLine,
): ProductComponentTraceNode {
  const materialComponents: MaterialComponentTraceRow[] = [];
  const children: ProductComponentTraceNode[] = [];

  for (const entry of line.breakdown) {
    if (entry.sourceType === 'material') {
      materialComponents.push(mapMaterialComponent(entry.line));
    } else {
      children.push(mapProductComponent(entry.line));
    }
  }

  return {
    componentId: line.componentId,
    role: line.role,
    childProductId: line.childProductId,
    childProductName: line.childProductName,
    quantityPerParent: line.quantityPerParent,
    status: line.status,
    path: [...line.path],
    childDirectMaterialMode: line.childDirectMaterialMode,
    baseDirectMaterialCostPerUnit:
      line.childDirectMaterialCost?.baseDirectMaterialCostSubtotal ?? null,
    safetyWasteReserveCostPerUnit:
      line.childDirectMaterialCost?.safetyWasteReserveCostSubtotal ?? null,
    materialComponentCostSubtotal: line.childMaterialComponentCostSubtotal,
    productComponentCostSubtotal: line.childProductComponentCostSubtotal,
    laborCostPerUnit: line.childLaborCostPerUnit,
    overheadCostPerUnit: line.childOverheadCostPerUnit,
    knownChildProductionCostSubtotal: line.knownChildProductionCostSubtotal,
    childFullyLoadedUnitCost: line.childFullyLoadedUnitCost,
    knownComponentCostContribution: line.knownComponentCostContribution,
    componentCostContribution: line.componentCostContribution,
    materialComponents,
    children,
    issues: line.issues.map((issue) => issue.message),
  };
}

export function buildProductComponentTrace(
  componentLines: readonly FullyLoadedProductUnitCostComponentLine[],
): ProductComponentTraceNode[] {
  return componentLines
    .filter((entry) => entry.sourceType === 'product')
    .map((entry) => mapProductComponent(entry.line));
}

export function materialComponentTraceRows(
  componentLines: readonly FullyLoadedProductUnitCostComponentLine[],
): MaterialComponentTraceRow[] {
  return componentLines
    .filter((entry) => entry.sourceType === 'material')
    .map((entry) => mapMaterialComponent(entry.line));
}
