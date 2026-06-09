import type { Ticket } from './types';
import { MAX_TICKETS } from './types';

interface TicketTabsProps {
  tickets: Ticket[];
  activeIdx: number;
  onSwitch: (idx: number) => void;
  onClose:  (idx: number) => void;
  onNew:    () => void;
  mayoreoMode: boolean;
}

export function TicketTabs({ tickets, activeIdx, onSwitch, onClose, onNew, mayoreoMode }: TicketTabsProps) {
  return (
    <div className="flex items-center gap-1 px-2 pt-1.5 bg-bg border-b border-border flex-shrink-0 overflow-x-auto min-h-[42px]">
      {tickets.map((t, i) => (
        <button
          key={t.id}
          onClick={() => onSwitch(i)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md border border-b-0 text-[13px] font-medium transition-all ${
            i === activeIdx
              ? 'bg-surface text-text border-border'
              : 'bg-transparent text-text-muted border-transparent hover:bg-surface-2'
          }`}
        >
          {t.nombre}
          {t.carrito.length > 0 && (
            <span className="text-[11px] font-bold px-1.5 rounded-full bg-accent/20 text-accent min-w-[18px] text-center">
              {t.carrito.length}
            </span>
          )}
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onClose(i); }}
            className="text-text-subtle hover:text-danger ml-0.5 opacity-60 hover:opacity-100 text-[14px] leading-none cursor-pointer"
          >×</span>
        </button>
      ))}
      {tickets.length < MAX_TICKETS && (
        <button
          onClick={onNew}
          className="px-2.5 py-1.5 text-text-subtle hover:text-text text-[16px] leading-none opacity-60 hover:opacity-100 border border-dashed border-border rounded hover:bg-surface-2 transition-all"
          title="Nuevo ticket (Ctrl+T)"
        >+</button>
      )}
      <div className="flex-1" />
      {mayoreoMode && (
        <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-[rgba(139,92,246,.15)] text-[#a78bfa] font-bold mr-1 tracking-wider">
          MAYOREO
        </span>
      )}
    </div>
  );
}
