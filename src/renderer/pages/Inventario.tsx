import { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { useSession } from '../context/SessionContext';
import { Card, CardHeader, CardBody, Button, Field, Input, Select, Modal, VirtualTable } from '../components/ui';
import type { MovimientoInventario, Articulo } from '../types/api';

function fmt(n: number) { return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2}).format(n??0); }
function fmtFecha(s: string) { return s ? new Date(s).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; }

function handleNumericKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const modal = (e.currentTarget as HTMLElement).closest('[data-modal]');
  if (!modal) return;
  const sel = 'button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled])';
  const els = Array.from(modal.querySelectorAll<HTMLElement>(sel));
  const idx = els.indexOf(e.currentTarget as HTMLElement);
  if (idx < 0) return;
  els[e.key === 'ArrowDown' ? Math.min(idx + 1, els.length - 1) : Math.max(idx - 1, 0)]?.focus();
}

export default function Inventario() {
  const { showToast } = useToast();
  const { session }   = useSession();
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [stockBajo, setStockBajo] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'movimientos'|'stock-bajo'>('movimientos');
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [artId, setArtId] = useState('');
  const [tipo, setTipo] = useState<'entrada'|'salida'|'ajuste'>('ajuste');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ajustando, setAjustando] = useState(false);
  const [artBusqueda, setArtBusqueda] = useState('');
  const [artResultados, setArtResultados] = useState<Articulo[]>([]);
  const [artSel, setArtSel] = useState<Articulo | null>(null);
  const [error, setError] = useState('');

  const buscarTimer = useRef<NodeJS.Timeout | null>(null);
  const buscarGen   = useRef(0);

  useEffect(() => { cargar(); }, []);
  useEffect(() => () => { if (buscarTimer.current) clearTimeout(buscarTimer.current); }, []);

  async function cargar() {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([window.api.inventario.listarMovimientos({}), window.api.inventario.stockBajo()]);
      setMovimientos(m); setStockBajo(s);
    } catch (e) {
      window.api.log?.error?.('[Inventario] cargar falló', String(e));
      showToast('No se pudo cargar el inventario. Reintentá.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function buscarArt(q: string) {
    setArtBusqueda(q); setArtSel(null);
    if (buscarTimer.current) clearTimeout(buscarTimer.current);
    if (!q.trim()) { setArtResultados([]); return; }
    buscarTimer.current = setTimeout(async () => {
      const gen = ++buscarGen.current;
      const res = await window.api.articulos.search(q);
      if (gen === buscarGen.current) setArtResultados(res);
    }, 250);
  }

  async function ajustar(e: React.FormEvent) {
    e.preventDefault();
    if (!artSel) { setError('Seleccioná un artículo.'); return; }
    const cant = parseFloat(cantidad);
    if (isNaN(cant) || cant <= 0) { setError('Ingresá una cantidad válida.'); return; }
    setAjustando(true); setError('');
    try {
      await window.api.inventario.ajustar({
        articulo_id: artSel.id,
        tipo_ajuste: tipo === 'ajuste' ? 'correccion' : tipo,
        cantidad:    cant,
        motivo:      motivo.trim() || tipo,
        usuario:     session?.nombre ?? 'sistema',
      });
      setAjusteOpen(false); setArtSel(null); setArtBusqueda(''); setCantidad(''); setMotivo('');
      await cargar(); showToast('Ajuste registrado.', 'ok');
    } catch (err: any) { setError(err.message ?? 'Error.'); }
    finally { setAjustando(false); }
  }

  return (
    <div className="page-content">
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Inventario</h1>
        <Button variant="primary" size="sm" onClick={() => setAjusteOpen(true)}>+ Ajuste de stock</Button>
      </div>

      <div className="flex gap-0 px-6 pt-3 border-b border-border flex-shrink-0">
        {(['movimientos','stock-bajo'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px ${tab===t?'border-accent text-accent':'border-transparent text-text-muted hover:text-text'}`}>
            {t === 'movimientos' ? 'Movimientos' : `Stock bajo ${stockBajo.length>0?`(${stockBajo.length})`:''}`}
          </button>
        ))}
      </div>

      {tab === 'movimientos' && (
        <VirtualTable
          items={loading ? [] : movimientos}
          estimateSize={40}
          colSpan={8}
          header={<tr><th>Fecha</th><th>Artículo</th><th>Tipo</th><th className="text-right">Antes</th><th className="text-right">Cambio</th><th className="text-right">Después</th><th>Motivo</th><th>Usuario</th></tr>}
          emptyState={
            loading
              ? <div className="flex items-center justify-center h-32 text-text-subtle text-sm">Cargando…</div>
              : <div className="text-center py-10 text-text-subtle text-[13px]">Sin movimientos.</div>
          }
          renderRow={(m, i) => (
                <tr key={i}>
                  <td className="text-[12px] whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                  <td className="text-[13px]">{m.articulo_nombre ?? m.articulo_id}</td>
                  <td><span className={`text-[11px] px-1.5 rounded font-semibold ${m.tipo==='entrada'?'bg-[rgba(34,197,94,.12)] text-[#4ade80]':m.tipo==='salida'?'bg-[rgba(239,68,68,.12)] text-[#f87171]':'bg-[rgba(79,142,245,.12)] text-accent'}`}>{m.tipo}</span></td>
                  <td className="text-right font-mono text-[12px]">{m.cantidad_anterior}</td>
                  <td className={`text-right font-mono text-[12px] ${m.cantidad_cambio>0?'text-[#4ade80]':'text-[#f87171]'}`}>{m.cantidad_cambio>0?'+':''}{m.cantidad_cambio}</td>
                  <td className="text-right font-mono text-[12px] font-semibold">{m.cantidad_resultante}</td>
                  <td className="text-[12px] text-text-muted">{m.motivo}</td>
                  <td className="text-[12px] text-text-muted">{m.usuario || '—'}</td>
                </tr>
              )}
            />
          )}
      {tab === 'stock-bajo' && (
        loading
          ? <div className="flex-1 flex items-center justify-center text-text-subtle text-sm">Cargando…</div>
          : (
            <div className="flex-1 overflow-y-auto">
              <table className="tbl">
                <thead><tr><th>Artículo</th><th>Código</th><th className="text-right">Stock actual</th><th className="text-right">Stock mínimo</th></tr></thead>
                <tbody>
                  {stockBajo.length === 0
                    ? <tr><td colSpan={4} className="text-center py-10 text-[#4ade80] text-[13px]">✓ Todo el stock está bien.</td></tr>
                    : stockBajo.map(a => (
                      <tr key={a.id}>
                        <td className="font-medium text-[13px]">{a.nombre}</td>
                        <td className="font-mono text-[12px] text-text-muted">{a.codigo}</td>
                        <td className={`text-right font-mono text-[13px] font-semibold ${a.stock_actual<=0?'text-danger':'text-warning'}`}>{a.stock_actual}</td>
                        <td className="text-right font-mono text-[12px] text-text-muted">{a.stock_minimo}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {/* Modal ajuste */}
      <Modal open={ajusteOpen} onClose={() => setAjusteOpen(false)} title="Ajuste de stock"
        footer={<><Button variant="ghost" onClick={() => setAjusteOpen(false)}>Cancelar</Button><Button variant="primary" loading={ajustando} onClick={() => document.getElementById('form-ajuste')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}>Registrar ajuste</Button></>}
      >
        <form id="form-ajuste" onSubmit={ajustar} className="flex flex-col gap-4">
          <div className="field">
            <label className="field-label">Artículo *</label>
            <Input value={artBusqueda} onChange={e => buscarArt(e.target.value)} placeholder="Buscar por nombre o código..." />
            {artResultados.length > 0 && !artSel && (
              <div className="bg-surface-2 border border-border rounded-[var(--r-in)] mt-1 max-h-40 overflow-y-auto">
                {artResultados.map(a => (
                  <div key={a.id} onClick={() => { setArtSel(a); setArtBusqueda(a.nombre); setArtResultados([]); }} className="px-3 py-2 cursor-pointer hover:bg-surface-3 text-[13px] border-b border-border-sub last:border-none">
                    {a.nombre} <span className="text-text-muted text-[11px]">{a.codigo} · Stock: {a.stock_actual}</span>
                  </div>
                ))}
              </div>
            )}
            {artSel && <div className="text-[12px] text-[#4ade80] mt-1">✓ {artSel.nombre} (stock actual: {artSel.stock_actual})</div>}
          </div>
          <div className="flex gap-3">
            {(['ajuste','entrada','salida'] as const).map(t => (
              <label key={t} className={`flex-1 flex items-center justify-center py-2 rounded-[var(--r-in)] border cursor-pointer text-[12px] font-semibold capitalize transition-all ${tipo===t?'bg-accent/10 border-accent text-accent':'border-border text-text-muted bg-surface-2'}`}>
                <input type="radio" className="sr-only" checked={tipo===t} onChange={() => setTipo(t)} />
                {t === 'ajuste' ? 'Ajuste' : t === 'entrada' ? '↓ Entrada' : '↑ Salida'}
              </label>
            ))}
          </div>
          <Field label="Cantidad *"><Input autoFocus={!!artSel} type="number" step="any" min="0.001" value={cantidad} onChange={e => setCantidad(e.target.value)} onKeyDown={handleNumericKeyDown} placeholder="0" required /></Field>
          <Field label="Motivo"><Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Opcional" /></Field>
          {error && <div className="px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px] rounded-[var(--r-in)]">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}
