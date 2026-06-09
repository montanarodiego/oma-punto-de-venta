import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export function ToolbarBtn({ icon, label, kbd, onClick, variant, active, disabled }: {
  icon: React.ReactNode; label: string; kbd?: string; onClick?: () => void;
  variant?: 'default'|'danger'|'success'|'warning'; active?: boolean; disabled?: boolean;
}) {
  const base = 'flex items-center gap-1.5 px-3 h-10 rounded-[var(--r)] border text-[13px] font-semibold transition-all cursor-pointer font-[inherit] disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    default: active ? 'bg-[rgba(79,142,245,.12)] border-accent text-accent' : 'bg-surface-2 border-[var(--surface-3)] text-text-muted hover:bg-surface-3 hover:text-text hover:border-[#475569]',
    danger:  'bg-[rgba(239,68,68,.08)] border-[rgba(239,68,68,.3)] text-danger hover:bg-[rgba(239,68,68,.18)]',
    success: 'bg-success border-success-hover text-white font-bold hover:bg-success-hover',
    warning: active ? 'bg-[rgba(245,158,11,.18)] border-[rgba(245,158,11,.5)] text-[#fbbf24]' : 'bg-[rgba(245,158,11,.08)] border-[rgba(245,158,11,.25)] text-[#f59e0b] hover:bg-[rgba(245,158,11,.18)]',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant ?? 'default']}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">{icon}</svg>
      {label}
      {kbd && <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border border-current/20 bg-black/30 opacity-60">{kbd}</span>}
    </button>
  );
}

export function PieStat({ label, value, size, muted, color }: { label: string; value: string; size?: 'lg'; muted?: boolean; color?: string }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-text-subtle">{label}</div>
      <div
        className={`font-mono tabular-nums leading-none ${
          size === 'lg'
            ? 'text-[26px] font-black text-text'
            : 'text-[15px] font-bold'
        } ${muted ? 'text-text-muted' : ''}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

export function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-[rgba(15,23,42,.85)] flex items-center justify-center p-5"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {children}
    </motion.div>
  );
}

export function ModalBox({ title, onClose, children, maxWidth = 460 }: { title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(boxRef, true, onClose);
  return (
    <motion.div
      ref={boxRef}
      data-modal
      initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
      className="bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] w-full"
      style={{ maxWidth }}
    >
      <div className="modal-header">
        <h3 className="modal-title">{title}</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">{children}</div>
    </motion.div>
  );
}
