import React, { useState } from 'react';
import { Shield, Truck, RotateCcw, FileText, CheckCircle2 } from 'lucide-react';

interface PolicyPagesProps {
  initialPolicy?: 'privacy' | 'shipping' | 'refund' | 'terms';
}

export const PolicyPages: React.FC<PolicyPagesProps> = ({ initialPolicy = 'privacy' }) => {
  const [activePolicy, setActivePolicy] = useState<'privacy' | 'shipping' | 'refund' | 'terms'>(initialPolicy);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Policy Tabs */}
      <div className="flex border-b border-stone-200 overflow-x-auto gap-4 text-xs font-bold scrollbar-none pb-1">
        <button
          onClick={() => setActivePolicy('privacy')}
          className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
            activePolicy === 'privacy'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Privacy & Photo Security</span>
        </button>

        <button
          onClick={() => setActivePolicy('shipping')}
          className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
            activePolicy === 'shipping'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Pan-India Shipping Policy</span>
        </button>

        <button
          onClick={() => setActivePolicy('refund')}
          className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
            activePolicy === 'refund'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Cancellation & Refunds</span>
        </button>

        <button
          onClick={() => setActivePolicy('terms')}
          className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
            activePolicy === 'terms'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Terms of Service</span>
        </button>
      </div>

      {/* Policy Content Body */}
      <div className="bg-white p-6 sm:p-10 rounded-3xl border border-stone-200 shadow-xs space-y-6 text-xs text-slate-600 leading-relaxed">
        {/* 1. Privacy Policy */}
        {activePolicy === 'privacy' && (
          <div className="space-y-4">
            <h1 className="font-['Playfair_Display',serif] text-2xl font-bold text-slate-900">
              Privacy & Customer Photo Protection Policy
            </h1>
            <p className="text-slate-500 text-[11px]">Last Updated: October 2026 • Compliant with Indian IT Act 2000 & DPDP Act</p>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 space-y-1">
              <p className="font-bold">Our Zero-Sharing Commitment to You:</p>
              <p>
                We understand that your photos capture intimate family milestones, vacations, and personal moments. MemoPrint guarantees that your photos are NEVER shared, rented, or showcased publicly without explicit written consent.
              </p>
            </div>

            <h3 className="font-bold text-sm text-slate-900 pt-2">1. Data We Collect</h3>
            <p>
              To process your order, MemoPrint collects your name, email address, delivery address, Indian mobile number, and the digital photographs you upload for print reproduction.
            </p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">2. How Your Photos Are Handled</h3>
            <p>
              Photos are stored on secure encrypted servers accessible strictly by authorized lab technicians during the physical printing, cutting, and framing process. Printing files are retained for 30 days solely to facilitate re-prints in case of transit damage, after which they are permanently deleted from our active servers.
            </p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">3. Payment Information</h3>
            <p>
              MemoPrint operates strictly on a Cash on Delivery (COD) basis. We do not ask for, process, or store credit card numbers, CVVs, debit card PINs, or netbanking passwords on our servers. Payment is made in cash directly to the authorized courier delivery agent upon physical handover of your package.
            </p>
          </div>
        )}

        {/* 2. Shipping Policy */}
        {activePolicy === 'shipping' && (
          <div className="space-y-4">
            <h1 className="font-['Playfair_Display',serif] text-2xl font-bold text-slate-900">
              Pan-India Shipping & Delivery Policy
            </h1>
            <p className="text-slate-500 text-[11px]">Effective across all 28 states & 8 Union Territories</p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">1. Production & Lab Processing</h3>
            <p>
              Each item is custom printed on Fuji Archival Paper upon order receipt. Production, laboratory drying, and quality control inspection takes 24 to 48 hours (excluding Sundays and national holidays).
            </p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">2. Estimated Delivery Timelines</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Tier 1 Metros:</strong> Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai, Kolkata, Pune (2 to 4 business days post-dispatch).</li>
              <li><strong>Tier 2 & 3 Cities:</strong> Jaipur, Ahmedabad, Lucknow, Chandigarh, Kochi, Coimbatore, Indore, etc. (3 to 5 business days).</li>
              <li><strong>Rest of India & Remote Areas:</strong> 5 to 7 business days via India Post Speed Post / Delhivery Air.</li>
            </ul>

            <h3 className="font-bold text-sm text-slate-900 pt-2">3. Shipping Charges</h3>
            <p>
              We provide <strong>FREE Shipping across India</strong> on all orders with a cart value of ₹499 or higher. For orders below ₹499, a flat shipping charge of ₹60 is applied at checkout.
            </p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">4. Courier Partners & Tracking</h3>
            <p>
              We partner with trusted Indian logistics providers: BlueDart, Delhivery, DTDC, and Shadowfax. Once dispatched, an SMS and email notification with your live AWB tracking link is triggered.
            </p>
          </div>
        )}

        {/* 3. Refund Policy */}
        {activePolicy === 'refund' && (
          <div className="space-y-4">
            <h1 className="font-['Playfair_Display',serif] text-2xl font-bold text-slate-900">
              Cancellation, Return & Refund Policy
            </h1>
            <p className="text-slate-500 text-[11px]">Consumer Protection (E-Commerce) Rules India</p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">1. Cancellation Window</h3>
            <p>
              Because each order is custom-made with your personal photos, cancellations are accepted only within <strong>2 hours</strong> of order placement before the print job enters the photographic chemical processors. After printing has begun, customized orders cannot be cancelled.
            </p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">2. Transit Damage & Free Replacement Guarantee</h3>
            <p>
              If your prints, frames, or mug arrive bent, cracked, or defective due to courier mishandling, we will reprint and deliver a brand new package at 100% zero cost.
            </p>
            <p>
              To claim a replacement, please notify us within 48 hours of delivery at <strong>care@memoprint.in</strong> or WhatsApp <strong>+91 98765 43210</strong> with a photo of the damaged parcel and your Order ID.
            </p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">3. Refund Processing</h3>
            <p>
              In approved cases where a replacement is not viable, refunds are credited back to the original payment source (UPI, Credit/Debit card, or NetBanking) within 5 to 7 working days as per standard banking cycles in India.
            </p>
          </div>
        )}

        {/* 4. Terms of Service */}
        {activePolicy === 'terms' && (
          <div className="space-y-4">
            <h1 className="font-['Playfair_Display',serif] text-2xl font-bold text-slate-900">
              Terms & Conditions of Service
            </h1>
            <p className="text-slate-500 text-[11px]">Governed under the laws of the Republic of India</p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">1. Overview</h3>
            <p>
              This website is operated by MemoPrint India Private Limited. By visiting our site and purchasing personalized photo products, you agree to be bound by the following terms.
            </p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">2. Copyright of Uploaded Content</h3>
            <p>
              You represent and warrant that you own or have the legal right to reproduce any photograph, artwork, or text you submit to MemoPrint. We reserve the right to refuse printing materials that infringe copyrights or violate Indian law.
            </p>

            <h3 className="font-bold text-sm text-slate-900 pt-2">3. Color Accuracy & Screen Variations</h3>
            <p>
              Digital monitors (RGB) and photographic prints (CMYK / silver halide) may exhibit minor color and tonal differences due to screen brightness, ambient lighting, and calibration settings. We utilize industry-standard ICC color profiling to ensure maximum fidelity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
