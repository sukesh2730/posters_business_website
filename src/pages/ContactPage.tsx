import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, CheckCircle2, Heart } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Order Enquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
          We're Here For You
        </span>
        <h1 className="font-['Playfair_Display',serif] text-3xl sm:text-4xl font-extrabold text-slate-900">
          Get In Touch With MemoPrint
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Have questions about your order, photo dimensions, or custom corporate gifting? Our Bengaluru team responds swiftly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Contact Info Cards */}
        <div className="lg:col-span-5 space-y-4">
          {/* WhatsApp Card */}
          <div className="bg-emerald-50/70 p-6 rounded-3xl border border-emerald-200 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-emerald-950">Instant WhatsApp Support</h3>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Need immediate help with a photo upload or courier tracking? Chat directly with our customer happiness team.
            </p>
            <a
              href="https://wa.me/919876543210?text=Hi%20MemoPrint,%20I%20need%20help%20with%20my%20order"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <span>Chat on WhatsApp (+91 98765 43210)</span>
            </a>
          </div>

          {/* Email Support Card */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Email Assistance</h3>
            <p className="text-xs text-slate-500">
              For order cancellations, high-res file transfers, and collaboration queries:
            </p>
            <p className="font-mono text-xs font-bold text-rose-600">
              care@memoprint.in
            </p>
            <p className="text-[11px] text-slate-400">Response time: within 3 to 6 business hours</p>
          </div>

          {/* Studio Address */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Printing Lab & Registered Office</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              MemoPrint India Pvt Ltd<br />
              100 Feet Road, Indiranagar<br />
              Bengaluru, Karnataka 560038, India
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Lab Operations: Mon - Sat (10:00 AM - 7:00 PM IST)</span>
            </div>
          </div>
        </div>

        {/* Message Form */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-xs space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Send Us a Direct Message</h2>

          {submitted ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Message Received!</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Thank you, {name}. Our customer support representative will review your message and reply to <strong>{email}</strong> within a few hours.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setMessage('');
                }}
                className="mt-4 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-400 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Phone (Optional)</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-400 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inquiry Topic</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-400 focus:bg-white"
                >
                  <option value="Order Enquiry">Track My Existing Order</option>
                  <option value="Photo Customization">Help With Photo Upload or Resolution</option>
                  <option value="Bulk Order">Bulk / Wedding / Corporate Gifting</option>
                  <option value="Payments">Payment & Invoice Issue</option>
                  <option value="Feedback">General Feedback & Suggestions</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="How can we assist you today? If inquiring about an existing order, please include your Order ID (e.g. MP-123456)."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-400 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Message</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
