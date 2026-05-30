---
name: omatech-pos
description: Contexto y convenciones del proyecto OmaTech POS, una app de punto de venta de escritorio offline-first hecha con Electron + SQLite + Firebase, con control de acceso por licencia. Usá este skill SIEMPRE que se trabaje sobre el POS de OmaTech, OmaTech POS, el sistema de punto de venta, ventas, inventario, caja, comprobantes, sincronización con Firebase, validación de licencias, o cualquier módulo de esta app de escritorio, incluso si no se nombra el stack explícitamente.
---

# OmaTech POS

App de punto de venta (POS) de escritorio para comercios chicos (kioscos, PyMEs argentinas). Está en beta, probándose con el dueño de un kiosco.

## Stack
- Electron (proceso main + renderer).
- SQLite: base local. Es la fuente de verdad cuando no hay internet.
- Firebase: sincronización en la nube y backend.
- Arquitectura offline-first: la app funciona 100% sin internet. SQLite manda en local; Firebase sincroniza cuando hay conexión.
- Control de acceso por licencia.

## Estructura del proyecto

```
src/
  main/
    main.js              # Entry point Electron: crea ventanas, maneja ciclo de vida, auto-updater, sync periódica
    ipc.js               # Todos los handlers ipcMain.handle — punto único de comunicación main↔renderer
    preload.js           # Expone window.api al renderer (contextIsolation: true)
    database.js          # Inicializa SQLite (better-sqlite3), crea schema y corre migraciones
    sync.js              # syncPendientes, verificarLicencia, guardarTokenLocal, verificarTokenLocal, cifrado AES
    auth.js              # loginConEmail / reautenticarDesdeToken con Firebase Auth
    firebase.js          # Instancia de Firebase App, Auth y Firestore
    backup.js            # Backup automático al cerrar + listado de backups guardados
    mailer.js            # Envío de reportes de soporte internos (OmaTech → soporte)
    report-mailer.js     # Genera y envía el HTML del reporte automático de ventas por email
    report-scheduler.js  # Tick cada minuto: dispara report-mailer según frecuencia configurada
    printer.js           # Impresora térmica ESC/POS: listar, imprimir ticket, ticket de prueba
    models/
      articulos.js        # CRUD productos, búsqueda, kits
      clientes.js         # CRUD clientes, cuenta corriente, pagos, saldo
      departamentos.js    # CRUD departamentos (agrupación de artículos)
      devoluciones.js     # Devolución total y parcial de transacciones
      informes.js         # Consultas de ventas, utilidad, top productos, formas de pago
      inventario.js       # Ajustes de stock, movimientos, kardex, stock bajo
      kits.js             # Componentes de kits (artículo compuesto)
      movimientos_caja.js # Entradas/salidas de caja dentro de un turno
      pedidos.js          # Órdenes de compra a proveedores (pedidos_compra)
      promociones.js      # Promociones por volumen (precio especial por cantidad)
      proveedores.js      # CRUD proveedores, pedidos legacy a proveedores
      recepciones.js      # Recepciones de mercadería
      transacciones.js    # Registro de ventas
      turnos.js           # Apertura/cierre de turno, resumen, historial
      usuarios.js         # Autenticación local (bcryptjs), roles admin/cajero
  renderer/
    views/               # HTML de cada pantalla
      login.html         # Pantalla de login (Firebase + token local offline)
      caja.html          # Pantalla principal de ventas
      catalogo.html      # Catálogo / gestión de productos
      clientes.html      # Gestión de clientes y cuenta corriente
      comprobante.html   # Comprobante de venta (para imprimir / exportar)
      configuracion.html # Configuración del negocio, usuarios, backup, reportes, impresora
      informes.html      # Informes de ventas
      inventario.html    # Movimientos de inventario
      proveedores.html   # Gestión de proveedores y órdenes de compra
      turno.html         # Apertura y cierre de turno
    js/                  # Lógica de cada pantalla (misma base de nombre que el HTML)
      auth-guard.js      # Verifica sesión local antes de cargar cada vista
      nav-bar.js         # Barra de navegación lateral
      nav-badge.js       # Badge de sincronización pendiente en el nav
      hotkeys.js         # Atajos de teclado globales
      modal-tracker.js   # Señaliza al proceso main si hay un modal abierto (para bloquear cierre)
      modal-keyboard.js  # Navegación por teclado en modales
      dropdown-keyboard.js # Navegación por teclado en dropdowns
      updater-ui.js      # UI del auto-updater (notificación + progreso de descarga)
    css/
      style.css          # Estilos base (variables CSS, tema oscuro, componentes)
assets/
  icon.ico
.env                     # Variables de entorno (GH_TOKEN, GMAIL_USER, GMAIL_APP_PASSWORD)
package.json             # electron-builder configurado para release en GitHub
```

## Esquema de la base (SQLite)

Archivo: `oma-pos.db` en `app.getPath('userData')`. WAL habilitado, foreign keys ON.

| Tabla | Campos clave | Notas |
|---|---|---|
| `articulos` | id, codigo (UNIQUE), nombre, costo_unitario, precio_unitario, precio_mayoreo, stock_actual, stock_minimo, tasa_iva, unidad_medida, departamento_id, es_kit, usa_inventario, sync_status | sync_status: `pending` / `synced` |
| `kits_componentes` | kit_id → articulos, componente_id → articulos, cantidad | UNIQUE(kit_id, componente_id) |
| `departamentos` | id, nombre (UNIQUE), color | Agrupación visual de artículos |
| `clientes` | id, nombre, telefono, direccion, limite_credito, saldo_vencido, sync_status | |
| `transacciones` | id, monto_total, subtotal, monto_impuesto, descuento_global, propina, forma_pago, forma_pago_2, monto_pago_2, cuenta_cliente_id, turno_id, estado, motivo_cancelacion, sync_status, created_at | estado: `vigente` / `cancelada` |
| `detalle_transaccion` | transaccion_id, articulo_id (nullable), descripcion_libre, cantidad, precio_al_momento, descuento_porcentaje, importe_total | articulo_id nullable para ítems libres |
| `turnos` | id, fecha_apertura, fecha_cierre, efectivo_inicial, efectivo_esperado, efectivo_real, diferencia, total_ventas, total_transacciones, ventas_efectivo/debito/credito/transferencia/cuenta_corriente, estado | estado: `abierto` / `cerrado` |
| `movimientos_caja` | turno_id, tipo (`entrada`/`salida`), monto, descripcion, cancelado, cancelado_motivo | |
| `devoluciones` | transaccion_id, turno_id, motivo, monto_devuelto, tipo (`parcial`/`total`) | |
| `devoluciones_detalle` | devolucion_id, detalle_id, articulo_id, cantidad, precio_unitario, importe | |
| `movimientos_inventario` | articulo_id, tipo, cantidad_anterior, cantidad_cambio, cantidad_resultante, costo_unitario, motivo, usuario, referencia_id | Audit trail de stock |
| `proveedores` | id, nombre, telefono, email, direccion, notas, sync_status | |
| `pedidos_compra` | proveedor_id, estado (`borrador`/`enviado`/`recibido`/`cancelado`), notas, usuario_id, fecha_creacion/envio/recepcion | |
| `pedidos_compra_items` | pedido_id, articulo_id, descripcion_libre, cantidad_pedida, cantidad_recibida, costo_unitario | |
| `recepciones` / `recepciones_detalle` | Ingreso de mercadería; actualiza stock | |
| `promociones` | articulo_id, cantidad_desde, cantidad_hasta, precio_promocional, activa | Precio especial por volumen |
| `usuarios` | id, nombre, usuario (UNIQUE), password_hash (bcryptjs), rol (`admin`/`cajero`), activo | Usuario inicial: admin / 1234 |
| `pagos_clientes` | cliente_id, monto, tipo (`abono`/`dev_abono`), forma_pago, estado (`activo`/`cancelado`) | Historial de abonos a cuenta corriente |
| `configuracion` | clave (PK), valor | Pares clave-valor para todos los parámetros del negocio |

Claves frecuentes de `configuracion`: `nombre_negocio`, `direccion`, `telefono`, `cuit`, `moneda`, `tasa_iva`, `modo_negocio`, `tamano_hud`, `mensaje_ticket`, `sync_enabled`, `impresora_nombre`, `reporte_email_activo`, `reporte_email_destino`, `reporte_email_frecuencia`, `reporte_email_hora`, `reporte_email_dia_semana`, `reporte_email_dia_mes`, `reporte_email_ultimo_envio`.

## Sistema de licencias

**Flujo normal (con internet):**
1. `login.html` pide email/contraseña Firebase.
2. `auth:login` (IPC) llama a `loginConEmail` (Firebase Auth) → obtiene `user.uid` que sirve como `negocioId`.
3. `verificarLicencia(firestore, negocioId)` lee `negocios/{negocioId}.licencia` en Firestore. Espera `{ activa: true/false, vencimiento: Timestamp }`.
4. Si la licencia está activa, se guarda un token local cifrado en `license.json` (`app.getPath('userData')`). El token incluye `negocioId`, `activa`, `vencimiento` (timestamp ms), y las credenciales Firebase cifradas con AES-256-GCM (clave derivada del propio `negocioId`).
5. La ventana de login se cierra y se abre la ventana principal.

**Flujo offline (sin internet):**
- `verificarTokenLocal()` lee `license.json`. Si existe y `vencimiento > Date.now()`, la app arranca directo sin login.
- `reautenticarDesdeToken` intenta restaurar la sesión Firebase silenciosamente para que la próxima sync funcione.

**Renovación periódica:**
- Cada 30 minutos: `syncPendientes` + `verificarLicencia`. Si la licencia fue suspendida, la app se cierra con un dialog informativo.

**Si la licencia vence o es inválida:**
- Con internet: el login devuelve error con mensaje descriptivo; no se entra a la app.
- Sin internet con token expirado: `verificarTokenLocal` retorna `{ activa: false, vencido: true }` → redirige al login (sin poder entrar offline).
- Con internet, licencia suspendida durante uso: la sync periódica lo detecta, cierra todas las ventanas y llama a `app.quit()`.

**Importante:** el `negocioId` es el `uid` de Firebase Auth del usuario. No hay una clave de licencia separada; la presencia y estado del campo `licencia` en el documento Firestore `negocios/{uid}` es lo que determina el acceso.

## Convenciones y forma de trabajo
- Trabajar módulo por módulo: completar y validar uno antes de pasar al siguiente.
- Al final de cada sesión, resumen de cierre para un arranque limpio.
- Diego usa IA para generar el código. Explicar el porqué de las decisiones cuando el tema lo justifica, sin relleno.
- Idioma: español argentino, trato de "vos", directo e informal.
- Avisar siempre si se detecta un riesgo, error o problema, aunque no se pida.

## Riesgos críticos
1. Sincronización offline -> online (el más peligroso): al reconectar, las ventas acumuladas en SQLite se sincronizan con Firebase. Cuidar que NO se dupliquen ni se pierdan registros. Acá se juega la plata real del comercio.
2. Integridad de la caja: totales y cierres tienen que cuadrar. Sin errores de redondeo ni registros huérfanos.
3. Bloqueo por licencia: un error de validación no debe dejar al comercio sin poder vender.

## Qué hacer
- Antes de tocar un módulo nuevo, repasar cómo encaja con SQLite y con la sync a Firebase.
- Proponer un smoke test del camino crítico antes de entregar una versión (abrir -> validar licencia -> cargar productos -> registrar venta -> sincronizar).

## Qué NO hacer
- No asumir que hay internet.
- No meter claves ni credenciales de Firebase ni datos reales en código de ejemplo ni en este skill.
- No reescribir módulos enteros cuando alcanza con un cambio puntual.
