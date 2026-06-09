import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { SessionProvider } from './context/SessionContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/layout/AppShell';
import { UpdaterModal } from './components/UpdaterModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './pages/Login';
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

export default function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <UpdaterModal />
        <HashRouter>
          <Routes>
            <Route path="/login"       element={<ErrorBoundary><Login /></ErrorBoundary>} />
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
        </HashRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
