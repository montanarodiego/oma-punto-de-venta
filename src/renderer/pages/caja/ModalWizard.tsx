import { motion } from 'framer-motion';
import { WIZARD_MODOS } from './types';

interface ModalWizardProps {
  open: boolean;
  onSelect: (id: string) => void;
}

export function ModalWizard({ open, onSelect }: ModalWizardProps) {
  if (!open) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-[rgba(15,23,42,.97)] flex items-center justify-center p-5"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <div className="max-w-[800px] w-full bg-[#1e293b] border border-[#334155] rounded-2xl p-8 flex flex-col gap-6">
        <div className="text-center">
          <div className="text-[22px] font-bold text-[#f1f5f9] mb-2">¿Qué tipo de negocio es?</div>
          <div className="text-[13px] text-[#94a3b8]">Elegí el modo que mejor describe tu comercio. Podés cambiarlo desde Configuración.</div>
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          {WIZARD_MODOS.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
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
  );
}
