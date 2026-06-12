import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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

// ── Aviso de integridad de DB ──────────────────────────────────────────────
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

// ── Estado de arranque ─────────────────────────────────────────────────────
type StartupStatus = 'checking' | 'no-users' | 'ready';

// Nombre del evento que Setup dispara tras crear el primer usuario,
// para que App vuelva a montar AppRoutes con status fresco.
const PRIMER_USUARIO_EVENT = 'oma:primer-usuario-creado';

// ── Rutas de la app ────────────────────────────────────────────────────────
function AppRoutes() {
  const { logout } = useSession();
  const [status, setStatus] = useState<StartupStatus>('checking');

  useEffect(() => {
    let cancelled = false;

    // Timeout de seguridad: si el IPC no responde en 4 s, arrancar en /login.
    const timer = setTimeout(() => {
      if (!cancelled) { cancelled = true; logout(); setStatus('ready'); }
    }, 4000);

    window.api.usuarios.hayUsuarios()
      .then((hay) => {
        if (cancelled) return;
        if (hay) setStatus('ready');
        else     { logout(); setStatus('no-users'); }
      })
      .catch(() => {
        if (!cancelled) { logout(); setStatus('ready'); }
      })
      .finally(() => clearTimeout(timer));

    return () => { cancelled = true; clearTimeout(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pantalla negra durante el check inicial — dura < 1 s en condiciones normales
  if (status === 'checking') return null;

  // Sin usuarios: solo onboarding. Redirect * → /setup para no quedar en blank.
  if (status === 'no-users') {
    return (
      <Routes>
        <Route path="/setup" element={<ErrorBoundary><Setup /></ErrorBoundary>} />
        <Route path="*"      element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  // Estado normal: árbol completo de rutas.
  // AppShell ya contiene el guard de sesión (→ /login si session === null).
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
        <Route path="*"               element={<Navigate to="/caja" replace />} />
      </Route>
    </Routes>
  );
}

// ── App raíz ───────────────────────────────────────────────────────────────
export default function App() {
  // Cuando Setup crea el primer usuario, dispara PRIMER_USUARIO_EVENT.
  // Incrementar routerKey desmonta y remonta AppRoutes con status fresco,
  // que ahora encontrará usuarios y renderizará las rutas completas.
  const [routerKey, setRouterKey] = useState(0);
  const bumpKey = useCallback(() => setRouterKey(k => k + 1), []);

  useEffect(() => {
    window.addEventListener(PRIMER_USUARIO_EVENT, bumpKey);
    return () => window.removeEventListener(PRIMER_USUARIO_EVENT, bumpKey);
  }, [bumpKey]);

  return (
    // ErrorBoundary envuelve TODA la app: si cualquier provider o componente
    // crashea en render, se ve un mensaje legible en lugar de pantalla negra.
    <ErrorBoundary>
      <SessionProvider>
        <ToastProvider>
          <DbIntegrityWarning />
          <UpdaterModal />
          <HashRouter>
            <AppRoutes key={routerKey} />
          </HashRouter>
        </ToastProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}

// Exportamos el nombre del evento para que Setup.tsx lo importe en vez de hardcodear el string.
export { PRIMER_USUARIO_EVENT };
