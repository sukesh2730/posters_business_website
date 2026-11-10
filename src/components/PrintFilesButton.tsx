import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { BuilderConfig } from '../shared/printPricing';
import { ImageFetcher, buildPrintZip } from '../utils/printExport';
import { auth } from '../services/firebase';

/** Admin-only button: builds a ZIP of print-ready files for one wall / split poster / mix pack. */
export const PrintFilesButton: React.FC<{ builder: BuilderConfig; orderNumber: string; label?: string }> = ({ builder, orderNumber, label }) => {
  const [state, setState] = useState<{ busy: boolean; done: number; total: number; error: string | null }>({ busy: false, done: 0, total: 0, error: null });

  const fetcher: ImageFetcher = async (url) => {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) throw new Error(`Could not download the customer's photo (${r.status}). Try signing in again.`);
    return r.blob();
  };

  const run = async () => {
    setState({ busy: true, done: 0, total: 0, error: null });
    try {
      const { blob, fileName } = await buildPrintZip(builder, orderNumber, fetcher, (done, total) => setState((s) => ({ ...s, done, total })));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setState({ busy: false, done: 0, total: 0, error: null });
    } catch (e: any) {
      setState({ busy: false, done: 0, total: 0, error: e?.message || 'Could not build the print files.' });
    }
  };

  return (
    <div className="mt-1">
      <button type="button" onClick={run} disabled={state.busy}
        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border border-stone-300 bg-white hover:border-rose-400 disabled:opacity-60">
        {state.busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
        {state.busy ? `Building ${state.done}/${state.total || '…'}` : label || 'Print files (ZIP)'}
      </button>
      {state.error && <p role="alert" className="text-[10px] text-rose-600 mt-1 max-w-[220px]">{state.error}</p>}
    </div>
  );
};
