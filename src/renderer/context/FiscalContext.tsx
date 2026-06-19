import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useToast } from './ToastContext';

interface FiscalCtx {
  modoFiscal: boolean;
  setModoFiscal: (v: boolean) => void;
  toggleFiscal: () => void;
}

const FiscalContext = createContext<FiscalCtx>({
  modoFiscal: false,
  setModoFiscal: () => {},
  toggleFiscal: () => {},
});

// Estado del "modo fiscal" persistido en la config local (clave `modo_fiscal`,
// '1'/'0'). Se togglea desde Configuración (admin) o con Ctrl+Shift+F en cualquier
// pantalla. Cuando está activo, la Caja emite factura C automáticamente al cobrar.
export function FiscalProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [modoFiscal, setEstado] = useState(false);
  const ref = useRef(false); // espejo síncrono para que el toggle no lea estado viejo

  // Carga inicial desde la base.
  useEffect(() => {
    window.api.config.get('modo_fiscal')
      .then(v => { const b = v === '1'; ref.current = b; setEstado(b); })
      .catch(() => {});
  }, []);

  const aplicar = useCallback((v: boolean, notificar: boolean) => {
    ref.current = v;
    setEstado(v);
    window.api.config.set('modo_fiscal', v ? '1' : '0').catch(() => {});
    if (notificar) showToast(v ? 'Modo fiscal ACTIVADO' : 'Modo fiscal desactivado', v ? 'ok' : 'warning');
  }, [showToast]);

  const setModoFiscal = useCallback((v: boolean) => aplicar(v, false), [aplicar]);
  const toggleFiscal  = useCallback(() => aplicar(!ref.current, true), [aplicar]);

  // Atajo global Ctrl+Shift+F (CommandOrControl en mac) desde cualquier pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyF') {
        e.preventDefault();
        toggleFiscal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFiscal]);

  return (
    <FiscalContext.Provider value={{ modoFiscal, setModoFiscal, toggleFiscal }}>
      {children}
    </FiscalContext.Provider>
  );
}

export const useFiscal = () => useContext(FiscalContext);
