import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { useCarritoKeyboard } from '../hooks/useCarritoKeyboard';
import type { Articulo } from '../types/api';
import {
  type CartItem, type Ticket,
  MODOS_SIN_IVA, MODOS_IVA_DESGLOSADO, UNIDADES_CONTINUAS,
  fmt, mkItem, WIZARD_MODOS,
} from './caja/types';
import type { Totales } from './caja/calculosFiscales';
import { useCarrito } from './caja/useCarrito';
import { TicketTabs } from './caja/TicketTabs';
import { BuscadorArticulos } from './caja/BuscadorArticulos';
import { CarritoLista } from './caja/CarritoLista';
import { ModalCobro, type ModalCobroHandle } from './caja/ModalCobro';
import { ModalAnular } from './caja/ModalAnular';
import { ToolbarBtn, PieStat, ModalOverlay, ModalBox } from './caja/ui';
import { CodigoInput, type CodigoInputHandle } from './caja/CodigoInput';
import { ModalMovimiento } from './caja/ModalMovimiento';

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
  const [renombrarOpen, setRenombrarOpen] = useState(false);
  const [renombrarVal, setRenombrarVal] = useState('');

  const codigoIsEmptyRef = useRef(true);
  const cobrarRef      = useRef<(conTicket: boolean) => void>(() => {});
  const cobroModalRef  = useRef<ModalCobroHandle>(null);
  const hotkeyRef      = useRef<(e: KeyboardEvent) => void>(() => {});


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
    return () => { u1(); u2(); u3(); };
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
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => hotkeyRef.current(e);
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  // Teclas de carrito en capture phase
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

  // ── Código input ───────────────────────────────────────────────
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

  // Mantiene cobrarRef actualizado — delega al handle del modal para que los IPC listeners funcionen.
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
      {movOpen && <ModalMovimiento turnoActivo={turnoActivo} onClose={() => setMovOpen(false)} onDone={() => { setMovOpen(false); showToast('Movimiento registrado.', 'ok'); }} />}

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
      <ModalAnular
        open={anularOpen}
        onClose={() => setAnularOpen(false)}
        turnoActivo={turnoActivo}
        showToast={showToast}
      />

      {/* ── Modal editor de cantidad (*) ── */}
      <AnimatePresence>
        {qtyEditorOpen && (
          <ModalOverlay onClose={() => { setQtyEditorOpen(false); recuperarFocoCodigo(); }}>
            <ModalBox title="Cantidad" onClose={() => { setQtyEditorOpen(false); recuperarFocoCodigo(); }} maxWidth={280}>
              <form onSubmit={e => { e.preventDefault(); if (qtyEditorIdx !== null) confirmQtyEditor(qtyEditorIdx, qtyEditorVal); }} className="flex flex-col gap-4">
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

