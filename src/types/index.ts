export type ProductCategory = 
  | 'polaroids'
  | 'photo-strips'
  | 'vintage'
  | 'pastel'
  | 'gifts'
  | 'posters'
  | 'bundles'
  | 'frames'
  | 'collages';

export type AspectRatioType = 'tall' | 'square' | 'portrait' | 'wide';

export interface ProductOption {
  label: string;
  priceModifier?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: ProductCategory;
  collectionId?: string; // 'polaroids' | 'photo-strips' | 'vintage' | 'pastel' | 'gifts'
  style?: string; // 'Retro', 'Vintage', 'Cute & Pastel', 'Modern Minimal', 'Holographic', 'Aesthetic'
  occasion?: string; // 'Birthday', 'Anniversary', 'Friendship', 'Room Decor', 'Valentine', 'Travel'
  tags?: string[];
  price: number; // in INR
  originalPrice: number;
  description: string;
  details: string;
  rating: number;
  reviewCount: number;
  badge?: string; // 'Best Seller', 'Trending', 'New', 'Save 20%'
  imageUrl: string;
  images?: string[];
  aspectRatio?: AspectRatioType;
  sizes: string[];
  paperFinishes: string[];
  minPhotos: number;
  maxPhotos: number;
  stock: number;
  isActive: boolean;
  isFeatured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CollectionInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImage: string;
  designCount?: number;
  featured?: boolean;
}

export interface CustomizationData {
  photos: string[]; // local preview URLs or uploaded URLs
  selectedSize: string;
  selectedFinish: string;
  caption?: string;
  notes?: string;
  fontStyle?: string;
  frameColor?: string;
}

export interface CartItem {
  id: string; // unique item id in cart
  productId: string;
  product: Product;
  size: string;
  finish: string;
  quantity: number;
  unitPrice: number;
  photos: string[];
  caption?: string;
  notes?: string;
  fontStyle?: string;
  frameColor?: string;
  previewThumbnail?: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  deliveryNotes?: string;
}

export type OrderStatus = 
  | 'pending_confirmation' 
  | 'confirmed' 
  | 'processing' 
  | 'printing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled'
  | 'placed'; // backward compatibility

export type PaymentStatus = 
  | 'pending'
  | 'paid' 
  | 'failed' 
  | 'cod_pending' 
  | 'pending_instructions' 
  | 'test_demo';

export type PaymentMethod = 'cod';

export interface OrderItemSummary {
  productId: string;
  productName: string;
  size: string;
  finish: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  photoUrls: string[];
  caption?: string;
  notes?: string;
  frameColor?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  items: OrderItemSummary[];
  itemsCount: number;
  subtotal: number;
  shippingCharges: number;
  discount: number;
  couponCode?: string;
  total: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  orderStatus: OrderStatus;
  trackingNumber?: string;
  trackingCourier?: string;
  paidAt?: string;
  cashCollectedConfirmedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isAdmin: boolean;
}

export interface BulkBatchStatus {
  phase: 'idle' | 'uploading' | 'uploaded' | 'publishing' | 'published';
  completed: number;
  total: number;
  percentage: number;
  inProgress: boolean;
  currentFileName?: string;
  currentFileSizeKb?: number;
  uploadedCount: number;
  failedCount: number;
  totalSizeBytes: number;
  errors: string[];
}
