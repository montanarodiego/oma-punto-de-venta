(function () {
  var isDownloading = false;
  var overlay;

  function fmt(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB/s';
    if (bytes >= 1024)    return (bytes / 1024).toFixed(0)    + ' KB/s';
    return bytes + ' B/s';
  }

  // ── Inyectar overlay ────────────────────────────────────────────
  overlay = document.createElement('div');
  overlay.id = 'update-overlay';
  overlay.style.cssText =
    'display:none;position:fixed;inset:0;z-index:10000;' +
    'background:rgba(0,0,0,.65);backdrop-filter:blur(4px);' +
    'align-items:center;justify-content:center;';

  overlay.innerHTML =
    '<div style="' +
      'background:var(--surface-2,#1e2a3a);' +
      'border:1px solid rgba(59,130,246,.35);' +
      'border-radius:16px;padding:32px;' +
      'max-width:420px;width:calc(100vw - 48px);' +
      'box-shadow:0 20px 60px rgba(0,0,0,.65);">' +

      // ── disponible ──
      '<div id="uss-available" style="display:none;">' +
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">' +
          '<div style="width:44px;height:44px;border-radius:12px;flex-shrink:0;' +
            'background:rgba(59,130,246,.15);display:flex;align-items:center;justify-content:center;">' +
            '<svg width="22" height="22" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24">' +
              '<polyline points="16 16 12 20 8 16"/><line x1="12" y1="4" x2="12" y2="20"/>' +
            '</svg>' +
          '</div>' +
          '<div>' +
            '<div style="font-weight:700;font-size:16px;color:#f1f5f9;">Nueva versión disponible</div>' +
            '<div id="uss-version" style="color:#93c5fd;font-size:13px;margin-top:2px;"></div>' +
          '</div>' +
        '</div>' +
        '<p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 22px;">' +
          'Hay una nueva versión de Oma POS. La descarga es rápida y no afecta tus datos.' +
        '</p>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
          '<button id="uss-btn-later" style="background:transparent;border:1px solid rgba(148,163,184,.3);' +
            'color:#94a3b8;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;">' +
            'Más tarde' +
          '</button>' +
          '<button id="uss-btn-download" style="background:#3b82f6;color:#fff;border:none;' +
            'padding:9px 22px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;font-family:inherit;">' +
            'Descargar ahora' +
          '</button>' +
        '</div>' +
      '</div>' +

      // ── descargando ──
      '<div id="uss-downloading" style="display:none;">' +
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:22px;">' +
          '<div style="width:44px;height:44px;border-radius:12px;flex-shrink:0;' +
            'background:rgba(59,130,246,.15);display:flex;align-items:center;justify-content:center;">' +
            '<svg width="22" height="22" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24">' +
              '<polyline points="16 16 12 20 8 16"/><line x1="12" y1="4" x2="12" y2="20"/>' +
            '</svg>' +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;font-size:15px;color:#f1f5f9;">Descargando actualización…</div>' +
            '<div style="display:flex;justify-content:space-between;margin-top:3px;">' +
              '<span id="uss-percent" style="color:#93c5fd;font-size:13px;font-weight:600;">0%</span>' +
              '<span id="uss-speed"   style="color:#64748b;font-size:12px;"></span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,.1);border-radius:999px;height:7px;overflow:hidden;margin-bottom:14px;">' +
          '<div id="uss-bar" style="height:100%;background:linear-gradient(90deg,#3b82f6,#60a5fa);' +
            'border-radius:999px;transition:width .3s ease;width:0%;"></div>' +
        '</div>' +
        '<p style="font-size:12px;color:#64748b;margin:0 0 14px;text-align:center;">' +
          'No cierres la aplicación durante la descarga' +
        '</p>' +
        '<div style="text-align:center;">' +
          '<button id="uss-btn-skip" style="background:transparent;border:none;' +
            'color:#475569;font-size:12px;cursor:pointer;text-decoration:underline;' +
            'font-family:inherit;padding:0;">' +
            'Continuar sin actualizar' +
          '</button>' +
        '</div>' +
      '</div>' +

      // ── listo ──
      '<div id="uss-ready" style="display:none;">' +
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">' +
          '<div style="width:44px;height:44px;border-radius:12px;flex-shrink:0;' +
            'background:rgba(34,197,94,.12);display:flex;align-items:center;justify-content:center;">' +
            '<svg width="22" height="22" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24">' +
              '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' +
            '</svg>' +
          '</div>' +
          '<div>' +
            '<div style="font-weight:700;font-size:16px;color:#f1f5f9;">¡Actualización lista!</div>' +
            '<div style="color:#86efac;font-size:13px;margin-top:2px;">La app se reiniciará para aplicar los cambios</div>' +
          '</div>' +
        '</div>' +
        '<p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 22px;">' +
          'Todo tu trabajo está guardado. El reinicio tarda unos pocos segundos.' +
        '</p>' +
        '<div style="display:flex;justify-content:flex-end;">' +
          '<button id="uss-btn-install" style="background:#22c55e;color:#fff;border:none;' +
            'padding:10px 28px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;font-family:inherit;">' +
            'Reiniciar e instalar' +
          '</button>' +
        '</div>' +
      '</div>' +

      // ── error ──
      '<div id="uss-error" style="display:none;">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
          '<div style="width:44px;height:44px;border-radius:12px;flex-shrink:0;' +
            'background:rgba(239,68,68,.12);display:flex;align-items:center;justify-content:center;">' +
            '<svg width="22" height="22" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24">' +
              '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' +
            '</svg>' +
          '</div>' +
          '<div style="font-weight:700;font-size:15px;color:#f1f5f9;">Error al actualizar</div>' +
        '</div>' +
        '<p id="uss-error-msg" style="font-size:13px;color:#fca5a5;margin:0 0 20px;word-break:break-word;"></p>' +
        '<div style="display:flex;justify-content:flex-end;">' +
          '<button id="uss-btn-close-error" style="background:transparent;' +
            'border:1px solid rgba(252,165,165,.35);color:#fca5a5;' +
            'padding:8px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;">' +
            'Cerrar' +
          '</button>' +
        '</div>' +
      '</div>' +

    '</div>';

  document.body.appendChild(overlay);

  // ── Helpers ─────────────────────────────────────────────────────
  function showState(state) {
    ['available', 'downloading', 'ready', 'error'].forEach(function (s) {
      var el = document.getElementById('uss-' + s);
      if (el) el.style.display = (s === state) ? 'block' : 'none';
    });
    overlay.style.display = 'flex';
    isDownloading = (state === 'downloading');
  }

  function hideModal() {
    overlay.style.display = 'none';
    isDownloading = false;
  }

  // ── Consultar actualización pendiente al cargar la página ───────
  // Resuelve la race condition: update-available puede haberse disparado
  // antes de que este renderer cargara y registrara los listeners IPC.
  if (window.api && window.api.getPendingUpdate) {
    window.api.getPendingUpdate().then(function (info) {
      if (!info) return;
      var vEl = document.getElementById('uss-version');
      if (vEl) vEl.textContent = 'Versión ' + info.version;
      showState('available');
    });
  }

  // ── Eventos IPC ─────────────────────────────────────────────────
  window.api.onUpdateAvailable(function (info) {
    var vEl = document.getElementById('uss-version');
    if (vEl) vEl.textContent = 'Versión ' + info.version;
    showState('available');
  });

  window.api.onUpdateProgress(function (data) {
    showState('downloading');
    var bar  = document.getElementById('uss-bar');
    var pct  = document.getElementById('uss-percent');
    var spd  = document.getElementById('uss-speed');
    var p    = Math.min(100, Math.max(0, data.percent || 0));
    if (bar) bar.style.width = p + '%';
    if (pct) pct.textContent = p + '%';
    if (spd) spd.textContent = data.bytesPerSecond ? fmt(data.bytesPerSecond) : '';
  });

  window.api.onUpdateDownloaded(function () {
    showState('ready');
  });

  window.api.onUpdateError(function (msg) {
    var el = document.getElementById('uss-error-msg');
    if (el) el.textContent = msg || 'Error desconocido';
    showState('error');
  });

  // ── Botones ─────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    switch (e.target.id) {
      case 'uss-btn-download':
        showState('downloading');
        window.api.startDownload();
        break;
      case 'uss-btn-later':
        hideModal();
        break;
      case 'uss-btn-install':
        window.api.installUpdate();
        break;
      case 'uss-btn-skip':
        hideModal();
        break;
      case 'uss-btn-close-error':
        hideModal();
        break;
    }
  });

  // ── Advertencia al cerrar/navegar mientras descarga ─────────────
  window.addEventListener('beforeunload', function (e) {
    if (!isDownloading) return;
    e.preventDefault();
    e.returnValue = '';
  });
}());
