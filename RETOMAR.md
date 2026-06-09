# RETOMAR — Estado de OmaTech POS

**Fecha:** 9 jun 2026 (actualizado al cierre de sesión)
**Rama:** main · sincronizado con origin

---

## LO QUE SE HIZO: bugs de runtime tras refactor (2026-06-09 cierre)

| Commit | Bug |
|--------|-----|
| `b9bade5` | **TDZ `propina`**: se pasaba a `useCarrito()` antes de su `useState` → `Cannot access 'propina' before initialization`. Movida al bloque Config, antes del call. **Colateral**: `WIZARD_MODOS` se usaba en `seleccionarModo()` sin estar importado en `Caja.tsx` — crashearía al completar el wizard de primer inicio. Agregado al import. |

---

## LO QUE SE HIZO: Informes — 5 reportes nuevos (2026-06-09 noche)

| Commit | Descripción |
|--------|-------------|
| `51f48fa` | Columna Ganancia (verde) en tablas top artículos y ventas por día — data ya venía, faltaba renderizarla |
| `100bfd7` | Tabla utilidad bruta por artículo con `VirtualTable`: 7 col, margen % con semáforo de color, sort por clic en cabecera (Artículo / Utilidad / Margen %) |
| `775501e` | Stat card "Mejor día" — monto máximo de un solo día + fecha + cantidad de ventas; grid KPIs pasa de 4 a 5 columnas |
| `e437587` | Gráfico de barras horizontales por departamento (`chart.js`, `indexAxis:'y'`), altura dinámica, palette del proyecto |
| `45227d2` | Gráfico de línea evolución mensual — dos datasets (Ventas azul + Ganancia verde), área rellena, tooltips en pesos |

### Informes.tsx ahora carga en paralelo:
`resumenRapido` · `articulosMasVendidos` · `utilidadBruta` · `ventasPorDia` · `mejorDia` · `ventasPorDepartamento` · `ventasPorMes`

### Funciones del backend aún sin UI:
`ventasPorPeriodo` (lista de transacciones) · `saldosClientes` · `ventasPorHora` · `ventasPorHoraRango` · `ventasPorCliente`

---

## LO QUE SE HIZO: robustez — error boundary + recuperación de carrito (2026-06-09 noche)

| Commit | Descripción |
|--------|-------------|
| `57aa686` | Error boundary por ruta + localStorage backup del carrito |

- **`src/renderer/components/ErrorBoundary.tsx`** (nuevo): componente de clase, `componentDidCatch` loguea via `window.api.log.error` → `electron-log`, UI de recuperación oscura. Botones: **Reintentar** y **Volver a Caja**.
- **`App.tsx`**: cada ruta envuelta en su propio `<ErrorBoundary>` — crash en Informes no tumba Caja.
- **`useCarrito.ts`**: lazy init restaura desde `localStorage` (`oma_tickets_backup`); `useEffect` guarda en cada cambio; `limpiarTicket` limpia el backup.
- **`ipc.js` + `preload.js` + `api.d.ts`**: nuevo canal `log:error` (fire-and-forget).

---

## LO QUE SE HIZO: refactor Caja.tsx → caja/ (2026-06-09 tarde)

**Resultado:** `Caja.tsx` pasó de **1776 → 436 líneas** (75% reducción). Refactor puro — cero cambio de comportamiento.

| Commit | Módulo |
|--------|--------|
| `69c7cc7` | `types.ts` — interfaces, constantes, utils puros |
| `084d46f` | `calculosFiscales.ts` + 13 tests unitarios |
| `c6b5931` | `useCarrito.ts` — hook multi-ticket |
| `e8ba7d9` | `TicketTabs.tsx` |
| `7ddc189` | `BuscadorArticulos.tsx` |
| `31f1623` | `CarritoLista.tsx` + `CartRow` |
| `8f05ad7` | `ModalCobro.tsx` — `forwardRef/useImperativeHandle` para IPC |
| `08e3ace` | `ModalAnular.tsx` |
| `e188286` | `ui.tsx`, `CodigoInput.tsx`, `ModalMovimiento.tsx` |
| `432c686` | `ModalWizard.tsx`, `ModalesInline.tsx`, `CajaPie.tsx` |
| `f4f2bbf` | Eliminación código legacy vanilla JS/HTML |

```
src/renderer/pages/caja/
  types.ts · calculosFiscales.ts · useCarrito.ts · TicketTabs.tsx
  BuscadorArticulos.tsx · CarritoLista.tsx · ModalCobro.tsx · ModalAnular.tsx
  ModalMovimiento.tsx · CodigoInput.tsx · ui.tsx · ModalWizard.tsx
  ModalesInline.tsx · CajaPie.tsx
```

---

## LO QUE SE HIZO: tipado IPC + bugs críticos (2026-06-09 mañana)

| Commit | Descripción |
|--------|-------------|
| `a70e9e8` | FASE 1: reescritura `api.d.ts` — ~35 interfaces, 0 `Promise<any>` |
| `180111a` | FASE 2: reemplazar `useState<any>` en páginas clave |
| `38dfb7f` | FASE 3: tests de contrato backend |
| `3f91810` | `turno_id` → `turnoId` en movimientos; null guard en getById |
| `c16b235` | **CRÍTICO**: ventas nunca se guardaban — `transacciones.create` recibía objeto plano |
| `02af0c4` | `html/body overflow:hidden` |
| `30b8367` | Layout: sidebar y headers fijos |
| `9fed747` | Buscador F10: substring + multi-palabra |
| `252acbc` | Impresoras: excluir virtuales |
| `d4a6c39` | Hooks navegación por teclado |

---

## LO QUE SE HIZO: bugs de runtime (2026-06-08)

| Commit | Bug |
|--------|-----|
| `435ad05` | Catálogo: `limit:500` cortaba → 196 artículos inalcanzables |
| `fa53baf` | Departamentos: eliminación bloqueada con artículos asignados |
| `01a9bdf` | Turnos: auto-cierre al cruzar medianoche no guardaba totales |
| `0edbd80` | Inventario: FECHA mostraba '—' y ajuste fallaba por mismatch de params |

---

## PENDIENTE (prioridades)

1. **Tests de regresión**: cierre de turno, ajuste de stock, informes — no hay tests de integración para estos flujos
2. **Informes restantes**: `saldosClientes`, `ventasPorCliente`, `ventasPorHoraRango` — ver lista en sección de arriba
3. **Log de actividad** (ítem 12): tabla `actividad_log`, loguear ventas/cancelaciones/cambios de precio/movimientos; UI en Configuracion solo para admin
4. **Excel import con preview** (ítem 13): preview + filas en rojo por error + progreso por lotes
5. **Vuln B — firmar license.json**: token offline editable con Notepad (AES cifrado pero sin firma)

---

## HECHO EN SESIONES ANTERIORES

- **Auditoría de runtime completa**: 12 bugs cerrados (BUG-01 a BUG-12)
- **Seguridad**: Firebase rules publicadas, credenciales de Gmail gitignoreadas
- **UX**: vuelto no obligatorio, "Cerrar sesión"
- **WMIC → Get-Printer**
- **Performance FASE 0–4**: VirtualTable + searchPaged, framer-motion auditado
- **UX/UI** oscuro moderno: glassmorphism, gradientes, animaciones

---

## REGLAS DE ORO (no romper)

- `credentials.js` y `.env` nunca se commitean (en `.gitignore`)
- Las licencias se crean/renuevan solo desde Firebase Console o Admin SDK
- `artifactName` con puntos en `package.json` — no renombrar o el auto-updater falla
- Tema oscuro y colores de marca siempre — no introducir componentes con fondo blanco
