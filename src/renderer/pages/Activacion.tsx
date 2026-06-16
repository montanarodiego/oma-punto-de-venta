import { useState } from 'react';
import { LICENCIA_ACTIVADA_EVENT } from '../App';

export default function Activacion() {
  const [clave,   setClave]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const key = clave.trim();
    if (!key) { setError('Ingresá tu clave de licencia.'); return; }
    setLoading(true); setError('');
    try {
      const res = await window.api.licencia.activar(key);
      if (res.ok) {
        // Avisa a App que ya está activado → AppRoutes remonta y sigue a Setup/Login.
        window.dispatchEvent(new Event(LICENCIA_ACTIVADA_EVENT));
      } else {
        setError(res.error ?? 'No se pudo activar la licencia.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo activar la licencia.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d1a33] via-bg to-[#0a1525] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent opacity-[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-[400px]">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center shadow-[0_0_30px_rgba(79,142,245,.35)]">
            <span className="text-white font-black text-2xl">O</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-text">Activar OmaTech POS</h1>
            <p className="text-[13px] text-text-subtle mt-0.5">Ingresá la clave de licencia que te enviamos</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[var(--r-card)] p-6 shadow-[var(--shadow-lg)]">
          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-[var(--r-in)] bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px]">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="field">
              <label className="field-label">Clave de licencia</label>
              <input
                className="inp text-center tracking-widest font-mono uppercase"
                value={clave}
                onChange={e => setClave(e.target.value.toUpperCase())}
                placeholder="OMA-XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoFocus
                required
              />
              <span className="field-hint">La primera activación necesita conexión a internet.</span>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm font-semibold mt-1">
              {loading ? 'Activando…' : 'Activar'}
            </button>
          </form>
        </div>
        <p className="text-center text-[11px] text-text-subtle mt-4">
          ¿No tenés tu clave? Escribinos a OmaTech.
        </p>
      </div>
    </div>
  );
}
