import React from 'react';
import { type CartItem, fmt } from './types';

interface CarritoListaProps {
  carrito: CartItem[];
  itemSelIdx: number | null;
  onToggleSelect: (idx: number) => void;
  onDecrement:    (idx: number) => void;
  onIncrement:    (idx: number) => void;
  onQtyChange:    (idx: number, qty: number) => void;
  onDescuento:    (idx: number) => void;
}

export function CarritoLista({
  carrito, itemSelIdx,
  onToggleSelect, onDecrement, onIncrement, onQtyChange, onDescuento,
}: CarritoListaProps) {
  if (carrito.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" className="text-text-subtle opacity-15">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[14px] font-semibold text-text-muted">Carrito vacío</span>
          <span className="text-[12px] text-text-subtle">Escaneá o buscá un artículo para comenzar</span>
        </div>
        <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-[var(--r-in)] bg-surface-2 border border-border">
          <kbd className="text-[10px] font-bold text-accent bg-[rgba(79,142,245,.1)] px-1.5 py-0.5 rounded">3*código</kbd>
          <span className="text-[11px] text-text-subtle">agrega 3 unidades directamente</span>
        </div>
      </div>
    );
  }

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th style={{ width: 90 }}>Código</th>
          <th>Descripción</th>
          <th className="text-right" style={{ width: 110 }}>Precio</th>
          <th className="text-right" style={{ width: 130 }}>Cant.</th>
          <th className="text-right" style={{ width: 115 }}>Importe</th>
          <th className="text-right" style={{ width: 70 }}>Stock</th>
          <th style={{ width: 36 }} />
        </tr>
      </thead>
      <tbody>
        {carrito.map((item, idx) => (
          <CartRow
            key={item._id}
            item={item}
            idx={idx}
            selected={itemSelIdx === idx}
            onToggleSelect={onToggleSelect}
            onDecrement={onDecrement}
            onIncrement={onIncrement}
            onQtyChange={onQtyChange}
            onDescuento={onDescuento}
          />
        ))}
      </tbody>
    </table>
  );
}

interface CartRowProps {
  item: CartItem;
  idx: number;
  selected: boolean;
  onToggleSelect: (idx: number) => void;
  onDecrement:    (idx: number) => void;
  onIncrement:    (idx: number) => void;
  onQtyChange:    (idx: number, qty: number) => void;
  onDescuento:    (idx: number) => void;
}

const CartRow = React.memo(function CartRow({
  item, idx, selected,
  onToggleSelect, onDecrement, onIncrement, onQtyChange, onDescuento,
}: CartRowProps) {
  const importe = item.precio * item.cantidad * (1 - item.descPct / 100);
  return (
    <tr
      data-cart-sel={selected ? 'true' : undefined}
      onClick={() => onToggleSelect(idx)}
      className={`cursor-pointer transition-colors ${selected ? 'bg-[rgba(79,142,245,.12)] [box-shadow:inset_3px_0_0_var(--accent)]' : idx % 2 === 1 ? 'bg-[rgba(255,255,255,.018)]' : ''}`}
    >
      <td className="font-mono text-[12px] text-text-muted">{item.codigo}</td>
      <td>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[15px] font-semibold text-text leading-tight">{item.nombre}</span>
          {item.descPct > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full bg-[rgba(234,179,8,.18)] text-[#f59e0b]">-{item.descPct.toFixed(1)}%</span>}
          {item.esMayoreo && <span className="text-[10px] font-bold px-1.5 rounded-full bg-[rgba(139,92,246,.18)] text-[#a78bfa]">MAY</span>}
          {item.usaInventario && item.stockActual !== undefined && item.stockActual <= 0 && <span className="text-[10px] font-bold px-1.5 rounded-full bg-[rgba(239,68,68,.18)] text-[#f87171]">SIN STOCK</span>}
          {item.promoId && <span className="text-[10px] font-bold px-1.5 rounded-full bg-[rgba(34,197,94,.18)] text-[#4ade80]">PROMO</span>}
        </div>
      </td>
      <td className="text-right font-mono text-[14px] text-text-muted">{fmt(item.precio)}</td>
      <td className="text-right">
        <div className="flex items-center justify-end">
          <div className="flex items-center border border-border rounded-[var(--r-in)] overflow-hidden">
            <button className="w-8 h-8 flex items-center justify-center text-text-muted hover:bg-surface-2 text-[16px] font-bold flex-shrink-0" onClick={e => { e.stopPropagation(); onDecrement(idx); }}>−</button>
            <input
              type="number" step="any" min="0.001"
              value={item.cantidad}
              onChange={e => { onQtyChange(idx, parseFloat(e.target.value) || 1); }}
              onClick={e => e.stopPropagation()}
              className="w-14 text-center bg-transparent border-none outline-none text-[14px] font-semibold py-1.5"
            />
            <button className="w-8 h-8 flex items-center justify-center text-text-muted hover:bg-surface-2 text-[16px] font-bold flex-shrink-0" onClick={e => { e.stopPropagation(); onIncrement(idx); }}>+</button>
          </div>
        </div>
      </td>
      <td className="text-right font-mono text-[16px] font-bold text-text tabular-nums">{fmt(importe)}</td>
      <td className="text-right">
        {item.usaInventario && item.stockActual !== undefined ? (
          <span className={`text-[11px] font-bold tabular-nums ${
            item.stockActual <= 0 ? 'text-[#f87171]' :
            item.stockActual < 10 ? 'text-[#fbbf24]' :
            'text-text-subtle'
          }`}>{item.stockActual}</span>
        ) : <span className="text-text-subtle text-[12px]">—</span>}
      </td>
      <td>
        <button
          onClick={e => { e.stopPropagation(); onDescuento(idx); }}
          className="p-1.5 rounded text-text-subtle hover:text-warning transition-colors"
          title="Aplicar descuento"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
        </button>
      </td>
    </tr>
  );
});
