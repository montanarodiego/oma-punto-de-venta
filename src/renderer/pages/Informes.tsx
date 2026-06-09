import { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from '../components/ui';
import type { ResumenRapido, ArticuloVendido, VentaDia, UtilidadBrutaResult } from '../types/api';

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
  const [loading, setLoading] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const [r, top, util, dias] = await Promise.all([
      window.api.informes.resumenRapido(desde, hasta),
      window.api.informes.articulosMasVendidos(desde, hasta),
      window.api.informes.utilidadBruta(desde, hasta),
      window.api.informes.ventasPorDia(desde, hasta),
    ]);
    setResumen(r); setTopArticulos(top ?? []); setUtilidad(util); setVentasPorDia(dias ?? []);
    setLoading(false);
  }

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
          <div className="grid grid-cols-4 gap-4">
            {[
              { label:'Ventas totales',      value:fmt(resumen?.total_ventas??0),        color:'text-text' },
              { label:'Cantidad de ventas',  value:String(resumen?.cantidad_ventas??0),  color:'text-text' },
              { label:'Ticket promedio',     value:fmt(resumen?.ticket_promedio??0),     color:'text-accent' },
              { label:'Utilidad bruta',      value:fmt(utilidad?.utilidad_bruta??0),    color:((utilidad?.utilidad_bruta??0)>=0)?'text-[#4ade80]':'text-danger' },
            ].map(k => (
              <Card key={k.label}>
                <CardBody>
                  <div className="text-[11px] font-bold text-text-subtle uppercase tracking-widest mb-2">{k.label}</div>
                  <div className={`text-[28px] font-black font-mono tabular-nums leading-none ${k.color}`}>{k.value}</div>
                </CardBody>
              </Card>
            ))}
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
              <CardBody className="p-0">
                <table className="tbl">
                  <thead><tr><th>Fecha</th><th className="text-right">Ventas</th><th className="text-right">Monto</th><th className="text-right">Ganancia</th></tr></thead>
                  <tbody>
                    {ventasPorDia.length === 0 ? <tr><td colSpan={4} className="text-center py-6 text-text-subtle text-[13px]">Sin datos.</td></tr> :
                    ventasPorDia.map((d,i) => (
                      <tr key={i}>
                        <td className="text-[12px]">{new Date(d.fecha+'T00:00:00').toLocaleDateString('es-AR',{weekday:'short',day:'2-digit',month:'2-digit'})}</td>
                        <td className="text-right font-mono text-[13px]">{d.cantidad}</td>
                        <td className="text-right font-mono text-[13px] font-semibold">{fmt(d.monto_total)}</td>
                        <td className="text-right font-mono text-[13px] text-[#4ade80]">{fmt(d.ganancia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    { label:'Efectivo', value:resumen.ventas_efectivo??0 },
                    { label:'Débito', value:resumen.ventas_debito??0 },
                    { label:'Crédito', value:resumen.ventas_credito??0 },
                    { label:'Transferencia', value:resumen.ventas_transferencia??0 },
                    { label:'Cta. Cte.', value:resumen.ventas_cuenta_corriente??0 },
                  ].map(f => (
                    <div key={f.label} className="text-center p-4 bg-surface-2 rounded-[var(--r-in)]">
                      <div className="text-[11px] font-bold text-text-subtle uppercase tracking-wider mb-2">{f.label}</div>
                      <div className="text-[20px] font-black font-mono tabular-nums">{fmt(f.value)}</div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
