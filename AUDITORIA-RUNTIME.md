# Auditoría de Runtime — Bugs de Migración React

> Fecha: 2026-06-06  
> Scope: `src/renderer/**/*.{tsx,ts}`  
> Metodología: revisión manual de código, sin ejecutar la app.  
> **NO se modificó ningún archivo de código.**

---

## Resumen ejecutivo

| Severidad | Cantidad | Arreglados |
|-----------|----------|------------|
| Crítico   | 2        | 2 (BUG-01, BUG-02) |
| Grave     | 3        | 3 (BUG-03, BUG-04, BUG-05) |
| Moderado  | 5        | 2 (BUG-09, BUG-10) |
| Leve      | 2        | —          |
| **Total** | **12**   | **7**      |

---

## CRÍTICOS — Pueden corromper datos o causar pérdidas financieras

---

### BUG-01 · `Caja.tsx:279` — RACE CONDITION: el carrito pierde ítems con scan rápido ✅ ARREGLADO

> **Fix aplicado** (`commit 733a183` → rama `main`): toda la mutación del carrito se movió dentro de `setTickets(prev => ...)`. El cálculo de `newCarrito` usa `prev[activeIdx]` (estado fresco del momento en que React procesa el updater), no el closure stale de `ticket.carrito`. Llamadas concurrentes se encolan y cada una ve el resultado de la anterior.

**Patrón**: Race condition + `setState` sobre carrito stale

```js
// Caja.tsx líneas 268-283
async function agregarArticulo(art: Articulo, cantidad = 1) {
    const existing = ticket.carrito.findIndex(...);   // ← lee snapshot del closure
    if (existing >= 0) {
        // path sincrónico — OK
    } else {
        let promos = [];
        try { promos = await window.api.promociones.listarPorArticulo(art.id); } catch {}
        //       ^^^ AWAIT: aquí el closure de ticket.carrito queda congelado
        updateTicket(activeIdx, { carrito: [...ticket.carrito, item] });
        //                                   ^^^^^^^^^^^^^ STALE
    }
}
```

`updateTicket` hace `setTickets(prev => prev.map(...{ ...t, ...patch }))`, que es un functional update correcto — **pero `patch.carrito` ya está calculado con la snapshot stale antes del await**. El functional updater recibe el estado más reciente de `tickets`, pero lo descarta y usa el `patch.carrito` viejo.

**Escenario de fallo (scan rápido de dos artículos distintos, ninguno en el carrito)**:

1. Call-1: lee `ticket.carrito = []`, awaita promos de `art1`
2. Call-2: lee `ticket.carrito = []` (React todavía no commitó), awaita promos de `art2`
3. Call-1 resuelve → `patch = { carrito: [item1] }` → `setTickets(prev → { carrito: [item1] })`
4. Call-2 resuelve → `patch = { carrito: [item2] }` → `setTickets(prev → { carrito: [item2] })` ← **SOBREESCRIBE ITEM1**

**Resultado en producción**: el cajero escanea dos artículos en menos de ~400ms, uno desaparece silenciosamente. El cliente paga de menos, el stock se descuenta, el turno no cuadra.

**Reproducción**: muy probable en kioscos con scanner USB rápido y catálogo con muchas promociones configuradas (el await de promos puede tardar 50-300ms).

---

### BUG-02 · `Inventario.tsx:33-38` — RACE CONDITION: búsqueda sin debounce sobreescribe resultados ✅ ARREGLADO

> **Fix aplicado** (`commit 53c74cc` → rama `main`): se agregó debounce y cancelación de búsqueda stale. Las llamadas previas se descartan cuando llega una nueva query, garantizando que `setArtResultados` solo se ejecuta con el resultado de la última búsqueda activa.

**Patrón**: Race condition en async sin cancelación de requests anteriores

```js
// Inventario.tsx líneas 33-38
async function buscarArt(q: string) {
    setArtBusqueda(q); setArtSel(null);
    if (!q.trim()) { setArtResultados([]); return; }
    const res = await window.api.articulos.search(q);  // ← cada keystroke dispara esto
    setArtResultados(res);                              // ← el último en resolver gana
}
```

Se invoca desde el `onChange` del input — un IPC por cada letra tipeada, sin debounce ni `AbortController`. Los resultados se aplican en el orden en que los IPC resuelven, no en el orden en que se enviaron.

**Escenario de fallo con tipeo rápido "coca"**:

- "c" → IPC-1 (query amplia, muchos resultados, SQLite tarda más)
- "co", "coc", "coca" → IPC-2,3,4 (más específicas, resuelven más rápido)
- IPC-4 llega: `setArtResultados([Coca-Cola 500ml])`
- IPC-1 llega después: `setArtResultados([Coca-Cola, ..., 73 resultados más])` ← **SOBREESCRIBE**

El usuario ve los resultados de "c" cuando buscó "coca". Si selecciona el primero de la lista pensando que es el artículo correcto, **el ajuste de stock se aplica al artículo equivocado**.

---

## GRAVES — Bugs funcionales reproducibles

---

### BUG-03 · `Caja.tsx:289-295` — RACE CONDITION: doble scan del mismo artículo nuevo lo agrega duplicado ✅ ARREGLADO

> **Fix aplicado junto con BUG-01**: el functional updater `setTickets(prev => ...)` hace el `findIndex` sobre `prev[activeIdx].carrito` (el estado más reciente). Si Call-1 ya agregó el ítem, Call-2 lo ve y toma el path de `cantidad += 1` en vez de agregar un duplicado.

**Patrón**: Race condition; ausencia de guard de in-flight

```js
// Caja.tsx líneas 289-295
async function procesarCodigo(codigo: string) {
    setCodigoVal('');
    const art = await window.api.articulos.getByCodigo(codigo.trim());
    if (art) { agregarArticulo(art); }  // agregarArticulo también es async
}
```

El timer de debounce de 120ms (`timerCodigo`) previene el doble disparo en condiciones normales. Pero si el mismo código se scanea dos veces en menos de 120ms (algunos scanners industriales con lectura < 50ms), o si el usuario presiona Enter mientras el timer ya corrió, se lanzan dos `procesarCodigo` en paralelo.

**Escenario**: artículo nuevo (no en carrito), el `findIndex` en ambas calls retorna `-1` (el carrito aún no fue actualizado por la primera call), ambas llaman `agregarArticulo` → ambas esperan promos → ambas agregan el ítem como nuevo. Resultado: **artículo duplicado en lugar de cantidad 2**.

Más sutil: si el artículo YA estaba en el carrito en la primera call (path sincrónico) pero el carrito no se commitó antes de la segunda call, la segunda call también lo ve como `existing >= 0` y suma cantidad, pero sobre la snapshot stale. Resultado: la suma de cantidad del segundo call sobreescribe la del primero.

---

### BUG-04 · `Caja.tsx:154-155` — TIMERS no limpiados al desmontar el componente ✅ ARREGLADO

> **Fix aplicado**: el `return` del `useEffect([])` de init ahora llama `clearTimeout` sobre los tres refs antes de liberar el componente.

**Patrón**: Resource leak; setTimeout IDs guardados en refs sin cleanup en unmount

```js
// Caja.tsx líneas 154-155
const timerCodigo   = useRef<NodeJS.Timeout|null>(null);
const timerBuscador = useRef<NodeJS.Timeout|null>(null);
const timerCliente  = useRef<NodeJS.Timeout|null>(null);
```

Estos refs se limpian antes de crear nuevos timers (correcto), pero **el `useEffect([])` principal solo hace cleanup de los listeners IPC**, no de estos timers:

```js
// Caja.tsx líneas 160-186
useEffect(() => {
    async function init() { ... }
    init();
    const u1 = window.api.onCobrarConTicket(...);
    const u2 = window.api.onCobrarSinTicket(...);
    const u3 = window.api.onAbrirCobro(...);
    return () => { u1(); u2(); u3(); };  // ← timers NO limpiados
}, []);
```

**Escenario**: el usuario escribe un código parcial en el input de Caja (timerCodigo en curso) y navega a Catálogo antes de los 120ms. El componente se desmonta, pero el timer sobrevive. Cuando dispara, llama `procesarCodigo(val)` que:
1. Llama `window.api.articulos.getByCodigo(...)` — IPC al proceso main (innecesario)
2. Llama `agregarArticulo(art)` — que llama `window.api.promociones.listarPorArticulo(...)` (otro IPC)
3. Llama `updateTicket(activeIdx, ...)` — setState en componente desmontado (no-op en React 18, pero el IPC ya fue)

Mismo problema para `timerBuscador` (buscador modal) y `timerCliente` (búsqueda de cliente en cobro).

---

### BUG-05 · `Turno.tsx:96-103` — MISSING try/catch en `cancelarMov`; patrón repetido ✅ ARREGLADO

> **Fix aplicado**: `cancelarMov` ahora tiene try/catch/finally con estado `cancelando` que deshabilita ambos botones del modal durante el IPC. El error se muestra inline en el modal (`cancelMovError`). En `Clientes`: `cargar()` tiene try/catch/finally para que `loading` siempre vuelva a `false`; `eliminar()` captura el error y muestra un toast en vez de silenciarlo.

**Patrón**: async sin manejo de errores; UI puede quedar colgada

```js
// Turno.tsx líneas 96-103
async function cancelarMov() {
    if (!cancelMovId || !cancelMovMotivo.trim()) { setCancelMovError('El motivo es obligatorio.'); return; }
    await window.api.movimientos.cancelar(cancelMovId, cancelMovMotivo);  // ← sin try/catch
    setCancelMovId(null); setCancelMovMotivo('');
    const [r, m] = await Promise.all([...]);
    setResumen(r); setMovimientos(m);
    showToast('Movimiento cancelado.', 'ok');
}
```

Si el IPC lanza (DB locked, foreign key constraint, etc.), la promesa rechaza sin handler. El modal de cancelación queda abierto e interactuable (no hay flag de loading/processing), lo que permite múltiples clicks sobre "Confirmar cancelación". Puede generar intentos de doble cancelación.

**Mismo patrón en**:
- `Clientes.tsx:33-37` — `cargar()` hace `setClientes(await window.api.clientes.getAll())` sin try/catch: si el IPC falla, la excepción se propaga sin feedback al usuario y `loading` queda `true`.
- `Clientes.tsx:72-74` — `eliminar()` sin try/catch: si falla, el cliente no se elimina pero tampoco hay error visible.

---

## MODERADOS — Violaciones de patrón que se manifiestan en edge cases

---

### BUG-06 · `Caja.tsx:221` — setState sin forma funcional en `nuevoTicket`

**Patrón**: `setState` que depende del valor anterior sin usar `prev =>`

```js
// Caja.tsx líneas 217-222
function nuevoTicket() {
    if (tickets.length >= MAX_TICKETS) { ... return; }
    const n: Ticket = { id: Date.now(), nombre: `Ticket ${tickets.length + 1}`, ... };
    setTickets(prev => [...prev, n]);       // ← correcto: functional
    setActiveIdx(tickets.length);           // ← incorrecto: stale tickets.length
}
```

`setActiveIdx(tickets.length)` usa el `tickets.length` del render actual, antes de que el `setTickets` previo haya commitado. Con React 18 automatic batching, ambos setState se ejecutan en un mismo ciclo, por lo que el resultado es coincidentalmente correcto (old length == índice del nuevo ticket). Pero si el patrón se extiende o se añade lógica condicional a `setTickets`, `activeIdx` podría quedar fuera de rango, causando `tickets[activeIdx] = undefined` y un crash al siguiente render de Caja.

La forma correcta: `setActiveIdx(prev => prev + 1)`.

---

### BUG-07 · `SessionContext.tsx:35-37` — `useEffect([])` con dep array incompleto

**Patrón**: dep array incompleto; violación de exhaustive-deps

```js
// SessionContext.tsx líneas 35-37
useEffect(() => {
    if (session) window.SESSION = session;  // session no está en deps
}, []);
```

`session` falta en el dep array. Si `session` es `null` en el primer render (edge case donde la sesión llega después del mount, ej. flujo con IPC async), `window.SESSION` nunca se inicializa desde este effect. En práctica, `session` se hidrata sincrónicamente desde `localStorage` en la función de inicialización del `useState`, por lo que el bug no se manifiesta. Pero si el flujo de sesión cambia en el futuro (ej. autenticación biométrica async), el bug emergería silenciosamente.

Mitigación parcial: `setSession` también actualiza `window.SESSION` directamente, así que en el flujo de login estándar está cubierto.

---

### BUG-08 · `Configuracion.tsx:84-109` — `cargarTodo()` captura `esAdmin` stale

**Patrón**: `useEffect([])` con closure sobre valor derivado de context

```js
// Configuracion.tsx líneas 84-109
const esAdmin = session?.rol === 'admin';    // ← derivado del context

useEffect(() => { cargarTodo(); }, []);

async function cargarTodo() {
    ...
    if (esAdmin) cargarUsuarios();  // ← captura esAdmin del primer render
}
```

`esAdmin` no está en el dep array del effect. Si en algún edge case `session` es `null` en el primer render y se setea después (ej. refresh de credenciales async), `esAdmin = false` y `cargarUsuarios()` nunca se llama durante esa sesión de la página, aunque el usuario sea admin. El panel de "Usuarios del sistema" aparecería vacío sin error.

---

### BUG-09 · `Caja.tsx:192-205` — keydown handler re-registra en cada modificación del carrito ✅ ARREGLADO

> **Fix aplicado**: se agregó `hotkeyRef` (mismo patrón que `cobrarRef`). El cuerpo del handler se asigna a `hotkeyRef.current` en cada render — siempre ve estado fresco sin stale closure. El `useEffect` registra el listener una sola vez con `deps: []`; el wrapper `(e) => hotkeyRef.current(e)` es estable y nunca se reemplaza, eliminando el gap remove/add entre cada scan.

**Patrón**: dep array demasiado amplio; performance + ventana de handler ausente

```js
// Caja.tsx líneas 192-205
useEffect(() => {
    const handler = (e: KeyboardEvent) => { ... borrarItemSel() ... };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
}, [buscadorOpen, tickets, activeIdx]);  // ← tickets cambia con CADA scan
```

`tickets` contiene el carrito completo. Cualquier modificación (agregar ítem, cambiar cantidad, aplicar descuento) re-ejecuta el effect: remueve el listener y lo agrega de nuevo. En hardware lento, existe un gap entre `removeEventListener` y `addEventListener` donde un keypress (F10, Del, Esc) se pierde. Con scan continuo en hora pico, este gap se produce decenas de veces por minuto.

---

### BUG-10 · `Clientes.tsx:77-89` — `registrarPago` con async sin coordinación ✅ ARREGLADO

> **Fix aplicado**: `verDetalle` tiene ahora try/catch/finally — `setDetalleLoading(false)` en el `finally` garantiza que el panel de detalle nunca queda bloqueado en "Cargando...", incluso si el `Promise.all` falla. `registrarPago` tiene try/catch que muestra un toast de error en lugar de silencio; el modal solo cierra si el IPC principal tiene éxito.

**Patrón**: múltiples awaits paralelos sin control de orden; detalleLoading puede quedar `true`

```js
// Clientes.tsx líneas 77-89
async function registrarPago(e) {
    ...
    const updated = await window.api.clientes.getById(clienteDetalle.id);
    setClienteDetalle(updated);
    await verDetalle(updated);   // setea detalleLoading: true → fetch → false
    cargar();                     // NO awaitado → corre en paralelo, setea loading: true → false
    showToast('Pago registrado.', 'ok');
}
```

`verDetalle` y `cargar()` corren en paralelo sin coordinación. Si `verDetalle` lanza (no tiene try/catch interno), `detalleLoading` queda en `true` para siempre en esa sesión; el panel de detalle muestra "Cargando..." indefinidamente. Además, `verDetalle` llama `setClienteDetalle(c)` internamente (línea 40), lo que puede sobreescribir un click del usuario en otro cliente si éste navegó a otro registro mientras el await estaba pendiente.

---

## LEVES — Violaciones de patrón sin impacto funcional inmediato

---

### BUG-11 · `Sidebar.tsx:143-148` — `ReporteModal.useEffect` con dep array incompleto

**Patrón**: dep array incompleto (funcional pero violación de regla)

```js
// Sidebar.tsx líneas 143-148
useEffect(() => {
    if (open) {
        setModulo(PATH_MAP[currentPath] ?? 'Otro');
        ...
    }
}, [open, currentPath]);  // ← PATH_MAP no está en deps
```

`PATH_MAP` es un objeto literal definido dentro del componente (nueva referencia en cada render). No está en el dep array. Funcionalmente inocuo porque sus valores son hardcoded y nunca cambian. Si en algún refactor `PATH_MAP` pasara a depender de props o state, el bug sería silencioso.

---

### BUG-12 · `Caja.tsx:268-269` — `mayoreoMode` capturado stale en `agregarArticulo`

**Patrón**: Stale closure menor en función async

```js
// Caja.tsx líneas 268-269
async function agregarArticulo(art: Articulo, cantidad = 1) {
    const precio = (mayoreoMode && art.precio_mayoreo > 0)   // ← stale si cambia durante await
        ? art.precio_mayoreo
        : art.precio_unitario;
```

Si el usuario activa/desactiva modo mayoreo (F11) exactamente mientras un `agregarArticulo` está esperando el fetch de promos (`await window.api.promociones.listarPorArticulo`), el precio del ítem se calcula con el modo incorrecto. El race window es pequeño (~50-300ms), pero en un negocio con cliente esperando y cajero apurado es plausible.

---

## Índice de archivos afectados

| Archivo | Bugs |
|---------|------|
| `src/renderer/pages/Caja.tsx` | BUG-01, BUG-03, BUG-04, BUG-06, BUG-09, BUG-12 |
| `src/renderer/pages/Inventario.tsx` | BUG-02 |
| `src/renderer/pages/Turno.tsx` | BUG-05 |
| `src/renderer/pages/Clientes.tsx` | BUG-05 (patrón), BUG-10 |
| `src/renderer/context/SessionContext.tsx` | BUG-07 |
| `src/renderer/pages/Configuracion.tsx` | BUG-08 |
| `src/renderer/components/layout/Sidebar.tsx` | BUG-11 |

---

## Orden de prioridad para fix

1. ~~**BUG-01** — Race condition carrito (crítico, impacto financiero directo)~~ ✅ Arreglado
2. ~~**BUG-02** — Race condition búsqueda Inventario (crítico, stock equivocado)~~ ✅ Arreglado
3. ~~**BUG-03** — Doble scan artículo (grave, reproducible con scanner rápido)~~ ✅ Arreglado
4. ~~**BUG-05** — Missing try/catch en Turno y Clientes (grave, UI colgada)~~ ✅ Arreglado
5. ~~**BUG-04** — Timers no limpiados (grave, IPCs innecesarios tras unmount)~~ ✅ Arreglado
6. ~~**BUG-10** — registrarPago sin coordinación (moderado, detalleLoading stuck)~~ ✅ Arreglado
7. ~~**BUG-09** — Keydown re-registra en cada scan (moderado, performance + gap)~~ ✅ Arreglado
8. **BUG-06** — nuevoTicket activeIdx sin functional (moderado, fragile)
9. **BUG-08** — Configuracion esAdmin stale (moderado, edge case)
10. **BUG-07** — SessionContext dep incompleto (moderado, edge case)
11. **BUG-12** — mayoreoMode stale (leve, ventana muy pequeña)
12. **BUG-11** — ReporteModal dep incompleto (leve, sin impacto actual)
