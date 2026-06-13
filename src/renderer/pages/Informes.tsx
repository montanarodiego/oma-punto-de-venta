import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardHeader, CardBody, VirtualTable } from '../components/ui';
import type { ResumenRapido, ArticuloVendido, VentaDia, UtilidadBrutaResult, UtilidadItem, MejorDia, VentaDepto, VentaMes } from '../types/api';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const CHART_COLORS = ['#4f8ef5','#2dda6e','#f59e0b','#ef4444','#a78bfa','#38bdf8','#fb923c','#34d399','#f472b6','#818cf8'];
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fmtMes(ym: string) { const [y, m] = ym.split('-'); return `${MESES[+m - 1]} ${y.slice(2)}`; }

type UtilSortKey = 'utilidad_total' | 'margen' | 'nombre';
function fmtPct(n: number) { return `${(n ?? 0).toFixed(1)}%`; }

function fmt(n: number) { return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2}).format(n??0); }

function hoy() { return new Date().toISOString().split('T')[0]; }
function primerDiaMes() { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; }

export default function Informes() {
  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoy());
  const [resumen, setResumen] = useState<ResumenRapido | null>(null);
  const [topArticulos, setTopArticulos] = useState<ArticuloVendido[]>([]);
  const [ventasPorDia, setVentasPorDia] = useState<VentaDia[]>([]);
  const [utilidad, setUtilidad] = useState<UtilidadBrutaResult | null>(null);
  const [mejor,        setMejor]       = useState<MejorDia | null>(null);
  const [ventasDeptos, setVentasDeptos] = useState<VentaDepto[]>([]);
  const [ventasMes,    setVentasMes]    = useState<VentaMes[]>([]);
  const [loading, setLoading] = useState(false);

  const deptoChartRef = useRef<HTMLCanvasElement>(null);
  const mesChartRef   = useRef<HTMLCanvasElement>(null);
  const diaChartRef   = useRef<HTMLCanvasElement>(null);
  const [utilSort, setUtilSort] = useState<UtilSortKey>('utilidad_total');
  const [utilDir,  setUtilDir]  = useState<'asc' | 'desc'>('desc');

  const utilItems = useMemo((): (UtilidadItem & { margen: number })[] => {
    if (!utilidad?.items) return [];
    return [...utilidad.items]
      .map(it => ({
        ...it,
        margen: it.precio_venta_promedio > 0 && it.cantidad_total > 0
          ? (it.utilidad_total / (it.precio_venta_promedio * it.cantidad_total)) * 100
          : 0,
      }))
      .sort((a, b) => {
        const v = utilSort === 'nombre'
          ? a.nombre.localeCompare(b.nombre, 'es')
          : utilSort === 'margen' ? a.margen - b.margen
          : a.utilidad_total - b.utilidad_total;
        return utilDir === 'asc' ? v : -v;
      });
  }, [utilidad, utilSort, utilDir]);

  function sortTh(col: UtilSortKey, label: string, cls = '') {
    const active = utilSort === col;
    return (
      <th
        key={col}
        className={`cursor-pointer select-none ${cls} ${active ? 'text-[#4f8ef5]' : ''}`}
        onClick={() => {
          if (utilSort === col) setUtilDir(d => d === 'asc' ? 'desc' : 'asc');
          else { setUtilSort(col); setUtilDir('desc'); }
        }}
      >
        {label}{active ? (utilDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </th>
    );
  }

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const [r, top, util, dias, mej, deptos, meses] = await Promise.all([
      window.api.informes.resumenRapido(desde, hasta),
      window.api.informes.articulosMasVendidos(desde, hasta),
      window.api.informes.utilidadBruta(desde, hasta),
      window.api.informes.ventasPorDia(desde, hasta),
      window.api.informes.mejorDia(desde, hasta),
      window.api.informes.ventasPorDepartamento(desde, hasta),
      window.api.informes.ventasPorMes(desde, hasta),
    ]);
    setResumen(r); setTopArticulos(top ?? []); setUtilidad(util); setVentasPorDia(dias ?? []);
    setMejor(mej); setVentasDeptos(deptos ?? []); setVentasMes(meses ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!diaChartRef.current || !ventasPorDia.length) return;
    const labels = ventasPorDia.map(d =>
      new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    );
    const chart = new Chart(diaChartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Ventas',
            data: ventasPorDia.map(d => d.monto_total),
            backgroundColor: 'rgba(79,142,245,0.65)',
            borderColor: '#4f8ef5',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Ganancia',
            data: ventasPorDia.map(d => d.ganancia),
            backgroundColor: 'rgba(45,218,110,0.5)',
            borderColor: '#2dda6e',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8fa3bd', boxWidth: 12, padding: 16 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}` } },
        },
        scales: {
          x: { ticks: { color: '#8fa3bd', maxRotation: 45 }, grid: { color: '#1c2a3f' } },
          y: { ticks: { color: '#8fa3bd', callback: v => fmt(Number(v)) }, grid: { color: '#1c2a3f' } },
        },
      },
    });
    return () => chart.destroy();
  }, [ventasPorDia]);

  useEffect(() => {
    if (!deptoChartRef.current || !ventasDeptos.length) return;
    const chart = new Chart(deptoChartRef.current, {
      type: 'bar',
      data: {
        labels: ventasDeptos.map(d => d.departamento),
        datasets: [{
          label: 'Ventas',
          data: ventasDeptos.map(d => d.total),
          backgroundColor: ventasDeptos.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderWidth: 0,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: '#8fa3bd', callback: v => fmt(Number(v)) },
            grid:  { color: '#1c2a3f' },
          },
          y: {
            ticks: { color: '#eef2f8', font: { size: 12 } },
            grid:  { display: false },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [ventasDeptos]);

  useEffect(() => {
    if (!mesChartRef.current || !ventasMes.length) return;
    const chart = new Chart(mesChartRef.current, {
      type: 'line',
      data: {
        labels: ventasMes.map(m => fmtMes(m.mes)),
        datasets: [
          {
            label: 'Ventas',
            data: ventasMes.map(m => m.total),
            borderColor: '#4f8ef5',
            backgroundColor: 'rgba(79,142,245,0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#4f8ef5',
          },
          {
            label: 'Ganancia',
            data: ventasMes.map(m => m.ganancia),
            borderColor: '#2dda6e',
            backgroundColor: 'rgba(45,218,110,0.06)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#2dda6e',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8fa3bd', boxWidth: 12, padding: 16 } },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}` },
          },
        },
        scales: {
          x: {
            ticks: { color: '#8fa3bd' },
            grid:  { color: '#1c2a3f' },
          },
          y: {
            ticks: { color: '#8fa3bd', callback: v => fmt(Number(v)) },
            grid:  { color: '#1c2a3f' },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [ventasMes]);

  return (
    <div className="page-content">
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Informes</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-text-muted">Desde</span>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="inp py-1.5 px-2 w-36 text-[13px]" />
            <span className="text-text-muted">hasta</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="inp py-1.5 px-2 w-36 text-[13px]" />
          </div>
          <button onClick={cargar} disabled={loading} className="btn btn-primary py-1.5 px-4 text-[13px]">
            {loading ? 'Cargando...' : 'Aplicar'}
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-5">

          {/* KPIs */}
          <div className="grid grid-cols-5 gap-4">
            {([
              { label:'Ventas totales',     value:fmt(resumen?.total_ventas??0),       color:'text-text',      accent:'[border-left-color:#4f8ef5]' },
              { label:'Cantidad de ventas', value:String(resumen?.cantidad_ventas??0), color:'text-text',      accent:'[border-left-color:#a78bfa]' },
              { label:'Ticket promedio',    value:fmt(resumen?.ticket_promedio??0),    color:'text-accent',    accent:'[border-left-color:#38bdf8]' },
              { label:'Utilidad bruta',     value:fmt(utilidad?.utilidad_bruta??0),   color:((utilidad?.utilidad_bruta??0)>=0)?'text-[#4ade80]':'text-danger', accent:(utilidad?.utilidad_bruta??0)>=0?'[border-left-color:#2dda6e]':'[border-left-color:#ef4444]' },
            ] as const).map(k => (
              <Card key={k.label} className={`border-l-[3px] ${k.accent}`}>
                <CardBody>
                  <div className="text-[11px] font-bold text-text-subtle uppercase tracking-widest mb-2">{k.label}</div>
                  <div className={`text-[28px] font-black font-mono tabular-nums leading-none ${k.color}`}>{k.value}</div>
                </CardBody>
              </Card>
            ))}
            <Card className="border-l-[3px] [border-left-color:#f59e0b]">
              <CardBody>
                <div className="text-[11px] font-bold text-text-subtle uppercase tracking-widest mb-2">Mejor día</div>
                {mejor ? (
                  <>
                    <div className="text-[28px] font-black font-mono tabular-nums leading-none text-text">{fmt(mejor.total)}</div>
                    <div className="text-[11px] text-text-muted mt-1.5">
                      {new Date(mejor.fecha+'T00:00:00').toLocaleDateString('es-AR',{weekday:'short',day:'2-digit',month:'2-digit'})}
                      {' · '}{mejor.cantidad} {mejor.cantidad === 1 ? 'venta' : 'ventas'}
                    </div>
                  </>
                ) : (
                  <div className="text-[28px] font-black font-mono leading-none text-text-subtle">—</div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Top artículos + Ventas por día */}
          <div className="grid grid-cols-2 gap-5">
            <Card>
              <CardHeader>Top artículos más vendidos</CardHeader>
              <CardBody className="p-0">
                <table className="tbl">
                  <thead><tr><th>#</th><th>Artículo</th><th className="text-right">Cant.</th><th className="text-right">Total</th><th className="text-right">Ganancia</th></tr></thead>
                  <tbody>
                    {topArticulos.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-text-subtle text-[13px]">Sin datos.</td></tr> :
                    topArticulos.slice(0,10).map((a,i) => (
                      <tr key={i}>
                        <td className="text-[12px] text-text-subtle font-bold">{i+1}</td>
                        <td className="text-[13px]">{a.nombre ?? 'Ítem libre'}</td>
                        <td className="text-right font-mono text-[13px]">{a.cantidad_total}</td>
                        <td className="text-right font-mono text-[13px]">{fmt(a.importe_total)}</td>
                        <td className="text-right font-mono text-[13px] text-[#4ade80]">{fmt(a.ganancia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>Ventas por día</CardHeader>
              <CardBody>
                {ventasPorDia.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] gap-2 text-text-subtle">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                    <span className="text-[13px]">Sin datos para el período</span>
                  </div>
                ) : (
                  <div style={{ position: 'relative', height: 220 }}>
                    <canvas ref={diaChartRef} />
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Formas de pago */}
          {resumen && (
            <Card>
              <CardHeader>Ventas por forma de pago</CardHeader>
              <CardBody>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { label:'Efectivo',       value:resumen.ventas_efectivo??0,          color:'#4f8ef5' },
                    { label:'Débito',         value:resumen.ventas_debito??0,            color:'#a78bfa' },
                    { label:'Crédito',        value:resumen.ventas_credito??0,           color:'#38bdf8' },
                    { label:'Transferencia',  value:resumen.ventas_transferencia??0,     color:'#2dda6e' },
                    { label:'Cta. Cte.',      value:resumen.ventas_cuenta_corriente??0,  color:'#f59e0b' },
                  ].map(f => {
                    const pct = resumen.total_ventas > 0 ? (f.value / resumen.total_ventas * 100) : 0;
                    return (
                      <div key={f.label} className="p-4 bg-surface-2 rounded-[var(--r-in)] border border-border">
                        <div className="text-[11px] font-bold text-text-subtle uppercase tracking-wider mb-1">{f.label}</div>
                        <div className="text-[18px] font-black font-mono tabular-nums text-text">{fmt(f.value)}</div>
                        <div className="mt-2 h-1 rounded-full bg-surface-3 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: f.color }} />
                        </div>
                        <div className="text-[11px] font-semibold mt-1" style={{ color: f.color }}>{pct.toFixed(1)}%</div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Evolución mensual */}
          {ventasMes.length > 0 && (
            <Card>
              <CardHeader>Evolución mensual — Ventas y ganancia</CardHeader>
              <CardBody>
                <div style={{ position: 'relative', height: 260 }}>
                  <canvas ref={mesChartRef} />
                </div>
              </CardBody>
            </Card>
          )}

          {/* Ventas por departamento */}
          {ventasDeptos.length > 0 && (
            <Card>
              <CardHeader>Ventas por departamento</CardHeader>
              <CardBody>
                <div style={{ position: 'relative', height: Math.max(180, ventasDeptos.length * 44) }}>
                  <canvas ref={deptoChartRef} />
                </div>
              </CardBody>
            </Card>
          )}

          {/* Utilidad bruta por artículo */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <span>Utilidad bruta por artículo</span>
              <span className="text-[12px] text-text-muted font-normal">
                Total: <span className="text-[#4ade80] font-bold">{fmt(utilidad?.utilidad_bruta ?? 0)}</span>
                &nbsp;· Clic en columna para ordenar
              </span>
            </CardHeader>
            <div className="flex flex-col" style={{ height: 400 }}>
              <VirtualTable
                items={utilItems}
                estimateSize={36}
                colSpan={7}
                header={
                  <tr>
                    <th className="text-text-subtle text-[11px] w-8">#</th>
                    {sortTh('nombre', 'Artículo')}
                    <th className="text-right">Costo</th>
                    <th className="text-right">P. venta prom.</th>
                    <th className="text-right">Cant.</th>
                    {sortTh('utilidad_total', 'Utilidad', 'text-right')}
                    {sortTh('margen', 'Margen %', 'text-right')}
                  </tr>
                }
                renderRow={(it, i) => (
                  <tr key={it.codigo + i}>
                    <td className="text-[12px] text-text-subtle">{i + 1}</td>
                    <td className="text-[13px]">{it.nombre}</td>
                    <td className="text-right font-mono text-[13px] text-text-muted">{fmt(it.costo_unitario)}</td>
                    <td className="text-right font-mono text-[13px]">{fmt(it.precio_venta_promedio)}</td>
                    <td className="text-right font-mono text-[13px]">{it.cantidad_total}</td>
                    <td className="text-right font-mono text-[13px] text-[#4ade80]">{fmt(it.utilidad_total)}</td>
                    <td className="text-right font-mono text-[13px]">
                      <span className={it.margen >= 30 ? 'text-[#4ade80]' : it.margen >= 10 ? 'text-[#f59e0b]' : 'text-danger'}>
                        {fmtPct(it.margen)}
                      </span>
                    </td>
                  </tr>
                )}
                emptyState={<div className="text-center py-6 text-text-subtle text-[13px]">Sin datos.</div>}
              />
            </div>
          </Card>

        </div>
      </main>
    </div>
  );
}
