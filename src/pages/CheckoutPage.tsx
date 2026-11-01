import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Truck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Banknote,
  FileCheck2,
  QrCode
} from 'lucide-react';
import { useCart } from '../services/cartContext';
import { useAuth } from '../services/authContext';
import { INDIAN_STATES } from '../data/defaultProducts';
import { validateServerOrderTotals, saveOrderToFirestore, resolveProductImageUrl, DEFAULT_FALLBACK_PRODUCT_IMAGE } from '../services/orderService';
import { Order, PaymentMethod } from '../types';

interface CheckoutPageProps {
  onBackToCart: () => void;
  onOrderSuccess: (order: Order) => void;
  onOpenAuth: () => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  onBackToCart,
  onOrderSuccess,
  onOpenAuth,
}) => {
  const { items, subtotal, shippingCharges, discount, total, appliedCoupon, clearCart } = useCart();
  const { currentUser } = useAuth();

  // Form State
  const [fullName, setFullName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const selectedMethod: PaymentMethod = 'cod';

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.email && !email) {
      setEmail(currentUser.email);
    }
    if (currentUser?.displayName && !fullName) {
      setFullName(currentUser.displayName);
    }
  }, [currentUser]);

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Your cart is empty</h2>
        <p className="text-xs text-slate-500">Please add photos or designs before checking out.</p>
        <button
          onClick={onBackToCart}
          className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold"
        >
          Return to Gallery
        </button>
      </div>
    );
  }

  const validateForm = (): boolean => {
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return false;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address for order confirmation.');
      return false;
    }

    const phoneClean = phone.replace(/[^0-9]/g, '');
    if (!/^[6-9]\d{9}$/.test(phoneClean)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return false;
    }

    if (!addressLine1.trim() || addressLine1.trim().length < 5) {
      setErrorMessage('Please enter your complete flat/house number and street address.');
      return false;
    }

    if (!city.trim()) {
      setErrorMessage('Please enter your delivery city.');
      return false;
    }

    const pinClean = pincode.replace(/[^0-9]/g, '');
    if (!/^[1-9][0-9]{5}$/.test(pinClean)) {
      setErrorMessage('Please enter a valid 6-digit Indian PIN code (e.g. 560038).');
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!currentUser) {
      setErrorMessage('Please sign in with your Google account or email to ensure your order and photos remain saved.');
      onOpenAuth();
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const idempotencyKey = `idemp_${currentUser.uid.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const idToken = await currentUser.getIdToken().catch(() => null);

      // 1. Authoritative Server-side order creation (strictly COD, initial status pending)
      const orderPayload = {
        idempotencyKey,
        customerName: fullName.trim(),
        customerPhone: phone.replace(/[^0-9]/g, ''),
        userEmail: currentUser.email || email.trim(),
        userId: currentUser.uid,
        shippingAddress: {
          fullName: fullName.trim(),
          phone: phone.replace(/[^0-9]/g, ''),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state,
          pincode: pincode.replace(/[^0-9]/g, ''),
          country: 'India',
          deliveryNotes: deliveryNotes.trim() || undefined,
        },
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.product?.name || 'Custom Photo Print',
          quantity: it.quantity,
          size: it.size || 'Standard',
          finish: it.finish || 'Glossy',
          unitPrice: it.unitPrice,
          photoUrls: (it.photos && it.photos.length > 0)
            ? it.photos
            : [it.previewThumbnail || it.product?.imageUrl || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800'],
          caption: it.caption || undefined,
          notes: it.notes || undefined,
          frameColor: it.frameColor || undefined,
        })),
        couponCode: appliedCoupon || undefined,
        paymentMethod: 'cod',
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to place Cash on Delivery order.');
      }

      const { order: confirmedOrder } = await res.json();

      // 2. Client synchronization backup to Firestore
      try {
        await saveOrderToFirestore(confirmedOrder);
      } catch (syncErr) {
        // Non-blocking: Server already persisted the order
      }

      // 3. Clear cart & trigger success screen
      clearCart();
      onOrderSuccess(confirmedOrder);

    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Order submission error:', err);
      }
      setErrorMessage(err.message || 'Failed to place order. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back to Cart */}
      <button
        type="button"
        onClick={onBackToCart}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Cart</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery Form & Payment Choice */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-xs space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              Direct Order Checkout
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Delivery Details & Review
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              No online card payment required right now. Submit your order and payment instructions will be sent separately.
            </p>
          </div>

          {!currentUser && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-bold">Sign in required to store order</p>
                <p>
                  Please sign in with Google or Email so your custom prints remain linked to your account.
                </p>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="font-bold text-rose-700 underline text-xs pt-1 block"
                >
                  Sign in or register
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handlePlaceOrder} className="space-y-4">
            {/* Recipient Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sneha Kulkarni"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white"
              />
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address (For Invoice & Instructions) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="sneha@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (For WhatsApp & Courier SMS) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-11 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Flat, House No., Apartment & Street *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Flat 301, Rosewood Heights, 5th Cross"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white"
              />
            </div>

            {/* Landmark */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Area, Landmark or Colony (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Near Metro Station / Behind City Library"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white"
              />
            </div>

            {/* City, State, PIN */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City / Town *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bengaluru"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  State / UT *
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PIN Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="560038"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white"
                />
              </div>
            </div>

            {/* Delivery Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Special Delivery Notes / Gift Message (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Please pack carefully as birthday gift, or call before arriving."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white"
              />
            </div>

            {/* Payment Method - Exclusively Cash on Delivery (COD) */}
            <div className="pt-4 border-t border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">
                  Payment Method
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Cash on Delivery (COD) Only</span>
                </span>
              </div>

              {/* Verified COD Banner */}
              <div className="p-4 rounded-2xl border-2 border-emerald-500/80 bg-emerald-50/40 shadow-xs flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Banknote className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">
                      Cash on Delivery (Doorstep Payment)
                    </span>
                    <span className="text-[10px] bg-slate-900 text-white font-black px-2 py-0.5 rounded-md">
                      Zero Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    No advance online card payment required. Inspect your personalized photo prints and pay <strong>₹{total}</strong> in cash (or via courier UPI QR scan) directly to the delivery executive when the parcel reaches your doorstep.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Place Order CTA */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Securing Your COD Order...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>Confirm Cash on Delivery Order • ₹{total}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-stone-100 pb-3">
            Review Items ({items.length})
          </h3>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto space-y-3 pr-1">
            {items.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex gap-3 items-center">
                <img
                  src={item.photos[0] || resolveProductImageUrl(item.product)}
                  alt={item.product.name}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
                  }}
                  className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
                />
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-semibold text-slate-800 truncate">{item.product.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {item.size} • {item.finish} • Qty {item.quantity}
                  </p>
                  {item.caption && (
                    <p className="text-[10px] text-slate-500 font-['Caveat',cursive] truncate">
                      "{item.caption}"
                    </p>
                  )}
                </div>
                <span className="font-bold text-xs text-slate-900">
                  ₹{item.unitPrice * item.quantity}
                </span>
              </div>
            ))}
          </div>

          {/* Pricing Breakdown */}
          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">₹{subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping Charges</span>
              <span>
                {shippingCharges === 0 ? (
                  <span className="text-emerald-600 font-bold uppercase">FREE</span>
                ) : (
                  `₹${shippingCharges}`
                )}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount ({appliedCoupon})</span>
                <span>-₹{discount}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total Amount</span>
              <span className="text-rose-600">₹{total}</span>
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Offline Order Guarantee</span>
            </div>
            <p>
              Your order is recorded immediately in our database. Payment details will be sent once we confirm that photo resolution meets archival print quality.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
