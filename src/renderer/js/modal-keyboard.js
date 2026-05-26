(function () {
  function modalVisible() {
    return document.querySelector('.modal-overlay:not(.hidden)');
  }

  function btnVisible(el) {
    return el && el.offsetParent !== null && !el.disabled;
  }

  document.addEventListener('keydown', e => {
    const modal = modalVisible();
    if (!modal) return;

    // Escape → cierra el modal (botón ×)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      const closeBtn = modal.querySelector('.modal-close');
      if (closeBtn) { closeBtn.click(); return; }
      const ghostBtns = [...modal.querySelectorAll('.btn-ghost')].filter(btnVisible);
      if (ghostBtns.length) ghostBtns[ghostBtns.length - 1].click();
      return;
    }

    // Enter → confirma (botón principal), excepto en casos donde Enter ya tiene significado
    if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active?.tagName === 'TEXTAREA') return;
      if (active?.tagName === 'BUTTON') return;
      if (active?.tagName === 'INPUT' && active.closest('form')) return;
      if (active?.tagName === 'SELECT') return;

      e.preventDefault();
      e.stopPropagation();
      // Primero busca .btn-primary visible, luego .btn-danger visible
      const primary  = [...modal.querySelectorAll('.btn-primary')].find(btnVisible);
      const danger   = [...modal.querySelectorAll('.btn-danger')].find(btnVisible);
      const confirm  = primary || danger;
      if (confirm) { confirm.click(); return; }
      // Fallback: último botón visible que no sea .modal-close ni .btn-ghost
      const allBtns = [...modal.querySelectorAll('button')].filter(
        b => btnVisible(b) && !b.classList.contains('modal-close') && !b.classList.contains('btn-ghost')
      );
      if (allBtns.length) allBtns[allBtns.length - 1].click();
    }
  }, true);
})();
