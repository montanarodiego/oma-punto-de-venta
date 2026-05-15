(async () => {
  if (!window.api?.sync?.contarPendientes) return;
  const total = await window.api.sync.contarPendientes();
  const badge = document.getElementById('badge-sync');
  if (!badge) return;
  if (total > 0) {
    badge.textContent = `${total} pendiente${total === 1 ? '' : 's'}`;
    badge.classList.remove('hidden');
  }
})();
