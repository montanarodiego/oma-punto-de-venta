import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRIMER_USUARIO_EVENT } from '../App';

export default function Setup() {
  const navigate = useNavigate();

  const [nombre,   setNombre]   = useState('');
  const [usuario,  setUsuario]  = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !usuario.trim()) { setError('Completá nombre y usuario.'); return; }
    if (password.length < 4) { setError('La contraseña debe tener al menos 4 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true); setError('');
    try {
      await window.api.usuarios.crear({
        nombre: nombre.trim(), usuario: usuario.trim(), password, rol: 'admin',
      });
      // Notifica a App que hay usuarios ahora — AppRoutes remonta con status 'ready'.
      window.dispatchEvent(new Event(PRIMER_USUARIO_EVENT));
      navigate('/login', { state: { mensaje: 'Administrador creado. Ingresá con tus credenciales.' } });
    } catch (err: any) {
      setError(err.message ?? 'Error al crear el administrador.');
      setLoading(false);
    }
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
