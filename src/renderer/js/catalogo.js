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
const LABEL_UNIDAD = {
  unidad: 'Unidad', kg: 'kg', g: 'g', litro: 'Litro', ml: 'ml',
  metro: 'Metro', cm: 'cm', docena: 'Docena', caja: 'Caja', pack: 'Pack',
};

function renderTabla(lista) {
  if (lista.length === 0) {
    const msg = inputBusq.value.trim()
      ? 'Sin resultados para la búsqueda'
      : 'No hay artículos cargados. Creá el primero con "+ Nuevo artículo".';
    tabla.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-gray-400">${msg}</td></tr>`;
    return;
  }

  tabla.innerHTML = lista.map(a => {
    const bajstock  = Number(a.stock_actual) <= Number(a.stock_minimo);
    const rowCls    = bajstock ? 'bg-red-50' : 'hover:bg-gray-50';
    const stockCls  = bajstock ? 'text-red-600 font-bold' : 'text-gray-700';
    const unidadLabel = LABEL_UNIDAD[a.unidad_medida] || a.unidad_medida || 'Unidad';

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
        <td class="px-4 py-2.5 text-gray-500 text-sm whitespace-nowrap">${esc(unidadLabel)}</td>
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
  form.costo_unitario.value = '0';
  form.stock_actual.value   = '0';
  form.stock_minimo.value   = '0';
  form.unidad_medida.value  = 'unidad';
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
  form.unidad_medida.value   = a.unidad_medida   ?? 'unidad';

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
    unidad_medida:   form.unidad_medida.value || 'unidad',
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

// ── Importar Excel ────────────────────────────────────────────
let importRows    = [];
let importHeaders = [];

const inputExcel  = document.getElementById('input-excel');
const modalImport = document.getElementById('modal-import');
const importStatus = document.getElementById('import-status');

document.getElementById('btn-importar-excel').addEventListener('click', () => inputExcel.click());
inputExcel.addEventListener('change', leerExcel);
document.getElementById('btn-cancelar-import').addEventListener('click', cerrarModalImport);
document.getElementById('btn-close-import').addEventListener('click', cerrarModalImport);
document.getElementById('btn-ejecutar-import').addEventListener('click', ejecutarImport);
modalImport.addEventListener('click', e => { if (e.target === modalImport) cerrarModalImport(); });

['map-codigo', 'map-nombre', 'map-precio', 'map-costo', 'map-stock'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderPreview);
});

function cerrarModalImport() {
  modalImport.classList.add('hidden');
  inputExcel.value = '';
  importRows = [];
  importHeaders = [];
  document.getElementById('import-step-mapeo').classList.add('hidden');
  document.getElementById('import-step-vacio').style.display = '';
  document.getElementById('btn-ejecutar-import').classList.add('hidden');
  importStatus.classList.add('hidden');
}

function leerExcel(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    alert('La librería XLSX no está disponible. Verificá tu conexión a internet.');
    return;
  }

  const reader = new FileReader();
  reader.onload = evt => {
    const wb   = XLSX.read(evt.target.result, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (!data || data.length < 2) {
      alert('El archivo no tiene datos suficientes (se necesita al menos una fila de encabezado y una de datos).');
      return;
    }

    importHeaders = data[0].map(h => String(h ?? ''));
    importRows    = data.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''));

    if (importRows.length === 0) {
      alert('El archivo no tiene filas con datos.');
      return;
    }

    rellenarSelectsMapeo();
    autoDetectColumns();
    renderPreview();

    document.getElementById('import-step-vacio').style.display = 'none';
    document.getElementById('import-step-mapeo').classList.remove('hidden');
    document.getElementById('btn-ejecutar-import').classList.remove('hidden');
    importStatus.classList.add('hidden');
    modalImport.classList.remove('hidden');
  };
  reader.readAsArrayBuffer(file);
}

function rellenarSelectsMapeo() {
  const ningunaOpt = '<option value="-1">— No usar —</option>';
  const colOpts = importHeaders.map((h, i) =>
    `<option value="${i}">${esc(h || `Columna ${i + 1}`)}</option>`
  ).join('');

  ['map-codigo', 'map-nombre', 'map-precio', 'map-costo', 'map-stock'].forEach(id => {
    document.getElementById(id).innerHTML = ningunaOpt + colOpts;
    document.getElementById(id).value = '-1';
  });
}

function autoDetectColumns() {
  const KEYWORDS = {
    'map-codigo': ['codigo', 'code', 'cod', 'sku', 'id'],
    'map-nombre': ['nombre', 'name', 'descripcion', 'producto', 'articulo', 'item'],
    'map-precio': ['precio', 'price', 'venta', 'pvp', 'precio_venta', 'p_venta'],
    'map-costo':  ['costo', 'cost', 'compra', 'precio_costo', 'p_costo'],
    'map-stock':  ['stock', 'cantidad', 'existencia', 'qty', 'inventario'],
  };
  for (const [selId, kws] of Object.entries(KEYWORDS)) {
    const idx = importHeaders.findIndex(h =>
      kws.some(kw => h.toLowerCase().includes(kw))
    );
    if (idx >= 0) document.getElementById(selId).value = String(idx);
  }
}

function renderPreview() {
  const preview = importRows.slice(0, 5);
  const thead = `<thead><tr>${importHeaders.map(h =>
    `<th style="white-space:nowrap;">${esc(h)}</th>`
  ).join('')}</tr></thead>`;
  const tbody = `<tbody>${preview.map(row =>
    `<tr>${importHeaders.map((_, i) =>
      `<td style="white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;">${esc(String(row[i] ?? ''))}</td>`
    ).join('')}</tr>`
  ).join('')}</tbody>`;
  document.getElementById('tabla-preview').innerHTML = thead + tbody;
}

async function ejecutarImport() {
  const colCodigo = parseInt(document.getElementById('map-codigo').value, 10);
  const colNombre = parseInt(document.getElementById('map-nombre').value, 10);
  const colPrecio = parseInt(document.getElementById('map-precio').value, 10);
  const colCosto  = parseInt(document.getElementById('map-costo').value,  10);
  const colStock  = parseInt(document.getElementById('map-stock').value,  10);

  if (colCodigo < 0) { mostrarErrorImport('Debés mapear la columna "Código".'); return; }
  if (colNombre < 0) { mostrarErrorImport('Debés mapear la columna "Nombre".'); return; }

  const btnImp = document.getElementById('btn-ejecutar-import');
  btnImp.disabled = true;
  btnImp.textContent = 'Importando...';
  importStatus.classList.remove('hidden');

  let nuevos = 0, actualizados = 0, errores = 0;

  for (let i = 0; i < importRows.length; i++) {
    const row    = importRows[i];
    const codigo = String(row[colCodigo] ?? '').trim().toUpperCase();
    const nombre = String(row[colNombre] ?? '').trim();

    importStatus.textContent = `Procesando fila ${i + 1} de ${importRows.length}…`;

    if (!codigo || !nombre) { errores++; continue; }

    const precio = colPrecio >= 0 ? parsearNumero(String(row[colPrecio] ?? ''), null) : null;
    const costo  = colCosto  >= 0 ? parsearNumero(String(row[colCosto]  ?? ''), 0)    : 0;
    const stock  = colStock  >= 0 ? parsearNumero(String(row[colStock]  ?? ''), 0)    : 0;

    try {
      const existente = await window.api.articulos.getByCodigo(codigo);
      if (existente) {
        const upd = { nombre };
        if (precio !== null && precio > 0) upd.precio_unitario = precio;
        if (colCosto >= 0)  upd.costo_unitario = costo;
        if (colStock >= 0)  upd.stock_actual   = stock;
        await window.api.articulos.update(existente.id, upd);
        actualizados++;
      } else {
        if (precio === null || precio <= 0) { errores++; continue; }
        await window.api.articulos.create({
          codigo,
          nombre,
          precio_unitario: precio,
          costo_unitario:  costo,
          stock_actual:    stock,
          stock_minimo:    0,
          unidad_medida:   'unidad',
        });
        nuevos++;
      }
    } catch {
      errores++;
    }
  }

  importStatus.innerHTML = `
    <div style="padding:10px 14px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:var(--r-in);line-height:1.7;">
      Importación finalizada:<br>
      <strong>${nuevos}</strong> artículos nuevos &nbsp;·&nbsp;
      <strong>${actualizados}</strong> actualizados &nbsp;·&nbsp;
      <strong style="color:#fca5a5;">${errores}</strong> filas con error
    </div>`;

  btnImp.disabled = false;
  btnImp.textContent = 'Importar de nuevo';
  await cargarArticulos();
}

function mostrarErrorImport(msg) {
  importStatus.classList.remove('hidden');
  importStatus.innerHTML = `<div style="padding:8px 12px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:var(--r-in);color:#fca5a5;">${esc(msg)}</div>`;
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
