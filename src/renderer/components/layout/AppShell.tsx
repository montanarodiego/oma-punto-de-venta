import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { useSession } from '../../context/SessionContext';

export function AppShell() {
  const { session } = useSession();
  const location = useLocation();

  if (!session) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
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
  );
}
