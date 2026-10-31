import type { Product } from '../types/index.ts';

export function getVariantSurcharge(product: Product | undefined, variantId?: string): number {
  if (!product || !variantId) return 0;
  return product.variants.find(variant => variant.id === variantId && variant.status === 'ACTIVE')?.additionalPrice || 0;
}

export function adjustPriceForVariant(
  currentPrice: number,
  product: Product | undefined,
  previousVariantId: string | undefined,
  nextVariantId: string | undefined
): number {
  return Math.max(
    0,
    currentPrice
      - getVariantSurcharge(product, previousVariantId)
      + getVariantSurcharge(product, nextVariantId)
  );
}
