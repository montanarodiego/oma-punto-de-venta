import { useState, useRef, useCallback, useMemo } from 'react';
import type { Articulo } from '../../types/api';
import { type CartItem, type Ticket, type PromoItem, UNIDADES_CONTINUAS, MAX_TICKETS, mkItem, aplicarPromoAItem } from './types';
import { calcularTotales, type Totales } from './calculosFiscales';

interface UseCarritoOptions {
  modoNegocio: string;
  tasaIva: number;
  mostrarIva: boolean;
  mayoreoMode: boolean;
  propina: string;
  showToast: (msg: string, type?: string) => void;
  focusCodigo:  () => void;
  clearCodigo:  () => void;
}

export interface UseCarritoReturn {
  tickets: Ticket[];
  activeIdx: number;
  setActiveIdx: (idx: number) => void;
  ticket: Ticket;
  totales: Totales;
  activeIdxRef: React.MutableRefObject<number>;
  ticketsRef: React.MutableRefObject<Ticket[]>;
  mayoreoModeRef: React.MutableRefObject<boolean>;
  nuevoTicket: () => void;
  cerrarTicket: (idx: number) => void;
  limpiarTicket: (idx: number) => void;
  updateTicket: (idx: number, patch: Partial<Ticket>) => void;
  agregarArticulo: (art: Articulo, cantidad?: number) => Promise<void>;
  borrarItemSel: () => void;
  onCartToggleSelect: (idx: number) => void;
  onCartDecrement:    (idx: number) => void;
  onCartIncrement:    (idx: number) => void;
  onCartQtyChange:    (idx: number, qty: number) => void;
  qtyEditorOpen: boolean;
  qtyEditorVal:  string;
  qtyEditorIdx:  number | null;
  setQtyEditorOpen: (v: boolean) => void;
  setQtyEditorVal:  (v: string) => void;
  setQtyEditorIdx:  (v: number | null) => void;
  openQtyEditor:    (idx: number) => void;
  confirmQtyEditor: (idx: number, val: string) => void;
}

export function useCarrito({
  modoNegocio, tasaIva, mostrarIva, mayoreoMode, propina, showToast, focusCodigo, clearCodigo,
}: UseCarritoOptions): UseCarritoReturn {
  const [tickets, setTickets] = useState<Ticket[]>([{
    id: Date.now(), nombre: 'Venta', carrito: [],
    clienteSeleccionado: null, formaPago: 'efectivo',
    descGlobalTipo: 'ninguno', descGlobalValor: 0, notas: '', itemSelIdx: null,
  }]);
  const [activeIdx, setActiveIdx] = useState(0);

  const activeIdxRef   = useRef(activeIdx);
  const ticketsRef     = useRef(tickets);
  const mayoreoModeRef = useRef(mayoreoMode);
  activeIdxRef.current   = activeIdx;
  ticketsRef.current     = tickets;
  mayoreoModeRef.current = mayoreoMode;

  const ticket = tickets[activeIdx];

  const totales: Totales = useMemo(
    () => calcularTotales(ticket.carrito, ticket.descGlobalTipo, ticket.descGlobalValor, propina, modoNegocio, mostrarIva, tasaIva),
    [ticket, propina, modoNegocio, mostrarIva, tasaIva],
  );

  // ── Ticket management ────────────────────────────────────────────
  function nuevoTicket() {
    if (tickets.length >= MAX_TICKETS) { showToast('Máximo 5 tickets simultáneos.', 'error'); return; }
    const n: Ticket = {
      id: Date.now(), nombre: `Ticket ${tickets.length + 1}`, carrito: [],
      clienteSeleccionado: null, formaPago: 'efectivo',
      descGlobalTipo: 'ninguno', descGlobalValor: 0, notas: '', itemSelIdx: null,
    };
    setTickets(prev => [...prev, n]);
    setActiveIdx(tickets.length);
  }

  function cerrarTicket(idx: number) {
    if (tickets.length === 1) { limpiarTicket(0); return; }
    setTickets(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(prev => Math.max(0, prev >= idx ? prev - 1 : prev));
  }

  function limpiarTicket(idx: number) {
    updateTicket(idx, { carrito: [], clienteSeleccionado: null, formaPago: 'efectivo', descGlobalTipo: 'ninguno', descGlobalValor: 0, notas: '', itemSelIdx: null });
    clearCodigo();
  }

  function updateTicket(idx: number, patch: Partial<Ticket>) {
    setTickets(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }

  // ── Cart ─────────────────────────────────────────────────────────
  const agregarArticulo = useCallback(async (art: Articulo, cantidad = 1) => {
    const ai = activeIdxRef.current;
    const probablyNew = !ticketsRef.current[ai]?.carrito.some(
      i => i.articuloId === art.id && i.descPct === 0 && !i.esLibre,
    );
    let promos: PromoItem[] = [];
    if (probablyNew) {
      try { promos = await window.api.promociones.listarPorArticulo(art.id); } catch {}
    }
    setTickets(prev => {
      const t = prev[ai];
      const existing = t.carrito.findIndex(
        i => i.articuloId === art.id && i.descPct === 0 && !i.esLibre,
      );
      let newCarrito: CartItem[];
      if (existing >= 0) {
        newCarrito = t.carrito.map((it, i) =>
          i === existing ? aplicarPromoAItem({ ...it, cantidad: it.cantidad + cantidad }) : it,
        );
      } else {
        const precio = (mayoreoModeRef.current && art.precio_mayoreo > 0) ? art.precio_mayoreo : art.precio_unitario;
        const item = mkItem({
          articuloId: art.id, codigo: art.codigo, nombre: art.nombre, precio,
          costo: art.costo_unitario, cantidad, stockActual: art.stock_actual,
          usaInventario: !!art.usa_inventario, unidadMedida: art.unidad_medida,
          tasaIva: art.tasa_iva, precioBase: art.precio_unitario, promos,
        });
        newCarrito = [...t.carrito, aplicarPromoAItem(item)];
      }
      const newItemSelIdx = existing >= 0 ? existing : newCarrito.length - 1;
      return prev.map((tk, i) => i === ai ? { ...tk, carrito: newCarrito, itemSelIdx: newItemSelIdx } : tk);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — uses refs

  function borrarItemSel() {
    const ai = activeIdxRef.current;
    const t = ticketsRef.current[ai];
    if (t.itemSelIdx === null) return;
    const newCarrito = t.carrito.filter((_, i) => i !== t.itemSelIdx);
    updateTicket(ai, { carrito: newCarrito, itemSelIdx: null });
  }

  // ── Stable cart callbacks ────────────────────────────────────────
  const onCartToggleSelect = useCallback((idx: number) => {
    const ai = activeIdxRef.current;
    setTickets(prev => {
      const t = prev[ai];
      return prev.map((tk, i) => i === ai ? { ...tk, itemSelIdx: t.itemSelIdx === idx ? null : idx } : tk);
    });
    focusCodigo();
  }, [focusCodigo]);

  const onCartDecrement = useCallback((idx: number) => {
    setTickets(prev => {
      const ai = activeIdxRef.current;
      const t = prev[ai];
      const item = t.carrito[idx];
      if (!item) return prev;
      const isConti = UNIDADES_CONTINUAS.has(item.unidadMedida ?? '');
      const step = isConti ? 0.1 : 1;
      const minQty = isConti ? 0.001 : 1;
      if (item.cantidad <= minQty) return prev;
      const c = [...t.carrito];
      c[idx] = aplicarPromoAItem({ ...item, cantidad: item.cantidad - step });
      return prev.map((tk, i) => i === ai ? { ...tk, carrito: c } : tk);
    });
  }, []);

  const onCartIncrement = useCallback((idx: number) => {
    setTickets(prev => {
      const ai = activeIdxRef.current;
      const t = prev[ai];
      const item = t.carrito[idx];
      if (!item) return prev;
      const isConti = UNIDADES_CONTINUAS.has(item.unidadMedida ?? '');
      const c = [...t.carrito];
      c[idx] = aplicarPromoAItem({ ...item, cantidad: item.cantidad + (isConti ? 0.1 : 1) });
      return prev.map((tk, i) => i === ai ? { ...tk, carrito: c } : tk);
    });
  }, []);

  const onCartQtyChange = useCallback((idx: number, qty: number) => {
    setTickets(prev => {
      const ai = activeIdxRef.current;
      const t = prev[ai];
      const item = t.carrito[idx];
      if (!item) return prev;
      const c = [...t.carrito];
      c[idx] = aplicarPromoAItem({ ...item, cantidad: qty });
      return prev.map((tk, i) => i === ai ? { ...tk, carrito: c } : tk);
    });
  }, []);

  // ── Qty editor ───────────────────────────────────────────────────
  const [qtyEditorOpen, setQtyEditorOpen] = useState(false);
  const [qtyEditorVal,  setQtyEditorVal]  = useState('');
  const [qtyEditorIdx,  setQtyEditorIdx]  = useState<number | null>(null);

  function openQtyEditor(idx: number) {
    const ai = activeIdxRef.current;
    const item = ticketsRef.current[ai]?.carrito[idx];
    if (!item) return;
    setTickets(prev => prev.map((t, i) => i === ai ? { ...t, itemSelIdx: idx } : t));
    setQtyEditorIdx(idx);
    setQtyEditorVal(String(item.cantidad));
    setQtyEditorOpen(true);
  }

  function confirmQtyEditor(idx: number, val: string) {
    const qty = parseFloat(val);
    if (isNaN(qty) || qty <= 0) return;
    const ai = activeIdxRef.current;
    setTickets(prev => {
      const t = prev[ai];
      const c = [...t.carrito];
      if (!c[idx]) return prev;
      c[idx] = aplicarPromoAItem({ ...c[idx], cantidad: qty });
      return prev.map((tk, i) => i === ai ? { ...tk, carrito: c } : tk);
    });
    setQtyEditorOpen(false);
    focusCodigo();
  }

  return {
    tickets, activeIdx, setActiveIdx, ticket, totales,
    activeIdxRef, ticketsRef, mayoreoModeRef,
    nuevoTicket, cerrarTicket, limpiarTicket, updateTicket,
    agregarArticulo, borrarItemSel,
    onCartToggleSelect, onCartDecrement, onCartIncrement, onCartQtyChange,
    qtyEditorOpen, qtyEditorVal, qtyEditorIdx,
    setQtyEditorOpen, setQtyEditorVal, setQtyEditorIdx,
    openQtyEditor, confirmQtyEditor,
  };
}
