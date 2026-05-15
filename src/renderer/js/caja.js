// Módulo Caja — punto de venta activo

// ── Estado ─────────────────────────────────────────────────────
let carrito           = [];   // [{ id, codigo, nombre, precio_unitario, stock_actual, cantidad }]
let tasaIva           = 21;
let clienteSeleccionado = null;
let ultimosBuscados   = [];
let ultimosClientes   = [];
let timerBusqueda     = null;
let timerCliente      = null;

// ── Refs DOM ───────────────────────────────────────────────────
const elBusqueda          = document.getElementById('busqueda');
const elResultados        = document.getElementById('resultados-busqueda');
const elCarrito           = document.getElementById('carrito');
const elSubtotal          = document.getElementById('subtotal');
const elImpuesto          = document.getElementById('impuesto');
const elTotal             = document.getElementById('total');
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
  const tasa = await window.api.config.get('impuesto_porcentaje');
  tasaIva = parseFloat(tasa) || 21;
  elLabelTasa.textContent = tasaIva;
  actualizarTotales();
  elBusqueda.focus();
});

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
  if (q) ejecutarBusqueda(q);
});

async function ejecutarBusqueda(q) {
  const resultados = await window.api.articulos.search(q);
  ultimosBuscados = resultados;
  renderResultados(resultados);
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
  elCarrito.innerHTML = carrito.map(item => `
    <div class="flex items-center gap-2 py-2.5">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate">${esc(item.nombre)}</div>
        <div class="text-xs text-gray-500">${fmt(item.precio_unitario)} c/u</div>
      </div>
      <div class="flex items-center border border-gray-200 rounded overflow-hidden shrink-0">
        <button data-action="dec" data-id="${item.id}"
          class="px-2 py-1 text-gray-600 hover:bg-gray-100 text-sm leading-none select-none">−</button>
        <span class="px-2 py-1 text-sm min-w-[2.5rem] text-center select-none">${item.cantidad}</span>
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
    </div>`).join('');
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
    carrito[idx].cantidad > 1 ? carrito[idx].cantidad-- : carrito.splice(idx, 1);
  } else if (action === 'del') {
    carrito.splice(idx, 1);
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

// ── Cobrar ─────────────────────────────────────────────────────
document.getElementById('btn-cobrar').addEventListener('click', cobrar);

async function cobrar() {
  ocultarError();
  if (carrito.length === 0) return mostrarError('El carrito está vacío.');

  const { subtotal, impuesto, total } = calcularTotales();
  const formaPago = elFormaPago.value;

  // Validar stock (check rápido con datos cacheados)
  for (const item of carrito) {
    if (Number(item.stock_actual) < item.cantidad) {
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
    articulo_id:       item.id,
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
