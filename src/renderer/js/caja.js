// Módulo Caja — punto de venta activo (v3 nuevo layout + modal cobro F12)

// ── Constantes ─────────────────────────────────────────────────
const UNIDADES_CONTINUAS   = new Set(['kg', 'g', 'litro', 'ml', 'metro', 'cm']);
const MODOS_SIN_IVA        = new Set(['monotributista', 'restaurante']);
const MODOS_IVA_DESGLOSADO = new Set(['responsable_inscripto', 'mayorista', 'farmacia']);
const MAX_TICKETS          = 5;

const WIZARD_MODOS = [
  { id: 'monotributista',      nombre: 'Monotributista',          desc: 'Precios finales, sin IVA desglosado',                            ejemplos: 'Kiosco, almacén, bazar, librería',            icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>` },
  { id: 'responsable_inscripto',nombre: 'Responsable Inscripto',  desc: 'IVA desglosado (21% por defecto, configurable por producto)',    ejemplos: 'Distribuidora, mayorista, empresa',          icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>` },
  { id: 'restaurante',          nombre: 'Restaurante / Rotisería', desc: 'Sin IVA desglosado, con opción de propina',                     ejemplos: 'Rotisería, pizzería, comida para llevar',    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/><path d="M21 15v7"/></svg>` },
  { id: 'mayorista',            nombre: 'Mayorista',               desc: 'Precios base sin IVA; IVA sumado al total',                     ejemplos: 'Distribuidora, depósito, venta al por mayor',icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>` },
  { id: 'farmacia',             nombre: 'Farmacia / Perfumería',   desc: 'IVA desglosado, múltiples tasas por producto (21%, 10,5%, 0%)', ejemplos: 'Farmacia, perfumería, cosmética',           icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>` },
  { id: 'personalizado',        nombre: 'Personalizado',           desc: 'Configurá manualmente el comportamiento de IVA desde Configuración', ejemplos: '', icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` },
];

// ── Multi-ticket state ──────────────────────────────────────────
let tickets         = [];
let ticketActivoIdx = 0;
let nextIdLibre     = -1;

function crearTicketObj(nombre) {
  return {
    id:                  Date.now() + Math.random(),
    nombre:              nombre || `Ticket ${tickets.length + 1}`,
    carrito:             [],
    clienteSeleccionado: null,
    formaPago:           'efectivo',
    montoRecibido:       '',
    descGlobalTipo:      'ninguno',
    descGlobalValor:     0,
    notas:               '',
    itemSeleccionadoIdx: null,
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
let timerCodigo   = null;
let timerBuscador = null;
let buscadorItems = [];
let buscadorIdx   = -1;

// ── Clientes cobro ──────────────────────────────────────────────
let timerClienteCobro = null;
let clientesCobroLista = [];

// ── Promo cache ─────────────────────────────────────────────────
const promoCache = new Map();

// ── Anular modal state ──────────────────────────────────────────
let anularTransaccionSeleccionada = null;
let anularPasoActual              = 1;

// ── Descuento item modal ────────────────────────────────────────
let descModalItemIdx = null;
let descModalTipo    = 'pct';

// ── DOM refs ────────────────────────────────────────────────────
const elCampoCodigo       = document.getElementById('campo-codigo');
const elCarritoTbody      = document.getElementById('carrito-tbody');
const elTabsBar           = document.getElementById('tabs-bar');
const elTicketNombreLabel = document.getElementById('ticket-nombre-label');
const elNotasInput        = document.getElementById('notas-input');
const elSeccionNotas      = document.getElementById('seccion-notas');
const elDescGlobalInline  = document.getElementById('desc-global-inline');
const elPieTotalEl        = document.getElementById('pie-total');
const elPieTotalGrande    = document.getElementById('pie-total-grande');
const elPieSubtotal       = document.getElementById('pie-subtotal');
const elPieIva            = document.getElementById('pie-iva');
const elPieTasa           = document.getElementById('pie-tasa');
const elPieItemCount      = document.getElementById('pie-item-count');
const elPieDescWrap       = document.getElementById('pie-desc-wrap');
const elPieDescLabel      = document.getElementById('pie-desc-label');
const elPieDescVal        = document.getElementById('pie-desc-val');
const elPieIvaWrap        = document.getElementById('pie-iva-wrap');
const elPieIvaCol         = document.getElementById('pie-iva-col');
const elBtnCobrar         = document.getElementById('btn-cobrar');

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const [tasa, ivaDesglosado, tamanoHud, modo, turno] = await Promise.all([
    window.api.config.get('impuesto_porcentaje'),
    window.api.config.get('mostrar_iva_desglosado'),
    window.api.config.get('tamano_hud'),
    window.api.config.get('modo_negocio'),
    // Usa la promesa de auth-guard (que ya verificó/esperó el turno)
    window.TURNO_GUARD_PROMISE || window.api.turnos.obtenerActivo(),
  ]);

  tasaIva              = parseFloat(tasa) || 21;
  mostrarIvaDesglosado = ivaDesglosado !== '0';
  modoNegocio          = modo || '';
  turnoActivo          = turno;
  _tamanoHud           = tamanoHud || 'normal';
  localStorage.setItem('oma_hud', _tamanoHud);
  document.documentElement.classList.remove('hud-compacto', 'hud-normal', 'hud-grande', 'hud-gigante');
  document.documentElement.classList.add('hud-' + _tamanoHud);

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
  elPieTasa.textContent = tasaIva;

  renderTabs();
  restaurarEstadoUI();
  bindearEventos();
  recuperarFocoCodigo();
}

function recuperarFocoCodigo() {
  elCampoCodigo.focus();
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
  const btnMayoristaIva   = document.getElementById('btn-mayorista-iva');
  const seccionPropina    = document.getElementById('seccion-propina-pie');

  if (MODOS_SIN_IVA.has(modo)) {
    mostrarIvaDesglosado = false;
  } else if (MODOS_IVA_DESGLOSADO.has(modo)) {
    mostrarIvaDesglosado = true;
  }

  if (modo === 'restaurante') {
    seccionPropina.classList.add('visible');
  } else {
    seccionPropina.classList.remove('visible');
  }

  if (modo === 'mayorista') {
    btnMayoristaIva.style.display = '';
    btnMayoristaIva.addEventListener('click', () => {
      mostrarPrecioConIva = !mostrarPrecioConIva;
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
      cerrarTab(parseInt(btn.dataset.close, 10));
    });
  });

  const btnN = document.getElementById('btn-nuevo-ticket');
  if (btnN) btnN.addEventListener('click', () => abrirModalRenombrar(null));

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
  t.notas = elNotasInput.value;
}

function restaurarEstadoUI() {
  const t = ticketActivo();
  elNotasInput.value = t.notas;
  elSeccionNotas.style.display = t.notas ? '' : 'none';
  document.getElementById('btn-notas').classList.toggle('has-data', !!t.notas);
  sincronizarUIDescGlobal();
  renderCarrito();
  actualizarTotales();
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
      ticketActivoIdx = tickets.length - 1;
      restaurarEstadoUI();
    } else {
      tickets[idx ?? ticketActivoIdx].nombre = nombre;
      elTicketNombreLabel.textContent = nombre;
    }
    renderTabs();
    modal.classList.add('hidden');
    recuperarFocoCodigo();
  };

  document.getElementById('btn-confirmar-renombrar').onclick = confirmar;
  document.getElementById('btn-cancelar-renombrar').onclick  = () => { modal.classList.add('hidden'); recuperarFocoCodigo(); };
  document.getElementById('btn-cerrar-renombrar').onclick    = () => { modal.classList.add('hidden'); recuperarFocoCodigo(); };
  input.onkeydown = e => {
    if (e.key === 'Enter') confirmar();
    if (e.key === 'Escape') { modal.classList.add('hidden'); recuperarFocoCodigo(); }
  };
}

elTicketNombreLabel.addEventListener('dblclick', () => abrirModalRenombrar(ticketActivoIdx));

// ── Campo de código ─────────────────────────────────────────────
elCampoCodigo.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    clearTimeout(timerCodigo);
    const q = elCampoCodigo.value.trim();
    if (q) buscarYAgregar(q);
  }
});

elCampoCodigo.addEventListener('input', () => {
  clearTimeout(timerCodigo);
  const q = elCampoCodigo.value.trim();
  if (!q) return;
  timerCodigo = setTimeout(() => intentarAgregarPorCodigo(q), 600);
});

async function intentarAgregarPorCodigo(q) {
  const resultados = await window.api.articulos.search(q);
  if (resultados.length === 0) return;
  const exacto = resultados.find(a => a.codigo.toLowerCase() === q.toLowerCase());
  if (exacto) {
    await agregarAlCarrito(exacto);
    elCampoCodigo.value = '';
    recuperarFocoCodigo();
  }
}

async function buscarYAgregar(q) {
  const resultados = await window.api.articulos.search(q);
  if (resultados.length === 0) {
    mostrarToast(`No se encontró: "${q}"`, 'error');
    elCampoCodigo.select();
    return;
  }
  const exacto = resultados.find(a => a.codigo.toLowerCase() === q.toLowerCase());
  await agregarAlCarrito(exacto ?? resultados[0]);
  elCampoCodigo.value = '';
  recuperarFocoCodigo();
}

// ── Buscador F10 ────────────────────────────────────────────────
const elBuscadorOverlay   = document.getElementById('buscador-overlay');
const elBuscadorInput     = document.getElementById('buscador-input');
const elBuscadorResultados = document.getElementById('buscador-resultados');

function abrirBuscador() {
  buscadorItems = [];
  buscadorIdx   = -1;
  elBuscadorInput.value = '';
  elBuscadorResultados.innerHTML = '<div class="buscador-empty">Escribí para buscar artículos</div>';
  elBuscadorOverlay.classList.add('visible');
  setTimeout(() => elBuscadorInput.focus(), 30);
}

function cerrarBuscador() {
  elBuscadorOverlay.classList.remove('visible');
  recuperarFocoCodigo();
}

elBuscadorInput.addEventListener('input', () => {
  clearTimeout(timerBuscador);
  const q = elBuscadorInput.value.trim();
  if (!q) {
    buscadorItems = [];
    buscadorIdx   = -1;
    elBuscadorResultados.innerHTML = '<div class="buscador-empty">Escribí para buscar artículos</div>';
    return;
  }
  timerBuscador = setTimeout(() => ejecutarBuscador(q), 200);
});

async function ejecutarBuscador(q) {
  const resultados = await window.api.articulos.search(q);
  buscadorItems = resultados;
  buscadorIdx   = resultados.length > 0 ? 0 : -1;
  renderBuscadorResultados();
}

function renderBuscadorResultados() {
  if (buscadorItems.length === 0) {
    elBuscadorResultados.innerHTML = '<div class="buscador-empty">Sin resultados</div>';
    return;
  }
  elBuscadorResultados.innerHTML = buscadorItems.map((a, i) => {
    const sinStock = Number(a.stock_actual) <= 0;
    return `
      <div class="buscador-item ${i === buscadorIdx ? 'focused' : ''}" data-buscador-idx="${i}">
        <div class="buscador-item-info">
          <div style="font-size:13px;font-weight:500;">${esc(a.nombre)}</div>
          <div style="font-size:11px;color:var(--text-subtle);">
            ${esc(a.codigo)}
            ${parseFloat(a.precio_mayoreo) > 0 ? ` · M: ${fmt(a.precio_mayoreo)}` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:13px;font-weight:600;">${fmt(a.precio_unitario)}</div>
          <div style="font-size:11px;${sinStock ? 'color:#f87171;font-weight:600;' : 'color:var(--text-subtle);'}">
            Stock: ${fmtNum(a.stock_actual)}
          </div>
        </div>
      </div>`;
  }).join('');
}

function actualizarFocoBuscador() {
  elBuscadorResultados.querySelectorAll('.buscador-item').forEach((el, i) => {
    el.classList.toggle('focused', i === buscadorIdx);
    if (i === buscadorIdx) el.scrollIntoView({ block: 'nearest' });
  });
}

elBuscadorInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); cerrarBuscador(); return; }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (buscadorIdx < buscadorItems.length - 1) buscadorIdx++;
    actualizarFocoBuscador();
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (buscadorIdx > 0) buscadorIdx--;
    actualizarFocoBuscador();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (buscadorIdx >= 0 && buscadorItems[buscadorIdx]) {
      seleccionarDeBuscador(buscadorIdx);
    }
  }
});

elBuscadorResultados.addEventListener('click', e => {
  const item = e.target.closest('[data-buscador-idx]');
  if (item) seleccionarDeBuscador(parseInt(item.dataset.buscadorIdx, 10));
});

async function seleccionarDeBuscador(idx) {
  const art = buscadorItems[idx];
  if (!art) return;
  await agregarAlCarrito(art);
  cerrarBuscador();
}

document.getElementById('btn-abrir-buscador').addEventListener('click', abrirBuscador);

// ── Promo helpers ───────────────────────────────────────────────
function evaluarPromo(item) {
  if (item.esLibre || !item.promos || item.promos.length === 0) {
    item.promoAplicada = null;
    return;
  }
  const qty     = item.cantidad;
  const activas = item.promos.filter(p => p.activa);
  item.promoAplicada = activas.find(p =>
    qty >= p.cantidad_desde &&
    (p.cantidad_hasta == null || qty <= p.cantidad_hasta)
  ) ?? null;
}

// ── Carrito ─────────────────────────────────────────────────────
async function agregarAlCarrito(articulo) {
  const carrito   = ticketActivo().carrito;
  const existente = carrito.find(i => i.id === articulo.id);

  let promos = promoCache.get(articulo.id);
  if (promos === undefined) {
    promos = await window.api.promociones.listarPorArticulo(articulo.id);
    promoCache.set(articulo.id, promos);
  }

  if (existente) {
    existente.cantidad++;
    evaluarPromo(existente);
    ticketActivo().itemSeleccionadoIdx = carrito.indexOf(existente);
  } else {
    const item = { ...articulo, cantidad: 1, descuento_porcentaje: 0, usarMayoreo: false, promos, promoAplicada: null };
    evaluarPromo(item);
    carrito.push(item);
    ticketActivo().itemSeleccionadoIdx = carrito.length - 1;
  }
  renderCarrito();
  actualizarTotales();
}

function getPrecioBase(item) {
  if (item.usarMayoreo && parseFloat(item.precio_mayoreo) > 0) return parseFloat(item.precio_mayoreo);
  if (item.promoAplicada) return parseFloat(item.promoAplicada.precio_promocional);
  return parseFloat(item.precio_unitario);
}

function getPrecioEfectivo(item) {
  const base = getPrecioBase(item);
  const desc = item.descuento_porcentaje || 0;
  return base * (1 - desc / 100);
}

function renderCarrito() {
  const carrito = ticketActivo().carrito;
  const selIdx  = ticketActivo().itemSeleccionadoIdx;

  if (carrito.length === 0) {
    elCarritoTbody.innerHTML = `
      <tr id="carrito-empty-row">
        <td colspan="7">
          <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <div class="empty-state-title">El carrito está vacío</div>
            <div class="empty-state-sub">Escaneá un código de barras o buscá un producto con F10</div>
          </div>
        </td>
      </tr>`;
    elBtnCobrar.disabled = true;
    return;
  }

  const factorDisplay = (modoNegocio === 'mayorista' && mostrarPrecioConIva)
    ? (1 + tasaIva / 100)
    : 1;

  elCarritoTbody.innerHTML = carrito.map((item, idx) => {
    const unidad         = item.unidad_medida || 'unidad';
    const continua       = UNIDADES_CONTINUAS.has(unidad);
    const paso           = continua ? '0.001' : '1';
    const precioBase     = getPrecioBase(item);
    const precioEfectivo = getPrecioEfectivo(item);
    const precioDisplay  = precioEfectivo * factorDisplay;
    const importe        = precioDisplay * item.cantidad;
    const tieneDesc      = (item.descuento_porcentaje || 0) > 0;
    const tieneMayoreo   = parseFloat(item.precio_mayoreo) > 0;
    const tienePromo     = !!item.promoAplicada;
    const isSelected     = idx === selIdx;
    const stockDisplay   = item.esLibre ? '∞' : fmtNum(item.stock_actual);
    const stockBajo      = !item.esLibre && Number(item.stock_actual) <= 0;

    const badges = [
      tieneDesc ? `<span class="item-badge badge-desc">${fmtNum(item.descuento_porcentaje)}% dto</span>` : '',
      item.usarMayoreo ? `<span class="item-badge badge-mayoreo">M</span>` : '',
      tienePromo && !item.usarMayoreo ? `<span class="item-badge badge-promo">PROMO</span>` : '',
    ].join('');

    return `
      <tr class="${isSelected ? 'selected' : ''}" data-row-idx="${idx}">
        <td style="font-size:11px;color:var(--text-subtle);font-family:monospace;">${esc(item.codigo || '—')}</td>
        <td>
          <div style="font-weight:500;">${esc(item.nombre)}${badges}</div>
          ${tieneDesc ? `<div style="font-size:11px;color:#ca8a04;">${fmt(precioBase * factorDisplay)} → ${fmt(precioDisplay)}</div>` : ''}
          ${tienePromo && !item.usarMayoreo ? `<div style="font-size:11px;color:#4ade80;">${esc(item.promoAplicada.nombre || 'Promo')}</div>` : ''}
        </td>
        <td class="num" style="font-size:12px;">${fmt(precioDisplay)}</td>
        <td class="num">
          <div class="qty-ctrl" style="display:inline-flex;">
            <button class="qty-btn" data-action="dec" data-idx="${idx}">−</button>
            <input class="qty-input" type="number" data-action="set-qty" data-idx="${idx}"
              value="${fmtNum(item.cantidad)}" step="${paso}" min="${paso}" />
            <button class="qty-btn" data-action="inc" data-idx="${idx}">+</button>
          </div>
        </td>
        <td class="num" style="font-weight:600;">${fmt(importe)}</td>
        <td class="num" style="${stockBajo ? 'color:#f87171;font-weight:600;' : 'color:var(--text-subtle);'}font-size:12px;">${stockDisplay}</td>
        <td style="text-align:center;">
          <button data-action="del" data-idx="${idx}"
            style="color:var(--text-subtle);font-size:16px;line-height:1;background:none;border:none;cursor:pointer;padding:2px 4px;border-radius:4px;transition:color .12s;"
            onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='var(--text-subtle)'">×</button>
        </td>
      </tr>`;
  }).join('');

  elBtnCobrar.disabled = false;
}

// Delegación de eventos en la tabla
document.getElementById('carrito-tabla').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) {
    // Seleccionar fila
    const row = e.target.closest('tr[data-row-idx]');
    if (row) {
      ticketActivo().itemSeleccionadoIdx = parseInt(row.dataset.rowIdx, 10);
      renderCarrito();
    }
    return;
  }
  const carrito = ticketActivo().carrito;
  const idx     = parseInt(btn.dataset.idx, 10);
  const action  = btn.dataset.action;

  if (action === 'inc') {
    carrito[idx].cantidad++;
    evaluarPromo(carrito[idx]);
    renderCarrito(); actualizarTotales();
  } else if (action === 'dec') {
    const next = carrito[idx].cantidad - 1;
    if (next <= 0) { carrito.splice(idx, 1); if (ticketActivo().itemSeleccionadoIdx >= carrito.length) ticketActivo().itemSeleccionadoIdx = carrito.length - 1; }
    else { carrito[idx].cantidad = next; evaluarPromo(carrito[idx]); }
    renderCarrito(); actualizarTotales();
  } else if (action === 'del') {
    carrito.splice(idx, 1);
    if (ticketActivo().itemSeleccionadoIdx >= carrito.length) ticketActivo().itemSeleccionadoIdx = carrito.length - 1;
    renderCarrito(); actualizarTotales();
  } else if (action === 'descuento') {
    abrirModalDescuento(idx);
  }
});

document.getElementById('carrito-tabla').addEventListener('change', e => {
  const input = e.target.closest('input[data-action="set-qty"]');
  if (!input) return;
  const carrito = ticketActivo().carrito;
  const idx     = parseInt(input.dataset.idx, 10);
  const val     = parseFloat(input.value);
  const continua = UNIDADES_CONTINUAS.has(carrito[idx]?.unidad_medida);

  if (isNaN(val) || val <= 0) {
    carrito.splice(idx, 1);
    if (ticketActivo().itemSeleccionadoIdx >= carrito.length) ticketActivo().itemSeleccionadoIdx = carrito.length - 1;
  } else {
    carrito[idx].cantidad = continua
      ? Math.round(val * 1000) / 1000
      : Math.max(1, Math.round(val));
    evaluarPromo(carrito[idx]);
  }
  renderCarrito(); actualizarTotales();
});

// Doble click en fila → abrir descuento
document.getElementById('carrito-tabla').addEventListener('dblclick', e => {
  const row = e.target.closest('tr[data-row-idx]');
  if (row) abrirModalDescuento(parseInt(row.dataset.rowIdx, 10));
});

// ── Mayoreo ─────────────────────────────────────────────────────
function toggleMayoreo(idx) {
  const carrito = ticketActivo().carrito;
  if (!carrito[idx]) return;
  if (parseFloat(carrito[idx].precio_mayoreo) <= 0) return;
  carrito[idx].usarMayoreo = !carrito[idx].usarMayoreo;
  renderCarrito(); actualizarTotales();
}

document.getElementById('btn-mayoreo-toolbar').addEventListener('click', () => {
  const carrito = ticketActivo().carrito;
  const selIdx  = ticketActivo().itemSeleccionadoIdx;
  if (selIdx !== null && carrito[selIdx]) {
    toggleMayoreo(selIdx);
  } else {
    const idx = carrito.findIndex(i => parseFloat(i.precio_mayoreo) > 0);
    if (idx >= 0) toggleMayoreo(idx);
  }
});

// ── Totales ─────────────────────────────────────────────────────
function calcularTotales() {
  const t       = ticketActivo();
  const carrito = t.carrito;

  const subtotalItems = carrito.reduce((s, item) => s + getPrecioEfectivo(item) * item.cantidad, 0);

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
  const propina   = (modoNegocio === 'restaurante' && elPropina) ? (parseFloat(elPropina.value) || 0) : 0;
  const total     = subtotalConDesc + impuesto + propina;

  return { subtotalItems, descuentoGlobal, subtotalConDesc, impuesto, propina, total };
}

function actualizarTotales() {
  const { subtotalItems, descuentoGlobal, impuesto, total } = calcularTotales();
  const t = ticketActivo();

  elPieTotalEl.textContent    = fmt(total);
  elPieTotalGrande.textContent = fmt(total);

  const itemCount = ticketActivo().carrito.reduce((s, i) => s + i.cantidad, 0);
  elPieItemCount.textContent = fmtNum(itemCount);

  // IVA
  if (mostrarIvaDesglosado && !MODOS_SIN_IVA.has(modoNegocio)) {
    elPieSubtotal.textContent = fmt(subtotalItems);
    elPieIva.textContent      = fmt(impuesto);
    elPieIvaWrap.style.display = 'flex';
    elPieIvaCol.style.display  = 'flex';
  } else {
    elPieIvaWrap.style.display = 'none';
    elPieIvaCol.style.display  = 'none';
  }

  // Descuento
  if (descuentoGlobal > 0) {
    elPieDescLabel.textContent = t.descGlobalTipo === 'pct'
      ? `Desc. ${fmtNum(t.descGlobalValor)}%`
      : 'Desc. global';
    elPieDescVal.textContent   = `−${fmt(descuentoGlobal)}`;
    elPieDescWrap.style.display = 'flex';
  } else {
    elPieDescWrap.style.display = 'none';
  }
}

// ── Descuento global ────────────────────────────────────────────
document.getElementById('btn-toggle-desc').addEventListener('click', () => {
  const visible = elDescGlobalInline.style.display !== 'none';
  elDescGlobalInline.style.display = visible ? 'none' : '';
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
  elDescGlobalInline.style.display = 'none';
  actualizarTotales();
  recuperarFocoCodigo();
});

document.getElementById('btn-quitar-desc').addEventListener('click', () => {
  const t = ticketActivo();
  t.descGlobalValor = 0;
  t.descGlobalTipo  = 'ninguno';
  document.getElementById('desc-global-input').value = '';
  elDescGlobalInline.style.display = 'none';
  actualizarTotales();
  recuperarFocoCodigo();
});

// ── Notas ────────────────────────────────────────────────────────
function toggleNotas() {
  const visible = elSeccionNotas.style.display !== 'none';
  elSeccionNotas.style.display = visible ? 'none' : '';
  if (!visible) setTimeout(() => elNotasInput.focus(), 50);
  else recuperarFocoCodigo();
}

document.getElementById('btn-notas').addEventListener('click', toggleNotas);
elNotasInput.addEventListener('input', () => {
  ticketActivo().notas = elNotasInput.value;
  document.getElementById('btn-notas').classList.toggle('has-data', !!elNotasInput.value.trim());
});

// ── Modal de descuento por ítem ─────────────────────────────────
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

  const val        = parseFloat(document.getElementById('desc-modal-valor').value) || 0;
  const precioBase = getPrecioBase(item);
  let precioFinal;

  if (descModalTipo === 'pct') {
    if (val <= 0) { preview.style.display = 'none'; return; }
    precioFinal = precioBase * (1 - val / 100);
    preview.textContent = `${fmt(precioBase)} → ${fmt(precioFinal)} (−${fmt(precioBase - precioFinal)})`;
  } else {
    if (val <= 0) { preview.style.display = 'none'; return; }
    precioFinal = Math.max(0, precioBase - val);
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
  const val   = parseFloat(document.getElementById('desc-modal-valor').value) || 0;
  const errEl = document.getElementById('error-descuento');
  errEl.classList.add('hidden');

  if (val < 0) { errEl.textContent = 'El descuento no puede ser negativo.'; errEl.classList.remove('hidden'); return; }
  if (descModalTipo === 'pct') {
    if (val > 100) { errEl.textContent = 'El porcentaje no puede superar 100%.'; errEl.classList.remove('hidden'); return; }
    item.descuento_porcentaje = val;
  } else {
    const precioBase = getPrecioBase(item);
    if (val >= precioBase) { errEl.textContent = 'El monto no puede ser igual o mayor al precio.'; errEl.classList.remove('hidden'); return; }
    item.descuento_porcentaje = (val / precioBase) * 100;
  }
  document.getElementById('modal-descuento').classList.add('hidden');
  renderCarrito(); actualizarTotales();
  recuperarFocoCodigo();
});

document.getElementById('btn-quitar-descuento-item').addEventListener('click', () => {
  const carrito = ticketActivo().carrito;
  if (carrito[descModalItemIdx]) carrito[descModalItemIdx].descuento_porcentaje = 0;
  document.getElementById('modal-descuento').classList.add('hidden');
  renderCarrito(); actualizarTotales();
  recuperarFocoCodigo();
});

['btn-cerrar-descuento', 'btn-cancelar-descuento'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    document.getElementById('modal-descuento').classList.add('hidden');
    recuperarFocoCodigo();
  });
});

// ── Modal: Producto Libre ────────────────────────────────────────
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
  document.getElementById(id).addEventListener('click', () => { elModalLibre.classList.add('hidden'); recuperarFocoCodigo(); });
});

elFormLibre.addEventListener('submit', e => {
  e.preventDefault();
  const desc     = elLibreDesc.value.trim();
  const precio   = parseFloat(elLibrePrecio.value);
  const cantidad = Math.abs(parseFloat(elLibreCantidad.value) || 1);

  if (!desc) { elErrorLibre.textContent = 'La descripción es obligatoria.'; elErrorLibre.classList.remove('hidden'); return; }
  if (isNaN(precio) || precio <= 0) { elErrorLibre.textContent = 'El precio debe ser mayor a 0.'; elErrorLibre.classList.remove('hidden'); return; }

  ticketActivo().carrito.push({
    id: nextIdLibre--, codigo: '', nombre: desc,
    precio_unitario: precio, precio_mayoreo: 0,
    stock_actual: Infinity, cantidad, unidad_medida: 'unidad',
    descuento_porcentaje: 0, usarMayoreo: false, esLibre: true,
  });

  renderCarrito(); actualizarTotales();
  elModalLibre.classList.add('hidden');
  recuperarFocoCodigo();
});

// ── Modal: Movimiento de caja ────────────────────────────────────
document.getElementById('btn-movimiento').addEventListener('click', () => {
  if (!turnoActivo) { mostrarToast('No hay turno activo para registrar movimientos.', 'error'); return; }
  document.getElementById('error-movimiento').classList.add('hidden');
  document.getElementById('form-movimiento').reset();
  document.getElementById('modal-movimiento').classList.remove('hidden');
  document.getElementById('mov-monto').focus();
});

['btn-cerrar-movimiento', 'btn-cancelar-movimiento'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => { document.getElementById('modal-movimiento').classList.add('hidden'); recuperarFocoCodigo(); });
});

document.getElementById('form-movimiento').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl       = document.getElementById('error-movimiento');
  const tipo        = document.querySelector('input[name="mov-tipo"]:checked')?.value;
  const monto       = parseFloat(document.getElementById('mov-monto').value);
  const descripcion = document.getElementById('mov-descripcion').value.trim();

  errEl.classList.add('hidden');
  if (!tipo) { errEl.textContent = 'Seleccioná un tipo.'; errEl.classList.remove('hidden'); return; }
  if (isNaN(monto) || monto <= 0) { errEl.textContent = 'El monto debe ser mayor a 0.'; errEl.classList.remove('hidden'); return; }
  if (!descripcion) { errEl.textContent = 'La descripción es obligatoria.'; errEl.classList.remove('hidden'); return; }

  try {
    await window.api.movimientos.registrar({ turnoId: turnoActivo.id, tipo, monto, descripcion });
    document.getElementById('modal-movimiento').classList.add('hidden');
    mostrarToast(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${fmt(monto)} registrada.`);
    recuperarFocoCodigo();
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
  document.getElementById('modal-anular').classList.remove('hidden');
  irAPaso(1);
  document.getElementById('error-anular').classList.add('hidden');
  const rows = await window.api.devoluciones.recientes(40);
  renderListaTransacciones(rows);
}

function renderListaTransacciones(rows) {
  const lista  = document.getElementById('lista-transacciones');
  const sinMsg = document.getElementById('anular-sin-trans');

  if (!rows || rows.length === 0) {
    lista.innerHTML = ''; sinMsg.classList.remove('hidden'); return;
  }
  sinMsg.classList.add('hidden');

  const FORMAS = { efectivo:'Efectivo', tarjeta_debito:'Débito', tarjeta_credito:'Crédito', transferencia:'Transferencia', cuenta_corriente:'Cta. Cte.' };
  const formaLabel = t => t.forma_pago_2
    ? `Mixto (${FORMAS[t.forma_pago] || t.forma_pago} + ${FORMAS[t.forma_pago_2] || t.forma_pago_2})`
    : (FORMAS[t.forma_pago] || t.forma_pago);
  const ESTADOS = { vigente: { label:'Vigente', cls:'estado-vigente' }, cancelada: { label:'Cancelada', cls:'estado-cancelada' }, devolucion_parcial: { label:'Dev. parcial', cls:'estado-dev-parcial' } };

  lista.innerHTML = rows.map(t => {
    const est = ESTADOS[t.estado] || ESTADOS.vigente;
    return `
      <div class="trans-row" data-trans-id="${t.id}">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:500;">#${t.id} — ${fmt(t.monto_total)}</div>
          <div style="font-size:11px;color:var(--text-subtle);">
            ${formatHora(t.created_at)} · ${esc(formaLabel(t))}
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
  document.getElementById('btn-anular-volver').style.display    = paso > 1 ? '' : 'none';
  document.getElementById('btn-confirmar-anular').style.display = (paso === 3 || paso === 4) ? '' : 'none';
  document.getElementById('error-anular').classList.add('hidden');

  if (paso === 2 && anularTransaccionSeleccionada) {
    const t   = anularTransaccionSeleccionada;
    const est = t.estado === 'cancelada' ? '⛔ Cancelada' : t.estado === 'devolucion_parcial' ? '↩ Dev. parcial' : '✅ Vigente';
    document.getElementById('anular-trans-resumen').innerHTML = `<strong>Ticket #${t.id}</strong> — ${fmt(t.monto_total)} — ${est}`;
    const cancelada = t.estado === 'cancelada';
    document.getElementById('btn-hacer-cancelacion').disabled = cancelada;
    document.getElementById('btn-hacer-devolucion').disabled  = cancelada;
    document.getElementById('btn-hacer-cancelacion').style.opacity = cancelada ? '.4' : '';
    document.getElementById('btn-hacer-devolucion').style.opacity  = cancelada ? '.4' : '';
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
  document.getElementById('anular-paso-3b').dataset.transId = t.id;
  document.getElementById('anular-paso-3b').dataset.detalle  = JSON.stringify(full.detalle);
});

document.getElementById('btn-anular-volver').addEventListener('click', () => {
  if (anularPasoActual === 2) irAPaso(1); else irAPaso(2);
});

document.getElementById('btn-confirmar-anular').addEventListener('click', async () => {
  const errEl = document.getElementById('error-anular');
  errEl.classList.add('hidden');
  const t = anularTransaccionSeleccionada;

  if (anularPasoActual === 3) {
    const motivo = document.getElementById('cancelacion-motivo').value.trim();
    if (!motivo) { errEl.textContent = 'El motivo es obligatorio.'; errEl.classList.remove('hidden'); return; }
    try {
      await window.api.devoluciones.cancelar({ transaccionId: t.id, turnoId: turnoActivo?.id ?? null, motivo });
      document.getElementById('modal-anular').classList.add('hidden');
      mostrarToast(`Ticket #${t.id} cancelado correctamente.`);
      recuperarFocoCodigo();
    } catch (err) { errEl.textContent = err.message || 'Error al cancelar.'; errEl.classList.remove('hidden'); }
  } else if (anularPasoActual === 4) {
    const motivo  = document.getElementById('devolucion-motivo').value.trim();
    const paso3b  = document.getElementById('anular-paso-3b');
    const detalle = JSON.parse(paso3b.dataset.detalle || '[]');
    if (!motivo) { errEl.textContent = 'El motivo es obligatorio.'; errEl.classList.remove('hidden'); return; }

    const items = [];
    detalle.forEach((item, i) => {
      const chk = document.querySelector(`input[data-item-idx="${i}"]`);
      const qty = parseFloat(document.querySelector(`input[data-qty-idx="${i}"]`)?.value) || 0;
      if (chk?.checked && qty > 0) items.push({ detalle_id: item.id, articulo_id: item.articulo_id ?? null, descripcion: item.nombre, cantidad: qty, precio_unitario: item.precio_al_momento });
    });

    if (items.length === 0) { errEl.textContent = 'Seleccioná al menos un ítem para devolver.'; errEl.classList.remove('hidden'); return; }

    try {
      await window.api.devoluciones.parcial({ transaccionId: t.id, turnoId: turnoActivo?.id ?? null, motivo, items });
      document.getElementById('modal-anular').classList.add('hidden');
      mostrarToast(`Devolución del ticket #${t.id} procesada.`);
      recuperarFocoCodigo();
    } catch (err) { errEl.textContent = err.message || 'Error al procesar devolución.'; errEl.classList.remove('hidden'); }
  }
});

['btn-cerrar-anular', 'btn-cerrar-anular-2'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => { document.getElementById('modal-anular').classList.add('hidden'); recuperarFocoCodigo(); });
});

// ── Cancelar ticket ──────────────────────────────────────────────
document.getElementById('btn-cancelar').addEventListener('click', () => {
  if (ticketActivo().carrito.length === 0) return;
  if (confirm('¿Cancelar el ticket actual? Se perderán los artículos.')) limpiarCarritoActual();
});

function limpiarCarritoActual() {
  const t = ticketActivo();
  t.carrito             = [];
  t.clienteSeleccionado = null;
  t.formaPago           = 'efectivo';
  t.montoRecibido       = '';
  t.descGlobalTipo      = 'ninguno';
  t.descGlobalValor     = 0;
  t.notas               = '';
  t.itemSeleccionadoIdx = null;

  elNotasInput.value = '';
  elSeccionNotas.style.display = 'none';
  elDescGlobalInline.style.display = 'none';
  document.getElementById('btn-notas').classList.remove('has-data');

  const elPropina = document.getElementById('propina-monto');
  if (elPropina) elPropina.value = '';

  renderCarrito(); actualizarTotales();
  recuperarFocoCodigo();
}

// ── Modal de cobro (F12) ─────────────────────────────────────────
const elModalCobro         = document.getElementById('modal-cobro');
const elCobroTotal         = document.getElementById('cobro-total-display');
const elCobroMontoRec      = document.getElementById('cobro-monto-recibido');
const elCobroVuelto        = document.getElementById('cobro-vuelto-display');
const elCobroSecEfectivo   = document.getElementById('cobro-seccion-efectivo');
const elCobroSecCliente    = document.getElementById('cobro-seccion-cliente');
const elCobrobuscCliente   = document.getElementById('cobro-buscar-cliente');
const elCobroResCliente    = document.getElementById('cobro-resultados-cliente');
const elCobroClienteBadge  = document.getElementById('cobro-cliente-badge');
const elCobroClienteNombre = document.getElementById('cobro-cliente-nombre');
const elCobroError         = document.getElementById('cobro-error');

let cobroFormaPago           = 'efectivo';
let cobroClienteSeleccionado = null;
let cobroFocusIdx            = 0;
let numpadStr                = '';
const FORMAS_COBRO = ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cuenta_corriente', 'mixto'];

// ── Última transacción (reimprimir) ─────────────────────────────
let ultimaTransaccionId = null;

// ── Estado pago mixto ────────────────────────────────────────────
let mixtoClienteSelec   = null;
let timerMixtoCliente   = null;
let mixtoClientesLista  = [];
let _mixtoUpdating      = false;

function abrirModalCobro() {
  const carrito = ticketActivo()?.carrito;
  if (!carrito || carrito.length === 0) { mostrarToast('Agregá productos antes de cobrar', 'warning'); return; }
  if (!turnoActivo) { mostrarToast('No hay turno activo. Abrí un turno desde el menú Turno.', 'error'); return; }

  const { total } = calcularTotales();
  elCobroTotal.textContent = fmt(total);
  elCobroError.style.display = 'none';
  elCobroMontoRec.value = '';
  elCobroVuelto.textContent = '—';
  elCobroVuelto.style.color = 'var(--text-subtle)';
  numpadStr = '';

  // Reset forma de pago al efectivo
  cobroFormaPago = 'efectivo';
  cobroFocusIdx  = 0;
  cobroClienteSeleccionado = null;
  actualizarOpcionCobroActiva();

  // Reset cliente
  elCobrobuscCliente.value = '';
  elCobroResCliente.style.display = 'none';
  elCobroClienteBadge.style.display = 'none';

  // Reset mixto
  mixtoClienteSelec = null;
  _mixtoUpdating    = false;
  const { total: totalMixtoInit } = calcularTotales();
  const elM1 = document.getElementById('mixto-monto-1');
  const elM2 = document.getElementById('mixto-monto-2');
  if (elM1) elM1.value = '';
  if (elM2) elM2.value = totalMixtoInit.toFixed(2);
  document.getElementById('mixto-metodo-1').value = 'efectivo';
  document.getElementById('mixto-metodo-2').value = 'tarjeta_debito';
  document.getElementById('mixto-efectivo-extra').style.display = 'none';
  document.getElementById('mixto-seccion-cliente').style.display = 'none';
  document.getElementById('mixto-cliente-badge').style.display   = 'none';
  document.getElementById('mixto-buscar-cliente').value = '';
  document.getElementById('mixto-efectivo-recibido').value = '';
  document.getElementById('mixto-vuelto-display').textContent = '—';
  document.getElementById('mixto-vuelto-display').style.color = 'var(--text-subtle)';
  actualizarMixtoExtraSections();

  elModalCobro.classList.add('visible');
  window.api.setModalCobro(true);
  setTimeout(() => elCobroMontoRec.focus(), 50);
}

function cerrarModalCobro() {
  elModalCobro.classList.remove('visible');
  window.api.setModalCobro(false);
  recuperarFocoCodigo();
}

function actualizarOpcionCobroActiva() {
  document.querySelectorAll('.forma-pago-opt').forEach((btn, i) => {
    btn.classList.toggle('active', i === cobroFocusIdx);
  });
  cobroFormaPago = FORMAS_COBRO[cobroFocusIdx];

  const esMixto = cobroFormaPago === 'mixto';
  elCobroSecEfectivo.classList.toggle('visible', cobroFormaPago === 'efectivo');
  elCobroSecCliente.style.display = cobroFormaPago === 'cuenta_corriente' ? 'flex' : 'none';
  document.getElementById('cobro-seccion-mixto').style.display = esMixto ? 'flex' : 'none';

  if (cobroFormaPago === 'efectivo') {
    setTimeout(() => elCobroMontoRec.focus(), 30);
    actualizarVueltoCobro();
  } else if (cobroFormaPago === 'cuenta_corriente') {
    setTimeout(() => elCobrobuscCliente.focus(), 30);
  } else if (esMixto) {
    setTimeout(() => document.getElementById('mixto-monto-1').focus(), 30);
  }
}

// Clicks en las opciones de forma de pago
document.getElementById('forma-pago-list').addEventListener('click', e => {
  const opt = e.target.closest('.forma-pago-opt');
  if (!opt) return;
  const val = opt.dataset.value;
  cobroFocusIdx = FORMAS_COBRO.indexOf(val);
  if (cobroFocusIdx < 0) cobroFocusIdx = 0;
  actualizarOpcionCobroActiva();
});

// Monto recibido → actualizar vuelto en tiempo real
elCobroMontoRec.addEventListener('input', actualizarVueltoCobro);

function actualizarVueltoCobro() {
  const { total } = calcularTotales();
  const recibido  = parseFloat(elCobroMontoRec.value) || 0;
  if (recibido === 0) {
    elCobroVuelto.textContent = '—';
    elCobroVuelto.style.color = 'var(--text-subtle)';
    return;
  }
  const vuelto = recibido - total;
  if (vuelto < 0) {
    elCobroVuelto.textContent = `Falta ${fmt(Math.abs(vuelto))}`;
    elCobroVuelto.style.color = '#ef4444';
  } else {
    elCobroVuelto.textContent = fmt(vuelto);
    elCobroVuelto.style.color = '#22c55e';
  }
}

// Búsqueda de clientes en modal cobro
elCobrobuscCliente.addEventListener('input', () => {
  clearTimeout(timerClienteCobro);
  const q = elCobrobuscCliente.value.trim();
  if (!q) { elCobroResCliente.style.display = 'none'; clientesCobroLista = []; return; }
  timerClienteCobro = setTimeout(() => buscarClientesCobro(q), 250);
});

async function buscarClientesCobro(q) {
  clientesCobroLista = await window.api.clientes.search(q);
  if (clientesCobroLista.length === 0) {
    elCobroResCliente.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--text-subtle);">Sin resultados</div>';
  } else {
    elCobroResCliente.innerHTML = clientesCobroLista.map(c => `
      <div style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border-sub);"
           onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background=''"
           data-cli-id="${c.id}">
        <span style="font-weight:500;">${esc(c.nombre)}</span>
        ${c.telefono ? `<span style="color:var(--text-subtle);margin-left:8px;font-size:11px;">${esc(c.telefono)}</span>` : ''}
      </div>`).join('');
  }
  elCobroResCliente.style.display = '';
}

elCobroResCliente.addEventListener('click', e => {
  const item = e.target.closest('[data-cli-id]');
  if (!item) return;
  const cl = clientesCobroLista.find(c => c.id === parseInt(item.dataset.cliId, 10));
  if (cl) seleccionarClienteCobro(cl);
});

function seleccionarClienteCobro(cl) {
  cobroClienteSeleccionado = cl;
  elCobroClienteNombre.textContent = cl.nombre;
  elCobroClienteBadge.style.display = 'flex';
  elCobrobuscCliente.value = '';
  elCobroResCliente.style.display = 'none';
}

document.getElementById('cobro-btn-quitar-cliente').addEventListener('click', () => {
  cobroClienteSeleccionado = null;
  elCobroClienteBadge.style.display = 'none';
  elCobrobuscCliente.value = '';
  elCobrobuscCliente.focus();
});

// ── Modal de cobro — capture-phase, captura teclas siempre (incluso con input activo) ──
document.addEventListener('keydown', e => {
  if (!elModalCobro.classList.contains('visible')) return;

  const enInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarModalCobro(); return; }
  if (e.key === 'F1')     { e.preventDefault(); e.stopPropagation(); ejecutarCobro(true);  return; }
  if (e.key === 'F2')     { e.preventDefault(); e.stopPropagation(); ejecutarCobro(false); return; }

  // Enter confirma cobro (excepto en buscador de cliente, donde Enter cierra el dropdown)
  if (e.key === 'Enter' && document.activeElement !== elCobrobuscCliente) {
    e.preventDefault(); e.stopPropagation(); ejecutarCobro(true); return;
  }

  if (!enInput) {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      if (cobroFocusIdx < FORMAS_COBRO.length - 1) { cobroFocusIdx++; actualizarOpcionCobroActiva(); }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      if (cobroFocusIdx > 0) { cobroFocusIdx--; actualizarOpcionCobroActiva(); }
      return;
    }
    // Dígitos: si efectivo → van al monto; si otra forma → seleccionan pago 1-6
    if (/^\d$/.test(e.key) && !e.ctrlKey && !e.altKey) {
      const n = parseInt(e.key, 10);
      if (cobroFormaPago === 'efectivo') {
        e.preventDefault(); e.stopPropagation();
        numpadStr = (numpadStr + e.key).replace(/^0+(\d)/, '$1');
        if (numpadStr.length > 10) numpadStr = numpadStr.slice(0, 10);
        elCobroMontoRec.value = numpadStr;
        elCobroMontoRec.dispatchEvent(new Event('input'));
        elCobroMontoRec.focus();
      } else if (n >= 1 && n <= 6) {
        e.preventDefault(); e.stopPropagation();
        cobroFocusIdx = n - 1; actualizarOpcionCobroActiva();
      }
      return;
    }
    // Backspace borra el último dígito del monto cuando efectivo está activo
    if (e.key === 'Backspace' && cobroFormaPago === 'efectivo') {
      e.preventDefault(); e.stopPropagation();
      numpadStr = numpadStr.slice(0, -1);
      elCobroMontoRec.value = numpadStr;
      elCobroMontoRec.dispatchEvent(new Event('input'));
      return;
    }
  }
}, true);

document.getElementById('btn-cobrar').addEventListener('click', abrirModalCobro);
document.getElementById('btn-cobrar-toolbar').addEventListener('click', abrirModalCobro);
document.getElementById('btn-cobro-imprimir').addEventListener('click', () => ejecutarCobro(true));
document.getElementById('btn-cobro-sin-imprimir').addEventListener('click', () => ejecutarCobro(false));
document.getElementById('btn-cobro-cancelar').addEventListener('click', cerrarModalCobro);

// Numpad táctil
document.getElementById('cobro-numpad').addEventListener('click', e => {
  const btn = e.target.closest('.numpad-btn');
  if (!btn) return;
  const key = btn.dataset.num;
  if (key === 'del') {
    numpadStr = numpadStr.slice(0, -1);
  } else if (key === '00') {
    numpadStr = (numpadStr + '00').replace(/^0+(\d)/, '$1');
  } else {
    numpadStr = (numpadStr + key).replace(/^0+(\d)/, '$1');
  }
  if (numpadStr.length > 10) numpadStr = numpadStr.slice(0, 10);
  elCobroMontoRec.value = numpadStr || '';
  elCobroMontoRec.dispatchEvent(new Event('input'));
});

// Si el usuario escribe desde el teclado físico, sincronizar numpadStr
elCobroMontoRec.addEventListener('keydown', () => {
  // Resincronizar tras escritura manual en el próximo tick
  setTimeout(() => { numpadStr = elCobroMontoRec.value.replace(/[^0-9]/g, ''); }, 0);
});

async function ejecutarCobro(imprimir) {
  elCobroError.style.display = 'none';
  const t       = ticketActivo();
  const totales = calcularTotales();
  const { subtotalItems, descuentoGlobal, impuesto, total } = totales;

  for (const item of t.carrito) {
    if (!item.esLibre && Number(item.stock_actual) < item.cantidad) {
      elCobroError.textContent = `Stock insuficiente para "${item.nombre}". Disponible: ${fmtNum(item.stock_actual)}, pedido: ${item.cantidad}.`;
      elCobroError.style.display = '';
      return;
    }
  }

  let montoRecibido = null;
  let vuelto        = null;

  if (cobroFormaPago === 'efectivo') {
    const r = parseFloat(elCobroMontoRec.value) || 0;
    if (r > 0) {
      if (r < total) {
        elCobroError.textContent = `El monto recibido (${fmt(r)}) es menor al total (${fmt(total)}).`;
        elCobroError.style.display = '';
        elCobroMontoRec.focus();
        return;
      }
      montoRecibido = r;
      vuelto = r - total;
    }
  }

  if (cobroFormaPago === 'cuenta_corriente' && !cobroClienteSeleccionado) {
    elCobroError.textContent = 'Seleccioná un cliente para operar con crédito.';
    elCobroError.style.display = '';
    elCobrobuscCliente.focus();
    return;
  }

  // ── Validaciones pago mixto ──────────────────────────────────
  let formaPago2       = null;
  let montoPago2       = null;
  let cuentaClienteId  = cobroClienteSeleccionado?.id ?? null;

  if (cobroFormaPago === 'mixto') {
    const metodo1 = document.getElementById('mixto-metodo-1').value;
    const metodo2 = document.getElementById('mixto-metodo-2').value;
    const m1      = parseFloat(document.getElementById('mixto-monto-1').value) || 0;
    const m2      = parseFloat(document.getElementById('mixto-monto-2').value) || 0;

    if (metodo1 === metodo2) {
      elCobroError.textContent = 'Los dos métodos de pago no pueden ser iguales.';
      elCobroError.style.display = '';
      return;
    }
    if (m1 <= 0) {
      elCobroError.textContent = 'Ingresá el monto del primer método de pago.';
      elCobroError.style.display = '';
      document.getElementById('mixto-monto-1').focus();
      return;
    }
    if (m2 < 0) {
      elCobroError.textContent = 'El segundo monto no puede ser negativo.';
      elCobroError.style.display = '';
      return;
    }
    if (Math.abs(m1 + m2 - total) > 0.015) {
      elCobroError.textContent = `La suma (${fmt(m1 + m2)}) no coincide con el total (${fmt(total)}).`;
      elCobroError.style.display = '';
      return;
    }
    if ((metodo1 === 'cuenta_corriente' || metodo2 === 'cuenta_corriente') && !mixtoClienteSelec) {
      elCobroError.textContent = 'Seleccioná un cliente para la parte de Cta. Cte.';
      elCobroError.style.display = '';
      document.getElementById('mixto-buscar-cliente').focus();
      return;
    }

    // Efectivo dentro del mixto
    if (metodo1 === 'efectivo' || metodo2 === 'efectivo') {
      const efectivoPorcion = metodo1 === 'efectivo' ? m1 : m2;
      const recibido = parseFloat(document.getElementById('mixto-efectivo-recibido').value) || 0;
      if (recibido > 0) {
        if (recibido < efectivoPorcion) {
          elCobroError.textContent = `El efectivo recibido (${fmt(recibido)}) es menor al monto en efectivo (${fmt(efectivoPorcion)}).`;
          elCobroError.style.display = '';
          document.getElementById('mixto-efectivo-recibido').focus();
          return;
        }
        montoRecibido = recibido;
        vuelto        = recibido - efectivoPorcion;
      }
    }

    formaPago2      = metodo2;
    montoPago2      = m2;
    cuentaClienteId = mixtoClienteSelec?.id ?? null;
  }

  const formaFinal = cobroFormaPago === 'mixto'
    ? document.getElementById('mixto-metodo-1').value
    : cobroFormaPago;

  const transaccionData = {
    monto_total:       total,
    subtotal:          subtotalItems,
    monto_impuesto:    impuesto,
    descuento_global:  descuentoGlobal,
    propina:           totales.propina ?? 0,
    notas:             t.notas?.trim() || null,
    turno_id:          turnoActivo?.id ?? null,
    forma_pago:        formaFinal,
    forma_pago_2:      formaPago2,
    monto_pago_2:      montoPago2,
    cuenta_cliente_id: cuentaClienteId,
  };

  const detalleData = t.carrito.map(item => {
    const precioBase = getPrecioBase(item);
    const descPct    = item.descuento_porcentaje || 0;
    return {
      articulo_id:          item.esLibre ? null : item.id,
      descripcion_libre:    item.esLibre ? item.nombre : null,
      cantidad:             item.cantidad,
      precio_al_momento:    precioBase,
      descuento_porcentaje: descPct,
      importe_total:        precioBase * item.cantidad * (1 - descPct / 100),
    };
  });

  document.getElementById('btn-cobro-imprimir').disabled     = true;
  document.getElementById('btn-cobro-sin-imprimir').disabled = true;

  try {
    const guardada = await window.api.transacciones.create({ transaccion: transaccionData, detalle: detalleData });
    ultimaTransaccionId = guardada.id;
    document.getElementById('btn-reimprimir').disabled = false;
    if (imprimir) {
      await window.api.caja.abrirComprobante({
        transaccionId: guardada.id,
        montoRecibido,
        vuelto,
        propina: totales.propina,
      });
    }
    cerrarModalCobro();
    limpiarCarritoActual();
  } catch (err) {
    elCobroError.textContent = err.message || 'Error al procesar la venta.';
    elCobroError.style.display = '';
  } finally {
    document.getElementById('btn-cobro-imprimir').disabled     = false;
    document.getElementById('btn-cobro-sin-imprimir').disabled = false;
  }
}

// ── Bindear eventos de modo (propina, etc.) ──────────────────────
function bindearEventos() {
  if (modoNegocio === 'restaurante') {
    const elPropina = document.getElementById('propina-monto');
    if (elPropina) elPropina.addEventListener('input', actualizarTotales);
  }
}

// ── Atajos de acción — capture-phase (interceptan ANTES de que lleguen a cualquier input) ──
document.addEventListener('keydown', e => {
  if (elModalCobro.classList.contains('visible')) return;
  if (document.querySelector('.modal-overlay:not(.hidden)')) return;

  const enCampoCodigo   = document.activeElement?.id === 'campo-codigo';
  const buscadorAbierto = elBuscadorOverlay.classList.contains('visible');

  // + siempre suma cantidad (incluso con campo-codigo activo)
  if ((e.key === '+' || e.code === 'NumpadAdd') && !buscadorAbierto) {
    e.preventDefault(); e.stopPropagation();
    const carrito = ticketActivo().carrito;
    const selIdx  = ticketActivo().itemSeleccionadoIdx;
    if (selIdx !== null && carrito[selIdx]) {
      carrito[selIdx].cantidad++;
      evaluarPromo(carrito[selIdx]);
      renderCarrito(); actualizarTotales();
    }
    return;
  }

  // - siempre resta cantidad (incluso con campo-codigo activo)
  if ((e.key === '-' || e.code === 'NumpadSubtract') && !buscadorAbierto) {
    e.preventDefault(); e.stopPropagation();
    const carrito = ticketActivo().carrito;
    const selIdx  = ticketActivo().itemSeleccionadoIdx;
    if (selIdx !== null && carrito[selIdx]) {
      const next = carrito[selIdx].cantidad - 1;
      if (next <= 0) {
        carrito.splice(selIdx, 1);
        ticketActivo().itemSeleccionadoIdx = carrito.length > 0 ? Math.min(selIdx, carrito.length - 1) : null;
      } else {
        carrito[selIdx].cantidad = next;
        evaluarPromo(carrito[selIdx]);
      }
      renderCarrito(); actualizarTotales();
    }
    return;
  }

  // ↑↓ navegan el carrito (excepto cuando foco está en campo-codigo o en buscador)
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !enCampoCodigo && !buscadorAbierto) {
    e.preventDefault(); e.stopPropagation();
    const carrito = ticketActivo().carrito;
    if (carrito.length === 0) return;
    let selIdx = ticketActivo().itemSeleccionadoIdx ?? 0;
    if (e.key === 'ArrowUp') selIdx = Math.max(0, selIdx - 1);
    else selIdx = Math.min(carrito.length - 1, selIdx + 1);
    ticketActivo().itemSeleccionadoIdx = selIdx;
    renderCarrito();
    const row = elCarritoTbody.querySelector(`tr[data-row-idx="${selIdx}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' });
    return;
  }

  // Delete elimina el ítem seleccionado (excepto en campo-codigo)
  if (e.key === 'Delete' && !enCampoCodigo && !buscadorAbierto) {
    e.preventDefault(); e.stopPropagation();
    const selIdx = ticketActivo().itemSeleccionadoIdx;
    const carrito = ticketActivo().carrito;
    if (selIdx !== null && carrito[selIdx]) {
      carrito.splice(selIdx, 1);
      ticketActivo().itemSeleccionadoIdx = carrito.length > 0 ? Math.min(selIdx, carrito.length - 1) : null;
      if (carrito.length === 0) ticketActivo().itemSeleccionadoIdx = null;
      renderCarrito(); actualizarTotales();
    }
    return;
  }
}, true);

// ── Hotkeys globales de caja (bubble-phase) ──────────────────────
function isEditableActive() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' ||
         el.isContentEditable === true || el.getAttribute('contenteditable') === 'true';
}

document.addEventListener('keydown', e => {
  const modalCobroAbierto = elModalCobro.classList.contains('visible');

  if (e.key === 'F12') {
    e.preventDefault();
    if (!modalCobroAbierto) abrirModalCobro();
    return;
  }

  if (e.key === 'F10') {
    e.preventDefault();
    if (!modalCobroAbierto) {
      if (elBuscadorOverlay.classList.contains('visible')) cerrarBuscador();
      else abrirBuscador();
    }
    return;
  }

  if (e.key === 'F11') {
    e.preventDefault();
    if (!modalCobroAbierto) {
      const selIdx = ticketActivo().itemSeleccionadoIdx;
      const carrito = ticketActivo().carrito;
      if (selIdx !== null && carrito[selIdx]) toggleMayoreo(selIdx);
      else {
        const idx = carrito.findIndex(i => parseFloat(i.precio_mayoreo) > 0);
        if (idx >= 0) toggleMayoreo(idx);
      }
    }
    return;
  }

  if (isEditableActive()) return;

  if (e.key === 'Insert') {
    e.preventDefault();
    if (!modalCobroAbierto) {
      document.getElementById('btn-producto-libre').click();
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    if (!modalCobroAbierto) {
      const selIdx = ticketActivo().itemSeleccionadoIdx;
      const carrito = ticketActivo().carrito;
      if (selIdx !== null && carrito[selIdx]) abrirModalDescuento(selIdx);
      else if (carrito.length > 0) abrirModalDescuento(carrito.length - 1);
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault();
    if (!modalCobroAbierto && tickets.length < MAX_TICKETS) abrirModalRenombrar(null);
    return;
  }

  if (e.altKey && e.key === 'n') {
    e.preventDefault();
    if (!modalCobroAbierto) toggleNotas();
    return;
  }

  if (e.key === 'Escape' && elBuscadorOverlay.classList.contains('visible')) {
    e.preventDefault();
    cerrarBuscador();
    return;
  }

  const buscadorAbierto = elBuscadorOverlay.classList.contains('visible');

  if (!modalCobroAbierto && !buscadorAbierto) {
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      elCampoCodigo.focus();
    }
  }
});

// ── Reimprimir último ticket ─────────────────────────────────────
document.getElementById('btn-reimprimir').addEventListener('click', async () => {
  if (!ultimaTransaccionId) return;
  try {
    await window.api.caja.abrirComprobante({
      transaccionId: ultimaTransaccionId,
      montoRecibido: 0,
      vuelto:        0,
      propina:       0,
    });
  } catch (err) {
    mostrarToast('No se pudo abrir el comprobante.', 'error');
  }
});

// ── Pago Mixto — lógica de la sección ───────────────────────────
function actualizarMixtoExtraSections() {
  const m1 = document.getElementById('mixto-metodo-1').value;
  const m2 = document.getElementById('mixto-metodo-2').value;
  const tieneEfectivo = m1 === 'efectivo' || m2 === 'efectivo';
  const tieneCuenta   = m1 === 'cuenta_corriente' || m2 === 'cuenta_corriente';

  document.getElementById('mixto-efectivo-extra').style.display = tieneEfectivo ? 'flex' : 'none';
  document.getElementById('mixto-seccion-cliente').style.display = tieneCuenta ? 'flex' : 'none';

  if (tieneEfectivo) actualizarMixtoVuelto();
}

function actualizarMixtoVuelto() {
  const m1      = document.getElementById('mixto-metodo-1').value;
  const m2      = document.getElementById('mixto-metodo-2').value;
  const monto1  = parseFloat(document.getElementById('mixto-monto-1').value) || 0;
  const monto2  = parseFloat(document.getElementById('mixto-monto-2').value) || 0;
  const efectivoPorcion = m1 === 'efectivo' ? monto1 : (m2 === 'efectivo' ? monto2 : 0);
  const recibido = parseFloat(document.getElementById('mixto-efectivo-recibido').value) || 0;
  const elVuelto = document.getElementById('mixto-vuelto-display');
  if (!efectivoPorcion || recibido === 0) {
    elVuelto.textContent = '—';
    elVuelto.style.color = 'var(--text-subtle)';
    return;
  }
  const diff = recibido - efectivoPorcion;
  if (diff < 0) {
    elVuelto.textContent = `Falta ${fmt(Math.abs(diff))}`;
    elVuelto.style.color = '#ef4444';
  } else {
    elVuelto.textContent = fmt(diff);
    elVuelto.style.color = '#22c55e';
  }
}

// Sincronizar montos al editar cualquiera de los dos
document.getElementById('mixto-monto-1').addEventListener('input', () => {
  if (_mixtoUpdating) return;
  _mixtoUpdating = true;
  const { total } = calcularTotales();
  const m1 = parseFloat(document.getElementById('mixto-monto-1').value) || 0;
  document.getElementById('mixto-monto-2').value = Math.max(0, total - m1).toFixed(2);
  actualizarMixtoVuelto();
  _mixtoUpdating = false;
});

document.getElementById('mixto-monto-2').addEventListener('input', () => {
  if (_mixtoUpdating) return;
  _mixtoUpdating = true;
  const { total } = calcularTotales();
  const m2 = parseFloat(document.getElementById('mixto-monto-2').value) || 0;
  document.getElementById('mixto-monto-1').value = Math.max(0, total - m2).toFixed(2);
  actualizarMixtoVuelto();
  _mixtoUpdating = false;
});

document.getElementById('mixto-efectivo-recibido').addEventListener('input', actualizarMixtoVuelto);

// Cambio de selects: evitar duplicados y actualizar secciones extra
document.getElementById('mixto-metodo-1').addEventListener('change', () => {
  const m1 = document.getElementById('mixto-metodo-1').value;
  const m2 = document.getElementById('mixto-metodo-2').value;
  if (m1 === m2) {
    const opciones = ['efectivo','tarjeta_debito','tarjeta_credito','transferencia','cuenta_corriente'];
    const alt = opciones.find(o => o !== m1) || 'tarjeta_debito';
    document.getElementById('mixto-metodo-2').value = alt;
  }
  actualizarMixtoExtraSections();
  if (!mixtoClienteSelec) {
    document.getElementById('mixto-cliente-badge').style.display = 'none';
    document.getElementById('mixto-buscar-cliente').value = '';
    mixtoClienteSelec = null;
  }
});

document.getElementById('mixto-metodo-2').addEventListener('change', () => {
  const m1 = document.getElementById('mixto-metodo-1').value;
  const m2 = document.getElementById('mixto-metodo-2').value;
  if (m1 === m2) {
    const opciones = ['efectivo','tarjeta_debito','tarjeta_credito','transferencia','cuenta_corriente'];
    const alt = opciones.find(o => o !== m2) || 'efectivo';
    document.getElementById('mixto-metodo-1').value = alt;
  }
  actualizarMixtoExtraSections();
  if (!mixtoClienteSelec) {
    document.getElementById('mixto-cliente-badge').style.display = 'none';
    document.getElementById('mixto-buscar-cliente').value = '';
    mixtoClienteSelec = null;
  }
});

// Búsqueda de cliente para mixto
document.getElementById('mixto-buscar-cliente').addEventListener('input', () => {
  clearTimeout(timerMixtoCliente);
  const q = document.getElementById('mixto-buscar-cliente').value.trim();
  if (!q) { document.getElementById('mixto-resultados-cliente').style.display = 'none'; mixtoClientesLista = []; return; }
  timerMixtoCliente = setTimeout(() => buscarClientesMixto(q), 250);
});

async function buscarClientesMixto(q) {
  mixtoClientesLista = await window.api.clientes.search(q);
  const cont = document.getElementById('mixto-resultados-cliente');
  if (mixtoClientesLista.length === 0) {
    cont.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--text-subtle);">Sin resultados</div>';
  } else {
    cont.innerHTML = mixtoClientesLista.map(c => `
      <div style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border-sub);"
           onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background=''"
           data-mixto-cli-id="${c.id}">
        <span style="font-weight:500;">${esc(c.nombre)}</span>
        ${c.telefono ? `<span style="color:var(--text-subtle);margin-left:8px;font-size:11px;">${esc(c.telefono)}</span>` : ''}
      </div>`).join('');
  }
  cont.style.display = '';
}

document.getElementById('mixto-resultados-cliente').addEventListener('click', e => {
  const item = e.target.closest('[data-mixto-cli-id]');
  if (!item) return;
  const cl = mixtoClientesLista.find(c => c.id === parseInt(item.dataset.mixtoCliId, 10));
  if (cl) seleccionarClienteMixto(cl);
});

function seleccionarClienteMixto(cl) {
  mixtoClienteSelec = cl;
  document.getElementById('mixto-cliente-nombre').textContent = cl.nombre;
  document.getElementById('mixto-cliente-badge').style.display = 'flex';
  document.getElementById('mixto-buscar-cliente').value = '';
  document.getElementById('mixto-resultados-cliente').style.display = 'none';
}

// ── Navegación por teclado en dropdowns de autocomplete ────────
window.bindDropdownKeyboard({
  inputEl:    elCobrobuscCliente,
  dropdownEl: elCobroResCliente,
  optSel:     '[data-cli-id]',
  onSelect:   item => {
    const cl = clientesCobroLista.find(c => c.id === parseInt(item.dataset.cliId, 10));
    if (cl) seleccionarClienteCobro(cl);
  },
  onClose: () => { elCobroResCliente.style.display = 'none'; },
});
window.bindDropdownKeyboard({
  inputEl:   document.getElementById('mixto-buscar-cliente'),
  dropdownId:'mixto-resultados-cliente',
  optSel:    '[data-mixto-cli-id]',
  onSelect:  item => {
    const cl = mixtoClientesLista.find(c => c.id === parseInt(item.dataset.mixtoCliId, 10));
    if (cl) seleccionarClienteMixto(cl);
  },
  onClose: () => { document.getElementById('mixto-resultados-cliente').style.display = 'none'; },
});

document.getElementById('mixto-btn-quitar-cliente').addEventListener('click', () => {
  mixtoClienteSelec = null;
  document.getElementById('mixto-cliente-badge').style.display = 'none';
  document.getElementById('mixto-buscar-cliente').value = '';
  document.getElementById('mixto-buscar-cliente').focus();
});

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

function mostrarToast(msg, tipo = 'success') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── F1/F2/F12 desde globalShortcut ──────────────────────────────
if (window.api.onCobrarConTicket) {
  window.api.onCobrarConTicket(() => {
    if (elModalCobro.classList.contains('visible')) ejecutarCobro(true);
  });
}
if (window.api.onCobrarSinTicket) {
  window.api.onCobrarSinTicket(() => {
    if (elModalCobro.classList.contains('visible')) ejecutarCobro(false);
  });
}
// F12 desde main process (funciona aunque haya input con foco)
if (window.api.onAbrirCobro) {
  window.api.onAbrirCobro(() => {
    if (!elModalCobro.classList.contains('visible')) abrirModalCobro();
  });
}
