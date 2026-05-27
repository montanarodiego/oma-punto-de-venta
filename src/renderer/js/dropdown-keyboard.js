// Shared keyboard navigation for autocomplete dropdowns.
// Loaded BEFORE modal-keyboard.js — capture phase fires in registration order.
(function () {
  const KBD = 'dd-kbd';

  const sty = document.createElement('style');
  sty.textContent = '.dd-kbd { background: rgba(96,165,250,.18) !important; }';
  document.head.appendChild(sty);

  const bindings = [];

  function findBinding(active) {
    if (!active) return null;
    for (const b of bindings) {
      if (b.inputEl  && b.inputEl === active)       return b;
      if (b.inputSel && active.matches(b.inputSel)) return b;
    }
    return null;
  }

  function getDD(b) {
    return b.dropdownEl || (b.dropdownId ? document.getElementById(b.dropdownId) : null);
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== 'Escape') return;

    const b = findBinding(document.activeElement);
    if (!b) return;

    const dd = getDD(b);
    if (!dd || dd.style.display === 'none') return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const opts = [...dd.querySelectorAll(b.optSel)];
      if (!opts.length) return;
      const cur = opts.findIndex(o => o.classList.contains(KBD));
      opts.forEach(o => o.classList.remove(KBD));
      const next = e.key === 'ArrowDown'
        ? (cur === -1 ? 0 : Math.min(cur + 1, opts.length - 1))
        : (cur <= 0    ? -1 : cur - 1);
      if (next >= 0) {
        opts[next].classList.add(KBD);
        opts[next].scrollIntoView({ block: 'nearest' });
      }
      return;
    }

    if (e.key === 'Enter') {
      const focused = dd.querySelector('.' + KBD);
      if (!focused) return; // no item selected → let other handlers run
      e.preventDefault();
      e.stopImmediatePropagation();
      dd.querySelectorAll('.' + KBD).forEach(o => o.classList.remove(KBD));
      b.onSelect(focused);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      dd.querySelectorAll('.' + KBD).forEach(o => o.classList.remove(KBD));
      b.onClose();
      return;
    }
  }, true);

  window.bindDropdownKeyboard = function ({ inputEl, inputSel, dropdownId, dropdownEl, optSel, onSelect, onClose }) {
    const dd = dropdownEl || (dropdownId ? document.getElementById(dropdownId) : null);
    bindings.push({
      inputEl:    inputEl    || null,
      inputSel:   inputSel   || null,
      dropdownEl: dd,
      dropdownId: dropdownId || null,
      optSel,
      onSelect,
      onClose: onClose || (() => { if (dd) dd.style.display = 'none'; }),
    });
  };
})();
