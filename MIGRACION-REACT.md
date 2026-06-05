# Migración React v2.0.0 — Estado del sistema

Migración completa del renderer de HTML+JS vanilla a React 19 + Vite + TypeScript + Tailwind CSS.
Commit principal: `1ed67bb`.

---

## ✅ Funciona al 100%

| Módulo | Notas |
|--------|-------|
| **Login** | Local + Firebase + reset de contraseña con código |
| **Caja** | Carrito, tickets múltiples, barcode, cobro, 6 formas de pago (efectivo/débito/crédito/transferencia/CC/mixto), movimientos de caja, anulaciones y devoluciones parciales |
| **Catálogo** | CRUD artículos, historial de precios, gestión de departamentos |
| **Clientes** | CRUD, pagos CC, estado de cuenta imprimible |
| **Inventario** | Movimientos de stock, stock bajo, ajustes manuales |
| **Turno** | Abrir/cerrar, movimientos de caja, resumen en vivo, corte Z |
| **Configuración** | Datos negocio, usuarios, backup, sync Firebase, reporte email, impresora |
| **Comprobante** | Vista de impresión en papel térmico simulado |

---

## 🔴 Roto en la migración (backend implementado, frontend ausente)

### 1. ~~Anulaciones y devoluciones en Caja~~ ✅ Resuelto (2026-06-05)
El modal "Anular" existe pero no llamaba al IPC. Conectado a `devoluciones:cancelar`
(anulación total) y `devoluciones:parcial` (devolución parcial).
- Repone stock automáticamente vía `registrarMovimiento` en el backend
- Revierte `saldo_vencido` del cliente si era venta en CC

### 2. Órdenes de Compra / Pedidos a Proveedores
La página `Proveedores.tsx` solo tiene CRUD básico. El backend tiene handlers completos:
`pedidosCompra:listar/crear/actualizar/marcarEnviado/recibir/cancelar/exportarPDF/exportarCSV`
y `recepciones:crear/listar/getById`.

**No hay ninguna página React que los use.** En el JS legacy esto estaba probablemente
en `proveedores.js` o una vista dedicada.

**Impacto:** Gestión de compras completamente inaccesible desde la UI.

### 3. Promociones por Volumen
`Promociones.tsx` no existe. El backend tiene `promociones:listarTodas/crear/eliminar`.
En el legacy probablemente estaba en `configuracion.js`.

**Impacto:** No se pueden configurar descuentos por volumen desde la UI.
(La aplicación de promociones al escanear sí podría funcionar si se llama
a `promociones:listarActivas` desde Caja, pero eso tampoco está conectado.)

### 4. Componentes de Kits
En Catálogo se puede marcar un artículo como KIT pero no hay UI para editar sus
componentes. El backend tiene `kits:getComponentes` y `kits:setComponentes`.

**Impacto:** Los kits son inutilizables: se marcan pero no se configuran.

### 5. Reportes avanzados
`Informes.tsx` usa solo 4 de ~15 endpoints disponibles. Faltantes:
`ventasPorHora`, `ventasPorDepartamento`, `ventasPorCliente`, `saldosClientes`,
`mejorDia`, `ventasPorMes`. Sin gráficas (los datos se muestran en tabla plana).

---

## ⏳ Pendientes de antes de la migración

| # | Ítem | Estado |
|---|------|--------|
| 12 | **Log de actividad** — tabla `actividad_log` + UI en Configuración (solo admin) | Pendiente |
| 13 | **Importación Excel con preview** — tabla de preview, filas en rojo si hay errores, progreso por lotes | Pendiente |

---

## 📋 Orden de prioridad para retomar

| Prioridad | Ítem | Complejidad estimada |
|-----------|------|---------------------|
| 1 | ~~Anulaciones/devoluciones en Caja~~ | ~~Media~~ |
| 2 | Órdenes de Compra (página nueva: listar, crear, enviar, recibir) | Alta |
| 3 | Promociones (modal en Catálogo o sección en Configuración) | Media |
| 4 | Kits (tab en modal de edición de artículo) | Baja |
| 5 | Log de actividad (#12) | Media |
| 6 | Importación Excel con preview (#13) | Media |
| 7 | Reportes avanzados + gráficas | Alta |

---

_Última actualización: 2026-06-05_
