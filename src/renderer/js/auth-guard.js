// auth-guard.js — debe ser el primer script en cada vista protegida
// Verifica sesión en localStorage; si no hay, redirige a login.html.
// Si el rol es cajero, oculta módulos restringidos y bloquea acceso a páginas no permitidas.
(function () {
  const raw = localStorage.getItem('oma_session');
  if (!raw) {
    location.replace('login.html');
    throw new Error('Sin sesión');
  }

  let session;
  try { session = JSON.parse(raw); } catch {
    localStorage.removeItem('oma_session');
    location.replace('login.html');
    throw new Error('Sesión inválida');
  }

  // Páginas accesibles para cajero
  const CAJERO_PERMITIDAS = ['caja.html', 'clientes.html', 'turno.html'];
  const paginaActual = location.href.split('/').pop().split('?')[0];

  if (session.rol === 'cajero' && !CAJERO_PERMITIDAS.includes(paginaActual)) {
    location.replace('caja.html');
    throw new Error('Acceso denegado');
  }

  // ── Setup sidebar al cargar DOM ────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Nombre y avatar
    const navAvatar   = document.getElementById('nav-avatar');
    const navUsername = document.getElementById('nav-username');
    const navRole     = document.querySelector('.sidebar-user-role');

    if (navAvatar)   navAvatar.textContent   = (session.nombre || session.usuario)[0].toUpperCase();
    if (navUsername) navUsername.textContent  = session.nombre || session.usuario;
    if (navRole)     navRole.textContent      = session.rol === 'admin' ? 'Administrador' : 'Cajero';

    // Ocultar módulos restringidos para cajero
    if (session.rol === 'cajero') {
      const OCULTAR = ['catalogo.html', 'inventario.html', 'proveedores.html', 'informes.html', 'configuracion.html'];
      document.querySelectorAll('.nav-item').forEach(item => {
        const href = item.getAttribute('href') || '';
        if (OCULTAR.some(p => href.includes(p))) {
          item.style.display = 'none';
        }
      });
    }

    // Cerrar sesión
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        localStorage.removeItem('oma_session');
        location.replace('login.html');
      });
    }
  });

  // Aplicar tamaño HUD al html inmediatamente (evita flash al navegar entre vistas)
  const _hud = localStorage.getItem('oma_hud') || 'normal';
  document.documentElement.classList.add('hud-' + _hud);

  // Sincronizar rol con proceso principal (protege handlers IPC)
  window.api.auth.setSession(session);

  // Exponer sesión para otros scripts que la necesiten
  window.SESSION = session;
})();
