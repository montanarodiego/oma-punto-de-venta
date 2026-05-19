// Módulo Caja — punto de venta activo (v2 multi-ticket + descuentos + mayoreo + notas + movimientos + devoluciones)

// ── Constantes ─────────────────────────────────────────────────
const UNIDADES_CONTINUAS   = new Set(['kg', 'g', 'litro', 'ml', 'metro', 'cm']);
const MODOS_SIN_IVA        = new Set(['monotributista', 'restaurante']);
const MODOS_IVA_DESGLOSADO = new Set(['responsable_inscripto', 'mayorista', 'farmacia']);
const MAX_TICKETS          = 5;

// ── Definición de modos para el wizard ─────────────────────────
const WIZARD_MODOS = [
  {
    id: 'monotributista',
    nombre: 'Monotributista',
    desc: 'Precios finales, sin IVA desglosado',
    ejemplos: 'Kiosco, almacén, bazar, librería',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  },
  {
    id: 'responsable_inscripto',
    nombre: 'Responsable Inscripto',
    desc: 'IVA desglosado (21% por defecto, configurable por producto)',
    ejemplos: 'Distribuidora, mayorista, empresa',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  },
  {
    id: 'restaurante',
    nombre: 'Restaurante / Rotisería',
    desc: 'Sin IVA desglosado, con opción de propina',
    ejemplos: 'Rotisería, pizzería, comida para llevar',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/><path d="M21 15v7"/></svg>`,
  },
  {
    id: 'mayorista',
    nombre: 'Mayorista',
    desc: 'Precios base sin IVA; IVA sumado al total',
    ejemplos: 'Distribuidora, depósito, venta al por mayor',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  },
  {
    id: 'farmacia',
    nombre: 'Farmacia / Perfumería',
    desc: 'IVA desglosado, múltiples tasas por producto (21%, 10,5%, 0%)',
    ejemplos: 'Farmacia, perfumería, cosmética',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  },
  {
    id: 'personalizado',
    nombre: 'Personalizado',
    desc: 'Configurá manualmente el comportamiento de IVA desde Configuración',
    ejemplos: '',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  },
];

// ── Multi-ticket state ──────────────────────────────────────────
let tickets        = [];
let ticketActivoIdx = 0;
let nextIdLibre     = -1;

function crearTicketObj(nombre) {
  return {
    id:                 Date.now() + Math.random(),
    nombre:             nombre || `Ticket ${tickets.length + 1}`,
    carrito:            [],
    clienteSeleccionado: null,
    formaPago:          'efectivo',
    montoRecibido:      '',
    descGlobalTipo:     'ninguno',
    descGlobalValor:    0,
    notas:              '',
    itemSeleccionadoId: null,
  };
}

function ticketActivo() { return tickets[ticketActivoIdx]; }

// ── Config state ────────────────────────────────────────────────
let tasaIva              = 21;
let mostrarIvaDesglosado = true;
let modoNegocio          = '';
let mostrarPrecioConIva  = false;
let turnoActivo          = null;
let _tamanoHud           = null;

// ── Search state ────────────────────────────────────────────────
let ultimosBuscados = [];
let ultimosClientes = [];
let timerBusqueda   = null;
let timerCliente    = null;

// ── Anular modal state ──────────────────────────────────────────
let anularTransaccionSeleccionada = null;
let anularPasoActual              = 1;

// ── DOM refs ────────────────────────────────────────────────────
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
const elTabsBar           = document.getElementById('tabs-bar');
const elTicketNombreLabel = document.getElementById('ticket-nombre-label');
const elFilaDescGlobal    = document.getElementById('fila-desc-global');
const elLabelDescGlobal   = document.getElementById('label-desc-global');
const elMontoDescGlobal   = document.getElementById('monto-desc-global');
const elSeccionDescGlobal = document.getElementById('seccion-desc-global');
const elNotasInput        = document.getElementById('notas-input');
const elSeccionNotas      = document.getElementById('seccion-notas');

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const [tasa, ivaDesglosado, tamanoHud, modo, turno] = await Promise.all([
    window.api.config.get('impuesto_porcentaje'),
    window.api.config.get('mostrar_iva_desglosado'),
    window.api.config.get('tamano_hud'),
    window.api.config.get('modo_negocio'),
    window.api.turnos.obtenerActivo(),
  ]);

  tasaIva              = parseFloat(tasa) || 21;
  mostrarIvaDesglosado = ivaDesglosado !== '0';
  modoNegocio          = modo || '';
  turnoActivo          = turno;
  _tamanoHud           = tamanoHud || 'normal';

  if (!modoNegocio) {
    renderizarWizard();
    document.getElementById('modal-wizard').style.display = 'flex';
    return;
  }

  inicializarCaja();
});

function inicializarCaja() {
  tickets = [crearTicketObj('Venta')];
  ticketActivoIdx = 0;

  aplicarModoNegocio(modoNegocio);
  elLabelTasa.textContent = tasaIva;
  document.body.classList.add('hud-' + _tamanoHud);

  renderTabs();
  restaurarEstadoUI();
  bindearEventos();
  elBusqueda.focus();
}

// ── Wizard ──────────────────────────────────────────────────────
function renderizarWizard() {
  const container = document.getElementById('wizard-cards');
  container.innerHTML = WIZARD_MODOS.map(m => `
    <button class="wizard-card" data-modo="${m.id}" type="button">
      <div style="color:#3b82f6;">${m.icono}</div>
      <div>
        <div style="font-weight:700;font-size:14px;color:#f1f5f9;">${esc(m.nombre)}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.5;">${esc(m.desc)}</div>
        ${m.ejemplos ? `<div style="font-size:11px;color:#64748b;margin-top:6px;">${esc(m.ejemplos)}</div>` : ''}
      </div>
    </button>`
  ).join('');

  container.addEventListener('click', async e => {
    const card = e.target.closest('.wizard-card[data-modo]');
    if (!card) return;
    await guardarModo(card.dataset.modo);
  });
}

async function guardarModo(modo) {
  await window.api.config.set('modo_negocio', modo);
  modoNegocio = modo;
  document.getElementById('modal-wizard').style.display = 'none';
  inicializarCaja();
}

// ── Modo negocio ────────────────────────────────────────────────
function aplicarModoNegocio(modo) {
  const btnMayoristaIva = document.getElementById('btn-mayorista-iva');
  const seccionPropina  = document.getElementById('seccion-propina');

  if (MODOS_SIN_IVA.has(modo)) {
    mostrarIvaDesglosado = false;
  } else if (MODOS_IVA_DESGLOSADO.has(modo)) {
    mostrarIvaDesglosado = true;
  }

  seccionPropina.style.display = (modo === 'restaurante') ? 'flex' : 'none';

  if (modo === 'mayorista') {
    btnMayoristaIva.style.display = 'flex';
    btnMayoristaIva.addEventListener('click', () => {
      mostrarPrecioConIva = !mostrarPrecioConIva;
      btnMayoristaIva.classList.toggle('hud-on', mostrarPrecioConIva);
      document.getElementById('btn-mayorista-label').textContent =
        mostrarPrecioConIva ? 'Ver sin IVA' : 'Ver con IVA';
      renderCarrito();
    });
  } else {
    btnMayoristaIva.style.display = 'none';
  }
}

// ── Tabs ────────────────────────────────────────────────────────
function renderTabs() {
  const html = tickets.map((t, i) => `
    <button class="tab-btn ${i === ticketActivoIdx ? 'active' : ''}" data-tab="${i}">
      ${esc(t.nombre)}
      ${tickets.length > 1 ? `<span class="tab-close" data-close="${i}" title="Cerrar">×</span>` : ''}
    </button>
  `).join('');

  const btnNuevo = tickets.length < MAX_TICKETS
    ? `<button class="tab-new-btn" id="btn-nuevo-ticket" title="Nuevo ticket (Ctrl+T)">+</button>`
    : `<button class="tab-new-btn" disabled title="Máximo ${MAX_TICKETS} tickets">+</button>`;

  elTabsBar.innerHTML = html + btnNuevo;

  // Events tabs
  elTabsBar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      if (e.target.closest('.tab-close')) return;
      const i = parseInt(btn.dataset.tab, 10);
      if (i !== ticketActivoIdx) cambiarTabA(i);
    });
  });

  elTabsBar.querySelectorAll('.tab-close').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.close, 10);
      cerrarTab(i);
    });
  });

  const btnN = document.getElementById('btn-nuevo-ticket');
  if (btnN) btnN.addEventListener('click', abrirModalRenombrar.bind(null, null));

  // Nombre label
  elTicketNombreLabel.textContent = ticketActivo().nombre;
}

function cambiarTabA(i) {
  guardarEstadoUI();
  ticketActivoIdx = i;
  restaurarEstadoUI();
  renderTabs();
}

function cerrarTab(i) {
  if (tickets.length === 1) return;
  const t = tickets[i];
  if (t.carrito.length > 0) {
    if (!confirm(`¿Cerrar "${esc(t.nombre)}"? Se perderán los artículos del carrito.`)) return;
  }
  tickets.splice(i, 1);
  if (ticketActivoIdx >= tickets.length) ticketActivoIdx = tickets.length - 1;
  restaurarEstadoUI();
  renderTabs();
}

function guardarEstadoUI() {
  const t = ticketActivo();
  t.montoRecibido = elMontoRecibido.value;
  t.notas         = elNotasInput.value;
}

function restaurarEstadoUI() {
  const t = ticketActivo();

  // Forma de pago
  document.querySelectorAll('.pago-btn').forEach(b => b.classList.remove('active'));
  const btnPago = document.querySelector(`.pago-btn[data-value="${t.formaPago}"]`);
  if (btnPago) btnPago.classList.add('active');
  elFormaPago.value = t.formaPago;

  elSeccionEfectivo.style.display = t.formaPago === 'efectivo' ? 'flex' : 'none';
  elSeccionCliente.style.display  = t.formaPago === 'cuenta_corriente' ? 'flex' : 'none';

  // Cliente
  if (t.clienteSeleccionado) {
    elClienteNombre.textContent  = t.clienteSeleccionado.nombre;
    elClienteBadge.style.display = 'flex';
  } else {
    elClienteBadge.style.display = 'none';
    elBuscarCliente.value        = '';
  }
  elResultadosCliente.classList.add('hidden');

  // Monto recibido
  elMontoRecibido.value = t.montoRecibido;

  // Notas
  elNotasInput.value = t.notas;
  elSeccionNotas.style.display = t.notas ? '' : 'none';
  document.getElementById('btn-notas').classList.toggle('has-data', !!t.notas);

  // Descuento global
  sincronizarUIDescGlobal();

  renderCarrito();
  actualizarTotales();
  ocultarError();

  elTicketNombreLabel.textContent = t.nombre;
}

// ── Modal renombrar ticket ──────────────────────────────────────
function abrirModalRenombrar(idx) {
  const esNuevo = idx === null;
  const modal   = document.getElementById('modal-renombrar');
  const input   = document.getElementById('renombrar-input');
  input.value   = esNuevo ? `Venta ${tickets.length + 1}` : tickets[idx ?? ticketActivoIdx].nombre;
  modal.classList.remove('hidden');
  setTimeout(() => { input.focus(); input.select(); }, 50);

  const confirmar = () => {
    const nombre = input.value.trim() || (esNuevo ? `Venta ${tickets.length + 1}` : tickets[idx ?? ticketActivoIdx].nombre);
    if (esNuevo) {
      guardarEstadoUI();
      tickets.push(crearTicketObj(nombre));
      tickets[tickets.length - 1].nombre = nombre;
      ticketActivoIdx = tickets.length - 1;
      restaurarEstadoUI();
    } else {
      tickets[idx ?? ticketActivoIdx].nombre = nombre;
      elTicketNombreLabel.textContent = nombre;
    }
    renderTabs();
    modal.classList.add('hidden');
    input.value = '';
    elBusqueda.focus();
  };

  document.getElementById('btn-confirmar-renombrar').onclick = confirmar;
  document.getElementById('btn-cancelar-renombrar').onclick  = () => modal.classList.add('hidden');
  document.getElementById('btn-cerrar-renombrar').onclick    = () => modal.classList.add('hidden');
  input.onkeydown = e => {
    if (e.key === 'Enter') confirmar();
    if (e.key === 'Escape') modal.classList.add('hidden');
  };
}

elTicketNombreLabel.addEventListener('dblclick', () => abrirModalRenombrar(ticketActivoIdx));

// ── Búsqueda de artículos ───────────────────────────────────────
elBusqueda.addEventListener('input', e => {
  clearTimeout(timerBusqueda);
  const q = e.target.value.trim();
  if (!q) {
    elResultados.innerHTML = '<div class="empty-state">Escribí para buscar artículos</div>';
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
  if (resultados.length === 0) { renderResultados(resultados); return; }
  const exacto = resultados.find(a => a.codigo.toLowerCase() === q.toLowerCase());
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
    const tieneMayoreo = parseFloat(a.precio_mayoreo) > 0;
    return `
      <div class="flex items-center px-4 py-3 hover:bg-blue-50 cursor-pointer gap-3 transition-colors"
           data-action="agregar" data-id="${a.id}">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">${esc(a.nombre)}</div>
          <div class="text-xs text-gray-500 font-mono">${esc(a.codigo)}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-sm font-semibold">${fmt(a.precio_unitario)}</div>
          ${tieneMayoreo ? `<div class="text-xs" style="color:#a78bfa;">M: ${fmt(a.precio_mayoreo)}</div>` : ''}
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
elResultados.addEventListener('mousedown', e => { e.preventDefault(); });

// ── Carrito ─────────────────────────────────────────────────────
function agregarAlCarrito(articulo) {
  const carrito  = ticketActivo().carrito;
  const existente = carrito.find(i => i.id === articulo.id);
  if (existente) {
    existente.cantidad++;
  } else {
    carrito.push({
      ...articulo,
      cantidad:            1,
      descuento_porcentaje: 0,
      usarMayoreo:          false,
    });
  }
  renderCarrito();
  actualizarTotales();
  ocultarError();
}

function getPrecioBase(item) {
  if (item.usarMayoreo && parseFloat(item.precio_mayoreo) > 0) {
    return parseFloat(item.precio_mayoreo);
  }
  return parseFloat(item.precio_unitario);
}

function getPrecioEfectivo(item) {
  const base = getPrecioBase(item);
  const desc = item.descuento_porcentaje || 0;
  return base * (1 - desc / 100);
}

function renderCarrito() {
  const carrito = ticketActivo().carrito;
  if (carrito.length === 0) {
    elCarrito.innerHTML = '<div class="empty-state">El carrito está vacío</div>';
    return;
  }

  const factorDisplay = (modoNegocio === 'mayorista' && mostrarPrecioConIva)
    ? (1 + tasaIva / 100)
    : 1;

  elCarrito.innerHTML = carrito.map((item, idx) => {
    const unidad          = item.unidad_medida || 'unidad';
    const continua        = UNIDADES_CONTINUAS.has(unidad);
    const paso            = continua ? '0.001' : '1';
    const precioBase      = getPrecioBase(item);
    const precioEfectivo  = getPrecioEfectivo(item);
    const precioDisplay   = precioEfectivo * factorDisplay;
    const tieneMayoreo    = parseFloat(item.precio_mayoreo) > 0;
    const tieneDescuento  = (item.descuento_porcentaje || 0) > 0;
    const rowClass        = item.usarMayoreo ? 'carrito-item-mayoreo' : '';

    return `
    <div class="flex flex-col py-2 border-b border-gray-800 last:border-b-0 ${rowClass}" data-item-idx="${idx}">
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">${esc(item.nombre)}</div>
          <div class="text-xs" style="color:var(--text-subtle);">
            ${fmt(precioDisplay)} / ${esc(unidad)}
            ${tieneDescuento ? `<span class="item-desc-badge">${fmtNum(item.descuento_porcentaje)}% desc</span>` : ''}
            ${item.usarMayoreo ? `<span class="item-mayoreo-badge">mayoreo</span>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">
          ${tieneMayoreo ? `
            <button data-action="mayoreo" data-idx="${idx}"
              title="Alternar precio mayoreo (F11)"
              style="padding:3px 5px;border-radius:4px;font-size:10px;border:1px solid ${item.usarMayoreo ? 'rgba(139,92,246,.6)' : 'var(--border)'};background:${item.usarMayoreo ? 'rgba(139,92,246,.2)' : 'transparent'};color:${item.usarMayoreo ? '#a78bfa' : 'var(--text-subtle)'};cursor:pointer;font-family:inherit;white-space:nowrap;">
              M
            </button>` : ''}
          <button data-action="descuento" data-idx="${idx}"
            title="Descuento en este producto (Ctrl+D)"
            style="padding:3px 5px;border-radius:4px;font-size:10px;border:1px solid ${tieneDescuento ? 'rgba(234,179,8,.5)' : 'var(--border)'};background:${tieneDescuento ? 'rgba(234,179,8,.15)' : 'transparent'};color:${tieneDescuento ? '#ca8a04' : 'var(--text-subtle)'};cursor:pointer;font-family:inherit;">
            %
          </button>
        </div>
        <div style="display:flex;align-items:center;border:1px solid var(--border);border-radius:var(--r-in);overflow:hidden;flex-shrink:0;">
          <button data-action="dec" data-idx="${idx}"
            style="padding:4px 8px;background:transparent;color:var(--text-muted);font-size:14px;border:none;cursor:pointer;line-height:1;">−</button>
          <input type="number" data-action="set-qty" data-idx="${idx}"
            value="${fmtNum(item.cantidad)}" step="${paso}" min="${paso}"
            style="width:3.5rem;padding:4px 2px;text-align:center;background:transparent;border:none;outline:none;font-size:13px;color:inherit;font-family:inherit;" />
          <button data-action="inc" data-idx="${idx}"
            style="padding:4px 8px;background:transparent;color:var(--text-muted);font-size:14px;border:none;cursor:pointer;line-height:1;">+</button>
        </div>
        <div style="width:4.5rem;text-align:right;font-size:13px;font-weight:600;flex-shrink:0;">
          ${fmt(precioDisplay * item.cantidad)}
        </div>
        <button data-action="del" data-idx="${idx}"
          style="color:var(--text-subtle);font-size:18px;line-height:1;background:none;border:none;cursor:pointer;padding:0 2px;flex-shrink:0;transition:color .12s;"
          onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='var(--text-subtle)'">×</button>
      </div>
      ${tieneDescuento ? `
        <div style="font-size:11px;color:#ca8a04;padding-left:2px;margin-top:2px;">
          Precio original: ${fmt(precioBase * factorDisplay)} → ${fmt(precioEfectivo * factorDisplay)} (−${fmtNum(item.descuento_porcentaje)}%)
        </div>` : ''}
    </div>`;
  }).join('');
}

elCarrito.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const carrito = ticketActivo().carrito;
  const idx     = parseInt(btn.dataset.idx, 10);
  const action  = btn.dataset.action;

  if (action === 'inc') {
    carrito[idx].cantidad++;
    renderCarrito();
    actualizarTotales();
  } else if (action === 'dec') {
    const next = carrito[idx].cantidad - 1;
    if (next <= 0) carrito.splice(idx, 1);
    else carrito[idx].cantidad = next;
    renderCarrito();
    actualizarTotales();
  } else if (action === 'del') {
    carrito.splice(idx, 1);
    renderCarrito();
    actualizarTotales();
  } else if (action === 'descuento') {
    abrirModalDescuento(idx);
  } else if (action === 'mayoreo') {
    toggleMayoreo(idx);
  }
});

elCarrito.addEventListener('change', e => {
  const input = e.target.closest('input[data-action="set-qty"]');
  if (!input) return;
  const carrito = ticketActivo().carrito;
  const idx     = parseInt(input.dataset.idx, 10);
  const val     = parseFloat(input.value);
  const continua = UNIDADES_CONTINUAS.has(carrito[idx]?.unidad_medida);

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

// ── Mayoreo toggle ──────────────────────────────────────────────
function toggleMayoreo(idx) {
  const carrito = ticketActivo().carrito;
  if (!carrito[idx]) return;
  if (parseFloat(carrito[idx].precio_mayoreo) <= 0) return;
  carrito[idx].usarMayoreo = !carrito[idx].usarMayoreo;
  renderCarrito();
  actualizarTotales();
}

// F11: toggle mayoreo del primer item con mayoreo (o el seleccionado)
document.addEventListener('keydown', e => {
  if (e.key === 'F11') {
    e.preventDefault();
    const carrito = ticketActivo().carrito;
    const idx = carrito.findIndex(i => parseFloat(i.precio_mayoreo) > 0);
    if (idx >= 0) toggleMayoreo(idx);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    const carrito = ticketActivo().carrito;
    if (carrito.length > 0) abrirModalDescuento(carrito.length - 1);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault();
    if (tickets.length < MAX_TICKETS) abrirModalRenombrar(null);
  }
  if (e.key === 'Alt' && !e.ctrlKey) { /* ignore */ }
  if (e.altKey && e.key === 'n') {
    e.preventDefault();
    toggleNotas();
  }
});

// ── Modal de descuento por ítem ─────────────────────────────────
let descModalItemIdx = null;
let descModalTipo    = 'pct';

function abrirModalDescuento(idx) {
  const carrito = ticketActivo().carrito;
  const item    = carrito[idx];
  if (!item) return;

  descModalItemIdx = idx;
  descModalTipo    = 'pct';

  document.getElementById('desc-item-nombre').textContent = item.nombre;
  document.getElementById('desc-modal-valor').value = item.descuento_porcentaje > 0 ? item.descuento_porcentaje : '';
  document.getElementById('desc-modal-label').textContent = 'Porcentaje de descuento';
  document.getElementById('desc-modal-tipo-pct').classList.add('active');
  document.getElementById('desc-modal-tipo-monto').classList.remove('active');
  document.getElementById('error-descuento').classList.add('hidden');
  actualizarPreviewDescuento();

  document.getElementById('modal-descuento').classList.remove('hidden');
  setTimeout(() => document.getElementById('desc-modal-valor').focus(), 50);
}

function actualizarPreviewDescuento() {
  const preview = document.getElementById('desc-modal-preview');
  const carrito = ticketActivo().carrito;
  const item    = carrito[descModalItemIdx];
  if (!item) return;

  const val     = parseFloat(document.getElementById('desc-modal-valor').value) || 0;
  const precioBase = getPrecioBase(item);
  let precioFinal;

  if (descModalTipo === 'pct') {
    if (val <= 0) { preview.style.display = 'none'; return; }
    precioFinal = precioBase * (1 - val / 100);
    preview.textContent = `${fmt(precioBase)} → ${fmt(precioFinal)} (−${fmt(precioBase - precioFinal)})`;
  } else {
    if (val <= 0) { preview.style.display = 'none'; return; }
    precioFinal = precioBase - val;
    if (precioFinal < 0) precioFinal = 0;
    const pct = ((precioBase - precioFinal) / precioBase * 100).toFixed(1);
    preview.textContent = `${fmt(precioBase)} → ${fmt(precioFinal)} (−${pct}%)`;
  }
  preview.style.display = '';
}

document.getElementById('desc-modal-valor').addEventListener('input', actualizarPreviewDescuento);

document.getElementById('desc-modal-tipo-pct').addEventListener('click', () => {
  descModalTipo = 'pct';
  document.getElementById('desc-modal-tipo-pct').classList.add('active');
  document.getElementById('desc-modal-tipo-monto').classList.remove('active');
  document.getElementById('desc-modal-label').textContent = 'Porcentaje de descuento';
  document.getElementById('desc-modal-valor').value = '';
  actualizarPreviewDescuento();
});

document.getElementById('desc-modal-tipo-monto').addEventListener('click', () => {
  descModalTipo = 'monto';
  document.getElementById('desc-modal-tipo-pct').classList.remove('active');
  document.getElementById('desc-modal-tipo-monto').classList.add('active');
  document.getElementById('desc-modal-label').textContent = 'Monto fijo de descuento ($)';
  document.getElementById('desc-modal-valor').value = '';
  actualizarPreviewDescuento();
});

document.getElementById('btn-aplicar-descuento').addEventListener('click', () => {
  const carrito  = ticketActivo().carrito;
  const item     = carrito[descModalItemIdx];
  if (!item) return;
  const val      = parseFloat(document.getElementById('desc-modal-valor').value) || 0;
  const errEl    = document.getElementById('error-descuento');
  errEl.classList.add('hidden');

  if (val < 0) {
    errEl.textContent = 'El descuento no puede ser negativo.';
    errEl.classList.remove('hidden');
    return;
  }

  if (descModalTipo === 'pct') {
    if (val > 100) {
      errEl.textContent = 'El porcentaje no puede superar 100%.';
      errEl.classList.remove('hidden');
      return;
    }
    item.descuento_porcentaje = val;
  } else {
    const precioBase = getPrecioBase(item);
    if (val >= precioBase) {
      errEl.textContent = 'El monto del descuento no puede ser igual o mayor al precio.';
      errEl.classList.remove('hidden');
      return;
    }
    item.descuento_porcentaje = (val / precioBase) * 100;
  }

  document.getElementById('modal-descuento').classList.add('hidden');
  renderCarrito();
  actualizarTotales();
});

document.getElementById('btn-quitar-descuento-item').addEventListener('click', () => {
  const carrito = ticketActivo().carrito;
  if (carrito[descModalItemIdx]) carrito[descModalItemIdx].descuento_porcentaje = 0;
  document.getElementById('modal-descuento').classList.add('hidden');
  renderCarrito();
  actualizarTotales();
});

['btn-cerrar-descuento', 'btn-cancelar-descuento'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    document.getElementById('modal-descuento').classList.add('hidden');
  });
});

document.getElementById('modal-descuento').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-descuento'))
    document.getElementById('modal-descuento').classList.add('hidden');
});

// ── Descuento global ────────────────────────────────────────────
document.getElementById('btn-toggle-desc').addEventListener('click', () => {
  const visible = elSeccionDescGlobal.style.display !== 'none';
  elSeccionDescGlobal.style.display = visible ? 'none' : '';
  if (!visible) {
    const t = ticketActivo();
    document.getElementById('desc-global-input').value = t.descGlobalValor > 0 ? t.descGlobalValor : '';
    sincronizarUIDescGlobal();
    document.getElementById('desc-global-input').focus();
  }
});

document.getElementById('desc-tipo-pct').addEventListener('click', () => {
  ticketActivo().descGlobalTipo = 'pct';
  sincronizarUIDescGlobal();
});

document.getElementById('desc-tipo-monto').addEventListener('click', () => {
  ticketActivo().descGlobalTipo = 'monto';
  sincronizarUIDescGlobal();
});

function sincronizarUIDescGlobal() {
  const t = ticketActivo();
  document.getElementById('desc-tipo-pct').classList.toggle('active',   t.descGlobalTipo !== 'monto');
  document.getElementById('desc-tipo-monto').classList.toggle('active', t.descGlobalTipo === 'monto');
}

document.getElementById('btn-aplicar-desc').addEventListener('click', () => {
  const t   = ticketActivo();
  const val = parseFloat(document.getElementById('desc-global-input').value) || 0;
  t.descGlobalValor = val;
  if (val > 0 && t.descGlobalTipo === 'ninguno') t.descGlobalTipo = 'pct';
  if (val <= 0) t.descGlobalTipo = 'ninguno';
  elSeccionDescGlobal.style.display = 'none';
  actualizarTotales();
});

document.getElementById('btn-quitar-desc').addEventListener('click', () => {
  const t = ticketActivo();
  t.descGlobalValor = 0;
  t.descGlobalTipo  = 'ninguno';
  document.getElementById('desc-global-input').value = '';
  elSeccionDescGlobal.style.display = 'none';
  actualizarTotales();
});

// ── Notas ────────────────────────────────────────────────────────
function toggleNotas() {
  const visible = elSeccionNotas.style.display !== 'none';
  elSeccionNotas.style.display = visible ? 'none' : '';
  if (!visible) setTimeout(() => elNotasInput.focus(), 50);
}

document.getElementById('btn-notas').addEventListener('click', toggleNotas);

elNotasInput.addEventListener('input', () => {
  ticketActivo().notas = elNotasInput.value;
  document.getElementById('btn-notas').classList.toggle('has-data', !!elNotasInput.value.trim());
});

// ── Totales ─────────────────────────────────────────────────────
function calcularTotales() {
  const t       = ticketActivo();
  const carrito = t.carrito;

  const subtotalItems = carrito.reduce((s, item) => {
    return s + getPrecioEfectivo(item) * item.cantidad;
  }, 0);

  let descuentoGlobal = 0;
  if (t.descGlobalTipo === 'pct' && t.descGlobalValor > 0) {
    descuentoGlobal = subtotalItems * (t.descGlobalValor / 100);
  } else if (t.descGlobalTipo === 'monto' && t.descGlobalValor > 0) {
    descuentoGlobal = Math.min(t.descGlobalValor, subtotalItems);
  }

  const subtotalConDesc = subtotalItems - descuentoGlobal;

  let impuesto = 0;
  if (!MODOS_SIN_IVA.has(modoNegocio)) {
    if (MODOS_IVA_DESGLOSADO.has(modoNegocio) || mostrarIvaDesglosado) {
      impuesto = subtotalConDesc * (tasaIva / 100);
    }
  }

  const elPropina = document.getElementById('propina-monto');
  const propina   = (modoNegocio === 'restaurante' && elPropina)
    ? (parseFloat(elPropina.value) || 0)
    : 0;

  const total = subtotalConDesc + impuesto + propina;

  return { subtotalItems, descuentoGlobal, subtotalConDesc, impuesto, propina, total };
}

function actualizarTotales() {
  const { subtotalItems, descuentoGlobal, impuesto, total } = calcularTotales();
  const t = ticketActivo();

  elSubtotal.textContent = fmt(subtotalItems);
  elImpuesto.textContent = fmt(impuesto);
  elTotal.textContent    = fmt(total);

  elFilaSubtotal.style.display = mostrarIvaDesglosado ? '' : 'none';
  elFilaIva.style.display      = mostrarIvaDesglosado ? '' : 'none';

  if (descuentoGlobal > 0) {
    elFilaDescGlobal.style.display = '';
    elLabelDescGlobal.textContent  = t.descGlobalTipo === 'pct'
      ? `Descuento (${fmtNum(t.descGlobalValor)}%)`
      : 'Descuento global';
    elMontoDescGlobal.textContent  = `−${fmt(descuentoGlobal)}`;
  } else {
    elFilaDescGlobal.style.display = 'none';
  }

  if (elFormaPago.value === 'efectivo') actualizarVuelto();
}

function actualizarVuelto() {
  const { total } = calcularTotales();
  const recibido  = parseFloat(elMontoRecibido.value) || 0;
  if (recibido === 0) {
    elVuelto.textContent = '—';
    elVuelto.style.color = 'var(--text-subtle)';
    return;
  }
  const vuelto = recibido - total;
  if (vuelto < 0) {
    elVuelto.textContent = `Falta ${fmt(Math.abs(vuelto))}`;
    elVuelto.style.color = '#ef4444';
  } else {
    elVuelto.textContent = fmt(vuelto);
    elVuelto.style.color = '#22c55e';
  }
}

elMontoRecibido.addEventListener('input', () => {
  ticketActivo().montoRecibido = elMontoRecibido.value;
  actualizarVuelto();
});

// ── Forma de pago ────────────────────────────────────────────────
elFormaPago.addEventListener('change', () => {
  const fp = elFormaPago.value;
  ticketActivo().formaPago = fp;
  elSeccionEfectivo.style.display = fp === 'efectivo' ? 'flex' : 'none';
  elSeccionCliente.style.display  = fp === 'cuenta_corriente' ? 'flex' : 'none';

  if (fp !== 'cuenta_corriente') {
    ticketActivo().clienteSeleccionado = null;
    elClienteBadge.style.display       = 'none';
    elBuscarCliente.value              = '';
    elResultadosCliente.classList.add('hidden');
  }
  ocultarError();
  actualizarVuelto();
});

// ── Búsqueda de clientes ─────────────────────────────────────────
elBuscarCliente.addEventListener('input', e => {
  clearTimeout(timerCliente);
  const q = e.target.value.trim();
  if (!q) { elResultadosCliente.classList.add('hidden'); ultimosClientes = []; return; }
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
  ticketActivo().clienteSeleccionado = cl;
  elClienteNombre.textContent        = cl.nombre;
  elClienteBadge.style.display       = 'flex';
  elBuscarCliente.value              = '';
  elResultadosCliente.classList.add('hidden');
  ocultarError();
}

document.getElementById('btn-quitar-cliente').addEventListener('click', () => {
  ticketActivo().clienteSeleccionado = null;
  elClienteBadge.style.display       = 'none';
  elBuscarCliente.value              = '';
  elBuscarCliente.focus();
});

let _mousedownFueraCliente = false;
document.addEventListener('mousedown', e => {
  _mousedownFueraCliente =
    !elBuscarCliente.contains(e.target) &&
    !elResultadosCliente.contains(e.target);
});
document.addEventListener('mouseup', e => {
  if (_mousedownFueraCliente &&
      !elBuscarCliente.contains(e.target) &&
      !elResultadosCliente.contains(e.target)) {
    elResultadosCliente.classList.add('hidden');
  }
  _mousedownFueraCliente = false;
});
elResultadosCliente.addEventListener('mousedown', e => { e.preventDefault(); });

// ── Cobrar ───────────────────────────────────────────────────────
document.getElementById('btn-cobrar').addEventListener('click', cobrar);

async function cobrar() {
  ocultarError();
  const t = ticketActivo();
  if (t.carrito.length === 0) return mostrarError('El carrito está vacío.');
  if (!turnoActivo) return mostrarError('No hay turno activo. Abrí un turno desde el menú Turno.');

  const totales   = calcularTotales();
  const { subtotalItems, descuentoGlobal, impuesto, total } = totales;
  const formaPago = elFormaPago.value;

  for (const item of t.carrito) {
    if (!item.esLibre && Number(item.stock_actual) < item.cantidad) {
      return mostrarError(
        `Stock insuficiente para "${item.nombre}". ` +
        `Disponible: ${fmtNum(item.stock_actual)}, pedido: ${item.cantidad}.`
      );
    }
  }

  let montoRecibido = null;
  let vuelto        = null;

  if (formaPago === 'efectivo') {
    montoRecibido = parseFloat(elMontoRecibido.value) || 0;
    if (montoRecibido < total)
      return mostrarError(`El monto recibido (${fmt(montoRecibido)}) es menor al total (${fmt(total)}).`);
    vuelto = montoRecibido - total;
  }

  if (formaPago === 'cuenta_corriente' && !t.clienteSeleccionado)
    return mostrarError('Seleccioná un cliente para operar con crédito.');

  const transaccionData = {
    monto_total:       total,
    subtotal:          subtotalItems,
    monto_impuesto:    impuesto,
    descuento_global:  descuentoGlobal,
    notas:             t.notas?.trim() || null,
    turno_id:          turnoActivo?.id ?? null,
    forma_pago:        formaPago,
    cuenta_cliente_id: t.clienteSeleccionado?.id ?? null,
  };

  const detalleData = t.carrito.map(item => {
    const precioBase = getPrecioBase(item);
    const descPct    = item.descuento_porcentaje || 0;
    const importe    = precioBase * item.cantidad * (1 - descPct / 100);
    return {
      articulo_id:          item.esLibre ? null : item.id,
      descripcion_libre:    item.esLibre ? item.nombre : null,
      cantidad:             item.cantidad,
      precio_al_momento:    precioBase,
      descuento_porcentaje: descPct,
      importe_total:        importe,
    };
  });

  const btnCobrar = document.getElementById('btn-cobrar');
  btnCobrar.disabled    = true;
  btnCobrar.textContent = 'Procesando...';

  try {
    const guardada = await window.api.transacciones.create({ transaccion: transaccionData, detalle: detalleData });
    await window.api.caja.abrirComprobante({
      transaccionId: guardada.id,
      montoRecibido,
      vuelto,
      propina: totales.propina,
    });
    limpiarCarritoActual();
  } catch (err) {
    mostrarError(err.message || 'Error al procesar la venta.');
  } finally {
    btnCobrar.disabled    = false;
    btnCobrar.textContent = 'COBRAR';
  }
}

// ── Cancelar ticket (limpiar carrito activo) ────────────────────
document.getElementById('btn-cancelar').addEventListener('click', () => {
  if (ticketActivo().carrito.length === 0) return;
  if (confirm('¿Cancelar el ticket actual? Se perderán los artículos.')) limpiarCarritoActual();
});

function limpiarCarritoActual() {
  const t         = ticketActivo();
  t.carrito            = [];
  t.clienteSeleccionado = null;
  t.formaPago          = 'efectivo';
  t.montoRecibido      = '';
  t.descGlobalTipo     = 'ninguno';
  t.descGlobalValor    = 0;
  t.notas              = '';

  elMontoRecibido.value = '';
  elBuscarCliente.value = '';
  elNotasInput.value    = '';
  elSeccionNotas.style.display       = 'none';
  elSeccionDescGlobal.style.display  = 'none';
  document.getElementById('btn-notas').classList.remove('has-data');

  document.querySelectorAll('.pago-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.pago-btn[data-value="efectivo"]').classList.add('active');
  elFormaPago.value = 'efectivo';
  elSeccionEfectivo.style.display = 'flex';
  elSeccionCliente.style.display  = 'none';
  elClienteBadge.style.display    = 'none';
  elResultados.innerHTML = '<div class="empty-state">Escribí para buscar artículos</div>';
  elResultadosCliente.classList.add('hidden');

  const elPropina = document.getElementById('propina-monto');
  if (elPropina) elPropina.value = '';

  renderCarrito();
  actualizarTotales();
  ocultarError();
  elBusqueda.focus();
}

// ── Producto Común ───────────────────────────────────────────────
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
  document.getElementById(id).addEventListener('click', () => elModalLibre.classList.add('hidden'));
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

  ticketActivo().carrito.push({
    id:                   nextIdLibre--,
    codigo:               '',
    nombre:               desc,
    precio_unitario:      precio,
    precio_mayoreo:       0,
    stock_actual:         Infinity,
    cantidad,
    unidad_medida:        'unidad',
    descuento_porcentaje: 0,
    usarMayoreo:          false,
    esLibre:              true,
  });

  renderCarrito();
  actualizarTotales();
  ocultarError();
  elModalLibre.classList.add('hidden');
  elBusqueda.focus();
});

// ── Modal: Movimiento de caja ────────────────────────────────────
document.getElementById('btn-movimiento').addEventListener('click', () => {
  if (!turnoActivo) {
    mostrarToast('No hay turno activo para registrar movimientos.', 'error');
    return;
  }
  document.getElementById('error-movimiento').classList.add('hidden');
  document.getElementById('form-movimiento').reset();
  document.getElementById('modal-movimiento').classList.remove('hidden');
  document.getElementById('mov-monto').focus();
});

['btn-cerrar-movimiento', 'btn-cancelar-movimiento'].forEach(id => {
  document.getElementById(id).addEventListener('click', () =>
    document.getElementById('modal-movimiento').classList.add('hidden')
  );
});
document.getElementById('modal-movimiento').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-movimiento'))
    document.getElementById('modal-movimiento').classList.add('hidden');
});

document.getElementById('form-movimiento').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl      = document.getElementById('error-movimiento');
  const tipo       = document.querySelector('input[name="mov-tipo"]:checked')?.value;
  const monto      = parseFloat(document.getElementById('mov-monto').value);
  const descripcion = document.getElementById('mov-descripcion').value.trim();

  errEl.classList.add('hidden');
  if (!tipo) { errEl.textContent = 'Seleccioná un tipo.'; errEl.classList.remove('hidden'); return; }
  if (isNaN(monto) || monto <= 0) { errEl.textContent = 'El monto debe ser mayor a 0.'; errEl.classList.remove('hidden'); return; }
  if (!descripcion) { errEl.textContent = 'La descripción es obligatoria.'; errEl.classList.remove('hidden'); return; }

  try {
    await window.api.movimientos.registrar({ turnoId: turnoActivo.id, tipo, monto, descripcion });
    document.getElementById('modal-movimiento').classList.add('hidden');
    mostrarToast(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${fmt(monto)} registrada.`);
  } catch (err) {
    errEl.textContent = err.message || 'Error al registrar.';
    errEl.classList.remove('hidden');
  }
});

// ── Modal: Anular / Devolver venta ───────────────────────────────
document.getElementById('btn-anular').addEventListener('click', abrirModalAnular);

async function abrirModalAnular() {
  anularTransaccionSeleccionada = null;
  anularPasoActual              = 1;

  const modal = document.getElementById('modal-anular');
  modal.classList.remove('hidden');
  irAPaso(1);
  document.getElementById('error-anular').classList.add('hidden');

  const rows = await window.api.devoluciones.recientes(40);
  renderListaTransacciones(rows);
}

function renderListaTransacciones(rows) {
  const lista  = document.getElementById('lista-transacciones');
  const sinMsg = document.getElementById('anular-sin-trans');

  if (!rows || rows.length === 0) {
    lista.innerHTML = '';
    sinMsg.classList.remove('hidden');
    return;
  }
  sinMsg.classList.add('hidden');

  const FORMAS = {
    efectivo:'Efectivo', tarjeta_debito:'Débito', tarjeta_credito:'Crédito',
    transferencia:'Transferencia', cuenta_corriente:'Cta. Cte.',
  };
  const ESTADOS = {
    vigente: { label: 'Vigente', cls: 'estado-vigente' },
    cancelada: { label: 'Cancelada', cls: 'estado-cancelada' },
    devolucion_parcial: { label: 'Dev. parcial', cls: 'estado-dev-parcial' },
  };

  lista.innerHTML = rows.map(t => {
    const est = ESTADOS[t.estado] || ESTADOS.vigente;
    return `
      <div class="trans-row" data-trans-id="${t.id}">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:500;">#${t.id} — ${fmt(t.monto_total)}</div>
          <div style="font-size:11px;color:var(--text-subtle);">
            ${formatHora(t.created_at)} · ${esc(FORMAS[t.forma_pago] || t.forma_pago)}
            ${t.nombre_cliente ? ` · ${esc(t.nombre_cliente)}` : ''}
          </div>
        </div>
        <span class="trans-estado-badge ${est.cls}">${est.label}</span>
      </div>`;
  }).join('');

  lista.querySelectorAll('.trans-row').forEach(row => {
    row.addEventListener('click', () => {
      lista.querySelectorAll('.trans-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      anularTransaccionSeleccionada = rows.find(t => t.id === parseInt(row.dataset.transId, 10));
      irAPaso(2);
    });
  });
}

function irAPaso(paso) {
  anularPasoActual = paso;
  document.getElementById('anular-paso-1').style.display   = paso === 1 ? '' : 'none';
  document.getElementById('anular-paso-2').style.display   = paso === 2 ? 'flex' : 'none';
  document.getElementById('anular-paso-3a').style.display  = paso === 3 ? 'flex' : 'none';
  document.getElementById('anular-paso-3b').style.display  = paso === 4 ? 'flex' : 'none';
  document.getElementById('btn-anular-volver').style.display   = paso > 1 ? '' : 'none';
  document.getElementById('btn-confirmar-anular').style.display = (paso === 3 || paso === 4) ? '' : 'none';
  document.getElementById('error-anular').classList.add('hidden');

  if (paso === 2 && anularTransaccionSeleccionada) {
    const t   = anularTransaccionSeleccionada;
    const est = t.estado === 'cancelada' ? '⛔ Cancelada' : t.estado === 'devolucion_parcial' ? '↩ Dev. parcial' : '✅ Vigente';
    document.getElementById('anular-trans-resumen').innerHTML =
      `<strong>Ticket #${t.id}</strong> — ${fmt(t.monto_total)} — ${est}`;

    const btnCancelar   = document.getElementById('btn-hacer-cancelacion');
    const btnDevolucion = document.getElementById('btn-hacer-devolucion');
    const cancelada     = t.estado === 'cancelada';
    btnCancelar.disabled   = cancelada;
    btnDevolucion.disabled = cancelada;
    if (cancelada) {
      btnCancelar.style.opacity   = '.4';
      btnDevolucion.style.opacity = '.4';
    } else {
      btnCancelar.style.opacity   = '';
      btnDevolucion.style.opacity = '';
    }
  }
}

document.getElementById('btn-hacer-cancelacion').addEventListener('click', () => irAPaso(3));

document.getElementById('btn-hacer-devolucion').addEventListener('click', async () => {
  irAPaso(4);
  const t    = anularTransaccionSeleccionada;
  const full = await window.api.transacciones.getById(t.id);
  const cont = document.getElementById('devolucion-items');

  cont.innerHTML = full.detalle.map((item, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 8px;background:var(--surface-2);border-radius:var(--r-in);">
      <input type="checkbox" data-item-idx="${i}" checked style="width:16px;height:16px;flex-shrink:0;" />
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;">${esc(item.nombre)}</div>
        <div style="font-size:11px;color:var(--text-subtle);">${fmtNum(item.cantidad)} × ${fmt(item.precio_al_momento)}</div>
      </div>
      <input type="number" data-qty-idx="${i}"
        value="${fmtNum(item.cantidad)}" min="0.001" step="0.001" max="${item.cantidad}"
        style="width:4rem;padding:4px 6px;border-radius:var(--r-in);border:1px solid var(--border);background:var(--surface-3);color:inherit;font-family:inherit;font-size:12px;text-align:right;" />
    </div>
  `).join('');

  // Guardar full detalle para usar al confirmar
  document.getElementById('anular-paso-3b').dataset.transId = t.id;
  document.getElementById('anular-paso-3b').dataset.detalle  = JSON.stringify(full.detalle);
});

document.getElementById('btn-anular-volver').addEventListener('click', () => {
  if (anularPasoActual === 2) irAPaso(1);
  else irAPaso(2);
});

document.getElementById('btn-confirmar-anular').addEventListener('click', async () => {
  const errEl = document.getElementById('error-anular');
  errEl.classList.add('hidden');
  const t = anularTransaccionSeleccionada;

  if (anularPasoActual === 3) {
    const motivo = document.getElementById('cancelacion-motivo').value.trim();
    if (!motivo) {
      errEl.textContent = 'El motivo es obligatorio.';
      errEl.classList.remove('hidden');
      return;
    }
    try {
      await window.api.devoluciones.cancelar({
        transaccionId: t.id,
        turnoId:       turnoActivo?.id ?? null,
        motivo,
      });
      document.getElementById('modal-anular').classList.add('hidden');
      mostrarToast(`Ticket #${t.id} cancelado correctamente.`);
    } catch (err) {
      errEl.textContent = err.message || 'Error al cancelar.';
      errEl.classList.remove('hidden');
    }
  } else if (anularPasoActual === 4) {
    const motivo  = document.getElementById('devolucion-motivo').value.trim();
    const paso3b  = document.getElementById('anular-paso-3b');
    const detalle = JSON.parse(paso3b.dataset.detalle || '[]');

    if (!motivo) {
      errEl.textContent = 'El motivo es obligatorio.';
      errEl.classList.remove('hidden');
      return;
    }

    const items = [];
    detalle.forEach((item, i) => {
      const chk = document.querySelector(`input[data-item-idx="${i}"]`);
      const qty = parseFloat(document.querySelector(`input[data-qty-idx="${i}"]`)?.value) || 0;
      if (chk?.checked && qty > 0) {
        items.push({
          detalle_id:      item.id,
          articulo_id:     item.articulo_id ?? null,
          descripcion:     item.nombre,
          cantidad:        qty,
          precio_unitario: item.precio_al_momento,
        });
      }
    });

    if (items.length === 0) {
      errEl.textContent = 'Seleccioná al menos un ítem para devolver.';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await window.api.devoluciones.parcial({
        transaccionId: t.id,
        turnoId:       turnoActivo?.id ?? null,
        motivo,
        items,
      });
      document.getElementById('modal-anular').classList.add('hidden');
      mostrarToast(`Devolución del ticket #${t.id} procesada.`);
    } catch (err) {
      errEl.textContent = err.message || 'Error al procesar devolución.';
      errEl.classList.remove('hidden');
    }
  }
});

['btn-cerrar-anular', 'btn-cerrar-anular-2'].forEach(id => {
  document.getElementById(id).addEventListener('click', () =>
    document.getElementById('modal-anular').classList.add('hidden')
  );
});
document.getElementById('modal-anular').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-anular'))
    document.getElementById('modal-anular').classList.add('hidden');
});

// ── Bindear eventos de modo (propina, etc.) ──────────────────────
function bindearEventos() {
  if (modoNegocio === 'restaurante') {
    const elPropina = document.getElementById('propina-monto');
    if (elPropina) elPropina.addEventListener('input', actualizarTotales);
  }
}

// ── Helpers ──────────────────────────────────────────────────────
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

function formatHora(str) {
  if (!str) return '';
  const d = new Date(str.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function mostrarError(msg) {
  elErrorCobro.textContent = msg;
  elErrorCobro.classList.remove('hidden');
}

function ocultarError() {
  elErrorCobro.textContent = '';
  elErrorCobro.classList.add('hidden');
}

function mostrarToast(msg, tipo = 'success') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
