// Módulo Caja — punto de venta activo

// ── Constantes ─────────────────────────────────────────────────
const UNIDADES_CONTINUAS = new Set(['kg', 'g', 'litro', 'ml', 'metro', 'cm']);

// ── Estado ─────────────────────────────────────────────────────
let carrito              = [];   // [{ id, codigo, nombre, precio_unitario, stock_actual, cantidad, unidad_medida, esLibre? }]
let tasaIva              = 21;
let mostrarIvaDesglosado = true;
let clienteSeleccionado  = null;
let ultimosBuscados      = [];
let ultimosClientes      = [];
let timerBusqueda        = null;
let timerCliente         = null;
let nextIdLibre          = -1;   // IDs negativos para productos comunes
let turnoActivo          = null;

// ── Refs DOM ───────────────────────────────────────────────────
const elBusqueda          = document.getElementById('busqueda');
const elResultados        = document.getElementById('resultados-busqueda');
const elCarrito           = document.getElementById('carrito');
const elSubtotal          = document.getElementById('subtotal');
const elImpuesto          = document.getElementById('impuesto');
const elTotal             = document.getElementById('total');
const elFilaSubtotal      = document.getElementById('fila-subtotal');
const elFilaIva           = document.getElementById('fila-iva');
const elLabelTasa         = document.getElementById('label-tasa');
const elFormaPago         = document.getElementById('forma-pago');
const elSeccionEfectivo   = document.getElementById('seccion-efectivo');
const elMontoRecibido     = document.getElementById('monto-recibido');
const elVuelto            = document.getElementById('vuelto-display');
const elSeccionCliente    = document.getElementById('seccion-cliente');
const elBuscarCliente     = document.getElementById('buscar-cliente');
const elResultadosCliente = document.getElementById('resultados-cliente');
const elClienteBadge      = document.getElementById('cliente-badge');
const elClienteNombre     = document.getElementById('cliente-nombre');
const elErrorCobro        = document.getElementById('error-cobro');

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const [tasa, ivaDesglosado, hudGrande, turno] = await Promise.all([
    window.api.config.get('impuesto_porcentaje'),
    window.api.config.get('mostrar_iva_desglosado'),
    window.api.config.get('hud_grande'),
    window.api.turnos.obtenerActivo(),
  ]);
  tasaIva              = parseFloat(tasa) || 21;
  mostrarIvaDesglosado = ivaDesglosado !== '0';
  turnoActivo          = turno;
  elLabelTasa.textContent = tasaIva;
  actualizarTotales();

  // HUD Grande
  if (hudGrande === '1') aplicarHud(true);

  document.getElementById('btn-hud-toggle').addEventListener('click', async () => {
    const activo = document.body.classList.toggle('hud-grande');
    document.getElementById('btn-hud-toggle').classList.toggle('hud-on', activo);
    await window.api.config.set('hud_grande', activo ? '1' : '0');
  });

  elBusqueda.focus();
});

function aplicarHud(activo) {
  document.body.classList.toggle('hud-grande', activo);
  document.getElementById('btn-hud-toggle').classList.toggle('hud-on', activo);
}

// ── Búsqueda de artículos ──────────────────────────────────────
elBusqueda.addEventListener('input', e => {
  clearTimeout(timerBusqueda);
  const q = e.target.value.trim();
  if (!q) {
    elResultados.innerHTML = '<p class="text-gray-400 py-6 text-center text-sm">Escribí para buscar artículos</p>';
    ultimosBuscados = [];
    return;
  }
  timerBusqueda = setTimeout(() => ejecutarBusqueda(q), 250);
});

elBusqueda.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  clearTimeout(timerBusqueda);
  const q = e.target.value.trim();
  if (q) buscarYAgregar(q);
});

async function ejecutarBusqueda(q) {
  const resultados = await window.api.articulos.search(q);
  ultimosBuscados = resultados;
  renderResultados(resultados);
}

async function buscarYAgregar(q) {
  const resultados = await window.api.articulos.search(q);
  ultimosBuscados  = resultados;
  if (resultados.length === 0) {
    renderResultados(resultados);
    return;
  }
  const exacto  = resultados.find(a => a.codigo.toLowerCase() === q.toLowerCase());
  agregarAlCarrito(exacto ?? resultados[0]);
  elBusqueda.value       = '';
  ultimosBuscados        = [];
  elResultados.innerHTML = '<div class="empty-state">Escribí para buscar artículos</div>';
  elBusqueda.focus();
}

function renderResultados(lista) {
  if (lista.length === 0) {
    elResultados.innerHTML = '<p class="text-gray-400 py-6 text-center text-sm">Sin resultados</p>';
    return;
  }
  elResultados.innerHTML = lista.map(a => {
    const sinStock = Number(a.stock_actual) <= 0;
    return `
      <div class="flex items-center px-4 py-3 hover:bg-blue-50 cursor-pointer gap-3 transition-colors"
           data-action="agregar" data-id="${a.id}">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">${esc(a.nombre)}</div>
          <div class="text-xs text-gray-500 font-mono">${esc(a.codigo)}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-sm font-semibold">${fmt(a.precio_unitario)}</div>
          <div class="text-xs ${sinStock ? 'text-red-500 font-semibold' : 'text-gray-400'}">
            Stock: ${fmtNum(a.stock_actual)}
          </div>
        </div>
      </div>`;
  }).join('');
}

elResultados.addEventListener('click', e => {
  const item = e.target.closest('[data-action="agregar"]');
  if (!item) return;
  const id  = parseInt(item.dataset.id, 10);
  const art = ultimosBuscados.find(a => a.id === id);
  if (art) agregarAlCarrito(art);
});

// FIX 2: evita que click/drag en resultados haga blur en el input de búsqueda
elResultados.addEventListener('mousedown', e => { e.preventDefault(); });

// ── Carrito ────────────────────────────────────────────────────
function agregarAlCarrito(articulo) {
  const existente = carrito.find(i => i.id === articulo.id);
  if (existente) {
    existente.cantidad++;
  } else {
    carrito.push({ ...articulo, cantidad: 1 });
  }
  renderCarrito();
  actualizarTotales();
  ocultarError();
}

function renderCarrito() {
  if (carrito.length === 0) {
    elCarrito.innerHTML = '<p class="text-gray-400 py-6 text-center text-sm">El carrito está vacío</p>';
    return;
  }
  elCarrito.innerHTML = carrito.map(item => {
    const unidad   = item.unidad_medida || 'unidad';
    const continua = UNIDADES_CONTINUAS.has(unidad);
    const paso     = continua ? '0.001' : '1';
    return `
    <div class="flex items-center gap-2 py-2.5">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate">${esc(item.nombre)}</div>
        <div class="text-xs text-gray-500">${fmt(item.precio_unitario)} / ${esc(unidad)}</div>
      </div>
      <div class="flex items-center border border-gray-200 rounded overflow-hidden shrink-0">
        <button data-action="dec" data-id="${item.id}"
          class="px-2 py-1 text-gray-600 hover:bg-gray-100 text-sm leading-none select-none">−</button>
        <input type="number" data-action="set-qty" data-id="${item.id}"
          value="${fmtNum(item.cantidad)}" step="${paso}" min="${paso}"
          style="width:4rem;padding:4px 2px;text-align:center;background:transparent;border:none;outline:none;font-size:13px;color:inherit;font-family:inherit;" />
        <button data-action="inc" data-id="${item.id}"
          class="px-2 py-1 text-gray-600 hover:bg-gray-100 text-sm leading-none select-none">+</button>
      </div>
      <div class="w-20 text-right text-sm font-semibold shrink-0">
        ${fmt(item.precio_unitario * item.cantidad)}
      </div>
      <button data-action="del" data-id="${item.id}"
        class="text-gray-300 hover:text-red-500 transition-colors text-xl leading-none shrink-0 ml-1 select-none">
        ×
      </button>
    </div>`;
  }).join('');
}

elCarrito.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id     = parseInt(btn.dataset.id, 10);
  const action = btn.dataset.action;
  const idx    = carrito.findIndex(i => i.id === id);
  if (idx === -1) return;

  if (action === 'inc') {
    carrito[idx].cantidad++;
  } else if (action === 'dec') {
    const next = carrito[idx].cantidad - 1;
    if (next <= 0) carrito.splice(idx, 1);
    else carrito[idx].cantidad = next;
  } else if (action === 'del') {
    carrito.splice(idx, 1);
  }

  renderCarrito();
  actualizarTotales();
});

// Edición directa de cantidad en el input del carrito
elCarrito.addEventListener('change', e => {
  const input = e.target.closest('input[data-action="set-qty"]');
  if (!input) return;
  const id  = parseInt(input.dataset.id, 10);
  const idx = carrito.findIndex(i => i.id === id);
  if (idx === -1) return;

  const val      = parseFloat(input.value);
  const continua = UNIDADES_CONTINUAS.has(carrito[idx].unidad_medida);
  if (isNaN(val) || val <= 0) {
    carrito.splice(idx, 1);
  } else {
    carrito[idx].cantidad = continua
      ? Math.round(val * 1000) / 1000
      : Math.max(1, Math.round(val));
  }
  renderCarrito();
  actualizarTotales();
});

// ── Totales ────────────────────────────────────────────────────
function calcularTotales() {
  const subtotal  = carrito.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
  const impuesto  = subtotal * (tasaIva / 100);
  const total     = subtotal + impuesto;
  return { subtotal, impuesto, total };
}

function actualizarTotales() {
  const { subtotal, impuesto, total } = calcularTotales();
  elSubtotal.textContent = fmt(subtotal);
  elImpuesto.textContent = fmt(impuesto);
  elTotal.textContent    = fmt(total);
  elFilaSubtotal.style.display = mostrarIvaDesglosado ? '' : 'none';
  elFilaIva.style.display      = mostrarIvaDesglosado ? '' : 'none';
  if (elFormaPago.value === 'efectivo') actualizarVuelto();
  return { subtotal, impuesto, total };
}

function actualizarVuelto() {
  const { total } = calcularTotales();
  const recibido  = parseFloat(elMontoRecibido.value) || 0;
  if (recibido === 0) {
    elVuelto.textContent = '—';
    elVuelto.className   = 'text-lg font-bold text-gray-400';
    return;
  }
  const vuelto = recibido - total;
  if (vuelto < 0) {
    elVuelto.textContent = `Falta ${fmt(Math.abs(vuelto))}`;
    elVuelto.className   = 'text-base font-bold text-red-600';
  } else {
    elVuelto.textContent = fmt(vuelto);
    elVuelto.className   = 'text-lg font-bold text-green-600';
  }
}

elMontoRecibido.addEventListener('input', actualizarVuelto);

// ── Forma de pago ──────────────────────────────────────────────
elFormaPago.addEventListener('change', () => {
  const fp = elFormaPago.value;
  elSeccionEfectivo.classList.toggle('hidden', fp !== 'efectivo');
  elSeccionCliente.style.display = fp === 'cuenta_corriente' ? 'flex' : 'none';

  if (fp !== 'cuenta_corriente') {
    clienteSeleccionado     = null;
    elClienteBadge.style.display = 'none';
    elBuscarCliente.value        = '';
    elResultadosCliente.classList.add('hidden');
  }

  ocultarError();
  actualizarVuelto();
});

// ── Búsqueda de clientes ───────────────────────────────────────
elBuscarCliente.addEventListener('input', e => {
  clearTimeout(timerCliente);
  const q = e.target.value.trim();
  if (!q) {
    elResultadosCliente.classList.add('hidden');
    ultimosClientes = [];
    return;
  }
  timerCliente = setTimeout(() => buscarClientes(q), 250);
});

async function buscarClientes(q) {
  ultimosClientes = await window.api.clientes.search(q);
  if (ultimosClientes.length === 0) {
    elResultadosCliente.innerHTML = '<div class="px-3 py-2 text-sm text-gray-400">Sin resultados</div>';
  } else {
    elResultadosCliente.innerHTML = ultimosClientes.map(c => `
      <div class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm transition-colors"
           data-action="sel-cliente" data-id="${c.id}">
        <span class="font-medium">${esc(c.nombre)}</span>
        ${c.telefono ? `<span class="text-gray-400 ml-2 text-xs">${esc(c.telefono)}</span>` : ''}
      </div>`).join('');
  }
  elResultadosCliente.classList.remove('hidden');
}

elResultadosCliente.addEventListener('click', e => {
  const item = e.target.closest('[data-action="sel-cliente"]');
  if (!item) return;
  const id = parseInt(item.dataset.id, 10);
  const cl = ultimosClientes.find(c => c.id === id);
  if (cl) seleccionarCliente(cl);
});

function seleccionarCliente(cl) {
  clienteSeleccionado            = cl;
  elClienteNombre.textContent    = cl.nombre;
  elClienteBadge.style.display   = 'flex';
  elBuscarCliente.value          = '';
  elResultadosCliente.classList.add('hidden');
  ocultarError();
}

document.getElementById('btn-quitar-cliente').addEventListener('click', () => {
  clienteSeleccionado          = null;
  elClienteBadge.style.display = 'none';
  elBuscarCliente.value        = '';
  elBuscarCliente.focus();
});

// FIX 2: cierra el dropdown de clientes solo cuando el click externo es intencional
// (mousedown Y mouseup fuera del área), no durante un drag que empezó dentro
let _mousedownFueraCliente = false;

document.addEventListener('mousedown', e => {
  _mousedownFueraCliente =
    !elBuscarCliente.contains(e.target) &&
    !elResultadosCliente.contains(e.target);
});

document.addEventListener('mouseup', e => {
  if (
    _mousedownFueraCliente &&
    !elBuscarCliente.contains(e.target) &&
    !elResultadosCliente.contains(e.target)
  ) {
    elResultadosCliente.classList.add('hidden');
  }
  _mousedownFueraCliente = false;
});

// Evita que clic en dropdown de clientes haga blur en el input de cliente
elResultadosCliente.addEventListener('mousedown', e => { e.preventDefault(); });

// ── Cobrar ─────────────────────────────────────────────────────
document.getElementById('btn-cobrar').addEventListener('click', cobrar);

async function cobrar() {
  ocultarError();
  if (carrito.length === 0) return mostrarError('El carrito está vacío.');

  if (!turnoActivo) {
    return mostrarError('No hay turno activo. Abrí un turno desde el menú Turno antes de registrar ventas.');
  }

  const { subtotal, impuesto, total } = calcularTotales();
  const formaPago = elFormaPago.value;

  // Validar stock (check rápido con datos cacheados; productos comunes no tienen stock)
  for (const item of carrito) {
    if (!item.esLibre && Number(item.stock_actual) < item.cantidad) {
      return mostrarError(
        `Stock insuficiente para "${item.nombre}". ` +
        `Disponible: ${fmtNum(item.stock_actual)}, pedido: ${item.cantidad}.`
      );
    }
  }

  // Validaciones por forma de pago
  let montoRecibido = null;
  let vuelto        = null;

  if (formaPago === 'efectivo') {
    montoRecibido = parseFloat(elMontoRecibido.value) || 0;
    if (montoRecibido < total)
      return mostrarError(
        `El monto recibido (${fmt(montoRecibido)}) es menor al total (${fmt(total)}).`
      );
    vuelto = montoRecibido - total;
  }

  if (formaPago === 'cuenta_corriente' && !clienteSeleccionado)
    return mostrarError('Seleccioná un cliente para operar con crédito.');

  // Construir payload
  const transaccionData = {
    monto_total:       total,
    subtotal,
    monto_impuesto:    impuesto,
    forma_pago:        formaPago,
    cuenta_cliente_id: clienteSeleccionado?.id ?? null,
  };

  const detalleData = carrito.map(item => ({
    articulo_id:       item.esLibre ? null : item.id,
    descripcion_libre: item.esLibre ? item.nombre : null,
    cantidad:          item.cantidad,
    precio_al_momento: item.precio_unitario,
    importe_total:     item.precio_unitario * item.cantidad,
  }));

  const btnCobrar = document.getElementById('btn-cobrar');
  btnCobrar.disabled    = true;
  btnCobrar.textContent = 'Procesando...';

  try {
    const guardada = await window.api.transacciones.create({
      transaccion: transaccionData,
      detalle:     detalleData,
    });

    await window.api.caja.abrirComprobante({
      transaccionId: guardada.id,
      montoRecibido,
      vuelto,
    });

    limpiarCarrito();
  } catch (err) {
    mostrarError(err.message || 'Error al procesar la venta.');
  } finally {
    btnCobrar.disabled    = false;
    btnCobrar.textContent = 'Cobrar';
  }
}

// ── Cancelar ───────────────────────────────────────────────────
document.getElementById('btn-cancelar').addEventListener('click', () => {
  if (carrito.length === 0) return;
  if (confirm('¿Cancelar la venta actual? Se perderán los artículos del carrito.')) {
    limpiarCarrito();
  }
});

function limpiarCarrito() {
  carrito             = [];
  clienteSeleccionado = null;

  elBusqueda.value         = '';
  elMontoRecibido.value    = '';
  elBuscarCliente.value    = '';
  elFormaPago.value        = 'efectivo';
  elClienteBadge.style.display = 'none';
  elResultados.innerHTML   = '<p class="text-gray-400 py-6 text-center text-sm">Escribí para buscar artículos</p>';
  elResultadosCliente.classList.add('hidden');
  elSeccionEfectivo.classList.remove('hidden');
  elSeccionCliente.style.display = 'none';

  renderCarrito();
  actualizarTotales();
  ocultarError();
  elBusqueda.focus();
}

// ── Producto Común (venta libre sin stock) ─────────────────────
const elModalLibre    = document.getElementById('modal-libre');
const elFormLibre     = document.getElementById('form-libre');
const elLibreDesc     = document.getElementById('libre-desc');
const elLibrePrecio   = document.getElementById('libre-precio');
const elLibreCantidad = document.getElementById('libre-cantidad');
const elErrorLibre    = document.getElementById('error-libre');

document.getElementById('btn-producto-libre').addEventListener('click', () => {
  elFormLibre.reset();
  elLibreCantidad.value = '1';
  elErrorLibre.classList.add('hidden');
  elModalLibre.classList.remove('hidden');
  elLibreDesc.focus();
});

['btn-cerrar-libre', 'btn-cancelar-libre'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    elModalLibre.classList.add('hidden');
  });
});

elModalLibre.addEventListener('click', e => {
  if (e.target === elModalLibre) elModalLibre.classList.add('hidden');
});

elFormLibre.addEventListener('submit', e => {
  e.preventDefault();
  const desc     = elLibreDesc.value.trim();
  const precio   = parseFloat(elLibrePrecio.value);
  const cantidad = Math.abs(parseFloat(elLibreCantidad.value) || 1);

  if (!desc) {
    elErrorLibre.textContent = 'La descripción es obligatoria.';
    elErrorLibre.classList.remove('hidden');
    return;
  }
  if (isNaN(precio) || precio <= 0) {
    elErrorLibre.textContent = 'El precio debe ser mayor a 0.';
    elErrorLibre.classList.remove('hidden');
    return;
  }

  carrito.push({
    id:               nextIdLibre--,
    codigo:           '',
    nombre:           desc,
    precio_unitario:  precio,
    stock_actual:     Infinity,
    cantidad,
    unidad_medida:    'unidad',
    esLibre:          true,
  });

  renderCarrito();
  actualizarTotales();
  ocultarError();
  elModalLibre.classList.add('hidden');
  elBusqueda.focus();
});

// ── Helpers ────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
  }).format(n ?? 0);
}

function fmtNum(n) {
  const num = parseFloat(n) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(3).replace(/\.?0+$/, '');
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mostrarError(msg) {
  elErrorCobro.textContent = msg;
  elErrorCobro.classList.remove('hidden');
}

function ocultarError() {
  elErrorCobro.textContent = '';
  elErrorCobro.classList.add('hidden');
}
