(function () {
  function hayModalAbierto() {
    if (document.querySelector('.modal-overlay:not(.hidden)')) return true;
    if (document.querySelector('#buscador-overlay.visible'))  return true;
    if (document.querySelector('#modal-cobro.visible'))       return true;
    return false;
  }

  function notificar() {
    window.api?.modalState(hayModalAbierto());
  }

  const observer = new MutationObserver(notificar);
  observer.observe(document.body, {
    subtree:         true,
    attributes:      true,
    attributeFilter: ['class', 'style'],
  });
})();
