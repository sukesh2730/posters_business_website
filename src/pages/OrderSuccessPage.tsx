import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  Sparkles, 
  Package, 
  Truck, 
  Clock, 
  ArrowRight, 
  ShoppingBag,
  QrCode,
  MessageSquare
} from 'lucide-react';
import { Order } from '../types';

interface OrderSuccessPageProps {
  order: Order;
  onNavigateHome: () => void;
  onNavigateOrders: () => void;
}

export const OrderSuccessPage: React.FC<OrderSuccessPageProps> = ({
  order,
  onNavigateHome,
  onNavigateOrders,
}) => {
  useEffect(() => {
    // Fire celebratory confetti!
    const count = 180;
    const defaults = { origin: { y: 0.7 }, zIndex: 9999 };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  }, []);

  const now = new Date(order.createdAt);
  const minDelivery = new Date(now);
  minDelivery.setDate(now.getDate() + 4);
  const maxDelivery = new Date(now);
  maxDelivery.setDate(now.getDate() + 7);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8 animate-in fade-in duration-300">
      {/* Success Hero Header */}
      <div className="bg-gradient-to-b from-emerald-50 to-white border border-emerald-200/80 rounded-3xl p-8 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-full">
            COD Order Confirmed • Lab Processing
          </span>
          <h1 className="font-['Playfair_Display',serif] text-3xl font-extrabold text-slate-900 mt-2">
            Thank you, {order.customerName}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
            Your Cash on Delivery order has been secured. Our photo lab team is reviewing your uploaded photos and preparing them for archival printing.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white rounded-full border border-slate-200 text-xs font-mono font-bold text-slate-800 shadow-xs">
          <span>Order Number:</span>
          <span className="text-rose-600">{order.orderNumber}</span>
        </div>
      </div>

      {/* Cash on Delivery Doorstep Payment Card */}
      <div className="bg-emerald-50/70 p-6 rounded-3xl border border-emerald-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-sm text-emerald-950">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Cash on Delivery (COD) Instructions</span>
          </div>
          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
            Pay ₹{order.total} on Delivery
          </span>
        </div>
        <p className="text-xs text-emerald-900 leading-relaxed">
          You do not need to make any advance payment. Please keep exact change of <strong>₹{order.total}</strong> ready. When the courier delivery partner brings the parcel to your address, you can hand over the cash or scan the courier's official UPI QR code at your doorstep.
        </p>
      </div>

      {/* Delivery Timeline Card */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Estimated Doorstep Delivery</h3>
            <p className="text-xs text-emerald-700 font-semibold">
              {formatDate(minDelivery)} — {formatDate(maxDelivery)}
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">Delivery Address:</p>
          <p>{order.shippingAddress.fullName} • {order.customerPhone}</p>
          <p>{order.shippingAddress.addressLine1}, {order.shippingAddress.addressLine2 || ''}</p>
          <p>{order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}</p>
        </div>
      </div>

      {/* Items Summary Card */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 border-b border-stone-100 pb-3">
          Ordered Photo Products ({order.items.length})
        </h3>

        <div className="divide-y divide-slate-100 space-y-3">
          {order.items.map((item, idx) => (
            <div key={idx} className="pt-3 first:pt-0 flex gap-3.5 items-center">
              <img
                src={item.photoUrls[0] || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=200'}
                alt={item.productName}
                className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0 border border-slate-200"
              />
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-semibold text-slate-900 truncate">{item.productName}</p>
                <p className="text-[11px] text-slate-500">
                  {item.size} • {item.finish} • Qty {item.quantity}
                </p>
                {item.caption && (
                  <p className="text-[11px] text-slate-600 font-['Caveat',cursive]">
                    "{item.caption}"
                  </p>
                )}
              </div>
              <span className="font-bold text-xs text-slate-900">
                ₹{item.totalPrice}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>₹{order.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{order.shippingCharges === 0 ? 'FREE' : `₹${order.shippingCharges}`}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Discount</span>
              <span>-₹{order.discount}</span>
            </div>
          )}
          <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-2 border-t border-slate-200">
            <span>Order Total</span>
            <span className="text-rose-600">₹{order.total}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Order Status</span>
            <span className="font-semibold text-amber-700 capitalize">Pending Confirmation</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onNavigateOrders}
          className="w-full sm:flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Package className="w-4 h-4" />
          <span>Track in My Orders</span>
        </button>

        <button
          type="button"
          onClick={onNavigateHome}
          className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-stone-50 border border-stone-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
        >
          Explore More Pins
        </button>
      </div>
    </div>
  );
};
