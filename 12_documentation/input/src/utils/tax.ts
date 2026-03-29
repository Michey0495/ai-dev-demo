const TAX_RATE = Number(process.env.TAX_RATE) || 0.10;

export function calculateTax(subtotal: number): number {
  return Math.floor(subtotal * TAX_RATE);
}

export function calculateSubtotalWithTax(subtotal: number): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const tax = calculateTax(subtotal);
  return {
    subtotal,
    tax,
    total: subtotal + tax,
  };
}

export function calculateShippingFee(totalWeight: number): number {
  const baseThreshold = Number(process.env.FREE_SHIPPING_THRESHOLD) || 5000;

  if (totalWeight <= 0) return 0;

  if (totalWeight <= 2) return 500;
  if (totalWeight <= 5) return 800;
  if (totalWeight <= 10) return 1200;
  return 1800;
}

export function isEligibleForFreeShipping(subtotal: number): boolean {
  const threshold = Number(process.env.FREE_SHIPPING_THRESHOLD) || 5000;
  return subtotal >= threshold;
}
