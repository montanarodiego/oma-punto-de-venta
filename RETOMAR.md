# RETOMAR — Estado de OmaTech POS

**Fecha:** 9 jun 2026 (actualizado al final de sesión)
**Rama:** main

---

## LO QUE SE HIZO: refactor Caja.tsx → caja/ (sesión 2026-06-09 tarde)

**Resultado:** `Caja.tsx` pasó de **1776 → 436 líneas** (75% reducción). Refactor puro — cero cambio de comportamiento.

### Módulos extraídos a `src/renderer/pages/caja/`

| Commit | Módulo | Descripción |
|--------|--------|-------------|
| `69c7cc7` | `types.ts` | Interfaces, constantes, utils puros (CartItem, Ticket, PromoItem, fmt, mkItem, aplicarPromoAItem, WIZARD_MODOS) |
| `084d46f` | `calculosFiscales.ts` + `tests/calculos_fiscales.test.js` | Función pura de cálculo fiscal. **13 tests cubriendo todos los modos** (mono, restaurante, RI, mayorista, farmacia, personalizado, descuentos, IVA proporcional) |
| `c6b5931` | `useCarrito.ts` | Hook con todo el estado del carrito multi-ticket |
| `e8ba7d9` | `TicketTabs.tsx` | Tabs de tickets |
| `7ddc189` | `BuscadorArticulos.tsx` | Overlay buscador F10 con estado interno |
| `31f1623` | `CarritoLista.tsx` + `CartRow` | Tabla del carrito con fila memoizada |
| `8f05ad7` | `ModalCobro.tsx` | Modal de cobro con `forwardRef/useImperativeHandle` para IPC |
| `08e3ace` | `ModalAnular.tsx` | Modal anular/devolver con init via `useEffect` on open |
| `e188286` | `ui.tsx`, `CodigoInput.tsx`, `ModalMovimiento.tsx` | Componentes UI compartidos, input de código con scanner, modal de movimiento |
| `432c686` | `ModalWizard.tsx`, `ModalesInline.tsx`, `CajaPie.tsx` | Wizard de modo, 4 modales pequeños, footer del pie de caja |

### Arquitectura resultante de caja/

```
src/renderer/pages/caja/
  types.ts              ← interfaces + constants + pure utils
  calculosFiscales.ts   ← pure fiscal function (testable)
  useCarrito.ts         ← multi-ticket state hook
  TicketTabs.tsx        ← tab bar
  BuscadorArticulos.tsx ← F10 overlay (self-contained)
  CarritoLista.tsx      ← cart table + CartRow (React.memo)
  ModalCobro.tsx        ← cobro modal (forwardRef, exposes cobrar())
  ModalAnular.tsx       ← anular/devolver modal
  ModalMovimiento.tsx   ← entrada/salida de caja
  CodigoInput.tsx       ← scanner input (forwardRef, handle: focus/animOk/animError/clear)
  ui.tsx                ← ToolbarBtn, PieStat, ModalOverlay, ModalBox
  ModalWizard.tsx       ← primera configuración de modo negocio
  ModalesInline.tsx     ← ModalLibre, ModalDescItem, ModalRenombrar, ModalQtyEditor
  CajaPie.tsx           ← pie de caja (totales + botón cobrar)
```

### Tests

```bash
node tests/calculos_fiscales.test.js   # 13 assertions — todos pasan
```

---

## LO QUE SE HIZO ANTES (sesión 2026-06-09 mañana)

### Tipado IPC completo (FASE 1–3)

| Commit | Descripción |
|--------|-------------|
| `a70e9e8` | FASE 1: reescritura de `api.d.ts` — ~35 interfaces, 0 `Promise<any>` |
| `180111a` | FASE 2: reemplazar `useState<any>` en Informes, Turno, Inventario, PedidosCompra |
| `38dfb7f` | FASE 3: tests de contrato backend (`tests/contrato_backend.test.js`) |

### Bugs de runtime corregidos por el tipado

| Commit | Archivo | Bug |
|--------|---------|-----|
| `3f91810` | `Caja.tsx:1735` | `turno_id` → `turnoId` en movimientos.registrar |
| `3f91810` | `Caja.tsx:691` | null guard faltante en getById antes de `t.detalle` |
| `c16b235` | `Caja.tsx:534` | **CRÍTICO**: ventas completamente rotas — create recibía objeto plano, modelo espera `{ transaccion, detalle }`. Test de integración agregado (`tests/cobro_integracion.test.js`, 5 escenarios pasando) |

### 3 fixes de UX/layout

| Commit | Fix |
|--------|-----|
| `02af0c4` | `html/body { overflow:hidden }` — capa de seguridad contra scroll del documento |
| `30b8367` | **Layout**: sidebar y headers de columna fijos al scrollear listas largas. Causas: wrapper explícito 100vh alrededor de AnimatePresence + `min-h-0` en VirtualTable + `border-collapse:separate` para sticky headers |
| `9fed747` | **Buscador F10**: "pancho" ahora encuentra "1 SUPER PANCHO CON PAPAS" — FTS fallaba silenciosamente; reemplazado por LIKE con AND por palabra |
| `252acbc` | **Impresoras**: filtro por `PortName` y `Name` para excluir OneNote/PDF/Fax y no despertar apps virtuales al listar |

---

## PENDIENTE (prioridades)

1. **Error Boundary global**: la app no tiene manejo de errores de renderizado React
2. **Tests de regresión**: cierre de turno, ajuste de stock, informes
3. **Informes avanzados**: 8 reportes definidos en el backend sin UI React
4. **Log de actividad** (ítem 12 de la lista de mejoras)
5. **Excel import con preview** (ítem 13)
6. **Vuln B — firmar license.json**: token offline editable con Notepad

---

## HECHO EN SESIONES ANTERIORES

- **5 bugs de runtime cerrados** (sesión 2026-06-08): Informes $0, Inventario fecha/usuario '—', Turnos $0 al cruzar medianoche, departamentos bloqueados, catálogo 500 límite
- **Auditoría de runtime completa**: 12 bugs cerrados (BUG-01 a BUG-12)
- **Seguridad**: Firebase rules publicadas, credenciales de Gmail gitignoreadas
- **UX**: vuelto no obligatorio, "Cerrar sesión"
- **WMIC → Get-Printer**
- **Navegación sin mouse**: flechas en carrito, focus trap, atajos F1–F9
- **Performance FASE 0–4**: VirtualTable + searchPaged, framer-motion auditado
- **UX/UI** oscuro moderno: glassmorphism, gradientes, animaciones

---

## REGLAS DE ORO (no romper)

- `credentials.js` y `.env` nunca se commitean (en `.gitignore`)
- Las licencias se crean/renuevan solo desde Firebase Console o Admin SDK
- `artifactName` con puntos en `package.json` — no renombrar o el auto-updater falla
- Tema oscuro y colores de marca siempre — no introducir componentes con fondo blanco
