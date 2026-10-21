import type { EffectiveMaterialRequirement } from './effectiveRecipeRequirements';
import type { Material } from './materials';
import type { Product } from './products';

const key = (id: string) => id.trim().toLowerCase();

export interface CandleOilRequirementResolution {
  requirements: EffectiveMaterialRequirement[];
  issue: string | null;
}

/**
 * The saved Product pairing is the single authoritative essential-oil
 * calculation for FUTURE requirements. Raw historic Yield evidence stays intact.
 * A manual or Yield-derived line for the selected oil is REPLACED, not added,
 * so the fragrance cost is counted exactly once.
 */
export function resolveCandleOilRequirements(
  product: Product,
  requirements: readonly EffectiveMaterialRequirement[],
  materials: readonly Material[],
): CandleOilRequirementResolution {
  const unchanged = () => ({ requirements: requirements.map((r) => ({
    ...r, contributions: r.contributions.map((c) => ({ ...c })),
  })), issue: null });
  if (!product.candleWaxMaterialId && !product.candleEssentialOilMaterialId) return unchanged();
  if (!product.candleWaxMaterialId || !product.candleEssentialOilMaterialId || product.category !== 'candle') {
    return { ...unchanged(), issue: 'Candle oil configuration needs a valid wax and essential oil pairing.' };
  }
  const wax = materials.find((m) => key(m.id) === key(product.candleWaxMaterialId!));
  const oil = materials.find((m) => key(m.id) === key(product.candleEssentialOilMaterialId!));
  if (!wax?.isActive || wax.group !== 'wax' || wax.baseUnit !== 'g' ||
      wax.essentialOilPercent === undefined ||
      !Number.isFinite(wax.essentialOilPercent) ||
      wax.essentialOilPercent < 0 || wax.essentialOilPercent > 100) {
    return { ...unchanged(), issue: 'Candle wax is unavailable, non-gram-based, or has no valid essential oil percentage.' };
  }
  if (!oil?.isActive || oil.group !== 'fragrance' || oil.baseUnit !== 'g') {
    return { ...unchanged(), issue: 'Selected essential oil must be an active gram-based fragrance Material.' };
  }
  if (key(wax.id) === key(oil.id)) {
    return { ...unchanged(), issue: 'Wax and essential oil must be different materials.' };
  }
  const waxReq = requirements.find((r) => key(r.materialId) === key(wax.id));
  if (!waxReq || waxReq.baseUnit !== 'g' ||
      !Number.isFinite(waxReq.baseQuantityPerProduct) || waxReq.baseQuantityPerProduct <= 0) {
    return { ...unchanged(), issue: 'Add the selected wax to this Product\'s fixed recipe or recorded Yield sample before costing its essential oil.' };
  }
  const oilGrams = waxReq.baseQuantityPerProduct * wax.essentialOilPercent / 100;
  if (!Number.isFinite(oilGrams) || oilGrams < 0) {
    return { ...unchanged(), issue: 'Calculated essential oil quantity is not finite.' };
  }
  const others = requirements.filter((r) => key(r.materialId) !== key(oil.id)).map((r) => ({
    ...r, contributions: r.contributions.map((c) => ({ ...c })),
  }));
  // A zero-percent setting intentionally removes the old fragrance requirement.
  if (oilGrams > 0) {
    others.push({
      materialId: oil.id,
      baseUnit: 'g',
      baseQuantityPerProduct: oilGrams,
      source: 'fixed',
      contributions: [{
        source: 'fixed',
        sourceId: `CANDLE-OIL:${wax.id}:${oil.id}`,
        role: 'additive',
        baseQuantityPerProduct: oilGrams,
        conversionSource: 'wax-essential-oil-percent',
        calibrationId: null,
      }],
    });
  }
  others.sort((a,b)=>a.materialId.localeCompare(b.materialId, undefined, { sensitivity: 'base' }));
  return { requirements: others, issue: null };
}
