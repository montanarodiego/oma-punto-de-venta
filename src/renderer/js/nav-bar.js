(function () {
  var ICONS = {
    'caja.html': '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    'catalogo.html': '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    'inventario.html': '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    'clientes.html': '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'proveedores.html': '<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    'informes.html': '<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    'turno.html': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'configuracion.html': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  var tabs = [
    { label: 'Caja',          key: 'F1', file: 'caja.html'          },
    { label: 'Catálogo',      key: 'F2', file: 'catalogo.html'      },
    { label: 'Inventario',    key: 'F3', file: 'inventario.html'    },
    { label: 'Clientes',      key: 'F4', file: 'clientes.html'      },
    { label: 'Proveedores',   key: 'F5', file: 'proveedores.html'   },
    { label: 'Informes',      key: 'F6', file: 'informes.html'      },
    { label: 'Turno',         key: 'F7', file: 'turno.html'         },
    { label: 'Configuración', key: 'F8', file: 'configuracion.html' },
  ];

  var currentFile = location.pathname.split('/').pop();

  function hayModalAbierto() {
    if (document.querySelector('.modal-overlay:not(.hidden)'))  return true;
    if (document.querySelector('#buscador-overlay.visible'))    return true;
    if (document.querySelector('#modal-cobro.visible'))         return true;
    if (document.querySelector('#modal-turno-inicio.visible'))  return true;
    // Bloquear navegación si hay una descarga de actualización activa
    var ussDown = document.getElementById('uss-downloading');
    if (ussDown && ussDown.style.display !== 'none')             return true;
    return false;
  }

  function navegar(file) {
    if (hayModalAbierto()) return;
    window.api.navegar(file);
  }

  // Leer sesión para mostrar nombre/rol
  var _sessionRaw = localStorage.getItem('oma_session');
  var _session = null;
  try { _session = _sessionRaw ? JSON.parse(_sessionRaw) : null; } catch (_) {}
  var _nombre   = _session ? (_session.nombre || _session.usuario || '') : '';
  var _rolRaw   = _session ? _session.rol : '';
  var _rol      = _rolRaw === 'admin' ? 'Administrador' : 'Cajero';
  var _avatar   = _nombre ? _nombre[0].toUpperCase() : '?';
  var _avatarCls = _rolRaw === 'admin' ? 'nav-user-avatar avatar-admin' : 'nav-user-avatar';

  var nav = document.createElement('nav');
  nav.id = 'app-nav';

  var logo = document.createElement('img');
  logo.src = '../../../assets/icon.png';
  logo.width = 26;
  logo.height = 26;
  logo.style.cssText = 'margin:0 8px 0 4px;flex-shrink:0;border-radius:4px;';
  nav.appendChild(logo);

  // Tabs en contenedor scrollable
  var tabsWrap = document.createElement('div');
  tabsWrap.className = 'nav-tabs-wrap';

  tabs.forEach(function (tab) {
    var btn = document.createElement('button');
    btn.className = 'nav-tab' + (tab.file === currentFile ? ' active' : '');
    btn.dataset.file = tab.file;

    btn.innerHTML = (ICONS[tab.file] || '') +
      '<span>' + tab.label + '</span>' +
      '<span class="nav-key">' + tab.key + '</span>';

    btn.addEventListener('click', (function (f) {
      return function () { navegar(f); };
    }(tab.file)));

    tabsWrap.appendChild(btn);
  });

  nav.appendChild(tabsWrap);

  // Separador
  var sep = document.createElement('div');
  sep.className = 'nav-sep';
  nav.appendChild(sep);

  // Botón toggle de tema (luna = oscuro activo / sol = claro activo)
  var ICON_LUNA = '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var ICON_SOL  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/>' +
    '<line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>' +
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
    '<line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>' +
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  var _temaActual = localStorage.getItem('oma_theme') || 'dark';

  var btnTema = document.createElement('button');
  btnTema.id    = 'btn-nav-tema';
  btnTema.className = 'btn-nav-tema';
  btnTema.title = _temaActual === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  btnTema.innerHTML = _temaActual === 'dark' ? ICON_LUNA : ICON_SOL;

  btnTema.addEventListener('click', function () {
    var esClaro   = document.documentElement.classList.contains('theme-light');
    var nuevoTema = esClaro ? 'dark' : 'light';

    document.documentElement.classList.remove('theme-light');
    if (nuevoTema === 'light') document.documentElement.classList.add('theme-light');

    localStorage.setItem('oma_theme', nuevoTema);
    btnTema.innerHTML = nuevoTema === 'dark' ? ICON_LUNA : ICON_SOL;
    btnTema.title     = nuevoTema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

    if (window.api && window.api.config) {
      window.api.config.set('tema_ui', nuevoTema).catch(function () {});
    }
  });

  nav.appendChild(btnTema);

  // Sincronizar tema con SQLite al cargar (cubre reinstalaciones o limpieza de localStorage)
  if (window.api && window.api.config) {
    window.api.config.get('tema_ui').then(function (val) {
      if (!val || val === localStorage.getItem('oma_theme')) return;
      var tema = val === 'light' ? 'light' : 'dark';
      localStorage.setItem('oma_theme', tema);
      document.documentElement.classList.remove('theme-light');
      if (tema === 'light') document.documentElement.classList.add('theme-light');
      btnTema.innerHTML = tema === 'dark' ? ICON_LUNA : ICON_SOL;
      btnTema.title     = tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    }).catch(function () {});
  }

  // Chip de usuario
  var userChip = document.createElement('div');
  userChip.className = 'nav-user';
  userChip.innerHTML =
    '<div class="' + _avatarCls + '">' + _avatar + '</div>' +
    '<div class="nav-user-info">' +
      '<span class="nav-user-name">' + _nombre + '</span>' +
      '<span class="nav-user-role">' + _rol + '</span>' +
    '</div>';
  nav.appendChild(userChip);

  // Botón Reportar problema
  var btnReportar = document.createElement('button');
  btnReportar.className = 'btn-nav-reportar';
  btnReportar.title = 'Reportar un problema';
  btnReportar.innerHTML =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
      '<line x1="12" y1="9" x2="12" y2="13"/>' +
      '<line x1="12" y1="17" x2="12.01" y2="17"/>' +
    '</svg>' +
    '<span>Reportar</span>';
  btnReportar.addEventListener('click', function () { abrirModalReporte(); });
  nav.appendChild(btnReportar);

  // Botón Salir
  var btnSalir = document.createElement('button');
  btnSalir.className = 'btn-nav-salir';
  btnSalir.title = 'Cerrar sesión';
  btnSalir.innerHTML =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
      '<polyline points="16 17 21 12 16 7"/>' +
      '<line x1="21" y1="12" x2="9" y2="12"/>' +
    '</svg>' +
    '<span>Salir</span>';
  btnSalir.addEventListener('click', function () {
    window.api.turnos.getActivo().then(function (turno) {
      if (turno) {
        alert('Hay un turno abierto.\nDebés cerrar el turno antes de cerrar sesión.');
        window.api.navegar('turno.html');
        return;
      }
      if (window.confirm('¿Cerrar sesión?')) {
        localStorage.removeItem('oma_session');
        window.api.navegar('login.html');
      }
    }).catch(function () {
      if (window.confirm('¿Cerrar sesión?')) {
        localStorage.removeItem('oma_session');
        window.api.navegar('login.html');
      }
    });
  });
  nav.appendChild(btnSalir);

  document.body.prepend(nav);

  // F1-F8: manejados por globalShortcut en main.js — aquí solo recibimos el IPC
  window.api.onNavegar(function (file) {
    navegar(file);
  });

  // ── Modal Reportar Problema ─────────────────────────────────────
  var modalReporte = document.createElement('div');
  modalReporte.id = 'modal-reporte-problema';
  modalReporte.className = 'modal-reporte-overlay';
  modalReporte.style.display = 'none';
  modalReporte.innerHTML =
    '<div class="modal-reporte-box">' +
      '<div class="modal-reporte-header">' +
        '<div>' +
          '<h2 class="modal-reporte-titulo">Reportar un problema</h2>' +
          '<p class="modal-reporte-subtitulo">Tu reporte llega directamente al equipo de OmaTech</p>' +
        '</div>' +
        '<button class="modal-reporte-close" id="btn-reporte-close" title="Cerrar">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div id="modal-reporte-exito" class="modal-reporte-exito" style="display:none;">' +
        '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
        '<p>Reporte enviado. ¡Gracias!<br><span>El equipo de OmaTech lo revisará pronto.</span></p>' +
      '</div>' +
      '<form id="form-reporte-problema" class="modal-reporte-form">' +
        '<div class="modal-reporte-row">' +
          '<label class="modal-reporte-label" for="reporte-tipo">Tipo de problema</label>' +
          '<select id="reporte-tipo" class="modal-reporte-input">' +
            '<option value="Error en la app">Error en la app</option>' +
            '<option value="Algo no funciona bien">Algo no funciona bien</option>' +
            '<option value="Sugerencia de mejora">Sugerencia de mejora</option>' +
            '<option value="Otro">Otro</option>' +
          '</select>' +
        '</div>' +
        '<div class="modal-reporte-row">' +
          '<label class="modal-reporte-label" for="reporte-modulo">Módulo donde ocurrió</label>' +
          '<select id="reporte-modulo" class="modal-reporte-input">' +
            '<option value="Caja">Caja</option>' +
            '<option value="Catálogo">Catálogo</option>' +
            '<option value="Inventario">Inventario</option>' +
            '<option value="Clientes">Clientes</option>' +
            '<option value="Proveedores">Proveedores</option>' +
            '<option value="Informes">Informes</option>' +
            '<option value="Turno">Turno</option>' +
            '<option value="Configuración">Configuración</option>' +
            '<option value="Otro">Otro</option>' +
          '</select>' +
        '</div>' +
        '<div class="modal-reporte-row">' +
          '<label class="modal-reporte-label" for="reporte-descripcion">Descripción <span style="color:var(--danger)">*</span></label>' +
          '<textarea id="reporte-descripcion" class="modal-reporte-input modal-reporte-textarea" placeholder="Describí el problema con el mayor detalle posible" required></textarea>' +
        '</div>' +
        '<div class="modal-reporte-row">' +
          '<label class="modal-reporte-label" for="reporte-nombre">Tu nombre <span style="color:var(--text-subtle);font-weight:400;">(opcional)</span></label>' +
          '<input id="reporte-nombre" type="text" class="modal-reporte-input" placeholder="Ej: Juan García">' +
        '</div>' +
        '<div id="reporte-error" class="modal-reporte-error" style="display:none;"></div>' +
        '<div class="modal-reporte-actions">' +
          '<button type="button" class="btn-reporte-cancelar" id="btn-reporte-cancelar">Cancelar</button>' +
          '<button type="submit" class="btn-reporte-enviar" id="btn-reporte-enviar">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
            '<span>Enviar reporte</span>' +
          '</button>' +
        '</div>' +
      '</form>' +
    '</div>';
  document.body.appendChild(modalReporte);

  function abrirModalReporte() {
    document.getElementById('form-reporte-problema').reset();
    document.getElementById('reporte-error').style.display = 'none';
    document.getElementById('modal-reporte-exito').style.display = 'none';
    document.getElementById('form-reporte-problema').style.display = '';
    // Pre-seleccionar módulo según la página actual
    var modMap = {
      'caja.html': 'Caja', 'catalogo.html': 'Catálogo', 'inventario.html': 'Inventario',
      'clientes.html': 'Clientes', 'proveedores.html': 'Proveedores',
      'informes.html': 'Informes', 'turno.html': 'Turno', 'configuracion.html': 'Configuración',
    };
    var sel = document.getElementById('reporte-modulo');
    if (modMap[currentFile]) sel.value = modMap[currentFile];
    // Pre-rellenar nombre del usuario logueado
    if (_nombre) document.getElementById('reporte-nombre').value = _nombre;
    modalReporte.style.display = 'flex';
    setTimeout(function () { document.getElementById('reporte-descripcion').focus(); }, 80);
  }

  function cerrarModalReporte() {
    modalReporte.style.display = 'none';
  }

  document.getElementById('btn-reporte-close').addEventListener('click', cerrarModalReporte);
  document.getElementById('btn-reporte-cancelar').addEventListener('click', cerrarModalReporte);
  var _reporteMousedownTarget = null;
  modalReporte.addEventListener('mousedown', function (e) {
    _reporteMousedownTarget = e.target;
  });
  modalReporte.addEventListener('click', function (e) {
    if (e.target === modalReporte && _reporteMousedownTarget === modalReporte) cerrarModalReporte();
  });

  document.getElementById('form-reporte-problema').addEventListener('submit', async function (e) {
    e.preventDefault();
    var tipo        = document.getElementById('reporte-tipo').value;
    var modulo      = document.getElementById('reporte-modulo').value;
    var descripcion = document.getElementById('reporte-descripcion').value.trim();
    var nombre      = document.getElementById('reporte-nombre').value.trim();
    var errEl       = document.getElementById('reporte-error');
    var btnEnviar   = document.getElementById('btn-reporte-enviar');

    if (!descripcion) {
      errEl.textContent = 'La descripción es obligatoria.';
      errEl.style.display = '';
      return;
    }
    errEl.style.display = 'none';
    btnEnviar.disabled = true;
    btnEnviar.querySelector('span').textContent = 'Enviando…';

    try {
      var res = await window.api.soporte.enviarReporte({ tipo, modulo, descripcion, nombre });
      if (res.ok) {
        document.getElementById('form-reporte-problema').style.display = 'none';
        document.getElementById('modal-reporte-exito').style.display = 'flex';
        setTimeout(cerrarModalReporte, 3000);
      } else {
        errEl.textContent = 'No se pudo enviar: ' + (res.error || 'error desconocido');
        errEl.style.display = '';
      }
    } catch (err) {
      errEl.textContent = 'No se pudo enviar: ' + (err.message || 'error de red');
      errEl.style.display = '';
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.querySelector('span').textContent = 'Enviar reporte';
    }
  });
})();
