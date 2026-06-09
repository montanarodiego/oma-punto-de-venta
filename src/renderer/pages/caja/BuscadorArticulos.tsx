import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { Articulo } from '../../types/api';
import { fmt } from './types';

interface BuscadorArticulosProps {
  open: boolean;
  onClose: () => void;
  onSelect: (art: Articulo) => void;
}

export function BuscadorArticulos({ open, onClose, onSelect }: BuscadorArticulosProps) {
  const [query, setQuery]   = useState('');
  const [items, setItems]   = useState<Articulo[]>([]);
  const [selIdx, setSelIdx] = useState(-1);
  const inputRef  = useRef<HTMLInputElement>(null);
  const boxRef    = useRef<HTMLDivElement>(null);
  const timerRef  = useRef<NodeJS.Timeout | null>(null);

  useFocusTrap(boxRef, open, onClose);

  async function buscar(q: string) {
    if (!q.trim()) { setItems([]); return; }
    const res = await window.api.articulos.search(q);
    setItems(res);
    setSelIdx(-1);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(v), 200);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (selIdx >= 0 && items[selIdx]) select(items[selIdx]); }
    else if (e.key === 'Escape') onClose();
  }

  function select(art: Articulo) {
    onSelect(art);
    onClose();
    setQuery('');
    setItems([]);
    setSelIdx(-1);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={boxRef}
            className="w-[560px] max-w-[95vw] bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] overflow-hidden"
            initial={{ y: -20, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -20, scale: 0.97 }}
            transition={{ duration: 0.2 }}
          >
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className="w-full px-5 py-4 text-[17px] bg-transparent border-b border-border outline-none text-text placeholder:text-text-subtle"
              placeholder="Buscá por nombre, código o descripción..."
            />
            <div className="max-h-[400px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="py-10 text-center text-text-subtle text-[14px]">
                  {query ? 'Sin resultados' : 'Escribí para buscar artículos'}
                </div>
              ) : items.map((art, i) => (
                <div
                  key={art.id}
                  onClick={() => select(art)}
                  className={`flex items-center gap-4 px-5 py-3 cursor-pointer border-b border-border-sub transition-colors ${selIdx === i ? 'bg-[rgba(79,142,245,.12)]' : 'hover:bg-surface-2'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-text truncate">{art.nombre}</div>
                    <div className="text-[12px] text-text-muted mt-0.5">{art.codigo} · Stock: {art.stock_actual} {art.unidad_medida}</div>
                  </div>
                  <div className="text-[18px] font-black font-mono text-text tabular-nums">{fmt(art.precio_unitario)}</div>
                </div>
              ))}
            </div>
            <div className="px-5 py-2.5 border-t border-border text-[12px] text-text-subtle flex gap-4">
              <span>↑↓ navegar</span><span>Enter seleccionar</span><span>Esc cerrar</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
