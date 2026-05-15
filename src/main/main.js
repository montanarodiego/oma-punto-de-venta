const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { initDatabase } = require('./database');
const { registerHandlers } = require('./ipc');

let mainWindow;

function createMenu(win) {
  const views = [
    { label: 'Caja',          file: 'caja.html' },
    { label: 'Catálogo',      file: 'catalogo.html' },
    { label: 'Clientes',      file: 'clientes.html' },
    { label: 'Informes',      file: 'informes.html' },
    { label: 'Configuración', file: 'configuracion.html' },
  ];

  const viewItems = views.map(v => ({
    label: v.label,
    click() {
      win.loadFile(path.join(__dirname, '..', 'renderer', 'views', v.file));
    },
  }));

  const template = [
    {
      label: 'Navegación',
      submenu: viewItems,
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'toggleDevTools', label: 'DevTools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
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

  createMenu(mainWindow);
}

app.whenReady().then(() => {
  initDatabase();
  registerHandlers();
  createWindow();

  ipcMain.handle('caja:abrirComprobante', (_e, { transaccionId, montoRecibido, vuelto }) => {
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
      }}
    );
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
