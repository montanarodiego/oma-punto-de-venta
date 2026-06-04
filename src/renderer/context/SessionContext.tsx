import { createContext, useContext, useEffect, useState } from 'react';
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
  const [session, setSessionState] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem('oma_session');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const setSession = (s: Session | null) => {
    setSessionState(s);
    if (s) {
      localStorage.setItem('oma_session', JSON.stringify(s));
      window.SESSION = s;
    } else {
      localStorage.removeItem('oma_session');
      window.SESSION = undefined;
    }
  };

  const logout = () => setSession(null);

  useEffect(() => {
    if (session) window.SESSION = session;
  }, []);

  return (
    <SessionContext.Provider value={{ session, setSession, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
