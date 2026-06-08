import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import { useNavigateGlobal } from '../../hooks/useNavigateGlobal';

const TABS = [
  { route: '/caja',          label: 'Caja',          key: 'F1', icon: <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
  { route: '/catalogo',      label: 'Catálogo',      key: 'F2', icon: <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
  { route: '/inventario',    label: 'Inventario',    key: 'F3', icon: <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { route: '/clientes',      label: 'Clientes',      key: 'F4', icon: <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { route: '/proveedores',   label: 'Proveedores',   key: 'F5', icon: <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
  { route: '/pedidos',       label: 'Pedidos',       key: '',   icon: <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg> },
  { route: '/informes',      label: 'Informes',      key: 'F6', icon: <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
  { route: '/turno',         label: 'Turno',         key: 'F7', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { route: '/configuracion', label: 'Configuración', key: 'F8', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout } = useSession();
  const { showToast } = useToast();
  const [syncBadge, setSyncBadge]   = useState(0);
  const [syncDetalle, setSyncDetalle] = useState<{ articulos: number; clientes: number; transacciones: number } | null>(null);
  const [syncTooltip, setSyncTooltip] = useState(false);
  const [reporteOpen, setReporteOpen] = useState(false);

  useNavigateGlobal();

  useEffect(() => {
    async function poll() {
      try {
        const [total, detalle] = await Promise.all([
          window.api.sync.contarPendientes(),
          window.api.sync.detallePendientes(),
        ]);
        setSyncBadge(total);
        setSyncDetalle(detalle);
      } catch {}
    }
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, []);

  async function handleLogout() {
    const turno = await window.api.turnos.getActivo();
    if (turno) {
      showToast('Cerrá el turno antes de salir.', 'error');
      navigate('/turno');
      return;
    }
    logout();
    navigate('/login');
  }

  const avatar = session?.nombre?.[0]?.toUpperCase() ?? '?';
  const rolLabel = session?.rol === 'admin' ? 'Administrador' : 'Cajero';

  return (
    <nav
      style={{ width: 'var(--sidebar-w)', minWidth: 'var(--sidebar-w)' }}
      className="bg-surface border-r border-border flex flex-col overflow-hidden h-screen flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white font-black text-sm flex-shrink-0">O</div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-text leading-tight">OmaTech POS</div>
          {syncBadge > 0 && (
            <div
              className="relative inline-block"
              onMouseEnter={() => setSyncTooltip(true)}
              onMouseLeave={() => setSyncTooltip(false)}
            >
              <div className="text-[10px] text-yellow-400 font-semibold cursor-default select-none">
                ⟳ {syncBadge} pendiente{syncBadge !== 1 ? 's' : ''}
              </div>
              {syncTooltip && syncDetalle && (
                <div className="absolute left-0 top-full mt-1 z-[200] bg-[#1e293b] border border-[#334155] rounded-[6px] shadow-lg p-2.5 text-[11px] whitespace-nowrap leading-5">
                  {syncDetalle.articulos > 0 && (
                    <div className="text-text-muted">
                      <span className="text-text font-semibold">{syncDetalle.articulos}</span> artículo{syncDetalle.articulos !== 1 ? 's' : ''}
                    </div>
                  )}
                  {syncDetalle.clientes > 0 && (
                    <div className="text-text-muted">
                      <span className="text-text font-semibold">{syncDetalle.clientes}</span> cliente{syncDetalle.clientes !== 1 ? 's' : ''}
                    </div>
                  )}
                  {syncDetalle.transacciones > 0 && (
                    <div className="text-text-muted">
                      <span className="text-text font-semibold">{syncDetalle.transacciones}</span> transacción{syncDetalle.transacciones !== 1 ? 'es' : ''}
                    </div>
                  )}
                  <div className="mt-1.5 pt-1.5 border-t border-[#334155] text-text-subtle text-[10px]">
                    sin sincronizar con la nube
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {TABS.map(tab => {
          const active = location.pathname === tab.route || (tab.route === '/caja' && location.pathname === '/');
          return (
            <button
              key={tab.route}
              className={`nav-tab ${active ? 'active' : ''}`}
              onClick={() => navigate(tab.route)}
            >
              {tab.icon}
              <span className="flex-1">{tab.label}</span>
              {tab.key && <span className="nav-key">{tab.key}</span>}
            </button>
          );
        })}
      </div>

      {/* User + actions */}
      <div className="border-t border-border p-3 flex flex-col gap-2">
        {/* User chip */}
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 ${session?.rol === 'admin' ? 'bg-[#6366f1]' : 'bg-accent'}`}>
            {avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-text truncate">{session?.nombre ?? session?.usuario}</div>
            <div className="text-[10px] text-text-subtle">{rolLabel}</div>
          </div>
        </div>

        {/* Reportar + Salir */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setReporteOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[var(--r-in)] text-[11px] font-medium text-text-subtle border border-border bg-transparent hover:bg-surface-2 hover:text-text-muted transition-all duration-[130ms]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Reportar
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[var(--r-in)] text-[11px] font-medium text-text-subtle border border-border bg-transparent hover:bg-surface-2 hover:text-text-muted transition-all duration-[130ms]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>

      <ReporteModal open={reporteOpen} onClose={() => setReporteOpen(false)} nombre={session?.nombre ?? ''} currentPath={location.pathname} />
    </nav>
  );
}

const REPORTE_PATH_MAP: Record<string, string> = {
  '/caja': 'Caja', '/catalogo': 'Catálogo', '/inventario': 'Inventario',
  '/clientes': 'Clientes', '/proveedores': 'Proveedores', '/pedidos': 'Pedidos',
  '/informes': 'Informes', '/turno': 'Turno', '/configuracion': 'Configuración',
};

function ReporteModal({ open, onClose, nombre, currentPath }: { open: boolean; onClose: () => void; nombre: string; currentPath: string }) {
  const { showToast } = useToast();
  const [tipo, setTipo] = useState('Error en la app');
  const [modulo, setModulo] = useState('');
  const [desc, setDesc] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setModulo(REPORTE_PATH_MAP[currentPath] ?? 'Otro');
      setDesc(''); setDone(false);
    }
  }, [open, currentPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim()) return;
    setSending(true);
    try {
      const res = await window.api.soporte.enviarReporte({ tipo, modulo, descripcion: desc, nombre });
      if (res.ok) { setDone(true); setTimeout(onClose, 2500); }
      else showToast('No se pudo enviar: ' + res.error, 'error');
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally { setSending(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-[rgba(15,23,42,.85)] flex items-center justify-center p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] w-full max-w-[420px]">
        <div className="modal-header">
          <h3 className="modal-title">Reportar un problema</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {done ? (
          <div className="modal-body flex flex-col items-center gap-3 text-center py-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <p className="text-[14px] text-text">¡Reporte enviado! El equipo de OmaTech lo revisará pronto.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body flex flex-col gap-4">
              <div className="field"><label className="field-label">Tipo</label>
                <select className="inp" value={tipo} onChange={e => setTipo(e.target.value)}>
                  <option>Error en la app</option><option>Algo no funciona bien</option>
                  <option>Sugerencia de mejora</option><option>Otro</option>
                </select>
              </div>
              <div className="field"><label className="field-label">Módulo</label>
                <select className="inp" value={modulo} onChange={e => setModulo(e.target.value)}>
                  {['Caja','Catálogo','Inventario','Clientes','Proveedores','Informes','Turno','Configuración','Otro'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="field"><label className="field-label">Descripción <span className="text-danger">*</span></label>
                <textarea className="inp" rows={4} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describí el problema con el mayor detalle posible" required />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" disabled={sending} className="btn btn-primary">
                {sending ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
