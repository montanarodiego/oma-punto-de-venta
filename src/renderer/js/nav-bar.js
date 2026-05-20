(function () {
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
    if (document.querySelector('.modal-overlay:not(.hidden)')) return true;
    if (document.querySelector('#buscador-overlay.visible'))  return true;
    if (document.querySelector('#modal-cobro.visible'))       return true;
    return false;
  }

  function navegar(file) {
    if (hayModalAbierto()) return;
    window.api.navegar(file);
  }

  var nav = document.createElement('nav');
  nav.id = 'app-nav';

  var logo = document.createElement('img');
  logo.src = '../../../assets/icon.png';
  logo.width = 24;
  logo.height = 24;
  logo.style.cssText = 'margin:0 6px 0 10px;flex-shrink:0;border-radius:4px;';
  nav.appendChild(logo);

  tabs.forEach(function (tab) {
    var btn = document.createElement('button');
    btn.className = 'nav-tab' + (tab.file === currentFile ? ' active' : '');

    var txt = document.createTextNode(tab.label + ' ');
    var key = document.createElement('span');
    key.className = 'nav-key';
    key.textContent = tab.key;

    btn.appendChild(txt);
    btn.appendChild(key);
    btn.addEventListener('click', (function (f) {
      return function () { navegar(f); };
    }(tab.file)));

    nav.appendChild(btn);
  });

  document.body.prepend(nav);

  // F1-F8: capture phase, antes que cualquier otro listener
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var idx = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'].indexOf(e.key);
    if (idx === -1) return;
    e.preventDefault();
    navegar(tabs[idx].file);
  }, true);
})();
