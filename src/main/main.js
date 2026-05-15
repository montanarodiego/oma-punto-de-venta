const { app, BrowserWindow, Menu } = require('electron');
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
