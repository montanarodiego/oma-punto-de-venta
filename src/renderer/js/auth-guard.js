// auth-guard.js — primer script en cada vista protegida
// 1) Verifica sesión; si no hay, redirige a login.
// 2) Expone window.TURNO_GUARD_PROMISE que resuelve con el turno activo
//    (o espera hasta que el usuario abra uno).  Todas las vistas usan
//    esta promesa para inicializarse solo cuando hay turno confirmado.
(function () {

  /* ── 1. Sesión ─────────────────────────────────────────────────── */
  var raw = localStorage.getItem('oma_session');
  if (!raw) { location.replace('login.html'); throw new Error('Sin sesión'); }

  var session;
  try { session = JSON.parse(raw); } catch (_) {
    localStorage.removeItem('oma_session');
    location.replace('login.html');
    throw new Error('Sesión inválida');
  }

  var CAJERO_PERMITIDAS = ['caja.html', 'clientes.html', 'turno.html'];
  var paginaActual = location.href.split('/').pop().split('?')[0];
  if (session.rol === 'cajero' && !CAJERO_PERMITIDAS.includes(paginaActual)) {
    location.replace('caja.html');
    throw new Error('Acceso denegado');
  }

  // Exponer sesión globalmente
  window.SESSION = session;
  window.api.auth.setSession(session);

  // HUD inmediato (evita flash al navegar)
  var _hud = localStorage.getItem('oma_hud') || 'normal';
  document.documentElement.classList.add('hud-' + _hud);

  // Tema inmediato (evita flash al navegar)
  if (localStorage.getItem('oma_theme') === 'light') {
    document.documentElement.classList.add('theme-light');
  }

  /* ── 2. TURNO_GUARD_PROMISE ────────────────────────────────────── */
  // Se crea de forma síncrona aquí; caja.js (y otras vistas) la awaitan
  // en su propio DOMContentLoaded para obtener el turno activo sin llamar
  // de nuevo al IPC.
  var _resolverTurno;
  window.TURNO_GUARD_PROMISE = new Promise(function (resolve) {
    _resolverTurno = resolve;
  });

  /* ── 4. Inyectar CSS del modal ─────────────────────────────────── */
  (function injectCSS() {
    var s = document.createElement('style');
    s.textContent = [
      '#modal-turno-inicio{',
        'position:fixed;inset:0;z-index:9998;',
        'background:var(--bg);',
        'display:none;align-items:center;justify-content:center;padding:24px;',
      '}',
      '#modal-turno-inicio.visible{display:flex;}',
      '#turno-inicio-box{',
        'width:100%;max-width:400px;',
        'background:var(--surface);border:1px solid var(--border);',
        'border-radius:var(--r-card);box-shadow:var(--shadow-lg);',
        'padding:36px 32px;display:flex;flex-direction:column;gap:20px;',
      '}',
      '#turno-inicio-logo{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;}',
      '#turno-inicio-logo img{width:72px;height:72px;border-radius:14px;object-fit:contain;}',
      '#turno-inicio-logo-title{font-size:18px;font-weight:700;color:var(--text);letter-spacing:-.01em;}',
      '#turno-inicio-subtitle{font-size:13px;color:var(--text-muted);text-align:center;line-height:1.5;}',
      '#turno-inicio-hora{',
        'display:flex;align-items:center;justify-content:center;gap:6px;',
        'font-size:13px;color:var(--text-subtle);',
        'background:var(--bg);border:1px solid var(--border);',
        'border-radius:var(--r-in);padding:8px 14px;',
      '}',
      '#turno-inicio-hora svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;}',
      '#turno-inicio-error{',
        'display:none;padding:9px 12px;',
        'background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);',
        'border-radius:var(--r-in);color:#fca5a5;font-size:12px;line-height:1.4;',
      '}',
      '#btn-abrir-turno{',
        'width:100%;padding:12px 0;border-radius:var(--r);',
        'background:var(--success);color:#fff;border:none;',
        'font-family:inherit;font-size:15px;font-weight:700;',
        'cursor:pointer;transition:background 150ms ease;',
      '}',
      '#btn-abrir-turno:hover:not(:disabled){background:var(--success-h);}',
      '#btn-abrir-turno:disabled{opacity:.5;cursor:not-allowed;}',
      '#btn-turno-logout{',
        'width:100%;padding:8px 0;background:none;border:none;',
        'font-family:inherit;font-size:12px;color:var(--text-subtle);',
        'cursor:pointer;transition:color 150ms ease;',
      '}',
      '#btn-turno-logout:hover{color:var(--danger);}',
    ].join('');
    document.head.appendChild(s);
  }());

  /* ── 4. Inyectar HTML del modal ────────────────────────────────── */
  (function injectHTML() {
    var div = document.createElement('div');
    div.id = 'modal-turno-inicio';
    div.innerHTML =
      '<div id="turno-inicio-box">' +
        '<div id="turno-inicio-logo">' +
          '<img src="../../../assets/icon.png" alt="OmaTech POS" />' +
          '<div id="turno-inicio-logo-title">OmaTech POS</div>' +
        '</div>' +
        '<div id="turno-inicio-subtitle">Para comenzar, registrá el efectivo inicial en caja</div>' +
        '<div id="turno-inicio-hora">' +
          '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
          '<span id="turno-inicio-hora-texto">—</span>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label">Efectivo inicial en caja</label>' +
          '<input id="turno-inicio-monto" type="number" min="0" step="0.01"' +
            ' placeholder="0,00" class="inp inp-lg" autocomplete="off" />' +
        '</div>' +
        '<div id="turno-inicio-error"></div>' +
        '<button id="btn-abrir-turno" type="button">Abrir turno</button>' +
        '<button id="btn-turno-logout" type="button">Cerrar sesión</button>' +
      '</div>';
    document.body.appendChild(div);
  }());

  /* ── 5. DOMContentLoaded: sidebar + turno check ─────────────────── */
  document.addEventListener('DOMContentLoaded', function () {

    /* ── Sidebar / navbar de usuario ── */
    var navAvatar   = document.getElementById('nav-avatar');
    var navUsername = document.getElementById('nav-username');
    var navRole     = document.querySelector('.sidebar-user-role');

    if (navAvatar)   navAvatar.textContent  = (session.nombre || session.usuario)[0].toUpperCase();
    if (navUsername) navUsername.textContent = session.nombre || session.usuario;
    if (navRole)     navRole.textContent     = session.rol === 'admin' ? 'Administrador' : 'Cajero';

    if (session.rol === 'cajero') {
      var OCULTAR = ['catalogo.html', 'inventario.html', 'proveedores.html', 'informes.html', 'configuracion.html'];
      document.querySelectorAll('.nav-item').forEach(function (item) {
        var href = item.getAttribute('href') || '';
        if (OCULTAR.some(function (p) { return href.includes(p); })) item.style.display = 'none';
      });
    }

    var btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', function () {
        localStorage.removeItem('oma_session');
        location.replace('login.html');
      });
    }

    /* ── Turno check async ── */
    window.api.turnos.getActivo().then(function (turno) {
      if (turno) {
        window.TURNO_ACTIVO = turno;
        _resolverTurno(turno);
        return;
      }
      // Sin turno activo → mostrar modal bloqueante
      mostrarModalTurno();
    }).catch(function (err) {
      console.error('Error al verificar turno activo:', err);
      // En caso de error, resolver con null para no bloquear indefinidamente
      _resolverTurno(null);
    });

  });

  /* ── Helpers del modal ─────────────────────────────────────────── */
  var _horaInterval = null;

  function mostrarModalTurno() {
    document.getElementById('modal-turno-inicio').classList.add('visible');
    actualizarHoraTurno();
    _horaInterval = setInterval(actualizarHoraTurno, 30000);
    setTimeout(function () {
      var m = document.getElementById('turno-inicio-monto');
      if (m) m.focus();
    }, 80);

    document.getElementById('btn-abrir-turno').addEventListener('click', confirmarAperturaTurno);
    document.getElementById('turno-inicio-monto').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') confirmarAperturaTurno();
    });
    document.getElementById('btn-turno-logout').addEventListener('click', function () {
      localStorage.removeItem('oma_session');
      window.api.navegar('login.html');
    });
  }

  function confirmarAperturaTurno() {
    var montoEl  = document.getElementById('turno-inicio-monto');
    var errorEl  = document.getElementById('turno-inicio-error');
    var btnAbrir = document.getElementById('btn-abrir-turno');
    var monto    = parseFloat(montoEl.value) || 0;

    errorEl.style.display = 'none';
    btnAbrir.disabled     = true;
    btnAbrir.textContent  = 'Abriendo turno...';

    window.api.turnos.abrir(monto).then(function (turnoNuevo) {
      clearInterval(_horaInterval);
      window.TURNO_ACTIVO = turnoNuevo;
      document.getElementById('modal-turno-inicio').classList.remove('visible');
      _resolverTurno(turnoNuevo);
    }).catch(function (e) {
      errorEl.textContent   = e.message || 'No se pudo abrir el turno.';
      errorEl.style.display = '';
      btnAbrir.disabled     = false;
      btnAbrir.textContent  = 'Abrir turno';
    });
  }

  function actualizarHoraTurno() {
    var ahora = new Date();
    var fecha = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    var hora  = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    var texto = fecha.charAt(0).toUpperCase() + fecha.slice(1) + ' — ' + hora;
    var el = document.getElementById('turno-inicio-hora-texto');
    if (el) el.textContent = texto;
  }

}());
