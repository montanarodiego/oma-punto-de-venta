import { createContext, useContext, useState } from 'react';
import type { Session } from '../types/api';

interface SessionCtx {
  session: Session | null;
  setSession: (s: Session | null) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionCtx>({
  session: null, setSession: () => {}, logout: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Sesión solo en memoria — no persiste al cerrar la app (requerimiento explícito).
  const [session, setSessionState] = useState<Session | null>(null);

  const setSession = (s: Session | null) => {
    setSessionState(s);
    // Sincroniza el rol al proceso main para que onlyAdmin() funcione.
    window.api.auth.setSession(s);
  };

  const logout = () => setSession(null);

  return (
    <SessionContext.Provider value={{ session, setSession, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
