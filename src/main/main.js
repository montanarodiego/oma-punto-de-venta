require('dotenv').config();
const { app, BrowserWindow, Menu, ipcMain, dialog, globalShortcut, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { initDatabase, getDb } = require('./database');
const { registerHandlers }    = require('./ipc');
const { hacerBackup }         = require('./backup');
const ReportScheduler         = require('./report-scheduler');
const Turnos = require('./models/turnos');

// Firebase — tolerante a fallos: si falta config o hay error de red, la app
// arranca igual en modo offline. Login local y SQLite no dependen de Firebase.
let auth = null, firestore = null;
let loginConEmail = async () => { throw new Error('Firebase no disponible'); };
let reautenticarDesdeToken = async () => {};
let encriptar = (v) => v;
let syncPendientes = async () => ({});
let verificarLicencia = async () => ({ activa: true });
let guardarTokenLocal = () => {};
let leerTokenRaw = () => null;

try {
  const fb = require('./firebase');
  auth      = fb.auth;
  firestore = fb.firestore;
} catch (err) {
  require('electron-log').warn('[firebase] init falló — modo offline:', err.message);
}

try {
  const authMod = require('./auth');
  loginConEmail          = authMod.loginConEmail;
  reautenticarDesdeToken = authMod.reautenticarDesdeToken;
} catch (err) {
  require('electron-log').warn('[auth] módulo no disponible:', err.message);
}

try {
  const syncMod = require('./sync');
  encriptar          = syncMod.encriptar;
  syncPendientes     = syncMod.syncPendientes;
  verificarLicencia  = syncMod.verificarLicencia;
  guardarTokenLocal  = syncMod.guardarTokenLocal;
  leerTokenRaw       = syncMod.leerTokenRaw;
} catch (err) {
  require('electron-log').warn('[sync] módulo no disponible:', err.message);
}

const HUD_ZOOM_FACTORS = { compacto: 1.0, normal: 1.4, grande: 1.85, gigante: 2.4 };

function getHudZoomFactor() {
  try {
    const row = getDb().prepare("SELECT valor FROM configuracion WHERE clave = 'tamano_hud'").get();
    return HUD_ZOOM_FACTORS[row?.valor] ?? 1.0;
  } catch {
    return 1.0;
  }
}

let mainWindow        = null;
let loginWindow       = null;
let negocioIdActivo   = null;
let syncInterval      = null;
let modalAbierto      = false;
let modalCobroAbierto = false;
let forceClose        = false;
let pendingUpdate     = null; // cached update info for late-loading renderers
let isDownloading     = false;
let ultimaSync        = null; // timestamp ms de la última sync exitosa

// DB integrity warning — set at startup if quick_check no devuelve 'ok'
let dbIntegrityWarning = null;

// Backup periódico
const BACKUP_HORAS       = 4;   // backup por tiempo cada N horas
const BACKUP_CADA_VENTAS = 20;  // backup por volumen cada N ventas
let backupUltimoTxCount  = 0;

// ── Menú (solo Ver / DevTools) ─────────────────────────────────
function createMenu() {
  const submenu = [
    { role: 'reload', label: 'Recargar' },
  ];
  if (!app.isPackaged) {
    submenu.push({ role: 'toggleDevTools', label: 'DevTools' });
  }
  submenu.push(
    { type: 'separator' },
    { role: 'resetZoom', label: 'Zoom normal' },
    { role: 'zoomIn',    label: 'Acercar' },
    { role: 'zoomOut',   label: 'Alejar' },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Ver', submenu }]));
}

const isDev = !app.isPackaged;
const VITE_URL = 'http://localhost:5173';

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

  // Aplicar zoom nativo antes de cargar la página — evita flash de tamaño
  mainWindow.webContents.setZoomFactor(getHudZoomFactor());

  mainWindow.once('ready-to-show', function () {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  if (isDev) {
    mainWindow.loadURL(VITE_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'));
  }

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
        if (isDev) mainWindow.loadURL(VITE_URL + '/#/turno');
        else mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'), { hash: '#/turno' });
      } else {
        forceClose = true;
        mainWindow.close();
      }
    });
  });
}

// ── Ventana de login (legacy, no usada en React SPA) ────────────
function createLoginWindow() {
  // La SPA React maneja el login internamente vía HashRouter
  createWindow();
}

// ── Sincronización periódica (cada 30 min) ─────────────────────
function iniciarSyncInterval() {
  if (syncInterval) clearInterval(syncInterval);

  syncInterval = setInterval(async () => {
    if (!negocioIdActivo) return;
    try {
      const res = await syncPendientes(getDb(), firestore, negocioIdActivo, auth);
      if (!res.error) ultimaSync = Date.now();

      const lic = await verificarLicencia(firestore, negocioIdActivo);
      if (lic.activa) {
        const prevToken = leerTokenRaw() ?? {};
        guardarTokenLocal({
          ...prevToken,
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
      if (!resultado.error) ultimaSync = Date.now();
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
      // La React SPA maneja la navegación internamente — no crear ventana nueva
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

  ipcMain.handle('auth:estadoSync', () => ({
    activa:            negocioIdActivo !== null,
    firebaseConectado: !!(auth?.currentUser),
    ultimaSync,
  }));
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

// ── Backup periódico ───────────────────────────────────────────
function hacerBackupSilencioso(motivo) {
  try {
    hacerBackup();
    backupUltimoTxCount = getDb()
      .prepare("SELECT COUNT(*) AS c FROM transacciones WHERE estado = 'vigente'")
      .get().c;
    log.info(`[backup-auto] Realizado: ${motivo}`);
  } catch (err) {
    log.error(`[backup-auto] Falló (${motivo}):`, err.message);
  }
}

function iniciarBackupPeriodico() {
  // Por tiempo: cada BACKUP_HORAS horas sin importar la actividad
  setInterval(
    () => hacerBackupSilencioso(`periódico cada ${BACKUP_HORAS} h`),
    BACKUP_HORAS * 60 * 60 * 1000
  );

  // Por volumen: revisar cada 5 min si hubo BACKUP_CADA_VENTAS ventas nuevas
  setInterval(() => {
    try {
      const actual = getDb()
        .prepare("SELECT COUNT(*) AS c FROM transacciones WHERE estado = 'vigente'")
        .get().c;
      if (actual - backupUltimoTxCount >= BACKUP_CADA_VENTAS) {
        hacerBackupSilencioso(`${BACKUP_CADA_VENTAS} ventas nuevas`);
      }
    } catch { /* DB no disponible aún, siguiente ciclo */ }
  }, 5 * 60 * 1000);
}

// ── Inicio ─────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // ── CSP — solo en producción, no rompe el HMR de Vite en dev ─────
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com wss://*.firebaseio.com https://api.github.com; " +
            "img-src 'self' data:; " +
            "object-src 'none'; " +
            "base-uri 'self'",
          ],
        },
      });
    });
  }

  initDatabase();

  // ── PRAGMA quick_check al arrancar ────────────────────────────
  // Solo detecta y avisa; NO repara automático. Si hay problemas,
  // correr recover-db.js con la app cerrada.
  try {
    const rows  = getDb().pragma('quick_check');
    const lines = rows.map(r => r.quick_check);
    if (lines.length !== 1 || lines[0] !== 'ok') {
      dbIntegrityWarning = { ok: false, detalles: lines };
      log.error('[db] quick_check al arrancar encontró problemas:', lines.join(' | '));
    } else {
      log.info('[db] quick_check al arrancar: ok');
    }
  } catch (err) {
    log.error('[db] quick_check falló:', err.message);
  }

  // Línea base para el backup por volumen de ventas
  try {
    backupUltimoTxCount = getDb()
      .prepare("SELECT COUNT(*) AS c FROM transacciones WHERE estado = 'vigente'")
      .get().c;
  } catch { /* primer arranque sin datos */ }

  iniciarBackupPeriodico();

  registerHandlers();
  registerAuthHandlers();
  ReportScheduler.iniciar();

  ipcMain.handle('db:integrity-status', () => dbIntegrityWarning);
  ipcMain.handle('updater:get-pending', () => pendingUpdate || null);

  ipcMain.handle('ui:setZoom', (_e, factor) => {
    const f = Number(factor);
    if (mainWindow && !mainWindow.isDestroyed() && f > 0) {
      mainWindow.webContents.setZoomFactor(f);
    }
  });

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
    const hashParams = `?id=${transaccionId}&recibido=${montoRecibido??0}&vuelto=${vuelto??0}&propina=${propina??0}`;
    if (isDev) {
      popup.loadURL(`${VITE_URL}/#/comprobante${hashParams}`);
    } else {
      popup.loadFile(
        path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'),
        { hash: `#/comprobante${hashParams}` }
      );
    }
  });

  // Startup offline-first: cablear negocioIdActivo y re-auth Firebase en background.
  // Credenciales de sync vienen de oma-creds.json; el negocioId del cliente viene de
  // license.json (tokenRaw) o de oma-creds.negocio_id en la primera instalación.
  const creds    = require('./credentials');
  const tokenRaw = leerTokenRaw();

  if (tokenRaw) {
    negocioIdActivo = tokenRaw.negocioId;
    iniciarSyncInterval();
    (async () => {
      if (!auth) return;
      if (creds.firebase_email && creds.firebase_password) {
        try { await loginConEmail(auth, creds.firebase_email, creds.firebase_password); }
        catch { /* sin internet — sync cuando vuelva */ }
      } else {
        await reautenticarDesdeToken(auth, tokenRaw);
      }
      if (!auth.currentUser) return;

      syncPendientes(getDb(), firestore, negocioIdActivo, auth).catch(() => {});

      const lic = await verificarLicencia(firestore, negocioIdActivo);
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
  } else if (creds.firebase_email && creds.firebase_password && creds.negocio_id) {
    // Primera instalación: sin license.json pero con credenciales embebidas en oma-creds.json.
    // negocio_id es el uid del cliente en Firestore, independiente de la cuenta de sync.
    (async () => {
      if (!auth || !firestore) return;
      try {
        await loginConEmail(auth, creds.firebase_email, creds.firebase_password);
        const negocioId = creds.negocio_id;
        const lic = await verificarLicencia(firestore, negocioId);
        if (lic.activa) {
          guardarTokenLocal({
            negocioId,
            activa:      true,
            vencimiento: lic.vencimiento instanceof Date
              ? lic.vencimiento.getTime()
              : Date.now() + 30 * 24 * 60 * 60 * 1000,
            timestamp:   Date.now(),
          });
          negocioIdActivo = negocioId;
          iniciarSyncInterval();
        } else {
          require('electron-log').warn('[auth] licencia no activa para negocio_id de oma-creds:', lic.razon);
        }
      } catch (e) {
        require('electron-log').warn('[auth] primera auth desde oma-creds falló:', e.message);
      }
    })();
  }

  // auth-guard.js en cada vista redirige a login.html si no hay sesión local
  createWindow();

  // F1-F9: atajos globales de sistema — funcionan sin importar el foco del HTML
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
    F6: 'pedidos.html',
    F7: 'informes.html',
    F8: 'turno.html',
  };
  Object.entries(F_MODULOS).forEach(([key, file]) => {
    globalShortcut.register(key, () => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
        mainWindow.webContents.send('navegar-global', file);
      }
    });
  });
  // F9: verificador de precios (overlay global, sin navegación)
  globalShortcut.register('F9', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
      mainWindow.webContents.send('abrir-verificador');
    }
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
