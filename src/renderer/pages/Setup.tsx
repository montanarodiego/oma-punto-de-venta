import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRIMER_USUARIO_EVENT } from '../App';

export default function Setup() {
  const navigate = useNavigate();

  const [nombre,   setNombre]   = useState('');
  const [usuario,  setUsuario]  = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  // Clave de recuperación de dueño: se genera al crear el admin y se muestra UNA vez.
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  function continuarAlLogin() {
    // Notifica a App que hay usuarios ahora — AppRoutes remonta con status 'ready'.
    window.dispatchEvent(new Event(PRIMER_USUARIO_EVENT));
    navigate('/login', { state: { mensaje: 'Administrador creado. Ingresá con tus credenciales.' } });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !usuario.trim()) { setError('Completá nombre y usuario.'); return; }
    // El email es el único canal para recuperar la contraseña: lo exigimos en el admin.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Ingresá un email válido para poder recuperar tu contraseña.'); return; }
    if (password.length < 4) { setError('La contraseña debe tener al menos 4 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true); setError('');
    try {
      await window.api.usuarios.crear({
        nombre: nombre.trim(), usuario: usuario.trim(), email: email.trim(), password, rol: 'admin',
      });
      // Genera la clave de recuperación de dueño y la muestra una vez antes de seguir.
      // Si fallara, no bloqueamos el alta (se puede generar luego desde Configuración).
      try {
        const r = await window.api.recovery.generar();
        if (r.ok) { setRecoveryCode(r.data.codigo); setLoading(false); return; }
      } catch { /* sigue sin bloquear */ }
      continuarAlLogin();
    } catch (err: any) {
      setError(err.message ?? 'Error al crear el administrador.');
      setLoading(false);
    }
  }

  // Pantalla de revelado de la clave de recuperación (se muestra UNA vez).
  if (recoveryCode) {
    return (
      <div className="fixed inset-0 bg-bg flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1a33] via-bg to-[#0a1525] pointer-events-none" />
        <div className="relative w-full max-w-[440px]">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-warning/20 border border-warning/40 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-text">Guardá tu clave de recuperación</h1>
              <p className="text-[13px] text-text-subtle mt-1">Es la <strong>única</strong> forma de recuperar el acceso de administrador si olvidás tu contraseña y no tenés email. <strong>No la compartas con empleados.</strong></p>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-[var(--r-card)] p-6 shadow-[var(--shadow-lg)] flex flex-col gap-4">
            <div className="text-center bg-bg border-2 border-dashed border-warning/50 rounded-[var(--r-in)] py-5 px-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2">Clave de recuperación de dueño</div>
              <div className="text-[26px] font-black font-mono text-warning tracking-wider select-all break-all">{recoveryCode}</div>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(recoveryCode).catch(() => {})}
              className="btn btn-ghost w-full py-2 text-[12px]"
            >Copiar al portapapeles</button>
            <div className="px-3 py-2.5 rounded-[var(--r-in)] bg-[rgba(245,158,11,.1)] border border-[rgba(245,158,11,.25)] text-[#fcd34d] text-[12px]">
              Anotala en un lugar seguro (no en la misma PC). No la volveremos a mostrar; si la perdés, vas a tener que generar una nueva desde Configuración estando con sesión.
            </div>
            <button onClick={continuarAlLogin} className="btn btn-primary w-full py-2.5 text-sm font-semibold mt-1">
              Ya la guardé, continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d1a33] via-bg to-[#0a1525] pointer-events-none" />
      <div className="relative w-full max-w-[400px]">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center shadow-[0_0_30px_rgba(79,142,245,.35)]">
            <span className="text-white font-black text-2xl">O</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-text">Primera configuración</h1>
            <p className="text-[13px] text-text-subtle mt-0.5">Creá el usuario administrador para empezar</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[var(--r-card)] p-6 shadow-[var(--shadow-lg)]">
          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-[var(--r-in)] bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px]">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="field">
              <label className="field-label">Nombre completo</label>
              <input className="inp" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan García" autoFocus required />
            </div>
            <div className="field">
              <label className="field-label">Usuario</label>
              <input className="inp" value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Ej: admin" autoComplete="username" required />
            </div>
            <div className="field">
              <label className="field-label">Email</label>
              <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@ejemplo.com" autoComplete="email" required />
              <span className="field-hint">Lo usamos para recuperar tu contraseña si la olvidás.</span>
            </div>
            <div className="field">
              <label className="field-label">Contraseña</label>
              <input className="inp" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
            </div>
            <div className="field">
              <label className="field-label">Confirmar contraseña</label>
              <input className="inp" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm font-semibold mt-1">
              {loading ? 'Creando…' : 'Crear administrador y continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
