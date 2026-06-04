import { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '../context/SessionContext';

type View = 'local' | 'firebase' | 'reset-email' | 'reset-code' | 'reset-pass';

export default function Login() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('local');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // local login fields
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');

  // firebase fields
  const [email, setEmail] = useState('');
  const [fbPass, setFbPass] = useState('');

  // reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetCodigo, setResetCodigo] = useState('');
  const [resetPass, setResetPass] = useState('');
  const [resetPass2, setResetPass2] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, [view]);

  if (session) return <Navigate to="/caja" replace />;

  async function handleLocalLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await window.api.usuarios.login(usuario, password) as any;
      if (res.ok && res.user) {
        setSession(res.user);
        navigate('/caja', { replace: true });
      } else {
        setError(res.error ?? 'Usuario o contraseña incorrectos.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Error al iniciar sesión.');
    } finally { setLoading(false); }
  }

  async function handleFirebaseLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await window.api.auth.login(email, fbPass);
      if (res.ok) {
        // Firebase verifica la licencia; la sesión de trabajo se establece con login local
        setSuccess('Licencia verificada. Ingresá con tu usuario local para continuar.');
        setView('local');
      } else {
        setError(res.error ?? 'No se pudo iniciar sesión.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Error de conexión.');
    } finally { setLoading(false); }
  }

  async function handleSolicitarReset(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await window.api.auth.solicitarReset(resetEmail);
      if (res.ok) { setSuccess('Código enviado a ' + resetEmail); setView('reset-code'); }
      else setError(res.error ?? 'No se pudo enviar el código.');
    } finally { setLoading(false); }
  }

  async function handleVerificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await window.api.auth.verificarCodigo(resetEmail, resetCodigo);
      if (res.ok) { setSuccess('Código verificado. Ingresá tu nueva contraseña.'); setView('reset-pass'); }
      else setError(res.error ?? 'Código incorrecto.');
    } finally { setLoading(false); }
  }

  async function handleResetearPassword(e: React.FormEvent) {
    e.preventDefault();
    if (resetPass !== resetPass2) { setError('Las contraseñas no coinciden.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await window.api.auth.resetearPassword(resetEmail, resetCodigo, resetPass);
      if (res.ok) { setSuccess('Contraseña actualizada. Podés iniciar sesión.'); setView('local'); }
      else setError(res.error ?? 'No se pudo actualizar la contraseña.');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center p-6">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d1a33] via-bg to-[#0a1525] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent opacity-[0.04] rounded-full blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-[380px]"
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center shadow-[0_0_30px_rgba(79,142,245,.35)]">
              <span className="text-white font-black text-2xl">O</span>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-text">OmaTech POS</h1>
              <p className="text-[13px] text-text-subtle mt-0.5">
                {view === 'local'      && 'Iniciá sesión con tu usuario local'}
                {view === 'firebase'   && 'Iniciar sesión con email / licencia'}
                {view === 'reset-email'&& 'Recuperar contraseña'}
                {view === 'reset-code' && 'Ingresar código de verificación'}
                {view === 'reset-pass' && 'Nueva contraseña'}
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-[var(--r-card)] p-6 shadow-[var(--shadow-lg)]">
            {/* Error / Success */}
            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-[var(--r-in)] bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px]">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 px-3 py-2.5 rounded-[var(--r-in)] bg-[rgba(34,197,94,.1)] border border-[rgba(34,197,94,.25)] text-[#4ade80] text-[12px]">
                {success}
              </div>
            )}

            {/* ── Local login ── */}
            {view === 'local' && (
              <form onSubmit={handleLocalLogin} className="flex flex-col gap-4">
                <div className="field">
                  <label className="field-label">Usuario</label>
                  <input ref={inputRef} className="inp" value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="admin" autoComplete="username" required />
                </div>
                <div className="field">
                  <label className="field-label">Contraseña</label>
                  <input className="inp" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm font-semibold mt-1">
                  {loading ? 'Iniciando…' : 'Ingresar'}
                </button>
                <div className="flex justify-between text-[11px]">
                  <button type="button" className="text-text-subtle hover:text-accent transition-colors" onClick={() => { setView('firebase'); setError(''); setSuccess(''); }}>
                    Login con licencia →
                  </button>
                  <button type="button" className="text-text-subtle hover:text-accent transition-colors" onClick={() => { setView('reset-email'); setError(''); setSuccess(''); }}>
                    Olvidé mi contraseña
                  </button>
                </div>
              </form>
            )}

            {/* ── Firebase login ── */}
            {view === 'firebase' && (
              <form onSubmit={handleFirebaseLogin} className="flex flex-col gap-4">
                <div className="field">
                  <label className="field-label">Email</label>
                  <input ref={inputRef} className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@ejemplo.com" autoComplete="email" required />
                </div>
                <div className="field">
                  <label className="field-label">Contraseña</label>
                  <input className="inp" type="password" value={fbPass} onChange={e => setFbPass(e.target.value)} placeholder="••••••••" required />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm font-semibold mt-1">
                  {loading ? 'Verificando licencia…' : 'Ingresar con licencia'}
                </button>
                <button type="button" className="text-[11px] text-text-subtle hover:text-accent transition-colors" onClick={() => { setView('local'); setError(''); setSuccess(''); }}>
                  ← Volver al login local
                </button>
              </form>
            )}

            {/* ── Reset email ── */}
            {view === 'reset-email' && (
              <form onSubmit={handleSolicitarReset} className="flex flex-col gap-4">
                <div className="field">
                  <label className="field-label">Tu email registrado</label>
                  <input ref={inputRef} className="inp" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="nombre@ejemplo.com" required />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm font-semibold mt-1">
                  {loading ? 'Enviando…' : 'Enviar código'}
                </button>
                <button type="button" className="text-[11px] text-text-subtle hover:text-accent transition-colors" onClick={() => { setView('local'); setError(''); setSuccess(''); }}>
                  ← Cancelar
                </button>
              </form>
            )}

            {/* ── Reset code ── */}
            {view === 'reset-code' && (
              <form onSubmit={handleVerificarCodigo} className="flex flex-col gap-4">
                <div className="field">
                  <label className="field-label">Código de verificación</label>
                  <input ref={inputRef} className="inp text-center text-lg tracking-widest font-mono" value={resetCodigo} onChange={e => setResetCodigo(e.target.value)} placeholder="000000" maxLength={8} required />
                  <span className="field-hint">Revisá tu bandeja de entrada</span>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm font-semibold mt-1">
                  {loading ? 'Verificando…' : 'Verificar código'}
                </button>
              </form>
            )}

            {/* ── Reset pass ── */}
            {view === 'reset-pass' && (
              <form onSubmit={handleResetearPassword} className="flex flex-col gap-4">
                <div className="field">
                  <label className="field-label">Nueva contraseña</label>
                  <input ref={inputRef} className="inp" type="password" value={resetPass} onChange={e => setResetPass(e.target.value)} placeholder="••••••••" required />
                </div>
                <div className="field">
                  <label className="field-label">Repetir contraseña</label>
                  <input className="inp" type="password" value={resetPass2} onChange={e => setResetPass2(e.target.value)} placeholder="••••••••" required />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm font-semibold mt-1">
                  {loading ? 'Guardando…' : 'Cambiar contraseña'}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-[11px] text-text-subtle mt-4">
            OmaTech POS · Versión {typeof process !== 'undefined' ? '' : ''}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
