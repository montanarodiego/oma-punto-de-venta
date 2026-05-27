// Módulo Inventario — movimientos, kardex, ajustes, stock bajo

// ── Estado ────────────────────────────────────────────────────
let articulos     = [];
let movimientos   = [];
let stockBajoData = [];
let ajusteArt     = null;
let kardexArt     = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  articulos = await window.api.articulos.getAll();

  const hoy    = new Date().toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  document.getElementById('mov-desde').value = hace30;
  document.getElementById('mov-hasta').value = hoy;

  bindEventos();
  await Promise.all([cargarMovimientos(), cargarStockBajo()]);
});

// ── Eventos ───────────────────────────────────────────────────
function bindEventos() {
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );

  // Movimientos
  document.getElementById('btn-buscar-mov').addEventListener('click', cargarMovimientos);
  document.getElementById('mov-busqueda').addEventListener('input', filtrarMovimientosLocal);
  document.getElementById('mov-tipo').addEventListener('change', cargarMovimientos);
  document.getElementById('btn-exportar-mov').addEventListener('click', exportarMovCSV);

  // Kardex
  document.getElementById('kardex-busqueda').addEventListener('input', buscarArtKardex);
  document.getElementById('kardex-busqueda').addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarKardexDD();
  });
  document.getElementById('kardex-dropdown').addEventListener('click', e => {
    const item = e.target.closest('[data-art-id]');
    if (item) seleccionarKardexArt(parseInt(item.dataset.artId));
  });

  // Ajustes
  document.getElementById('ajuste-busqueda').addEventListener('input', buscarArtAjuste);
  document.getElementById('ajuste-busqueda').addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarAjusteDD();
  });
  document.getElementById('ajuste-dropdown').addEventListener('click', e => {
    const item = e.target.closest('[data-art-id]');
    if (item) seleccionarAjusteArt(parseInt(item.dataset.artId));
  });
  document.getElementById('ajuste-tipo').addEventListener('change', actualizarPreviewAjuste);
  document.getElementById('ajuste-cantidad').addEventListener('input', actualizarPreviewAjuste);
  document.getElementById('ajuste-cantidad').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); ejecutarAjuste(); }
  });
  document.getElementById('btn-ejecutar-ajuste').addEventListener('click', ejecutarAjuste);

  // Stock bajo
  document.getElementById('btn-exportar-stock-bajo').addEventListener('click', exportarStockBajoCSV);

  // Cerrar dropdowns al click fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('#kardex-busqueda') && !e.target.closest('#kardex-dropdown'))
      cerrarKardexDD();
    if (!e.target.closest('#ajuste-busqueda') && !e.target.closest('#ajuste-dropdown'))
      cerrarAjusteDD();
  });

  // Navegación por teclado en dropdowns de autocomplete
  window.bindDropdownKeyboard({
    inputEl:   document.getElementById('kardex-busqueda'),
    dropdownId:'kardex-dropdown',
    optSel:    '[data-art-id]',
    onSelect:  item => seleccionarKardexArt(parseInt(item.dataset.artId)),
    onClose:   cerrarKardexDD,
  });
  window.bindDropdownKeyboard({
    inputEl:   document.getElementById('ajuste-busqueda'),
    dropdownId:'ajuste-dropdown',
    optSel:    '[data-art-id]',
    onSelect:  item => seleccionarAjusteArt(parseInt(item.dataset.artId)),
    onClose:   cerrarAjusteDD,
  });
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => { el.style.display = 'none'; });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === name;
    btn.style.color        = active ? 'var(--text)'              : 'var(--text-subtle)';
    btn.style.borderBottom = active ? '2px solid var(--accent)'  : '2px solid transparent';
  });
  const panel = document.getElementById(`tab-${name}`);
  panel.style.display = 'flex';
}

// ── Tab Movimientos ───────────────────────────────────────────
async function cargarMovimientos() {
  const desde = document.getElementById('mov-desde').value;
  const hasta = document.getElementById('mov-hasta').value;
  const tipo  = document.getElementById('mov-tipo').value || undefined;

  movimientos = await window.api.inventario.listarMovimientos({ desde, hasta, tipo });
  filtrarMovimientosLocal();
}

function filtrarMovimientosLocal() {
  const q = document.getElementById('mov-busqueda').value.trim().toLowerCase();
  const lista = q
    ? movimientos.filter(m =>
        (m.articulo_nombre || '').toLowerCase().includes(q) ||
        (m.articulo_codigo || '').toLowerCase().includes(q)
      )
    : movimientos;
  renderMovimientos(lista);
}

function renderMovimientos(lista) {
  const tbody = document.getElementById('tabla-movimientos');
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-subtle);padding:32px 0;">Sin movimientos en el período seleccionado.</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(m => {
    const cambioColor = m.cantidad_cambio >= 0 ? '#86efac' : '#fca5a5';
    const cambioStr   = m.cantidad_cambio >= 0 ? `+${fmtNum(m.cantidad_cambio)}` : fmtNum(m.cantidad_cambio);
    return `<tr>
      <td style="padding:7px 10px;white-space:nowrap;font-size:11px;color:var(--text-subtle);">${fmtFecha(m.fecha)}</td>
      <td style="padding:7px 10px;">
        <span style="font-weight:500;font-size:12px;">${esc(m.articulo_nombre || '—')}</span><br>
        <span style="font-size:10px;font-family:monospace;color:var(--text-subtle);">${esc(m.articulo_codigo || '')}</span>
      </td>
      <td style="padding:7px 10px;">${tipoBadge(m.tipo)}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(m.motivo || '—')}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;color:var(--text-subtle);">${fmtNum(m.cantidad_anterior)}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;font-weight:700;color:${cambioColor};">${cambioStr}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;font-weight:600;">${fmtNum(m.cantidad_resultante)}</td>
      <td style="padding:7px 10px;font-size:11px;color:var(--text-subtle);">${esc(m.usuario || '—')}</td>
    </tr>`;
  }).join('');
}

function exportarMovCSV() {
  const q = document.getElementById('mov-busqueda').value.trim().toLowerCase();
  const lista = q
    ? movimientos.filter(m =>
        (m.articulo_nombre || '').toLowerCase().includes(q) ||
        (m.articulo_codigo || '').toLowerCase().includes(q)
      )
    : movimientos;

  exportCSV(lista, [
    { h: 'Fecha',          fn: m => fmtFecha(m.fecha) },
    { h: 'Código',         k:  'articulo_codigo'       },
    { h: 'Artículo',       k:  'articulo_nombre'       },
    { h: 'Tipo',           k:  'tipo'                  },
    { h: 'Motivo',         k:  'motivo'                },
    { h: 'Cant. anterior', k:  'cantidad_anterior'     },
    { h: 'Cambio',         k:  'cantidad_cambio'       },
    { h: 'Resultante',     k:  'cantidad_resultante'   },
    { h: 'Costo',          k:  'costo_unitario'        },
    { h: 'Precio',         k:  'precio_unitario'       },
    { h: 'Usuario',        k:  'usuario'               },
  ], 'movimientos_inventario.csv');
}

// ── Tab Kardex ────────────────────────────────────────────────
function buscarArtKardex() {
  const q  = document.getElementById('kardex-busqueda').value.trim().toLowerCase();
  const dd = document.getElementById('kardex-dropdown');
  if (!q) { dd.style.display = 'none'; return; }

  const res = articulos.filter(a =>
    a.nombre.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q)
  ).slice(0, 10);

  if (!res.length) { dd.style.display = 'none'; return; }

  dd.innerHTML = res.map(a => `
    <div data-art-id="${a.id}" style="padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border);">
      <span style="font-size:12px;font-weight:500;">${esc(a.nombre)}</span>
      <span style="font-size:11px;color:var(--text-subtle);margin-left:8px;font-family:monospace;">${esc(a.codigo)}</span>
    </div>`).join('');
  dd.style.display = 'block';
}

function cerrarKardexDD() {
  document.getElementById('kardex-dropdown').style.display = 'none';
}

async function seleccionarKardexArt(id) {
  cerrarKardexDD();
  const art = articulos.find(a => a.id === id);
  if (!art) return;
  kardexArt = art;
  document.getElementById('kardex-busqueda').value = art.nombre;
  document.getElementById('kardex-vacio').style.display    = 'none';
  document.getElementById('kardex-loading').style.display  = 'flex';
  document.getElementById('kardex-resultado').style.display = 'none';

  try {
    const data = await window.api.inventario.kardex(id);
    renderKardex(data);
    document.getElementById('kardex-resultado').style.display = 'flex';
  } catch (err) {
    toast('Error: ' + (err.message || err), 'error');
    document.getElementById('kardex-vacio').style.display = 'flex';
  } finally {
    document.getElementById('kardex-loading').style.display = 'none';
  }
}

function renderKardex({ articulo, movimientos: movs }) {
  document.getElementById('kardex-art-info').innerHTML = `
    <div style="display:flex;gap:24px;flex-wrap:wrap;">
      <div>
        <div style="font-size:11px;color:var(--text-subtle);">Artículo</div>
        <div style="font-weight:600;font-size:14px;">${esc(articulo.nombre)}</div>
        <div style="font-size:11px;color:var(--text-subtle);font-family:monospace;">${esc(articulo.codigo)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-subtle);">Stock actual</div>
        <div style="font-weight:700;font-size:16px;">${fmtNum(articulo.stock_actual)} <span style="font-size:12px;font-weight:400;color:var(--text-subtle);">${articulo.unidad_medida || 'u.'}</span></div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-subtle);">Costo actual</div>
        <div style="font-weight:600;font-size:14px;">${fmt(articulo.costo_unitario)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-subtle);">Precio actual</div>
        <div style="font-weight:600;font-size:14px;">${fmt(articulo.precio_unitario)}</div>
      </div>
    </div>`;

  const tbody = document.getElementById('tabla-kardex');
  if (!movs.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-subtle);padding:24px 0;">Sin movimientos registrados para este artículo.</td></tr>`;
    return;
  }
  tbody.innerHTML = movs.map(m => {
    const cambioColor = m.cantidad_cambio >= 0 ? '#86efac' : '#fca5a5';
    const cambioStr   = m.cantidad_cambio >= 0 ? `+${fmtNum(m.cantidad_cambio)}` : fmtNum(m.cantidad_cambio);
    return `<tr>
      <td style="padding:7px 10px;white-space:nowrap;font-size:11px;color:var(--text-subtle);">${fmtFecha(m.fecha)}</td>
      <td style="padding:7px 10px;">${tipoBadge(m.tipo)}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--text-muted);">${esc(m.motivo || '—')}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;color:var(--text-subtle);">${fmtNum(m.cantidad_anterior)}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;font-weight:700;color:${cambioColor};">${cambioStr}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;font-weight:600;">${fmtNum(m.cantidad_resultante)}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;color:var(--text-subtle);">${fmt(m.costo_unitario)}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;color:var(--text-subtle);">${fmt(m.precio_unitario)}</td>
    </tr>`;
  }).join('');
}

// ── Tab Ajustes ───────────────────────────────────────────────
function buscarArtAjuste() {
  const q  = document.getElementById('ajuste-busqueda').value.trim().toLowerCase();
  const dd = document.getElementById('ajuste-dropdown');
  if (!q) { dd.style.display = 'none'; return; }

  const res = articulos.filter(a =>
    a.usa_inventario &&
    (a.nombre.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q))
  ).slice(0, 10);

  if (!res.length) { dd.style.display = 'none'; return; }

  dd.innerHTML = res.map(a => `
    <div data-art-id="${a.id}" style="padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border);">
      <span style="font-size:12px;font-weight:500;">${esc(a.nombre)}</span>
      <span style="font-size:11px;color:var(--text-subtle);margin-left:8px;font-family:monospace;">${esc(a.codigo)}</span>
      <span style="font-size:11px;color:var(--text-muted);margin-left:6px;">Stock: ${fmtNum(a.stock_actual)}</span>
    </div>`).join('');
  dd.style.display = 'block';
}

function cerrarAjusteDD() {
  document.getElementById('ajuste-dropdown').style.display = 'none';
}

function seleccionarAjusteArt(id) {
  cerrarAjusteDD();
  ajusteArt = articulos.find(a => a.id === id);
  if (!ajusteArt) return;

  document.getElementById('ajuste-busqueda').value = ajusteArt.nombre;
  document.getElementById('ajuste-art-info').style.display  = '';
  document.getElementById('ajuste-form').style.display      = 'flex';
  document.getElementById('ajuste-art-nombre').textContent  = ajusteArt.nombre;
  document.getElementById('ajuste-art-codigo').textContent  = ajusteArt.codigo;
  document.getElementById('ajuste-art-stock').textContent   = `${fmtNum(ajusteArt.stock_actual)} ${ajusteArt.unidad_medida || 'u.'}`;
  document.getElementById('ajuste-error-inv').classList.add('hidden');
  document.getElementById('ajuste-cantidad').value = '';
  document.getElementById('ajuste-motivo').value   = '';
  actualizarPreviewAjuste();
  document.getElementById('ajuste-cantidad').focus();
}

function actualizarPreviewAjuste() {
  if (!ajusteArt) return;
  const tipo  = document.getElementById('ajuste-tipo').value;
  const cant  = parseFloat(document.getElementById('ajuste-cantidad').value) || 0;
  const label = document.getElementById('ajuste-cant-label');
  const prev  = document.getElementById('ajuste-preview');
  const actual = ajusteArt.stock_actual;
  let nuevo;

  if (tipo === 'entrada')     { nuevo = actual + cant; label.innerHTML = 'Cantidad a sumar <span class="required">*</span>'; }
  else if (tipo === 'salida') { nuevo = actual - cant; label.innerHTML = 'Cantidad a restar <span class="required">*</span>'; }
  else                        { nuevo = cant;           label.innerHTML = 'Nuevo stock total <span class="required">*</span>'; }

  const color = nuevo < actual ? '#fca5a5' : nuevo > actual ? '#86efac' : 'var(--text)';
  prev.innerHTML = `<span style="color:var(--text-subtle);">Actual:</span> <strong>${fmtNum(actual)}</strong> → <span style="color:var(--text-subtle);">Nuevo:</span> <strong style="color:${color};">${fmtNum(nuevo)}</strong>`;
}

async function ejecutarAjuste() {
  if (!ajusteArt) return;
  const tipo    = document.getElementById('ajuste-tipo').value;
  const cantidad = parseFloat(document.getElementById('ajuste-cantidad').value);
  const motivo  = document.getElementById('ajuste-motivo').value.trim();
  const usuario = document.getElementById('ajuste-usuario').value.trim();
  const errEl   = document.getElementById('ajuste-error-inv');
  errEl.classList.add('hidden');

  if (!(cantidad > 0)) { errEl.textContent = 'La cantidad debe ser mayor a 0.'; errEl.classList.remove('hidden'); return; }
  if (!motivo)          { errEl.textContent = 'El motivo es obligatorio.';        errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('btn-ejecutar-ajuste');
  btn.disabled = true; btn.textContent = 'Procesando...';

  try {
    const r = await window.api.inventario.ajustar({
      articulo_id: ajusteArt.id,
      tipo_ajuste: tipo,
      cantidad,
      motivo,
      usuario: usuario || null,
    });

    articulos = await window.api.articulos.getAll();
    ajusteArt = articulos.find(a => a.id === ajusteArt.id);
    if (ajusteArt) {
      document.getElementById('ajuste-art-stock').textContent = `${fmtNum(ajusteArt.stock_actual)} ${ajusteArt.unidad_medida || 'u.'}`;
    }
    document.getElementById('ajuste-cantidad').value = '';
    document.getElementById('ajuste-motivo').value   = '';
    actualizarPreviewAjuste();
    toast(`Stock ajustado: ${fmtNum(r.anterior)} → ${fmtNum(r.nuevo)}`);
    await cargarStockBajo();
  } catch (err) {
    errEl.textContent = 'Error: ' + (err.message || err);
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Aplicar ajuste';
  }
}

// ── Tab Stock bajo ────────────────────────────────────────────
async function cargarStockBajo() {
  stockBajoData = await window.api.inventario.stockBajo();
  renderStockBajo();
  const badge = document.getElementById('tab-badge-stock-bajo');
  badge.textContent = stockBajoData.length > 0 ? String(stockBajoData.length) : '';
  badge.style.display = stockBajoData.length > 0 ? 'inline-block' : 'none';
}

function renderStockBajo() {
  document.getElementById('stock-bajo-count').textContent =
    stockBajoData.length === 0
      ? 'Todos los artículos tienen stock suficiente.'
      : `${stockBajoData.length} artículo${stockBajoData.length !== 1 ? 's' : ''} con stock ≤ mínimo`;

  const tbody = document.getElementById('tabla-stock-bajo');
  if (!stockBajoData.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-subtle);padding:32px 0;">No hay artículos con stock bajo.</td></tr>`;
    return;
  }
  tbody.innerHTML = stockBajoData.map(a => {
    const diff      = a.stock_actual - a.stock_minimo;
    const diffColor = diff < 0 ? '#fca5a5' : '#fcd34d';
    const depto     = a.departamento_nombre
      ? `<span style="padding:1px 7px;border-radius:10px;font-size:11px;background:${a.departamento_color || '#6b7280'}22;color:${a.departamento_color || '#6b7280'};border:1px solid ${a.departamento_color || '#6b7280'}44;">${esc(a.departamento_nombre)}</span>`
      : '<span style="color:var(--text-subtle);font-size:11px;">—</span>';
    return `<tr>
      <td style="padding:7px 10px;font-family:monospace;font-size:11px;color:var(--text-subtle);">${esc(a.codigo)}</td>
      <td style="padding:7px 10px;font-weight:500;">${esc(a.nombre)}</td>
      <td style="padding:7px 10px;">${depto}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:700;color:#fca5a5;">${fmtNum(a.stock_actual)}</td>
      <td style="padding:7px 10px;text-align:right;color:var(--text-subtle);">${fmtNum(a.stock_minimo)}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:700;color:${diffColor};">${fmtNum(diff)}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--text-subtle);">${esc(a.proveedor || '—')}</td>
    </tr>`;
  }).join('');
}

function exportarStockBajoCSV() {
  exportCSV(stockBajoData, [
    { h: 'Código',       k: 'codigo'              },
    { h: 'Nombre',       k: 'nombre'              },
    { h: 'Departamento', k: 'departamento_nombre' },
    { h: 'Stock actual', k: 'stock_actual'        },
    { h: 'Stock mínimo', k: 'stock_minimo'        },
    { h: 'Diferencia',   fn: a => a.stock_actual - a.stock_minimo },
    { h: 'Proveedor',    k: 'proveedor'           },
    { h: 'Costo',        k: 'costo_unitario'      },
    { h: 'Precio venta', k: 'precio_unitario'     },
  ], 'stock_bajo.csv');
}

// ── Helpers ───────────────────────────────────────────────────
const TIPOS = {
  venta:          { label: 'Venta',         color: '#fca5a5', bg: 'rgba(239,68,68,.15)'  },
  devolucion:     { label: 'Devolución',    color: '#93c5fd', bg: 'rgba(59,130,246,.15)' },
  ajuste:         { label: 'Ajuste',        color: '#fcd34d', bg: 'rgba(245,158,11,.15)' },
  recepcion:      { label: 'Recepción',     color: '#86efac', bg: 'rgba(34,197,94,.15)'  },
  entrada_compra: { label: 'Entrada compra',color: '#a5f3fc', bg: 'rgba(6,182,212,.15)'  },
};

function tipoBadge(tipo) {
  const t = TIPOS[tipo] || { label: tipo, color: 'var(--text-subtle)', bg: 'var(--surface)' };
  return `<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500;background:${t.bg};color:${t.color};white-space:nowrap;">${t.label}</span>`;
}

function fmtFecha(s) {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function fmt(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n ?? 0);
}

function fmtNum(n) {
  const num = parseFloat(n) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(3).replace(/\.?0+$/, '');
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, tipo = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function exportCSV(data, cols, filename) {
  const headers = cols.map(c => `"${c.h}"`).join(',');
  const rows    = data.map(row =>
    cols.map(c => {
      const val = c.fn ? c.fn(row) : (row[c.k] ?? '');
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\n');
  const blob = new Blob(['﻿' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
