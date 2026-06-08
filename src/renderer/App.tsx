import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { SessionProvider } from './context/SessionContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/layout/AppShell';
import { UpdaterModal } from './components/UpdaterModal';
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
            <Route path="/login"       element={<Login />} />
            <Route path="/comprobante" element={<Comprobante />} />
            <Route element={<AppShell />}>
              <Route index                  element={<Navigate to="/caja" replace />} />
              <Route path="/caja"           element={<Caja />} />
              <Route path="/catalogo"       element={<Catalogo />} />
              <Route path="/clientes"       element={<Clientes />} />
              <Route path="/inventario"     element={<Inventario />} />
              <Route path="/informes"       element={<Informes />} />
              <Route path="/proveedores"    element={<Proveedores />} />
              <Route path="/pedidos"        element={<PedidosCompra />} />
              <Route path="/turno"          element={<Turno />} />
              <Route path="/configuracion"  element={<Configuracion />} />
              <Route path="*"              element={<Navigate to="/caja" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
