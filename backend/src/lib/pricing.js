// Pure pricing math for a sale. Kept separate from the route so it can be
// reasoned about and unit-tested in isolation.
//
// Price model:
//   - `mrp` = Maximum Retail Price (legal ceiling, GST-inclusive, printed on label)
//   - `sellingPrice` = Our actual selling price (GST-inclusive, must be <= MRP)
//   - `purchasePrice` = Cost price from supplier
//   - Rate tiers (A/B/C) override sellingPrice for specific customer types
//   - GST is backed OUT of the inclusive price for display, never added on top

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Returns the effective unit price for a product given a rate tier.
// Priority: rate tier > sellingPrice (our price) > MRP (ceiling)
// The result is always GST-inclusive and must never exceed MRP.
function effectivePrice(product, rateTier) {
  // Start with our selling price as default
  let basePrice = product.sellingPrice;

  // Override with rate tier if set
  if (rateTier === 'A' && product.rateA != null && product.rateA > 0) basePrice = product.rateA;
  else if (rateTier === 'B' && product.rateB != null && product.rateB > 0) basePrice = product.rateB;
  else if (rateTier === 'C' && product.rateC != null && product.rateC > 0) basePrice = product.rateC;

  // Apply standing discount (from product master) on top of the selected rate
  const { discountType, discountValue } = product;
  if (discountType && discountValue) {
    if (discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, discountValue));
      basePrice = round2(basePrice * (1 - pct / 100));
    } else {
      const amt = Math.min(basePrice, Math.max(0, discountValue));
      basePrice = round2(basePrice - amt);
    }
  }

  // Safety: never exceed MRP (legal requirement in India)
  if (product.mrp && product.mrp > 0 && basePrice > product.mrp) {
    basePrice = product.mrp;
  }

  return basePrice;
}

/**
 * @param {Array<{product, quantity, rateTier?, discountType?, discountValue?}>} lines
 * @param {object} opts { discountType, discountValue, pointsRedeemed, settings }
 * @returns computed invoice fields + per-line breakdown
 */
function computeSale(lines, opts) {
  const { discountType = null, discountValue = 0, pointsRedeemed = 0, settings } = opts;

  const gstEnabled = !!settings?.gstEnabled;

  // Step 1: Get effective price per unit (our price/rate minus standing product discount)
  const effectivePrices = lines.map((l) => effectivePrice(l.product, l.rateTier));

  // Step 2: Apply per-item discount (from cart) on each line
  const bases = lines.map((l, i) => {
    const lineBase = round2(effectivePrices[i] * l.quantity);
    if (!l.discountType || !l.discountValue) return lineBase;
    let itemDiscount = 0;
    if (l.discountType === 'percent') {
      itemDiscount = round2(lineBase * (Math.min(l.discountValue, 100) / 100));
    } else {
      itemDiscount = round2(Math.min(l.discountValue, lineBase));
    }
    return round2(lineBase - itemDiscount);
  });
  const subtotal = round2(bases.reduce((a, b) => a + b, 0));

  // Step 3: Apply bill-level discount
  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = round2(subtotal * (Math.min(discountValue, 100) / 100));
  } else if (discountType === 'amount') {
    discountAmount = round2(Math.min(discountValue, subtotal));
  }
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  // Step 4: Calculate tax (backed out of inclusive price)
  const items = lines.map((l, i) => {
    const base = bases[i];
    const share = subtotal > 0 ? base / subtotal : 0;
    const lineDiscount = round2(discountAmount * share);
    const discountedBase = round2(base - lineDiscount);
    const rate = gstEnabled ? l.product.taxRate || 0 : 0;
    const taxAmount = rate > 0 ? round2(discountedBase - discountedBase / (1 + rate / 100)) : 0;
    return {
      productId: l.product.id,
      name: l.product.name,
      unit: l.product.unit || null,
      rateTier: l.rateTier || null,
      discountType: l.discountType || null,
      discountValue: l.discountValue || 0,
      quantity: l.quantity,
      price: effectivePrices[i],
      taxRate: rate,
      taxAmount,
      total: discountedBase,
    };
  });

  const taxAmount = round2(items.reduce((a, it) => a + it.taxAmount, 0));

  // Loyalty redemption
  const loyaltyEnabled = !!settings?.loyaltyEnabled;
  const pointValue = loyaltyEnabled ? settings.pointValue || 0 : 0;
  const preLoyaltyTotal = round2(subtotal - discountAmount);
  const redeemPoints = loyaltyEnabled ? Math.max(0, Math.floor(pointsRedeemed)) : 0;
  let loyaltyDiscount = round2(redeemPoints * pointValue);
  if (loyaltyDiscount > preLoyaltyTotal) loyaltyDiscount = preLoyaltyTotal;

  const totalAmount = round2(preLoyaltyTotal - loyaltyDiscount);

  const pointsPerUnit = loyaltyEnabled ? settings.pointsPerUnit || 0 : 0;
  const pointsEarned = loyaltyEnabled ? Math.floor(totalAmount * pointsPerUnit) : 0;

  return {
    subtotal,
    discountType: discountType || null,
    discountValue: discountType ? discountValue : 0,
    discountAmount,
    taxAmount,
    loyaltyDiscount,
    totalAmount,
    pointsRedeemed: redeemPoints,
    pointsEarned,
    items,
  };
}

module.exports = { computeSale, round2, effectivePrice };
