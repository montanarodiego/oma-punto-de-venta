---
name: omatech-pos
description: Contexto y convenciones del proyecto OmaTech POS, una app de punto de venta de escritorio offline-first hecha con Electron + SQLite + Firebase, con control de acceso por licencia. Usá este skill SIEMPRE que se trabaje sobre el POS de OmaTech, OmaTech POS, el sistema de punto de venta, ventas, inventario, caja, comprobantes, sincronización con Firebase, validación de licencias, o cualquier módulo de esta app de escritorio, incluso si no se nombra el stack explícitamente.
---

# OmaTech POS

App de punto de venta (POS) de escritorio para comercios chicos (kioscos, PyMEs argentinas). En beta, probándose con el dueño de un kiosco.

**Versión actual: v2.0.0** — renderer migrado completamente de HTML+JS vanilla a React SPA.

## Stack

- **Electron** (proceso main + renderer)
- **better-sqlite3**: base local. Fuente de verdad sin internet. WAL habilitado, FK ON.
- **Firebase SDK**: auth + Firestore (solo para licencias y sync en la nube)
- **Renderer: React 19 + Vite + TypeScript + Tailwind CSS v3 + Framer Motion v12**
- Tema oscuro moderno custom (variables CSS en `globals.css`, glassmorphism en modales)
- Hash Router (`react-router-dom` v7)
- Arquitectura **offline-first**: funciona 100% sin internet

## Estructura del proyecto

```
src/
  main/
    main.js              # Entry point Electron: crea ventanas, ciclo de vida, auto-updater, sync periódica
    ipc.js               # Todos los handlers ipcMain.handle — punto único de comunicación main↔renderer
    preload.js           # Expone window.api al renderer (contextIsolation: true)
    database.js          # Inicializa SQLite, crea schema y corre migraciones
    sync.js              # syncPendientes, verificarLicencia, guardarTokenLocal, verificarTokenLocal, cifrado AES
    auth.js              # loginConEmail / reautenticarDesdeToken con Firebase Auth
    firebase.js          # Instancia de Firebase App, Auth y Firestore
    backup.js            # Backup automático al cerrar + listado + restauración desde UI
    mailer.js            # Envío de reportes de soporte internos (OmaTech → soporte)
    report-mailer.js     # Genera y envía el HTML del reporte automático de ventas por email
    report-scheduler.js  # Tick cada minuto: dispara report-mailer según frecuencia configurada
    printer.js           # Impresora térmica ESC/POS: listar, imprimir ticket, ticket de prueba
    models/
      articulos.js        # CRUD productos, búsqueda, kits, historial de precios (precio_historial)
      clientes.js         # CRUD clientes, cuenta corriente, pagos, saldo_vencido
      departamentos.js    # CRUD departamentos (agrupación de artículos)
      devoluciones.js     # Devolución total y parcial de transacciones (revierte saldo_vencido CC)
      informes.js         # Ventas, utilidad (con descuentos por ítem), top productos, stock bajo, formas de pago
      inventario.js       # Ajustes de stock, movimientos, kardex, stock bajo
      kits.js             # Componentes de kits (artículo compuesto)
      movimientos_caja.js # Entradas/salidas de caja por turno, con categorías tipadas
      pedidos.js          # Órdenes de compra a proveedores (pedidos_compra)
      promociones.js      # Promociones por volumen (precio especial por cantidad)
      proveedores.js      # CRUD proveedores, pedidos legacy
      recepciones.js      # Recepciones de mercadería
      transacciones.js    # Registro de ventas (actualiza saldo_vencido en ventas CC)
      turnos.js           # Apertura/cierre de turno, corte Z ESC/POS, resumen, historial
      usuarios.js         # Autenticación local (bcryptjs), roles admin/cajero
  renderer/
    index.html           # Entry point Vite
    main.tsx             # ReactDOM.createRoot → <App />
    App.tsx              # HashRouter + rutas por página
    pages/               # Una página React por módulo
      Login.tsx
      Caja.tsx
      Catalogo.tsx
      Clientes.tsx
      Inventario.tsx
      Informes.tsx
      Proveedores.tsx
      Turno.tsx
      Configuracion.tsx
      Comprobante.tsx
    components/
      ui/                # Button, Card, Input/Field/Select/Textarea, Modal, Toggle, Badge
      layout/            # AppShell (sidebar + outlet animado), Sidebar
    context/
      SessionContext.tsx # Usuario local y sesión activa
      ToastContext.tsx   # Notificaciones globales
    hooks/
      useNavigateGlobal.ts # Mapea eventos IPC `navegar-global` (F1–F8) a React Router
    styles/
      globals.css        # Design system: variables CSS, clases .inp .btn .tbl .nav-tab, glassmorphism
    types/
      api.d.ts           # Declaraciones de window.api y tipos del negocio
    vite-env.d.ts
  renderer/views/*.html  # HTML legacy — ya NO se cargan; reemplazados por la SPA React
  renderer/js/*.js       # JS legacy — ya NO se cargan; solo de referencia histórica
assets/
  icon.ico
.env                     # GH_TOKEN, GMAIL_USER, GMAIL_APP_PASSWORD
package.json             # electron-builder: artifactName con puntos (OmaTech.POS.Setup.${version}.exe)
```

## Esquema de la base (SQLite)

Archivo: `oma-pos.db` en `app.getPath('userData')`.

| Tabla | Campos clave | Notas |
|---|---|---|
| `articulos` | id, codigo (UNIQUE), nombre, costo_unitario, precio_unitario, precio_mayoreo, stock_actual, stock_minimo, tasa_iva, unidad_medida, departamento_id, es_kit, usa_inventario, sync_status | sync_status: `pending` / `synced` |
| `precio_historial` | articulo_id, campo, valor_anterior, valor_nuevo, usuario, created_at | Audit trail de cambios de precio |
| `kits_componentes` | kit_id → articulos, componente_id → articulos, cantidad | UNIQUE(kit_id, componente_id) |
| `departamentos` | id, nombre (UNIQUE), color | Agrupación visual de artículos |
| `clientes` | id, nombre, telefono, direccion, limite_credito, saldo_vencido, sync_status | saldo_vencido se actualiza en ventas CC y se revierte en devoluciones |
| `transacciones` | id, monto_total, subtotal, monto_impuesto, descuento_global, propina, forma_pago, forma_pago_2, monto_pago_2, cuenta_cliente_id, turno_id, estado, motivo_cancelacion, sync_status, created_at | estado: `vigente` / `cancelada` |
| `detalle_transaccion` | transaccion_id, articulo_id (nullable), descripcion_libre, cantidad, precio_al_momento, descuento_porcentaje, importe_total | articulo_id nullable para ítems libres |
| `turnos` | id, fecha_apertura, fecha_cierre, efectivo_inicial, efectivo_esperado, efectivo_real, diferencia, total_ventas, total_transacciones, ventas_efectivo/debito/credito/transferencia/cuenta_corriente, estado | estado: `abierto` / `cerrado` |
| `movimientos_caja` | turno_id, tipo (`entrada`/`salida`), monto, descripcion, categoria, cancelado, cancelado_motivo | categoria: ej. Retiro, Pago a proveedor, Depósito... |
| `devoluciones` | transaccion_id, turno_id, motivo, monto_devuelto, tipo (`parcial`/`total`) | |
| `devoluciones_detalle` | devolucion_id, detalle_id, articulo_id, cantidad, precio_unitario, importe | |
| `movimientos_inventario` | articulo_id, tipo, cantidad_anterior, cantidad_cambio, cantidad_resultante, costo_unitario, motivo, usuario, referencia_id | Audit trail de stock |
| `proveedores` | id, nombre, telefono, email, direccion, notas, sync_status | |
| `pedidos_compra` | proveedor_id, estado (`borrador`/`enviado`/`recibido`/`cancelado`), notas, usuario_id, fecha_creacion/envio/recepcion | |
| `pedidos_compra_items` | pedido_id, articulo_id, descripcion_libre, cantidad_pedida, cantidad_recibida, costo_unitario | |
| `recepciones` / `recepciones_detalle` | Ingreso de mercadería; actualiza stock | |
| `promociones` | articulo_id, cantidad_desde, cantidad_hasta, precio_promocional, activa | Precio especial por volumen |
| `usuarios` | id, nombre, usuario (UNIQUE), password_hash (bcryptjs), rol (`admin`/`cajero`), activo | Usuario inicial: admin / 1234 |
| `pagos_clientes` | cliente_id, monto, tipo (`abono`/`dev_abono`), forma_pago, estado (`activo`/`cancelado`) | Historial de abonos a CC |
| `configuracion` | clave (PK), valor | Pares clave-valor para todos los parámetros del negocio |

Claves frecuentes de `configuracion`: `nombre_negocio`, `direccion`, `telefono`, `cuit`, `moneda`, `tasa_iva`, `modo_negocio`, `tamano_hud`, `mensaje_ticket`, `sync_enabled`, `impresora_nombre`, `reporte_email_activo`, `reporte_email_destino`, `reporte_email_frecuencia`, `reporte_email_hora`, `reporte_email_dia_semana`, `reporte_email_dia_mes`, `reporte_email_ultimo_envio`.

## Sistema de licencias

**Flujo normal (con internet):**
1. `Login.tsx` pide email/contraseña Firebase → `window.api.auth.login(email, pass)`.
2. `auth:login` (IPC) llama a `loginConEmail` (Firebase Auth) → `user.uid` = `negocioId`.
3. `verificarLicencia(firestore, negocioId)` lee `negocios/{negocioId}.licencia` en Firestore. Espera `{ activa: true/false, vencimiento: Timestamp }`.
4. Si activa, guarda token local cifrado en `license.json` (`app.getPath('userData')`): `negocioId`, `activa`, `vencimiento` (ms), credenciales Firebase cifradas con AES-256-GCM (clave derivada de `negocioId`).
5. Devuelve `{ok:true}` al renderer → muestra mensaje → el usuario hace login local en la SPA.

**Flujo offline (sin internet):**
- `verificarTokenLocal()` lee `license.json`. Si existe y `vencimiento > Date.now()`, la app arranca sin login.
- `reautenticarDesdeToken` intenta restaurar sesión Firebase silenciosamente para que la próxima sync funcione.

**Renovación periódica:** cada 30 min: `syncPendientes` + `verificarLicencia`. Si la licencia fue suspendida, la app se cierra con dialog informativo.

**Si vence o es inválida:** mismas reglas que antes. El `negocioId` es el `uid` Firebase, no hay clave separada.

## Funcionalidades implementadas (v2.0.0)

Estas mejoras están en producción (rama `main`):

| # | Mejora | Commit |
|---|--------|--------|
| 1 | Fix fechas UTC-3 en todos los reportes | `6937fb6` |
| 2 | Corrección ganancia bruta con descuentos por ítem | `3770e59` |
| 3 | Alertas de stock en 3 niveles (sin stock / bajo / insuficiente) en caja y buscador | `56672a8` |
| 4 | Corte Z automático al cerrar turno — ticket ESC/POS con resumen completo | `497df97` |
| 5 | Lector de código de barras — detección por velocidad, beep Web Audio, flash CSS | `56b7257` |
| 6 | Movimientos de caja con categorías (select de tipos, badge en historial) | `8681378` |
| 7 | Pestaña "Stock bajo" en Informes — filtros + exportación CSV | `f931dc6` |
| 8 | Estado de cuenta corriente imprimible por cliente — ticket ESC/POS | `c86eea4` |
| 9 | Límite de crédito con alertas visuales — barra en cobro + modal cliente + badge | `d85bcab` |
| 10 | Historial de cambios de precio — tabla `precio_historial`, tab en modal artículo | `ce40922` |
| 11 | Restauración de backup desde la UI — botón, dialog de confirmación, backup preventivo, reinicio | `fe897ca` |
| — | Wizard de primera configuración (setup.html + setup.js, guard onlyAdmin primer usuario) | `5be2692` |
| — | Fix crítico CC: `transacciones.js` + `devoluciones.js` ahora actualizan `saldo_vencido` | `66c10e6` |
| — | Rediseño UX/UI: tema oscuro moderno con glassmorphism, gradientes, animaciones | `49cb920` |
| — | Migración completa del renderer a React 19 + Vite + TypeScript + Tailwind (v2.0.0) | `1ed67bb` |

## Pendientes

Todos los ítems funcionales (1–13) están implementados. Lo que resta es de pre-lanzamiento:
code signing del auto-updater, migración de la cuenta de sync compartida, y el panel admin
en OMA Manager (ver memoria `project_lanzamiento`).

### 12 — Log de actividad ✅ HECHO
- Tabla `actividad_log(id, usuario_id, usuario_nombre, accion, detalle, created_at)` + índices.
- Modelo `models/actividad.js` (`registrar` a prueba de fallos + `listar` con filtros por acción/usuario/fecha).
- `ipc.js` loguea vía `logActividad()` (closure `currentUser`): venta, anulación, devolución parcial,
  movimiento de caja, apertura/cierre de turno, login. Los cambios de precio se loguean en `articulos.update`.
- Handler `actividad:listar` con `onlyAdmin()`; expuesto en `window.api.actividad.listar`.
- UI: card "Log de actividad" en `Configuracion.tsx` (solo admin) con filtro por tipo de acción.

### 13 — Importación Excel con preview y validación ✅ HECHO
- `ImportConfig` (previewColumns + validateRow) en `Catalogo.tsx`, reusado en Clientes y Proveedores.
- Tabla de preview con filas en rojo si hay errores; botón habilitado solo con filas válidas.

## Convenciones React (renderer)

- Pages: default export, sin wrapper propio — `AppShell.tsx` envuelve el outlet con `className="page-content"` + animación.
- Cada page también tiene su propio `<div className="page-content">` → doble nesting intencional (ambos flex column).
- `globals.css .page-content`: `flex:1; flex-direction:column; overflow:hidden; min-width:0; min-height:0`
- Animaciones: `motion.tr` SIN `layout` prop (transforms en `<tr>` no soportados por browsers).
- Formularios: `useMemo` para filtros, `useCallback` para handlers de estado.
- `try/catch` obligatorio en todas las funciones async de IPC.
- Imports de `../components/ui`: solo los que se usan.
- El renderer legacy (`src/renderer/views/*.html` + `src/renderer/js/*.js`) sigue en disco pero **no se carga**; ignorarlo al trabajar.

## Flujo de navegación

- En dev: Electron carga `http://localhost:5173`. En prod: `dist/renderer/index.html`.
- F1–F8 envían evento IPC `navegar-global` con nombres legacy ("catalogo.html"), que `useNavigateGlobal.ts` mapea a rutas React.
- Login local: `window.api.usuarios.login(user, pass)` → `setSession()` en SessionContext → navega a `/caja`.
- Login Firebase: `window.api.auth.login(email, pass)` → verifica licencia → vuelve a login local.

## Builds y releases

- `artifactName: "OmaTech.POS.Setup.${version}.exe"` (puntos, no espacios ni dashes) — crítico para que `autoUpdater` no falle con 404.
- Flujo: `npm run dist` → verificar `dist/latest.yml` (campo `path` debe coincidir con el `.exe`) → `gh release create ...` con heredoc single-quote.

## Convenciones generales

- Trabajar módulo por módulo; completar y validar uno antes de pasar al siguiente.
- Idioma: español argentino, "vos", directo e informal.
- Avisar si se detecta riesgo o error aunque no se pida.
- No asumir que hay internet.
- No meter credenciales Firebase ni datos reales en código de ejemplo ni en este skill.
- No reescribir módulos enteros cuando alcanza un cambio puntual.

## Riesgos críticos

1. **Sync offline→online**: al reconectar, ventas en SQLite se sincronizan con Firebase. No deben duplicarse ni perderse. Acá se juega la plata real del comercio.
2. **Integridad de caja**: totales y cierres tienen que cuadrar. Sin errores de redondeo ni registros huérfanos.
3. **Bloqueo por licencia**: un error de validación no debe dejar al comercio sin poder vender.

## Qué hacer antes de tocar un módulo

- Revisar cómo encaja con SQLite y con la sync a Firebase.
- Proponer un smoke test del camino crítico: abrir → validar licencia → cargar productos → registrar venta → sincronizar.
