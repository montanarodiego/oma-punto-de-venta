# Auditoría OmaTech POS v2.1.0
Fecha: 2026-06-13

## Resumen ejecutivo

- **Errores críticos:** 0
- **Errores no críticos:** 2
- **Advertencias:** 3
- **Código muerto detectado:** 1 handler IPC probablemente sin uso en renderer
- **TypeScript:** 0 errores (compile limpio)
- **Cobertura:** análisis estático completo — main process (ipc.js, database.js, todos los modelos), renderer (Caja.tsx, ModalCobro.tsx, ModalAnular.tsx, Proveedores.tsx, Configuracion.tsx, AppShell.tsx, api.d.ts, preload.js)

La app está en buen estado general. No se detectaron bugs que corrompan datos ni errores que bloqueen funcionalidad crítica en el flujo de cobro o turno. Los dos errores encontrados afectan el módulo de devoluciones.

---

## Errores no críticos (comportamiento incorrecto pero no corrompe datos de turno)

### [ERR-01] Devolución parcial repetible — se pueden devolver los mismos ítems dos veces

- **Archivo:** `src/main/models/devoluciones.js` línea 106 / `src/renderer/pages/caja/ModalAnular.tsx` línea 39
- **Descripción:**
  La función `devolucionParcial()` solo bloquea si `estado === 'cancelada'`. Una transacción en estado `devolucion_parcial` puede recibir una segunda devolución parcial sobre los mismos ítems.
  En el renderer, `ModalAnular` carga las transacciones filtrando solo las canceladas (`estado !== 'cancelada'`), por lo que las de estado `devolucion_parcial` aparecen disponibles. Al seleccionar una, inicializa los `itemQtys` con la **cantidad original** de cada ítem sin descontar lo ya devuelto.
- **Impacto:** Un cajero puede devolver el mismo ítem dos o más veces: el stock se incrementa múltiples veces y se devuelve más dinero del cobrado originalmente. El daño es operativo (stock inflado, saldo de caja negativo), no corrupción de la DB.
- **Fix sugerido:**
  1. En `devolucionParcial()` agregar guard: `if (['cancelada', 'devolucion_parcial'].includes(trans.estado)) throw new Error(...)` — o permitir solo si hay ítems que no fueron devueltos aún.
  2. En `ModalAnular`, al cargar el detalle de una transacción `devolucion_parcial`, llamar a `devoluciones.getByTrans(id)` y restar de `itemQtys` las cantidades ya devueltas en devoluciones anteriores.

### [ERR-02] `UPDATE transacciones SET estado = 'devolucion_parcial'` falla silenciosamente en segunda devolución

- **Archivo:** `src/main/models/devoluciones.js` línea 157–159
- **Descripción:**
  ```sql
  UPDATE transacciones SET estado = 'devolucion_parcial'
  WHERE id = ? AND estado = 'vigente'
  ```
  Si la transacción ya está en `devolucion_parcial`, la condición `AND estado = 'vigente'` es falsa y el UPDATE no se ejecuta — pero better-sqlite3 no lanza error, solo retorna `changes: 0`. El resto de la función (stock restoration, INSERT en devoluciones_detalle) sigue ejecutándose.
- **Impacto:** Consecuencia directa de ERR-01. En una segunda devolución parcial, el stock se restaura y se registra la devolución, pero el estado de la transacción no cambia. Los datos de devoluciones_detalle quedan bien, pero el estado de la transacción queda inconsistente con lo realmente devuelto.
- **Fix sugerido:** Resolver ERR-01 primero (si se bloquea la segunda devolución en el guard, este UPDATE nunca se invoca incorrectamente). Alternativamente, usar `WHERE id = ?` sin condición de estado, o lanzar error si `changes === 0`.

---

## Advertencias (no bloquean, mejoras de robustez o consistencia)

### [WARN-01] Tipo de retorno de `backup:hacerAhora` incompleto en api.d.ts

- **Archivo:** `src/renderer/types/api.d.ts` línea 739
- **Descripción:** El tipo declarado es `Promise<{ ok: boolean; error?: string }>` pero el handler en `src/main/ipc.js` línea 487 retorna `{ ok: true, ruta: Backup.hacerBackup() }`. El campo `ruta` no está tipado. El renderer (`Configuracion.tsx` línea 200) solo usa `res.ok` y `res.error`, así que no hay runtime error. Sin embargo, si en el futuro se necesitara mostrar la ruta, TypeScript no daría error pero la propiedad faltaría en el tipo.
- **Fix sugerido:** Agregar `ruta?: string` al tipo de retorno en api.d.ts.

### [WARN-02] Tipo de `articulosConStockBajo` incorrecto en api.d.ts

- **Archivo:** `src/renderer/types/api.d.ts` / `src/main/preload.js`
- **Descripción:** La función `window.api.proveedores.articulosConStockBajo()` retorna objetos con campos `proveedor`, `costo_unitario`, `unidad_medida` que no están en la interfaz `Articulo`. En `Proveedores.tsx` se resuelve con `as unknown as ArticuloStockBajo[]`. El tipo declarado en api.d.ts debería ser `ArticuloStockBajo[]` o un tipo nuevo.
- **Fix sugerido:** Agregar `ArticuloStockBajo` a api.d.ts y actualizar la firma del método en la sección `proveedores`.

### [WARN-03] Vuelto no calculado en modo mixto con efectivo como método primario

- **Archivo:** `src/renderer/pages/caja/ModalCobro.tsx` línea ~62
- **Descripción:** El cálculo de vuelto usa `formaPago === 'efectivo' ? diferencia : 0`. Cuando el modo es `'mixto'` y el primer método (`mixtoMetodo1`) es efectivo, no se calcula ni muestra vuelto aunque el monto ingresado supere la porción del total. **Nota:** el guard de `canCobrar` (línea ~68) bloquea envíos con `mixtoMonto1 >= total`, por lo que en la práctica el vuelto en modo mixto siempre es 0 o imposible de ingresar. El comportamiento es correcto para el caso de uso actual, pero podría confundir si se quiere que el primer pago en efectivo cubra más del total.
- **Fix sugerido:** Bajo (comportamiento aceptable). Si se quiere mostrar vuelto en mixto: `const esMixtoEfectivo = formaPago === 'mixto' && mixtoMetodo1 === 'efectivo'; const diferencia = (formaPago === 'efectivo' || esMixtoEfectivo) ? montoParsed - totales.total : 0;`

---

## Código muerto

### `devoluciones:recientes` — handler IPC sin uso visible en renderer

- **Archivo:** `src/main/ipc.js` línea 395 / `src/main/preload.js` línea 79
- **Descripción:** El handler `devoluciones:recientes` está registrado en IPC y expuesto en preload como `window.api.devoluciones.recientes()`. No se encontró ninguna llamada a este método en el renderer. `ModalAnular` usa `transacciones.getRecientes` para listar ventas del día y `devoluciones.getByTrans` para el detalle. El método `devoluciones.recientes` parece ser un residuo o feature preparado para una pantalla de historial de devoluciones que no existe todavía.
- **Impacto:** Ninguno en runtime. Posible confusión de mantenimiento.

---

## Estado por módulo

| Módulo | Estado | Notas |
|--------|--------|-------|
| Caja | ✓ OK | Flujo de cobro atómico. Asterisco funciona con decimales. Límite de efectivo calcula correctamente incluyendo movimientos. |
| Cobro (ModalCobro) | ✓ OK | Vuelto/exacto/faltante OK. Mixto previene vuelto imposible con guard. Ver WARN-03. |
| Anulaciones (ModalAnular) | ⚠ ERR-01/02 | Devolución parcial permite devolver dos veces los mismos ítems. |
| Catálogo | ✓ OK | Sin issues detectados. |
| Clientes | ✓ OK | Cuenta corriente: saldo_vencido se actualiza en ventas CC y se revierte en cancelaciones. MAX() en SQLite ES válido con 2 args. |
| Inventario | ✓ OK | Movimientos registran kardex correctamente. |
| Proveedores | ✓ OK | `articulosConStockBajo` filtra `stock_minimo > 0` correctamente. Columna `proveedor` existe en schema. Ver WARN-02 (tipo). |
| Pedidos | ✓ OK | Sin issues detectados en modelo. |
| Informes | ✓ OK | Fechas UTC-3 correctas. Ganancia bruta con descuentos OK. |
| Turno | ✓ OK | Guard de turno único implementado. Email de corte fire-and-forget, no bloquea cierre. |
| Configuración | ✓ OK | Backup: renderer no usa `ruta`. Ver WARN-01. |
| Auth local | ✓ OK | bcrypt 10 rounds. Login no expone `password_hash`. |
| Sync Firebase | ✓ OK | syncPendientes actualiza a 'synced' dentro del try-catch correcto. |
| TypeScript | ✓ OK | 0 errores con `npx tsc --noEmit`. |
| IPC cross-ref | ✓ OK | Todos los métodos en preload.js tienen handler. Los handlers en main.js (auth, updater, db) están correctamente separados por diseño. |
| SQLite schema | ✓ OK | Ninguna columna fantasma detectada. `db.transaction()` usado en todos los flujos de escritura crítica. |

---

## Notas sobre hallazgos descartados

Durante el análisis, el agente de análisis identificó `MAX(0, saldo_vencido - ?)` como sintaxis MySQL inválida en SQLite. **Esto es incorrecto.** SQLite soporta `max(X, Y, ...)` como función escalar con 2+ argumentos ("Core Functions" en la documentación oficial de SQLite). El UPDATE en `devoluciones.js` es sintácticamente válido y funciona correctamente en SQLite.

---

## Prioridad de fixes recomendada

1. **[ERR-01]** — Devolución parcial repetible. Riesgo real de devolver más plata de la cobrada. Fix en el modelo (~10 líneas) + fix en el UI (filtrar cantidades ya devueltas).
2. **[ERR-02]** — Consecuencia de ERR-01. Se resuelve al resolver ERR-01.
3. **[WARN-02]** — Tipo incorrecto de `articulosConStockBajo` en api.d.ts. Fix de 5 minutos, mejora la robustez del tipo.
4. **[WARN-01]** — Tipo incompleto de `backup:hacerAhora`. Fix de 2 minutos.
5. **[WARN-03]** — Vuelto en modo mixto. Baja prioridad, comportamiento actual es aceptable.
