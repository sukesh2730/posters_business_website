import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, Product } from '../types';
import { AVAILABLE_COUPONS } from '../data/defaultProducts';

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  taxableAmount: number;
  gst: number;
  shippingCharges: number;
  discount: number;
  total: number;
  totalCount: number;
  appliedCoupon: string | null;
  couponError: string | null;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CART_STORAGE_KEY = 'memoprint_cart_items_v1';
const FREE_SHIPPING_THRESHOLD = 499;
const STANDARD_SHIPPING_FEE = 60;

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Could not persist cart:', e);
    }
  }, [items]);

  const addItem = (itemData: Omit<CartItem, 'id'>) => {
    const newItem: CartItem = {
      ...itemData,
      id: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    setItems((prev) => [newItem, ...prev]);
    setIsCartOpen(true);
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, qty: number) => {
    if (qty < 1) return;
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity: qty } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
    setCouponError(null);
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingCharges = items.length === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;

  let discount = 0;
  if (appliedCoupon && subtotal > 0) {
    const couponDef = AVAILABLE_COUPONS.find(
      (c) => c.code.toUpperCase() === appliedCoupon.toUpperCase()
    );
    if (couponDef && subtotal >= couponDef.minAmount) {
      if (couponDef.flatDiscount) {
        discount = Math.min(couponDef.flatDiscount, subtotal);
      } else if (couponDef.discountPercent) {
        discount = Math.round((subtotal * couponDef.discountPercent) / 100);
      }
    } else {
      // Order subtotal dropped below minAmount
      discount = 0;
    }
  }

  // GST Option B: Catalog prices are GST inclusive (18% SAC 9989 Printing Services)
  const inclusiveGoods = Math.max(0, subtotal - discount);
  const taxableAmount = Math.round(inclusiveGoods / 1.18);
  const gst = inclusiveGoods - taxableAmount;

  const total = Math.max(0, subtotal + shippingCharges - discount);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const applyCoupon = (code: string): boolean => {
    setCouponError(null);
    const cleanCode = code.trim().toUpperCase();
    const couponDef = AVAILABLE_COUPONS.find((c) => c.code === cleanCode);

    if (!couponDef) {
      setCouponError('Invalid coupon code. Try MEMO10 or MEMOLIFE.');
      return false;
    }

    if (subtotal < couponDef.minAmount) {
      setCouponError(`Add items worth ₹${couponDef.minAmount - subtotal} more to use ${cleanCode}.`);
      return false;
    }

    setAppliedCoupon(cleanCode);
    return true;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        taxableAmount,
        gst,
        shippingCharges,
        discount,
        total,
        totalCount,
        appliedCoupon,
        couponError,
        applyCoupon,
        removeCoupon,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
