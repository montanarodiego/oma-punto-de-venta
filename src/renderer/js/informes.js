// ── Constantes ─────────────────────────────────────────────────
const FORMAS_PAGO = {
  efectivo:         'Efectivo',
  tarjeta_debito:   'Tarjeta débito',
  tarjeta_credito:  'Tarjeta crédito',
  transferencia:    'Transferencia',
  cuenta_corriente: 'Crédito cliente',
};

const FORMAS_COLORES = {
  efectivo:         '#22c55e',
  tarjeta_debito:   '#3b82f6',
  tarjeta_credito:  '#f59e0b',
  transferencia:    '#8b5cf6',
  cuenta_corriente: '#ef4444',
};

const MODOS_SIN_IVA = new Set(['monotributista', 'restaurante']);

// ── Estado ─────────────────────────────────────────────────────
let periodoActual  = 'mes';
let desdeActual    = '';
let hastaActual    = '';
let modoNegocio    = '';
let detalleAbierto = false;
const datos = { ventas: null, articulos: null, utilidad: null, saldos: null };
let chartVentas = null;
let chartPagos  = null;

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  modoNegocio = (await window.api.config.get('modo_negocio')) || '';

  const hoy = new Date();
  document.getElementById('fecha-hasta').value = fmtDateInput(hoy);
  document.getElementById('fecha-desde').value = fmtDateInput(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  document.querySelectorAll('.period-tab').forEach(btn =>
    btn.addEventListener('click', () => seleccionarPeriodo(btn.dataset.periodo))
  );

  document.getElementById('btn-aplicar-rango').addEventListener('click', actualizarDashboard);

  document.getElementById('btn-toggle-detalle').addEventListener('click', () => {
    detalleAbierto = !detalleAbierto;
    document.getElementById('detalle-tabla').style.display = detalleAbierto ? 'block' : 'none';
    document.getElementById('detalle-chevron').classList.toggle('open', detalleAbierto);
  });

  document.getElementById('btn-exportar-ventas').addEventListener('click',
    e => { e.stopPropagation(); exportarVentas(); }
  );
  document.getElementById('btn-exportar-articulos').addEventListener('click', exportarArticulos);
  document.getElementById('btn-exportar-utilidad').addEventListener('click',  exportarUtilidadLazy);
  document.getElementById('btn-exportar-saldos').addEventListener('click',    exportarSaldosLazy);

  seleccionarPeriodo('mes');
});

// ── Período ────────────────────────────────────────────────────
function seleccionarPeriodo(periodo) {
  periodoActual = periodo;
  document.querySelectorAll('.period-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.periodo === periodo)
  );
  const rangoEl = document.getElementById('rango-personalizado');
  rangoEl.style.display = periodo === 'personalizado' ? 'flex' : 'none';
  if (periodo !== 'personalizado') actualizarDashboard();
}

function calcularFechas(periodo) {
  const hoy   = new Date();
  const today = fmtDateInput(hoy);
  switch (periodo) {
    case 'hoy':
      return { desde: today, hasta: today };
    case 'semana': {
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      return { desde: fmtDateInput(lunes), hasta: today };
    }
    case 'mes': {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: fmtDateInput(primero), hasta: today };
    }
    case 'anio': {
      const primero = new Date(hoy.getFullYear(), 0, 1);
      return { desde: fmtDateInput(primero), hasta: today };
    }
    case 'personalizado':
      return {
        desde: document.getElementById('fecha-desde').value,
        hasta: document.getElementById('fecha-hasta').value,
      };
    default:
      return { desde: today, hasta: today };
  }
}

function calcularFechasAnterior(desde, hasta) {
  const d    = new Date(desde + 'T00:00:00');
  const h    = new Date(hasta  + 'T00:00:00');
  const dias = Math.round((h - d) / 86400000) + 1;
  const h2   = new Date(d);
  h2.setDate(h2.getDate() - 1);
  const d2 = new Date(h2);
  d2.setDate(d2.getDate() - dias + 1);
  return { desde: fmtDateInput(d2), hasta: fmtDateInput(h2) };
}

// ── Dashboard update ───────────────────────────────────────────
async function actualizarDashboard() {
  const { desde, hasta } = calcularFechas(periodoActual);
  if (!desde || !hasta || desde > hasta) return;

  desdeActual = desde;
  hastaActual = hasta;

  const esPorHora = periodoActual === 'hoy';
  document.getElementById('chart-ventas-title').textContent =
    esPorHora ? 'Ventas por hora' : 'Ventas por día';

  ponerCargando();

  try {
    const { desde: ad, hasta: ah } = calcularFechasAnterior(desde, hasta);

    const [ventas, serie, mejorDiaRes, anterior, articulos] = await Promise.all([
      window.api.informes.ventasPorPeriodo(desde, hasta),
      esPorHora
        ? window.api.informes.ventasPorHora(desde)
        : window.api.informes.ventasPorDia(desde, hasta),
      window.api.informes.mejorDia(desde, hasta),
      window.api.informes.resumenRapido(ad, ah),
      window.api.informes.articulosMasVendidos(desde, hasta),
    ]);

    datos.ventas    = ventas;
    datos.articulos = articulos;
    datos.utilidad  = null; // invalidate cache on period change
    datos.saldos    = null;

    renderKPIs(ventas.resumen, anterior, mejorDiaRes);
    renderChartVentas(serie, esPorHora);
    renderChartPagos(ventas.porFormaPago, ventas.resumen.total);
    renderTop5(articulos);
    renderTablaDetalle(ventas.transacciones);

  } catch (err) {
    console.error('[Informes] Error al cargar dashboard:', err);
  }
}

function ponerCargando() {
  ['total', 'ganancia', 'transacciones', 'mejor-dia'].forEach(id => {
    const el = document.getElementById(`kpi-${id}`);
    if (!el) return;
    el.querySelector('.kpi-card-value').textContent = '…';
    el.querySelector('.kpi-card-sub').innerHTML = '';
  });
}

// ── KPIs ───────────────────────────────────────────────────────
function renderKPIs(resumen, anterior, mejorDia) {
  const ganancia = Number(resumen.ganancia_bruta) || 0;
  const margen   = resumen.total > 0 ? (ganancia / resumen.total * 100) : 0;
  const ticket   = resumen.cantidad > 0 ? resumen.total / resumen.cantidad : 0;

  function varHtml(actual, prev) {
    if (!prev || prev === 0) return '';
    const pct  = ((actual - prev) / prev) * 100;
    const signo = pct >= 0 ? '+' : '';
    const cls   = pct > 0 ? 'pos' : pct < 0 ? 'neg' : 'neu';
    return ` <span class="kpi-variation ${cls}">${signo}${pct.toFixed(1)}%</span>`;
  }

  function setKPI(id, valor, sub, varStr) {
    const el = document.getElementById(`kpi-${id}`);
    if (!el) return;
    el.querySelector('.kpi-card-value').textContent = valor;
    el.querySelector('.kpi-card-sub').innerHTML =
      `<span style="color:var(--text-muted)">${sub}</span>${varStr}`;
  }

  setKPI('total',          fmt(resumen.total),   'vs período anterior',
    varHtml(resumen.total, anterior.total));
  setKPI('ganancia',       fmt(ganancia),         `Margen ${fmtPct(margen)}`,
    varHtml(ganancia, Number(anterior.ganancia_bruta)));
  setKPI('transacciones',  String(resumen.cantidad), `Ticket prom. ${fmt(ticket)}`,
    varHtml(resumen.cantidad, anterior.cantidad));

  const mejorEl = document.getElementById('kpi-mejor-dia');
  if (mejorEl) {
    if (mejorDia && mejorDia.total > 0) {
      const [y, m, d] = mejorDia.fecha.split('-');
      mejorEl.querySelector('.kpi-card-value').textContent = fmt(mejorDia.total);
      mejorEl.querySelector('.kpi-card-sub').innerHTML =
        `<span style="color:var(--text-muted)">${d}/${m}/${y} · ${mejorDia.cantidad} vta${mejorDia.cantidad !== 1 ? 's' : ''}</span>`;
    } else {
      mejorEl.querySelector('.kpi-card-value').textContent = '—';
      mejorEl.querySelector('.kpi-card-sub').innerHTML =
        '<span style="color:var(--text-muted)">Sin datos</span>';
    }
  }
}

// ── Chart: Ventas por día / hora ───────────────────────────────
function renderChartVentas(serie, esPorHora) {
  const canvas = document.getElementById('chart-ventas');
  if (!canvas) return;
  if (chartVentas) { chartVentas.destroy(); chartVentas = null; }
  if (!serie || serie.length === 0) return;

  const labels  = esPorHora
    ? serie.map(d => `${String(d.hora).padStart(2, '0')}:00`)
    : serie.map(d => { const [, m, day] = d.fecha.split('-'); return `${day}/${m}`; });
  const totales = serie.map(d => Number(d.total) || 0);

  chartVentas = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ventas',
        data: totales,
        backgroundColor: 'rgba(59,130,246,0.65)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: '#3b82f6',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#e2e8f0',
          padding: 10,
          callbacks: { label: ctx => ` ${fmt(ctx.raw)}` },
        },
      },
      scales: {
        x: {
          grid: { color: '#334155' },
          ticks: { color: '#94a3b8', font: { size: 11 }, maxRotation: 45 },
          border: { color: '#334155' },
        },
        y: {
          grid: { color: '#334155' },
          ticks: {
            color: '#94a3b8', font: { size: 11 },
            callback: v => v >= 1000 ? '$' + (v / 1000).toFixed(0) + 'k' : '$' + v,
          },
          border: { color: '#334155' },
        },
      },
    },
  });
}

// ── Chart: Medios de pago (donut) ──────────────────────────────
function renderChartPagos(formasPago, totalVentas) {
  if (chartPagos) { chartPagos.destroy(); chartPagos = null; }

  const leyenda = document.getElementById('leyenda-formas-pago');
  if (!leyenda) return;

  if (!formasPago || formasPago.length === 0) {
    leyenda.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Sin datos</span>';
    return;
  }

  const canvas = document.getElementById('chart-formas-pago');
  const colores = formasPago.map(fp => FORMAS_COLORES[fp.forma_pago] || '#64748b');

  chartPagos = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: formasPago.map(fp => FORMAS_PAGO[fp.forma_pago] || fp.forma_pago),
      datasets: [{
        data: formasPago.map(fp => Number(fp.total) || 0),
        backgroundColor: colores,
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: false,
      cutout: '68%',
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: '#3b82f6',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#e2e8f0',
          padding: 10,
          callbacks: {
            label: ctx => {
              const pct = totalVentas > 0
                ? (ctx.raw / totalVentas * 100).toFixed(1) : '0.0';
              return ` ${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
            },
          },
        },
      },
    },
  });

  leyenda.innerHTML = formasPago.map(fp => {
    const pct   = totalVentas > 0 ? (fp.total / totalVentas * 100).toFixed(1) : '0.0';
    const color = FORMAS_COLORES[fp.forma_pago] || '#64748b';
    return `<div class="pago-leyenda-item">
      <span class="pago-leyenda-dot" style="background:${color}"></span>
      <span class="pago-leyenda-label">${FORMAS_PAGO[fp.forma_pago] || fp.forma_pago}</span>
      <span class="pago-leyenda-pct">${pct}%</span>
      <span class="pago-leyenda-total">${fmt(fp.total)}</span>
    </div>`;
  }).join('');
}

// ── Top 5 artículos ────────────────────────────────────────────
function renderTop5(articulos) {
  const el = document.getElementById('top5-articulos');
  if (!el) return;

  if (!articulos || articulos.length === 0) {
    el.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Sin artículos en el período</span>';
    return;
  }

  const top5   = articulos.slice(0, 5);
  const maxImp = Math.max(...top5.map(a => Number(a.importe_total) || 0), 1);

  el.innerHTML = top5.map((a, i) => {
    const imp = Number(a.importe_total) || 0;
    const gan = Number(a.ganancia) || 0;
    const pct = ((imp / maxImp) * 100).toFixed(1);
    return `<div class="top5-item">
      <span class="top5-rank">${i + 1}</span>
      <div class="top5-info">
        <div class="top5-name" title="${esc(a.nombre)}">${esc(a.nombre)}</div>
        <div class="top5-bar-wrap"><div class="top5-bar" style="width:${pct}%"></div></div>
      </div>
      <div style="text-align:right;">
        <div class="top5-amount">${fmt(imp)}</div>
        <div style="font-size:11px;color:${gan >= 0 ? '#22c55e' : '#ef4444'}">${fmt(gan)}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Tabla detalle (collapsible) ────────────────────────────────
function renderTablaDetalle(transacciones) {
  const countEl = document.getElementById('detalle-count');
  if (countEl) countEl.textContent = transacciones.length > 0 ? `(${transacciones.length})` : '';

  const el = document.getElementById('detalle-tabla');
  if (!el) return;

  if (!transacciones || transacciones.length === 0) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:6px 0;">Sin transacciones en el período.</p>';
    return;
  }

  const mostrarIva = !MODOS_SIN_IVA.has(modoNegocio);

  el.innerHTML = `
    <table style="width:100%;font-size:12px;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);">
          <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">#</th>
          <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">Fecha</th>
          <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">Medio de pago</th>
          ${mostrarIva ? '<th style="padding:5px 8px;text-align:right;font-weight:600;color:var(--text-muted);font-size:11px;">Subtotal</th>' : ''}
          ${mostrarIva ? '<th style="padding:5px 8px;text-align:right;font-weight:600;color:var(--text-muted);font-size:11px;">IVA</th>' : ''}
          <th style="padding:5px 8px;text-align:right;font-weight:600;color:var(--text-muted);font-size:11px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${transacciones.map(t => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:5px 8px;color:var(--text-muted);font-family:monospace;">#${t.id}</td>
            <td style="padding:5px 8px;color:var(--text-muted);">${formatFecha(t.created_at)}</td>
            <td style="padding:5px 8px;color:var(--text);">${FORMAS_PAGO[t.forma_pago] || t.forma_pago}</td>
            ${mostrarIva ? `<td style="padding:5px 8px;text-align:right;font-family:monospace;color:var(--text-muted);">${fmt(t.subtotal)}</td>` : ''}
            ${mostrarIva ? `<td style="padding:5px 8px;text-align:right;font-family:monospace;color:var(--text-muted);">${fmt(t.monto_impuesto)}</td>` : ''}
            <td style="padding:5px 8px;text-align:right;font-family:monospace;font-weight:600;color:var(--text);">${fmt(t.monto_total)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Exportar CSV ───────────────────────────────────────────────
function rangoLabel() {
  return `${desdeActual || 'na'}_${hastaActual || 'na'}`;
}

function exportarVentas() {
  if (!datos.ventas) return;
  const rango = rangoLabel();
  const { resumen, porFormaPago, transacciones } = datos.ventas;
  const ganancia = Number(resumen.ganancia_bruta) || 0;
  const margen   = resumen.total > 0 ? (ganancia / resumen.total * 100).toFixed(2) : '0.00';

  const resumenRows = [
    ['Total vendido',   fmtCSV(resumen.total)],
    ['Ganancia bruta',  fmtCSV(ganancia)],
    ['Margen %',        margen.replace('.', ',') + '%'],
    ['Transacciones',   String(resumen.cantidad)],
    ['Ticket promedio', fmtCSV(resumen.cantidad > 0 ? resumen.total / resumen.cantidad : 0)],
    ['IVA recaudado',   fmtCSV(resumen.total_iva)],
    [],
    ['Medio de pago', 'Tickets', 'Total', '%'],
    ...porFormaPago.map(fp => [
      FORMAS_PAGO[fp.forma_pago] || fp.forma_pago,
      String(fp.cantidad),
      fmtCSV(fp.total),
      (resumen.total > 0 ? (fp.total / resumen.total * 100).toFixed(1) : '0.0').replace('.', ',') + '%',
    ]),
    [],
    MODOS_SIN_IVA.has(modoNegocio)
      ? ['#', 'Fecha', 'Forma de pago', 'Total']
      : ['#', 'Fecha', 'Forma de pago', 'Subtotal', 'IVA', 'Total'],
    ...transacciones.map(t => MODOS_SIN_IVA.has(modoNegocio)
      ? [t.id, formatFecha(t.created_at), FORMAS_PAGO[t.forma_pago] || t.forma_pago, fmtCSV(t.monto_total)]
      : [t.id, formatFecha(t.created_at), FORMAS_PAGO[t.forma_pago] || t.forma_pago, fmtCSV(t.subtotal), fmtCSV(t.monto_impuesto), fmtCSV(t.monto_total)]
    ),
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

async function exportarUtilidadLazy() {
  if (!datos.utilidad && desdeActual && hastaActual) {
    datos.utilidad = await window.api.informes.utilidadBruta(desdeActual, hastaActual);
  }
  exportarUtilidad();
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

async function exportarSaldosLazy() {
  if (!datos.saldos) {
    datos.saldos = await window.api.informes.saldosClientes();
  }
  exportarSaldos();
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
  const BOM    = '﻿';
  const SEP    = ';';
  const lineas = [
    headers.join(SEP),
    ...rows.map(r =>
      r.map(v => {
        const s = String(v ?? '');
        return s.includes(SEP) || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
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
