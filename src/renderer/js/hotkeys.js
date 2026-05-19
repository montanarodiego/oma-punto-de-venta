(function () {
  // Must match the accelerators defined in main.js createMenu()
  var ROUTES = {
    F1: 'caja.html',
    F2: 'catalogo.html',
    F3: 'inventario.html',
    F4: 'clientes.html',
    F5: 'proveedores.html',
    F6: 'informes.html',
    F7: 'turno.html',
    F8: 'configuracion.html',
  };

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (ROUTES[e.key]) e.preventDefault(); // main process accelerator handles navigation
  });
})();
