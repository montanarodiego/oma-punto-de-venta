import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { useSession } from '../../context/SessionContext';
import { ModalApertura, ModalCierre } from '../TurnoModales';
import { VerificadorPrecios } from '../VerificadorPrecios';
import type { Turno } from '../../types/api';

export function AppShell() {
  const { session, logout } = useSession();
  const location = useLocation();

  const [ready, setReady]                   = useState(false);
  const [showApertura, setShowApertura]     = useState(false);
  const [showCierre, setShowCierre]         = useState(false);
  const [turnoActivo, setTurnoActivo]       = useState<Turno | null>(null);
  const [verificadorOpen, setVerificadorOpen] = useState(false);

  useEffect(() => {
    if (!window.api?.onAbrirVerificador) return;
    const unsub = window.api.onAbrirVerificador(() => setVerificadorOpen(v => !v));
    return unsub;
  }, []);

  // Verificar turno al iniciar sesión. session?.usuario como dep garantiza
  // que se re-ejecute si cambia el usuario pero no en cada re-render.
  useEffect(() => {
    if (!session) { setReady(false); return; }
    setReady(false);
    window.api.turnos.getActivo()
      .then(t => {
        setTurnoActivo(t);
        setShowApertura(!t);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [session?.usuario]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <Navigate to="/login" replace />;
  if (!ready)   return null; // sub-100 ms mientras SQLite responde

  async function requestLogout() {
    const turno = await window.api.turnos.getActivo();
    if (turno) {
      setTurnoActivo(turno);
      setShowCierre(true);
    } else {
      logout();
    }
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <Sidebar onLogout={requestLogout} />
      <div style={{ flex: 1, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            className="page-content"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      <ModalApertura
        open={showApertura}
        nombreUsuario={session.nombre ?? session.usuario}
        onAbierto={t => { setTurnoActivo(t); setShowApertura(false); }}
      />

      <ModalCierre
        open={showCierre}
        turno={turnoActivo}
        onCerrado={() => { setShowCierre(false); logout(); }}
        onVolver={() => setShowCierre(false)}
      />

      <VerificadorPrecios
        open={verificadorOpen}
        onClose={() => setVerificadorOpen(false)}
      />
    </div>
  );
}
