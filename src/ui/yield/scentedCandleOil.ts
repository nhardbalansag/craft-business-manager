import type { Material } from '../../domain/materials';
import { calculateMaterialPackageCosting } from '../../domain/materialCosting';
import { areUnitsCompatible, convertQuantity, type InputUnit } from '../../domain/units';

export interface EssentialOilEstimate {
  waxGrams: number;
  percentage: number;
  oilGrams: number;
  totalGrams: number;
  estimatedMaterialCost: number | null;
}

function gramCost(material: Material): number | null {
  if (material.baseUnit !== 'g') return null;
  try {
    const cost = calculateMaterialPackageCosting(material).costPerBaseUnit;
    return Number.isFinite(cost) ? cost : null;
  } catch {
    return null;
  }
}

/** Fragrance load is a percentage of WAX weight, not total candle mass. */
export function estimateEssentialOil(
  wax: Material,
  weight: number,
  unit: InputUnit,
  oil: Material | null,
): EssentialOilEstimate | null {
  if (
    wax.group !== 'wax' || wax.baseUnit !== 'g' ||
    wax.essentialOilPercent === undefined ||
    !Number.isFinite(wax.essentialOilPercent) ||
    wax.essentialOilPercent < 0 || wax.essentialOilPercent > 100 ||
    !Number.isFinite(weight) || weight <= 0 ||
    !areUnitsCompatible(unit, 'g')
  ) return null;
  const waxGrams = convertQuantity(weight, unit, 'g');
  const oilGrams = waxGrams * wax.essentialOilPercent / 100;
  if (!Number.isFinite(oilGrams)) return null;
  const waxCost = gramCost(wax);
  const oilCost = oil && oil.group === 'fragrance' ? gramCost(oil) : null;
  return {
    waxGrams,
    percentage: wax.essentialOilPercent,
    oilGrams,
    totalGrams: waxGrams + oilGrams,
    estimatedMaterialCost: waxCost !== null && oilCost !== null
      ? waxGrams * waxCost + oilGrams * oilCost
      : null,
  };
}
