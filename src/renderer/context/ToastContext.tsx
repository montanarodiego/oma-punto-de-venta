import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'ok' | 'error' | 'warning';
interface Toast { id: number; msg: string; type: ToastType; }

interface ToastCtx { showToast: (msg: string, type?: ToastType) => void; }
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((msg: string, type: ToastType = 'ok') => {
    const id = ++counter.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast show ${t.type === 'error' ? 'toast-error' : t.type === 'warning' ? '' : 'toast-success'}`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
