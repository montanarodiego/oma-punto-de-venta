# Auditoría Funcional — OmaTech POS v2.0.0
**Fecha:** 2026-06-05  
**Alcance:** Post-migración React. Solo análisis estático de código — no se ejecutó la app.  
**Metodología:** Lectura de cada página + cruce contra ipc.js + preload.js + modelos.

---

## Resumen ejecutivo

| Aspecto | Estado |
|---|---|
| Botones/acciones con IPC roto | **0** |
| Stale closures activos | **0** (F1/F2 ya corregido con useRef) |
| Features con backend pero sin UI | **4** (kits, promociones, informes avanzados, saldo CC manual) |
| Bug preexistente crítico | **1** (recepciones.js tabla incorrecta — no afecta flujo principal) |
| Flujo de venta end-to-end | ✅ correcto y atómico |
| Flujo de devoluciones | ✅ correcto, saldo CC protegido con MAX(0,...) |

**Diagnóstico general:** La app está funcional. Todo lo que tiene UI está cableado correctamente.
Lo que está roto son features que nunca se migraron de la versión legacy
(kits de componentes, promociones, reportes avanzados).

---

## Parte 1 — Lo que está bien cableado

### Caja.tsx
Todos los 25 calls a `window.api.*` tienen handler IPC real.

| Operación | API llamada | Estado |
|---|---|---|
| Cargar config inicial | `config.get(*)` x4 | ✅ |
| Turno activo | `turnos.getActivo()` | ✅ |
| Escaneo de código | `articulos.getByCodigo(codigo)` | ✅ |
| Búsqueda F10 | `articulos.search(query)` | ✅ |
| Crear venta | `transacciones.create(data)` | ✅ |
| Abrir comprobante | `caja.abrirComprobante({...})` | ✅ |
| Imprimir ticket | `printer.imprimir(id, extra)` | ✅ |
| Buscar cliente en cobro | `clientes.search(query)` | ✅ |
| Entrada/salida de caja | `movimientos.registrar(data)` | ✅ |
| Anulaciones recientes | `devoluciones.recientes(60)` | ✅ |
| Detalle de venta | `transacciones.getById(id)` | ✅ |
| Anulación total | `devoluciones.cancelar(data)` | ✅ |
| Devolución parcial | `devoluciones.parcial(data)` | ✅ |
| Cambiar modo negocio | `config.set('modo_negocio', id)` | ✅ |
| F1/F2 cobrar | `onCobrarConTicket/SinTicket` (useRef, sin stale) | ✅ |
| F12 abrir cobro | `onAbrirCobro` + keydown listener | ✅ |

**Atajos locales Caja** (keydown con deps correctos `[buscadorOpen, tickets, activeIdx]`):

| Tecla | Acción | Estado |
|---|---|---|
| F10 | Abre buscador de artículos | ✅ |
| F11 | Toggle mayoreo | ✅ |
| F12 | Abre modal de cobro | ✅ |
| Insert | Ítem libre | ✅ |
| Delete | Borra ítem seleccionado | ✅ |
| Escape | Cierra buscador | ✅ |

---

### Catálogo.tsx
| Operación | API | Estado |
|---|---|---|
| Listar artículos + departamentos | `articulos.getAll()`, `departamentos.getAll()` | ✅ |
| Crear/editar artículo | `articulos.create/update()` | ✅ |
| Eliminar artículo | `articulos.delete()` | ✅ |
| Historial de precios | `articulos.precioHistorial()` | ✅ |
| CRUD departamentos | `departamentos.create/delete()` | ✅ |
| Checkbox "es_kit" | Guarda flag en `articulos.update()` | ✅ (solo el flag) |

---

### Clientes.tsx
| Operación | API | Estado |
|---|---|---|
| Listar clientes | `clientes.getAll()` | ✅ |
| Crear/editar/eliminar | `clientes.create/update/delete()` | ✅ |
| Ver transacciones + pagos | `clientes.getTransacciones()`, `clientes.listarPagos()` | ✅ |
| Registrar pago/abono | `clientes.registrarPago()` | ✅ |
| Imprimir estado de cuenta | `printer.imprimirEstadoCuenta()` | ✅ |

---

### Inventario.tsx
| Operación | API | Estado |
|---|---|---|
| Listar movimientos + stock bajo | `inventario.listarMovimientos/stockBajo()` | ✅ |
| Buscar artículo | `articulos.search()` | ✅ |
| Ajustar stock | `inventario.ajustar()` | ✅ |

---

### Informes.tsx
| Operación | API | Estado |
|---|---|---|
| Resumen rápido | `informes.resumenRapido()` | ✅ |
| Artículos más vendidos | `informes.articulosMasVendidos()` | ✅ |
| Utilidad bruta | `informes.utilidadBruta()` | ✅ |
| Ventas por día | `informes.ventasPorDia()` | ✅ |

---

### Proveedores.tsx
| Operación | API | Estado |
|---|---|---|
| CRUD completo | `proveedores.getAll/create/update/delete()` | ✅ |

---

### PedidosCompra.tsx (recién migrado)
| Operación | API | Estado |
|---|---|---|
| Listar pedidos | `pedidosCompra.listar()` | ✅ |
| Crear/editar borrador | `pedidosCompra.crear/actualizar()` | ✅ |
| Marcar enviado | `pedidosCompra.marcarEnviado()` | ✅ |
| Recibir mercadería (actualiza stock) | `pedidosCompra.recibir()` | ✅ |
| Cancelar | `pedidosCompra.cancelar()` | ✅ |
| Exportar PDF/CSV | `pedidosCompra.exportarPDF/exportarCSV()` | ✅ |
| Buscar artículos en form | `articulos.search()` | ✅ |
| Seleccionar proveedor | `proveedores.getAll()` | ✅ |

---

### Turno.tsx
| Operación | API | Estado |
|---|---|---|
| Abrir/cerrar turno | `turnos.abrir/cerrar()` | ✅ |
| Turno activo + historial | `turnos.getActivo/historial()` | ✅ |
| Resumen + movimientos | `turnos.calcularResumen()`, `movimientos.listarPorTurno()` | ✅ |
| Cancelar movimiento | `movimientos.cancelar()` | ✅ |
| Imprimir corte Z | `printer.imprimirCorteZ()` | ✅ |

---

### Configuracion.tsx
| Operación | API | Estado |
|---|---|---|
| Leer/escribir configuración | `config.getAll/get/set()` | ✅ |
| Sync manual | `sync.manual()` | ✅ |
| Backup y restauración | `backup.*` (6 métodos) | ✅ |
| Impresora (listar + prueba) | `printer.listarImpresoras/imprimirPrueba()` | ✅ |
| Reporte email | `reporteEmail.getConfig/setConfig/enviarPrueba()` | ✅ |
| CRUD usuarios | `usuarios.listar/crear/actualizar/toggleActivo()` | ✅ |

---

### Comprobante.tsx
| Operación | API | Estado |
|---|---|---|
| Cargar transacción | `transacciones.getById()` | ✅ |
| Cargar config del negocio | `config.getAll()` | ✅ |

---

### Login.tsx
| Operación | API | Estado |
|---|---|---|
| Login local | `usuarios.login()` | ✅ |
| Login Firebase | `auth.login()` | ✅ |
| Reset de contraseña | `auth.solicitarReset/verificarCodigo/resetearPassword()` | ✅ |

---

### Atajos globales (main.js)

| Tecla | Comportamiento | Condición | Estado |
|---|---|---|---|
| F1 | Cobrar con ticket | Si modal cobro abierto | ✅ |
| F1 | Navegar → Caja | Si no | ✅ |
| F2 | Cobrar sin ticket | Si modal cobro abierto | ✅ |
| F2 | Navegar → Catálogo | Si no | ✅ |
| F3 | Navegar → Inventario | Siempre | ✅ |
| F4 | Navegar → Clientes | Siempre | ✅ |
| F5 | Navegar → Proveedores | Siempre | ✅ |
| F6 | Navegar → Informes | Siempre | ✅ |
| F7 | Navegar → Turno | Siempre | ✅ |
| F8 | Navegar → Configuración | Siempre | ✅ |
| F12 | Abrir modal de cobro | Siempre | ✅ |

**No hay F-key para Pedidos** (es una pantalla nueva sin atajo asignado — está en el sidebar como ítem sin tecla).

---

### Flujo de venta end-to-end

```
1. Caja.tsx: escaneo/búsqueda
   → window.api.articulos.getByCodigo(codigo)  [ipc.js:339]
   → Articulos.getByCodigo()  [models/articulos.js]
   → SELECT * FROM articulos WHERE codigo = ?

2. Caja.tsx: carrito local (React state, sin IPC)

3. Caja.tsx: cobrar()  [línea 336]
   → window.api.transacciones.create(data)  [ipc.js:362]
   → Transacciones.create(data)  [models/transacciones.js]
   → db.transaction() {
       INSERT INTO transacciones
       INSERT INTO detalle_transaccion (por cada ítem)
       UPDATE articulos SET stock_actual = stock_actual - ?   ← stock descontado
       UPDATE clientes SET saldo_vencido = saldo_vencido + ?  ← si es CC
       INSERT INTO movimientos_inventario  ← audit trail
     }  ← ACID garantizado

4. Caja.tsx: abrir comprobante
   → window.api.caja.abrirComprobante({transaccionId})
   → main.js: abre BrowserWindow popup con Comprobante.tsx

5. Caja.tsx: imprimir (fire-and-forget, no bloquea UI)
   → window.api.printer.imprimir(id, extra)
   → Printer.buildTicketBuffer() → puerto serie/USB
```

**Invariantes verificadas:**
- `db.transaction()` asegura que stock, CC y registro son atómicos (todo o nada)
- `sync_status = 'pending'` se marca en el mismo write → sincronización posterior garantizada
- `saldo_vencido` se actualiza con `MAX(0, saldo_vencido - ?)` en devoluciones (líneas 89 y 169 de devoluciones.js) → no puede quedar negativo

---

## Parte 2 — Problemas encontrados

### CRÍTICO-1 — Kits sin UI de componentes
**Archivo:** `src/renderer/pages/Catalogo.tsx` (checkbox en línea 365)  
**Archivo backend:** `src/main/models/kits.js`, handlers `kits:getComponentes/setComponentes` en `ipc.js:333-334`

**Problema:** El checkbox `es_kit` permite marcar un artículo como kit, pero **no existe UI para definir los componentes del kit** (qué artículos y en qué cantidad lo componen). La migración a React perdió ese modal.

**Impacto en producción:** Si una venta incluye un artículo marcado como kit, el stock que se descuenta es el del kit en sí, **no el de sus componentes**. Esto rompe la lógica de kits si algún artículo ya tiene componentes cargados en la DB desde la versión legacy.

**Handlers listos:** `window.api.kits.getComponentes(kitId)` y `window.api.kits.setComponentes(kitId, comps)` — solo falta el modal en Catalogo.tsx.

---

### CRÍTICO-2 — Promociones completamente ausentes de la UI
**Archivo afectado:** ninguno (feature ausente)  
**Backend:** `ipc.js:408-412` — 5 handlers listos: `promociones:listarPorArticulo/listarActivas/listarTodas/crear/eliminar`

**Problema:** No existe ninguna página ni sección para gestionar promociones. El tipo `CartItem` en Caja.tsx tiene `promoId?: number` (línea 24), lo que indica que la Caja estaba preparada para mostrar precios promocionales, pero **`window.api.promociones.*` nunca se llama en ningún archivo del renderer**.

**Impacto:** Los comercios no pueden aplicar precio especial por volumen. Las promociones cargadas en la DB desde la versión legacy tampoco se aplican.

---

### CRÍTICO-3 — 8 de 12 reportes sin UI
**Archivo:** `src/renderer/pages/Informes.tsx` — solo usa 4 handlers

| Handler disponible | ¿Tiene UI? |
|---|---|
| `informes.resumenRapido` | ✅ |
| `informes.articulosMasVendidos` | ✅ |
| `informes.utilidadBruta` | ✅ |
| `informes.ventasPorDia` | ✅ |
| `informes.ventasPorPeriodo` | ❌ sin UI |
| `informes.saldosClientes` | ❌ sin UI (importante: clientes con deuda pendiente) |
| `informes.ventasPorHora` | ❌ sin UI |
| `informes.mejorDia` | ❌ sin UI |
| `informes.ventasPorCliente` | ❌ sin UI |
| `informes.ventasPorMes` | ❌ sin UI |
| `informes.ventasPorDepartamento` | ❌ sin UI |
| `informes.ventasPorHoraRango` | ❌ sin UI |

**Impacto:** El comercio no puede ver análisis de tendencias, ni ranking de clientes, ni resumen de deuda total de CC.

---

### MENOR-1 — `clientes.liquidarDeuda` y `clientes.cancelarPago` sin UI
**Archivo:** `ipc.js:355-356` — handlers registrados  
**Renderer:** ninguna página los llama

`liquidarDeuda(id, formaPago)` cierra toda la deuda de un cliente en un solo pago (probablemente distinto de `registrarPago` que es un abono parcial). No está en la UI de Clientes.tsx.  
`cancelarPago(pagoId)` anula un abono ya registrado. Tampoco aparece.

---

### MENOR-2 — `inventario.kardex` sin UI
**Archivo:** `ipc.js:441` — handler registrado  
`inventario.kardex(artId)` devuelve el historial de movimientos de stock de un artículo específico. Inventario.tsx muestra movimientos globales pero no un kardex individual por artículo.

---

### MENOR-3 — Bug preexistente en `recepciones.js` línea 76
**Archivo:** `src/main/models/recepciones.js:76`

```javascript
// BUG: actualiza la tabla INCORRECTA
"UPDATE pedidos_proveedor SET estado = 'recibido'"
// debería ser:
"UPDATE pedidos_compra SET estado = 'recibido'"
```

**Impacto:** El handler `recepciones:crear` no se llama desde ninguna página del renderer (se usa `pedidosCompra:recibir` directamente), así que este bug **no afecta el flujo actual**. Pero si alguien llama a `recepciones:crear` en el futuro, el estado del pedido no se actualiza.

---

### MENOR-4 — Duplicado `turnos.getActivo` / `turnos.obtenerActivo`
**Archivo:** `src/main/preload.js`

```javascript
getActivo:     () => ipcRenderer.invoke('turnos:obtenerActivo'),
obtenerActivo: () => ipcRenderer.invoke('turnos:obtenerActivo'),
```

Ambos apuntan al mismo handler. Turno.tsx usa `getActivo()`, Caja.tsx también. El tipo `api.d.ts` declara ambos. No es un bug, pero es deuda técnica que confunde.

---

### MENOR-5 — F12 tiene doble handler (globalShortcut + keydown DOM)
**Archivo:** `src/main/main.js:422` + `src/renderer/pages/Caja.tsx:181`

El globalShortcut F12 manda `abrir-cobro` al renderer → `onAbrirCobro` → `setCobroOpen(true)`.  
El keydown en Caja.tsx línea 181 también llama `setCobroOpen(true)`.

**Consecuencia:** Cuando el foco está en la ventana de Caja y el usuario pulsa F12, el handler se dispara dos veces. Como `setCobroOpen(true)` en un estado ya `true` es no-op, no hay problema visible. Pero si en el futuro hay lógica en ese handler, puede causar efectos dobles.

---

## Parte 3 — Checklist de testing manual

### Bloque A: Flujo de venta básico
```
[ ] 1. Abrí la app, iniciá sesión como admin.
[ ] 2. Menú Turno → abrí un turno con $500 de efectivo inicial.
[ ] 3. Volvé a Caja. Escaneá o buscá 3 artículos distintos.
[ ] 4. Verificá que las alertas de stock aparecen si algún artículo tiene stock bajo.
[ ] 5. Aplicá un descuento global (porcentaje) y verificá que el total recalcula.
[ ] 6. Elegí forma de pago "Efectivo", ingresá un monto mayor → verificá que
       aparece el vuelto correcto.
[ ] 7. Presioná F1 (cobrar con ticket). Verificá que abre la ventana de comprobante.
[ ] 8. Andá a Inventario → buscá uno de los artículos comprados → verificá
       que el stock bajó exactamente por la cantidad vendida. CRÍTICO.
```

### Bloque B: Cuenta corriente
```
[ ] 9.  En Clientes → creá un cliente con límite de crédito $5.000.
[ ] 10. En Caja → agregá artículos, elegí forma de pago "Cuenta corriente",
        buscá y asigná ese cliente.
[ ] 11. Presioná F2 (cobrar sin ticket).
[ ] 12. En Clientes → abrí ese cliente → verificá que el saldo_vencido
        aumentó por el monto de la venta. CRÍTICO.
[ ] 13. Registrá un abono parcial ($1.000) → verificá que saldo_vencido bajó.
```

### Bloque C: Anulaciones y devoluciones
```
[ ] 14. Con la venta del bloque A activa en historial, presioná "Anular".
[ ] 15. Buscá la transacción → anulá TOTAL → confirmá.
[ ] 16. Verificá en Inventario que el stock de los artículos SUBIÓ. CRÍTICO.
[ ] 17. Hacé una venta nueva (paso 3-6). Anulá PARCIALMENTE (devolvé solo 1 ítem).
[ ] 18. Verificá que el stock sube solo del artículo devuelto.
[ ] 19. Intentá anular la transacción ya cancelada del paso 15 → debe mostrar error.
```

### Bloque D: Devolución en cuenta corriente
```
[ ] 20. Hacé una venta en CC (bloque B).
[ ] 21. Anulá esa venta en Caja.
[ ] 22. Verificá que el saldo_vencido del cliente BAJÓ por el monto
        de la venta anulada. CRÍTICO — si no baja, el cliente queda
        con deuda ficticia.
```

### Bloque E: Turno y cierre
```
[ ] 23. Hacé al menos 2 ventas en distintas formas de pago (efectivo + transferencia).
[ ] 24. Registrá una entrada de caja y una salida.
[ ] 25. Menú Turno → Cerrar turno → ingresá efectivo real.
[ ] 26. Verificá que el resumen muestra las ventas separadas por forma de pago.
[ ] 27. Si hay impresora configurada: verificá que imprime el corte Z.
```

### Bloque F: Atajos de teclado (sin mouse)
```
[ ] 28. Presioná F1-F8 desde cualquier pantalla → verificá que navegan correctamente.
[ ] 29. Desde Caja, presioná F10 → debe abrir el buscador.
[ ] 30. Presioná F11 → debe togglear modo mayoreo.
[ ] 31. Presioná F12 → debe abrir modal de cobro.
[ ] 32. Con un ítem en el carrito seleccionado, presioná Delete → debe eliminarlo.
[ ] 33. Presioná Insert → debe abrir modal de ítem libre.
[ ] 34. Con el buscador abierto (F10), presioná Escape → debe cerrarlo.
```

### Bloque G: Pedidos de compra (feature nueva)
```
[ ] 35. Menú "Pedidos" (sidebar) → crear nueva orden → elegir proveedor.
[ ] 36. Buscá artículos en el modal y agregá al menos 2.
[ ] 37. Guardá → debe aparecer con badge "Borrador".
[ ] 38. Editá el pedido (ícono lápiz) → cambiá una cantidad → guardá.
[ ] 39. Marcá como enviado (ícono avión) → badge cambia a "Enviado".
[ ] 40. Recibí la mercadería (ícono flecha abajo) → ajustá cantidades si es necesario.
[ ] 41. Verificá en Inventario/Catálogo que el stock de los artículos SUBIÓ. CRÍTICO.
[ ] 42. Desde el detalle del pedido, exportá PDF → debe pedir dónde guardarlo.
[ ] 43. Exportá CSV → ídem.
[ ] 44. Creá otro pedido y cancelalo → badge "Cancelado".
```

### Bloque H: Comportamiento por rol
```
[ ] 45. Iniciá sesión como cajero (no admin).
[ ] 46. En Caja: verificá que puede vender pero NO puede ajustar config de modo negocio.
[ ] 47. En Catálogo: verificá que NO puede crear/editar/eliminar artículos
        (si está implementado el guard de rol — a confirmar).
[ ] 48. En Pedidos: verificá que NO aparecen los botones de crear/editar/enviar/recibir/cancelar.
[ ] 49. En Inventario: verificá que NO puede ajustar stock.
```

### Bloque I: Sincronización
```
[ ] 50. Con conexión a internet, hacé una venta.
[ ] 51. Ir a Configuración → Sincronización → "Sincronizar ahora".
[ ] 52. Debe mostrar cuántos registros se sincronizaron.
[ ] 53. Sin internet (desconectá el wifi): hacé una venta → debe funcionar igual.
[ ] 54. Reconectá → sincronizá → verificá que la venta aparece en Firestore
        (Firebase Console > Firestore > negocios/{uid}/transacciones).
```

---

### Bloque J — Regresión Caja.tsx post-async (agregarArticulo)
> `agregarArticulo` pasó de sync a async (ahora fetchea promociones antes de agregar).
> Estos pasos verifican que el flujo normal no se rompió.

```
[ ] 55. Agregá un artículo SIN promos cargadas escaneando su código.
        El ítem debe aparecer en el carrito sin demora perceptible,
        con el precio correcto y sin badge PROMO.

[ ] 56. Escaneá ese mismo artículo otra vez → debe sumar cantidad en la
        fila existente (no crear una segunda fila).

[ ] 57. Escaneá 3 artículos distintos en rápida sucesión (menos de 1 seg
        entre cada uno). Los 3 deben aparecer en el carrito en orden, sin
        que ninguno se pierda (verificar que el async no genera race condition).

[ ] 58. Agregá un artículo con F10 (buscador) → debe agregarse al carrito
        de la misma manera que antes.

[ ] 59. Con artículos en el carrito, presioná F12 → el modal de cobro
        se abre. Completá el cobro con F1 (Cobrar con ticket) → la venta
        se registra una sola vez, sin error ni doble registro.

[ ] 60. Hacé otra venta y usá F2 (Cobrar sin ticket) → mismo resultado:
        una sola venta registrada.

[ ] 61. Con un ítem seleccionado en el carrito, presioná Delete →
        se elimina correctamente.

[ ] 62. Anulá en total la venta del paso 59 desde el botón "Anular" →
        el stock debe subir (las anulaciones no pasan por agregarArticulo;
        verificar que no se rompió nada colateral).
```

---

### Bloque K — Promociones por volumen
> Cubre creación en Catálogo, aplicación en Caja y el badge PROMO.

```
[ ] 63. En Catálogo, abrí un artículo existente (precio venta, ej: $100).
        En el modal debe aparecer el tab "Promociones". Hacé clic en él.

[ ] 64. Verificá que se muestra el precio regular ("Precio regular: $100")
        como referencia encima del formulario.

[ ] 65. Creá una promo: Cant. desde = 6, precio promo = $80, sin etiqueta.
        Hacé clic en "Agregar promoción". Debe aparecer en la tabla con
        la columna Descuento mostrando -20.0%.

[ ] 66. Creá una segunda promo: Cant. desde = 12, precio promo = $65.
        La tabla debe mostrar las 2 promos.

[ ] 67. Eliminá la segunda promo con la X → desaparece sin recargar la página.

[ ] 68. Cerrá el modal. Reabrí el mismo artículo en edición → tab Promociones
        → la promo (≥6 → $80) debe seguir ahí (persistida en DB).

[ ] 69. En Caja, agregá ese artículo con cantidad 5 → precio = $100,
        sin badge PROMO.

[ ] 70. Cambiá la cantidad a 6 usando el botón + → el precio debe
        cambiar a $80 y aparecer el badge PROMO verde en la fila.

[ ] 71. Bajá la cantidad a 5 con el botón − → precio vuelve a $100
        y el badge PROMO desaparece.

[ ] 72. Editá la cantidad directamente en el input numérico: escribí 6
        → precio $80 y badge PROMO. Escribí 5 → precio $100, sin badge.

[ ] 73. Borrá ese ítem. Volvé a agregar el artículo escaneando su código
        (cantidad inicial = 1) → sin promo, precio $100.
        Usá el botón + seis veces hasta llegar a 6 → en el momento que
        llega a 6 el precio y el badge deben actualizarse.

[ ] 74. Completá la venta con la promo activa (cantidad = 6, precio = $80).
        Abrí el comprobante → el importe del ítem debe ser $80 × 6 = $480,
        no $100 × 6.

[ ] 75. Creá una promo con rango acotado: Cant. desde = 3,
        Cant. hasta = 5, precio promo = $90.
        En Caja con ese artículo: cantidad 2 → sin badge; cantidad 3 → badge
        PROMO ($90); cantidad 5 → badge PROMO ($90);
        cantidad 6 → badge desaparece y precio vuelve a $80 (la promo ≥6).

[ ] 76. En Catálogo, abrí un artículo NUEVO (que acabás de crear, sin guardar).
        El tab "Promociones" NO debe aparecer (solo aplica a artículos existentes).
```

---

### Bloque L — Kits: asignación de componentes
> Cubre el tab Componentes del modal de artículo.

```
[ ] 77. En Catálogo → creá un artículo nuevo, marcá el checkbox "Es un kit".
        Debe aparecer el aviso: "Guardá el artículo primero. Después lo editás
        para asignar los componentes del kit."
        El tab "Componentes" NO debe verse todavía (artículo sin ID aún).

[ ] 78. Guardá el artículo → modal se cierra, artículo creado con badge KIT
        en la tabla.

[ ] 79. Abrí ese artículo en edición → deben aparecer los tabs
        "Datos" | "Componentes". Hacé clic en "Componentes".

[ ] 80. En el buscador de componentes, escribí parte del nombre de un artículo
        distinto. Debe aparecer el dropdown con resultados después de ~200 ms.

[ ] 81. Seleccioná un artículo del dropdown → aparece en la tabla con
        cantidad = 1. El dropdown se cierra y el buscador se limpia.

[ ] 82. Cambiá la cantidad del componente a 2 en el input de la tabla.

[ ] 83. Agregá un segundo componente distinto con el mismo buscador.

[ ] 84. Intentá buscar el primer componente ya agregado → NO debe aparecer
        en los resultados (está filtrado).

[ ] 85. Quitá el segundo componente con la X → desaparece de la tabla.

[ ] 86. Hacé clic en "Guardar" → modal se cierra sin error.

[ ] 87. Reabrí el artículo en edición → tab "Componentes" → debe mostrar
        el componente del paso 81 con cantidad = 2 (verificar persistencia).

[ ] 88. Desmarcá "Es un kit" en el tab Datos del mismo artículo → el tab
        "Componentes" debe desaparecer. Si volvés a marcarlo, reaparece.

[ ] 89. En Caja, vendé 1 unidad del artículo kit. Después revisá en Catálogo
        qué stock bajó. COMPORTAMIENTO ESPERADO ACTUAL: baja el stock del
        kit en sí, NO el de los componentes (el descuento de componentes
        requiere lógica adicional en transacciones.js, no implementada aún).
        Documentar lo que se observa.
```

---

## Apéndice: handlers IPC sin uso en renderer

Estos tienen backend pero NO se llaman desde ninguna página:

| Handler | Módulo | Impacto |
|---|---|---|
| `kits:getComponentes` | kits | Kits sin gestión de componentes |
| `kits:setComponentes` | kits | Ídem |
| `promociones:listarPorArticulo` | promociones | Promociones ausentes |
| `promociones:listarActivas` | promociones | Ídem |
| `promociones:listarTodas` | promociones | Ídem |
| `promociones:crear` | promociones | Ídem |
| `promociones:eliminar` | promociones | Ídem |
| `clientes:liquidarDeuda` | clientes | UI incompleta |
| `clientes:cancelarPago` | clientes | UI incompleta |
| `inventario:kardex` | inventario | UI incompleta |
| `informes:ventasPorPeriodo` | informes | Reportes ausentes |
| `informes:saldosClientes` | informes | Ídem |
| `informes:ventasPorHora` | informes | Ídem |
| `informes:mejorDia` | informes | Ídem |
| `informes:ventasPorCliente` | informes | Ídem |
| `informes:ventasPorMes` | informes | Ídem |
| `informes:ventasPorDepartamento` | informes | Ídem |
| `informes:ventasPorHoraRango` | informes | Ídem |
| `recepciones:crear` | recepciones | Bug en el modelo (ver MENOR-3) |
| `recepciones:listar` | recepciones | Sin UI |
| `recepciones:getById` | recepciones | Sin UI |
| `pedidos:getAll/getById/crear/marcarRecibido` | pedidos legacy | Reemplazado por pedidosCompra:* |
| `devoluciones:getByTrans` | devoluciones | Auxiliar sin UI |

**Handlers en main.js (fuera de ipc.js, patrón válido):**
- `sync:manual` → llamado desde Configuracion.tsx ✅
- `updater:get-pending/start-download/install` → UpdaterModal.tsx ✅
- `caja:abrirComprobante` → Caja.tsx ✅
- `auth:login` → Login.tsx ✅
