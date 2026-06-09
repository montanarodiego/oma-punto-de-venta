import { useState } from 'react';
import { ModalOverlay, ModalBox } from './ui';

interface ModalMovimientoProps {
  turnoActivo: any;
  onClose: () => void;
  onDone: () => void;
}

export function ModalMovimiento({ turnoActivo, onClose, onDone }: ModalMovimientoProps) {
  const [tipo,      setTipo]      = useState<'entrada'|'salida'>('entrada');
  const [categoria, setCategoria] = useState('fondo_cambio');
  const [monto,     setMonto]     = useState('');
  const [desc,      setDesc]      = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

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
      await window.api.movimientos.registrar({ turnoId: turnoActivo.id, tipo, categoria, monto: m, descripcion: desc.trim() || categoria });
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
