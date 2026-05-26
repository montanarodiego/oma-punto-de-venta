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

  /* ── 2. TURNO_GUARD_PROMISE ────────────────────────────────────── */
  // Se crea de forma síncrona aquí; caja.js (y otras vistas) la awaitan
  // en su propio DOMContentLoaded para obtener el turno activo sin llamar
  // de nuevo al IPC.
  var _resolverTurno;
  window.TURNO_GUARD_PROMISE = new Promise(function (resolve) {
    _resolverTurno = resolve;
  });

  /* ── 3. Overlay de actualización ─────────────────────────────── */
  (function initUpdaterUI() {
    var overlay = document.createElement('div');
    overlay.id = 'update-overlay';
    overlay.style.cssText =
      'display:none;position:fixed;inset:0;' +
      'background:rgba(0,0,0,0.85);z-index:99999;' +
      'align-items:center;justify-content:center;' +
      'flex-direction:column;gap:24px;';

    overlay.innerHTML =
      '<div style="text-align:center;max-width:480px;padding:40px;' +
        'background:#1e2535;border-radius:16px;border:1px solid rgba(59,130,246,0.3);' +
        'box-shadow:0 20px 60px rgba(0,0,0,0.6);">' +
        '<div id="upd-icon" style="font-size:48px;margin-bottom:16px;">🚀</div>' +
        '<div id="upd-title" style="font-size:22px;font-weight:700;color:#fff;margin-bottom:8px;">Nueva versión disponible</div>' +
        '<div id="upd-subtitle" style="font-size:14px;color:#93c5fd;margin-bottom:24px;"></div>' +
        '<div id="upd-progress-wrap" style="display:none;margin-bottom:20px;">' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:8px;">' +
            '<span style="color:#94a3b8;font-size:13px;">Descargando...</span>' +
            '<span id="upd-percent" style="color:#60a5fa;font-weight:700;font-size:13px;">0%</span>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.1);border-radius:999px;height:8px;overflow:hidden;">' +
            '<div id="upd-bar" style="height:100%;background:linear-gradient(90deg,#3b82f6,#60a5fa);' +
              'border-radius:999px;transition:width 0.3s;width:0%;"></div>' +
          '</div>' +
          '<div id="upd-speed" style="color:#64748b;font-size:12px;margin-top:6px;text-align:right;"></div>' +
        '</div>' +
        '<div id="upd-buttons" style="display:flex;gap:12px;justify-content:center;">' +
          '<button id="upd-btn-download" style="background:#3b82f6;color:#fff;border:none;' +
            'padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;cursor:pointer;">' +
            'Descargar ahora' +
          '</button>' +
          '<button id="upd-btn-later" style="background:transparent;color:#94a3b8;' +
            'border:1px solid rgba(148,163,184,0.3);padding:12px 20px;border-radius:8px;' +
            'cursor:pointer;font-size:14px;">' +
            'Más tarde' +
          '</button>' +
        '</div>' +
        '<button id="upd-btn-install" style="display:none;background:#22c55e;color:#fff;' +
          'border:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;' +
          'cursor:pointer;width:100%;">' +
          '✅ Reiniciar e instalar ahora' +
        '</button>' +
      '</div>';

    document.body.appendChild(overlay);

    window.api.onUpdateAvailable(function (info) {
      document.getElementById('upd-subtitle').textContent = 'Versión ' + info.version + ' lista para descargar';
      overlay.style.display = 'flex';
    });

    window.api.onUpdateProgress(function (progress) {
      document.getElementById('upd-progress-wrap').style.display = 'block';
      document.getElementById('upd-buttons').style.display = 'none';
      document.getElementById('upd-bar').style.width = progress.percent + '%';
      document.getElementById('upd-percent').textContent = progress.percent + '%';
      var bps = progress.bytesPerSecond;
      document.getElementById('upd-speed').textContent = bps > 1048576
        ? (bps / 1048576).toFixed(1) + ' MB/s'
        : (bps / 1024).toFixed(0) + ' KB/s';
      overlay.style.display = 'flex';
    });

    window.api.onUpdateDownloaded(function () {
      document.getElementById('upd-icon').textContent = '✅';
      document.getElementById('upd-title').textContent = '¡Actualización lista!';
      document.getElementById('upd-subtitle').textContent = 'La app se reiniciará para instalar la nueva versión';
      document.getElementById('upd-progress-wrap').style.display = 'none';
      document.getElementById('upd-buttons').style.display = 'none';
      document.getElementById('upd-btn-install').style.display = 'block';
      overlay.style.display = 'flex';
    });

    document.addEventListener('click', function (e) {
      if (e.target.id === 'upd-btn-download') {
        document.getElementById('upd-buttons').style.display = 'none';
        document.getElementById('upd-progress-wrap').style.display = 'block';
        window.api.startDownload();
      }
      if (e.target.id === 'upd-btn-later') {
        overlay.style.display = 'none';
      }
      if (e.target.id === 'upd-btn-install') {
        window.api.installUpdate();
      }
    });
  }());

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
