import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  LogOut, 
  ChevronRight, 
  ShoppingBag,
  ExternalLink,
  Loader2,
  QrCode
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getCustomerOrders } from '../services/orderService';
import { Order, OrderStatus } from '../types';

interface AccountPageProps {
  onExplore: () => void;
  onOpenAuth: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onExplore, onOpenAuth }) => {
  const { currentUser, userProfile, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      getCustomerOrders(currentUser.uid)
        .then((data) => {
          setOrders(data);
          if (data.length > 0 && !selectedOrder) {
            setSelectedOrder(data[0]);
          }
        })
        .catch((err) => {
          console.error('Error fetching customer orders:', err);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Sign in to view your orders</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Access your past orders, payment status, and photo designs by logging into your MemoPrint account.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending_confirmation':
        return { label: 'Pending Confirmation', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'confirmed':
        return { label: 'Confirmed', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'processing':
        return { label: 'Processing', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'printing':
        return { label: 'Printing & Lab QC', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'shipped':
        return { label: 'Shipped via Courier', color: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'delivered':
        return { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'cancelled':
        return { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'placed':
      default:
        return { label: 'Order Received', color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Profile Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left">
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt="Profile"
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
              {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
            </div>
          )}
          <div>
            <h1 className="font-['Playfair_Display',serif] text-xl sm:text-2xl font-bold text-slate-900">
              {currentUser.displayName || 'MemoPrint Customer'}
            </h1>
            <p className="text-xs text-slate-500">{currentUser.email}</p>
            <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Customer Account
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Orders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">My Orders & Status</h2>
          <span className="text-xs text-slate-500">{orders.length} order(s) placed</span>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-rose-600 mx-auto" />
            <p className="text-xs text-slate-500">Retrieving your orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-stone-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">No orders yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Explore our Pinterest-inspired gallery and start customizing your favorite moments.
              </p>
            </div>
            <button
              onClick={onExplore}
              className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-rose-700 transition-colors"
            >
              Explore Designs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Orders List */}
            <div className="lg:col-span-5 space-y-3">
              {orders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const statusMeta = getStatusBadge(order.orderStatus);

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-rose-600 bg-rose-50/30 shadow-xs'
                        : 'border-stone-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.color}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <img
                        src={order.items[0]?.photoUrls[0] || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=100'}
                        alt="Product thumb"
                        className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0 text-xs">
                        <p className="font-semibold text-slate-800 truncate">
                          {order.items[0]?.productName}
                          {order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className="font-black text-xs text-slate-900">₹{order.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Order Detail View */}
            {selectedOrder && (
              <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-4">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 uppercase">
                      Order Details
                    </span>
                    <h3 className="font-bold text-base text-slate-900">
                      {selectedOrder.orderNumber}
                    </h3>
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      getStatusBadge(selectedOrder.orderStatus).color
                    }`}
                  >
                    {getStatusBadge(selectedOrder.orderStatus).label}
                  </span>
                </div>

                {/* Payment & Tracking Info Box */}
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Payment Method: Cash on Delivery (COD)</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedOrder.paymentStatus === 'paid'
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-amber-100 text-amber-900'
                    }`}>
                      {selectedOrder.paymentStatus === 'paid' ? 'Paid (Cash Collected)' : 'Payment Pending on Delivery'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    {selectedOrder.paymentStatus === 'paid'
                      ? `Cash collection verified on ${selectedOrder.paidAt ? new Date(selectedOrder.paidAt).toLocaleDateString('en-IN') : 'delivery'}.`
                      : `Amount to pay on doorstep delivery: ₹${selectedOrder.total} in cash or via courier UPI QR.`}
                  </p>
                </div>

                {selectedOrder.trackingNumber ? (
                  <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-purple-900">
                      <Truck className="w-4 h-4 text-purple-700" />
                      <span>Shipped with {selectedOrder.trackingCourier || 'Delhivery Express'}</span>
                    </div>
                    <p className="text-purple-800">
                      Tracking AWB: <code className="font-mono bg-purple-100 px-2 py-0.5 rounded font-bold">{selectedOrder.trackingNumber}</code>
                    </p>
                  </div>
                ) : null}

                {/* Items */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
                    Customized Items ({selectedOrder.items.length})
                  </h4>
                  <div className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="py-3 first:pt-0 flex gap-3.5 items-center">
                        <img
                          src={item.photoUrls[0] || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=120'}
                          alt={item.productName}
                          className="w-14 h-14 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <p className="font-bold text-slate-900">{item.productName}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.size} • {item.finish} • Qty {item.quantity}
                          </p>
                          {item.caption && (
                            <p className="text-[11px] text-slate-600 font-['Caveat',cursive]">
                              Caption: "{item.caption}"
                            </p>
                          )}
                        </div>
                        <span className="font-extrabold text-xs text-slate-900">
                          ₹{item.totalPrice}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping info */}
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800">Delivery Address:</p>
                  <p>{selectedOrder.shippingAddress.fullName} • {selectedOrder.customerPhone}</p>
                  <p>{selectedOrder.shippingAddress.addressLine1}, {selectedOrder.shippingAddress.addressLine2 || ''}</p>
                  <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.pincode}</p>
                </div>

                {/* Total */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500">Payment:</span>{' '}
                    <strong className="text-slate-800 uppercase">{selectedOrder.paymentStatus.replace('_', ' ')}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Total</span>
                    <span className="font-black text-base text-rose-600">₹{selectedOrder.total}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
