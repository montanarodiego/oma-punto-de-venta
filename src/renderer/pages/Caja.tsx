import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useCarritoKeyboard } from '../hooks/useCarritoKeyboard';
import type { Articulo, Cliente } from '../types/api';

// ── Types ──────────────────────────────────────────────────────────
interface PromoItem {
  id: number;
  cantidad_desde: number;
  cantidad_hasta: number | null;
  precio_promocional: number;
}

interface CartItem {
  _id: number;
  articuloId?: number;
  codigo: string;
  nombre: string;
  precio: number;
  costo: number;
  cantidad: number;
  descPct: number;
  stockActual?: number;
  usaInventario?: boolean;
  unidadMedida?: string;
  tasaIva?: number;
  esLibre?: boolean;
  esMayoreo?: boolean;
  precioBase?: number;
  promoId?: number;
  promos?: PromoItem[];
}

interface Ticket {
  id: number;
  nombre: string;
  carrito: CartItem[];
  clienteSeleccionado: Cliente | null;
  formaPago: string;
  descGlobalTipo: 'ninguno' | 'pct' | 'monto';
  descGlobalValor: number;
  notas: string;
  itemSelIdx: number | null;
}

const MODOS_SIN_IVA        = new Set(['monotributista', 'restaurante']);
const MODOS_IVA_DESGLOSADO = new Set(['responsable_inscripto', 'mayorista', 'farmacia']);
const UNIDADES_CONTINUAS   = new Set(['kg', 'g', 'litro', 'ml', 'metro', 'cm']);
const MAX_TICKETS          = 5;

function fmt(n: number, moneda = '$') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n ?? 0);
}

function mkItem(base: Partial<CartItem>): CartItem {
  return { _id: Date.now() + Math.random(), codigo: '', nombre: '', precio: 0, costo: 0, cantidad: 1, descPct: 0, ...base };
}


function aplicarPromoAItem(item: CartItem): CartItem {
  if (!item.promos?.length || item.esLibre) return item;
  const promo = item.promos.find(p =>
    item.cantidad >= p.cantidad_desde &&
    (p.cantidad_hasta === null || item.cantidad <= p.cantidad_hasta),
  );
  return { ...item, precio: promo ? promo.precio_promocional : (item.precioBase ?? item.precio), promoId: promo?.id };
}

// ── Wizard modos ────────────────────────────────────────────────────
const WIZARD_MODOS = [
  { id: 'monotributista',       nombre: 'Monotributista',         desc: 'Precios finales, sin IVA desglosado',                          ejemplos: 'Kiosco, almacén, bazar' },
  { id: 'responsable_inscripto',nombre: 'Responsable Inscripto',  desc: 'IVA desglosado (21% por defecto)',                             ejemplos: 'Distribuidora, empresa' },
  { id: 'restaurante',          nombre: 'Restaurante / Rotisería',desc: 'Sin IVA desglosado, con propina',                              ejemplos: 'Rotisería, pizzería' },
  { id: 'mayorista',            nombre: 'Mayorista',              desc: 'Precios sin IVA, IVA al total',                                ejemplos: 'Distribuidora, depósito' },
  { id: 'farmacia',             nombre: 'Farmacia / Perfumería',  desc: 'IVA múltiples tasas (21%, 10,5%, 0%)',                         ejemplos: 'Farmacia, cosmética' },
  { id: 'personalizado',        nombre: 'Personalizado',          desc: 'Configurá manualmente el IVA desde Configuración',            ejemplos: '' },
];

// ── Main component ────────────────────────────────────────────────
export default function Caja() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Config
  const [tasaIva, setTasaIva] = useState(21);
  const [mostrarIva, setMostrarIva] = useState(true);
  const [modoNegocio, setModoNegocio] = useState('');
  const [moneda, setMoneda] = useState('$');
  const [turnoActivo, setTurnoActivo] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [mayoreoMode, setMayoreoMode] = useState(false);
  const [mostrarPrecioConIva, setMostrarPrecioConIva] = useState(false);

  // Tickets (multi-tab)
  const [tickets, setTickets] = useState<Ticket[]>([{ id: Date.now(), nombre: 'Venta', carrito: [], clienteSeleccionado: null, formaPago: 'efectivo', descGlobalTipo: 'ninguno', descGlobalValor: 0, notas: '', itemSelIdx: null }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const ticket = tickets[activeIdx];

  // UI state
  const [buscadorOpen, setBuscadorOpen] = useState(false);
  const [buscadorQuery, setBuscadorQuery] = useState('');
  const [buscadorItems, setBuscadorItems] = useState<Articulo[]>([]);
  const [buscadorIdx, setBuscadorIdx] = useState(-1);
  const [cobroOpen, setCobroOpen] = useState(false);
  const [descInlineOpen, setDescInlineOpen] = useState(false);
  const [descTipo, setDescTipo] = useState<'pct'|'monto'>('pct');
  const [descVal, setDescVal] = useState('');
  const [notasOpen, setNotasOpen] = useState(false);
  const [showPropina, setShowPropina] = useState(false);
  const [propina, setPropina] = useState('');
  const [ultimaTransId, setUltimaTransId] = useState<number|null>(null);

  // Modals
  const [libreOpen, setLibreOpen] = useState(false);
  const [libreDesc, setLibreDesc] = useState('');
  const [librePrecio, setLibrePrecio] = useState('');
  const [libreCant, setLibreCant] = useState('1');
  const [movOpen, setMovOpen] = useState(false);
  const [descItemOpen, setDescItemOpen] = useState(false);
  const [descItemIdx, setDescItemIdx] = useState<number|null>(null);
  const [descItemTipo, setDescItemTipo] = useState<'pct'|'monto'>('pct');
  const [descItemVal, setDescItemVal] = useState('');
  const [anularOpen, setAnularOpen] = useState(false);
  const [anularTransList, setAnularTransList] = useState<any[]>([]);
  const [anularSelTrans, setAnularSelTrans] = useState<any|null>(null);
  const [anularTipo, setAnularTipo] = useState<'total'|'parcial'>('total');
  const [anularMotivo, setAnularMotivo] = useState('');
  const [anularItemQtys, setAnularItemQtys] = useState<Record<number, number>>({});
  const [anularLoading, setAnularLoading] = useState(false);
  const [anularError, setAnularError] = useState('');
  const [renombrarOpen, setRenombrarOpen] = useState(false);
  const [renombrarVal, setRenombrarVal] = useState('');

  // Qty editor (*) modal
  const [qtyEditorOpen, setQtyEditorOpen] = useState(false);
  const [qtyEditorVal,  setQtyEditorVal]  = useState('');
  const [qtyEditorIdx,  setQtyEditorIdx]  = useState<number | null>(null);

  // Cobro state
  const [cobroFormaPago, setCobroFormaPago] = useState('efectivo');
  const [cobroMonto, setCobroMonto] = useState('');
  const [cobroCliente, setCobroCliente] = useState<Cliente|null>(null);
  const [cobroBusqCliente, setCobroBusqCliente] = useState('');
  const [cobroResClientes, setCobroResClientes] = useState<Cliente[]>([]);
  const [cobroError, setCobroError] = useState('');
  const [cobrandoOp, setCobrandoOp] = useState(false);
  const [mixtoMetodo1, setMixtoMetodo1] = useState('efectivo');
  const [mixtoMetodo2, setMixtoMetodo2] = useState('tarjeta_debito');
  const [mixtoMonto1, setMixtoMonto1] = useState('');
  const [mixtoEfectivoRecibido, setMixtoEfectivoRecibido] = useState('');

  // codigoIsEmptyRef: tracks whether the código input is currently empty,
  // updated by CodigoInput without causing parent re-renders.
  const codigoIsEmptyRef = useRef(true);
  // activeIdxRef: stable ref so callbacks can read activeIdx without being recreated.
  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;

  const codigoRef = useRef<CodigoInputHandle>(null);
  const buscadorRef = useRef<HTMLInputElement>(null);
  const timerBuscador = useRef<NodeJS.Timeout|null>(null);
  const timerCliente = useRef<NodeJS.Timeout|null>(null);
  const cobrarRef      = useRef<(conTicket: boolean) => void>(() => {});
  const hotkeyRef      = useRef<(e: KeyboardEvent) => void>(() => {});
  const mayoreoModeRef = useRef(mayoreoMode);
  mayoreoModeRef.current = mayoreoMode;

  // Refs para focus trap en los modales inline (cobro, anular, buscador)
  const cobModalRef    = useRef<HTMLDivElement>(null);
  const anularModalRef = useRef<HTMLDivElement>(null);
  const buscadorBoxRef = useRef<HTMLDivElement>(null);

  useFocusTrap(cobModalRef,    cobroOpen,    () => { setCobroOpen(false); window.api.setModalCobro(false); });
  useFocusTrap(anularModalRef, anularOpen,   () => setAnularOpen(false));
  useFocusTrap(buscadorBoxRef, buscadorOpen, () => setBuscadorOpen(false));

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const [tasa, ivaDesglosado, modo, mon, turno] = await Promise.all([
        window.api.config.get('impuesto_porcentaje'),
        window.api.config.get('mostrar_iva_desglosado'),
        window.api.config.get('modo_negocio'),
        window.api.config.get('moneda'),
        window.api.turnos.getActivo(),
      ]);
      setTasaIva(parseFloat(tasa ?? '21') || 21);
      setMostrarIva(ivaDesglosado !== '0');
      setModoNegocio(modo ?? '');
      setMoneda(mon ?? '$');
      setTurnoActivo(turno);
      setReady(true);
      if (!modo) setWizardOpen(true);
      else aplicarModo(modo);
    }
    init();

    // IPC: cobrar con ticket / sin ticket / abrir cobro
    // cobrarRef.current se mantiene actualizado en cada render, evitando stale closure.
    const u1 = window.api.onCobrarConTicket(() => cobrarRef.current(true));
    const u2 = window.api.onCobrarSinTicket(() => cobrarRef.current(false));
    const u3 = window.api.onAbrirCobro(() => setCobroOpen(true));
    return () => {
      u1(); u2(); u3();
      if (timerBuscador.current) clearTimeout(timerBuscador.current);
      if (timerCliente.current)  clearTimeout(timerCliente.current);
    };
  }, []);

  // focus código al cerrar buscador/cobro/qty editor
  useEffect(() => { if (!buscadorOpen && !cobroOpen && !qtyEditorOpen) recuperarFocoCodigo(); }, [buscadorOpen, cobroOpen, qtyEditorOpen]);

  // Auto-scroll al ítem seleccionado en el carrito
  useEffect(() => {
    const el = document.querySelector('[data-cart-sel="true"]') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [ticket.itemSelIdx, activeIdx]);

  // noModal: true cuando ningún modal/overlay está abierto — usado en hotkeyRef y useCarritoKeyboard
  const noModal = !buscadorOpen && !cobroOpen && !libreOpen && !descItemOpen && !movOpen && !anularOpen && !renombrarOpen && !wizardOpen && !qtyEditorOpen;
  const noModalRef = useRef(noModal);
  noModalRef.current = noModal;

  // Hotkeys globales — ref actualizado en cada render para evitar stale closure.
  // El listener se registra una sola vez (deps: []) eliminando el gap remove/add en cada scan.
  // Las teclas de carrito (↑↓ +−*) se manejan en useCarritoKeyboard (capture phase).
  hotkeyRef.current = (e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement)?.tagName.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'F10') { e.preventDefault(); abrirBuscador(); return; }
    if (e.key === 'F11') { e.preventDefault(); setMayoreoMode(m => !m); return; }
    if (e.key === 'F12') { e.preventDefault(); setCobroOpen(true); window.api.setModalCobro(true); return; }
    if (e.key === 'Insert') { e.preventDefault(); setLibreOpen(true); return; }
    // Delete: elimina ítem seleccionado si el campo de código está vacío (o sin foco)
    if (e.key === 'Delete' && (!isInput || (noModal && ticket.itemSelIdx !== null && codigoIsEmptyRef.current))) {
      e.preventDefault(); borrarItemSel(); return;
    }
    if (e.key === 'Escape' && buscadorOpen) { setBuscadorOpen(false); return; }
    if (e.key === 'Escape' && noModal && ticket.itemSelIdx !== null) {
      e.preventDefault(); updateTicket(activeIdx, { itemSelIdx: null }); return;
    }

    // Cobro modal: teclas 1-6 seleccionan forma de pago; Enter (fuera de input/button) cobra
    if (cobroOpen) {
      const isInInput = tag === 'input' || tag === 'textarea';
      const FORMAS_COBRO = ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cuenta_corriente', 'mixto'];
      if (!isInInput && e.key >= '1' && e.key <= '6') {
        const fi = parseInt(e.key) - 1;
        e.preventDefault(); setCobroFormaPago(FORMAS_COBRO[fi]); return;
      }
      if (e.key === 'Enter' && !isInInput && tag !== 'button') {
        e.preventDefault(); cobrar(true); return;
      }
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => hotkeyRef.current(e);
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  // Teclas de carrito en capture phase: intercepta ANTES que el input de código reciba el evento
  useCarritoKeyboard({
    enabled:  noModal,
    hasItems: ticket.carrito.length > 0,
    onUp: () => {
      updateTicket(activeIdx, {
        itemSelIdx: ticket.itemSelIdx === null ? ticket.carrito.length - 1 : Math.max(ticket.itemSelIdx - 1, 0),
      });
      recuperarFocoCodigo();
    },
    onDown: () => {
      updateTicket(activeIdx, {
        itemSelIdx: ticket.itemSelIdx === null ? 0 : Math.min(ticket.itemSelIdx + 1, ticket.carrito.length - 1),
      });
      recuperarFocoCodigo();
    },
    onPlus: () => {
      const idx = ticket.itemSelIdx ?? ticket.carrito.length - 1;
      const selItem = ticket.carrito[idx];
      if (!selItem) return;
      const isConti = UNIDADES_CONTINUAS.has(selItem.unidadMedida ?? '');
      const c = [...ticket.carrito];
      c[idx] = aplicarPromoAItem({ ...selItem, cantidad: selItem.cantidad + (isConti ? 0.1 : 1) });
      updateTicket(activeIdx, { carrito: c, itemSelIdx: idx });
      recuperarFocoCodigo();
    },
    onMinus: () => {
      const idx = ticket.itemSelIdx ?? ticket.carrito.length - 1;
      const selItem = ticket.carrito[idx];
      if (!selItem) return;
      const isConti = UNIDADES_CONTINUAS.has(selItem.unidadMedida ?? '');
      const step = isConti ? 0.1 : 1;
      const minQty = isConti ? 0.001 : 1;
      if (selItem.cantidad <= minQty) return;
      const c = [...ticket.carrito];
      c[idx] = aplicarPromoAItem({ ...selItem, cantidad: selItem.cantidad - step });
      updateTicket(activeIdx, { carrito: c, itemSelIdx: idx });
      recuperarFocoCodigo();
    },
    onStar: () => {
      const idx = ticket.itemSelIdx ?? ticket.carrito.length - 1;
      const item = ticket.carrito[idx];
      if (!item) return;
      setTickets(prev => prev.map((t, i) => i === activeIdx ? { ...t, itemSelIdx: idx } : t));
      setQtyEditorIdx(idx);
      setQtyEditorVal(String(item.cantidad));
      setQtyEditorOpen(true);
    },
  });

  function aplicarModo(modo: string) {
    setShowPropina(modo === 'restaurante');
    setMostrarPrecioConIva(modo === 'mayorista');
  }

  function recuperarFocoCodigo() {
    codigoRef.current?.focus();
  }

  // ── Ticket management ──────────────────────────────────────────
  function nuevoTicket() {
    if (tickets.length >= MAX_TICKETS) { showToast('Máximo 5 tickets simultáneos.', 'error'); return; }
    const newIdx = tickets.length;
    const n: Ticket = { id: Date.now(), nombre: `Ticket ${newIdx + 1}`, carrito: [], clienteSeleccionado: null, formaPago: 'efectivo', descGlobalTipo: 'ninguno', descGlobalValor: 0, notas: '', itemSelIdx: null };
    setTickets(prev => [...prev, n]);
    setActiveIdx(newIdx);
  }

  function cerrarTicket(idx: number) {
    if (tickets.length === 1) { limpiarTicket(0); return; }
    setTickets(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(prev => Math.max(0, prev >= idx ? prev - 1 : prev));
  }

  function limpiarTicket(idx: number) {
    updateTicket(idx, { carrito: [], clienteSeleccionado: null, formaPago: 'efectivo', descGlobalTipo: 'ninguno', descGlobalValor: 0, notas: '', itemSelIdx: null });
    codigoRef.current?.clear();
  }

  function updateTicket(idx: number, patch: Partial<Ticket>) {
    setTickets(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }

  // ── Cart helpers ───────────────────────────────────────────────
  const totales = useMemo(() => {
    const t = ticket;
    let sub = 0;
    for (const item of t.carrito) {
      const base = item.precio * item.cantidad;
      sub += item.descPct > 0 ? base * (1 - item.descPct / 100) : base;
    }
    let desc = 0;
    if (t.descGlobalTipo === 'pct') desc = sub * t.descGlobalValor / 100;
    else if (t.descGlobalTipo === 'monto') desc = Math.min(t.descGlobalValor, sub);
    const subtotalConDesc = sub - desc;

    let iva = 0;
    if (mostrarIva && MODOS_IVA_DESGLOSADO.has(modoNegocio)) {
      for (const item of t.carrito) {
        const tasa = item.tasaIva ?? tasaIva;
        const base = item.precio * item.cantidad;
        const baseDesc = item.descPct > 0 ? base * (1 - item.descPct / 100) : base;
        iva += baseDesc * tasa / 100;
      }
      if (desc > 0) iva *= (1 - desc / sub);
    }

    const propAmt = parseFloat(propina) || 0;
    const total = subtotalConDesc + iva + propAmt;
    return { sub, desc, subtotalConDesc, iva, total: Math.max(0, total), propAmt };
  }, [ticket, mostrarIva, modoNegocio, tasaIva, propina]);

  const agregarArticulo = useCallback(async (art: Articulo, cantidad = 1) => {
    // Fetch promos solo si el artículo probablemente no está en el carrito aún.
    // La verificación definitiva ocurre dentro del functional updater de setTickets,
    // usando el estado más reciente (prev), por lo que llamadas concurrentes no se pisan.
    const ai = activeIdxRef.current;
    const probablyNew = !tickets[ai]?.carrito.some(
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
        // precio calculado aquí con el ref para evitar stale closure si F11 cambió durante el await
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
  }, [tickets]); // tickets needed only for the `probablyNew` check before the async gap

  // ── Código input ───────────────────────────────────────────────
  // procesarCodigoRef: stable ref so CodigoInput doesn't need to recreate on every render.
  const procesarCodigoFn = useCallback(async (codigo: string) => {
    if (!codigo.trim()) return;
    const art = await window.api.articulos.getByCodigo(codigo.trim());
    if (art) {
      await agregarArticulo(art);
      codigoRef.current?.animOk();
    } else {
      codigoRef.current?.animError();
      showToast('Código no encontrado: ' + codigo, 'error');
    }
  }, [showToast]); // agregarArticulo uses activeIdxRef internally

  // ── Buscador F10 ────────────────────────────────────────────────
  function abrirBuscador() { setBuscadorOpen(true); setBuscadorQuery(''); setBuscadorItems([]); setBuscadorIdx(-1); }

  async function buscarArticulos(q: string) {
    if (!q.trim()) { setBuscadorItems([]); return; }
    const res = await window.api.articulos.search(q);
    setBuscadorItems(res);
    setBuscadorIdx(-1);
  }

  function handleBuscadorKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setBuscadorIdx(i => Math.min(i + 1, buscadorItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setBuscadorIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      if (buscadorIdx >= 0 && buscadorItems[buscadorIdx]) { seleccionarDelBuscador(buscadorItems[buscadorIdx]); }
    }
    else if (e.key === 'Escape') setBuscadorOpen(false);
  }

  function seleccionarDelBuscador(art: Articulo) {
    agregarArticulo(art);
    setBuscadorOpen(false);
  }

  // ── Borrar ítem seleccionado ────────────────────────────────────
  function borrarItemSel() {
    if (ticket.itemSelIdx === null) return;
    const newCarrito = ticket.carrito.filter((_, i) => i !== ticket.itemSelIdx);
    updateTicket(activeIdx, { carrito: newCarrito, itemSelIdx: null });
  }

  function confirmQtyEditor(e: React.FormEvent) {
    e.preventDefault();
    if (qtyEditorIdx === null) return;
    const qty = parseFloat(qtyEditorVal);
    if (isNaN(qty) || qty <= 0) return;
    const c = [...ticket.carrito];
    c[qtyEditorIdx] = aplicarPromoAItem({ ...c[qtyEditorIdx], cantidad: qty });
    updateTicket(activeIdx, { carrito: c });
    setQtyEditorOpen(false);
    recuperarFocoCodigo();
  }

  // ── Ítem libre ─────────────────────────────────────────────────
  function agregarLibre(e: React.FormEvent) {
    e.preventDefault();
    const precio = parseFloat(librePrecio);
    const cant   = parseFloat(libreCant) || 1;
    if (!libreDesc.trim() || isNaN(precio) || precio <= 0) return;
    const item = mkItem({ nombre: libreDesc.trim(), precio, cantidad: cant, esLibre: true, codigo: '--' });
    updateTicket(activeIdx, { carrito: [...ticket.carrito, item] });
    setLibreOpen(false); setLibreDesc(''); setLibrePrecio(''); setLibreCant('1');
  }

  // ── Cobrar ──────────────────────────────────────────────────────
  async function cobrar(conTicket: boolean) {
    if (cobrandoOp) return;
    if (!turnoActivo) { showToast('No hay turno abierto.', 'error'); navigate('/turno'); return; }
    if (ticket.carrito.length === 0) { setCobroError('El carrito está vacío.'); return; }

    const forma = cobroFormaPago;
    const total = totales.total;

    // sin validación de monto recibido: el vuelto es opcional
    if (forma === 'cuenta_corriente' && !cobroCliente) { setCobroError('Seleccioná un cliente para cuenta corriente.'); return; }
    if (forma === 'mixto') {
      const m1 = parseFloat(mixtoMonto1);
      if (isNaN(m1) || m1 <= 0 || m1 >= total) { setCobroError('El monto del método 1 debe ser mayor a 0 y menor al total.'); return; }
    }

    setCobroError('');
    setCobrandoOp(true);
    window.api.setModalCobro(true);

    try {
      const montoRec = forma === 'efectivo' ? parseFloat(cobroMonto) || 0 : 0;
      const vuelto   = forma === 'efectivo' ? Math.max(0, montoRec - total) : 0;
      const propAmt  = parseFloat(propina) || 0;
      const mixtoMonto2Calc = forma === 'mixto' ? Math.max(0, total - (parseFloat(mixtoMonto1) || 0)) : 0;

      const data = {
        turno_id:        turnoActivo.id,
        monto_total:     total,
        subtotal:        totales.subtotalConDesc,
        monto_impuesto:  totales.iva,
        descuento_global: totales.desc,
        propina:         propAmt,
        forma_pago:      forma === 'mixto' ? mixtoMetodo1 : forma,
        forma_pago_2:    forma === 'mixto' ? mixtoMetodo2 : null,
        monto_pago_2:    forma === 'mixto' ? mixtoMonto2Calc : null,
        cuenta_cliente_id: cobroCliente?.id ?? null,
        items: ticket.carrito.map(it => ({
          articulo_id:       it.articuloId ?? null,
          descripcion_libre: it.esLibre ? it.nombre : (it.nombre),
          cantidad:          it.cantidad,
          precio_al_momento: it.precio,
          descuento_porcentaje: it.descPct,
          importe_total:     it.precio * it.cantidad * (1 - it.descPct / 100),
        })),
        notas: ticket.notas,
      };

      const res = await window.api.transacciones.create(data);
      setUltimaTransId(res.id);

      if (conTicket) {
        window.api.caja.abrirComprobante({ transaccionId: res.id, montoRecibido: montoRec, vuelto, propina: propAmt });
      }
      // Imprimir si hay impresora
      window.api.printer.imprimir(res.id, { montoRecibido: montoRec, vuelto, propina: propAmt }).catch(() => {});

      limpiarTicket(activeIdx);
      setCobroOpen(false);
      setCobroMonto('');
      setCobroCliente(null);
      setCobroBusqCliente('');
      setMixtoMonto1('');
      window.api.setModalCobro(false);
      showToast(`Venta #${res.id} registrada.${conTicket ? '' : ' Sin comprobante.'}`, 'ok');
    } catch (err: any) {
      setCobroError(err.message ?? 'Error al registrar la venta.');
    } finally {
      setCobrandoOp(false);
    }
  }

  // Mantiene cobrarRef actualizado en cada render para los listeners IPC (F1/F2).
  cobrarRef.current = cobrar;

  // ── Vuelto calc ─────────────────────────────────────────────────
  const vuelto = useMemo(
    () => cobroFormaPago === 'efectivo' ? Math.max(0, (parseFloat(cobroMonto) || 0) - totales.total) : 0,
    [cobroFormaPago, cobroMonto, totales.total]
  );
  const mixtoMonto2 = useMemo(
    () => cobroFormaPago === 'mixto' ? Math.max(0, totales.total - (parseFloat(mixtoMonto1) || 0)) : 0,
    [cobroFormaPago, totales.total, mixtoMonto1]
  );

  // ── Wizard ──────────────────────────────────────────────────────
  async function seleccionarModo(id: string) {
    await window.api.config.set('modo_negocio', id);
    setModoNegocio(id);
    aplicarModo(id);
    setWizardOpen(false);
    showToast('Modo configurado: ' + (WIZARD_MODOS.find(m => m.id === id)?.nombre ?? id), 'ok');
  }

  // ── Descuento global ────────────────────────────────────────────
  function aplicarDescGlobal() {
    const val = parseFloat(descVal) || 0;
    updateTicket(activeIdx, { descGlobalTipo: val > 0 ? descTipo : 'ninguno', descGlobalValor: val });
    setDescInlineOpen(false);
  }

  // ── Descuento ítem ──────────────────────────────────────────────
  function abrirDescItem(idx: number) {
    const item = ticket.carrito[idx];
    setDescItemIdx(idx);
    setDescItemTipo('pct');
    setDescItemVal(item.descPct > 0 ? String(item.descPct) : '');
    setDescItemOpen(true);
  }

  function aplicarDescItem() {
    if (descItemIdx === null) return;
    const val = parseFloat(descItemVal) || 0;
    const newCarrito = ticket.carrito.map((it, i) => i === descItemIdx ? { ...it, descPct: descItemTipo === 'pct' ? val : (val / it.precio) * 100 } : it);
    updateTicket(activeIdx, { carrito: newCarrito });
    setDescItemOpen(false);
  }

  // ticketsRef: stable snapshot for callbacks that need the current cart without recreating.
  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;

  // ── Callbacks estables para CartRow (usan activeIdxRef/ticketsRef) ──
  const onCartToggleSelect = useCallback((idx: number) => {
    const ai = activeIdxRef.current;
    setTickets(prev => {
      const t = prev[ai];
      return prev.map((tk, i) => i === ai ? { ...tk, itemSelIdx: t.itemSelIdx === idx ? null : idx } : tk);
    });
    recuperarFocoCodigo();
  }, []);

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

  const onCartDescuento = useCallback((idx: number) => {
    const ai = activeIdxRef.current;
    const item = ticketsRef.current[ai]?.carrito[idx];
    if (!item) return;
    setDescItemIdx(idx);
    setDescItemTipo('pct');
    setDescItemVal(item.descPct > 0 ? String(item.descPct) : '');
    setDescItemOpen(true);
  }, []);

  // ── Anular / devolver ──────────────────────────────────────────
  async function openAnularModal() {
    setAnularOpen(true);
    setAnularSelTrans(null);
    setAnularMotivo('');
    setAnularError('');
    setAnularTipo('total');
    setAnularItemQtys({});
    setAnularTransList([]);
    try {
      const lista = await window.api.devoluciones.recientes(60);
      setAnularTransList(lista.filter((t: any) => t.estado !== 'cancelada'));
    } catch {
      setAnularError('No se pudieron cargar las transacciones recientes.');
    }
  }

  async function seleccionarTransAnular(transId: number) {
    try {
      const t = await window.api.transacciones.getById(transId);
      setAnularSelTrans(t);
      const qtys: Record<number, number> = {};
      for (const item of t.detalle) qtys[item.id] = item.cantidad;
      setAnularItemQtys(qtys);
      setAnularTipo('total');
      setAnularError('');
    } catch {
      setAnularError('Error al cargar el detalle de la transacción.');
    }
  }

  async function confirmarAnulacion() {
    if (!anularSelTrans) return;
    if (!anularMotivo.trim()) { setAnularError('Ingresá un motivo.'); return; }
    setAnularLoading(true);
    setAnularError('');
    try {
      if (anularTipo === 'total') {
        await window.api.devoluciones.cancelar({
          transaccionId: anularSelTrans.id,
          turnoId:       turnoActivo?.id ?? null,
          motivo:        anularMotivo.trim(),
        });
        showToast(`Transacción #${anularSelTrans.id} anulada. Stock repuesto.`, 'ok');
      } else {
        const items = anularSelTrans.detalle
          .filter((i: any) => (anularItemQtys[i.id] ?? 0) > 0)
          .map((i: any) => ({
            detalle_id:      i.id,
            articulo_id:     i.articulo_id ?? null,
            descripcion:     i.nombre || '',
            cantidad:        anularItemQtys[i.id],
            precio_unitario: i.precio_al_momento,
          }));
        if (items.length === 0) {
          setAnularError('Seleccioná al menos un ítem con cantidad mayor a 0.');
          setAnularLoading(false);
          return;
        }
        await window.api.devoluciones.parcial({
          transaccionId: anularSelTrans.id,
          turnoId:       turnoActivo?.id ?? null,
          motivo:        anularMotivo.trim(),
          items,
        });
        showToast(`Devolución parcial de #${anularSelTrans.id} registrada.`, 'ok');
      }
      setAnularOpen(false);
    } catch (err: any) {
      setAnularError(err.message ?? 'Error al procesar la operación.');
    } finally {
      setAnularLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  if (!ready) return <div className="page-content flex items-center justify-center text-text-subtle text-sm">Cargando...</div>;

  const canCobrar = ticket.carrito.length > 0 && !!turnoActivo;

  return (
    <div className="page-content flex flex-col" style={{ fontFamily: 'inherit' }}>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 px-2 pt-1.5 bg-bg border-b border-border flex-shrink-0 overflow-x-auto min-h-[42px]">
        {tickets.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActiveIdx(i)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md border border-b-0 text-[13px] font-medium transition-all ${
              i === activeIdx
                ? 'bg-surface text-text border-border'
                : 'bg-transparent text-text-muted border-transparent hover:bg-surface-2'
            }`}
          >
            {t.nombre}
            {t.carrito.length > 0 && (
              <span className="text-[11px] font-bold px-1.5 rounded-full bg-accent/20 text-accent min-w-[18px] text-center">
                {t.carrito.length}
              </span>
            )}
            <span
              role="button"
              onClick={e => { e.stopPropagation(); cerrarTicket(i); }}
              className="text-text-subtle hover:text-danger ml-0.5 opacity-60 hover:opacity-100 text-[14px] leading-none cursor-pointer"
            >×</span>
          </button>
        ))}
        {tickets.length < MAX_TICKETS && (
          <button
            onClick={nuevoTicket}
            className="px-2.5 py-1.5 text-text-subtle hover:text-text text-[16px] leading-none opacity-60 hover:opacity-100 border border-dashed border-border rounded hover:bg-surface-2 transition-all"
            title="Nuevo ticket (Ctrl+T)"
          >+</button>
        )}
        <div className="flex-1" />
        {mayoreoMode && <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-[rgba(139,92,246,.15)] text-[#a78bfa] font-bold mr-1 tracking-wider">MAYOREO</span>}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg border-b border-border flex-shrink-0 flex-wrap">
        <ToolbarBtn icon={<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>} label="Ítem libre" kbd="Ins" onClick={() => setLibreOpen(true)} />
        <ToolbarBtn icon={<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>} label="Buscar" kbd="F10" onClick={abrirBuscador} />
        <ToolbarBtn
          icon={<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
          label="Mayoreo" kbd="F11"
          active={mayoreoMode}
          onClick={() => setMayoreoMode(m => !m)}
        />
        <ToolbarBtn icon={<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} label="Entrada-Salida" onClick={() => setMovOpen(true)} />
        <div className="w-px h-6 bg-border" />
        <ToolbarBtn variant="danger" icon={<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>} label="Borrar ítem" kbd="Del" onClick={borrarItemSel} disabled={ticket.itemSelIdx === null} />
        <div className="w-px h-6 bg-border" />
        <ToolbarBtn variant="success" icon={<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} label="Cobrar" kbd="F12" onClick={() => setCobroOpen(true)} disabled={!canCobrar} />
        <div className="flex-1" />
        <ToolbarBtn variant="warning" icon={<svg viewBox="0 0 24 24"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>} label="% Desc" active={descInlineOpen || ticket.descGlobalTipo !== 'ninguno'} onClick={() => setDescInlineOpen(o => !o)} />
        <ToolbarBtn icon={<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} label="Notas" active={notasOpen} onClick={() => setNotasOpen(o => !o)} />
        <ToolbarBtn variant="danger" icon={<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>} label="Cancelar" onClick={() => limpiarTicket(activeIdx)} />
        <ToolbarBtn icon={<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.57"/></svg>} label="Anular" variant="warning" onClick={openAnularModal} />
        {ticket.carrito.length > 0 && (
          <span
            className="text-[12px] text-text-subtle cursor-pointer hover:text-accent px-1.5 py-0.5 rounded"
            onDoubleClick={() => { setRenombrarVal(ticket.nombre); setRenombrarOpen(true); }}
            title="Doble clic para renombrar"
          >{ticket.nombre}</span>
        )}
      </div>

      {/* ── Código bar ── */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-surface border-b border-border flex-shrink-0">
        <label className="text-[12px] font-bold text-text-muted whitespace-nowrap uppercase tracking-wider">Código:</label>
        <CodigoInput
          ref={codigoRef}
          onSubmit={procesarCodigoFn}
          onValueChange={(v) => { codigoIsEmptyRef.current = v === ''; }}
        />
        {descInlineOpen && (
          <div className="flex items-center gap-2 flex-shrink-0 bg-[rgba(234,179,8,.07)] border border-[rgba(234,179,8,.2)] rounded-[var(--r-in)] px-3 py-1.5">
            <button className={`text-[11px] font-bold px-2 py-0.5 rounded border transition-all ${descTipo==='pct' ? 'bg-[#ca8a04] text-white border-[#ca8a04]' : 'border-border text-text-muted bg-transparent'}`} onClick={() => setDescTipo('pct')}>%</button>
            <button className={`text-[11px] font-bold px-2 py-0.5 rounded border transition-all ${descTipo==='monto' ? 'bg-[#ca8a04] text-white border-[#ca8a04]' : 'border-border text-text-muted bg-transparent'}`} onClick={() => setDescTipo('monto')}>$</button>
            <input type="number" min="0" step="0.01" value={descVal} onChange={e => setDescVal(e.target.value)} className="inp w-20 py-1 px-2 text-[12px]" placeholder="0" />
            <button className="btn btn-primary btn-sm text-[11px]" onClick={aplicarDescGlobal}>Aplicar</button>
            <button className="btn btn-ghost btn-sm text-[11px]" onClick={() => { setDescInlineOpen(false); updateTicket(activeIdx, { descGlobalTipo: 'ninguno', descGlobalValor: 0 }); setDescVal(''); }}>✕</button>
          </div>
        )}
      </div>

      {/* ── Notas inline ── */}
      {notasOpen && (
        <div className="px-3 py-2 border-b border-border bg-[rgba(79,142,245,.04)] flex-shrink-0">
          <textarea
            rows={2} value={ticket.notas}
            onChange={e => updateTicket(activeIdx, { notas: e.target.value })}
            className="inp w-full text-[12px] resize-none"
            placeholder="Nota para este ticket..."
          />
        </div>
      )}

      {/* ── Carrito ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {ticket.carrito.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-subtle">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span className="text-[13px]">El carrito está vacío</span>
          </div>
        ) : (
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
              {ticket.carrito.map((item, idx) => (
                <CartRow
                  key={item._id}
                  item={item}
                  idx={idx}
                  selected={ticket.itemSelIdx === idx}
                  onToggleSelect={onCartToggleSelect}
                  onDecrement={onCartDecrement}
                  onIncrement={onCartIncrement}
                  onQtyChange={onCartQtyChange}
                  onDescuento={onCartDescuento}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Propina (restaurante) ── */}
      {showPropina && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-surface flex-shrink-0">
          <span className="text-[12px] text-text-muted whitespace-nowrap">Propina (opcional):</span>
          <input type="number" min="0" step="0.01" value={propina} onChange={e => setPropina(e.target.value)} className="inp w-28 py-1 px-2 text-[13px]" placeholder="0,00" />
          <span className="text-[12px] text-text-subtle">{moneda}</span>
        </div>
      )}

      {/* ── Pie de caja ── */}
      <div className="flex items-center bg-surface border-t-2 border-border flex-shrink-0 min-h-[72px]">
        <div className="px-5 py-3 border-r border-border flex flex-col justify-center min-w-[90px]">
          <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">Ítems</div>
          <div className="text-[26px] font-black tabular-nums leading-tight">
            {ticket.carrito.reduce((s, i) => s + i.cantidad, 0)}
          </div>
        </div>
        <div className="flex-1 px-5 flex items-center gap-6 justify-center">
          <PieStat label="Total" value={fmt(totales.total)} size="lg" />
          {totales.desc > 0 && <PieStat label="Descuento" value={`-${fmt(totales.desc)}`} color="#f59e0b" />}
          {mostrarIva && MODOS_IVA_DESGLOSADO.has(modoNegocio) && totales.iva > 0 && (
            <>
              <PieStat label="Subtotal" value={fmt(totales.subtotalConDesc)} muted />
              <PieStat label={`IVA ${tasaIva}%`} value={fmt(totales.iva)} muted />
            </>
          )}
          {totales.propAmt > 0 && <PieStat label="Propina" value={fmt(totales.propAmt)} color="#a78bfa" />}
        </div>
        <div className="px-3 flex items-center gap-2 flex-shrink-0">
          {ultimaTransId && (
            <button
              className="flex flex-col items-center justify-center px-3 py-2 rounded-[var(--r)] bg-surface-2 border border-border text-text-muted hover:bg-surface-3 transition-all gap-1"
              onClick={() => ultimaTransId && window.api.caja.abrirComprobante({ transaccionId: ultimaTransId, montoRecibido: 0, vuelto: 0, propina: 0 })}
              title="Reimprimir último comprobante"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              <span className="text-[11px] font-semibold">Reimprimir</span>
            </button>
          )}
          <button
            disabled={!canCobrar}
            onClick={() => setCobroOpen(true)}
            className="flex flex-col items-center justify-center px-6 py-3 rounded-[var(--r)] bg-gradient-to-br from-[#2dda6e] to-[#16a34a] text-white min-w-[145px] min-h-[64px] disabled:opacity-40 disabled:cursor-not-allowed hover:from-[#38e87a] hover:to-[#1ab84e] hover:-translate-y-0.5 transition-all shadow-lg gap-0.5"
            style={{ animation: canCobrar ? 'pulse-cobrar 4s ease-in-out 2s infinite' : 'none' }}
          >
            <span className="text-[11px] opacity-70 font-bold tracking-widest">F12</span>
            <span className="text-[28px] font-black font-mono leading-none tabular-nums">{fmt(totales.total)}</span>
            <span className="text-[13px] font-black tracking-widest uppercase">COBRAR</span>
          </button>
        </div>
      </div>

      {/* ── Buscador overlay (F10) ── */}
      <AnimatePresence>
        {buscadorOpen && (
          <motion.div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && setBuscadorOpen(false)}
          >
            <motion.div
              ref={buscadorBoxRef}
              className="w-[560px] max-w-[95vw] bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] overflow-hidden"
              initial={{ y: -20, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -20, scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              <input
                ref={buscadorRef}
                autoFocus
                value={buscadorQuery}
                onChange={e => { setBuscadorQuery(e.target.value); if (timerBuscador.current) clearTimeout(timerBuscador.current); timerBuscador.current = setTimeout(() => buscarArticulos(e.target.value), 200); }}
                onKeyDown={handleBuscadorKeyDown}
                className="w-full px-5 py-4 text-[17px] bg-transparent border-b border-border outline-none text-text placeholder:text-text-subtle"
                placeholder="Buscá por nombre, código o descripción..."
              />
              <div className="max-h-[400px] overflow-y-auto">
                {buscadorItems.length === 0 ? (
                  <div className="py-10 text-center text-text-subtle text-[14px]">
                    {buscadorQuery ? 'Sin resultados' : 'Escribí para buscar artículos'}
                  </div>
                ) : (
                  buscadorItems.map((art, i) => (
                    <div
                      key={art.id}
                      onClick={() => seleccionarDelBuscador(art)}
                      className={`flex items-center gap-4 px-5 py-3 cursor-pointer border-b border-border-sub transition-colors ${buscadorIdx === i ? 'bg-[rgba(79,142,245,.12)]' : 'hover:bg-surface-2'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold text-text truncate">{art.nombre}</div>
                        <div className="text-[12px] text-text-muted mt-0.5">{art.codigo} · Stock: {art.stock_actual} {art.unidad_medida}</div>
                      </div>
                      <div className="text-[18px] font-black font-mono text-text tabular-nums">{fmt(art.precio_unitario)}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-5 py-2.5 border-t border-border text-[12px] text-text-subtle flex gap-4">
                <span>↑↓ navegar</span><span>Enter seleccionar</span><span>Esc cerrar</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Cobro (F12) ── */}
      <AnimatePresence>
        {cobroOpen && (
          <motion.div
            className="fixed inset-0 z-[200] bg-black/82 backdrop-blur-md flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              ref={cobModalRef}
              data-modal
              className="bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] w-[700px] max-w-[98vw] max-h-[96vh] flex overflow-hidden"
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
            >
              {/* Columna izquierda */}
              <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4 border-r border-border">
                {/* Total */}
                <div className="text-center py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-1">Total a pagar</div>
                  <div className="text-[46px] font-black font-mono leading-none text-text">{fmt(totales.total)}</div>
                </div>

                {/* Formas de pago */}
                <div>
                  <div className="text-[11px] font-semibold text-text-muted mb-2">Forma de pago</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'efectivo',        label: 'Efectivo',     fkey: '1' },
                      { id: 'tarjeta_debito',  label: 'Débito',       fkey: '2' },
                      { id: 'tarjeta_credito', label: 'Crédito',      fkey: '3' },
                      { id: 'transferencia',   label: 'Transferencia',fkey: '4' },
                      { id: 'cuenta_corriente',label: 'Cta. Cte.',    fkey: '5' },
                      { id: 'mixto',           label: 'Mixto',        fkey: '6' },
                    ].map(fp => (
                      <button
                        key={fp.id}
                        onClick={() => setCobroFormaPago(fp.id)}
                        className={`relative flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-[var(--r)] border-2 text-[12px] font-semibold transition-all ${
                          cobroFormaPago === fp.id
                            ? 'bg-[rgba(79,142,245,.12)] border-accent text-text shadow-[0_0_0_3px_rgba(79,142,245,.15)]'
                            : 'bg-surface-2 border-border text-text-muted hover:bg-surface-3'
                        }`}
                      >
                        <span className="absolute top-1 right-1.5 text-[9px] font-bold opacity-50">{fp.fkey}</span>
                        {fp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Efectivo */}
                {cobroFormaPago === 'efectivo' && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[11px] text-text-muted mb-1">Monto recibido</div>
                        <input
                          type="number" min="0" step="0.01" value={cobroMonto}
                          onChange={e => setCobroMonto(e.target.value)}
                          className="w-full text-[22px] font-bold font-mono px-3 py-2 border-2 border-border focus:border-accent bg-bg text-text rounded-[var(--r)] outline-none"
                          autoFocus placeholder="0,00"
                        />
                      </div>
                      <div className="flex flex-col items-center justify-center border border-border rounded-[var(--r)] gap-1 bg-bg">
                        <div className="text-[10px] font-semibold text-text-subtle uppercase">Vuelto</div>
                        <div className={`text-[26px] font-black font-mono ${vuelto > 0 ? 'text-success' : 'text-text-subtle'}`}>{vuelto > 0 ? fmt(vuelto) : '—'}</div>
                      </div>
                    </div>
                    {/* Numpad */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {['7','8','9','4','5','6','1','2','3','00','0','del'].map(k => (
                        <button
                          key={k}
                          onClick={() => {
                            if (k === 'del') setCobroMonto(p => p.slice(0,-1));
                            else setCobroMonto(p => (p + k).replace(/^0+(?=\d)/, ''));
                          }}
                          className={`h-12 rounded-[var(--r)] border text-[18px] font-semibold font-mono transition-all active:scale-95 ${
                            k === 'del'
                              ? 'bg-[rgba(239,68,68,.08)] border-[rgba(239,68,68,.25)] text-danger hover:bg-[rgba(239,68,68,.15)]'
                              : 'bg-surface-2 border-border text-text hover:bg-surface-3'
                          }`}
                        >{k === 'del' ? '⌫' : k}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cuenta corriente */}
                {cobroFormaPago === 'cuenta_corriente' && (
                  <div className="flex flex-col gap-2">
                    <div className="text-[11px] text-text-muted">Buscar cliente</div>
                    <input
                      className="inp" placeholder="Nombre o teléfono..."
                      value={cobroBusqCliente}
                      onChange={e => {
                        setCobroBusqCliente(e.target.value);
                        if (timerCliente.current) clearTimeout(timerCliente.current);
                        timerCliente.current = setTimeout(async () => {
                          const res = await window.api.clientes.search(e.target.value);
                          setCobroResClientes(res);
                        }, 200);
                      }}
                    />
                    {cobroResClientes.length > 0 && !cobroCliente && (
                      <div className="bg-surface-2 border border-border rounded-[var(--r-in)] max-h-[120px] overflow-y-auto">
                        {cobroResClientes.map(c => (
                          <div key={c.id} onClick={() => { setCobroCliente(c); setCobroResClientes([]); setCobroBusqCliente(c.nombre); }} className="px-3 py-2 cursor-pointer hover:bg-surface-3 text-[13px] border-b border-border-sub last:border-none">
                            <span className="font-medium">{c.nombre}</span> <span className="text-text-muted text-[11px]">{c.telefono}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {cobroCliente && (
                      <div className="flex items-center justify-between bg-[rgba(79,142,245,.1)] border border-[rgba(79,142,245,.3)] rounded-[var(--r-in)] px-3 py-2">
                        <span className="text-[13px] font-medium text-[#93c5fd]">{cobroCliente.nombre}</span>
                        <button onClick={() => { setCobroCliente(null); setCobroBusqCliente(''); }} className="text-[16px] text-[#60a5fa] hover:text-white">✕</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Mixto */}
                {cobroFormaPago === 'mixto' && (
                  <div className="flex flex-col gap-3">
                    <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Dividir en dos métodos</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[11px] text-text-muted mb-1">Método 1</div>
                        <select className="inp" value={mixtoMetodo1} onChange={e => setMixtoMetodo1(e.target.value)}>
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta_debito">Débito</option>
                          <option value="tarjeta_credito">Crédito</option>
                          <option value="transferencia">Transferencia</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-[11px] text-text-muted mb-1">Monto 1</div>
                        <input type="number" min="0" step="0.01" value={mixtoMonto1} onChange={e => setMixtoMonto1(e.target.value)} className="inp text-[17px] font-bold font-mono" placeholder="0,00" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[11px] text-text-muted mb-1">Método 2</div>
                        <select className="inp" value={mixtoMetodo2} onChange={e => setMixtoMetodo2(e.target.value)}>
                          <option value="tarjeta_debito">Débito</option>
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta_credito">Crédito</option>
                          <option value="transferencia">Transferencia</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-[11px] text-text-muted mb-1">Resto (auto)</div>
                        <div className="inp text-[17px] font-bold font-mono text-text-muted bg-surface">{fmt(mixtoMonto2)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {cobroError && <div className="px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] rounded-[var(--r-in)] text-[#fca5a5] text-[12px]">{cobroError}</div>}
              </div>

              {/* Columna derecha: botones */}
              <div className="flex flex-col w-40 min-w-[140px] flex-shrink-0">
                <button
                  disabled={cobrandoOp || !canCobrar}
                  onClick={() => cobrar(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-2 border-b border-[rgba(255,255,255,.07)] bg-success hover:bg-success-hover disabled:opacity-45 text-white transition-colors"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  <div className="text-[13px] font-bold text-center leading-tight">Cobrar e imprimir</div>
                  <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/20">F1</div>
                </button>
                <button
                  disabled={cobrandoOp || !canCobrar}
                  onClick={() => cobrar(false)}
                  className="flex-1 flex flex-col items-center justify-center gap-2 border-b border-[rgba(255,255,255,.07)] bg-surface-2 hover:bg-surface-3 disabled:opacity-45 text-text transition-colors"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/></svg>
                  <div className="text-[13px] font-bold text-center leading-tight">Sin comprobante</div>
                  <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-bg border border-border text-text-muted">F2</div>
                </button>
                <button
                  onClick={() => { setCobroOpen(false); window.api.setModalCobro(false); }}
                  className="flex-1 flex flex-col items-center justify-center gap-2 bg-transparent hover:bg-[rgba(239,68,68,.08)] text-danger transition-colors"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <div className="text-[13px] font-bold">Cancelar</div>
                  <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.3)] text-danger">Esc</div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Ítem libre ── */}
      <AnimatePresence>
        {libreOpen && (
          <ModalOverlay onClose={() => setLibreOpen(false)}>
            <ModalBox title="Ítem libre" onClose={() => setLibreOpen(false)} maxWidth={380}>
              <form onSubmit={agregarLibre} className="flex flex-col gap-4">
                <div className="field"><label className="field-label">Descripción <span className="text-danger">*</span></label>
                  <input autoFocus className="inp" value={libreDesc} onChange={e => setLibreDesc(e.target.value)} placeholder="Ej: Coca Cola 500ml" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="field"><label className="field-label">Precio <span className="text-danger">*</span></label>
                    <input className="inp" type="number" step="0.01" min="0.01" value={librePrecio} onChange={e => setLibrePrecio(e.target.value)} required />
                  </div>
                  <div className="field"><label className="field-label">Cantidad</label>
                    <input className="inp" type="number" step="any" min="0.001" value={libreCant} onChange={e => setLibreCant(e.target.value)} />
                  </div>
                </div>
                <div className="modal-footer px-0 pb-0">
                  <button type="button" className="btn btn-ghost" onClick={() => setLibreOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Agregar al carrito</button>
                </div>
              </form>
            </ModalBox>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* ── Modal Descuento ítem ── */}
      <AnimatePresence>
        {descItemOpen && descItemIdx !== null && (
          <ModalOverlay onClose={() => setDescItemOpen(false)}>
            <ModalBox title="Aplicar descuento" onClose={() => setDescItemOpen(false)} maxWidth={360}>
              <div className="flex flex-col gap-4">
                <div className="text-[13px] text-text-muted">{ticket.carrito[descItemIdx]?.nombre}</div>
                <div className="flex gap-2">
                  <button className={`flex-1 py-2 rounded-[var(--r-in)] border text-[12px] font-semibold transition-all ${descItemTipo==='pct' ? 'bg-[#ca8a04] text-white border-[#ca8a04]' : 'border-border text-text-muted bg-transparent'}`} onClick={() => setDescItemTipo('pct')}>Porcentaje (%)</button>
                  <button className={`flex-1 py-2 rounded-[var(--r-in)] border text-[12px] font-semibold transition-all ${descItemTipo==='monto' ? 'bg-[#ca8a04] text-white border-[#ca8a04]' : 'border-border text-text-muted bg-transparent'}`} onClick={() => setDescItemTipo('monto')}>Monto fijo ($)</button>
                </div>
                <div className="field">
                  <label className="field-label">{descItemTipo === 'pct' ? 'Porcentaje' : 'Monto'} de descuento</label>
                  <input autoFocus className="inp" type="number" min="0" step="0.01" value={descItemVal} onChange={e => setDescItemVal(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer px-0 pb-0 mt-4">
                <button className="btn btn-ghost text-danger mr-auto" onClick={() => { if (descItemIdx !== null) { const c = [...ticket.carrito]; c[descItemIdx] = { ...c[descItemIdx], descPct: 0 }; updateTicket(activeIdx, { carrito: c }); } setDescItemOpen(false); }}>Quitar descuento</button>
                <button className="btn btn-ghost" onClick={() => setDescItemOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={aplicarDescItem}>Aplicar</button>
              </div>
            </ModalBox>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* ── Modal Movimiento de caja ── */}
      {movOpen && <MovimientoModal turnoActivo={turnoActivo} onClose={() => setMovOpen(false)} onDone={() => { setMovOpen(false); showToast('Movimiento registrado.', 'ok'); }} />}

      {/* ── Modal Renombrar ticket ── */}
      <AnimatePresence>
        {renombrarOpen && (
          <ModalOverlay onClose={() => setRenombrarOpen(false)}>
            <ModalBox title="Nombre del ticket" onClose={() => setRenombrarOpen(false)} maxWidth={320}>
              <input autoFocus className="inp" value={renombrarVal} onChange={e => setRenombrarVal(e.target.value)} maxLength={30} onKeyDown={e => e.key === 'Enter' && (updateTicket(activeIdx, { nombre: renombrarVal.trim() || ticket.nombre }), setRenombrarOpen(false))} />
              <div className="modal-footer px-0 pb-0 mt-4">
                <button className="btn btn-ghost" onClick={() => setRenombrarOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => { updateTicket(activeIdx, { nombre: renombrarVal.trim() || ticket.nombre }); setRenombrarOpen(false); }}>Aceptar</button>
              </div>
            </ModalBox>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* ── Modal Anular / Devolver ── */}
      <AnimatePresence>
        {anularOpen && (
          <motion.div
            className="fixed inset-0 z-[200] bg-black/82 backdrop-blur-md flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              ref={anularModalRef}
              data-modal
              className="bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] w-[860px] max-w-[98vw] max-h-[90vh] flex overflow-hidden"
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
            >
              {/* ── Columna izq: lista transacciones del día ── */}
              <div className="w-[280px] flex-shrink-0 border-r border-border flex flex-col">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-[14px] font-bold text-text">Anular / Devolver</h3>
                  <div className="text-[11px] text-text-muted mt-0.5">Ventas del día · solo vigentes</div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {anularTransList.length === 0 && !anularError && (
                    <div className="py-10 text-center text-text-subtle text-[12px]">Sin ventas disponibles</div>
                  )}
                  {anularTransList.map(t => (
                    <div
                      key={t.id}
                      onClick={() => seleccionarTransAnular(t.id)}
                      className={`px-4 py-3 cursor-pointer border-b border-border-sub transition-colors ${
                        anularSelTrans?.id === t.id
                          ? 'bg-[rgba(79,142,245,.12)] border-l-[3px] border-l-accent'
                          : 'hover:bg-surface-2'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[13px] font-bold text-text">#{t.id}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          t.estado === 'devolucion_parcial'
                            ? 'bg-[rgba(234,179,8,.2)] text-[#fbbf24]'
                            : 'bg-[rgba(34,197,94,.12)] text-[#4ade80]'
                        }`}>{t.estado === 'devolucion_parcial' ? 'DEV PARCIAL' : 'VIGENTE'}</span>
                      </div>
                      <div className="text-[12px] text-text-muted">{fmt(t.monto_total)} · {t.forma_pago.replace(/_/g, ' ')}</div>
                      {t.nombre_cliente && <div className="text-[11px] text-text-subtle mt-0.5 truncate">{t.nombre_cliente}</div>}
                      <div className="text-[11px] text-text-subtle">
                        {new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Columna der: detalle + acciones ── */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {!anularSelTrans ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-subtle">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
                      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.57"/>
                    </svg>
                    <span className="text-[13px]">Seleccioná una venta de la izquierda</span>
                    {anularError && <div className="text-[12px] text-danger mt-2">{anularError}</div>}
                    <button className="btn btn-ghost mt-2" onClick={() => setAnularOpen(false)}>Cerrar</button>
                  </div>
                ) : (
                  <>
                    {/* Header transacción seleccionada */}
                    <div className="px-5 py-3 border-b border-border flex items-center gap-4 flex-shrink-0">
                      <div>
                        <div className="text-[13px] font-bold text-text">Transacción #{anularSelTrans.id}</div>
                        <div className="text-[12px] text-text-muted">{fmt(anularSelTrans.monto_total)} · {anularSelTrans.forma_pago.replace(/_/g, ' ')}</div>
                      </div>
                      <div className="flex-1" />
                      <div className="flex gap-2">
                        {(['total', 'parcial'] as const).map(tipo => (
                          <button
                            key={tipo}
                            onClick={() => setAnularTipo(tipo)}
                            className={`px-3 py-1.5 rounded-[var(--r-in)] text-[12px] font-semibold border transition-all ${
                              anularTipo === tipo
                                ? tipo === 'total'
                                  ? 'bg-[rgba(239,68,68,.12)] border-danger text-danger'
                                  : 'bg-[rgba(234,179,8,.12)] border-[#ca8a04] text-[#fbbf24]'
                                : 'border-border text-text-muted bg-transparent hover:bg-surface-2'
                            }`}
                          >{tipo === 'total' ? 'Anulación total' : 'Devolución parcial'}</button>
                        ))}
                      </div>
                    </div>

                    {/* Tabla de ítems */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <table className="w-full text-[13px]">
                        <thead className="sticky top-0 bg-surface border-b border-border">
                          <tr>
                            <th className="text-left px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Ítem</th>
                            <th className="text-right px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">P.Unit</th>
                            <th className="text-right px-4 py-2 text-[11px] font-semibold text-text-muted uppercase w-24">
                              {anularTipo === 'parcial' ? 'A devolver' : 'Cant.'}
                            </th>
                            <th className="text-right px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {anularSelTrans.detalle.map((item: any) => {
                            const devQty = anularItemQtys[item.id] ?? 0;
                            const importe = anularTipo === 'parcial'
                              ? item.precio_al_momento * devQty
                              : item.importe_total;
                            return (
                              <tr key={item.id} className="border-b border-border-sub hover:bg-surface-2 transition-colors">
                                <td className="px-4 py-2.5 text-text font-medium">{item.nombre}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-text-muted">{fmt(item.precio_al_momento)}</td>
                                <td className="px-4 py-2.5 text-right">
                                  {anularTipo === 'parcial' ? (
                                    <input
                                      type="number" min="0" max={item.cantidad} step="any"
                                      value={devQty}
                                      onChange={e => {
                                        const v = Math.min(item.cantidad, Math.max(0, parseFloat(e.target.value) || 0));
                                        setAnularItemQtys(q => ({ ...q, [item.id]: v }));
                                      }}
                                      className="inp w-20 text-right py-0.5 px-2 text-[12px] font-mono"
                                    />
                                  ) : (
                                    <span className="font-mono">{item.cantidad}</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-text tabular-nums">{fmt(importe)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer: motivo + confirmar */}
                    <div className="px-5 py-4 border-t border-border flex flex-col gap-3 flex-shrink-0">
                      {anularTipo === 'parcial' && (() => {
                        const totalDev = anularSelTrans.detalle.reduce(
                          (s: number, i: any) => s + i.precio_al_momento * (anularItemQtys[i.id] ?? 0), 0
                        );
                        return (
                          <div className="flex items-center justify-between text-[13px] pb-1 border-b border-border-sub">
                            <span className="text-text-muted">Total a devolver:</span>
                            <span className="font-bold font-mono text-[17px] text-text">{fmt(totalDev)}</span>
                          </div>
                        );
                      })()}
                      <div className="field">
                        <label className="field-label">Motivo <span className="text-danger">*</span></label>
                        <input
                          autoFocus
                          className="inp"
                          value={anularMotivo}
                          onChange={e => setAnularMotivo(e.target.value)}
                          placeholder="Ej: error en precio, cliente devolvió el producto..."
                          onKeyDown={e => e.key === 'Enter' && confirmarAnulacion()}
                        />
                      </div>
                      {anularError && (
                        <div className="text-[12px] text-danger px-3 py-2 bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.25)] rounded-[var(--r-in)]">
                          {anularError}
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button className="btn btn-ghost" onClick={() => setAnularOpen(false)}>Cancelar</button>
                        <button
                          disabled={anularLoading}
                          onClick={confirmarAnulacion}
                          className={`btn font-bold ${anularTipo === 'total' ? 'btn-danger' : 'btn-primary'}`}
                        >
                          {anularLoading
                            ? 'Procesando...'
                            : anularTipo === 'total'
                              ? 'Anular transacción'
                              : 'Confirmar devolución'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal editor de cantidad (*) ── */}
      <AnimatePresence>
        {qtyEditorOpen && (
          <ModalOverlay onClose={() => { setQtyEditorOpen(false); recuperarFocoCodigo(); }}>
            <ModalBox title="Cantidad" onClose={() => { setQtyEditorOpen(false); recuperarFocoCodigo(); }} maxWidth={280}>
              <form onSubmit={confirmQtyEditor} className="flex flex-col gap-4">
                {qtyEditorIdx !== null && (
                  <div className="text-[13px] text-text-muted truncate">{ticket.carrito[qtyEditorIdx]?.nombre}</div>
                )}
                <input
                  autoFocus
                  type="number"
                  step="any"
                  min="0.001"
                  value={qtyEditorVal}
                  onChange={e => setQtyEditorVal(e.target.value)}
                  className="inp text-[22px] font-bold font-mono text-center"
                />
                <div className="modal-footer px-0 pb-0">
                  <button type="button" className="btn btn-ghost" onClick={() => { setQtyEditorOpen(false); recuperarFocoCodigo(); }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Aceptar</button>
                </div>
              </form>
            </ModalBox>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* ── Wizard modo negocio ── */}
      <AnimatePresence>
        {wizardOpen && (
          <motion.div className="fixed inset-0 z-[9999] bg-[rgba(15,23,42,.97)] flex items-center justify-center p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="max-w-[800px] w-full bg-[#1e293b] border border-[#334155] rounded-2xl p-8 flex flex-col gap-6">
              <div className="text-center">
                <div className="text-[22px] font-bold text-[#f1f5f9] mb-2">¿Qué tipo de negocio es?</div>
                <div className="text-[13px] text-[#94a3b8]">Elegí el modo que mejor describe tu comercio. Podés cambiarlo desde Configuración.</div>
              </div>
              <div className="grid grid-cols-3 gap-3.5">
                {WIZARD_MODOS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => seleccionarModo(m.id)}
                    className="bg-[#0f172a] border-2 border-[#334155] rounded-[10px] p-5 text-left flex flex-col gap-2.5 transition-all hover:border-[#3b82f6] hover:bg-[rgba(59,130,246,.07)] outline-none"
                  >
                    <div className="font-bold text-[14px] text-[#f1f5f9]">{m.nombre}</div>
                    <div className="text-[12px] text-[#94a3b8] leading-snug">{m.desc}</div>
                    {m.ejemplos && <div className="text-[11px] text-[#64748b]">{m.ejemplos}</div>}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────
function ToolbarBtn({ icon, label, kbd, onClick, variant, active, disabled }: {
  icon: React.ReactNode; label: string; kbd?: string; onClick?: () => void;
  variant?: 'default'|'danger'|'success'|'warning'; active?: boolean; disabled?: boolean;
}) {
  const base = 'flex items-center gap-1.5 px-3 h-10 rounded-[var(--r)] border text-[13px] font-semibold transition-all cursor-pointer font-[inherit] disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    default: active ? 'bg-[rgba(79,142,245,.12)] border-accent text-accent' : 'bg-surface-2 border-[var(--surface-3)] text-text-muted hover:bg-surface-3 hover:text-text hover:border-[#475569]',
    danger:  'bg-[rgba(239,68,68,.08)] border-[rgba(239,68,68,.3)] text-danger hover:bg-[rgba(239,68,68,.18)]',
    success: 'bg-success border-success-hover text-white font-bold hover:bg-success-hover',
    warning: active ? 'bg-[rgba(245,158,11,.18)] border-[rgba(245,158,11,.5)] text-[#fbbf24]' : 'bg-[rgba(245,158,11,.08)] border-[rgba(245,158,11,.25)] text-[#f59e0b] hover:bg-[rgba(245,158,11,.18)]',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant ?? 'default']}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">{icon}</svg>
      {label}
      {kbd && <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border border-current/20 bg-black/30 opacity-60">{kbd}</span>}
    </button>
  );
}

function PieStat({ label, value, size, muted, color }: { label: string; value: string; size?: 'lg'; muted?: boolean; color?: string }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-text-subtle">{label}</div>
      <div
        className={`font-mono tabular-nums leading-none ${
          size === 'lg'
            ? 'text-[26px] font-black text-text'
            : 'text-[15px] font-bold'
        } ${muted ? 'text-text-muted' : ''}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-[rgba(15,23,42,.85)] flex items-center justify-center p-5"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {children}
    </motion.div>
  );
}

function ModalBox({ title, onClose, children, maxWidth = 460 }: { title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(boxRef, true, onClose);
  return (
    <motion.div
      ref={boxRef}
      data-modal
      initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
      className="bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] w-full"
      style={{ maxWidth }}
    >
      <div className="modal-header">
        <h3 className="modal-title">{title}</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">{children}</div>
    </motion.div>
  );
}

// ── CodigoInput ────────────────────────────────────────────────────────────────
// Self-contained input with scanner detection. Owns codigoVal and codigoAnim so
// every keystroke only re-renders this component, not the entire Caja.

interface CodigoInputHandle {
  focus(): void;
  animOk(): void;
  animError(): void;
  clear(): void;
}

const CodigoInput = forwardRef<CodigoInputHandle, {
  onSubmit: (codigo: string) => void;
  onValueChange?: (val: string) => void;
}>(function CodigoInput({ onSubmit, onValueChange }, ref) {
  const [val, setVal]   = useState('');
  const [anim, setAnim] = useState('');
  const inputRef        = useRef<HTMLInputElement>(null);
  const scannerLastMs   = useRef(0);
  const scannerCharCnt  = useRef(0);
  const timer           = useRef<NodeJS.Timeout | null>(null);
  const onSubmitRef     = useRef(onSubmit);
  onSubmitRef.current   = onSubmit;

  useImperativeHandle(ref, () => ({
    focus:    () => setTimeout(() => inputRef.current?.focus(), 50),
    animOk:   () => { setAnim('scan-ok');    setTimeout(() => setAnim(''), 600); },
    animError:() => { setAnim('scan-error'); setTimeout(() => setAnim(''), 600); },
    clear:    () => { setVal(''); onValueChange?.(''); },
  }));

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function submit(codigo: string) {
    setVal(''); onValueChange?.('');
    onSubmitRef.current(codigo);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { submit(val); return; }
    const now = Date.now();
    const delta = now - scannerLastMs.current;
    scannerLastMs.current = now;
    if (delta < 50) scannerCharCnt.current++; else scannerCharCnt.current = 1;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setVal(v); onValueChange?.(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.length >= 3 && scannerCharCnt.current >= 3) {
      timer.current = setTimeout(() => submit(v), 120);
    }
  }

  return (
    <input
      ref={inputRef}
      value={val}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={`flex-1 text-[16px] font-medium px-3 py-2 rounded-[var(--r)] border-2 border-accent bg-bg text-text outline-none transition-all ${anim}`}
      placeholder="Escaneá o escribí el código..."
      autoComplete="off"
      spellCheck={false}
      autoFocus
    />
  );
});

// ── CartRow ────────────────────────────────────────────────────────────────────
// Memoized cart row. Receives stable callbacks from Caja so it only re-renders
// when the item itself or its selected state changes.

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
      className={`cursor-pointer transition-colors ${selected ? 'bg-[rgba(79,142,245,.12)] [box-shadow:inset_3px_0_0_var(--accent)]' : ''}`}
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
            <button className="px-2.5 py-1 text-text-muted hover:bg-surface-2 text-[15px] font-bold" onClick={e => { e.stopPropagation(); onDecrement(idx); }}>−</button>
            <input
              type="number" step="any" min="0.001"
              value={item.cantidad}
              onChange={e => { onQtyChange(idx, parseFloat(e.target.value) || 1); }}
              onClick={e => e.stopPropagation()}
              className="w-14 text-center bg-transparent border-none outline-none text-[14px] font-semibold py-1"
            />
            <button className="px-2.5 py-1 text-text-muted hover:bg-surface-2 text-[15px] font-bold" onClick={e => { e.stopPropagation(); onIncrement(idx); }}>+</button>
          </div>
        </div>
      </td>
      <td className="text-right font-mono text-[16px] font-bold text-text tabular-nums">{fmt(importe)}</td>
      <td className="text-right text-[12px] text-text-subtle">{item.usaInventario && item.stockActual !== undefined ? item.stockActual : '—'}</td>
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

function MovimientoModal({ turnoActivo, onClose, onDone }: { turnoActivo: any; onClose: () => void; onDone: () => void }) {
  const [tipo, setTipo] = useState<'entrada'|'salida'>('entrada');
  const [categoria, setCategoria] = useState('fondo_cambio');
  const [monto, setMonto] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const catEntrada = [['fondo_cambio','Fondo de cambio'],['cobro_deuda','Cobro de deuda'],['devol_proveedor','Devol. proveedor'],['otro','Otro']];
  const catSalida  = [['retiro_banco','Retiro de banco'],['retiro_dueno','Retiro del dueño'],['pago_proveedor','Pago proveedor'],['gasto_operativo','Gasto operativo'],['pago_servicio','Pago servicio'],['deposito_banco','Depósito banco'],['devol_cliente','Devol. cliente'],['otro','Otro']];
  const cats = tipo === 'entrada' ? catEntrada : catSalida;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = parseFloat(monto);
    if (isNaN(m) || m <= 0) { setError('Ingresá un monto válido.'); return; }
    if (!turnoActivo) { setError('No hay turno abierto.'); return; }
    setLoading(true);
    try {
      await window.api.movimientos.registrar({ turno_id: turnoActivo.id, tipo, categoria, monto: m, descripcion: desc.trim() || categoria });
      onDone();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalBox title="Movimiento de caja" onClose={onClose} maxWidth={400}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex gap-2">
            {(['entrada','salida'] as const).map(t => (
              <label key={t} className={`flex-1 flex items-center gap-2 p-3 rounded-[var(--r-in)] border cursor-pointer transition-all ${tipo===t ? t==='entrada'?'border-success bg-[rgba(34,197,94,.08)]':'border-danger bg-[rgba(239,68,68,.08)]' : 'border-border bg-surface-2'}`}>
                <input type="radio" className="hidden" checked={tipo===t} onChange={() => setTipo(t)} />
                <span className={`text-[13px] font-semibold ${t==='entrada'?'text-[#4ade80]':'text-[#f87171]'}`}>{t==='entrada'?'↓ Entrada':'↑ Salida'}</span>
              </label>
            ))}
          </div>
          <div className="field"><label className="field-label">Categoría *</label>
            <select className="inp" value={categoria} onChange={e => setCategoria(e.target.value)}>
              {cats.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field"><label className="field-label">Monto *</label>
            <input autoFocus className="inp text-[18px] font-bold font-mono" type="number" step="0.01" min="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="field"><label className="field-label">Detalle adicional</label>
            <input className="inp" type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Opcional: proveedor, factura..." />
          </div>
          {error && <div className="text-[12px] text-danger px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] rounded-[var(--r-in)]">{error}</div>}
          <div className="flex gap-2 justify-end mt-1">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={loading} className="btn btn-primary">Registrar</button>
          </div>
        </form>
      </ModalBox>
    </ModalOverlay>
  );
}
