# Changelog

## v2.3.0 — 2026-06-13

**Rediseño UX/UI completo**

- Tipografía mejorada globalmente: `tabular-nums` en precios y códigos, tamaños de fuente más expresivos
- Caja: CarritoLista rediseñada con filas alternas, stock semaforizado (rojo/amarillo/gris), botones +/− de 32×32px, estado vacío con tip de uso
- Catálogo: badges SIN STOCK/Stock bajo, acciones con visibilidad mejorada
- Modal de cobro: total en 48px, vuelto en 32px, íconos SVG por método de pago, estado activo con color accent
- Informes: gráfico de barras "Ventas por día" (Chart.js), KPI cards con borde de color por métrica, barra de porcentaje por forma de pago
- Turno: badge ABIERTO con punto pulsante verde, efectivo esperado en 32px, ✓/⚠ según diferencia de caja
- Configuración: botón Guardar con feedback visual "✓ Guardado" por 2.5 segundos
- Sidebar: borde izquierdo accent en pestaña activa
- **Fix:** escribir en el campo código solo muestra el dropdown; el carrito solo se modifica con Enter o clic en sugerencia

---

## v2.2.1 — 2026-06-12

**Bugfixes post-auditoría**

- Fix: prevenir devolución parcial duplicada de los mismos ítems (ERR-01/ERR-02)
- Fix: tipo `ArticuloStockBajo` y campo `ruta` en `backup:hacerAhora` en api.d.ts
- Fix: bugs menores detectados en auditoría v2.2.0

---

## v2.2.0 — 2026-06-11

**7 nuevas funcionalidades**

- Cantidad directa con asterisco en campo código (ej: `3*7702003` agrega 3 unidades)
- Vuelto automático en modal de cobro, centrado y en tipografía grande
- Verificador de precios con F9: overlay global disponible desde cualquier módulo
- Devolución parcial de ítems seleccionados en historial de ventas (ModalAnular)
- Compras sugeridas por stock mínimo en módulo Proveedores
- Límite de efectivo en caja con alerta visual y advertencia en cobro
- Email automático con resumen de turno al cerrar (vía Gmail)

---

## v2.1.0 — 2026-06-09

**Refactor Caja + Informes ampliados + Robustez**

- Caja.tsx refactorizado: 1776 → 436 líneas; extraídos 14 módulos en `pages/caja/`
- Informes: columna Ganancia en top artículos, tabla utilidad bruta por artículo con margen % y semáforo, stat card "Mejor día", gráfico por departamento y gráfico de evolución mensual (Chart.js)
- Error boundary por ruta: crash en Informes no tumba Caja
- Recuperación automática del carrito desde localStorage tras crash
- Tipado IPC completo: api.d.ts con ~35 interfaces, 0 `Promise<any>`
- Tests de contrato backend para informes y turnos
- Mejoras UX: sidebar, modales de turno, importación Excel/CSV
- Fix: buscador F10 encuentra por nombre con substring y multi-palabra
- Fix: impresoras virtuales excluidas de la lista (OneNote, PDF, Fax)
- Fix: layout con sidebar y headers fijos, scroll solo en área de tabla

---

## v2.0.1 — 2026-06-07

- Fix: reconstrucción completa del sistema de auth local
- Fix: sincronización Firebase reconectada (`negocioIdActivo` correctamente inicializado)
- Fix: race condition en verificación de primer uso al arranque
- Fix: ventas nunca se guardaban (`transacciones.create` recibía objeto plano)
- Fix: movimientos de caja usaban `turno_id` en snake_case en vez de `turnoId`

---

## v2.0.0 — 2026-06-05

**Migración completa del renderer a React**

- SPA React 19 + Vite + TypeScript + Tailwind CSS v3 + Framer Motion v12
- Hash Router con react-router-dom v7
- Design system propio: variables CSS, glassmorphism en modales, fuente Outfit
- Todos los módulos migrados: Caja, Catálogo, Clientes, Inventario, Turno, Informes, Proveedores, Pedidos de Compra, Configuración, Comprobante
- 12 bugs de runtime corregidos: race conditions en carrito, búsqueda y keydown; stale closures; memory leaks de timers
- Corrección de ganancia bruta: ahora descuenta por ítem antes de calcular utilidad
- Alertas de stock en 3 niveles (sin stock / bajo / insuficiente) en Caja y Catálogo
- Corte Z automático al cerrar turno con ticket ESC/POS completo
- Detección de lector de código de barras por velocidad de input con beep Web Audio
- Movimientos de caja con categorías tipadas y badge en historial
- Pestaña "Stock bajo" en Informes con filtros y exportación CSV
- Estado de cuenta corriente imprimible por cliente (ticket ESC/POS)
- Límite de crédito con alertas visuales en cobro
- Historial de cambios de precio por artículo
- Restauración de backup desde la UI
- Wizard de primera configuración para instalaciones nuevas
- VirtualTable para listas grandes (5000+ artículos sin degradar performance)
- FTS5 en SQLite para búsqueda instantánea por nombre y código

---

## v1.8.0 y anteriores

Versión legacy con renderer HTML+JS vanilla. Reemplazada por v2.0.0.
