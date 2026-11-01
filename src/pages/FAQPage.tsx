import React, { useState } from 'react';
import { ChevronDown, HelpCircle, ShieldCheck, Sparkles, Truck, Camera } from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
  category: string;
}

export const FAQPage: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      category: 'Photos & Quality',
      q: 'Can I upload photos taken directly from my smartphone or WhatsApp?',
      a: 'Absolutely! Our lab printing engines are optimized for modern smartphone cameras (iPhone, Samsung, OnePlus, Pixel, etc.). WhatsApp images work great for Polaroids and photo strips. For large format posters (A3/A2), we recommend using the original uncompressed photo from your camera gallery for maximum sharpness.',
    },
    {
      category: 'Privacy & Security',
      q: 'How does MemoPrint protect my privacy and personal photographs?',
      a: 'Your privacy is sacred to us. All photo uploads are transmitted via encrypted HTTPS/SSL connections. Your images are accessed strictly by our automated printing machines and vetted lab technicians to execute the print run. We never display customer photos publicly, never sell data, and automatically purge printing cache files after 30 days of fulfilled delivery.',
    },
    {
      category: 'Shipping & Delivery',
      q: 'How long does delivery take across India? Is there Free Shipping?',
      a: 'We offer FREE Shipping across all 28 states of India on orders above ₹499 (for orders below ₹499, a nominal ₹60 courier fee applies). Printing & lab inspection takes 24 to 48 hours. Express transit takes 2-4 business days for Tier 1 metros (Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai, Kolkata, Pune) and 4-6 business days for the rest of India via BlueDart, Delhivery, and DTDC.',
    },
    {
      category: 'Materials & Paper',
      q: 'What paper finish and cardstock weight do you use?',
      a: 'We use genuine 300 GSM Fuji Crystal Archive photographic paper and 350 GSM premium silk cardstock. Unlike regular desktop inkjet prints, our archival photographic chemistry produces water-resistant, fingerprint-resistant, and non-fading prints guaranteed to retain color fidelity for over 75 years.',
    },
    {
      category: 'Customization',
      q: 'Can I add personalized handwritten captions or emojis to my Polaroids?',
      a: 'Yes! When customizing your Polaroids, photo strips, or frames, you can type your caption, date, location, or favorite emoji. It will be printed in our signature artistic handwriting font in the margin space below your photograph.',
    },
    {
      category: 'Payments',
      q: 'What payment options do you accept in India?',
      a: 'MemoPrint operates exclusively on Cash on Delivery (COD) across all Indian pin codes. You do not need to make any advance online card or bank payment. When your custom photo prints arrive at your doorstep, you simply pay the exact amount in cash (or via courier UPI QR scan) to the delivery executive upon receiving your package.',
    },
    {
      category: 'Returns & Damages',
      q: 'What if my photo prints or wooden frame arrive bent or damaged?',
      a: 'All MemoPrint products are shipped in rigid, triple-layered protective cardboard boxes. If any item is damaged during transit, simply email us a photo at care@memoprint.in or WhatsApp us at +91 98765 43210 within 48 hours of delivery. We will immediately reprint and dispatch a fresh replacement at zero extra cost!',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center justify-center gap-1">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Frequently Asked Questions</span>
        </span>
        <h1 className="font-['Playfair_Display',serif] text-3xl sm:text-4xl font-extrabold text-slate-900">
          Everything You Need to Know
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Quick answers about photo sizes, paper materials, Indian shipping timelines, and payment security.
        </p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-stone-50/50 transition-colors"
              >
                <div>
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-1">
                    {faq.category}
                  </span>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    {faq.q}
                  </h3>
                </div>
                <div
                  className={`w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 bg-rose-100 text-rose-700' : 'text-slate-500'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-stone-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-6 bg-rose-50/60 rounded-3xl border border-rose-100 text-center space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Still have a question?</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Our friendly support team in Bengaluru is available on WhatsApp and email to assist you with custom print requests.
        </p>
        <a
          href="https://wa.me/919876543210"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
        >
          <span>Chat on WhatsApp</span>
        </a>
      </div>
    </div>
  );
};
