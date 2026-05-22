(function () {
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

  function isEditableActive() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.isContentEditable;
  }

  document.addEventListener('keydown', function (e) {
    if (isEditableActive()) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (ROUTES[e.key]) e.preventDefault();
  });
}());
