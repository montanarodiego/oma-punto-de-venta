import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useCarritoKeyboard } from '../hooks/useCarritoKeyboard';
import type { Articulo } from '../types/api';
import { mkItem, WIZARD_MODOS, fmt } from './caja/types';
import type { Totales } from './caja/calculosFiscales';
import { useCarrito } from './caja/useCarrito';
import { TicketTabs } from './caja/TicketTabs';
import { BuscadorArticulos } from './caja/BuscadorArticulos';
import { CarritoLista } from './caja/CarritoLista';
import { ModalCobro, type ModalCobroHandle } from './caja/ModalCobro';
import { ModalAnular } from './caja/ModalAnular';
import { ToolbarBtn } from './caja/ui';
import { CajaPie } from './caja/CajaPie';
import { CodigoInput, type CodigoInputHandle } from './caja/CodigoInput';
import { ModalMovimiento } from './caja/ModalMovimiento';
import { ModalWizard } from './caja/ModalWizard';
import { ModalLibre, ModalDescItem, ModalRenombrar, ModalQtyEditor } from './caja/ModalesInline';

// ── Main component ──────────────────────────────────────────────────────────
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
  const [propina, setPropina] = useState(''); // debe declararse antes de useCarrito

  const codigoRef = useRef<CodigoInputHandle>(null);
  const recuperarFocoCodigo = useCallback(() => { setTimeout(() => codigoRef.current?.focus(), 50); }, []);

  const {
    tickets, activeIdx, setActiveIdx, ticket, totales,
    activeIdxRef, ticketsRef, mayoreoModeRef,
    nuevoTicket, cerrarTicket, limpiarTicket, updateTicket,
    agregarArticulo, borrarItemSel,
    onCartToggleSelect, onCartDecrement, onCartIncrement, onCartQtyChange,
    qtyEditorOpen, qtyEditorVal, qtyEditorIdx,
    setQtyEditorOpen, setQtyEditorVal,
    openQtyEditor, confirmQtyEditor,
  } = useCarrito({
    modoNegocio, tasaIva, mostrarIva, mayoreoMode, propina,
    showToast,
    focusCodigo:  recuperarFocoCodigo,
    clearCodigo:  () => codigoRef.current?.clear(),
  });

  // UI state
  const [buscadorOpen, setBuscadorOpen] = useState(false);
  const [cobroOpen, setCobroOpen] = useState(false);
  const [descInlineOpen, setDescInlineOpen] = useState(false);
  const [descTipo, setDescTipo] = useState<'pct'|'monto'>('pct');
  const [descVal, setDescVal] = useState('');
  const [notasOpen, setNotasOpen] = useState(false);
  const [showPropina, setShowPropina] = useState(false);
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
  const [renombrarOpen, setRenombrarOpen] = useState(false);
  const [renombrarVal, setRenombrarVal] = useState('');

  // ── Dropdown de sugerencias ────────────────────────────────────
  const [sugs, setSugs]     = useState<Articulo[]>([]);
  const [sugIdx, setSugIdx] = useState(-1);
  const sugTimer    = useRef<NodeJS.Timeout | null>(null);
  const codigoBarRef = useRef<HTMLDivElement>(null);

  // ── Cantidad directa con asterisco (ej: "3*coca") ──────────────
  const parsedQtyRef = useRef(1);
  const [parsedQtyDisplay, setParsedQtyDisplay] = useState(1);

  const codigoIsEmptyRef = useRef(true);
  const cobrarRef      = useRef<(conTicket: boolean) => void>(() => {});
  const cobroModalRef  = useRef<ModalCobroHandle>(null);
  const hotkeyRef      = useRef<(e: KeyboardEvent) => void>(() => {});

  // Cerrar dropdown al hacer click fuera de la barra de código
  useEffect(() => {
    if (sugs.length === 0) return;
    function handleOutside(e: MouseEvent) {
      if (codigoBarRef.current && !codigoBarRef.current.contains(e.target as Node)) {
        setSugs([]);
        setSugIdx(-1);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [sugs.length]);

  // ── Verificador de precios: agregar artículo desde el overlay ──
  useEffect(() => {
    function handler(e: Event) {
      const art = (e as CustomEvent<Articulo>).detail;
      if (art) agregarArticulo(art);
    }
    window.addEventListener('verificador:agregar', handler);
    return () => window.removeEventListener('verificador:agregar', handler);
  }, [agregarArticulo]);

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

    const u1 = window.api.onCobrarConTicket(() => cobrarRef.current(true));
    const u2 = window.api.onCobrarSinTicket(() => cobrarRef.current(false));
    const u3 = window.api.onAbrirCobro(() => setCobroOpen(true));
    return () => { u1(); u2(); u3(); };
  }, []);

  // focus código al cerrar buscador/cobro/qty editor
  useEffect(() => { if (!buscadorOpen && !cobroOpen && !qtyEditorOpen) recuperarFocoCodigo(); }, [buscadorOpen, cobroOpen, qtyEditorOpen]);

  // Auto-scroll al ítem seleccionado en el carrito
  useEffect(() => {
    const el = document.querySelector('[data-cart-sel="true"]') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [ticket.itemSelIdx, activeIdx]);

  const noModal = !buscadorOpen && !cobroOpen && !libreOpen && !descItemOpen && !movOpen && !anularOpen && !renombrarOpen && !wizardOpen && !qtyEditorOpen;
  const noModalRef = useRef(noModal);
  noModalRef.current = noModal;

  hotkeyRef.current = (e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement)?.tagName.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'F10') { e.preventDefault(); abrirBuscador(); return; }
    if (e.key === 'F11') { e.preventDefault(); setMayoreoMode(m => !m); return; }
    if (e.key === 'F12') { e.preventDefault(); setCobroOpen(true); window.api.setModalCobro(true); return; }
    if (e.key === 'Insert') { e.preventDefault(); setLibreOpen(true); return; }
    if (e.key === 'Delete' && (!isInput || (noModal && ticket.itemSelIdx !== null && codigoIsEmptyRef.current))) {
      e.preventDefault(); borrarItemSel(); return;
    }
    if (e.key === 'Escape' && buscadorOpen) { setBuscadorOpen(false); return; }
    if (e.key === 'Escape' && noModal && ticket.itemSelIdx !== null) {
      e.preventDefault(); updateTicket(activeIdx, { itemSelIdx: null }); return;
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => hotkeyRef.current(e);
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  // useCarritoKeyboard ignora ↑↓ cuando el foco está en un <input>, así que no
  // interfiere con la navegación del dropdown mientras el campo de código tiene foco.
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
    onPlus:  () => { onCartIncrement(ticket.itemSelIdx ?? ticket.carrito.length - 1); recuperarFocoCodigo(); },
    onMinus: () => { onCartDecrement(ticket.itemSelIdx ?? ticket.carrito.length - 1); recuperarFocoCodigo(); },
    onStar:  () => { openQtyEditor(ticket.itemSelIdx ?? ticket.carrito.length - 1); },
  });

  function aplicarModo(modo: string) {
    setShowPropina(modo === 'restaurante');
    setMostrarPrecioConIva(modo === 'mayorista');
  }

  // ── Seleccionar sugerencia del dropdown ────────────────────────
  async function seleccionarSug(art: Articulo) {
    const qty = parsedQtyRef.current;
    parsedQtyRef.current = 1;
    setParsedQtyDisplay(1);
    setSugs([]);
    setSugIdx(-1);
    if (sugTimer.current) clearTimeout(sugTimer.current);
    codigoRef.current?.clear();
    await agregarArticulo(art, qty);
    codigoRef.current?.animOk();
  }

  // ── Código input ───────────────────────────────────────────────
  function handleCodigoChange(v: string) {
    codigoIsEmptyRef.current = v === '';
    if (sugTimer.current) clearTimeout(sugTimer.current);

    // Parse asterisco: "3*coca" → qty=3, search="coca"
    const starIdx = v.indexOf('*');
    const hasQty  = starIdx > 0;
    const search  = hasQty ? v.slice(starIdx + 1).trim() : v.trim();
    const qty     = hasQty ? (parseFloat(v.slice(0, starIdx)) || 1) : 1;
    parsedQtyRef.current = qty;
    setParsedQtyDisplay(qty);

    if (search.length >= 1) {
      sugTimer.current = setTimeout(async () => {
        const res = await window.api.articulos.search(search);
        // Código exacto sin prefijo de cantidad → agregar directo sin dropdown
        if (!hasQty && res.length === 1 && res[0].codigo.toLowerCase() === search.toLowerCase()) {
          await seleccionarSug(res[0]);
          return;
        }
        setSugs(res.slice(0, 8));
        setSugIdx(-1);
      }, 200);
    } else {
      setSugs([]);
      setSugIdx(-1);
    }
  }

  function handleCodigoKeyDown(e: React.KeyboardEvent<HTMLInputElement>): boolean {
    if (sugs.length === 0) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSugIdx(i => Math.min(i + 1, sugs.length - 1));
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSugIdx(i => Math.max(i - 1, -1));
      return true;
    }
    if (e.key === 'Enter' && sugIdx >= 0) {
      e.preventDefault();
      const art = sugs[sugIdx];
      if (art) seleccionarSug(art);
      return true;
    }
    if (e.key === 'Escape') {
      setSugs([]);
      setSugIdx(-1);
      return true;
    }
    return false;
  }

  const procesarCodigoFn = useCallback(async (codigo: string) => {
    if (!codigo.trim()) return;
    setSugs([]);
    setSugIdx(-1);
    if (sugTimer.current) clearTimeout(sugTimer.current);

    // Parse asterisco: "3*7501055341344" o "3*coca"
    let cantidad = 1;
    let busqueda = codigo.trim();
    const starIdx = busqueda.indexOf('*');
    if (starIdx > 0) {
      const cand = parseFloat(busqueda.slice(0, starIdx));
      if (!isNaN(cand) && cand > 0) {
        cantidad = cand;
        busqueda = busqueda.slice(starIdx + 1).trim();
      }
    }
    parsedQtyRef.current = 1;
    setParsedQtyDisplay(1);

    const art = await window.api.articulos.getByCodigo(busqueda);
    if (art) {
      await agregarArticulo(art, cantidad);
      codigoRef.current?.animOk();
    } else {
      const res = await window.api.articulos.search(busqueda);
      if (res.length >= 1) {
        await agregarArticulo(res[0], cantidad);
        codigoRef.current?.animOk();
      } else {
        codigoRef.current?.animError();
        showToast('Código no encontrado: ' + busqueda, 'error');
      }
    }
  }, [showToast]); // agregarArticulo y sugTimer usan refs internamente

  function abrirBuscador() { setBuscadorOpen(true); }

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

  cobrarRef.current = (conTicket) => cobroModalRef.current?.cobrar(conTicket);

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
    const item = ticketsRef.current[activeIdxRef.current]?.carrito[idx];
    if (!item) return;
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

  const onCartDescuento = useCallback((idx: number) => {
    const item = ticketsRef.current[activeIdxRef.current]?.carrito[idx];
    if (!item) return;
    setDescItemIdx(idx);
    setDescItemTipo('pct');
    setDescItemVal(item.descPct > 0 ? String(item.descPct) : '');
    setDescItemOpen(true);
  }, [ticketsRef, activeIdxRef]);

  // ── Render ──────────────────────────────────────────────────────
  if (!ready) return <div className="page-content flex items-center justify-center text-text-subtle text-sm">Cargando...</div>;

  const canCobrar = ticket.carrito.length > 0 && !!turnoActivo;

  return (
    <div className="page-content flex flex-col" style={{ fontFamily: 'inherit' }}>

      {/* ── Tabs ── */}
      <TicketTabs
        tickets={tickets} activeIdx={activeIdx}
        onSwitch={setActiveIdx} onClose={cerrarTicket} onNew={nuevoTicket}
        mayoreoMode={mayoreoMode}
      />

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
        <ToolbarBtn icon={<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.57"/></svg>} label="Anular" variant="warning" onClick={() => setAnularOpen(true)} />
        {ticket.carrito.length > 0 && (
          <span
            className="text-[12px] text-text-subtle cursor-pointer hover:text-accent px-1.5 py-0.5 rounded"
            onDoubleClick={() => { setRenombrarVal(ticket.nombre); setRenombrarOpen(true); }}
            title="Doble clic para renombrar"
          >{ticket.nombre}</span>
        )}
      </div>

      {/* ── Código bar ── */}
      <div
        ref={codigoBarRef}
        className="relative flex items-center gap-3 px-3 py-2.5 bg-surface border-b border-border flex-shrink-0"
      >
        <label className="text-[12px] font-bold text-text-muted whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5">
          Código:
          {parsedQtyDisplay > 1 && (
            <span className="text-accent font-black text-[13px]">×{parsedQtyDisplay}</span>
          )}
        </label>
        <CodigoInput
          ref={codigoRef}
          onSubmit={procesarCodigoFn}
          onValueChange={handleCodigoChange}
          onKeyDownInterceptor={handleCodigoKeyDown}
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

        {/* ── Dropdown sugerencias ── */}
        {sugs.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-[500] bg-surface border-x border-b border-border shadow-[var(--shadow-lg)] overflow-hidden rounded-b-[var(--r-card)]">
            {sugs.map((art, i) => (
              <div
                key={art.id}
                onMouseDown={() => seleccionarSug(art)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-border-sub last:border-b-0 transition-colors ${i === sugIdx ? 'bg-[rgba(79,142,245,.12)]' : 'hover:bg-surface-2'}`}
              >
                <span className="font-mono text-[11px] text-text-muted w-[80px] flex-shrink-0 truncate">{art.codigo}</span>
                <span className="flex-1 text-[13px] font-medium text-text truncate min-w-0">{art.nombre}</span>
                <span className="font-mono text-[15px] font-bold text-text tabular-nums flex-shrink-0">{fmt(art.precio_unitario)}</span>
                {art.stock_actual <= 0
                  ? <span className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-sm flex-shrink-0">SIN STOCK</span>
                  : <span className="text-[11px] text-text-muted flex-shrink-0">Stk: {art.stock_actual}</span>
                }
              </div>
            ))}
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
        <CarritoLista
          carrito={ticket.carrito}
          itemSelIdx={ticket.itemSelIdx}
          onToggleSelect={onCartToggleSelect}
          onDecrement={onCartDecrement}
          onIncrement={onCartIncrement}
          onQtyChange={onCartQtyChange}
          onDescuento={onCartDescuento}
        />
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
      <CajaPie
        carrito={ticket.carrito}
        totales={totales}
        mostrarIva={mostrarIva}
        modoNegocio={modoNegocio}
        tasaIva={tasaIva}
        canCobrar={canCobrar}
        ultimaTransId={ultimaTransId}
        onCobrar={() => setCobroOpen(true)}
      />

      {/* ── Buscador overlay (F10) ── */}
      <BuscadorArticulos open={buscadorOpen} onClose={() => setBuscadorOpen(false)} onSelect={agregarArticulo} />

      {/* ── Modal Cobro (F12) ── */}
      <ModalCobro
        ref={cobroModalRef}
        open={cobroOpen}
        onClose={() => { setCobroOpen(false); window.api.setModalCobro(false); }}
        totales={totales}
        ticket={ticket}
        activeIdx={activeIdx}
        turnoActivo={turnoActivo}
        propina={propina}
        canCobrar={canCobrar}
        limpiarTicket={limpiarTicket}
        showToast={showToast}
        navigate={navigate}
        onVentaRegistrada={setUltimaTransId}
      />

      {/* ── Modales pequeños ── */}
      <ModalLibre
        open={libreOpen} onClose={() => setLibreOpen(false)}
        desc={libreDesc} precio={librePrecio} cant={libreCant}
        setDesc={setLibreDesc} setPrecio={setLibrePrecio} setCant={setLibreCant}
        onSubmit={agregarLibre}
      />
      <ModalDescItem
        open={descItemOpen && descItemIdx !== null} onClose={() => setDescItemOpen(false)}
        itemNombre={descItemIdx !== null ? ticket.carrito[descItemIdx]?.nombre : undefined}
        tipo={descItemTipo} val={descItemVal}
        setTipo={setDescItemTipo} setVal={setDescItemVal}
        onApply={aplicarDescItem}
        onRemove={() => {
          if (descItemIdx !== null) {
            const c = [...ticket.carrito];
            c[descItemIdx] = { ...c[descItemIdx], descPct: 0 };
            updateTicket(activeIdx, { carrito: c });
          }
          setDescItemOpen(false);
        }}
      />

      {/* ── Modal Movimiento de caja ── */}
      {movOpen && <ModalMovimiento turnoActivo={turnoActivo} onClose={() => setMovOpen(false)} onDone={() => { setMovOpen(false); showToast('Movimiento registrado.', 'ok'); }} />}

      <ModalRenombrar
        open={renombrarOpen} onClose={() => setRenombrarOpen(false)}
        val={renombrarVal} setVal={setRenombrarVal}
        onApply={() => { updateTicket(activeIdx, { nombre: renombrarVal.trim() || ticket.nombre }); setRenombrarOpen(false); }}
      />

      {/* ── Modal Anular / Devolver ── */}
      <ModalAnular
        open={anularOpen}
        onClose={() => setAnularOpen(false)}
        turnoActivo={turnoActivo}
        showToast={showToast}
      />

      <ModalQtyEditor
        open={qtyEditorOpen}
        onClose={() => { setQtyEditorOpen(false); recuperarFocoCodigo(); }}
        itemNombre={qtyEditorIdx !== null ? ticket.carrito[qtyEditorIdx]?.nombre : undefined}
        val={qtyEditorVal} setVal={setQtyEditorVal}
        onConfirm={() => { if (qtyEditorIdx !== null) confirmQtyEditor(qtyEditorIdx, qtyEditorVal); }}
      />

      {/* ── Wizard modo negocio ── */}
      <ModalWizard open={wizardOpen} onSelect={seleccionarModo} />
    </div>
  );
}
