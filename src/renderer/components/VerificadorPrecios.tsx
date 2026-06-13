import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fmt } from '../pages/caja/types';
import type { Articulo } from '../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function VerificadorPrecios({ open, onClose }: Props) {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<Articulo[]>([]);
  const [selIdx,    setSelIdx]    = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer    = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelIdx(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'F9') { e.preventDefault(); onClose(); }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function handleSearch(v: string) {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    if (!v.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const byCode = await window.api.articulos.getByCodigo(v.trim());
        if (byCode) {
          setResults([byCode]);
          setSelIdx(0);
        } else {
          const res = await window.api.articulos.search(v.trim());
          setResults(res.slice(0, 12));
          setSelIdx(0);
        }
      } finally {
        setSearching(false);
      }
    }, 150);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); }
  }

  const art = results[selIdx] ?? null;

  function agregar() {
    if (!art) return;
    window.dispatchEvent(new CustomEvent('verificador:agregar', { detail: art }));
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex items-start justify-center pt-[12vh] px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] w-[580px] max-w-[98vw] flex flex-col overflow-hidden"
            initial={{ scale: 0.95, y: -10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -10 }}
            transition={{ duration: 0.16 }}
          >
            {/* Barra de búsqueda */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-2">
              <svg className="w-4 h-4 text-accent flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent outline-none text-[15px] text-text placeholder:text-text-subtle"
                placeholder="Escaneá o escribí código / nombre del artículo..."
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-text-muted bg-bg border border-border px-1.5 py-0.5 rounded">F9</span>
                <span className="text-[10px] text-text-muted">/ Esc</span>
              </div>
            </div>

            {/* Lista de resultados cuando hay varios */}
            {results.length > 1 && (
              <div className="max-h-[160px] overflow-y-auto border-b border-border">
                {results.map((r, i) => (
                  <div
                    key={r.id}
                    onClick={() => setSelIdx(i)}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer border-b border-border-sub last:border-none transition-colors ${i === selIdx ? 'bg-[rgba(79,142,245,.12)] text-text' : 'hover:bg-surface-2 text-text-muted'}`}
                  >
                    <span className="font-mono text-[11px] w-[80px] flex-shrink-0 truncate">{r.codigo}</span>
                    <span className="flex-1 text-[13px] font-medium truncate text-text">{r.nombre}</span>
                    <span className="font-mono text-[13px] font-bold text-text">{fmt(r.precio_unitario)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Panel principal */}
            <div className="p-6 flex flex-col items-center gap-4 min-h-[220px] justify-center">
              {!query.trim() && (
                <p className="text-text-subtle text-[14px] text-center">
                  Verificador de precios — visible desde el mostrador
                </p>
              )}
              {query.trim() && searching && (
                <p className="text-text-subtle text-[13px]">Buscando...</p>
              )}
              {query.trim() && !searching && results.length === 0 && (
                <p className="text-danger text-[14px]">No se encontró ningún artículo</p>
              )}
              {art && (
                <>
                  <div className="text-center">
                    <div className="font-mono text-[11px] text-text-muted mb-1">{art.codigo}</div>
                    <div className="text-[20px] font-bold text-text leading-snug max-w-[420px] text-center">{art.nombre}</div>
                  </div>

                  <div className="flex items-end gap-6">
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Precio</div>
                      <div className="text-[58px] font-black font-mono leading-none text-text">{fmt(art.precio_unitario)}</div>
                    </div>
                    {art.precio_mayoreo > 0 && art.precio_mayoreo !== art.precio_unitario && (
                      <div className="text-center pb-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Mayoreo</div>
                        <div className="text-[30px] font-bold font-mono text-text-muted">{fmt(art.precio_mayoreo)}</div>
                      </div>
                    )}
                  </div>

                  <div>
                    {art.stock_actual <= 0 ? (
                      <span className="text-[12px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full">SIN STOCK</span>
                    ) : (
                      <span className="text-[12px] font-bold bg-[rgba(34,197,94,.1)] text-[#4ade80] border border-[rgba(34,197,94,.2)] px-3 py-1 rounded-full">
                        Stock: {art.stock_actual}{art.unidad_medida ? ` ${art.unidad_medida}` : ''}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={agregar}
                    className="mt-1 px-5 py-2 bg-accent hover:bg-accent/90 text-white font-semibold rounded-[var(--r)] text-[13px] transition-colors"
                  >
                    + Agregar a venta
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
