import { AnimatePresence } from 'framer-motion';
import type { CartItem, Ticket } from './types';
import { ModalOverlay, ModalBox } from './ui';

// ── Modal ítem libre ────────────────────────────────────────────────────────

interface ModalLibreProps {
  open: boolean; onClose: () => void;
  desc: string; precio: string; cant: string;
  setDesc: (v: string) => void; setPrecio: (v: string) => void; setCant: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ModalLibre({ open, onClose, desc, precio, cant, setDesc, setPrecio, setCant, onSubmit }: ModalLibreProps) {
  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={onClose}>
          <ModalBox title="Ítem libre" onClose={onClose} maxWidth={380}>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="field"><label className="field-label">Descripción <span className="text-danger">*</span></label>
                <input autoFocus className="inp" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Coca Cola 500ml" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field"><label className="field-label">Precio <span className="text-danger">*</span></label>
                  <input className="inp" type="number" step="0.01" min="0.01" value={precio} onChange={e => setPrecio(e.target.value)} required />
                </div>
                <div className="field"><label className="field-label">Cantidad</label>
                  <input className="inp" type="number" step="any" min="0.001" value={cant} onChange={e => setCant(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer px-0 pb-0">
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agregar al carrito</button>
              </div>
            </form>
          </ModalBox>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

// ── Modal descuento ítem ────────────────────────────────────────────────────

interface ModalDescItemProps {
  open: boolean; onClose: () => void;
  itemNombre: string | undefined;
  tipo: 'pct' | 'monto'; val: string;
  setTipo: (t: 'pct' | 'monto') => void; setVal: (v: string) => void;
  onApply: () => void; onRemove: () => void;
}

export function ModalDescItem({ open, onClose, itemNombre, tipo, val, setTipo, setVal, onApply, onRemove }: ModalDescItemProps) {
  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={onClose}>
          <ModalBox title="Aplicar descuento" onClose={onClose} maxWidth={360}>
            <div className="flex flex-col gap-4">
              <div className="text-[13px] text-text-muted">{itemNombre}</div>
              <div className="flex gap-2">
                <button className={`flex-1 py-2 rounded-[var(--r-in)] border text-[12px] font-semibold transition-all ${tipo==='pct' ? 'bg-[#ca8a04] text-white border-[#ca8a04]' : 'border-border text-text-muted bg-transparent'}`} onClick={() => setTipo('pct')}>Porcentaje (%)</button>
                <button className={`flex-1 py-2 rounded-[var(--r-in)] border text-[12px] font-semibold transition-all ${tipo==='monto' ? 'bg-[#ca8a04] text-white border-[#ca8a04]' : 'border-border text-text-muted bg-transparent'}`} onClick={() => setTipo('monto')}>Monto fijo ($)</button>
              </div>
              <div className="field">
                <label className="field-label">{tipo === 'pct' ? 'Porcentaje' : 'Monto'} de descuento</label>
                <input autoFocus className="inp" type="number" min="0" step="0.01" value={val} onChange={e => setVal(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer px-0 pb-0 mt-4">
              <button className="btn btn-ghost text-danger mr-auto" onClick={onRemove}>Quitar descuento</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={onApply}>Aplicar</button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

// ── Modal renombrar ticket ──────────────────────────────────────────────────

interface ModalRenombrarProps {
  open: boolean; onClose: () => void;
  val: string; setVal: (v: string) => void;
  onApply: () => void;
}

export function ModalRenombrar({ open, onClose, val, setVal, onApply }: ModalRenombrarProps) {
  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={onClose}>
          <ModalBox title="Nombre del ticket" onClose={onClose} maxWidth={320}>
            <input autoFocus className="inp" value={val} onChange={e => setVal(e.target.value)} maxLength={30} onKeyDown={e => e.key === 'Enter' && onApply()} />
            <div className="modal-footer px-0 pb-0 mt-4">
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={onApply}>Aceptar</button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

// ── Modal editor de cantidad (*) ────────────────────────────────────────────

interface ModalQtyEditorProps {
  open: boolean; onClose: () => void;
  itemNombre: string | undefined;
  val: string; setVal: (v: string) => void;
  onConfirm: () => void;
}

export function ModalQtyEditor({ open, onClose, itemNombre, val, setVal, onConfirm }: ModalQtyEditorProps) {
  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={onClose}>
          <ModalBox title="Cantidad" onClose={onClose} maxWidth={280}>
            <form onSubmit={e => { e.preventDefault(); onConfirm(); }} className="flex flex-col gap-4">
              {itemNombre && <div className="text-[13px] text-text-muted truncate">{itemNombre}</div>}
              <input autoFocus type="number" step="any" min="0.001" value={val} onChange={e => setVal(e.target.value)} className="inp text-[22px] font-bold font-mono text-center" />
              <div className="modal-footer px-0 pb-0">
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Aceptar</button>
              </div>
            </form>
          </ModalBox>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
