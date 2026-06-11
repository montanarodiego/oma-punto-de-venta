import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { SessionProvider, useSession } from './context/SessionContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/layout/AppShell';
import { UpdaterModal } from './components/UpdaterModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Caja from './pages/Caja';
import Catalogo from './pages/Catalogo';
import Clientes from './pages/Clientes';
import Inventario from './pages/Inventario';
import Informes from './pages/Informes';
import Proveedores from './pages/Proveedores';
import PedidosCompra from './pages/PedidosCompra';
import Turno from './pages/Turno';
import Configuracion from './pages/Configuracion';
import Comprobante from './pages/Comprobante';

function DbIntegrityWarning() {
  const [detalles, setDetalles] = useState<string[] | null>(null);

  useEffect(() => {
    window.api.db.integrityStatus()
      .then(w => { if (w) setDetalles(w.detalles); })
      .catch(() => {});
  }, []);

  if (!detalles) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-start gap-3 bg-red-950/95 border-b border-red-600 px-4 py-3 backdrop-blur-sm">
      <span className="text-red-400 text-lg mt-0.5 shrink-0">⚠</span>
      <div className="flex-1 text-sm">
        <p className="font-semibold text-red-100">Base de datos con problemas de integridad</p>
        <p className="text-red-300 mt-0.5">
          Cerrá la app, hacé un backup manual y ejecutá{' '}
          <code className="bg-red-900 px-1 rounded text-red-200">npx electron src/main/scripts/recover-db.js</code>{' '}
          antes de seguir operando.
        </p>
      </div>
      <button
        onClick={() => setDetalles(null)}
        className="text-red-500 hover:text-red-200 text-lg leading-none shrink-0 mt-0.5"
        aria-label="Cerrar aviso"
      >
        ✕
      </button>
    </div>
  );
}

function AppRoutes() {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const hay = await window.api.usuarios.hayUsuarios();
        if (!hay) {
          navigate('/setup', { replace: true });
          setReady(true);
          return;
        }
        if (session) {
          const result = await window.api.auth.setSession(session);
          if (!result?.valid) logout();
        }
      } catch { /* DB no lista aún — continuar con flujo normal */ }
      setReady(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/login"       element={<ErrorBoundary><Login /></ErrorBoundary>} />
      <Route path="/setup"       element={<ErrorBoundary><Setup /></ErrorBoundary>} />
      <Route path="/comprobante" element={<ErrorBoundary><Comprobante /></ErrorBoundary>} />
      <Route element={<AppShell />}>
        <Route index                  element={<Navigate to="/caja" replace />} />
        <Route path="/caja"           element={<ErrorBoundary><Caja /></ErrorBoundary>} />
        <Route path="/catalogo"       element={<ErrorBoundary><Catalogo /></ErrorBoundary>} />
        <Route path="/clientes"       element={<ErrorBoundary><Clientes /></ErrorBoundary>} />
        <Route path="/inventario"     element={<ErrorBoundary><Inventario /></ErrorBoundary>} />
        <Route path="/informes"       element={<ErrorBoundary><Informes /></ErrorBoundary>} />
        <Route path="/proveedores"    element={<ErrorBoundary><Proveedores /></ErrorBoundary>} />
        <Route path="/pedidos"        element={<ErrorBoundary><PedidosCompra /></ErrorBoundary>} />
        <Route path="/turno"          element={<ErrorBoundary><Turno /></ErrorBoundary>} />
        <Route path="/configuracion"  element={<ErrorBoundary><Configuracion /></ErrorBoundary>} />
        <Route path="*"              element={<Navigate to="/caja" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <DbIntegrityWarning />
        <UpdaterModal />
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
