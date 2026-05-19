// Módulo Proveedores — CRUD de proveedores + gestión de pedidos sugeridos

// ── Estado ─────────────────────────────────────────────────────
let proveedores      = [];
let pedidos          = [];
let recepciones      = [];
let editandoId       = null;
let tabActual        = 'proveedores';
let sugerenciaGrupos = {};   // clave: nombre proveedor → items

// ── Estado recepciones ─────────────────────────────────────────
let lineasRecepcion   = [];
let nextLineId        = 1;
let dropdownLineId    = null;
let timerBusqRecv     = null;
let articulosBusqRecv = [];

// ── Refs DOM ───────────────────────────────────────────────────
const tabla         = document.getElementById('tabla-proveedores');
const inputBusq     = document.getElementById('busqueda');
const modal         = document.getElementById('modal');
const modalTitulo   = document.getElementById('modal-titulo');
const form          = document.getElementById('form-proveedor');
const errorMsg      = document.getElementById('error-msg');
const modalConfirm  = document.getElementById('modal-confirm');
const confirmNombre = document.getElementById('confirm-nombre');
const modalRecibido = document.getElementById('modal-recibido');

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([cargarProveedores(), cargarPedidos(), cargarRecepciones()]);
});

inputBusq.addEventListener('input', () => renderTabla(filtrar(inputBusq.value)));

document.getElementById('btn-nuevo').addEventListener('click', abrirModalNuevo);
document.getElementById('btn-cancelar-modal').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar-confirm').addEventListener('click', cerrarConfirm);
form.addEventListener('submit', guardar);

modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
modalConfirm.addEventListener('click', e => { if (e.target === modalConfirm) cerrarConfirm(); });
modalRecibido.addEventListener('click', e => { if (e.target === modalRecibido) cerrarRecibido(); });
document.getElementById('btn-cerrar-recibido').addEventListener('click', cerrarRecibido);
document.getElementById('btn-cancelar-recibido').addEventListener('click', cerrarRecibido);

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn =>
  btn.addEventListener('click', () => cambiarTab(btn.dataset.tab))
);

document.getElementById('btn-generar-sugerencia').addEventListener('click', generarSugerencias);

// Delegación para botones "Crear pedido" en sugerencias
document.getElementById('resultado-sugerencias').addEventListener('click', e => {
  const btn = e.target.closest('button[data-crear-pedido]');
  if (!btn) return;
  const clave = btn.dataset.crearPedido;
  if (sugerenciaGrupos[clave]) crearPedidoDesdeGrupo(clave, sugerenciaGrupos[clave]);
});

// Delegación de eventos en tabla de proveedores
tabla.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id     = parseInt(btn.dataset.id, 10);
  const action = btn.dataset.action;
  if (action === 'editar')   abrirModalEdicion(id);
  if (action === 'eliminar') abrirConfirm(id);
});

// Delegación de eventos en tabla de pedidos
document.getElementById('tabla-pedidos').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id     = parseInt(btn.dataset.id, 10);
  const action = btn.dataset.action;
  if (action === 'recibir') abrirRecibido(id);
});

// ── Tabs ───────────────────────────────────────────────────────
function cambiarTab(tab) {
  tabActual = tab;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  document.getElementById('panel-proveedores').style.display  = tab === 'proveedores'  ? 'flex'  : 'none';
  document.getElementById('panel-pedidos').style.display      = tab === 'pedidos'      ? 'flex'  : 'none';
  document.getElementById('panel-recepciones').style.display  = tab === 'recepciones'  ? 'flex'  : 'none';
  document.getElementById('btn-nuevo').style.display          = tab === 'proveedores'  ? ''      : 'none';
}

// ── Carga ──────────────────────────────────────────────────────
async function cargarProveedores() {
  proveedores = await window.api.proveedores.getAll();
  renderTabla(filtrar(inputBusq.value));
  poblarSelectProveedor();
}

async function cargarPedidos() {
  pedidos = await window.api.pedidos.getAll();
  renderTablaPedidos();
  poblarSelectPedidos(null);
}

// ── Filtro ─────────────────────────────────────────────────────
function filtrar(q) {
  const term = q.trim().toLowerCase();
  if (!term) return proveedores;
  return proveedores.filter(p =>
    p.nombre.toLowerCase().includes(term) ||
    (p.telefono || '').toLowerCase().includes(term) ||
    (p.email || '').toLowerCase().includes(term)
  );
}

// ── Render tabla proveedores ───────────────────────────────────
function renderTabla(lista) {
  if (lista.length === 0) {
    const msg = inputBusq.value.trim()
      ? 'Sin resultados para la búsqueda'
      : 'No hay proveedores. Creá el primero con "+ Nuevo proveedor".';
    tabla.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">${msg}</td></tr>`;
    return;
  }

  tabla.innerHTML = lista.map(p => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-2.5 font-medium">${esc(p.nombre)}</td>
      <td class="px-4 py-2.5 text-gray-500">${esc(p.telefono || '—')}</td>
      <td class="px-4 py-2.5 text-gray-500 text-sm">${esc(p.email || '—')}</td>
      <td class="px-4 py-2.5 text-gray-500 text-sm">${esc(p.direccion || '—')}</td>
      <td class="px-4 py-2.5 text-center whitespace-nowrap">
        <button data-action="editar"   data-id="${p.id}"
          class="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3 hover:underline">
          Editar
        </button>
        <button data-action="eliminar" data-id="${p.id}"
          class="text-red-500 hover:text-red-700 text-xs font-medium hover:underline">
          Eliminar
        </button>
      </td>
    </tr>`).join('');
}

// ── Render tabla pedidos ───────────────────────────────────────
const ESTADO_LABEL = { pendiente: 'Pendiente', recibido: 'Recibido', cancelado: 'Cancelado' };
const ESTADO_CLS   = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  recibido:  'bg-green-100 text-green-700',
  cancelado: 'bg-gray-100 text-gray-500',
};

function renderTablaPedidos() {
  const tbody = document.getElementById('tabla-pedidos');
  if (pedidos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400 text-sm">No hay pedidos creados aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = pedidos.map(p => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-2.5 text-xs text-gray-500 font-mono">#${p.id}</td>
      <td class="px-4 py-2.5 text-xs">${p.created_at ? p.created_at.slice(0, 10) : '—'}</td>
      <td class="px-4 py-2.5 font-medium text-sm">${esc(p.proveedor_label || '—')}</td>
      <td class="px-4 py-2.5 text-center text-sm">${p.total_items}</td>
      <td class="px-4 py-2.5">
        <span class="px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_CLS[p.estado] || 'bg-gray-100 text-gray-500'}">
          ${ESTADO_LABEL[p.estado] || p.estado}
        </span>
      </td>
      <td class="px-4 py-2.5 text-center">
        ${p.estado === 'pendiente' ? `
          <button data-action="recibir" data-id="${p.id}"
            class="text-green-600 hover:text-green-800 text-xs font-medium hover:underline">
            Marcar recibido
          </button>` : '—'}
      </td>
    </tr>`).join('');
}

// ── Modal ABM ─────────────────────────────────────────────────
function abrirModalNuevo() {
  editandoId = null;
  modalTitulo.textContent = 'Nuevo proveedor';
  form.nombre.value    = '';
  form.telefono.value  = '';
  form.email.value     = '';
  form.direccion.value = '';
  form.notas.value     = '';
  ocultarError();
  modal.classList.remove('hidden');
  form.nombre.focus();
}

function abrirModalEdicion(id) {
  const p = proveedores.find(x => x.id === id);
  if (!p) return;

  editandoId = id;
  modalTitulo.textContent = 'Editar proveedor';
  form.nombre.value    = p.nombre    ?? '';
  form.telefono.value  = p.telefono  ?? '';
  form.email.value     = p.email     ?? '';
  form.direccion.value = p.direccion ?? '';
  form.notas.value     = p.notas     ?? '';
  ocultarError();
  modal.classList.remove('hidden');
  form.nombre.focus();
}

function cerrarModal() {
  modal.classList.add('hidden');
  ocultarError();
  editandoId = null;
}

// ── Guardar ────────────────────────────────────────────────────
async function guardar(e) {
  e.preventDefault();
  ocultarError();

  const data = {
    nombre:    form.nombre.value.trim(),
    telefono:  form.telefono.value.trim()  || null,
    email:     form.email.value.trim()     || null,
    direccion: form.direccion.value.trim() || null,
    notas:     form.notas.value.trim()     || null,
  };

  if (!data.nombre) return mostrarError('El nombre es obligatorio.');

  bloquearFormulario(true);
  try {
    if (editandoId !== null) {
      const actualizado = await window.api.proveedores.update(editandoId, data);
      const idx = proveedores.findIndex(p => p.id === editandoId);
      if (idx !== -1) proveedores[idx] = actualizado;
    } else {
      const nuevo = await window.api.proveedores.create(data);
      proveedores.push(nuevo);
      proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    cerrarModal();
    renderTabla(filtrar(inputBusq.value));
  } catch (err) {
    mostrarError('Error al guardar: ' + (err.message || err));
  } finally {
    bloquearFormulario(false);
  }
}

// ── Eliminar ───────────────────────────────────────────────────
function abrirConfirm(id) {
  const p = proveedores.find(x => x.id === id);
  if (!p) return;

  confirmNombre.textContent = p.nombre;

  const btnConfirmar = document.getElementById('btn-confirmar-eliminar');
  const clone = btnConfirmar.cloneNode(true);
  btnConfirmar.parentNode.replaceChild(clone, btnConfirmar);
  clone.addEventListener('click', async () => {
    cerrarConfirm();
    await window.api.proveedores.delete(id);
    proveedores = proveedores.filter(x => x.id !== id);
    renderTabla(filtrar(inputBusq.value));
  });

  modalConfirm.classList.remove('hidden');
}

function cerrarConfirm() {
  modalConfirm.classList.add('hidden');
}

// ── Sugerencias de pedido ──────────────────────────────────────
async function generarSugerencias() {
  const btn = document.getElementById('btn-generar-sugerencia');
  btn.disabled    = true;
  btn.textContent = 'Generando...';

  try {
    const articulos = await window.api.proveedores.articulosConStockBajo();
    renderSugerencias(articulos);
  } catch (err) {
    document.getElementById('resultado-sugerencias').innerHTML =
      `<div class="empty-state text-red-500">Error: ${esc(err.message)}</div>`;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Generar sugerencia de pedido';
  }
}

function renderSugerencias(articulos) {
  const el = document.getElementById('resultado-sugerencias');

  if (articulos.length === 0) {
    el.innerHTML = '<div class="empty-state">No hay artículos con stock bajo. ¡Todo en orden!</div>';
    return;
  }

  // Agrupar por proveedor y guardar en estado para event delegation
  sugerenciaGrupos = {};
  for (const art of articulos) {
    const clave = art.proveedor || '(Sin proveedor)';
    if (!sugerenciaGrupos[clave]) sugerenciaGrupos[clave] = [];
    sugerenciaGrupos[clave].push(art);
  }

  el.innerHTML = Object.entries(sugerenciaGrupos).map(([proveedor, items]) => {
    const rows = items.map(art => {
      const sugerida = Math.max(0, Number(art.stock_minimo) - Number(art.stock_actual)) + Number(art.stock_minimo);
      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:8px 16px;font-weight:500;">${esc(art.nombre)}</td>
          <td style="padding:8px 16px;font-family:monospace;font-size:12px;color:var(--text-muted);">${esc(art.codigo)}</td>
          <td style="padding:8px 16px;text-align:right;color:#f87171;font-weight:700;">${fmtNum(art.stock_actual)} ${esc(art.unidad_medida)}</td>
          <td style="padding:8px 16px;text-align:right;color:var(--text-muted);">${fmtNum(art.stock_minimo)}</td>
          <td style="padding:8px 16px;text-align:right;font-weight:600;color:var(--accent);">${fmtNum(sugerida)}</td>
          <td style="padding:8px 16px;text-align:right;color:var(--text-subtle);font-size:12px;">${fmt(art.costo_unitario)}</td>
        </tr>`;
    }).join('');

    return `
      <div style="border:1px solid var(--border);border-radius:var(--r);background:var(--surface);flex-shrink:0;">
        <div style="padding:10px 16px;background:var(--surface-2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;border-radius:var(--r) var(--r) 0 0;">
          <span style="font-size:13px;font-weight:600;">${esc(proveedor)}</span>
          <button class="btn btn-primary" style="font-size:12px;padding:5px 12px;"
            data-crear-pedido="${esc(proveedor)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Crear pedido
          </button>
        </div>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:8px 16px;text-align:left;color:var(--text-subtle);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Artículo</th>
              <th style="padding:8px 16px;text-align:left;color:var(--text-subtle);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Código</th>
              <th style="padding:8px 16px;text-align:right;color:var(--text-subtle);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Stock actual</th>
              <th style="padding:8px 16px;text-align:right;color:var(--text-subtle);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Stock mín.</th>
              <th style="padding:8px 16px;text-align:right;color:var(--text-subtle);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Cant. sugerida</th>
              <th style="padding:8px 16px;text-align:right;color:var(--text-subtle);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Costo u.</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
}

async function crearPedidoDesdeGrupo(clave, articulos) {
  // articulos puede venir directo del estado sugerenciaGrupos
  const arts = articulos || sugerenciaGrupos[clave];
  if (!arts || arts.length === 0) return;

  const items = arts.map(art => ({
    articulo_id:       art.id,
    cantidad_sugerida: Math.max(0, Number(art.stock_minimo) - Number(art.stock_actual)) + Number(art.stock_minimo),
    cantidad_pedida:   Math.max(0, Number(art.stock_minimo) - Number(art.stock_actual)) + Number(art.stock_minimo),
    costo_unitario:    art.costo_unitario ?? 0,
  }));

  // Buscar proveedor en la tabla por nombre exacto
  const encontrado  = proveedores.find(p => p.nombre === clave);
  const proveedorId = encontrado ? encontrado.id : null;

  try {
    await window.api.pedidos.crear(proveedorId, clave, items);
    await cargarPedidos();
    cambiarTab('pedidos');
    mostrarToast(`Pedido creado para ${clave}`);
  } catch (err) {
    alert('Error al crear el pedido: ' + (err.message || err));
  }
}

// ── Modal: Marcar recibido ─────────────────────────────────────
let pedidoRecibidoId = null;

async function abrirRecibido(id) {
  const pedido = await window.api.pedidos.getById(id);
  if (!pedido) return;

  pedidoRecibidoId = id;
  document.getElementById('recibido-proveedor').textContent = pedido.proveedor_label || '—';

  const tbody = document.getElementById('tabla-recibido');
  tbody.innerHTML = pedido.detalle.map(item => `
    <tr>
      <td class="px-3 py-2">
        <div class="font-medium text-sm">${esc(item.articulo_nombre || '—')}</div>
        <div class="text-xs text-gray-400 font-mono">${esc(item.articulo_codigo || '')}</div>
      </td>
      <td class="px-3 py-2 text-right text-sm">
        ${fmtNum(item.cantidad_pedida)} ${esc(item.unidad_medida || '')}
      </td>
      <td class="px-3 py-2 text-right">
        <input type="number" class="inp" style="width:80px;text-align:right;padding:4px 8px;"
          data-detalle-id="${item.id}"
          data-articulo-id="${item.articulo_id}"
          value="${fmtNum(item.cantidad_pedida)}"
          min="0" step="0.001" />
      </td>
    </tr>`).join('');

  document.getElementById('btn-confirmar-recibido').onclick = confirmarRecibido;
  modalRecibido.classList.remove('hidden');
}

async function confirmarRecibido() {
  const inputs = document.querySelectorAll('#tabla-recibido input[data-detalle-id]');
  const itemsRecibidos = Array.from(inputs).map(inp => ({
    detalle_id:  parseInt(inp.dataset.detalleId, 10),
    articulo_id: inp.dataset.articuloId ? parseInt(inp.dataset.articuloId, 10) : null,
    recibido:    parseFloat(inp.value) || 0,
  }));

  const btn = document.getElementById('btn-confirmar-recibido');
  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    await window.api.pedidos.marcarRecibido(pedidoRecibidoId, itemsRecibidos);
    cerrarRecibido();
    await cargarPedidos();
    mostrarToast('Recepción registrada. Stock actualizado.');
  } catch (err) {
    alert('Error al registrar recepción: ' + (err.message || err));
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Confirmar recepción';
  }
}

function cerrarRecibido() {
  modalRecibido.classList.add('hidden');
  pedidoRecibidoId = null;
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
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function ocultarError() {
  errorMsg.textContent = '';
  errorMsg.classList.add('hidden');
}

function bloquearFormulario(bloquear) {
  const btn = document.getElementById('btn-guardar');
  btn.disabled    = bloquear;
  btn.textContent = bloquear ? 'Guardando...' : 'Guardar';
}

function mostrarToast(msg) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ═══════════════════════════════════════════════════════════════
// RECEPCIONES
// ═══════════════════════════════════════════════════════════════

// ── Selects auxiliares ─────────────────────────────────────────
function poblarSelectProveedor() {
  const sel = document.getElementById('recv-proveedor');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Sin proveedor —</option>' +
    proveedores.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');
  if (prev) sel.value = prev;
}

function poblarSelectPedidos(provId) {
  const sel = document.getElementById('recv-pedido');
  if (!sel) return;
  let pendientes = pedidos.filter(p => p.estado === 'pendiente');
  if (provId) {
    const prv = proveedores.find(p => p.id === provId);
    pendientes = pendientes.filter(p =>
      p.proveedor_id === provId ||
      (prv && p.proveedor_label === prv.nombre)
    );
  }
  sel.innerHTML = '<option value="">— Sin pedido —</option>' +
    pendientes.map(p =>
      `<option value="${p.id}">#${p.id} — ${esc(p.proveedor_label || 'Sin proveedor')} (${p.total_items} ítem${p.total_items !== 1 ? 's' : ''})</option>`
    ).join('');
  sel.value = '';
}

// ── Carga y render del historial ───────────────────────────────
async function cargarRecepciones() {
  recepciones = await window.api.recepciones.listar();
  renderHistorialRecepciones();
}

function renderHistorialRecepciones() {
  const el = document.getElementById('historial-recepciones');
  if (!el) return;
  if (!recepciones.length) {
    el.innerHTML = '<div class="empty-state">Sin recepciones registradas.</div>';
    return;
  }
  el.innerHTML = recepciones.map(r => `
    <div data-recv-id="${r.id}" class="recv-historial-item"
      style="cursor:pointer;padding:10px 14px;background:var(--surface-2);border-radius:var(--r-in);border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:600;color:var(--text);">${esc(r.proveedor_label || 'Sin proveedor')}</span>
        <span style="font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--accent);">${fmt(r.total_costo)}</span>
      </div>
      <div style="display:flex;gap:14px;font-size:11px;color:var(--text-subtle);">
        <span>${r.fecha}</span>
        <span>${r.total_items} artículo${r.total_items !== 1 ? 's' : ''}</span>
        ${r.pedido_id ? `<span>Pedido #${r.pedido_id}</span>` : ''}
      </div>
      ${r.notas ? `<div style="margin-top:4px;font-size:11px;color:var(--text-muted);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.notas)}</div>` : ''}
    </div>`).join('');
}

// ── Líneas ─────────────────────────────────────────────────────
function agregarLinea(prefill) {
  lineasRecepcion.push({
    _id:           nextLineId++,
    articulo_id:   prefill?.articulo_id    ?? null,
    descripcion:   prefill?.descripcion    ?? '',
    cantidad:      prefill?.cantidad       ?? 1,
    costo_unitario: prefill?.costo_unitario ?? 0,
    importe_total: (prefill?.cantidad ?? 1) * (prefill?.costo_unitario ?? 0),
  });
  renderLineasRecepcion();
  actualizarTotalRecv();
}

function eliminarLinea(lineId) {
  lineasRecepcion = lineasRecepcion.filter(l => l._id !== lineId);
  renderLineasRecepcion();
  actualizarTotalRecv();
}

function renderLineasRecepcion() {
  const tbody = document.getElementById('lineas-recepcion');
  if (!tbody) return;
  if (!lineasRecepcion.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:14px 0;font-size:13px;color:var(--text-subtle);">Sin líneas. Presioná "+ Agregar línea".</td></tr>`;
    return;
  }
  tbody.innerHTML = lineasRecepcion.map(l => `
    <tr data-line-id="${l._id}" style="border-bottom:1px solid var(--border);">
      <td style="padding:4px 4px 4px 0;">
        <input type="text" data-field="art-nombre" data-line-id="${l._id}"
          value="${esc(l.descripcion)}" placeholder="Buscar artículo..."
          autocomplete="off" class="inp"
          style="font-size:12px;padding:5px 8px;min-width:130px;width:100%;" />
        <input type="hidden" data-field="art-id" data-line-id="${l._id}" value="${l.articulo_id ?? ''}" />
      </td>
      <td style="padding:4px;">
        <input type="number" data-field="cantidad" data-line-id="${l._id}"
          value="${l.cantidad}" min="0.001" step="0.001" class="inp"
          style="width:68px;text-align:right;font-size:12px;padding:5px 6px;" />
      </td>
      <td style="padding:4px;">
        <input type="number" data-field="costo" data-line-id="${l._id}"
          value="${l.costo_unitario}" min="0" step="0.01" class="inp"
          style="width:86px;text-align:right;font-size:12px;padding:5px 6px;" />
      </td>
      <td style="padding:4px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--text);"
        data-field="importe" data-line-id="${l._id}">
        ${fmt(l.importe_total)}
      </td>
      <td style="padding:2px 0 2px 2px;text-align:center;">
        <button data-action="del-linea" data-line-id="${l._id}"
          style="background:none;border:none;color:var(--text-subtle);cursor:pointer;font-size:18px;line-height:1;padding:2px 5px;"
          title="Eliminar línea">×</button>
      </td>
    </tr>`).join('');
}

function actualizarTotalRecv() {
  const total = lineasRecepcion.reduce((s, l) => s + (l.importe_total || 0), 0);
  const el = document.getElementById('recv-total');
  if (el) el.textContent = fmt(total);
}

function resetFormRecepcion() {
  lineasRecepcion = [];
  const provSel = document.getElementById('recv-proveedor');
  if (provSel) provSel.value = '';
  poblarSelectPedidos(null);
  const notas = document.getElementById('recv-notas');
  if (notas) notas.value = '';
  const errEl = document.getElementById('recv-error');
  if (errEl) errEl.classList.add('hidden');
  renderLineasRecepcion();
  actualizarTotalRecv();
}

// ── Autocomplete de artículos ──────────────────────────────────
async function buscarArticuloRecv(q, inputEl) {
  const resultados = await window.api.articulos.search(q);
  articulosBusqRecv = resultados;
  renderDropdownRecv(resultados, inputEl);
}

function renderDropdownRecv(lista, inputEl) {
  const dropdown = document.getElementById('recv-art-dropdown');
  if (!lista.length) { cerrarDropdownRecv(); return; }

  const rect = inputEl.getBoundingClientRect();
  dropdown.style.top    = (rect.bottom + 2) + 'px';
  dropdown.style.left   = rect.left + 'px';
  dropdown.style.width  = Math.max(rect.width, 280) + 'px';
  dropdown.style.display = 'block';

  dropdown.innerHTML = lista.map(a => `
    <div data-art-id="${a.id}" class="recv-art-option"
      style="padding:7px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid var(--border);">
      <div style="min-width:0;">
        <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.nombre)}</div>
        <div style="font-size:11px;color:var(--text-subtle);font-family:monospace;">${esc(a.codigo)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:11px;color:var(--text-subtle);">Costo: ${fmt(a.costo_unitario)}</div>
        <div style="font-size:11px;color:var(--text-muted);">Stock: ${fmtNum(a.stock_actual)}</div>
      </div>
    </div>`).join('');
}

function cerrarDropdownRecv() {
  const dropdown = document.getElementById('recv-art-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  dropdownLineId = null;
}

function seleccionarArticuloRecv(art, lineId) {
  const linea = lineasRecepcion.find(l => l._id === lineId);
  if (!linea) return;
  linea.articulo_id    = art.id;
  linea.descripcion    = art.nombre;
  linea.costo_unitario = art.costo_unitario ?? 0;
  linea.importe_total  = linea.cantidad * linea.costo_unitario;

  const tbody = document.getElementById('lineas-recepcion');
  const row   = tbody?.querySelector(`tr[data-line-id="${lineId}"]`);
  if (row) {
    row.querySelector('[data-field="art-nombre"]').value = art.nombre;
    row.querySelector('[data-field="art-id"]').value     = art.id;
    const costoInp = row.querySelector('[data-field="costo"]');
    if (costoInp) costoInp.value = art.costo_unitario ?? 0;
    const importeEl = row.querySelector('[data-field="importe"]');
    if (importeEl) importeEl.textContent = fmt(linea.importe_total);
  }
  actualizarTotalRecv();
}

// ── Pre-fill desde pedido ──────────────────────────────────────
async function onPedidoChange() {
  const pedidoId = parseInt(document.getElementById('recv-pedido').value) || null;
  if (!pedidoId) return;

  const pedido = await window.api.pedidos.getById(pedidoId);
  if (!pedido?.detalle?.length) return;

  // Pre-llenar proveedor si no está seleccionado
  const provSel = document.getElementById('recv-proveedor');
  if (!provSel.value && pedido.proveedor_id) {
    provSel.value = String(pedido.proveedor_id);
  }

  // Reemplazar líneas con ítems del pedido
  lineasRecepcion = pedido.detalle.map(item => ({
    _id:            nextLineId++,
    articulo_id:    item.articulo_id ?? null,
    descripcion:    item.articulo_nombre ?? '',
    cantidad:       item.cantidad_pedida ?? 0,
    costo_unitario: item.costo_unitario  ?? 0,
    importe_total:  (item.cantidad_pedida ?? 0) * (item.costo_unitario ?? 0),
  }));

  renderLineasRecepcion();
  actualizarTotalRecv();
}

// ── Confirmar recepción ────────────────────────────────────────
async function confirmarRecepcion() {
  const errEl = document.getElementById('recv-error');
  errEl.classList.add('hidden');

  const validas = lineasRecepcion.filter(l => l.descripcion.trim() && l.cantidad > 0);
  if (!validas.length) {
    errEl.textContent = 'Agregá al menos una línea con artículo/descripción y cantidad mayor a 0.';
    errEl.classList.remove('hidden');
    return;
  }

  const provId = parseInt(document.getElementById('recv-proveedor').value) || null;
  const pedId  = parseInt(document.getElementById('recv-pedido').value)    || null;
  const prvNom = provId ? (proveedores.find(p => p.id === provId)?.nombre ?? null) : null;
  const notas  = document.getElementById('recv-notas').value.trim() || null;

  const data = {
    proveedor_id:     provId,
    proveedor_nombre: prvNom,
    pedido_id:        pedId,
    notas,
    detalle: validas.map(l => ({
      articulo_id:       l.articulo_id ?? null,
      descripcion:       l.descripcion.trim(),
      cantidad_recibida: l.cantidad,
      costo_unitario:    l.costo_unitario ?? 0,
      importe_total:     l.importe_total  ?? 0,
    })),
  };

  const btn = document.getElementById('btn-confirmar-recv');
  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    await window.api.recepciones.crear(data);
    resetFormRecepcion();
    await Promise.all([cargarRecepciones(), cargarPedidos()]);
    mostrarToast('Recepción confirmada. Stock actualizado.');
  } catch (err) {
    errEl.textContent = 'Error al guardar: ' + (err.message || err);
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Confirmar recepción';
  }
}

// ── Detalle de recepción (modal) ───────────────────────────────
async function abrirDetalleRecepcion(id) {
  const recv = await window.api.recepciones.getById(id);
  if (!recv) return;

  document.getElementById('recv-detalle-titulo').textContent = `Recepción #${recv.id}`;

  document.getElementById('recv-detalle-meta').innerHTML = `
    <div>
      <div style="font-size:11px;color:var(--text-subtle);margin-bottom:3px;">Fecha</div>
      <div style="font-size:13px;font-weight:500;">${recv.fecha}</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-subtle);margin-bottom:3px;">Proveedor</div>
      <div style="font-size:13px;font-weight:500;">${esc(recv.proveedor_label || '—')}</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-subtle);margin-bottom:3px;">Pedido origen</div>
      <div style="font-size:13px;font-weight:500;">${recv.pedido_id ? `#${recv.pedido_id}` : '—'}</div>
    </div>
    ${recv.notas ? `<div style="grid-column:1/-1;">
      <div style="font-size:11px;color:var(--text-subtle);margin-bottom:3px;">Notas</div>
      <div style="font-size:13px;color:var(--text-muted);">${esc(recv.notas)}</div>
    </div>` : ''}
  `;

  document.getElementById('recv-detalle-tabla').innerHTML = recv.detalle.map(d => `
    <tr>
      <td>
        <div style="font-weight:500;">${esc(d.articulo_nombre || d.descripcion || '—')}</div>
        ${d.articulo_codigo ? `<div style="font-size:11px;color:var(--text-subtle);font-family:monospace;">${esc(d.articulo_codigo)}</div>` : ''}
      </td>
      <td style="text-align:right;">${fmtNum(d.cantidad_recibida)}</td>
      <td style="text-align:right;">${fmt(d.costo_unitario)}</td>
      <td style="text-align:right;font-weight:500;">${fmt(d.importe_total)}</td>
    </tr>`).join('');

  document.getElementById('recv-detalle-total').textContent = fmt(recv.total_costo);
  document.getElementById('modal-recv-detalle').classList.remove('hidden');
}

// ── Event listeners: recepciones ──────────────────────────────

document.getElementById('recv-proveedor').addEventListener('change', () => {
  const provId = parseInt(document.getElementById('recv-proveedor').value) || null;
  poblarSelectPedidos(provId);
});

document.getElementById('recv-pedido').addEventListener('change', onPedidoChange);

document.getElementById('btn-agregar-linea').addEventListener('click', () => agregarLinea());

document.getElementById('btn-confirmar-recv').addEventListener('click', confirmarRecepcion);

// Delegación: input en columna artículo → autocomplete
document.getElementById('lineas-recepcion').addEventListener('input', e => {
  const inp = e.target.closest('input[data-field="art-nombre"]');
  if (!inp) return;
  const lid = parseInt(inp.dataset.lineId, 10);
  dropdownLineId = lid;
  clearTimeout(timerBusqRecv);
  const q = inp.value.trim();
  const linea = lineasRecepcion.find(l => l._id === lid);
  if (linea) {
    linea.descripcion = inp.value; // actualiza descripción libre en tiempo real
    if (!q) { linea.articulo_id = null; cerrarDropdownRecv(); return; }
  }
  timerBusqRecv = setTimeout(() => {
    const activeInp = document.querySelector(`input[data-field="art-nombre"][data-line-id="${lid}"]`);
    if (activeInp) buscarArticuloRecv(q, activeInp);
  }, 260);
});

// Delegación: change en cantidad/costo → recalcular importe
document.getElementById('lineas-recepcion').addEventListener('change', e => {
  const inp = e.target.closest('input[data-field="cantidad"], input[data-field="costo"]');
  if (!inp) return;
  const lid   = parseInt(inp.dataset.lineId, 10);
  const linea = lineasRecepcion.find(l => l._id === lid);
  if (!linea) return;
  if (inp.dataset.field === 'cantidad') linea.cantidad       = parseFloat(inp.value) || 0;
  if (inp.dataset.field === 'costo')    linea.costo_unitario = parseFloat(inp.value) || 0;
  linea.importe_total = linea.cantidad * linea.costo_unitario;
  const row = document.querySelector(`tr[data-line-id="${lid}"]`);
  if (row) {
    const importeEl = row.querySelector('[data-field="importe"]');
    if (importeEl) importeEl.textContent = fmt(linea.importe_total);
  }
  actualizarTotalRecv();
});

// Delegación: eliminar línea
document.getElementById('lineas-recepcion').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action="del-linea"]');
  if (!btn) return;
  eliminarLinea(parseInt(btn.dataset.lineId, 10));
});

// Cerrar dropdown cuando la columna artículo pierde foco
document.getElementById('lineas-recepcion').addEventListener('focusout', e => {
  if (!e.target.closest('[data-field="art-nombre"]')) return;
  setTimeout(cerrarDropdownRecv, 160);
});

// Dropdown: seleccionar artículo (mousedown para evitar blur antes del click)
document.getElementById('recv-art-dropdown').addEventListener('mousedown', e => {
  e.preventDefault();
  const opt = e.target.closest('.recv-art-option');
  if (!opt || dropdownLineId === null) return;
  const art = articulosBusqRecv.find(a => a.id === parseInt(opt.dataset.artId, 10));
  if (art) seleccionarArticuloRecv(art, dropdownLineId);
  cerrarDropdownRecv();
});

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', e => {
  const dropdown = document.getElementById('recv-art-dropdown');
  if (!dropdown || dropdown.style.display === 'none') return;
  if (!e.target.closest('#recv-art-dropdown') && !e.target.closest('[data-field="art-nombre"]')) {
    cerrarDropdownRecv();
  }
});

// Historial: click en item → abrir detalle
document.getElementById('historial-recepciones').addEventListener('click', e => {
  const item = e.target.closest('.recv-historial-item');
  if (!item) return;
  abrirDetalleRecepcion(parseInt(item.dataset.recvId, 10));
});

// Modal detalle: cerrar
['btn-cerrar-recv-detalle', 'btn-cerrar-recv-detalle-2'].forEach(btnId => {
  document.getElementById(btnId).addEventListener('click', () => {
    document.getElementById('modal-recv-detalle').classList.add('hidden');
  });
});
document.getElementById('modal-recv-detalle').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-recv-detalle'))
    document.getElementById('modal-recv-detalle').classList.add('hidden');
});
