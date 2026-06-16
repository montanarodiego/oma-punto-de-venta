# OmaTech POS

Sistema de punto de venta (POS) de escritorio para comercios chicos — kioscos y PyMEs argentinas.

**Versión actual:** v2.3.1 · [Último release](https://github.com/montanarodiego/oma-punto-de-venta/releases/latest)

> 🤝 **¿Recién llegás al proyecto?** Leé primero [`docs/handoff.md`](docs/handoff.md) —
> estado actual, modelo de licencias/activación, cómo testear y qué queda pendiente.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Shell | Electron 29 |
| Renderer | React 19 + TypeScript + Vite |
| UI | Tailwind CSS v3 + Framer Motion v12 |
| Base de datos local | better-sqlite3 (SQLite, WAL, FK on) |
| Nube | Firebase Auth + Firestore |
| Actualizaciones | electron-updater |
| Build | electron-builder |

---

## Correr en desarrollo

```bash
npm install
npm run dev
```

Levanta Vite en `http://localhost:5173` y Electron carga esa URL automáticamente.

> **Requisito:** `oma-creds.json` debe existir en la raíz con las credenciales Firebase reales (ver sección de archivos locales).

---

## Generar el instalador

```bash
npm run dist
```

Produce `dist/OmaTech.POS.Setup.<versión>.exe` y `dist/latest.yml`.

---

## Estructura de carpetas

```
src/
  main/                    # Proceso Electron (Node.js)
    main.js                # Entry point: ventanas, ciclo de vida, auto-updater
    ipc.js                 # Todos los handlers ipcMain.handle
    preload.js             # Expone window.api al renderer (contextIsolation: true)
    database.js            # Schema SQLite y migraciones
    sync.js                # Sync a Firebase + validación de licencia
    auth.js                # Login/re-auth con Firebase Auth
    backup.js              # Backup automático y restauración
    printer.js             # Impresora térmica ESC/POS
    mailer.js              # Emails internos de soporte
    report-mailer.js       # Reporte de ventas por email
    report-scheduler.js    # Scheduler de reportes automáticos
    credentials.js         # Gmail (no commitear — ver credentials.example.js)
    models/                # CRUD por tabla SQLite
  renderer/                # SPA React
    pages/                 # Una página por módulo
      caja/                # Submódulos de Caja (carrito, cobro, anulación, etc.)
    components/
      ui/                  # Button, Card, Input, Modal, Toggle, Badge, VirtualTable
      layout/              # AppShell (sidebar + outlet animado), Sidebar
    context/               # SessionContext, ToastContext
    hooks/                 # useNavigateGlobal, useCarritoKeyboard, etc.
    styles/                # globals.css — design system con variables CSS
    types/                 # api.d.ts — tipado completo de window.api
assets/                    # Íconos de la app
scripts/                   # Utilidades de desarrollo
  seed-perf.js             # Inserta 5000 artículos para testing de performance
  recover-db.js            # Repara índices FTS5 corruptos (correr con app cerrada)
tests/                     # Tests unitarios y de contrato backend
docs/                      # Documentación técnica
  handoff.md               # Estado actual + traspaso (LEER PRIMERO)
  arquitectura.md          # Arquitectura del sistema y módulos
  deploy.md                # Proceso de release y operaciones
```

---

## Archivos de configuración local (no commitear)

| Archivo | Propósito |
|---------|-----------|
| `oma-creds.json` | Credenciales Gmail del mailer (`GMAIL_USER`, `GMAIL_APP_PASSWORD`). **Ya no lleva `license_key`** — la licencia se activa por pantalla (ver [handoff.md](docs/handoff.md) §3). |
| `.env` | `GH_TOKEN`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| `src/main/credentials.js` | Cuenta Gmail para el mailer (copiar de `credentials.example.js`) |

> Para activar en dev sin pantalla: `OMA_LICENSE_KEY=OMA-XXXX-... npm run dev`.

---

## Módulos de la app

| Módulo | Tecla | Descripción |
|--------|-------|-------------|
| Caja | F1 | Venta, múltiples tickets, escáner, formas de pago, anulaciones |
| Catálogo | F2 | CRUD artículos, departamentos, historial de precios, kits, promociones |
| Inventario | F3 | Ajustes de stock, movimientos, kardex |
| Clientes | F4 | CRUD, cuenta corriente, pagos, estado de cuenta imprimible |
| Proveedores | F5 | CRUD, pedidos de compra, recepción de mercadería |
| Informes | F6 | KPIs, gráficos, top productos, utilidad bruta, ventas por departamento |
| Turno | F7 | Apertura/cierre, movimientos de caja, corte Z, email de cierre |
| Configuración | F8 | Datos del negocio, usuarios, backup, sync Firebase, impresora |

---

## Historial de versiones

Ver [CHANGELOG.md](CHANGELOG.md).
