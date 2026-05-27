// Módulo Catálogo — ABM artículos, departamentos, kits

// ── Estado ────────────────────────────────────────────────────
let articulos     = [];
let departamentos = [];
let editandoId    = null;
let modoNegocio   = '';
let filtroDepto   = 'todos'; // 'todos' | 0 (sin depto) | id
let filtroStockBajo = false;
let modoSeleccion   = false;
let seleccionados   = new Set();
let kitComponentes  = [];    // { componente_id, nombre, cantidad }
let kitCompSeleccionado = null; // { id, nombre }
let ajustandoId     = null;
let ajustandoStock  = 0;
let promosActuales  = [];    // reglas de promo del artículo que se está editando
let promosBodyOpen  = false;

const MODOS_IVA_PRODUCTO = new Set(['responsable_inscripto', 'farmacia']);

const LABEL_UNIDAD = {
  unidad: 'Unidad', kg: 'kg', g: 'g', litro: 'Litro', ml: 'ml',
  metro: 'Metro', cm: 'cm', docena: 'Docena', caja: 'Caja', pack: 'Pack',
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  [modoNegocio, articulos, departamentos] = await Promise.all([
    window.api.config.get('modo_negocio').then(v => v || ''),
    window.api.articulos.getAll(),
    window.api.departamentos.getAll(),
  ]);
  renderChipsDepto();
  renderTabla(filtrarArticulos());
  poblarSelectDepartamento();
  bindEventos();
  document.getElementById('busqueda').focus();
});

// ── Bind de eventos ───────────────────────────────────────────
function bindEventos() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Tab artículos
  document.getElementById('busqueda').addEventListener('input', () => renderTabla(filtrarArticulos()));
  document.getElementById('btn-nuevo').addEventListener('click', abrirModalNuevo);
  document.getElementById('btn-exportar-csv').addEventListener('click', exportarCSV);
  document.getElementById('btn-toggle-stock-bajo').addEventListener('click', toggleStockBajo);
  document.getElementById('btn-modo-seleccion').addEventListener('click', toggleModoSeleccion);
  document.getElementById('btn-cancelar-seleccion').addEventListener('click', cancelarSeleccion);
  document.getElementById('btn-bulk-eliminar').addEventListener('click', bulkEliminar);
  document.getElementById('btn-bulk-depto').addEventListener('click', e => {
    e.stopPropagation();
    toggleBulkDeptoDropdown();
  });

  // Tab kits
  document.getElementById('btn-nuevo-kit').addEventListener('click', abrirModalNuevoKit);
  document.getElementById('busqueda-kits').addEventListener('input', renderKits);

  // Modal artículo
  document.getElementById('btn-cancelar-modal').addEventListener('click', cerrarModal);
  document.getElementById('form-articulo').addEventListener('submit', guardar);

  // Modal confirmar
  document.getElementById('btn-cancelar-confirm').addEventListener('click', () =>
    document.getElementById('modal-confirm').classList.add('hidden')
  );

  // Modal confirm bulk
  document.getElementById('btn-cancelar-bulk-confirm').addEventListener('click', () =>
    document.getElementById('modal-confirm-bulk').classList.add('hidden')
  );

  // Kit checkboxes & es_kit toggle
  document.getElementById('chk-es-kit').addEventListener('change', e => {
    document.getElementById('seccion-kit').style.display = e.target.checked ? '' : 'none';
    if (e.target.checked) renderKitComponentes();
  });

  // Kit buscar componente
  document.getElementById('kit-buscar-comp').addEventListener('input', buscarKitComp);
  document.getElementById('kit-buscar-comp').addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarKitDropdown();
  });
  document.getElementById('kit-search-dropdown').addEventListener('click', e => {
    const item = e.target.closest('[data-kit-id]');
    if (!item) return;
    kitCompSeleccionado = { id: parseInt(item.dataset.kitId), nombre: item.dataset.kitNombre };
    document.getElementById('kit-buscar-comp').value = item.dataset.kitNombre;
    cerrarKitDropdown();
  });
  window.bindDropdownKeyboard({
    inputEl:   document.getElementById('kit-buscar-comp'),
    dropdownId:'kit-search-dropdown',
    optSel:    '[data-kit-id]',
    onSelect:  item => {
      kitCompSeleccionado = { id: parseInt(item.dataset.kitId), nombre: item.dataset.kitNombre };
      document.getElementById('kit-buscar-comp').value = item.dataset.kitNombre;
      cerrarKitDropdown();
    },
    onClose: cerrarKitDropdown,
  });
  document.getElementById('btn-agregar-comp').addEventListener('click', agregarKitComp);
  document.getElementById('kit-comp-cantidad').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); agregarKitComp(); }
  });

  // Importar Excel
  document.getElementById('btn-importar-excel').addEventListener('click', () =>
    document.getElementById('input-excel').click()
  );
  document.getElementById('input-excel').addEventListener('change', leerExcel);
  document.getElementById('btn-cancelar-import').addEventListener('click', cerrarModalImport);
  document.getElementById('btn-close-import').addEventListener('click', cerrarModalImport);
  document.getElementById('btn-ejecutar-import').addEventListener('click', ejecutarImport);
  ['map-codigo','map-nombre','map-precio','map-costo','map-mayoreo','map-stock','map-stock-min','map-departamento'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      autoDetectadosIds.delete(id);
      renderPreview();
    });
  });

  // Botón Gestionar departamentos
  document.getElementById('btn-gestionar-deptos').addEventListener('click', () => switchTab('departamentos'));

  // Botón Promociones
  document.getElementById('btn-promociones').addEventListener('click', abrirModalPromos);
  bindPromoGlobalForm();

  // Departamento color preview
  document.getElementById('depto-color').addEventListener('input', e => {
    document.getElementById('depto-color-hex').textContent = e.target.value;
  });

  // Form departamento
  document.getElementById('form-depto').addEventListener('submit', guardarDepto);
  document.getElementById('btn-cancelar-depto').addEventListener('click', cancelarEditDepto);

  // Cerrar dropdown bulk depto y kit al hacer click fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-bulk-depto'))
      document.getElementById('bulk-depto-dropdown').style.display = 'none';
    if (!e.target.closest('#kit-buscar-comp') && !e.target.closest('#kit-search-dropdown'))
      cerrarKitDropdown();
  });

  // Modal ajuste stock
  document.getElementById('ajuste-cat-tipo').addEventListener('change', actualizarPreviewAjuste);
  document.getElementById('ajuste-cat-cantidad').addEventListener('input', actualizarPreviewAjuste);
  document.getElementById('ajuste-cat-cantidad').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmarAjuste(); }
  });
  document.getElementById('btn-confirmar-ajuste').addEventListener('click', confirmarAjuste);

  // Promociones
  document.getElementById('btn-toggle-promos').addEventListener('click', togglePromosBody);
  document.getElementById('btn-agregar-promo').addEventListener('click', agregarPromo);

  // Delegación tabla artículos
  document.getElementById('tabla-articulos').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.action === 'editar')   abrirModalEdicion(id);
    if (btn.dataset.action === 'eliminar') abrirConfirm(id);
    if (btn.dataset.action === 'ajustar')  abrirModalAjuste(id);
    if (btn.dataset.action === 'toggle-chk') toggleSeleccion(id);
  });

  // Delegación tabla — checkbox click
  document.getElementById('tabla-articulos').addEventListener('change', e => {
    if (e.target.dataset.chk) toggleSeleccion(parseInt(e.target.dataset.chk, 10));
  });

  // Doble click en fila → editar artículo (excepto en modo selección o botones)
  document.getElementById('tabla-articulos').addEventListener('dblclick', e => {
    if (modoSeleccion) return;
    if (e.target.closest('button') || e.target.closest('input')) return;
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    abrirModalEdicion(parseInt(row.dataset.id, 10));
  });
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => {
    el.style.display = 'none';
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === name;
    btn.style.color        = active ? 'var(--text)'         : 'var(--text-subtle)';
    btn.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    btn.classList.toggle('active', active);
  });

  const panel = document.getElementById(`tab-${name}`);
  panel.style.display = 'flex';

  document.getElementById('header-btns-articulos').style.display = name === 'articulos' ? '' : 'none';

  if (name === 'departamentos') renderDepartamentos();
  if (name === 'kits')          renderKits();
}

// ── Tab 1: Artículos ──────────────────────────────────────────
async function recargarArticulos() {
  articulos = await window.api.articulos.getAll();
  renderTabla(filtrarArticulos());
}

async function recargarDepto() {
  departamentos = await window.api.departamentos.getAll();
  renderChipsDepto();
  poblarSelectDepartamento();
}

function filtrarArticulos() {
  let lista = articulos;
  const q = document.getElementById('busqueda').value.trim().toLowerCase();

  if (q) lista = lista.filter(a =>
    a.nombre.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q)
  );

  if (filtroDepto === 0) {
    lista = lista.filter(a => !a.departamento_id);
  } else if (filtroDepto !== 'todos') {
    lista = lista.filter(a => a.departamento_id === filtroDepto);
  }

  if (filtroStockBajo) {
    lista = lista.filter(a => a.usa_inventario && Number(a.stock_actual) <= Number(a.stock_minimo));
  }

  return lista;
}

function toggleStockBajo() {
  filtroStockBajo = !filtroStockBajo;
  const btn = document.getElementById('btn-toggle-stock-bajo');
  btn.style.background  = filtroStockBajo ? 'rgba(239,68,68,.15)' : '';
  btn.style.color       = filtroStockBajo ? '#fca5a5'             : '';
  btn.style.borderColor = filtroStockBajo ? 'rgba(239,68,68,.4)'  : '';
  renderTabla(filtrarArticulos());
}

function renderChipsDepto() {
  const wrap = document.getElementById('chips-departamentos');
  const activo = filtroDepto;

  const chips = [
    { key: 'todos', label: 'Todos', color: null },
    { key: 0,       label: 'Sin departamento', color: null },
    ...departamentos.map(d => ({ key: d.id, label: d.nombre, color: d.color })),
  ];

  wrap.innerHTML = chips.map(c => {
    const isActive = c.key === activo;
    const dot = c.color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color};margin-right:4px;vertical-align:middle;"></span>` : '';
    return `<button class="chip-depto${isActive ? ' active' : ''}" data-depto="${c.key}"
      style="padding:3px 10px;border-radius:20px;font-size:12px;cursor:pointer;white-space:nowrap;
        border:1px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
        background:${isActive ? 'var(--accent)' : 'transparent'};
        color:${isActive ? '#fff' : 'var(--text-muted)'};"
    >${dot}${esc(c.label)}</button>`;
  }).join('');

  wrap.querySelectorAll('.chip-depto').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.depto;
      filtroDepto = val === 'todos' ? 'todos' : parseInt(val) || 0;
      renderChipsDepto();
      renderTabla(filtrarArticulos());
    });
  });
}

function poblarSelectDepartamento() {
  const sel = document.getElementById('select-departamento');
  sel.innerHTML = '<option value="">— Sin departamento —</option>' +
    departamentos.map(d =>
      `<option value="${d.id}">${esc(d.nombre)}</option>`
    ).join('');
}

function renderTabla(lista) {
  const tabla = document.getElementById('tabla-articulos');
  const chkTh = document.getElementById('th-chk');
  chkTh.style.display = modoSeleccion ? '' : 'none';

  if (lista.length === 0) {
    const msg = document.getElementById('busqueda').value.trim()
      ? 'Sin resultados para la búsqueda.'
      : 'No hay artículos. Creá el primero con "+ Nuevo artículo".';
    tabla.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-subtle);padding:32px 0;">${msg}</td></tr>`;
    return;
  }

  tabla.innerHTML = lista.map(a => {
    const bajstock = a.usa_inventario && Number(a.stock_actual) <= Number(a.stock_minimo);
    const unidadLabel = LABEL_UNIDAD[a.unidad_medida] || a.unidad_medida || 'Unidad';
    const deptoChip = a.departamento_nombre
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:10px;font-size:11px;background:${a.departamento_color || '#6b7280'}22;color:${a.departamento_color || '#6b7280'};border:1px solid ${a.departamento_color || '#6b7280'}44;">
          <span style="width:6px;height:6px;border-radius:50%;background:${a.departamento_color || '#6b7280'};display:inline-block;"></span>
          ${esc(a.departamento_nombre)}</span>`
      : '<span style="color:var(--text-subtle);font-size:11px;">—</span>';
    const kitBadge = a.es_kit
      ? '<span style="margin-left:4px;font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(139,92,246,.2);color:#a78bfa;border:1px solid rgba(139,92,246,.3);">kit</span>'
      : '';
    const noInvBadge = !a.usa_inventario
      ? '<span style="margin-left:4px;font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(107,114,128,.2);color:var(--text-subtle);">libre</span>'
      : '';
    const chkCell = modoSeleccion
      ? `<td style="padding:0 8px;"><input type="checkbox" data-chk="${a.id}" ${seleccionados.has(a.id) ? 'checked' : ''} style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;"></td>`
      : '';

    return `
      <tr data-id="${a.id}" style="${bajstock ? 'background:rgba(239,68,68,.06);' : ''}${modoSeleccion ? '' : 'cursor:pointer;'}">
        ${chkCell}
        <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:var(--text-subtle);white-space:nowrap;">${esc(a.codigo)}</td>
        <td style="padding:8px 10px;">
          <span style="font-weight:500;">${esc(a.nombre)}</span>${kitBadge}${noInvBadge}
          ${bajstock ? '<span style="margin-left:6px;font-size:11px;color:#fca5a5;font-weight:600;">↓ stock bajo</span>' : ''}
        </td>
        <td style="padding:8px 10px;">${deptoChip}</td>
        <td style="padding:8px 10px;text-align:right;color:var(--text-subtle);white-space:nowrap;font-size:12px;">${fmt(a.costo_unitario)}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:600;white-space:nowrap;">${fmt(a.precio_unitario)}</td>
        <td style="padding:8px 10px;text-align:right;white-space:nowrap;${bajstock ? 'color:#fca5a5;font-weight:700;' : ''}">${a.usa_inventario ? fmtNum(a.stock_actual) : '—'}</td>
        <td style="padding:8px 10px;text-align:right;color:var(--text-subtle);white-space:nowrap;font-size:12px;">${a.usa_inventario ? fmtNum(a.stock_minimo) : '—'}</td>
        <td style="padding:8px 10px;color:var(--text-subtle);font-size:12px;white-space:nowrap;">${esc(unidadLabel)}</td>
        <td style="padding:8px 10px;text-align:center;white-space:nowrap;">
          <button data-action="editar" data-id="${a.id}" style="font-size:12px;color:var(--accent);background:none;border:none;cursor:pointer;padding:2px 6px;">Editar</button>
          ${a.usa_inventario ? `<button data-action="ajustar" data-id="${a.id}" style="font-size:12px;color:#a78bfa;background:none;border:none;cursor:pointer;padding:2px 6px;">Ajustar</button>` : ''}
          <button data-action="eliminar" data-id="${a.id}" style="font-size:12px;color:var(--danger);background:none;border:none;cursor:pointer;padding:2px 6px;">Eliminar</button>
        </td>
      </tr>`;
  }).join('');
}

// ── Modo selección ────────────────────────────────────────────
function toggleModoSeleccion() {
  modoSeleccion = !modoSeleccion;
  seleccionados.clear();
  const btn = document.getElementById('btn-modo-seleccion');
  btn.textContent = modoSeleccion ? 'Cancelar selección' : 'Seleccionar';
  document.getElementById('panel-bulk').style.display = modoSeleccion ? 'flex' : 'none';
  actualizarBulkCount();
  renderTabla(filtrarArticulos());
}

function cancelarSeleccion() {
  if (modoSeleccion) toggleModoSeleccion();
}

function toggleSeleccion(id) {
  if (seleccionados.has(id)) seleccionados.delete(id);
  else seleccionados.add(id);
  actualizarBulkCount();
  renderTabla(filtrarArticulos());
}

function actualizarBulkCount() {
  document.getElementById('bulk-count').textContent =
    seleccionados.size === 1 ? '1 seleccionado' : `${seleccionados.size} seleccionados`;
}

function toggleBulkDeptoDropdown() {
  const dd = document.getElementById('bulk-depto-dropdown');
  if (dd.style.display !== 'none') { dd.style.display = 'none'; return; }

  const items = [
    { id: null, nombre: '— Sin departamento —' },
    ...departamentos,
  ];
  dd.innerHTML = items.map(d => `
    <div data-depto-id="${d.id ?? ''}"
      style="padding:8px 14px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border);color:var(--text);">
      ${d.color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${d.color};margin-right:6px;"></span>` : ''}
      ${esc(d.nombre)}
    </div>`).join('');
  dd.style.display = 'block';

  dd.querySelectorAll('[data-depto-id]').forEach(el => {
    el.addEventListener('click', async () => {
      dd.style.display = 'none';
      const deptoId = el.dataset.deptoId === '' ? null : parseInt(el.dataset.deptoId);
      for (const id of seleccionados) {
        await window.api.articulos.update(id, { departamento_id: deptoId });
      }
      articulos = await window.api.articulos.getAll();
      renderTabla(filtrarArticulos());
      cancelarSeleccion();
      toast(`Departamento actualizado en ${seleccionados.size > 0 ? seleccionados.size : 'los'} artículos.`);
    });
  });
}

function bulkEliminar() {
  if (seleccionados.size === 0) return;
  const n = seleccionados.size;
  document.getElementById('confirm-bulk-msg').innerHTML =
    `¿Eliminar <strong>${n} artículo${n > 1 ? 's' : ''}</strong>? Esta acción no se puede deshacer.`;
  document.getElementById('modal-confirm-bulk').classList.remove('hidden');

  const btn = document.getElementById('btn-confirmar-bulk-eliminar');
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener('click', async () => {
    document.getElementById('modal-confirm-bulk').classList.add('hidden');
    for (const id of seleccionados) await window.api.articulos.delete(id);
    articulos = await window.api.articulos.getAll();
    renderTabla(filtrarArticulos());
    cancelarSeleccion();
    toast(`${n} artículo${n > 1 ? 's' : ''} eliminado${n > 1 ? 's' : ''}.`, 'success');
  });
}

// ── Modal ABM artículo ────────────────────────────────────────
function abrirModalNuevo() {
  editandoId    = null;
  kitComponentes = [];
  promosActuales = [];
  document.getElementById('modal-titulo').textContent = 'Nuevo artículo';
  const form = document.getElementById('form-articulo');
  form.reset();
  form.costo_unitario.value  = '0';
  form.stock_actual.value    = '0';
  form.stock_minimo.value    = '0';
  form.precio_mayoreo.value  = '0';
  form.unidad_medida.value   = 'unidad';
  form.tasa_iva.value        = '21';
  document.getElementById('chk-usa-inventario').checked = true;
  document.getElementById('chk-es-kit').checked          = false;
  document.getElementById('seccion-kit').style.display   = 'none';
  document.getElementById('campo-tasa-iva').style.display = MODOS_IVA_PRODUCTO.has(modoNegocio) ? '' : 'none';
  poblarSelectDepartamento();
  renderKitComponentes();
  resetPromosUI(false);
  ocultarError();
  document.getElementById('modal').classList.remove('hidden');
  form.codigo.focus();
}

function abrirModalNuevoKit() {
  abrirModalNuevo();
  document.getElementById('chk-es-kit').checked        = true;
  document.getElementById('seccion-kit').style.display = '';
  document.getElementById('modal-titulo').textContent  = 'Nuevo kit';
}

async function abrirModalEdicion(id) {
  const a = articulos.find(x => x.id === id);
  if (!a) return;

  editandoId     = id;
  kitComponentes = [];
  promosActuales = [];
  document.getElementById('modal-titulo').textContent = 'Editar artículo';
  ocultarError();

  const form = document.getElementById('form-articulo');
  form.codigo.value          = a.codigo          ?? '';
  form.nombre.value          = a.nombre          ?? '';
  form.descripcion.value     = a.descripcion     ?? '';
  form.costo_unitario.value  = a.costo_unitario  ?? 0;
  form.precio_unitario.value = a.precio_unitario ?? '';
  form.precio_mayoreo.value  = a.precio_mayoreo  ?? 0;
  form.stock_actual.value    = a.stock_actual    ?? 0;
  form.stock_minimo.value    = a.stock_minimo    ?? 0;
  form.proveedor.value       = a.proveedor       ?? '';
  form.unidad_medida.value   = a.unidad_medida   ?? 'unidad';
  form.tasa_iva.value        = a.tasa_iva        ?? '21';
  document.getElementById('chk-usa-inventario').checked = !!a.usa_inventario;
  document.getElementById('chk-es-kit').checked          = !!a.es_kit;

  poblarSelectDepartamento();
  document.getElementById('select-departamento').value = a.departamento_id ?? '';

  document.getElementById('campo-tasa-iva').style.display = MODOS_IVA_PRODUCTO.has(modoNegocio) ? '' : 'none';

  if (a.es_kit) {
    document.getElementById('seccion-kit').style.display = '';
    const comps = await window.api.kits.getComponentes(id);
    kitComponentes = comps.map(c => ({
      componente_id: c.componente_id,
      nombre:        c.nombre,
      cantidad:      c.cantidad,
    }));
    renderKitComponentes();
  } else {
    document.getElementById('seccion-kit').style.display = 'none';
  }

  promosActuales = await window.api.promociones.listarPorArticulo(id);
  resetPromosUI(true);

  document.getElementById('modal').classList.remove('hidden');
  form.nombre.focus();
}

function cerrarModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('form-articulo').reset();
  ocultarError();
  editandoId     = null;
  kitComponentes = [];
  kitCompSeleccionado = null;
  promosActuales = [];
  cerrarKitDropdown();
  resetPromosUI(false);
}

async function guardar(e) {
  e.preventDefault();
  ocultarError();

  const form = document.getElementById('form-articulo');
  const data = {
    codigo:          form.codigo.value.trim().toUpperCase(),
    nombre:          form.nombre.value.trim(),
    descripcion:     form.descripcion.value.trim() || null,
    costo_unitario:  parsearNumero(form.costo_unitario.value, 0),
    precio_unitario: parsearNumero(form.precio_unitario.value, null),
    precio_mayoreo:  parsearNumero(form.precio_mayoreo.value, 0),
    stock_actual:    parsearNumero(form.stock_actual.value, 0),
    stock_minimo:    parsearNumero(form.stock_minimo.value, 0),
    proveedor:       form.proveedor.value.trim() || null,
    unidad_medida:   form.unidad_medida.value || 'unidad',
    tasa_iva:        form.tasa_iva.value || '21',
    departamento_id: parseInt(document.getElementById('select-departamento').value) || null,
    usa_inventario:  document.getElementById('chk-usa-inventario').checked ? 1 : 0,
    es_kit:          document.getElementById('chk-es-kit').checked          ? 1 : 0,
  };

  if (!data.codigo)                               return mostrarError('El código es obligatorio.');
  if (!data.nombre)                               return mostrarError('El nombre es obligatorio.');
  if (data.precio_unitario === null || !(data.precio_unitario > 0)) return mostrarError('El precio de venta debe ser mayor a 0.');
  if (data.stock_actual < 0)                      return mostrarError('El stock actual no puede ser negativo.');
  if (data.stock_minimo < 0)                      return mostrarError('El stock mínimo no puede ser negativo.');

  const existente = await window.api.articulos.getByCodigo(data.codigo);
  if (existente && existente.id !== editandoId)
    return mostrarError(`El código "${data.codigo}" ya está en uso.`);

  bloquearFormulario(true);
  try {
    let artId;
    if (editandoId !== null) {
      await window.api.articulos.update(editandoId, data);
      artId = editandoId;
    } else {
      const nuevo = await window.api.articulos.create(data);
      artId = nuevo.id;
    }

    // Guardar componentes del kit
    if (data.es_kit) {
      await window.api.kits.setComponentes(artId, kitComponentes);
    }

    cerrarModal();
    articulos = await window.api.articulos.getAll();
    renderTabla(filtrarArticulos());
    toast(editandoId !== null ? 'Artículo actualizado.' : 'Artículo creado.');
  } catch (err) {
    mostrarError('Error al guardar: ' + (err.message || err));
  } finally {
    bloquearFormulario(false);
  }
}

// ── Eliminar artículo ─────────────────────────────────────────
function abrirConfirm(id) {
  const a = articulos.find(x => x.id === id);
  if (!a) return;
  document.getElementById('confirm-titulo').textContent = 'Eliminar artículo';
  document.getElementById('confirm-nombre').textContent = a.nombre;
  document.getElementById('modal-confirm').classList.remove('hidden');

  const btn = document.getElementById('btn-confirmar-eliminar');
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener('click', async () => {
    document.getElementById('modal-confirm').classList.add('hidden');
    await window.api.articulos.delete(id);
    articulos = await window.api.articulos.getAll();
    renderTabla(filtrarArticulos());
    toast('Artículo eliminado.');
  });
}

// ── Kit componentes ───────────────────────────────────────────
function buscarKitComp(e) {
  const q = e.target.value.trim().toLowerCase();
  const dd = document.getElementById('kit-search-dropdown');
  kitCompSeleccionado = null;
  if (!q) { dd.style.display = 'none'; return; }

  const resultados = articulos.filter(a =>
    a.id !== editandoId &&
    !kitComponentes.some(c => c.componente_id === a.id) &&
    (a.nombre.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q))
  ).slice(0, 10);

  if (resultados.length === 0) { dd.style.display = 'none'; return; }

  dd.innerHTML = resultados.map(a => `
    <div data-kit-id="${a.id}" data-kit-nombre="${esc(a.nombre)}"
      style="padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border);">
      <span style="font-size:12px;font-weight:500;">${esc(a.nombre)}</span>
      <span style="font-size:11px;color:var(--text-subtle);margin-left:8px;">${esc(a.codigo)}</span>
    </div>`).join('');
  dd.style.display = 'block';
}

function cerrarKitDropdown() {
  document.getElementById('kit-search-dropdown').style.display = 'none';
}

function agregarKitComp() {
  if (!kitCompSeleccionado) {
    toast('Seleccioná un artículo de la lista.', 'error');
    return;
  }
  const cantidad = parseFloat(document.getElementById('kit-comp-cantidad').value) || 1;
  if (kitComponentes.some(c => c.componente_id === kitCompSeleccionado.id)) {
    toast('Ese componente ya está en el kit.', 'error');
    return;
  }
  kitComponentes.push({ componente_id: kitCompSeleccionado.id, nombre: kitCompSeleccionado.nombre, cantidad });
  kitCompSeleccionado = null;
  document.getElementById('kit-buscar-comp').value    = '';
  document.getElementById('kit-comp-cantidad').value  = '1';
  renderKitComponentes();
}

function renderKitComponentes() {
  const lista = document.getElementById('kit-componentes-lista');
  if (kitComponentes.length === 0) {
    lista.innerHTML = '<div style="font-size:12px;color:var(--text-subtle);padding:4px 0;">Sin componentes. Agregá artículos con el buscador.</div>';
    return;
  }
  lista.innerHTML = kitComponentes.map((comp, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-in);">
      <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(comp.nombre || '#' + comp.componente_id)}</span>
      <input type="number" min="0.001" step="0.001" value="${comp.cantidad}"
        onchange="actualizarCantidadComp(${i}, this.value)"
        style="width:68px;font-size:12px;padding:3px 6px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);text-align:right;" />
      <button type="button" onclick="quitarKitComp(${i})"
        style="color:var(--danger);font-size:16px;line-height:1;background:none;border:none;cursor:pointer;padding:0 2px;">×</button>
    </div>`).join('');
}

function quitarKitComp(i) {
  kitComponentes.splice(i, 1);
  renderKitComponentes();
}

function actualizarCantidadComp(i, val) {
  if (kitComponentes[i]) kitComponentes[i].cantidad = parseFloat(val) || 1;
}

// ── Tab 2: Departamentos ──────────────────────────────────────

function iniciarEditDepto(id) {
  const d = departamentos.find(x => x.id === id);
  if (!d) return;
  document.getElementById('depto-editando-id').value  = id;
  document.getElementById('depto-nombre').value       = d.nombre;
  document.getElementById('depto-color').value        = d.color;
  document.getElementById('depto-color-hex').textContent = d.color;
  document.getElementById('lbl-form-depto').textContent  = 'Editar departamento';
  document.getElementById('btn-guardar-depto').textContent = 'Guardar';
  document.getElementById('btn-cancelar-depto').style.display = '';
  document.getElementById('depto-nombre').focus();
}

function cancelarEditDepto() {
  document.getElementById('depto-editando-id').value = '';
  document.getElementById('depto-nombre').value      = '';
  document.getElementById('depto-color').value       = '#6b7280';
  document.getElementById('depto-color-hex').textContent = '#6b7280';
  document.getElementById('lbl-form-depto').textContent   = 'Nuevo departamento';
  document.getElementById('btn-guardar-depto').textContent = 'Agregar';
  document.getElementById('btn-cancelar-depto').style.display = 'none';
}

async function guardarDepto(e) {
  e.preventDefault();
  const nombre = document.getElementById('depto-nombre').value.trim();
  const color  = document.getElementById('depto-color').value;
  const idEdit = document.getElementById('depto-editando-id').value;

  if (!nombre) { toast('El nombre del departamento es obligatorio.', 'error'); return; }

  try {
    if (idEdit) {
      await window.api.departamentos.update(parseInt(idEdit), { nombre, color });
      toast('Departamento actualizado.');
    } else {
      await window.api.departamentos.create({ nombre, color });
      toast('Departamento creado.');
    }
    cancelarEditDepto();
    departamentos = await window.api.departamentos.getAll();
    articulos     = await window.api.articulos.getAll();
    renderDepartamentos();
    renderChipsDepto();
    poblarSelectDepartamento();
  } catch (err) {
    toast('Error: ' + (err.message || err), 'error');
  }
}

function confirmarEliminarDepto2(id, nombre) {
  const cnt = articulos.filter(a => a.departamento_id === id).length;
  if (cnt > 0) {
    toast(`No se puede eliminar "${nombre}": tiene ${cnt} artículo${cnt !== 1 ? 's' : ''} asignado${cnt !== 1 ? 's' : ''}. Reasignalos o eliminalos primero.`, 'error');
    return;
  }

  document.getElementById('confirm-titulo').textContent = 'Eliminar departamento';
  document.getElementById('confirm-nombre').textContent = nombre;
  document.getElementById('modal-confirm').classList.remove('hidden');

  const btn = document.getElementById('btn-confirmar-eliminar');
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener('click', async () => {
    document.getElementById('modal-confirm').classList.add('hidden');
    try {
      await window.api.departamentos.delete(id);
      departamentos = await window.api.departamentos.getAll();
      articulos     = await window.api.articulos.getAll();
      renderDepartamentos();
      renderChipsDepto();
      poblarSelectDepartamento();
      toast('Departamento eliminado.');
    } catch (err) {
      toast('Error: ' + (err.message || err), 'error');
    }
  });
}

// Rewrite renderDepartamentos to fix delegation issue
function renderDepartamentos() {
  const lista  = document.getElementById('lista-departamentos');
  const vacio  = document.getElementById('depto-vacio');

  if (departamentos.length === 0) {
    lista.innerHTML = '';
    vacio.style.display = '';
    return;
  }
  vacio.style.display = 'none';

  lista.innerHTML = departamentos.map(d => {
    const cnt = articulos.filter(a => a.departamento_id === d.id).length;
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-in);">
        <div style="width:24px;height:24px;border-radius:50%;background:${d.color};flex-shrink:0;border:2px solid rgba(255,255,255,.1);"></div>
        <span style="flex:1;font-size:13px;font-weight:500;">${esc(d.nombre)}</span>
        <span style="font-size:11px;color:var(--text-subtle);">${cnt} artículo${cnt !== 1 ? 's' : ''}</span>
        <button onclick="iniciarEditDepto(${d.id})" style="font-size:12px;color:var(--accent);background:none;border:none;cursor:pointer;padding:2px 8px;">Editar</button>
        <button onclick="confirmarEliminarDepto2(${d.id}, '${d.nombre.replace(/'/g, "\\'")}')" style="font-size:12px;color:var(--danger);background:none;border:none;cursor:pointer;padding:2px 8px;">Eliminar</button>
      </div>`;
  }).join('');
}

// ── Ajustar stock (desde catálogo) ────────────────────────────
function abrirModalAjuste(id) {
  const a = articulos.find(x => x.id === id);
  if (!a) return;
  ajustandoId    = id;
  ajustandoStock = a.stock_actual;
  document.getElementById('ajuste-cat-nombre').textContent   = a.nombre;
  document.getElementById('ajuste-cat-codigo').textContent   = a.codigo;
  document.getElementById('ajuste-cat-stock').textContent    = `${fmtNum(a.stock_actual)} ${a.unidad_medida || 'u.'}`;
  document.getElementById('ajuste-cat-tipo').value           = 'entrada';
  document.getElementById('ajuste-cat-cantidad').value       = '';
  document.getElementById('ajuste-cat-motivo').value         = '';
  document.getElementById('ajuste-cat-usuario').value        = '';
  document.getElementById('ajuste-error-cat').classList.add('hidden');
  actualizarPreviewAjuste();
  document.getElementById('modal-ajuste').classList.remove('hidden');
  document.getElementById('ajuste-cat-cantidad').focus();
}

function cerrarModalAjuste() {
  document.getElementById('modal-ajuste').classList.add('hidden');
  ajustandoId = null;
  ajustandoStock = 0;
}

function actualizarPreviewAjuste() {
  const tipo  = document.getElementById('ajuste-cat-tipo').value;
  const cant  = parseFloat(document.getElementById('ajuste-cat-cantidad').value) || 0;
  const label = document.getElementById('ajuste-cat-cant-label');
  const prev  = document.getElementById('ajuste-cat-preview');
  const actual = ajustandoStock;
  let nuevo;

  if (tipo === 'entrada')     { nuevo = actual + cant; label.innerHTML = 'Cantidad a sumar <span class="required">*</span>'; }
  else if (tipo === 'salida') { nuevo = actual - cant; label.innerHTML = 'Cantidad a restar <span class="required">*</span>'; }
  else                        { nuevo = cant;           label.innerHTML = 'Nuevo stock total <span class="required">*</span>'; }

  const color = nuevo < actual ? '#fca5a5' : nuevo > actual ? '#86efac' : 'var(--text)';
  prev.innerHTML = `<span style="color:var(--text-subtle);">Actual:</span> <strong>${fmtNum(actual)}</strong> → <span style="color:var(--text-subtle);">Nuevo:</span> <strong style="color:${color};">${fmtNum(nuevo)}</strong>`;
}

async function confirmarAjuste() {
  const tipo     = document.getElementById('ajuste-cat-tipo').value;
  const cantidad = parseFloat(document.getElementById('ajuste-cat-cantidad').value);
  const motivo   = document.getElementById('ajuste-cat-motivo').value.trim();
  const usuario  = document.getElementById('ajuste-cat-usuario').value.trim();
  const errEl    = document.getElementById('ajuste-error-cat');
  errEl.classList.add('hidden');

  if (!(cantidad > 0)) { errEl.textContent = 'La cantidad debe ser mayor a 0.'; errEl.classList.remove('hidden'); return; }
  if (!motivo)          { errEl.textContent = 'El motivo es obligatorio.';        errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('btn-confirmar-ajuste');
  btn.disabled = true; btn.textContent = 'Procesando...';
  try {
    const r = await window.api.inventario.ajustar({ articulo_id: ajustandoId, tipo_ajuste: tipo, cantidad, motivo, usuario: usuario || null });
    cerrarModalAjuste();
    articulos = await window.api.articulos.getAll();
    renderTabla(filtrarArticulos());
    toast(`Stock ajustado: ${fmtNum(r.anterior)} → ${fmtNum(r.nuevo)}`);
  } catch (err) {
    errEl.textContent = 'Error: ' + (err.message || err);
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Confirmar ajuste';
  }
}

// ── Tab 3: Kits ───────────────────────────────────────────────
async function renderKits() {
  const q = (document.getElementById('busqueda-kits').value || '').trim().toLowerCase();
  const lista  = document.getElementById('lista-kits');
  const vacio  = document.getElementById('kits-vacio');

  let kits = articulos.filter(a => a.es_kit);
  if (q) kits = kits.filter(a => a.nombre.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q));

  if (kits.length === 0) {
    lista.innerHTML = '';
    vacio.style.display = '';
    return;
  }
  vacio.style.display = 'none';

  // Cargar componentes de todos los kits en paralelo
  const compsMap = {};
  await Promise.all(kits.map(async k => {
    compsMap[k.id] = await window.api.kits.getComponentes(k.id);
  }));

  lista.innerHTML = kits.map(k => {
    const comps = compsMap[k.id] || [];
    const deptoChip = k.departamento_nombre
      ? `<span style="padding:1px 7px;border-radius:10px;font-size:11px;background:${k.departamento_color || '#6b7280'}22;color:${k.departamento_color || '#6b7280'};border:1px solid ${k.departamento_color || '#6b7280'}44;margin-left:6px;">${esc(k.departamento_nombre)}</span>`
      : '';
    const compRows = comps.length > 0
      ? comps.map(c => `
          <div style="display:flex;gap:8px;font-size:12px;padding:3px 0;color:var(--text-muted);">
            <span style="flex:1;">${esc(c.nombre)}</span>
            <span style="color:var(--text-subtle);">${fmtNum(c.cantidad)} ${c.unidad_medida || 'u.'}</span>
            <span style="color:var(--text-subtle);">Stock: ${fmtNum(c.stock_actual)}</span>
          </div>`).join('')
      : '<div style="font-size:12px;color:var(--text-subtle);font-style:italic;padding:4px 0;">Sin componentes definidos.</div>';

    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);overflow:hidden;">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;">
          <div style="flex:1;">
            <span style="font-weight:600;font-size:13px;">${esc(k.nombre)}</span>
            ${deptoChip}
            <span style="font-family:monospace;font-size:11px;color:var(--text-subtle);margin-left:8px;">${esc(k.codigo)}</span>
          </div>
          <span style="font-size:13px;color:var(--text-muted);">${fmt(k.precio_unitario)}</span>
          <button onclick="abrirModalEdicion(${k.id})" style="font-size:12px;color:var(--accent);background:none;border:none;cursor:pointer;padding:2px 8px;">Editar</button>
        </div>
        <div style="padding:8px 14px;border-top:1px solid var(--border);background:var(--bg);">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-subtle);margin-bottom:6px;">Componentes (${comps.length})</div>
          ${compRows}
        </div>
      </div>`;
  }).join('');
}

// ── Importar Excel / CSV ──────────────────────────────────────
let importRows       = [];
let importHeaders    = [];
let autoDetectadosIds = new Set();

function cerrarModalImport() {
  document.getElementById('modal-import').classList.add('hidden');
  document.getElementById('input-excel').value = '';
  importRows = [];
  importHeaders = [];
  autoDetectadosIds = new Set();
  document.getElementById('import-step-mapeo').classList.add('hidden');
  document.getElementById('import-step-vacio').style.display = '';
  document.getElementById('btn-ejecutar-import').classList.add('hidden');
  document.getElementById('import-status').classList.add('hidden');
}

function leerExcel(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isCSV = file.name.endsWith('.csv');

  const reader = new FileReader();
  reader.onload = evt => {
    let data;
    if (isCSV) {
      const text = evt.target.result;
      // Detectar separador
      const sep = text.indexOf(';') > text.indexOf(',') ? ';' : ',';
      data = text.split('\n').map(row => row.split(sep).map(c => c.replace(/^"|"$/g, '').trim()));
    } else {
      if (typeof XLSX === 'undefined') { alert('La librería XLSX no está disponible.'); return; }
      const wb  = XLSX.read(evt.target.result, { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    }

    if (!data || data.length < 2) { alert('El archivo no tiene datos suficientes.'); return; }

    importHeaders = data[0].map(h => String(h ?? ''));
    importRows    = data.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''));

    if (importRows.length === 0) { alert('El archivo no tiene filas con datos.'); return; }

    rellenarSelectsMapeo();
    autoDetectadosIds = autoDetectColumns();
    renderPreview();

    document.getElementById('import-step-vacio').style.display = 'none';
    document.getElementById('import-step-mapeo').classList.remove('hidden');
    document.getElementById('btn-ejecutar-import').classList.remove('hidden');
    document.getElementById('import-status').classList.add('hidden');
    document.getElementById('modal-import').classList.remove('hidden');
  };

  if (isCSV) reader.readAsText(file, 'UTF-8');
  else        reader.readAsArrayBuffer(file);
}

function rellenarSelectsMapeo() {
  const ningunaOpt = '<option value="-1">— No usar —</option>';
  const colOpts = importHeaders.map((h, i) =>
    `<option value="${i}">${esc(h || `Columna ${i + 1}`)}</option>`
  ).join('');
  ['map-codigo','map-nombre','map-precio','map-costo','map-mayoreo','map-stock','map-stock-min','map-departamento'].forEach(id => {
    document.getElementById(id).innerHTML = ningunaOpt + colOpts;
    document.getElementById(id).value = '-1';
  });
}

function normalizarHdr(h) {
  return String(h).toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function autoDetectColumns() {
  // costo ANTES que precio para que "precio_costo" no sea capturado por precio
  const KEYWORDS = {
    'map-codigo': {
      exact: ['codigo', 'sku', 'code', 'barcode', 'cod', 'clave',
              'codigo de barras', 'codigobarras', 'codigo barras'],
      broad: ['barra', 'ean', 'upc'],
    },
    'map-nombre': {
      exact: ['nombre', 'producto', 'name', 'descripcion', 'description',
              'articulo', 'desc', 'item'],
      broad: [],
    },
    'map-costo': {
      exact: ['precio_costo', 'p_costo', 'costo', 'cost', 'precio costo',
              'preciocosto', 'pcosto', 'precio compra'],
      broad: ['compra'],
    },
    'map-precio': {
      exact: ['precio_venta', 'pvp', 'p_venta', 'venta', 'precio venta',
              'precioventa', 'pventa', 'price', 'precio'],
      broad: [],
    },
    'map-mayoreo': {
      exact: ['precio_mayoreo', 'mayoreo', 'precio_mayor', 'precio mayor',
              'preciomayoreo', 'bulk'],
      broad: ['mayor', 'wholesale'],
    },
    'map-stock': {
      exact: ['stock_actual', 'stock', 'cantidad', 'qty', 'existencia',
              'existencias', 'inventory', 'inventario'],
      broad: ['exist'],
    },
    'map-stock-min': {
      exact: ['stock_minimo', 'stock_min', 'minimo', 'stock minimo',
              'stockminimo', 'min stock'],
      broad: ['stmin'],
    },
    'map-departamento': {
      exact: ['departamento', 'categoria', 'category', 'dept', 'rubro',
              'department', 'seccion'],
      broad: ['depto', 'cat'],
    },
  };

  const detectados = new Set();
  const usados = new Set();
  const hdrs = importHeaders.map(normalizarHdr);

  for (const [selId, { exact, broad }] of Object.entries(KEYWORDS)) {
    let idx = hdrs.findIndex((h, i) => !usados.has(i) && exact.includes(h));
    if (idx < 0) idx = hdrs.findIndex((h, i) => !usados.has(i) && exact.some(kw => h.includes(kw)));
    if (idx < 0) idx = hdrs.findIndex((h, i) => !usados.has(i) && broad.some(kw => h.includes(kw)));
    if (idx >= 0) {
      document.getElementById(selId).value = String(idx);
      usados.add(idx);
      detectados.add(selId);
    }
  }
  return detectados;
}

function renderPreview() {
  const FIELD_LABELS = {
    'map-codigo':       'Código',
    'map-nombre':       'Nombre',
    'map-precio':       'Precio venta',
    'map-costo':        'Precio costo',
    'map-mayoreo':      'Precio mayoreo',
    'map-stock':        'Stock',
    'map-stock-min':    'Stock mín.',
    'map-departamento': 'Departamento',
  };

  // Badges de columnas mapeadas
  const resumen = document.getElementById('import-mapeo-resumen');
  if (resumen) {
    const badges = Object.entries(FIELD_LABELS).map(([id, label]) => {
      const sel = document.getElementById(id);
      const val = sel ? parseInt(sel.value, 10) : -1;
      if (val < 0) return '';
      const colName = importHeaders[val] || `Col. ${val + 1}`;
      const esAuto  = autoDetectadosIds.has(id);
      const bg  = esAuto ? 'rgba(34,197,94,.12)'  : 'rgba(234,179,8,.12)';
      const brd = esAuto ? 'rgba(34,197,94,.3)'   : 'rgba(234,179,8,.3)';
      const fg  = esAuto ? '#4ade80'              : '#fbbf24';
      const tag = esAuto
        ? `<span style="font-size:9px;font-weight:700;background:rgba(34,197,94,.2);color:#4ade80;padding:1px 5px;border-radius:3px;margin-left:4px;">AUTO</span>`
        : `<span style="font-size:9px;font-weight:700;background:rgba(234,179,8,.2);color:#fbbf24;padding:1px 5px;border-radius:3px;margin-left:4px;">MANUAL</span>`;
      return `<div style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;background:${bg};border:1px solid ${brd};border-radius:5px;font-size:11px;color:${fg};">${esc(label)}${tag}<span style="color:var(--text-subtle);font-size:10px;margin-left:3px;">"${esc(colName)}"</span></div>`;
    }).filter(Boolean).join('');
    resumen.innerHTML = badges
      ? `<div style="font-size:10px;font-weight:600;color:var(--text-subtle);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Columnas mapeadas</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${badges}</div>`
      : '';
  }

  // Tabla de vista previa
  const preview = importRows.slice(0, 5);
  const thead = `<thead><tr>${importHeaders.map(h => `<th style="white-space:nowrap;">${esc(h)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${preview.map(row =>
    `<tr>${importHeaders.map((_, i) =>
      `<td style="white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;">${esc(String(row[i] ?? ''))}</td>`
    ).join('')}</tr>`
  ).join('')}</tbody>`;
  document.getElementById('tabla-preview').innerHTML = thead + tbody;
}

// Columnas de promoción que se detectan automáticamente en la importación
const PROMO_PRECIO_KW = ['precio_promo', 'precio_promocional', 'promo_precio', 'precio_mayoreo2',
                         'descuento_volumen', 'promo_unit', 'precio_promo_unit', 'precio_oferta'];
const PROMO_NOMBRE_KW = ['promo_nombre', 'nombre_promo', 'nombre_promocion', 'promocion_nombre'];
const PROMO_DESDE_KW  = ['promo_desde', 'cantidad_desde_promo', 'cant_promo_desde', 'desde_promo',
                         'min_cant_promo', 'cantidad_minima_promo', 'cant_min_promo'];
const PROMO_HASTA_KW  = ['promo_hasta', 'cantidad_hasta_promo', 'cant_promo_hasta', 'hasta_promo',
                         'max_cant_promo', 'cantidad_maxima_promo', 'cant_max_promo'];

function detectarColumnasPromoImport() {
  const hdrs       = importHeaders.map(normalizarHdr);
  const mayoreoIdx = parseInt(document.getElementById('map-mayoreo').value, 10);
  const find = kws => {
    const idx = hdrs.findIndex(h => kws.includes(h) || kws.some(kw => h.includes(kw)));
    return (idx >= 0 && idx !== mayoreoIdx) ? idx : -1;
  };
  return {
    promoPrecio: find(PROMO_PRECIO_KW),
    promoNombre: find(PROMO_NOMBRE_KW),
    promoDesde:  find(PROMO_DESDE_KW),
    promoHasta:  find(PROMO_HASTA_KW),
  };
}

async function ejecutarImport() {
  const cols = {
    codigo:   parseInt(document.getElementById('map-codigo').value, 10),
    nombre:   parseInt(document.getElementById('map-nombre').value, 10),
    precio:   parseInt(document.getElementById('map-precio').value, 10),
    costo:    parseInt(document.getElementById('map-costo').value, 10),
    mayoreo:  parseInt(document.getElementById('map-mayoreo').value, 10),
    stock:    parseInt(document.getElementById('map-stock').value, 10),
    stockMin: parseInt(document.getElementById('map-stock-min').value, 10),
    depto:    parseInt(document.getElementById('map-departamento').value, 10),
  };

  if (cols.nombre < 0) { mostrarStatusImport('Debés mapear la columna "Nombre".', true); return; }

  const colsPromo = detectarColumnasPromoImport();
  const hayPromos = colsPromo.promoPrecio >= 0;

  const btnImp = document.getElementById('btn-ejecutar-import');
  btnImp.disabled = true;
  btnImp.textContent = 'Importando...';

  const importStatus = document.getElementById('import-status');
  importStatus.classList.remove('hidden');

  let nuevos = 0, actualizados = 0, codigosAuto = 0, promoCreadas = 0;
  const erroresDetalle = []; // { fila, campo, valorRecibido, motivo }

  const deptoCache = {};
  const tsBase = String(Date.now()).slice(-8);

  for (let i = 0; i < importRows.length; i++) {
    const row   = importRows[i];
    const nFila = i + 2;
    let   codigo = cols.codigo >= 0 ? String(row[cols.codigo] ?? '').trim().toUpperCase() : '';
    const nombre = String(row[cols.nombre] ?? '').trim();

    importStatus.textContent = `Procesando fila ${i + 1} de ${importRows.length}…`;

    if (!nombre) continue;

    if (!codigo) {
      codigosAuto++;
      codigo = `IMP-${tsBase}-${String(codigosAuto).padStart(4, '0')}`;
    }

    const precio   = cols.precio   >= 0 ? parsearImport(row[cols.precio])     : null;
    const costo    = cols.costo    >= 0 ? parsearImport(row[cols.costo],   0)  : 0;
    const mayoreo  = cols.mayoreo  >= 0 ? parsearImport(row[cols.mayoreo], 0)  : 0;
    const stock    = cols.stock    >= 0 ? parsearImport(row[cols.stock],   0)  : 0;
    const stockMin = cols.stockMin >= 0 ? parsearImport(row[cols.stockMin], 0) : 0;

    let departamento_id = null;
    if (cols.depto >= 0) {
      const deptoNombre = String(row[cols.depto] ?? '').trim();
      if (deptoNombre) {
        if (deptoCache[deptoNombre] !== undefined) {
          departamento_id = deptoCache[deptoNombre];
        } else {
          const existing = departamentos.find(d => d.nombre.toLowerCase() === deptoNombre.toLowerCase());
          if (existing) {
            departamento_id = existing.id;
          } else {
            try {
              const nd = await window.api.departamentos.create({ nombre: deptoNombre });
              departamentos.push(nd);
              departamento_id = nd.id;
            } catch (err) {
              erroresDetalle.push({ fila: nFila, campo: 'departamento', valorRecibido: deptoNombre, motivo: `No se pudo crear: ${err.message || err}` });
              departamento_id = null;
            }
          }
          deptoCache[deptoNombre] = departamento_id;
        }
      }
    }

    let artId = null;
    try {
      const existente = await window.api.articulos.getByCodigo(codigo);
      if (existente) {
        const upd = { nombre };
        if (precio !== null && precio > 0)  upd.precio_unitario = precio;
        if (cols.costo    >= 0) upd.costo_unitario = costo;
        if (cols.mayoreo  >= 0) upd.precio_mayoreo = mayoreo;
        if (cols.stock    >= 0) upd.stock_actual   = stock;
        if (cols.stockMin >= 0) upd.stock_minimo   = stockMin;
        if (departamento_id !== null) upd.departamento_id = departamento_id;
        await window.api.articulos.update(existente.id, upd);
        artId = existente.id;
        actualizados++;
      } else {
        if (precio === null || precio <= 0) {
          const valorRaw = cols.precio >= 0
            ? String(row[cols.precio] ?? '(vacío)')
            : '(columna no mapeada)';
          erroresDetalle.push({ fila: nFila, campo: 'precio venta', valorRecibido: valorRaw, motivo: 'Precio ausente o ≤ 0 (requerido para artículo nuevo)' });
          continue;
        }
        const nuevo = await window.api.articulos.create({
          codigo,
          nombre,
          descripcion:     '',
          precio_unitario: precio,
          costo_unitario:  costo,
          precio_mayoreo:  mayoreo,
          stock_actual:    stock,
          stock_minimo:    stockMin,
          proveedor:       null,
          departamento_id,
          unidad_medida:   'unidad',
          tasa_iva:        '21',
          es_kit:          0,
          usa_inventario:  1,
        });
        artId = nuevo.id;
        nuevos++;
      }
    } catch (err) {
      erroresDetalle.push({ fila: nFila, campo: '—', valorRecibido: codigo, motivo: err.message || String(err) });
      continue;
    }

    // Crear promoción si hay columna de precio promo con valor
    if (hayPromos && artId !== null) {
      const precioPromo = parsearImport(row[colsPromo.promoPrecio]);
      if (precioPromo > 0) {
        const promoNombre = colsPromo.promoNombre >= 0 ? String(row[colsPromo.promoNombre] ?? '').trim() : '';
        const promoDesde  = colsPromo.promoDesde >= 0 ? (parseInt(row[colsPromo.promoDesde]) || 1) : 1;
        const promoHastaR = colsPromo.promoHasta >= 0 ? parseInt(row[colsPromo.promoHasta]) : NaN;
        const promoHasta  = isNaN(promoHastaR) || promoHastaR <= 0 ? null : promoHastaR;
        try {
          await window.api.promociones.crear({
            articulo_id:        artId,
            nombre:             promoNombre,
            cantidad_desde:     promoDesde,
            cantidad_hasta:     promoHasta,
            precio_promocional: precioPromo,
          });
          promoCreadas++;
        } catch (_) {}
      }
    }
  }

  const totalErrores = erroresDetalle.length;
  let erroresHtml = '';
  if (totalErrores > 0) {
    const filas = erroresDetalle.map(e =>
      `<tr>
        <td style="padding:4px 8px;text-align:right;color:var(--text-subtle);white-space:nowrap;">${e.fila}</td>
        <td style="padding:4px 8px;white-space:nowrap;">${esc(e.campo)}</td>
        <td style="padding:4px 8px;font-family:monospace;font-size:11px;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(String(e.valorRecibido))}">${esc(String(e.valorRecibido))}</td>
        <td style="padding:4px 8px;color:#fca5a5;font-size:12px;">${esc(e.motivo)}</td>
      </tr>`
    ).join('');
    erroresHtml = `
      <div style="margin-top:10px;">
        <div style="font-size:11px;font-weight:600;color:#fca5a5;margin-bottom:6px;">Detalle de errores (${totalErrores}):</div>
        <div style="overflow-x:auto;max-height:180px;overflow-y:auto;border:1px solid rgba(239,68,68,.25);border-radius:var(--r-in);">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:rgba(239,68,68,.08);">
                <th style="padding:4px 8px;text-align:right;color:var(--text-subtle);font-weight:600;white-space:nowrap;">Fila</th>
                <th style="padding:4px 8px;text-align:left;color:var(--text-subtle);font-weight:600;">Campo</th>
                <th style="padding:4px 8px;text-align:left;color:var(--text-subtle);font-weight:600;">Valor recibido</th>
                <th style="padding:4px 8px;text-align:left;color:var(--text-subtle);font-weight:600;">Problema</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;
  }

  const autoMsg = codigosAuto > 0
    ? `&nbsp;·&nbsp;<span style="color:var(--text-subtle);">${codigosAuto} código${codigosAuto > 1 ? 's' : ''} auto-generado${codigosAuto > 1 ? 's' : ''}</span>`
    : '';
  const promoMsg = promoCreadas > 0
    ? `&nbsp;·&nbsp;<span style="color:#4ade80;">${promoCreadas} promoción${promoCreadas !== 1 ? 'es' : ''} creada${promoCreadas !== 1 ? 's' : ''}</span>`
    : '';

  importStatus.innerHTML = `
    <div style="padding:10px 14px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:var(--r-in);line-height:1.7;">
      Importación finalizada:<br>
      <strong>${nuevos}</strong> artículos nuevos &nbsp;·&nbsp;
      <strong>${actualizados}</strong> actualizados &nbsp;·&nbsp;
      <strong style="color:#fca5a5;">${totalErrores}</strong> filas con error${autoMsg}${promoMsg}
    </div>
    ${erroresHtml}`;

  btnImp.disabled    = false;
  btnImp.textContent = 'Importar de nuevo';
  articulos = await window.api.articulos.getAll();
  await recargarDepto();
  renderTabla(filtrarArticulos());
}

function mostrarStatusImport(msg, esError = false) {
  const el = document.getElementById('import-status');
  el.classList.remove('hidden');
  const color = esError ? 'rgba(239,68,68,.1)' : 'rgba(59,130,246,.1)';
  const border = esError ? 'rgba(239,68,68,.25)' : 'rgba(59,130,246,.3)';
  const txt    = esError ? '#fca5a5' : 'var(--text)';
  el.innerHTML = `<div style="padding:8px 12px;background:${color};border:1px solid ${border};border-radius:var(--r-in);color:${txt};">${esc(msg)}</div>`;
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
  }).format(n ?? 0);
}

function fmtNum(n) {
  const num = parseFloat(n) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(3).replace(/\.?0+$/, '');
}

function parsearNumero(val, fallback) {
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? fallback : n;
}

// Parseo para importación CSV: soporta formato argentino ($1.234,56) y US ($1,234.56)
function parsearImport(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  // Quitar todo excepto dígitos, punto y coma
  const s = String(val).replace(/[^0-9.,]/g, '');
  if (!s) return fallback;

  const hasDot   = s.includes('.');
  const hasComma = s.includes(',');

  let normalizado;
  if (hasDot && hasComma) {
    // El separador que aparece ÚLTIMO es el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Formato argentino/europeo: 1.234,56 → quitar puntos, coma→punto
      normalizado = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US: 1,234.56 → quitar comas
      normalizado = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Solo coma: tratar como separador decimal (1234,56 → 1234.56)
    normalizado = s.replace(',', '.');
  } else {
    // Solo puntos o ninguno: parseFloat estándar
    normalizado = s;
  }

  const n = parseFloat(normalizado);
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
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function ocultarError() {
  const el = document.getElementById('error-msg');
  el.textContent = '';
  el.classList.add('hidden');
}

function bloquearFormulario(b) {
  const btn = document.getElementById('btn-guardar');
  btn.disabled    = b;
  btn.textContent = b ? 'Guardando...' : 'Guardar';
}

function toast(msg, tipo = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Promociones por volumen ───────────────────────────────────

function togglePromosBody() {
  promosBodyOpen = !promosBodyOpen;
  document.getElementById('promos-body').style.display    = promosBodyOpen ? '' : 'none';
  document.getElementById('promos-chevron').style.transform = promosBodyOpen ? 'rotate(90deg)' : '';
}

function resetPromosUI(tieneId) {
  promosBodyOpen = false;
  document.getElementById('promos-body').style.display      = 'none';
  document.getElementById('promos-chevron').style.transform = '';
  document.getElementById('promos-sin-id').style.display    = tieneId ? 'none' : '';
  document.getElementById('promos-form-wrap').style.display = tieneId ? '' : 'none';
  document.getElementById('error-promo').classList.add('hidden');
  document.getElementById('promo-nombre').value = '';
  document.getElementById('promo-desde').value  = '';
  document.getElementById('promo-hasta').value  = '';
  document.getElementById('promo-precio').value = '';
  renderPromos();
}

function renderPromos() {
  const lista = document.getElementById('promos-lista');
  if (promosActuales.length === 0) {
    lista.innerHTML = '<div style="font-size:12px;color:var(--text-subtle);padding:4px 0 8px;">Sin promociones configuradas.</div>';
    return;
  }
  lista.innerHTML = `
    <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:6px;">
      <thead>
        <tr style="color:var(--text-subtle);">
          <th style="text-align:left;padding:3px 6px;font-weight:500;">Nombre</th>
          <th style="text-align:center;padding:3px 6px;font-weight:500;">Desde</th>
          <th style="text-align:center;padding:3px 6px;font-weight:500;">Hasta</th>
          <th style="text-align:right;padding:3px 6px;font-weight:500;">Precio unit.</th>
          <th style="padding:3px 6px;"></th>
        </tr>
      </thead>
      <tbody>
        ${promosActuales.map(p => `
          <tr style="border-top:1px solid var(--border);">
            <td style="padding:5px 6px;">${esc(p.nombre || '—')}</td>
            <td style="padding:5px 6px;text-align:center;">${p.cantidad_desde}</td>
            <td style="padding:5px 6px;text-align:center;color:var(--text-subtle);">${p.cantidad_hasta ?? '∞'}</td>
            <td style="padding:5px 6px;text-align:right;font-weight:600;color:#4ade80;">${fmt(p.precio_promocional)}</td>
            <td style="padding:5px 6px;text-align:right;">
              <button type="button" data-promo-id="${p.id}"
                style="color:var(--danger);font-size:15px;line-height:1;background:none;border:none;cursor:pointer;padding:0 3px;"
                title="Eliminar promoción">×</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  lista.querySelectorAll('[data-promo-id]').forEach(btn => {
    btn.addEventListener('click', () => eliminarPromo(parseInt(btn.dataset.promoId)));
  });
}

async function agregarPromo() {
  const errEl   = document.getElementById('error-promo');
  errEl.classList.add('hidden');

  const nombre  = document.getElementById('promo-nombre').value.trim();
  const desde   = parseFloat(document.getElementById('promo-desde').value);
  const hastaRaw = document.getElementById('promo-hasta').value.trim();
  const hasta   = hastaRaw === '' ? null : parseFloat(hastaRaw);
  const precio  = parseFloat(document.getElementById('promo-precio').value);

  if (isNaN(desde) || desde < 1) {
    errEl.textContent = 'La cantidad "Desde" debe ser mayor o igual a 1.';
    errEl.classList.remove('hidden');
    return;
  }
  if (hasta !== null && hasta < desde) {
    errEl.textContent = 'La cantidad "Hasta" debe ser mayor o igual a "Desde".';
    errEl.classList.remove('hidden');
    return;
  }
  if (isNaN(precio) || precio <= 0) {
    errEl.textContent = 'El precio promocional debe ser mayor a 0.';
    errEl.classList.remove('hidden');
    return;
  }
  if (!editandoId) return;

  try {
    const nueva = await window.api.promociones.crear({
      articulo_id:        editandoId,
      nombre,
      cantidad_desde:     desde,
      cantidad_hasta:     hasta,
      precio_promocional: precio,
    });
    promosActuales.push(nueva);
    promosActuales.sort((a, b) => a.cantidad_desde - b.cantidad_desde);
    document.getElementById('promo-nombre').value = '';
    document.getElementById('promo-desde').value  = '';
    document.getElementById('promo-hasta').value  = '';
    document.getElementById('promo-precio').value = '';
    renderPromos();
  } catch (err) {
    errEl.textContent = 'Error: ' + (err.message || err);
    errEl.classList.remove('hidden');
  }
}

async function eliminarPromo(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  try {
    await window.api.promociones.eliminar(id);
    promosActuales = promosActuales.filter(p => p.id !== id);
    renderPromos();
  } catch (err) {
    toast('Error al eliminar: ' + (err.message || err), 'error');
  }
}

// ── Modal: Gestión global de promociones ─────────────────────

let promosGlobalTodas = [];
let pgArtSeleccionado = null;
let pgArtTimer        = null;

async function abrirModalPromos() {
  pgArtSeleccionado = null;
  document.getElementById('pg-art-busq').value       = '';
  document.getElementById('pg-promo-nombre').value   = '';
  document.getElementById('pg-promo-desde').value    = '';
  document.getElementById('pg-promo-hasta').value    = '';
  document.getElementById('pg-promo-precio').value   = '';
  document.getElementById('promo-global-form-wrap').style.display = 'none';
  document.getElementById('pg-error').classList.add('hidden');
  document.getElementById('promos-busq-art').value   = '';
  document.getElementById('modal-promos-global').classList.remove('hidden');
  await cargarPromosGlobal();
}

async function cargarPromosGlobal() {
  document.getElementById('promos-global-tbody').innerHTML =
    '<tr><td colspan="6" style="text-align:center;color:var(--text-subtle);padding:24px;">Cargando...</td></tr>';
  try {
    promosGlobalTodas = await window.api.promociones.listarTodas();
    filtrarYRenderPromosGlobal();
  } catch (err) {
    document.getElementById('promos-global-tbody').innerHTML =
      `<tr><td colspan="6" style="text-align:center;color:#fca5a5;padding:24px;">Error: ${esc(err.message || err)}</td></tr>`;
  }
}

function filtrarYRenderPromosGlobal() {
  const q = (document.getElementById('promos-busq-art').value || '').trim().toLowerCase();
  const lista = q
    ? promosGlobalTodas.filter(p => (p.articulo_nombre || '').toLowerCase().includes(q))
    : promosGlobalTodas;
  renderPromosGlobal(lista);
}

function renderPromosGlobal(lista) {
  const tbody = document.getElementById('promos-global-tbody');
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-subtle);padding:24px;">Sin promociones encontradas.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(p => `
    <tr>
      <td style="padding:8px 12px;">
        <div style="font-size:13px;font-weight:500;">${esc(p.articulo_nombre || '—')}</div>
        <div style="font-size:11px;color:var(--text-subtle);font-family:monospace;">${esc(p.articulo_codigo || '')}</div>
      </td>
      <td style="padding:8px 12px;">${esc(p.nombre || '—')}</td>
      <td style="padding:8px 12px;text-align:center;">${p.cantidad_desde}</td>
      <td style="padding:8px 12px;text-align:center;color:var(--text-subtle);">${p.cantidad_hasta ?? '∞'}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600;color:#4ade80;">${fmt(p.precio_promocional)}</td>
      <td style="padding:8px 12px;text-align:right;">
        <button data-pg-del="${p.id}"
          style="color:var(--danger);font-size:16px;line-height:1;background:none;border:none;cursor:pointer;padding:0 4px;"
          title="Eliminar">×</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-pg-del]').forEach(btn => {
    btn.addEventListener('click', () => eliminarPromoGlobal(parseInt(btn.dataset.pgDel)));
  });
}

async function eliminarPromoGlobal(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  try {
    await window.api.promociones.eliminar(id);
    promosGlobalTodas = promosGlobalTodas.filter(p => p.id !== id);
    filtrarYRenderPromosGlobal();
    toast('Promoción eliminada.');
  } catch (err) {
    toast('Error al eliminar: ' + (err.message || err), 'error');
  }
}

async function agregarPromoGlobal() {
  const errEl = document.getElementById('pg-error');
  errEl.classList.add('hidden');

  if (!pgArtSeleccionado) {
    errEl.textContent = 'Seleccioná un artículo de la lista.';
    errEl.classList.remove('hidden');
    return;
  }
  const nombre   = document.getElementById('pg-promo-nombre').value.trim();
  const desde    = parseFloat(document.getElementById('pg-promo-desde').value);
  const hastaRaw = document.getElementById('pg-promo-hasta').value.trim();
  const hasta    = hastaRaw === '' ? null : parseFloat(hastaRaw);
  const precio   = parseFloat(document.getElementById('pg-promo-precio').value);

  if (isNaN(desde) || desde < 1) {
    errEl.textContent = '"Desde" debe ser mayor o igual a 1.';
    errEl.classList.remove('hidden');
    return;
  }
  if (hasta !== null && hasta < desde) {
    errEl.textContent = '"Hasta" debe ser mayor o igual a "Desde".';
    errEl.classList.remove('hidden');
    return;
  }
  if (isNaN(precio) || precio <= 0) {
    errEl.textContent = 'El precio promocional debe ser mayor a 0.';
    errEl.classList.remove('hidden');
    return;
  }

  const btnAgregar = document.getElementById('pg-btn-agregar');
  btnAgregar.disabled = true;
  try {
    const nueva = await window.api.promociones.crear({
      articulo_id:        pgArtSeleccionado.id,
      nombre,
      cantidad_desde:     desde,
      cantidad_hasta:     hasta,
      precio_promocional: precio,
    });
    const art = articulos.find(a => a.id === pgArtSeleccionado.id);
    nueva.articulo_nombre = art?.nombre || pgArtSeleccionado.nombre;
    nueva.articulo_codigo = art?.codigo || '';
    promosGlobalTodas.push(nueva);
    promosGlobalTodas.sort((a, b) =>
      (a.articulo_nombre || '').localeCompare(b.articulo_nombre || '') ||
      a.cantidad_desde - b.cantidad_desde
    );
    pgArtSeleccionado = null;
    document.getElementById('pg-art-busq').value     = '';
    document.getElementById('pg-promo-nombre').value = '';
    document.getElementById('pg-promo-desde').value  = '';
    document.getElementById('pg-promo-hasta').value  = '';
    document.getElementById('pg-promo-precio').value = '';
    document.getElementById('promo-global-form-wrap').style.display = 'none';
    filtrarYRenderPromosGlobal();
    toast('Promoción creada.');
  } catch (err) {
    errEl.textContent = 'Error: ' + (err.message || err);
    errEl.classList.remove('hidden');
  } finally {
    btnAgregar.disabled = false;
  }
}

function bindPromoGlobalForm() {
  document.getElementById('promos-busq-art').addEventListener('input', filtrarYRenderPromosGlobal);

  document.getElementById('btn-nueva-promo-global').addEventListener('click', () => {
    const wrap = document.getElementById('promo-global-form-wrap');
    const esVisible = wrap.style.display !== 'none';
    wrap.style.display = esVisible ? 'none' : '';
    if (!esVisible) setTimeout(() => document.getElementById('pg-art-busq').focus(), 30);
  });

  document.getElementById('pg-btn-cancelar-form').addEventListener('click', () => {
    document.getElementById('promo-global-form-wrap').style.display = 'none';
    pgArtSeleccionado = null;
  });

  document.getElementById('pg-art-busq').addEventListener('input', e => {
    clearTimeout(pgArtTimer);
    const q  = e.target.value.trim();
    const dd = document.getElementById('pg-art-dropdown');
    pgArtSeleccionado = null;
    if (!q) { dd.style.display = 'none'; return; }
    pgArtTimer = setTimeout(() => {
      const res = articulos.filter(a =>
        a.nombre.toLowerCase().includes(q.toLowerCase()) ||
        a.codigo.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 8);
      if (res.length === 0) { dd.style.display = 'none'; return; }
      dd.innerHTML = res.map(a => `
        <div data-pg-art-id="${a.id}" data-pg-art-nombre="${esc(a.nombre)}"
          style="padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border);">
          <span style="font-size:12px;font-weight:500;">${esc(a.nombre)}</span>
          <span style="font-size:11px;color:var(--text-subtle);margin-left:8px;">${esc(a.codigo)}</span>
        </div>`).join('');
      dd.style.display = 'block';
    }, 150);
  });

  document.getElementById('pg-art-dropdown').addEventListener('click', e => {
    const item = e.target.closest('[data-pg-art-id]');
    if (!item) return;
    pgArtSeleccionado = { id: parseInt(item.dataset.pgArtId), nombre: item.dataset.pgArtNombre };
    document.getElementById('pg-art-busq').value = item.dataset.pgArtNombre;
    document.getElementById('pg-art-dropdown').style.display = 'none';
    document.getElementById('pg-promo-desde').focus();
  });
  window.bindDropdownKeyboard({
    inputEl:   document.getElementById('pg-art-busq'),
    dropdownId:'pg-art-dropdown',
    optSel:    '[data-pg-art-id]',
    onSelect:  item => {
      pgArtSeleccionado = { id: parseInt(item.dataset.pgArtId), nombre: item.dataset.pgArtNombre };
      document.getElementById('pg-art-busq').value = item.dataset.pgArtNombre;
      document.getElementById('pg-art-dropdown').style.display = 'none';
      document.getElementById('pg-promo-desde').focus();
    },
    onClose: () => { document.getElementById('pg-art-dropdown').style.display = 'none'; },
  });

  document.getElementById('pg-btn-agregar').addEventListener('click', agregarPromoGlobal);

  document.getElementById('pg-promo-precio').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); agregarPromoGlobal(); }
  });

  document.getElementById('btn-close-promos-global').addEventListener('click', () =>
    document.getElementById('modal-promos-global').classList.add('hidden')
  );
  document.getElementById('btn-cerrar-promos-global').addEventListener('click', () =>
    document.getElementById('modal-promos-global').classList.add('hidden')
  );

  document.addEventListener('click', e => {
    if (!e.target.closest('#pg-art-busq') && !e.target.closest('#pg-art-dropdown'))
      document.getElementById('pg-art-dropdown').style.display = 'none';
  });
}

// ── Exportar catálogo a CSV ───────────────────────────────────

function exportarCSV() {
  const lista = filtrarArticulos();
  if (lista.length === 0) {
    toast('No hay artículos para exportar con el filtro actual.', 'error');
    return;
  }

  const csvEsc = val => {
    const s = String(val ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const headers = [
    'codigo', 'nombre', 'descripcion',
    'precio_costo', 'precio_venta', 'precio_mayoreo',
    'stock_actual', 'stock_minimo',
    'departamento', 'proveedor', 'unidad_medida',
    'usa_inventario', 'es_kit',
  ];

  const filas = lista.map(a => [
    a.codigo,
    a.nombre,
    a.descripcion         ?? '',
    a.costo_unitario      ?? 0,
    a.precio_unitario     ?? 0,
    a.precio_mayoreo      ?? 0,
    a.stock_actual        ?? 0,
    a.stock_minimo        ?? 0,
    a.departamento_nombre ?? '',
    a.proveedor           ?? '',
    a.unidad_medida       ?? 'unidad',
    a.usa_inventario ? '1' : '0',
    a.es_kit         ? '1' : '0',
  ].map(csvEsc).join(','));

  const csv   = [headers.join(','), ...filas].join('\r\n');
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `catalogo_${fecha}.csv`;

  // BOM para que Excel abra correctamente con tildes y ñ
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = nombre;
  link.click();
  URL.revokeObjectURL(url);

  toast(`${nombre} exportado (${lista.length} artículos)`);
}
