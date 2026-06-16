# Arquitectura — OmaTech POS

## Visión general

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON SHELL                           │
│                                                                 │
│  ┌──────────────────────┐        ┌───────────────────────────┐  │
│  │    MAIN PROCESS      │        │    RENDERER PROCESS       │  │
│  │    (Node.js)         │◄──────►│    (Chromium + React)     │  │
│  │                      │  IPC   │                           │  │
│  │  • main.js           │        │  • React 19 SPA           │  │
│  │  • ipc.js            │        │  • Hash Router            │  │
│  │  • database.js       │        │  • Tailwind CSS v3        │  │
│  │  • sync.js           │        │  • Framer Motion v12      │  │
│  │  • auth.js           │        │  • SessionContext         │  │
│  │  • backup.js         │        │  • ToastContext           │  │
│  │  • printer.js        │        │                           │  │
│  │  • mailer.js         │        └───────────────────────────┘  │
│  │  • models/           │                                       │
│  └──────────┬───────────┘                                       │
│             │                                                   │
│     ┌───────▼────────┐   ┌──────────────────────┐              │
│     │  SQLite (WAL)  │   │  Firebase            │              │
│     │  oma-pos.db    │   │  • Auth (licencias)  │              │
│     │  (offline ok)  │   │  • Firestore (sync)  │              │
│     └────────────────┘   └──────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Proceso Main (Node.js)

El proceso main es la capa backend de la app. Solo tiene acceso a Node.js y Electron APIs.

### main.js
- Crea y gestiona las ventanas de Electron (`BrowserWindow`)
- Registra atajos globales F1–F9 y F12
- Inicia la sincronización periódica con Firebase (cada 30 min)
- Maneja el ciclo de vida: startup, backup al cerrar, auto-updater

### ipc.js
Punto único de comunicación main↔renderer. Registra todos los handlers `ipcMain.handle`. Cada handler valida rol (`onlyAdmin`), llama a un modelo y devuelve el resultado.

Namespaces: `articulos`, `departamentos`, `clientes`, `transacciones`, `devoluciones`, `turnos`, `movimientos`, `inventario`, `kits`, `promociones`, `proveedores`, `pedidosCompra`, `recepciones`, `informes`, `usuarios`, `config`, `backup`, `printer`, `reporteEmail`, `sync`, `log`.

### preload.js
Expone `window.api` al renderer usando `contextBridge`. Cada método es un wrapper de `ipcRenderer.invoke`. El renderer solo puede llamar funciones listadas explícitamente acá — no tiene acceso a Node.js.

### database.js
- Abre o crea `oma-pos.db` en `app.getPath('userData')`
- Habilita `WAL`, `foreign_keys = ON`, `synchronous = NORMAL`
- Crea las tablas si no existen (24 CREATE TABLE + índices + FTS5)
- Ejecuta migraciones incrementales

### sync.js
- `syncPendientes()` — lee filas con `sync_status = 'pending'` de todas las tablas y las escribe en Firestore bajo `negocios/{negocioId}/{tabla}/{rowId}`
- `verificarLicencia()` — lee `negocios/{negocioId}.licencia` en Firestore y cierra la app si está inactiva o vencida
- `guardarTokenLocal()` / `verificarTokenLocal()` — token offline cifrado con AES-256-GCM en `license.json`

### activacion.js
Modelo de licencia **nuevo** (custom token), reemplaza al horneado de credenciales.
- `leerLicenseKey()` — devuelve el `licenseKey`: 1) store cifrado (DPAPI), 2) env `OMA_LICENSE_KEY` (dev), 3) `oma-creds.json` legacy. `null` → el renderer muestra la pantalla de activación.
- `guardarLicenseKey()` — cifra el key con `safeStorage` (DPAPI en Windows) en `userData/oma-license-key`.
- `activar(auth, key)` — `POST oma-manager /api/activar` → `{ token, negocioId, vencimiento }` → `signInWithCustomToken`. El uid queda == `negocioId` (lo que piden las reglas de Firestore).

### models/
Un archivo por tabla SQLite. Cada modelo exporta funciones sync (better-sqlite3 es síncrono). Las operaciones de escritura crítica usan `db.transaction()` para garantizar atomicidad.

---

## Proceso Renderer (React SPA)

El renderer no tiene acceso a Node.js. Solo puede llamar `window.api.*` (lo que preload expuso) y APIs del browser.

### Routing
Hash Router (`#/caja`, `#/catalogo`, etc.). En dev Electron carga `http://localhost:5173`. En prod carga `dist/renderer/index.html`.

Atajos F1–F8 en main.js envían evento IPC `navegar-global` → `useNavigateGlobal.ts` los convierte en navegación React Router.

### SessionContext
Guarda el usuario local activo (id, nombre, rol). Se hidrata desde `localStorage` al arrancar y sincroniza `window.SESSION` para que los handlers IPC con `onlyAdmin` funcionen.

### Flujo de arranque y autenticación
El gating de pantallas vive en `App.tsx`: `checking → needs-activation → (no-users | ready)`.
1. **Activación** (`licencia:estado` IPC) → si la instalación no está activada (sin key ni token local válido), muestra `Activacion.tsx` para tipear el `licenseKey`. Ver [activacion.js](#activacionjs).
2. **Setup** → si no hay usuarios, `Setup.tsx` crea el primer admin (nombre, usuario, **email**, contraseña).
3. **Login local** (`usuarios:login` IPC) → bcryptjs (tolerante a mayúsculas/espacios) → `setSession()` → navega a `/caja`.
4. En prod sin internet: `verificarTokenLocal()` en main.js → si el token offline es válido, arranca directo.

> Dos capas separadas: la **licencia** (nube, `negocioId`, la maneja `oma-manager`) y el **usuario operador** (local, SQLite, lo crea el cliente). Ver [handoff.md](handoff.md) §1.

---

## Flujo de una venta (camino crítico)

```
Cajero escanea código
      │
      ▼
CodigoInput.tsx detecta scanner (delta < 50ms, ≥ 3 chars)
      │  o Enter manual
      ▼
Caja.tsx: procesarCodigo(codigo)
      │
      ▼
window.api.articulos.getByCodigo(codigo)
      │  IPC → ipc.js → models/articulos.js
      │  SELECT * FROM articulos WHERE codigo = ?
      ▼
agregarArticulo(art) → setTickets(prev => ...)
  • fetchea promociones por volumen
  • calcula precio (unitario o mayoreo)
  • agrega/incrementa ítem en carrito React state (funcional updater, sin race condition)
      │
      ▼
Cajero confirma cobro (F12 → ModalCobro → F1/F2)
      │
      ▼
window.api.transacciones.create(data)
      │  IPC → ipc.js → models/transacciones.js
      │
      ▼
db.transaction() {                          ← ACID garantizado
  INSERT INTO transacciones
  INSERT INTO detalle_transaccion (× ítems)
  UPDATE articulos SET stock_actual = stock_actual - ?   (× ítems con inventario)
  UPDATE clientes SET saldo_vencido = saldo_vencido + ?  (solo si es CC)
  INSERT INTO movimientos_inventario (audit trail)
  UPDATE articulos SET sync_status = 'pending'
}
      │
      ▼
Abre ventana Comprobante (BrowserWindow popup)
Imprime ticket ESC/POS (fire-and-forget)
      │
      ▼
sync.js syncPendientes() → Firestore (cada 30 min o sync manual)
```

---

## Módulos

### Caja (`pages/Caja.tsx` + `pages/caja/`)
- Múltiples tickets simultáneos (pestañas)
- Detección de scanner por velocidad de input (< 50ms entre chars)
- Alertas de stock en 3 niveles al agregar artículos
- Formas de pago: efectivo, débito, crédito, transferencia, cuenta corriente, mixto
- Vuelto automático y verificación de límite de efectivo
- Movimientos de caja (entradas/salidas con categorías)
- Anulaciones totales y devoluciones parciales por ítem
- Ítem de precio libre (Insert)

### Catálogo (`pages/Catalogo.tsx`)
- CRUD artículos con historial de precios auditado
- Departamentos con colores
- Kits (artículo compuesto de componentes)
- Promociones por volumen (precio especial por cantidad)
- Búsqueda full-text con FTS5 + VirtualTable para listas grandes

### Inventario (`pages/Inventario.tsx`)
- Ajustes manuales de stock con motivo y audit trail
- Listado de movimientos por artículo (kardex)
- Vista de stock bajo

### Clientes (`pages/Clientes.tsx`)
- CRUD clientes con límite de crédito
- Cuenta corriente: saldo, pagos/abonos, historial de transacciones
- Estado de cuenta imprimible (ticket ESC/POS)

### Proveedores (`pages/Proveedores.tsx` + `pages/PedidosCompra.tsx`)
- CRUD proveedores
- Órdenes de compra: borrador → enviado → recibido
- Recepción de mercadería con actualización de stock
- Compras sugeridas por stock mínimo
- Exportación a PDF y CSV

### Informes (`pages/Informes.tsx`)
- KPIs: ventas del período, ganancia, ticket promedio, mejor día
- Top artículos más vendidos
- Utilidad bruta por artículo con margen %
- Gráfico ventas por día (Chart.js), por departamento, evolución mensual
- Formas de pago con porcentaje
- Stock bajo con exportación CSV

### Turno (`pages/Turno.tsx`)
- Apertura/cierre con efectivo inicial y real
- Resumen en vivo: ventas por forma de pago, movimientos de caja
- Diferencia de caja con alerta visual
- Corte Z ESC/POS al cerrar
- Email de resumen al cerrar turno
- Historial de turnos anteriores

### Configuración (`pages/Configuracion.tsx`)
- Datos del negocio (nombre, CUIT, dirección, moneda, IVA)
- Usuarios del sistema con roles (admin/cajero)
- Backup automático y manual, restauración desde UI
- Sincronización Firebase manual
- Impresora térmica: selección y ticket de prueba
- Reporte de ventas por email (Gmail) con frecuencia configurable

---

## Persistencia y sync

- **SQLite es la fuente de verdad.** La app funciona 100% offline.
- **Firebase es opcional.** Se usa para validar licencia y sincronizar datos en la nube.
- Filas modificadas se marcan con `sync_status = 'pending'`. `syncPendientes()` las sube a Firestore y las marca `'synced'`.
- La licencia se valida al arrancar y cada 30 minutos. Si vence, la app muestra dialog y cierra.
- El token offline (`license.json`) está cifrado con AES-256-GCM (clave derivada del `negocioId`).
