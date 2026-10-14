import { normalizeMaterialOnHand } from '../../domain/materialInventory';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import type { PlasterMoldOperationalPreviewResult } from '../../application/plasterMoldYieldProfiles/PlasterMoldOperationalPreviewService';
import type { ProductionRequirementPlanResult } from '../../application/production/ProductionRequirementService';

export interface MultiProductionEntry {
  product: Product;
  quantity: number;
  plan: ProductionRequirementPlanResult | null;
  formula: PlasterMoldOperationalPreviewResult | null;
  profile: PlasterMoldYieldProfile | null;
  error?: string;
  formulaError?: string;
}

export interface CombinedMaterialRow {
  materialId: string;
  name: string;
  unit: Material['baseUnit'];
  required: number;
  available: number | null;
  shortage: number | null;
}

export interface ProductionMixGroup {
  key: string;
  profileIds: string[];
  products: { id: string; name: string; quantity: number; moldName: string; pours: number }[];
  requiredPours: number;
  totalMixtureGrams: number;
  materials: { role: 'water' | 'plaster' | 'glue'; materialId: string; name: string; grams: number }[];
}

export interface MultiProductionSummary {
  products: number;
  finishedPieces: number;
  ready: boolean;
  warnings: string[];
  directMaterials: CombinedMaterialRow[];
  formulaMaterials: CombinedMaterialRow[];
  mixtureGroups: ProductionMixGroup[];
  formulaMixtureGrams: number;
}

const key = (value: string) => value.trim().toLocaleLowerCase();

function stockFor(material: Material | undefined): number | null {
  if (!material) return null;
  try {
    const stock = normalizeMaterialOnHand(material).normalizedBaseQuantity;
    return Number.isFinite(stock) && stock >= 0 ? stock : null;
  } catch {
    return null;
  }
}

function combine(
  rows: readonly { materialId: string; unit: Material['baseUnit']; required: number }[],
  materials: readonly Material[],
): CombinedMaterialRow[] {
  const byMaterial = new Map(materials.map((material) => [key(material.id), material]));
  const totals = new Map<string, { id: string; unit: Material['baseUnit']; required: number }>();
  for (const row of rows) {
    if (!Number.isFinite(row.required) || row.required < 0) continue;
    const id = key(row.materialId);
    const existing = totals.get(id);
    if (existing) {
      if (existing.unit !== row.unit) {
        throw new Error(`Conflicting base units for Material ${row.materialId}.`);
      }
      existing.required += row.required;
    } else {
      totals.set(id, { id: row.materialId, unit: row.unit, required: row.required });
    }
  }
  return [...totals.values()].map((total) => {
    const material = byMaterial.get(key(total.id));
    const available = stockFor(material);
    return {
      materialId: material?.id ?? total.id,
      name: material?.name ?? total.id,
      unit: total.unit,
      required: total.required,
      available,
      shortage: available === null ? null : Math.max(0, total.required - available),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Combined direct requirements use the Product/Yield path (with each product's
 * safety waste). Formula groups are theoretical, use complete Mold pours,
 * and are deliberately NOT added to direct requirements.
 *
 * Stock is compared once against each combined material total, never subtracted
 * separately for each product/formula group.
 */
export function summarizeMultiProduction(
  entries: readonly MultiProductionEntry[],
  materials: readonly Material[],
): MultiProductionSummary {
  const warnings: string[] = [];
  const directRows: { materialId: string; unit: Material['baseUnit']; required: number }[] = [];
  const formulaRows: { materialId: string; unit: Material['baseUnit']; required: number }[] = [];
  const groups = new Map<string, ProductionMixGroup>();

  for (const entry of entries) {
    if (!entry.plan || entry.error) {
      warnings.push(`${entry.product.name}: ${entry.error ?? 'Production requirement is unavailable.'}`);
    } else {
      if (entry.plan.status !== 'ready') {
        warnings.push(`${entry.product.name}: recipe requirements are ${entry.plan.status}; only known amounts are included.`);
      }
      directRows.push(...entry.plan.requirements.map((row) => ({
        materialId: row.materialId, unit: row.baseUnit, required: row.plannedBatchBaseQuantity,
      })));
    }

    if (entry.formulaError) warnings.push(`${entry.product.name}: ${entry.formulaError}`);
    const formula = entry.formula;
    const profile = entry.profile;
    if (!formula || !profile) continue;
    if (key(formula.profileId) !== key(profile.id) || key(formula.productId) !== key(entry.product.id)) {
      warnings.push(`${entry.product.name}: Mold Formula identity mismatch; skipped.`);
      continue;
    }
    if (formula.status !== 'ready') {
      warnings.push(`${entry.product.name}: Mold Formula preview is ${formula.status}; check its materials/stock.`);
    }

    // Compatible formulas require exactly the same three Material IDs and
    // mixing ratios. Different mold sizes may share a group, but their own
    // complete-pour rounding is preserved.
    const identity = JSON.stringify([
      key(profile.waterMaterialId), key(profile.plasterMaterialId), key(profile.glueMaterialId),
      profile.waterAdjustmentRate, profile.plasterFactor, profile.glueFactor,
    ]);
    let group = groups.get(identity);
    if (!group) {
      group = {
        key: identity,
        profileIds: [],
        products: [],
        requiredPours: 0,
        totalMixtureGrams: 0,
        materials: [],
      };
      groups.set(identity, group);
    }
    if (!group.profileIds.includes(profile.id)) group.profileIds.push(profile.id);
    group.products.push({
      id: entry.product.id, name: entry.product.name, quantity: entry.quantity,
      moldName: formula.moldName, pours: formula.requiredPours,
    });
    group.requiredPours += formula.requiredPours;
    for (const line of formula.materials) {
      const existing = group.materials.find((row) => row.role === line.role);
      if (existing) existing.grams += line.targetBatchGrams;
      else group.materials.push({
        role: line.role, materialId: line.materialId, name: line.materialName,
        grams: line.targetBatchGrams,
      });
      formulaRows.push({ materialId: line.materialId, unit: 'g', required: line.targetBatchGrams });
      group.totalMixtureGrams += line.targetBatchGrams;
    }
  }

  return {
    products: entries.length,
    finishedPieces: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    ready: entries.length > 0 && warnings.length === 0,
    warnings,
    directMaterials: combine(directRows, materials),
    formulaMaterials: combine(formulaRows, materials),
    mixtureGroups: [...groups.values()],
    formulaMixtureGrams: [...groups.values()].reduce((sum, group) => sum + group.totalMixtureGrams, 0),
  };
}
