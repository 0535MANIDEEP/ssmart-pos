import type { CartItem, Product, ShopSettings } from "./types";
import { round2 } from "./format";

// Returns the effective unit price for a product given a rate tier.
// Priority: rate tier > sellingPrice (our price) > MRP (ceiling)
// Mirrors backend/src/lib/pricing.js's `effectivePrice` exactly.
// The result is always GST-inclusive and must never exceed MRP.
export function effectivePrice(product: Product, rateTier?: string | null): number {
  // Start with our selling price as default
  let basePrice = product.sellingPrice;

  // Override with rate tier if set
  if (rateTier === "A" && product.rateA != null && product.rateA > 0) basePrice = product.rateA;
  else if (rateTier === "B" && product.rateB != null && product.rateB > 0) basePrice = product.rateB;
  else if (rateTier === "C" && product.rateC != null && product.rateC > 0) basePrice = product.rateC;

  // Apply standing discount (from product master) on top of the selected rate
  const { discountType, discountValue } = product;
  if (!discountType || !discountValue) {
    // Safety: never exceed MRP
    if (product.mrp && product.mrp > 0 && basePrice > product.mrp) basePrice = product.mrp;
    return basePrice;
  }
  if (discountType === "percent") {
    const pct = Math.min(100, Math.max(0, discountValue));
    basePrice = round2(basePrice * (1 - pct / 100));
  } else {
    const amt = Math.min(basePrice, Math.max(0, discountValue));
    basePrice = round2(basePrice - amt);
  }

  // Safety: never exceed MRP
  if (product.mrp && product.mrp > 0 && basePrice > product.mrp) basePrice = product.mrp;

  return basePrice;
}

export interface QuoteInput {
  cart: CartItem[];
  discountType: "percent" | "amount" | null;
  discountValue: number;
  pointsRedeemed: number;
  settings: ShopSettings | undefined;
}

export interface Quote {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  loyaltyDiscount: number;
  total: number;
  pointsEarned: number;
}

// Client-side preview of the sale totals. Mirrors the backend pricing engine
// (backend/src/lib/pricing.js) so the cashier sees accurate numbers before
// checkout — the server always recomputes authoritatively on submit.
//
// Prices are GST-inclusive in India (Legal Metrology Rules). GST is backed
// OUT of the inclusive total for the on-screen breakup, never added on top.
export function quoteSale({ cart, discountType, discountValue, pointsRedeemed, settings }: QuoteInput): Quote {
  const gstEnabled = !!settings?.gstEnabled;

  // Step 1: Get effective price per unit (our price/rate minus standing product discount)
  const effectivePrices = cart.map((c) => effectivePrice(c.product, c.rateTier));

  // Step 2: Apply per-item discount (from cart) on each line
  const bases = cart.map((c, i) => {
    const lineBase = round2(effectivePrices[i] * c.quantity);
    if (!c.discountType || !c.discountValue) return lineBase;
    let itemDiscount = 0;
    if (c.discountType === "percent") {
      itemDiscount = round2(lineBase * (Math.min(c.discountValue, 100) / 100));
    } else {
      itemDiscount = round2(Math.min(c.discountValue, lineBase));
    }
    return round2(lineBase - itemDiscount);
  });

  const subtotal = round2(bases.reduce((a, b) => a + b, 0));

  // Step 3: Apply bill-level discount
  let discountAmount = 0;
  if (discountType === "percent") discountAmount = round2(subtotal * (Math.min(discountValue, 100) / 100));
  else if (discountType === "amount") discountAmount = round2(Math.min(discountValue, subtotal));
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  // Step 4: Calculate tax (backed out of inclusive price)
  let taxAmount = 0;
  cart.forEach((c, i) => {
    const share = subtotal > 0 ? bases[i] / subtotal : 0;
    const discountedBase = round2(bases[i] - round2(discountAmount * share));
    const rate = gstEnabled ? c.product.taxRate || 0 : 0;
    const lineTax = rate > 0 ? round2(discountedBase - discountedBase / (1 + rate / 100)) : 0;
    taxAmount = round2(taxAmount + lineTax);
  });

  // Step 5: Apply loyalty
  const loyaltyEnabled = !!settings?.loyaltyEnabled;
  const pointValue = loyaltyEnabled ? settings!.pointValue || 0 : 0;
  const preLoyalty = round2(subtotal - discountAmount);
  let loyaltyDiscount = round2(Math.max(0, Math.floor(pointsRedeemed)) * pointValue);
  if (loyaltyDiscount > preLoyalty) loyaltyDiscount = preLoyalty;

  const total = round2(preLoyalty - loyaltyDiscount);
  const pointsPerUnit = loyaltyEnabled ? settings!.pointsPerUnit || 0 : 0;
  const pointsEarned = loyaltyEnabled ? Math.floor(total * pointsPerUnit) : 0;

  return { subtotal, discountAmount, taxAmount, loyaltyDiscount, total, pointsEarned };
}
