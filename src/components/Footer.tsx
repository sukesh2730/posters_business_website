import React from 'react';
import { Camera, Heart, Mail, Phone, MapPin, ShieldCheck, Truck, Sparkles, CheckCircle2 } from 'lucide-react';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-white border-t border-stone-200/80 pt-16 pb-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Value Proposition Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-12 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Fujifilm Archival Paper</h4>
              <p className="text-[11px] text-slate-500">True 300 GSM photo prints</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Pan-India Express Delivery</h4>
              <p className="text-[11px] text-slate-500">Free delivery on ₹499+</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Cash on Delivery (COD)</h4>
              <p className="text-[11px] text-slate-500">Pay at doorstep upon arrival</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Handcrafted with Love</h4>
              <p className="text-[11px] text-slate-500">Proudly printed in India</p>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 py-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center text-white">
                <Camera className="w-4 h-4" />
              </div>
              <span className="font-['Playfair_Display',serif] text-xl font-bold text-slate-900">
                Memo<span className="text-rose-600">Print</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
              MemoPrint is India's premier personalized photo gifting brand. We believe every smartphone photo carries a story worth holding, framing, and gifting to people you love.
            </p>
            <div className="space-y-1 text-xs text-slate-600">
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-rose-500" />
                <span>care@memoprint.in</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-rose-500" />
                <span>+91 98765 43210 (Mon-Sat, 10am - 7pm IST)</span>
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Indiranagar, Bengaluru, Karnataka 560038, India</span>
              </p>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-3">
              Shop Collections
            </h5>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <button onClick={() => onNavigate('catalog?cat=polaroids')} className="hover:text-rose-600">
                  Polaroid Prints
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('catalog?cat=photo-strips')} className="hover:text-rose-600">
                  Photobooth Strips
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('catalog?cat=frames')} className="hover:text-rose-600">
                  Wood & Acrylic Frames
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('catalog?cat=posters')} className="hover:text-rose-600">
                  Gallery Posters
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('catalog?cat=collages')} className="hover:text-rose-600">
                  Heart & Grid Collages
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('catalog?cat=gifts')} className="hover:text-rose-600">
                  Photo Mugs & Keychains
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-3">
              Customer Support
            </h5>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <button onClick={() => onNavigate('account')} className="hover:text-rose-600">
                  Track Your Order
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('faq')} className="hover:text-rose-600">
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('contact')} className="hover:text-rose-600">
                  Contact Us / WhatsApp
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('shipping-policy')} className="hover:text-rose-600">
                  Shipping & Delivery Info
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('cancellation-refund')} className="hover:text-rose-600">
                  Cancellation & Refunds
                </button>
              </li>
            </ul>
          </div>

          {/* Legal Policies */}
          <div>
            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-3">
              Legal & Trust
            </h5>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <button onClick={() => onNavigate('privacy-policy')} className="hover:text-rose-600">
                  Privacy Policy (Photo Safety)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('terms')} className="hover:text-rose-600">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('shipping-policy')} className="hover:text-rose-600">
                  Pan-India Shipping Policy
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('cancellation-refund')} className="hover:text-rose-600">
                  Return & Refund Policy
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright & Payment Methods */}
        <div className="pt-8 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} MemoPrint India Private Limited. All rights reserved.</p>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-semibold text-slate-600">Payment Option:</span>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold">Cash on Delivery (COD)</span>
            <span className="px-2.5 py-0.5 bg-slate-100 rounded text-slate-700 font-bold">Doorstep Handover</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
