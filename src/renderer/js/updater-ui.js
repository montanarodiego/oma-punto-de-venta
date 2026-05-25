(function () {
  function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB/s';
    if (bytes >= 1024)        return (bytes / 1024).toFixed(0) + ' KB/s';
    return bytes + ' B/s';
  }

  // Inyectar HTML del banner
  var banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText =
    'display:none;position:fixed;bottom:0;left:0;right:0;z-index:10000;' +
    'background:linear-gradient(135deg,#1e3a5f,#1a2f4a);' +
    'border-top:1px solid rgba(59,130,246,0.4);' +
    'padding:14px 24px;box-shadow:0 -4px 20px rgba(0,0,0,0.4);';

  banner.innerHTML =
    // ── Estado: disponible ──
    '<div id="update-state-available" style="display:none;align-items:center;gap:16px;">' +
      '<div style="flex:1;">' +
        '<div style="font-weight:700;color:#fff;font-size:15px;">Nueva versión disponible</div>' +
        '<div id="update-version-text" style="color:#93c5fd;font-size:13px;margin-top:2px;"></div>' +
      '</div>' +
      '<button id="btn-download-update" style="background:#3b82f6;color:#fff;border:none;' +
        'padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;' +
        'font-family:inherit;transition:background 120ms;">' +
        'Descargar ahora' +
      '</button>' +
      '<button id="btn-dismiss-update" style="background:transparent;color:#93c5fd;' +
        'border:1px solid rgba(147,197,253,0.3);padding:9px 16px;border-radius:8px;' +
        'cursor:pointer;font-size:13px;font-family:inherit;transition:background 120ms;">' +
        'Más tarde' +
      '</button>' +
    '</div>' +

    // ── Estado: descargando ──
    '<div id="update-state-downloading" style="display:none;">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">' +
        '<div style="font-weight:700;color:#fff;font-size:14px;">Descargando actualización...</div>' +
        '<div id="update-percent" style="color:#93c5fd;font-weight:700;font-size:14px;"></div>' +
        '<div id="update-speed" style="color:#64748b;font-size:12px;margin-left:auto;"></div>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,0.12);border-radius:999px;height:5px;overflow:hidden;">' +
        '<div id="update-progress-bar" style="height:100%;background:linear-gradient(90deg,#3b82f6,#60a5fa);' +
          'border-radius:999px;transition:width 0.3s ease;width:0%;"></div>' +
      '</div>' +
    '</div>' +

    // ── Estado: listo para instalar ──
    '<div id="update-state-ready" style="display:none;align-items:center;gap:16px;">' +
      '<div style="flex:1;">' +
        '<div style="font-weight:700;color:#fff;font-size:15px;">Actualización lista para instalar</div>' +
        '<div style="color:#86efac;font-size:13px;margin-top:2px;">La app se reiniciará para aplicar los cambios</div>' +
      '</div>' +
      '<button id="btn-install-update" style="background:#22c55e;color:#fff;border:none;' +
        'padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;' +
        'font-family:inherit;transition:background 120ms;">' +
        'Reiniciar e instalar' +
      '</button>' +
    '</div>' +

    // ── Estado: error ──
    '<div id="update-state-error" style="display:none;align-items:center;gap:12px;">' +
      '<div style="color:#fca5a5;font-weight:600;font-size:13px;">Error al actualizar:</div>' +
      '<div id="update-error-msg" style="color:#fca5a5;font-size:13px;"></div>' +
      '<button id="btn-dismiss-error" style="background:transparent;color:#fca5a5;' +
        'border:1px solid rgba(252,165,165,0.3);padding:6px 14px;border-radius:8px;' +
        'cursor:pointer;font-size:12px;font-family:inherit;margin-left:auto;">' +
        'Cerrar' +
      '</button>' +
    '</div>';

  document.body.appendChild(banner);

  function showState(state) {
    ['available','downloading','ready','error'].forEach(function (s) {
      var el = document.getElementById('update-state-' + s);
      if (el) el.style.display = (s === state) ? 'flex' : 'none';
    });
    banner.style.display = '';
  }

  function hideBanner() {
    banner.style.display = 'none';
  }

  // update-available
  window.api.onUpdateAvailable(function (info) {
    var vEl = document.getElementById('update-version-text');
    if (vEl) vEl.textContent = 'Versión ' + info.version + ' disponible';
    showState('available');
  });

  // update-progress
  window.api.onUpdateProgress(function (data) {
    showState('downloading');
    var bar   = document.getElementById('update-progress-bar');
    var pct   = document.getElementById('update-percent');
    var speed = document.getElementById('update-speed');
    if (bar)   bar.style.width   = data.percent + '%';
    if (pct)   pct.textContent   = data.percent + '%';
    if (speed) speed.textContent = formatBytes(data.bytesPerSecond);
  });

  // update-downloaded
  window.api.onUpdateDownloaded(function () {
    showState('ready');
  });

  // update-error
  window.api.onUpdateError(function (message) {
    var el = document.getElementById('update-error-msg');
    if (el) el.textContent = message;
    showState('error');
  });

  // Botones
  document.addEventListener('click', function (e) {
    if (e.target.id === 'btn-download-update') {
      document.getElementById('update-state-available').style.display = 'none';
      showState('downloading');
      window.api.startDownload();
    }
    if (e.target.id === 'btn-dismiss-update')  hideBanner();
    if (e.target.id === 'btn-dismiss-error')   hideBanner();
    if (e.target.id === 'btn-install-update')  window.api.installUpdate();
  });
}());
