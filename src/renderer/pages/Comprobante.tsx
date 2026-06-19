import { useState, useEffect } from 'react';
import type { ComprobanteFiscal } from '../types/api';

function fmt(n: number) { return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2}).format(n??0); }
function fmtFecha(s: string) { return s ? new Date(s.replace(' ','T')+'Z').toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; }
function fmtVto(yyyymmdd: string) { return /^\d{8}$/.test(yyyymmdd) ? `${yyyymmdd.slice(6,8)}/${yyyymmdd.slice(4,6)}/${yyyymmdd.slice(0,4)}` : yyyymmdd; }

function letra(tipo: number) {
  if ([1,2,3].includes(tipo)) return 'A';
  if ([6,7,8].includes(tipo)) return 'B';
  if ([11,12,13].includes(tipo)) return 'C';
  return '';
}
const TIPO_NOMBRE: Record<number,string> = { 1:'Factura A', 6:'Factura B', 11:'Factura C', 2:'Nota Débito A', 7:'Nota Débito B', 12:'Nota Débito C', 3:'Nota Crédito A', 8:'Nota Crédito B', 13:'Nota Crédito C' };
const DOC_NOMBRE: Record<number,string> = { 80:'CUIT', 86:'CUIL', 96:'DNI', 99:'Consumidor Final' };

export default function Comprobante() {
  const [trans, setTrans] = useState<any>(null);
  const [config, setConfig] = useState<Record<string,string>>({});
  const [fiscal, setFiscal] = useState<ComprobanteFiscal | null>(null);
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
    Promise.all([
      window.api.transacciones.getById(id),
      window.api.config.getAll(),
      window.api.facturacion.porTransaccion(id).catch(() => ({ ok: false } as const)),
    ])
      .then(([t, cfg, f]) => { setTrans(t); setConfig(cfg); if (f.ok) setFiscal(f.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-text-subtle text-sm">Cargando...</div>;
  if (!trans) return <div className="flex items-center justify-center h-full text-text-subtle text-sm">Comprobante no encontrado.</div>;

  const detalle = trans.detalle ?? [];
  const formaMap: Record<string,string> = { efectivo:'Efectivo', tarjeta_debito:'Débito', tarjeta_credito:'Crédito', transferencia:'Transferencia', cuenta_corriente:'Cta. Cte.' };
  const esFiscal = !!fiscal;
  const homolog = esFiscal && fiscal!.ambiente !== 'produccion';
  const nroFmt = esFiscal ? `${String(fiscal!.pto_venta).padStart(4,'0')}-${String(fiscal!.cbte_nro).padStart(8,'0')}` : `N° ${trans.id}`;

  return (
    <div className="min-h-screen bg-bg flex items-start justify-center p-4 pt-8">
      <div style={{ width: 320, fontFamily: 'monospace' }} className="bg-white text-black text-[12px] shadow-2xl">
        {/* Cabecera del negocio */}
        <div className="text-center pb-2 border-b border-black relative">
          {esFiscal && (
            <div className="absolute right-0 top-0 w-12 h-12 border-2 border-black flex flex-col items-center justify-center leading-none bg-white">
              <span className="text-[26px] font-extrabold">{letra(fiscal!.cbte_tipo)}</span>
              <span className="text-[7px] font-bold">COD {String(fiscal!.cbte_tipo).padStart(2,'0')}</span>
            </div>
          )}
          <div className="font-bold text-[16px]">{config.nombre_negocio || 'OmaTech POS'}</div>
          {config.direccion && <div>{config.direccion}</div>}
          {config.telefono && <div>Tel: {config.telefono}</div>}
          {config.cuit && <div>CUIT: {config.cuit}</div>}
        </div>

        {/* Tipo de comprobante */}
        <div className="py-2 border-b border-dashed border-black text-center">
          <div className="font-bold">{esFiscal ? (TIPO_NOMBRE[fiscal!.cbte_tipo] || 'Comprobante').toUpperCase() : 'COMPROBANTE DE VENTA'}</div>
          <div>{esFiscal ? `Comp. ${nroFmt}` : nroFmt}</div>
          <div>{fmtFecha(trans.created_at)}</div>
        </div>

        {/* Receptor (sólo fiscal) */}
        {esFiscal && (
          <div className="py-1.5 border-b border-dashed border-black text-[11px]">
            <div className="flex justify-between"><span>Receptor:</span><span>{DOC_NOMBRE[fiscal!.doc_tipo] || 'Doc'}</span></div>
            {fiscal!.doc_tipo !== 99 && <div className="flex justify-between"><span>Nro:</span><span>{fiscal!.doc_nro}</span></div>}
          </div>
        )}

        {/* Detalle */}
        <div className="py-2 border-b border-dashed border-black">
          {detalle.map((d: any, i: number) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="flex-1">{d.descripcion_libre || d.nombre || '—'}</span>
              <span className="text-right flex-shrink-0">{d.cantidad} x {fmt(d.precio_al_momento)}</span>
              <span className="text-right flex-shrink-0 font-bold">{fmt(d.importe_total)}</span>
            </div>
          ))}
        </div>

        {/* Totales */}
        <div className="py-2 border-b border-black">
          {esFiscal && fiscal!.imp_iva > 0 && (
            <>
              <div className="flex justify-between text-[11px]"><span>Neto gravado</span><span>{fmt(fiscal!.imp_neto)}</span></div>
              <div className="flex justify-between text-[11px]"><span>IVA</span><span>{fmt(fiscal!.imp_iva)}</span></div>
            </>
          )}
          {trans.descuento_global > 0 && <div className="flex justify-between"><span>Descuento</span><span>-{fmt(trans.descuento_global)}</span></div>}
          <div className="flex justify-between font-bold text-[14px]"><span>TOTAL</span><span>{fmt(trans.monto_total)}</span></div>
          <div className="flex justify-between text-[11px]"><span>{formaMap[trans.forma_pago]??trans.forma_pago}</span></div>
          {trans.forma_pago_2 && <div className="flex justify-between text-[11px]"><span>{formaMap[trans.forma_pago_2]??trans.forma_pago_2}</span><span>{fmt(trans.monto_pago_2)}</span></div>}
          {montoRec > 0 && <div className="flex justify-between text-[11px]"><span>Recibido</span><span>{fmt(montoRec)}</span></div>}
          {vuelto > 0 && <div className="flex justify-between text-[11px] font-bold"><span>Vuelto</span><span>{fmt(vuelto)}</span></div>}
          {propina > 0 && <div className="flex justify-between text-[11px]"><span>Propina</span><span>{fmt(propina)}</span></div>}
        </div>

        {/* Bloque fiscal: CAE + QR */}
        {esFiscal && (
          <div className="py-2 border-b border-dashed border-black">
            {homolog && (
              <div className="text-center text-[10px] font-bold text-red-600 border border-red-600 mb-2 py-0.5">
                HOMOLOGACIÓN — SIN VALOR FISCAL
              </div>
            )}
            <div className="flex items-center gap-2">
              {fiscal!.qrImage && <img src={fiscal!.qrImage} alt="QR AFIP" width={92} height={92} className="flex-shrink-0" />}
              <div className="text-[10px] leading-tight">
                <div className="font-bold">CAE N°</div>
                <div className="mb-1">{fiscal!.cae}</div>
                <div className="font-bold">Vto. CAE</div>
                <div>{fmtVto(fiscal!.cae_vto)}</div>
              </div>
            </div>
            <div className="text-center text-[9px] mt-1 text-gray-600">Comprobante autorizado · ARCA</div>
          </div>
        )}

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
