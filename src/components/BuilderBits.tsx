import React from 'react';

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export const PriceLine: React.FC<{ price: number; mrp: number; className?: string }> = ({ price, mrp, className = '' }) => (
  <span className={`inline-flex items-baseline gap-2 ${className}`}>
    <span className="text-xl font-bold text-slate-900">{rupees(price)}</span>
    {mrp > price && (
      <>
        <span className="text-sm text-slate-400 line-through">{rupees(mrp)}</span>
        <span className="text-xs font-semibold text-emerald-600">Save {rupees(mrp - price)}</span>
      </>
    )}
  </span>
);

export const StepHeading: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="flex items-baseline justify-between gap-3">
    <h2 className="font-['Playfair_Display',serif] text-xl font-semibold text-slate-900">{title}</h2>
    {hint && <span className="text-xs text-slate-500">{hint}</span>}
  </div>
);
