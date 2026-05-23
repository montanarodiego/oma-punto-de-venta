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
  var _nombre = _session ? (_session.nombre || _session.usuario || '') : '';
  var _rol    = _session ? (_session.rol === 'admin' ? 'Administrador' : 'Cajero') : '';
  var _avatar = _nombre ? _nombre[0].toUpperCase() : '?';

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

  // Chip de usuario
  var userChip = document.createElement('div');
  userChip.className = 'nav-user';
  userChip.innerHTML =
    '<div class="nav-user-avatar">' + _avatar + '</div>' +
    '<div class="nav-user-info">' +
      '<span class="nav-user-name">' + _nombre + '</span>' +
      '<span class="nav-user-role">' + _rol + '</span>' +
    '</div>';
  nav.appendChild(userChip);

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
})();
