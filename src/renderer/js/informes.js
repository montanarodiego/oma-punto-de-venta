// Módulo Informes — 4 reportes con exportación CSV

// ── Constantes ─────────────────────────────────────────────────
const FORMAS_PAGO = {
  efectivo:         'Efectivo',
  tarjeta_debito:   'Tarjeta débito',
  tarjeta_credito:  'Tarjeta crédito',
  transferencia:    'Transferencia',
  cuenta_corriente: 'Crédito cliente',
};

const TABS = ['ventas', 'articulos', 'utilidad', 'saldos'];

// ── Estado ─────────────────────────────────────────────────────
let tabActual = 'ventas';
const datos   = { ventas: null, articulos: null, utilidad: null, saldos: null };

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const hoy      = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  document.getElementById('fecha-desde').value = fmtDateInput(primerDia);
  document.getElementById('fecha-hasta').value = fmtDateInput(hoy);

  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab))
  );

  document.getElementById('btn-generar-ventas').addEventListener('click',    generarVentas);
  document.getElementById('btn-generar-articulos').addEventListener('click', generarArticulos);
  document.getElementById('btn-generar-utilidad').addEventListener('click',  generarUtilidad);
  document.getElementById('btn-generar-saldos').addEventListener('click',    generarSaldos);

  document.getElementById('btn-exportar-ventas').addEventListener('click',    exportarVentas);
  document.getElementById('btn-exportar-articulos').addEventListener('click', exportarArticulos);
  document.getElementById('btn-exportar-utilidad').addEventListener('click',  exportarUtilidad);
  document.getElementById('btn-exportar-saldos').addEventListener('click',    exportarSaldos);
});

// ── Tabs ───────────────────────────────────────────────────────
function cambiarTab(tab) {
  tabActual = tab;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    const activo = btn.dataset.tab === tab;
    btn.classList.toggle('bg-blue-600',    activo);
    btn.classList.toggle('text-white',     activo);
    btn.classList.toggle('text-gray-600',  !activo);
    btn.classList.toggle('hover:bg-gray-50', !activo);
  });

  TABS.forEach(t => {
    document.getElementById(`panel-${t}`).style.display = t === tab ? 'flex' : 'none';
  });

  document.getElementById('filtro-fechas').style.display = tab === 'saldos' ? 'none' : 'flex';
}

// ── Helpers de fecha ───────────────────────────────────────────
function obtenerFechas() {
  return {
    desde: document.getElementById('fecha-desde').value,
    hasta: document.getElementById('fecha-hasta').value,
  };
}

function validarFechas(desde, hasta) {
  if (!desde || !hasta) {
    alert('Seleccioná las fechas de inicio y fin del período.');
    return false;
  }
  if (desde > hasta) {
    alert('La fecha "desde" no puede ser posterior a la fecha "hasta".');
    return false;
  }
  return true;
}

function fmtDateInput(d) {
  return d.toISOString().split('T')[0];
}

function rangoLabel() {
  const { desde, hasta } = obtenerFechas();
  return `${desde}_${hasta}`;
}

// ── Generar: Ventas por período ────────────────────────────────
async function generarVentas() {
  const { desde, hasta } = obtenerFechas();
  if (!validarFechas(desde, hasta)) return;

  const btn = btnGenerar('ventas');
  try {
    datos.ventas = await window.api.informes.ventasPorPeriodo(desde, hasta);
    renderVentas(datos.ventas);
    habilitarExportar('ventas');
  } catch (err) {
    mostrarError('ventas', err.message);
  } finally {
    restaurarBtn(btn, 'Generar informe');
  }
}

function renderVentas({ resumen, porFormaPago, transacciones }) {
  const el = document.getElementById('resultado-ventas');

  if (transacciones.length === 0) {
    el.innerHTML = vacio('Sin transacciones en el período seleccionado.');
    return;
  }

  const ticketPromedio = resumen.cantidad > 0 ? resumen.total / resumen.cantidad : 0;
  const ganancia       = Number(resumen.ganancia_bruta) || 0;
  const margen         = resumen.total > 0 ? (ganancia / resumen.total) * 100 : 0;

  el.innerHTML = `
    <!-- Tarjetas resumen -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 shrink-0">
      ${tarjeta('Total vendido',     fmt(resumen.total),                    'blue')}
      ${tarjeta('Ganancia bruta',    fmt(ganancia),                         ganancia >= 0 ? 'green' : 'red')}
      ${tarjeta('Margen promedio',   fmtPct(margen),                        ganancia >= 0 ? 'green' : 'red')}
      ${tarjeta('Transacciones',     String(resumen.cantidad),              'gray')}
      ${tarjeta('Ticket promedio',   fmt(ticketPromedio),                   'gray')}
      ${tarjeta('IVA recaudado',     fmt(resumen.total_iva),                'gray')}
    </div>

    <!-- Medios de pago -->
    <div class="bg-white rounded-lg border border-gray-200 shrink-0">
      <div class="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Medios de pago
        </span>
      </div>
      <div class="divide-y divide-gray-100">
        ${porFormaPago.map(fp => {
          const pct = resumen.total > 0 ? (fp.total / resumen.total * 100).toFixed(1) : '0.0';
          return `
          <div class="flex items-center justify-between px-4 py-2.5 text-sm">
            <div class="flex items-center gap-3">
              <span class="text-gray-700">${FORMAS_PAGO[fp.forma_pago] || fp.forma_pago}</span>
              <span class="text-xs text-gray-400">${fp.cantidad} ticket${fp.cantidad !== 1 ? 's' : ''}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold text-gray-500 w-12 text-right">${pct}%</span>
              <span class="font-semibold font-mono w-28 text-right">${fmt(fp.total)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Tabla de transacciones -->
    <div class="bg-white rounded-lg border border-gray-200">
      <div class="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Detalle de transacciones (${transacciones.length})
        </span>
      </div>
      <table class="w-full text-sm">
        <thead class="text-gray-500 border-b border-gray-200">
          <tr>
            <th class="px-4 py-2.5 text-left font-medium">#</th>
            <th class="px-4 py-2.5 text-left font-medium">Fecha</th>
            <th class="px-4 py-2.5 text-left font-medium">Forma de pago</th>
            <th class="px-4 py-2.5 text-right font-medium">Subtotal</th>
            <th class="px-4 py-2.5 text-right font-medium">IVA</th>
            <th class="px-4 py-2.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${transacciones.map(t => `
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-2 text-xs text-gray-500 font-mono">#${t.id}</td>
              <td class="px-4 py-2 text-xs">${formatFecha(t.created_at)}</td>
              <td class="px-4 py-2">${FORMAS_PAGO[t.forma_pago] || t.forma_pago}</td>
              <td class="px-4 py-2 text-right font-mono text-gray-600">${fmt(t.subtotal)}</td>
              <td class="px-4 py-2 text-right font-mono text-gray-500">${fmt(t.monto_impuesto)}</td>
              <td class="px-4 py-2 text-right font-semibold font-mono">${fmt(t.monto_total)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Generar: Artículos más vendidos ───────────────────────────
async function generarArticulos() {
  const { desde, hasta } = obtenerFechas();
  if (!validarFechas(desde, hasta)) return;

  const btn = btnGenerar('articulos');
  try {
    datos.articulos = await window.api.informes.articulosMasVendidos(desde, hasta);
    renderArticulos(datos.articulos);
    habilitarExportar('articulos');
  } catch (err) {
    mostrarError('articulos', err.message);
  } finally {
    restaurarBtn(btn, 'Generar informe');
  }
}

function renderArticulos(lista) {
  const el = document.getElementById('resultado-articulos');

  if (lista.length === 0) {
    el.innerHTML = vacio('Sin ventas en el período seleccionado.');
    return;
  }

  el.innerHTML = `
    <div class="bg-white rounded-lg border border-gray-200">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500 border-b border-gray-200">
          <tr>
            <th class="px-4 py-2.5 text-left font-medium">Artículo</th>
            <th class="px-4 py-2.5 text-left font-medium">Código</th>
            <th class="px-4 py-2.5 text-right font-medium">Cantidad vendida</th>
            <th class="px-4 py-2.5 text-right font-medium">Importe total</th>
            <th class="px-4 py-2.5 text-right font-medium">Ganancia</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${lista.map((a, i) => {
            const gan = Number(a.ganancia) || 0;
            return `
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-2.5">
                <span class="inline-flex items-center gap-2">
                  <span class="text-xs font-bold text-gray-400 w-5 text-right">${i + 1}</span>
                  <span class="font-medium">${esc(a.nombre)}</span>
                </span>
              </td>
              <td class="px-4 py-2.5 font-mono text-xs text-gray-500">${esc(a.codigo)}</td>
              <td class="px-4 py-2.5 text-right font-bold">${fmtNum(a.cantidad_total)}</td>
              <td class="px-4 py-2.5 text-right font-semibold font-mono">${fmt(a.importe_total)}</td>
              <td class="px-4 py-2.5 text-right font-semibold font-mono ${gan >= 0 ? 'text-green-700' : 'text-red-600'}">
                ${fmt(gan)}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Generar: Utilidad bruta ────────────────────────────────────
async function generarUtilidad() {
  const { desde, hasta } = obtenerFechas();
  if (!validarFechas(desde, hasta)) return;

  const btn = btnGenerar('utilidad');
  try {
    datos.utilidad = await window.api.informes.utilidadBruta(desde, hasta);
    renderUtilidad(datos.utilidad);
    habilitarExportar('utilidad');
  } catch (err) {
    mostrarError('utilidad', err.message);
  } finally {
    restaurarBtn(btn, 'Generar informe');
  }
}

function renderUtilidad({ items, totalUtilidad }) {
  const el = document.getElementById('resultado-utilidad');

  if (items.length === 0) {
    el.innerHTML = vacio('Sin ventas en el período seleccionado.');
    return;
  }

  el.innerHTML = `
    <!-- Tarjeta total utilidad -->
    <div class="shrink-0">
      ${tarjeta('Utilidad bruta del período', fmt(totalUtilidad), totalUtilidad >= 0 ? 'green' : 'red')}
    </div>

    <!-- Tabla detallada -->
    <div class="bg-white rounded-lg border border-gray-200">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500 border-b border-gray-200">
          <tr>
            <th class="px-4 py-2.5 text-left font-medium">Artículo</th>
            <th class="px-4 py-2.5 text-right font-medium">P. venta prom.</th>
            <th class="px-4 py-2.5 text-right font-medium">Costo actual</th>
            <th class="px-4 py-2.5 text-right font-medium">Utilidad/u</th>
            <th class="px-4 py-2.5 text-right font-medium">Cantidad</th>
            <th class="px-4 py-2.5 text-right font-medium">Utilidad total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${items.map(a => {
            const utilXu   = Number(a.precio_venta_promedio) - Number(a.costo_unitario);
            const positivo = Number(a.utilidad_total) >= 0;
            return `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-2.5">
                  <div class="font-medium">${esc(a.nombre)}</div>
                  <div class="text-xs text-gray-400 font-mono">${esc(a.codigo)}</div>
                </td>
                <td class="px-4 py-2.5 text-right font-mono">${fmt(a.precio_venta_promedio)}</td>
                <td class="px-4 py-2.5 text-right font-mono text-gray-500">${fmt(a.costo_unitario)}</td>
                <td class="px-4 py-2.5 text-right font-mono ${utilXu >= 0 ? 'text-green-600' : 'text-red-600'}">
                  ${fmt(utilXu)}
                </td>
                <td class="px-4 py-2.5 text-right">${fmtNum(a.cantidad_total)}</td>
                <td class="px-4 py-2.5 text-right font-bold font-mono ${positivo ? 'text-green-700' : 'text-red-600'}">
                  ${fmt(a.utilidad_total)}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
        <tfoot class="border-t-2 border-gray-300 bg-gray-50">
          <tr>
            <td colspan="5" class="px-4 py-2.5 text-right text-sm font-semibold text-gray-600">
              Total utilidad bruta
            </td>
            <td class="px-4 py-2.5 text-right font-bold font-mono text-base
              ${totalUtilidad >= 0 ? 'text-green-700' : 'text-red-600'}">
              ${fmt(totalUtilidad)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ── Generar: Saldos de clientes ────────────────────────────────
async function generarSaldos() {
  const btn = btnGenerar('saldos');
  try {
    datos.saldos = await window.api.informes.saldosClientes();
    renderSaldos(datos.saldos);
    habilitarExportar('saldos');
  } catch (err) {
    mostrarError('saldos', err.message);
  } finally {
    restaurarBtn(btn, 'Generar informe');
  }
}

function renderSaldos({ clientes, totalDeuda }) {
  const el = document.getElementById('resultado-saldos');

  if (clientes.length === 0) {
    el.innerHTML = vacio('No hay clientes con saldo vencido.');
    return;
  }

  el.innerHTML = `
    <div class="shrink-0">
      ${tarjeta(`${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} con deuda · Total pendiente`, fmt(totalDeuda), 'red')}
    </div>

    <div class="bg-white rounded-lg border border-gray-200">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500 border-b border-gray-200">
          <tr>
            <th class="px-4 py-2.5 text-left font-medium">Cliente</th>
            <th class="px-4 py-2.5 text-left font-medium">Teléfono</th>
            <th class="px-4 py-2.5 text-right font-medium">Límite crédito</th>
            <th class="px-4 py-2.5 text-right font-medium">Saldo vencido</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${clientes.map(c => `
            <tr class="hover:bg-red-50">
              <td class="px-4 py-2.5 font-medium">${esc(c.nombre)}</td>
              <td class="px-4 py-2.5 text-gray-500">${esc(c.telefono || '—')}</td>
              <td class="px-4 py-2.5 text-right text-gray-600 font-mono">${fmt(c.limite_credito)}</td>
              <td class="px-4 py-2.5 text-right font-bold font-mono text-red-600">${fmt(c.saldo_vencido)}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot class="border-t-2 border-gray-300 bg-gray-50">
          <tr>
            <td colspan="3" class="px-4 py-2.5 text-right text-sm font-semibold text-gray-600">
              Total deuda pendiente
            </td>
            <td class="px-4 py-2.5 text-right font-bold font-mono text-base text-red-600">
              ${fmt(totalDeuda)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ── Exportar CSV ───────────────────────────────────────────────
function exportarVentas() {
  if (!datos.ventas) return;
  const rango = rangoLabel();
  const { resumen, porFormaPago, transacciones } = datos.ventas;
  const ganancia = Number(resumen.ganancia_bruta) || 0;
  const margen   = resumen.total > 0 ? (ganancia / resumen.total * 100).toFixed(2) : '0.00';

  // Hoja 1: resumen
  const resumenRows = [
    ['Total vendido',    fmtCSV(resumen.total)],
    ['Ganancia bruta',   fmtCSV(ganancia)],
    ['Margen %',         margen.replace('.', ',') + '%'],
    ['Transacciones',    String(resumen.cantidad)],
    ['Ticket promedio',  fmtCSV(resumen.cantidad > 0 ? resumen.total / resumen.cantidad : 0)],
    ['IVA recaudado',    fmtCSV(resumen.total_iva)],
    [],
    ['Medio de pago', 'Tickets', 'Total', '%'],
    ...porFormaPago.map(fp => [
      FORMAS_PAGO[fp.forma_pago] || fp.forma_pago,
      String(fp.cantidad),
      fmtCSV(fp.total),
      (resumen.total > 0 ? (fp.total / resumen.total * 100).toFixed(1) : '0.0').replace('.', ',') + '%',
    ]),
    [],
    ['#', 'Fecha', 'Forma de pago', 'Subtotal', 'IVA', 'Total'],
    ...transacciones.map(t => [
      t.id,
      formatFecha(t.created_at),
      FORMAS_PAGO[t.forma_pago] || t.forma_pago,
      fmtCSV(t.subtotal),
      fmtCSV(t.monto_impuesto),
      fmtCSV(t.monto_total),
    ]),
  ];

  exportarCSV(`ventas_${rango}.csv`, ['Campo', 'Valor'], resumenRows);
}

function exportarArticulos() {
  if (!datos.articulos) return;
  const rango = rangoLabel();
  exportarCSV(`articulos_vendidos_${rango}.csv`,
    ['Código', 'Nombre', 'Cantidad total', 'Importe total', 'Ganancia'],
    datos.articulos.map(a => [
      a.codigo,
      a.nombre,
      fmtCSV(a.cantidad_total),
      fmtCSV(a.importe_total),
      fmtCSV(Number(a.ganancia) || 0),
    ])
  );
}

function exportarUtilidad() {
  if (!datos.utilidad) return;
  const rango = rangoLabel();
  exportarCSV(`utilidad_${rango}.csv`,
    ['Código', 'Nombre', 'Costo unitario', 'P. venta promedio', 'Utilidad/u', 'Cantidad', 'Utilidad total'],
    datos.utilidad.items.map(a => {
      const utilXu = Number(a.precio_venta_promedio) - Number(a.costo_unitario);
      return [
        a.codigo,
        a.nombre,
        fmtCSV(a.costo_unitario),
        fmtCSV(a.precio_venta_promedio),
        fmtCSV(utilXu),
        fmtCSV(a.cantidad_total),
        fmtCSV(a.utilidad_total),
      ];
    })
  );
}

function exportarSaldos() {
  if (!datos.saldos) return;
  exportarCSV('saldos_clientes.csv',
    ['Nombre', 'Teléfono', 'Límite crédito', 'Saldo vencido'],
    datos.saldos.clientes.map(c => [
      c.nombre,
      c.telefono || '',
      fmtCSV(c.limite_credito),
      fmtCSV(c.saldo_vencido),
    ])
  );
}

function exportarCSV(nombre, headers, rows) {
  const BOM   = '﻿';   // para que Excel en Windows reconozca UTF-8
  const SEP   = ';';
  const lineas = [
    headers.join(SEP),
    ...rows.map(r =>
      r.map(v => {
        const s = String(v ?? '');
        return s.includes(SEP) || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(SEP)
    ),
  ];
  const blob = new Blob([BOM + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── UI helpers ─────────────────────────────────────────────────
function tarjeta(label, valor, color) {
  const colores = {
    blue:  'bg-blue-50  border-blue-200  text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    red:   'bg-red-50   border-red-200   text-red-700',
    gray:  'bg-white    border-gray-200  text-gray-800',
  };
  const cls = colores[color] || colores.gray;
  return `
    <div class="rounded-lg border p-4 ${cls}">
      <p class="text-xs uppercase tracking-wide opacity-70 font-medium">${label}</p>
      <p class="text-xl font-bold font-mono mt-1">${valor}</p>
    </div>`;
}

function vacio(msg) {
  return `<div class="py-12 text-center text-gray-400 text-sm">${msg}</div>`;
}

function mostrarError(tab, msg) {
  document.getElementById(`resultado-${tab}`).innerHTML =
    `<div class="py-8 text-center text-red-500 text-sm">Error: ${esc(msg)}</div>`;
}

function btnGenerar(tab) {
  const btn = document.getElementById(`btn-generar-${tab}`);
  btn.disabled    = true;
  btn.textContent = 'Generando...';
  return btn;
}

function restaurarBtn(btn, label) {
  btn.disabled    = false;
  btn.textContent = label;
}

function habilitarExportar(tab) {
  document.getElementById(`btn-exportar-${tab}`).disabled = false;
}

// ── Formatters ─────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
  }).format(n ?? 0);
}

function fmtNum(n) {
  const num = parseFloat(n) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(3).replace(/\.?0+$/, '');
}

function fmtPct(n) {
  return (parseFloat(n) || 0).toFixed(1).replace('.', ',') + '%';
}

function fmtCSV(n) {
  return (parseFloat(n) || 0).toFixed(2).replace('.', ',');
}

function formatFecha(str) {
  if (!str) return '—';
  const d = new Date(str.replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateInput(d) {
  return d.toISOString().split('T')[0];
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
