const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { initDatabase, getDb } = require('./database');
const { registerHandlers }    = require('./ipc');
const { hacerBackup }         = require('./backup');
const { auth, firestore }     = require('./firebase');
const { loginConEmail, reautenticarDesdeToken } = require('./auth');
const {
  encriptar,
  syncPendientes,
  verificarLicencia,
  guardarTokenLocal,
  verificarTokenLocal,
} = require('./sync');
const Turnos = require('./models/turnos');

let mainWindow      = null;
let loginWindow     = null;
let negocioIdActivo = null;
let syncInterval    = null;
let modalAbierto    = false;
let forceClose      = false;

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
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Oma — Punto de Venta',
  });

  mainWindow.loadFile(
    path.join(__dirname, '..', 'renderer', 'views', 'caja.html')
  );

  createMenu();

  mainWindow.on('close', function (e) {
    if (forceClose) return;
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
  ipcMain.on('modal-state', (_e, open) => { modalAbierto = !!open; });

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

// ── Inicio ─────────────────────────────────────────────────────
app.whenReady().then(async () => {
  initDatabase();
  registerHandlers();
  registerAuthHandlers();

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

  // auth-guard.js en cada vista redirige a login.html si no hay sesión local
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  forceClose = true;
  try { hacerBackup(); } catch { /* no bloquear el cierre si falla */ }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
