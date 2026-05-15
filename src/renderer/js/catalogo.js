// Módulo Catálogo — ABM de artículos

// ── Estado ────────────────────────────────────────────────────
let articulos  = [];
let editandoId = null;   // null → modo crear, number → modo editar

// ── Refs DOM ──────────────────────────────────────────────────
const tabla        = document.getElementById('tabla-articulos');
const inputBusq    = document.getElementById('busqueda');
const modal        = document.getElementById('modal');
const modalTitulo  = document.getElementById('modal-titulo');
const form         = document.getElementById('form-articulo');
const errorMsg     = document.getElementById('error-msg');
const modalConfirm = document.getElementById('modal-confirm');
const confirmNombre = document.getElementById('confirm-nombre');

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', cargarArticulos);

inputBusq.addEventListener('input', () => renderTabla(filtrar(inputBusq.value)));

document.getElementById('btn-nuevo').addEventListener('click', abrirModalNuevo);
document.getElementById('btn-cancelar-modal').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar-confirm').addEventListener('click', cerrarConfirm);
form.addEventListener('submit', guardar);

// Cerrar modales al hacer clic en el fondo
modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
modalConfirm.addEventListener('click', e => { if (e.target === modalConfirm) cerrarConfirm(); });

// Delegación de eventos en la tabla (editar / eliminar)
tabla.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id     = parseInt(btn.dataset.id, 10);
  const action = btn.dataset.action;
  if (action === 'editar')   abrirModalEdicion(id);
  if (action === 'eliminar') abrirConfirm(id);
});

// ── Carga de datos ────────────────────────────────────────────
async function cargarArticulos() {
  articulos = await window.api.articulos.getAll();
  renderTabla(filtrar(inputBusq.value));
}

// ── Filtro ────────────────────────────────────────────────────
function filtrar(q) {
  const term = q.trim().toLowerCase();
  if (!term) return articulos;
  return articulos.filter(a =>
    a.nombre.toLowerCase().includes(term) ||
    a.codigo.toLowerCase().includes(term)
  );
}

// ── Render tabla ──────────────────────────────────────────────
function renderTabla(lista) {
  if (lista.length === 0) {
    const msg = inputBusq.value.trim()
      ? 'Sin resultados para la búsqueda'
      : 'No hay artículos cargados. Creá el primero con "+ Nuevo artículo".';
    tabla.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">${msg}</td></tr>`;
    return;
  }

  tabla.innerHTML = lista.map(a => {
    const bajstock = Number(a.stock_actual) <= Number(a.stock_minimo);
    const rowCls   = bajstock ? 'bg-red-50' : 'hover:bg-gray-50';
    const stockCls = bajstock ? 'text-red-600 font-bold' : 'text-gray-700';

    return `
      <tr class="${rowCls} transition-colors">
        <td class="px-4 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">${esc(a.codigo)}</td>
        <td class="px-4 py-2.5">
          <span class="font-medium">${esc(a.nombre)}</span>
          ${bajstock ? '<span class="ml-2 text-xs font-semibold text-red-500">&#9888; Stock bajo</span>' : ''}
        </td>
        <td class="px-4 py-2.5 text-right text-gray-500 whitespace-nowrap">${fmt(a.costo_unitario)}</td>
        <td class="px-4 py-2.5 text-right font-semibold whitespace-nowrap">${fmt(a.precio_unitario)}</td>
        <td class="px-4 py-2.5 text-right whitespace-nowrap ${stockCls}">${fmtNum(a.stock_actual)}</td>
        <td class="px-4 py-2.5 text-right text-gray-500 whitespace-nowrap">${fmtNum(a.stock_minimo)}</td>
        <td class="px-4 py-2.5 text-gray-500 text-sm">${esc(a.proveedor || '—')}</td>
        <td class="px-4 py-2.5 text-center whitespace-nowrap">
          <button data-action="editar"   data-id="${a.id}"
            class="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3 hover:underline">
            Editar
          </button>
          <button data-action="eliminar" data-id="${a.id}"
            class="text-red-500 hover:text-red-700 text-xs font-medium hover:underline">
            Eliminar
          </button>
        </td>
      </tr>`;
  }).join('');
}

// ── Modal ABM ─────────────────────────────────────────────────
function abrirModalNuevo() {
  editandoId = null;
  modalTitulo.textContent = 'Nuevo artículo';
  form.reset();
  // Valores por defecto para campos numéricos
  form.costo_unitario.value = '0';
  form.stock_actual.value   = '0';
  form.stock_minimo.value   = '0';
  ocultarError();
  modal.classList.remove('hidden');
  form.codigo.focus();
}

function abrirModalEdicion(id) {
  const a = articulos.find(x => x.id === id);
  if (!a) return;

  editandoId = id;
  modalTitulo.textContent = 'Editar artículo';
  ocultarError();

  form.codigo.value          = a.codigo          ?? '';
  form.nombre.value          = a.nombre          ?? '';
  form.descripcion.value     = a.descripcion     ?? '';
  form.costo_unitario.value  = a.costo_unitario  ?? 0;
  form.precio_unitario.value = a.precio_unitario ?? '';
  form.stock_actual.value    = a.stock_actual    ?? 0;
  form.stock_minimo.value    = a.stock_minimo    ?? 0;
  form.proveedor.value       = a.proveedor       ?? '';

  modal.classList.remove('hidden');
  form.nombre.focus();
}

function cerrarModal() {
  modal.classList.add('hidden');
  form.reset();
  ocultarError();
  editandoId = null;
}

// ── Guardar ───────────────────────────────────────────────────
async function guardar(e) {
  e.preventDefault();
  ocultarError();

  const data = {
    codigo:          form.codigo.value.trim().toUpperCase(),
    nombre:          form.nombre.value.trim(),
    descripcion:     form.descripcion.value.trim() || null,
    costo_unitario:  parsearNumero(form.costo_unitario.value, 0),
    precio_unitario: parsearNumero(form.precio_unitario.value, null),
    stock_actual:    parsearNumero(form.stock_actual.value, 0),
    stock_minimo:    parsearNumero(form.stock_minimo.value, 0),
    proveedor:       form.proveedor.value.trim() || null,
  };

  // Validaciones de negocio
  if (!data.codigo)
    return mostrarError('El código es obligatorio.');
  if (!data.nombre)
    return mostrarError('El nombre es obligatorio.');
  if (data.precio_unitario === null || !(data.precio_unitario > 0))
    return mostrarError('El precio de venta debe ser mayor a 0.');
  if (data.stock_actual < 0)
    return mostrarError('El stock actual no puede ser negativo.');
  if (data.stock_minimo < 0)
    return mostrarError('El stock mínimo no puede ser negativo.');

  // Validar código único (excluye el propio artículo al editar)
  const existente = await window.api.articulos.getByCodigo(data.codigo);
  if (existente && existente.id !== editandoId)
    return mostrarError(`El código "${data.codigo}" ya está en uso por otro artículo.`);

  bloquearFormulario(true);
  try {
    if (editandoId !== null) {
      await window.api.articulos.update(editandoId, data);
    } else {
      await window.api.articulos.create(data);
    }
    cerrarModal();
    await cargarArticulos();
  } catch (err) {
    mostrarError('Error al guardar: ' + (err.message || err));
  } finally {
    bloquearFormulario(false);
  }
}

// ── Eliminar ──────────────────────────────────────────────────
function abrirConfirm(id) {
  const a = articulos.find(x => x.id === id);
  if (!a) return;

  confirmNombre.textContent = a.nombre;

  const btnConfirmar = document.getElementById('btn-confirmar-eliminar');
  // Reemplazar el botón para limpiar listeners previos
  const clone = btnConfirmar.cloneNode(true);
  btnConfirmar.parentNode.replaceChild(clone, btnConfirmar);
  clone.addEventListener('click', async () => {
    cerrarConfirm();
    await window.api.articulos.delete(id);
    await cargarArticulos();
  });

  modalConfirm.classList.remove('hidden');
}

function cerrarConfirm() {
  modalConfirm.classList.add('hidden');
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
  }).format(n ?? 0);
}

function fmtNum(n) {
  const num = parseFloat(n) || 0;
  // Mostrar sin decimales si es entero, con hasta 3 si no
  return num % 1 === 0 ? String(num) : num.toFixed(3).replace(/\.?0+$/, '');
}

function parsearNumero(val, fallback) {
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? fallback : n;
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
