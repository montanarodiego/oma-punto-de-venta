require('dotenv').config();
const { app, BrowserWindow, Menu, ipcMain, dialog, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { initDatabase, getDb } = require('./database');
const { registerHandlers }    = require('./ipc');
const { hacerBackup }         = require('./backup');
const ReportScheduler         = require('./report-scheduler');
const { auth, firestore }     = require('./firebase');
const { loginConEmail, reautenticarDesdeToken } = require('./auth');
const {
  encriptar,
  syncPendientes,
  verificarLicencia,
  guardarTokenLocal,
  verificarTokenLocal,
  leerTokenRaw,
} = require('./sync');
const Turnos = require('./models/turnos');

let mainWindow        = null;
let loginWindow       = null;
let negocioIdActivo   = null;
let syncInterval      = null;
let modalAbierto      = false;
let modalCobroAbierto = false;
let forceClose        = false;
let pendingUpdate     = null; // cached update info for late-loading renderers
let isDownloading     = false;

// ── Menú (solo Ver / DevTools) ─────────────────────────────────
function createMenu() {
  const template = [
    {
      label: 'Ver',
      submenu: [
        { role: 'reload',         label: 'Recargar' },
        { role: 'toggleDevTools', label: 'DevTools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn',    label: 'Acercar' },
        { role: 'zoomOut',   label: 'Alejar' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Ventana principal ──────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Oma — Punto de Venta',
  });

  mainWindow.once('ready-to-show', function () {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  mainWindow.loadFile(
    path.join(__dirname, '..', 'renderer', 'views', 'caja.html')
  );

  createMenu();

  mainWindow.on('close', function (e) {
    if (forceClose) return;

    if (isDownloading) {
      e.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type:      'warning',
        title:     'Descarga en progreso',
        message:   'Se está descargando una actualización',
        detail:    '¿Cerrar de todos modos y cancelar la descarga?',
        buttons:   ['Seguir esperando', 'Cerrar de todos modos'],
        defaultId: 0,
        cancelId:  1,
      }).then(function ({ response }) {
        if (response === 1) { forceClose = true; mainWindow.close(); }
      });
      return;
    }

    let turno = null;
    try { turno = Turnos.obtenerActivo(); } catch { /* DB puede no estar lista aún */ }
    if (!turno) return;

    e.preventDefault();
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Turno abierto',
      message: 'Hay un turno abierto',
      detail: 'Debés cerrar el turno antes de salir.\n¿Ir a la pantalla de Turno ahora?',
      buttons: ['Ir a Turno', 'Salir sin cerrar'],
      defaultId: 0,
      cancelId: 1,
    }).then(function ({ response }) {
      if (response === 0) {
        mainWindow.loadFile(
          path.join(__dirname, '..', 'renderer', 'views', 'turno.html')
        );
      } else {
        forceClose = true;
        mainWindow.close();
      }
    });
  });
}

// ── Ventana de login ───────────────────────────────────────────
function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 420,
    height: 500,
    resizable: false,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Oma — Iniciar sesión',
  });
  loginWindow.setMenuBarVisibility(false);
  loginWindow.loadFile(
    path.join(__dirname, '..', 'renderer', 'views', 'login.html')
  );
}

// ── Sincronización periódica (cada 30 min) ─────────────────────
function iniciarSyncInterval() {
  if (syncInterval) clearInterval(syncInterval);

  syncInterval = setInterval(async () => {
    if (!negocioIdActivo) return;
    try {
      await syncPendientes(getDb(), firestore, negocioIdActivo, auth);

      const lic = await verificarLicencia(firestore, negocioIdActivo);
      if (lic.activa) {
        guardarTokenLocal({
          negocioId:   negocioIdActivo,
          activa:      true,
          vencimiento: lic.vencimiento instanceof Date
            ? lic.vencimiento.getTime()
            : Date.now() + 30 * 24 * 60 * 60 * 1000,
          timestamp: Date.now(),
        });
      } else {
        clearInterval(syncInterval);
        BrowserWindow.getAllWindows().forEach(w => w.close());
        dialog.showErrorBox(
          'Licencia suspendida',
          'Tu licencia fue suspendida. Contactate con OmaTech.'
        );
        app.quit();
      }
    } catch { /* sin internet — se reintenta en el próximo ciclo */ }
  }, 30 * 60 * 1000);
}

// ── Handlers de autenticación y sync ──────────────────────────
function registerAuthHandlers() {
  ipcMain.on('modal-state',       (_e, open) => { modalAbierto      = !!open; });
  ipcMain.on('modal-cobro-state', (_e, open) => { modalCobroAbierto = !!open; });

  ipcMain.handle('sync:manual', async () => {
    if (!negocioIdActivo) return { ok: false, error: 'Sin sesión activa.' };
    try {
      const resultado = await syncPendientes(getDb(), firestore, negocioIdActivo, auth);
      return { ok: true, ...resultado };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('auth:login', async (_e, email, password) => {
    try {
      const user = await loginConEmail(auth, email, password);
      const lic  = await verificarLicencia(firestore, user.uid);

      if (!lic.activa) {
        const mensajes = {
          inactiva:  'Licencia suspendida. Contactate con OmaTech.',
          no_existe: 'No se encontró una licencia para este usuario. Contactate con OmaTech.',
          error:     `Error al verificar licencia (${lic.detalle ?? 'sin detalles'}). Revisá tu conexión o contactá a OmaTech.`,
        };
        return { ok: false, error: mensajes[lic.razon] ?? 'No se pudo verificar la licencia.' };
      }

      guardarTokenLocal({
        negocioId:   user.uid,
        activa:      true,
        vencimiento: lic.vencimiento instanceof Date
          ? lic.vencimiento.getTime()
          : Date.now() + 30 * 24 * 60 * 60 * 1000,
        timestamp: Date.now(),
        credenciales: {
          email:    encriptar(email,    user.uid),
          password: encriptar(password, user.uid),
        },
      });

      negocioIdActivo = user.uid;
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
      createWindow();
      iniciarSyncInterval();
      return { ok: true };

    } catch (err) {
      const CREDS = [
        'auth/invalid-credential',
        'auth/user-not-found',
        'auth/wrong-password',
        'auth/invalid-email',
      ];
      const msg = CREDS.includes(err.code)
        ? 'Correo o contraseña incorrectos.'
        : err.code === 'auth/too-many-requests'
          ? 'Demasiados intentos fallidos. Intentá más tarde.'
          : err.code === 'auth/network-request-failed'
            ? 'Sin conexión a internet. Verificá tu red.'
            : (err.message || 'Error al iniciar sesión.');
      return { ok: false, error: msg };
    }
  });
}

// ── Auto-updater ───────────────────────────────────────────────
const log = require('electron-log');
autoUpdater.logger                = log;
log.transports.file.level         = 'info';

autoUpdater.autoDownload          = false;
autoUpdater.autoInstallOnAppQuit  = false;
autoUpdater.allowPrerelease       = false;
autoUpdater.allowDowngrade        = false;

autoUpdater.on('update-available', (info) => {
  pendingUpdate = { version: info.version, releaseNotes: info.releaseNotes || null };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', pendingUpdate);
  }
});

autoUpdater.on('update-not-available', () => { /* silencioso */ });

autoUpdater.on('error', (err) => {
  log.error('[updater] error:', err.message);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

autoUpdater.on('download-progress', (progressInfo) => {
  log.info(
    `[updater] download-progress: ${Math.round(progressInfo.percent)}%` +
    ` @ ${Math.round(progressInfo.bytesPerSecond / 1024)} KB/s` +
    ` — ${progressInfo.transferred}/${progressInfo.total} bytes`
  );
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-progress', {
      percent:        Math.round(progressInfo.percent),
      bytesPerSecond: Math.round(progressInfo.bytesPerSecond),
      transferred:    progressInfo.transferred,
      total:          progressInfo.total,
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  isDownloading = false;
  pendingUpdate  = null;
  log.info('[updater] update-downloaded: v' + info.version);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded');
  }
});

// ── Inicio ─────────────────────────────────────────────────────
app.whenReady().then(async () => {
  initDatabase();
  registerHandlers();
  registerAuthHandlers();
  ReportScheduler.iniciar();

  ipcMain.handle('updater:get-pending', () => pendingUpdate || null);

  ipcMain.handle('updater:start-download', async () => {
    if (!app.isPackaged) {
      log.info('[updater] start-download ignorado en dev (app no empaquetada)');
      return;
    }
    if (isDownloading) {
      log.info('[updater] start-download ignorado — descarga ya en curso');
      return;
    }
    isDownloading = true;
    log.info('[updater] iniciando descarga con autoUpdater.downloadUpdate()...');
    try {
      await autoUpdater.downloadUpdate();
      // El evento update-downloaded ya disparó y manejó isDownloading + IPC al renderer
      log.info('[updater] downloadUpdate() resolvió correctamente');
    } catch (err) {
      isDownloading = false;
      log.error('[updater] error en descarga:', err.message);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-error', err.message);
      }
    }
  });

  ipcMain.handle('updater:install', () => {
    log.info('[updater] instalando con autoUpdater.quitAndInstall()');
    forceClose = true;
    autoUpdater.quitAndInstall(true, true);
  });

  ipcMain.handle('caja:abrirComprobante', (_e, { transaccionId, montoRecibido, vuelto, propina }) => {
    const popup = new BrowserWindow({
      width: 560,
      height: 700,
      title: `Comprobante #${transaccionId}`,
      parent: mainWindow,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    popup.setMenuBarVisibility(false);
    popup.loadFile(
      path.join(__dirname, '..', 'renderer', 'views', 'comprobante.html'),
      { query: {
          id:       String(transaccionId),
          recibido: String(montoRecibido ?? 0),
          vuelto:   String(vuelto ?? 0),
          propina:  String(propina ?? 0),
      }}
    );
  });

  // Startup offline-first: si hay token local válido, cablear negocioIdActivo
  // y reautenticar en background antes de que la ventana haga su primera sync.
  const tokenRaw = leerTokenRaw();
  if (tokenRaw) {
    negocioIdActivo = tokenRaw.negocioId;
    iniciarSyncInterval();
    (async () => {
      await reautenticarDesdeToken(auth, tokenRaw);
      if (!auth.currentUser) return; // sin internet: aceptar token local, sync cuando vuelva

      // Sync inmediata al arrancar con conexión (no esperar 30 min del timer)
      syncPendientes(getDb(), firestore, negocioIdActivo, auth).catch(() => {});

      const lic = await verificarLicencia(firestore, negocioIdActivo);
      // Solo cerrar si el admin suspendió la licencia explícitamente.
      // razon 'error' o 'no_existe' = problema transitorio o de datos → no bloquear.
      if (lic.razon === 'inactiva') {
        BrowserWindow.getAllWindows().forEach(w => w.close());
        dialog.showErrorBox('Licencia suspendida', 'Tu licencia fue suspendida. Contactate con OmaTech.');
        app.quit();
        return;
      }
      if (lic.activa) {
        guardarTokenLocal({
          ...tokenRaw,
          activa:      true,
          vencimiento: lic.vencimiento instanceof Date
            ? lic.vencimiento.getTime()
            : Date.now() + 30 * 24 * 60 * 60 * 1000,
          timestamp:   Date.now(),
        });
      }
    })();
  }

  // auth-guard.js en cada vista redirige a login.html si no hay sesión local
  createWindow();

  // F1-F8: atajos globales de sistema — funcionan sin importar el foco del HTML
  // F1/F2 tienen comportamiento doble: navegan normalmente, pero dentro del modal cobro
  // envían el evento de cobro correspondiente en lugar de navegar.
  globalShortcut.register('F1', () => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isFocused()) return;
    if (modalCobroAbierto) {
      mainWindow.webContents.send('cobrar-con-ticket');
    } else {
      mainWindow.webContents.send('navegar-global', 'caja.html');
    }
  });
  globalShortcut.register('F2', () => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isFocused()) return;
    if (modalCobroAbierto) {
      mainWindow.webContents.send('cobrar-sin-ticket');
    } else {
      mainWindow.webContents.send('navegar-global', 'catalogo.html');
    }
  });
  const F_MODULOS = {
    F3: 'inventario.html',
    F4: 'clientes.html',
    F5: 'proveedores.html',
    F6: 'informes.html',
    F7: 'turno.html',
    F8: 'configuracion.html',
  };
  Object.entries(F_MODULOS).forEach(([key, file]) => {
    globalShortcut.register(key, () => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
        mainWindow.webContents.send('navegar-global', file);
      }
    });
  });

  // F12: abrir modal de cobro siempre, aunque haya un input con foco
  globalShortcut.register('F12', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
      mainWindow.webContents.send('abrir-cobro');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Auto-updater solo en producción; en dev checkForUpdates falla o cuelga
  if (app.isPackaged) {
    process.env.GH_TOKEN = '';
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  forceClose = true;
  try { hacerBackup(); } catch { /* no bloquear el cierre si falla */ }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
