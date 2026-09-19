import {
  validateProductPriceTierContract,
  type ProductPriceTier,
} from './productPriceTiers';
import { validatePricingUnitCost } from './pricing';

export interface ProductPriceTierEconomics {
  fullyLoadedUnitCost: number;
  unitsPerOffer: number;
  baseOfferCost: number;
  additionalCostPerOffer: number;
  totalOfferCost: number;
  offerSellingPrice: number;
  effectiveUnitSellingPrice: number;
  profitPerOffer: number;
  effectiveProfitPerUnit: number;
  effectiveMarkup: number | null;
  effectiveMargin: number | null;
}

/**
 * Derives full-precision economics for one validated Product price tier.
 *
 * Default-price comparison and below-cost diagnostics are intentionally excluded;
 * those belong to TP3C.
 */
export function deriveProductPriceTierEconomics(
  fullyLoadedUnitCost: number,
  tier: ProductPriceTier,
): ProductPriceTierEconomics {
  validatePricingUnitCost(fullyLoadedUnitCost);
  validateProductPriceTierContract(tier);

  const baseOfferCost = fullyLoadedUnitCost * tier.unitsPerOffer;
  const totalOfferCost = baseOfferCost + tier.additionalCostPerOffer;
  const offerSellingPrice =
    tier.priceBasis === 'per-offer'
      ? tier.priceAmount
      : tier.priceAmount * tier.unitsPerOffer;
  const effectiveUnitSellingPrice = offerSellingPrice / tier.unitsPerOffer;
  const profitPerOffer = offerSellingPrice - totalOfferCost;
  const effectiveProfitPerUnit = profitPerOffer / tier.unitsPerOffer;

  return {
    fullyLoadedUnitCost,
    unitsPerOffer: tier.unitsPerOffer,
    baseOfferCost,
    additionalCostPerOffer: tier.additionalCostPerOffer,
    totalOfferCost,
    offerSellingPrice,
    effectiveUnitSellingPrice,
    profitPerOffer,
    effectiveProfitPerUnit,
    effectiveMarkup: totalOfferCost === 0 ? null : profitPerOffer / totalOfferCost,
    effectiveMargin: offerSellingPrice === 0 ? null : profitPerOffer / offerSellingPrice,
  };
}
