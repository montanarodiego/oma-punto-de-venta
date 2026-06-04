import { useState, useEffect } from 'react';

function fmt(n: number) { return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2}).format(n??0); }
function fmtFecha(s: string) { return s ? new Date(s.replace(' ','T')+'Z').toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; }

export default function Comprobante() {
  const [trans, setTrans] = useState<any>(null);
  const [config, setConfig] = useState<Record<string,string>>({});
  const [montoRec, setMontoRec] = useState(0);
  const [vuelto, setVuelto] = useState(0);
  const [propina, setPropina] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hash = window.location.hash.split('?')[1] ?? '';
    const params = new URLSearchParams(hash);
    const id = params.get('id') ? Number(params.get('id')) : null;
    setMontoRec(parseFloat(params.get('recibido')??'0')||0);
    setVuelto(parseFloat(params.get('vuelto')??'0')||0);
    setPropina(parseFloat(params.get('propina')??'0')||0);

    if (!id) { setLoading(false); return; }
    Promise.all([window.api.transacciones.getById(id), window.api.config.getAll()])
      .then(([t, cfg]) => { setTrans(t); setConfig(cfg); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-text-subtle text-sm">Cargando...</div>;
  if (!trans) return <div className="flex items-center justify-center h-full text-text-subtle text-sm">Comprobante no encontrado.</div>;

  const detalle = trans.detalle ?? [];
  const formaMap: Record<string,string> = { efectivo:'Efectivo', tarjeta_debito:'Débito', tarjeta_credito:'Crédito', transferencia:'Transferencia', cuenta_corriente:'Cta. Cte.' };

  return (
    <div className="min-h-screen bg-bg flex items-start justify-center p-4 pt-8">
      <div style={{ width: 320, fontFamily: 'monospace' }} className="bg-white text-black text-[12px]">
        <div className="text-center pb-2 border-b border-black">
          <div className="font-bold text-[16px]">{config.nombre_negocio || 'OmaTech POS'}</div>
          {config.direccion && <div>{config.direccion}</div>}
          {config.telefono && <div>Tel: {config.telefono}</div>}
          {config.cuit && <div>CUIT: {config.cuit}</div>}
        </div>
        <div className="py-2 border-b border-dashed border-black text-center">
          <div className="font-bold">COMPROBANTE DE VENTA</div>
          <div>N° {trans.id}</div>
          <div>{fmtFecha(trans.created_at)}</div>
        </div>
        <div className="py-2 border-b border-dashed border-black">
          {detalle.map((d: any, i: number) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="flex-1">{d.descripcion_libre || d.nombre || '—'}</span>
              <span className="text-right flex-shrink-0">{d.cantidad} x {fmt(d.precio_al_momento)}</span>
              <span className="text-right flex-shrink-0 font-bold">{fmt(d.importe_total)}</span>
            </div>
          ))}
        </div>
        <div className="py-2 border-b border-black">
          {trans.descuento_global > 0 && <div className="flex justify-between"><span>Descuento</span><span>-{fmt(trans.descuento_global)}</span></div>}
          <div className="flex justify-between font-bold text-[14px]"><span>TOTAL</span><span>{fmt(trans.monto_total)}</span></div>
          <div className="flex justify-between text-[11px]"><span>{formaMap[trans.forma_pago]??trans.forma_pago}</span></div>
          {trans.forma_pago_2 && <div className="flex justify-between text-[11px]"><span>{formaMap[trans.forma_pago_2]??trans.forma_pago_2}</span><span>{fmt(trans.monto_pago_2)}</span></div>}
          {montoRec > 0 && <div className="flex justify-between text-[11px]"><span>Recibido</span><span>{fmt(montoRec)}</span></div>}
          {vuelto > 0 && <div className="flex justify-between text-[11px] font-bold"><span>Vuelto</span><span>{fmt(vuelto)}</span></div>}
          {propina > 0 && <div className="flex justify-between text-[11px]"><span>Propina</span><span>{fmt(propina)}</span></div>}
        </div>
        {config.mensaje_ticket && (
          <div className="text-center py-2 text-[11px] italic">{config.mensaje_ticket}</div>
        )}
        <div className="text-center text-[10px] py-1">Gracias por su compra</div>

        {/* Botones */}
        <div className="flex gap-2 mt-4 no-print">
          <button onClick={() => window.print()} className="flex-1 py-2 bg-accent text-white text-[12px] font-semibold rounded">Imprimir</button>
          <button onClick={() => window.close()} className="flex-1 py-2 bg-surface-2 text-text text-[12px] font-semibold rounded border border-border">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
