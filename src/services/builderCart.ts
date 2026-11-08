import { CartItem, Product } from '../types';
import { BuilderConfig, priceBuilder } from '../shared/printPricing';

/**
 * Turns a builder configuration into a cart item. The price comes from the shared
 * pricing module; the server recomputes it from `builder` at checkout.
 */
export function builderToCartItem(config: BuilderConfig): Omit<CartItem, 'id'> {
  const p = priceBuilder(config);
  const product: Product = {
    id: p.productId,
    name: p.name,
    slug: p.productId,
    category: 'posters',
    price: p.unitPrice,
    originalPrice: p.mrp,
    description: p.summary,
    details: p.summary,
    rating: 4.9,
    reviewCount: 0,
    imageUrl: '',
    sizes: ['Standard'],
    paperFinishes: ['Matte'],
    minPhotos: 0,
    maxPhotos: 0,
    stock: 999,
    isActive: true,
  };
  return {
    productId: p.productId,
    product,
    size: p.summary,
    finish: 'Matte, 300 GSM',
    quantity: 1,
    unitPrice: p.unitPrice,
    photos: p.photoUrls,
    previewThumbnail: p.photoUrls[0],
    builder: config,
  };
}
