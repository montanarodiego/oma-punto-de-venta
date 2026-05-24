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
const PAGE_SIZE = 20;

// ── Estado ─────────────────────────────────────────────────────
let periodoActual = 'mes';
let desdeActual   = '';
let hastaActual   = '';
let modoNegocio   = '';
let tablaPage     = 0;
let _transacciones = [];
const datos = { ventas: null, articulos: null, utilidad: null, saldos: null };
let chartVentas = null;
let chartPagos  = null;

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  modoNegocio = (await window.api.config.get('modo_negocio')) || '';

  const hoy = new Date();
  document.getElementById('fecha-hasta').value = fmtDateInput(hoy);
  document.getElementById('fecha-desde').value = fmtDateInput(
    new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );

  document.querySelectorAll('[data-periodo]').forEach(btn =>
    btn.addEventListener('click', () => seleccionarPeriodo(btn.dataset.periodo))
  );
  document.getElementById('btn-aplicar-rango').addEventListener('click', actualizarDashboard);

  document.querySelectorAll('.section-tab').forEach(btn =>
    btn.addEventListener('click', () => cambiarSeccion(btn.dataset.section))
  );

  document.querySelectorAll('[data-periodo-cli]').forEach(btn =>
    btn.addEventListener('click', () => seleccionarPeriodoCli(btn.dataset.periodoCli))
  );
  document.getElementById('btn-aplicar-rango-cli').addEventListener('click', () => {
    const desde = document.getElementById('cli-fecha-desde').value;
    const hasta = document.getElementById('cli-fecha-hasta').value;
    if (desde && hasta) cargarVentasPorCliente(desde, hasta);
  });
  document.getElementById('btn-exportar-cli').addEventListener('click', exportarVentasPorCliente);

  document.getElementById('cli-fecha-hasta').value = fmtDateInput(new Date());
  document.getElementById('cli-fecha-desde').value = fmtDateInput(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  document.querySelectorAll('th[data-sort]').forEach(th =>
    th.addEventListener('click', () => sortClientes(th.dataset.sort))
  );

  document.getElementById('btn-exportar-ventas').addEventListener('click', exportarVentas);
  document.getElementById('btn-exportar-articulos').addEventListener('click', exportarArticulos);
  document.getElementById('btn-exportar-utilidad').addEventListener('click', exportarUtilidadLazy);
  document.getElementById('btn-exportar-saldos').addEventListener('click', exportarSaldosLazy);

  document.getElementById('pag-prev').addEventListener('click', () => {
    if (tablaPage > 0) { tablaPage--; renderPagina(); }
  });
  document.getElementById('pag-next').addEventListener('click', () => {
    if ((tablaPage + 1) * PAGE_SIZE < _transacciones.length) { tablaPage++; renderPagina(); }
  });

  seleccionarPeriodo('mes');
});

// ── Período ────────────────────────────────────────────────────
function seleccionarPeriodo(periodo) {
  periodoActual = periodo;
  document.querySelectorAll('[data-periodo]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.periodo === periodo)
  );
  document.getElementById('rango-personalizado').style.display =
    periodo === 'personalizado' ? 'flex' : 'none';
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

  const diasRango  = Math.round((new Date(hasta + 'T00:00:00') - new Date(desde + 'T00:00:00')) / 86400000) + 1;
  const esPorHora  = periodoActual === 'hoy';
  const esPorMes   = periodoActual === 'anio' || diasRango > 62;

  document.getElementById('chart-ventas-title').textContent =
    esPorHora ? 'Ventas por hora' : esPorMes ? 'Ventas por mes' : 'Ventas por día';

  ponerCargando();

  try {
    const { desde: ad, hasta: ah } = calcularFechasAnterior(desde, hasta);

    const seriePromise = esPorHora
      ? window.api.informes.ventasPorHora(desde)
      : esPorMes
        ? window.api.informes.ventasPorMes(desde, hasta)
        : window.api.informes.ventasPorDia(desde, hasta);

    const [ventas, serie, mejorDiaRes, anterior, articulos, deptos, horaRango] = await Promise.all([
      window.api.informes.ventasPorPeriodo(desde, hasta),
      seriePromise,
      window.api.informes.mejorDia(desde, hasta),
      window.api.informes.resumenRapido(ad, ah),
      window.api.informes.articulosMasVendidos(desde, hasta),
      window.api.informes.ventasPorDepartamento(desde, hasta),
      window.api.informes.ventasPorHoraRango(desde, hasta),
    ]);

    datos.ventas    = ventas;
    datos.articulos = articulos;
    datos.utilidad  = null;
    datos.saldos    = null;

    renderKPIs(ventas.resumen, anterior, horaRango, articulos);
    renderChartVentas(serie, esPorHora, esPorMes);
    renderChartPagos(ventas.porFormaPago, ventas.resumen.total);
    renderTop10(articulos);
    renderDepartamentos(deptos);
    renderHoraria(horaRango);
    renderComparativa(ventas.resumen, anterior);
    _transacciones = ventas.transacciones || [];
    tablaPage = 0;
    renderPagina();

  } catch (err) {
    console.error('[Informes] Error al cargar dashboard:', err);
  }
}

function ponerCargando() {
  ['kv-total','kv-ganancia','kv-transacciones','kv-ticket','kv-hora-pico','kv-mejor-prod'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skel" style="width:80px;"></span>';
  });
  ['ks-total','ks-ganancia','ks-transacciones','ks-ticket','ks-hora-pico','ks-mejor-prod'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

// ── Counter animation ──────────────────────────────────────────
function animarKPI(el, valorFinal, formatter, duracion = 550) {
  const inicio = Date.now();
  const step = () => {
    const t    = Math.min((Date.now() - inicio) / duracion, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = formatter(valorFinal * ease);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = formatter(valorFinal);
  };
  requestAnimationFrame(step);
}

// ── KPIs ───────────────────────────────────────────────────────
function renderKPIs(resumen, anterior, horaRango, articulos) {
  const ganancia = Number(resumen.ganancia_bruta) || 0;
  const margen   = resumen.total > 0 ? (ganancia / resumen.total * 100) : 0;
  const ticket   = resumen.cantidad > 0 ? resumen.total / resumen.cantidad : 0;

  function badge(actual, prev) {
    if (!prev || prev === 0) return '';
    const pct    = ((actual - prev) / prev) * 100;
    const signo  = pct >= 0 ? '▲' : '▼';
    const cls    = pct > 0 ? 'pos' : pct < 0 ? 'neg' : 'neu';
    return `<span class="kpi-badge ${cls}">${signo} ${Math.abs(pct).toFixed(1)}%</span>`;
  }

  const kvTotal = document.getElementById('kv-total');
  if (kvTotal) animarKPI(kvTotal, resumen.total, fmt);
  const ksTotal = document.getElementById('ks-total');
  if (ksTotal) ksTotal.innerHTML = `vs anterior ${badge(resumen.total, anterior.total)}`;

  const kvGan = document.getElementById('kv-ganancia');
  if (kvGan) animarKPI(kvGan, ganancia, fmt);
  const ksGan = document.getElementById('ks-ganancia');
  if (ksGan) ksGan.innerHTML = `Margen <strong style="color:var(--text)">${fmtPct(margen)}</strong> ${badge(ganancia, Number(anterior.ganancia_bruta))}`;

  const kvTx = document.getElementById('kv-transacciones');
  if (kvTx) animarKPI(kvTx, resumen.cantidad, v => Math.round(v).toString());
  const ksTx = document.getElementById('ks-transacciones');
  if (ksTx) ksTx.innerHTML = `vs anterior ${badge(resumen.cantidad, anterior.cantidad)}`;

  const kvTick = document.getElementById('kv-ticket');
  if (kvTick) animarKPI(kvTick, ticket, fmt);
  const ksTick = document.getElementById('ks-ticket');
  if (ksTick) ksTick.textContent = resumen.cantidad > 0
    ? `${resumen.cantidad} venta${resumen.cantidad !== 1 ? 's' : ''}`
    : 'Sin ventas';

  const kvHora = document.getElementById('kv-hora-pico');
  const ksHora = document.getElementById('ks-hora-pico');
  if (horaRango && horaRango.length > 0) {
    const pico = horaRango.reduce((a, b) => b.cantidad > a.cantidad ? b : a);
    if (kvHora) kvHora.textContent = `${String(pico.hora).padStart(2,'0')}:00`;
    if (ksHora) ksHora.textContent = `${pico.cantidad} vta${pico.cantidad !== 1 ? 's' : ''}`;
  } else {
    if (kvHora) kvHora.textContent = '—';
    if (ksHora) ksHora.textContent = 'Sin datos';
  }

  const kvProd = document.getElementById('kv-mejor-prod');
  const ksProd = document.getElementById('ks-mejor-prod');
  if (articulos && articulos.length > 0) {
    const top = articulos[0];
    if (kvProd) kvProd.textContent = top.nombre;
    if (ksProd) ksProd.innerHTML = `${fmt(top.importe_total)} · ${fmtNum(top.cantidad_total)} ud.`;
  } else {
    if (kvProd) kvProd.textContent = '—';
    if (ksProd) ksProd.textContent = 'Sin datos';
  }
}

// ── Chart: evolución (área con gradiente) ─────────────────────
function renderChartVentas(serie, esPorHora, esPorMes) {
  const canvas = document.getElementById('chart-ventas');
  if (!canvas) return;
  if (chartVentas) { chartVentas.destroy(); chartVentas = null; }
  if (!serie || serie.length === 0) return;

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  let labels;
  if (esPorHora) {
    labels = serie.map(d => `${String(d.hora).padStart(2,'0')}:00`);
  } else if (esPorMes) {
    labels = serie.map(d => {
      const [y, m] = d.mes.split('-');
      return `${MESES[Number(m) - 1]} ${y.slice(2)}`;
    });
  } else {
    labels = serie.map(d => { const [, m, day] = d.fecha.split('-'); return `${day}/${m}`; });
  }

  const totales = serie.map(d => Number(d.total) || 0);
  const avg = totales.length > 0 ? totales.reduce((s, v) => s + v, 0) / totales.length : 0;

  chartVentas = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ventas',
          data: totales,
          fill: 'start',
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(59,130,246,0.12)';
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, 'rgba(59,130,246,0.32)');
            g.addColorStop(1, 'rgba(59,130,246,0.02)');
            return g;
          },
          borderColor: '#3b82f6',
          borderWidth: 2,
          pointRadius: totales.length <= 20 ? 3 : 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          tension: 0.4,
        },
        {
          label: 'Promedio',
          data: totales.map(() => avg),
          fill: false,
          borderColor: 'rgba(148,163,184,0.35)',
          borderWidth: 1,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#e2e8f0',
          padding: 10,
          callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? ` Ventas: ${fmt(ctx.raw)}`
              : ` Prom: ${fmt(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,.04)' },
          ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45, maxTicksLimit: 18 },
          border: { color: '#334155' },
        },
        y: {
          grid: { color: 'rgba(255,255,255,.04)' },
          ticks: {
            color: '#64748b', font: { size: 10 },
            callback: v => v >= 1000000
              ? '$' + (v / 1000000).toFixed(1) + 'M'
              : v >= 1000
                ? '$' + (v / 1000).toFixed(0) + 'k'
                : '$' + v,
          },
          border: { color: '#334155' },
        },
      },
    },
  });
}

// ── Chart: medios de pago (donut) ──────────────────────────────
function renderChartPagos(formasPago, totalVentas) {
  if (chartPagos) { chartPagos.destroy(); chartPagos = null; }

  const leyenda   = document.getElementById('leyenda-formas-pago');
  const donutVal  = document.getElementById('donut-total-val');
  if (donutVal) donutVal.textContent = fmt(totalVentas);

  if (!leyenda) return;
  if (!formasPago || formasPago.length === 0) {
    leyenda.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Sin datos</span>';
    return;
  }

  const canvas  = document.getElementById('chart-formas-pago');
  const colores = formasPago.map(fp => FORMAS_COLORES[fp.forma_pago] || '#64748b');

  chartPagos = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels:   formasPago.map(fp => FORMAS_PAGO[fp.forma_pago] || fp.forma_pago),
      datasets: [{
        data: formasPago.map(fp => Number(fp.total) || 0),
        backgroundColor: colores,
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: false,
      cutout: '72%',
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#e2e8f0',
          padding: 10,
          callbacks: {
            label: ctx => {
              const pct = totalVentas > 0 ? (ctx.raw / totalVentas * 100).toFixed(1) : '0.0';
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
      <span class="pago-dot" style="background:${color}"></span>
      <span class="pago-lbl">${FORMAS_PAGO[fp.forma_pago] || fp.forma_pago}</span>
      <span class="pago-pct">${pct}%</span>
      <span class="pago-amt">${fmt(fp.total)}</span>
    </div>`;
  }).join('');
}

// ── Top 10 productos (barras horizontales) ─────────────────────
function renderTop10(articulos) {
  const el = document.getElementById('top10-productos');
  if (!el) return;
  if (!articulos || articulos.length === 0) {
    el.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Sin datos</span>';
    return;
  }
  const top = articulos.slice(0, 10);
  const maxImp = Math.max(...top.map(a => Number(a.importe_total) || 0), 1);

  el.innerHTML = top.map(a => {
    const imp    = Number(a.importe_total) || 0;
    const gan    = Number(a.ganancia) || 0;
    const margen = imp > 0 ? gan / imp * 100 : 0;
    const pct    = (imp / maxImp * 100).toFixed(1);
    const color  = margen > 30 ? '#22c55e' : margen > 10 ? '#f59e0b' : '#ef4444';
    return `<div class="hbar-item">
      <div class="hbar-header">
        <span class="hbar-name" title="${esc(a.nombre)}">${esc(a.nombre)}</span>
        <span class="hbar-amount">${fmt(imp)}</span>
      </div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${pct}%;background:${color};"></div>
      </div>
    </div>`;
  }).join('');
}

// ── Departamentos ──────────────────────────────────────────────
function renderDepartamentos(deptos) {
  const el = document.getElementById('dept-list');
  if (!el) return;
  if (!deptos || deptos.length === 0) {
    el.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Sin datos de departamentos</span>';
    return;
  }
  const maxT = Math.max(...deptos.map(d => Number(d.total) || 0), 1);
  el.innerHTML = deptos.slice(0, 7).map(d => {
    const pct = (Number(d.total) / maxT * 100).toFixed(1);
    return `<div class="dept-item">
      <span class="dept-name" title="${esc(d.departamento)}">${esc(d.departamento)}</span>
      <div class="dept-track"><div class="dept-bar" style="width:${pct}%"></div></div>
      <span class="dept-amt">${fmt(d.total)}</span>
    </div>`;
  }).join('');
}

// ── Distribución horaria ───────────────────────────────────────
function renderHoraria(horaRango) {
  const gridEl   = document.getElementById('hora-grid');
  const labelsEl = document.getElementById('hora-labels');
  const infoEl   = document.getElementById('hora-peak-info');
  if (!gridEl) return;

  const porHora = Array.from({ length: 24 }, (_, i) => ({ hora: i, cantidad: 0, total: 0 }));
  if (horaRango) {
    horaRango.forEach(h => { if (porHora[h.hora]) Object.assign(porHora[h.hora], h); });
  }

  const maxCant = Math.max(...porHora.map(h => h.cantidad), 1);
  gridEl.innerHTML = porHora.map(h => {
    const pct     = Math.max((h.cantidad / maxCant) * 100, 2).toFixed(0);
    const opacity = h.cantidad > 0 ? (0.35 + h.cantidad / maxCant * 0.65).toFixed(2) : '0.1';
    return `<div class="hora-bar" title="${h.hora}:00 — ${h.cantidad} vtas"
      style="height:${pct}%;opacity:${opacity};"></div>`;
  }).join('');

  labelsEl.innerHTML = porHora.map((h, i) =>
    `<div class="hora-lbl">${[0, 6, 12, 18].includes(i) ? i : ''}</div>`
  ).join('');

  if (infoEl) {
    if (horaRango && horaRango.length > 0) {
      const pico = horaRango.reduce((a, b) => b.cantidad > a.cantidad ? b : a);
      infoEl.textContent = `Pico: ${String(pico.hora).padStart(2,'0')}:00 · ${pico.cantidad} vta${pico.cantidad !== 1 ? 's' : ''}`;
    } else {
      infoEl.textContent = 'Sin datos';
    }
  }
}

// ── Comparativa de período ─────────────────────────────────────
function renderComparativa(resumen, anterior) {
  const el = document.getElementById('comp-tabla');
  if (!el) return;

  function row(label, cur, prev, fmtr) {
    const pct   = prev > 0 ? ((cur - prev) / prev * 100) : null;
    const cls   = pct === null ? 'neu' : pct > 0 ? 'pos' : pct < 0 ? 'neg' : 'neu';
    const badgeTxt = pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    return `<div class="comp-row">
      <span class="comp-lbl">${label}</span>
      <div class="comp-vals">
        <span class="comp-prev">${fmtr(prev)}</span>
        <span class="kpi-badge ${cls}">${badgeTxt}</span>
        <span class="comp-cur">${fmtr(cur)}</span>
      </div>
    </div>`;
  }

  el.innerHTML = [
    row('Ventas',    resumen.total,                           anterior.total || 0,             fmt),
    row('Ganancia',  Number(resumen.ganancia_bruta) || 0,     Number(anterior.ganancia_bruta) || 0, fmt),
    row('Transac.',  resumen.cantidad,                        anterior.cantidad || 0,           v => Math.round(v).toString()),
  ].join('');
}

// ── Tabla de transacciones (paginada) ──────────────────────────
function renderPagina() {
  const total = _transacciones.length;
  const start = tablaPage * PAGE_SIZE;
  const end   = Math.min(start + PAGE_SIZE, total);
  const page  = _transacciones.slice(start, end);

  const countEl = document.getElementById('detalle-count');
  if (countEl) countEl.textContent = total > 0 ? `(${total})` : '';

  const pagInfoEl = document.getElementById('pag-info');
  if (pagInfoEl) pagInfoEl.textContent = total > 0 ? `${start + 1}–${end} de ${total}` : 'Sin datos';

  const prevBtn = document.getElementById('pag-prev');
  const nextBtn = document.getElementById('pag-next');
  if (prevBtn) prevBtn.disabled = tablaPage === 0;
  if (nextBtn) nextBtn.disabled = end >= total;

  const el = document.getElementById('detalle-tabla');
  if (!el) return;

  if (!page.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:6px 0;">Sin transacciones en el período.</p>';
    return;
  }

  const mostrarIva = !MODOS_SIN_IVA.has(modoNegocio);
  const cols = mostrarIva ? 6 : 4;

  el.innerHTML = `
    <table style="width:100%;font-size:12px;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);">
          <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">#</th>
          <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">Fecha</th>
          <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">Pago</th>
          ${mostrarIva ? '<th style="padding:5px 8px;text-align:right;font-weight:600;color:var(--text-muted);font-size:11px;">Subtotal</th>' : ''}
          ${mostrarIva ? '<th style="padding:5px 8px;text-align:right;font-weight:600;color:var(--text-muted);font-size:11px;">IVA</th>' : ''}
          <th style="padding:5px 8px;text-align:right;font-weight:600;color:var(--text-muted);font-size:11px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${page.map(t => {
          const pagoBadge = t.forma_pago_2
            ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px;">+${FORMAS_PAGO[t.forma_pago_2] || t.forma_pago_2} ${fmt(t.monto_pago_2)}</span>`
            : '';
          return `<tr style="border-bottom:1px solid rgba(255,255,255,.04);">
            <td style="padding:5px 8px;color:var(--text-muted);font-family:monospace;">#${t.id}</td>
            <td style="padding:5px 8px;color:var(--text-muted);">${formatFecha(t.created_at)}</td>
            <td style="padding:5px 8px;color:var(--text);">${FORMAS_PAGO[t.forma_pago] || t.forma_pago}${pagoBadge}</td>
            ${mostrarIva ? `<td style="padding:5px 8px;text-align:right;font-family:monospace;color:var(--text-muted);">${fmt(t.subtotal)}</td>` : ''}
            ${mostrarIva ? `<td style="padding:5px 8px;text-align:right;font-family:monospace;color:var(--text-muted);">${fmt(t.monto_impuesto)}</td>` : ''}
            <td style="padding:5px 8px;text-align:right;font-family:monospace;font-weight:600;color:var(--text);">${fmt(t.monto_total)}</td>
          </tr>`;
        }).join('')}
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

  const rows = [
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
  exportarCSV(`ventas_${rango}.csv`, ['Campo', 'Valor'], rows);
}

function exportarArticulos() {
  if (!datos.articulos) return;
  exportarCSV(`articulos_vendidos_${rangoLabel()}.csv`,
    ['Código', 'Nombre', 'Cantidad total', 'Importe total', 'Ganancia'],
    datos.articulos.map(a => [a.codigo, a.nombre, fmtCSV(a.cantidad_total), fmtCSV(a.importe_total), fmtCSV(Number(a.ganancia) || 0)])
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
  exportarCSV(`utilidad_${rangoLabel()}.csv`,
    ['Código', 'Nombre', 'Costo unitario', 'P. venta promedio', 'Utilidad/u', 'Cantidad', 'Utilidad total'],
    datos.utilidad.items.map(a => {
      const utilXu = Number(a.precio_venta_promedio) - Number(a.costo_unitario);
      return [a.codigo, a.nombre, fmtCSV(a.costo_unitario), fmtCSV(a.precio_venta_promedio),
              fmtCSV(utilXu), fmtCSV(a.cantidad_total), fmtCSV(a.utilidad_total)];
    })
  );
}

async function exportarSaldosLazy() {
  if (!datos.saldos) datos.saldos = await window.api.informes.saldosClientes();
  exportarSaldos();
}

function exportarSaldos() {
  if (!datos.saldos) return;
  exportarCSV('saldos_clientes.csv',
    ['Nombre', 'Teléfono', 'Límite crédito', 'Saldo vencido'],
    datos.saldos.clientes.map(c => [c.nombre, c.telefono || '', fmtCSV(c.limite_credito), fmtCSV(c.saldo_vencido)])
  );
}

function exportarCSV(nombre, headers, rows) {
  const BOM    = '﻿';
  const SEP    = ';';
  const lineas = [
    headers.join(SEP),
    ...rows.map(r => r.length === 0
      ? ''
      : r.map(v => {
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

// ═══════════════════════════════════════════════════════════════
// VENTAS POR CLIENTE
// ═══════════════════════════════════════════════════════════════

let datosClientes = [];
let sortColCli    = 'total_comprado';
let sortDirCli    = 'desc';
let periodoCli    = 'mes';
let desdeCli      = '';
let hastaCli      = '';

function cambiarSeccion(section) {
  document.querySelectorAll('.section-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });
  document.getElementById('section-ventas').style.display   = section === 'ventas'   ? 'flex' : 'none';
  document.getElementById('section-clientes').style.display = section === 'clientes' ? 'flex' : 'none';

  if (section === 'clientes' && !datosClientes.length) {
    seleccionarPeriodoCli('mes');
  }
}

function seleccionarPeriodoCli(periodo) {
  periodoCli = periodo;
  document.querySelectorAll('[data-periodo-cli]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.periodoCli === periodo)
  );
  document.getElementById('rango-personalizado-cli').style.display =
    periodo === 'personalizado' ? 'flex' : 'none';
  if (periodo === 'personalizado') return;

  const { desde, hasta } = calcularFechas(periodo);
  desdeCli = desde;
  hastaCli = hasta;
  cargarVentasPorCliente(desde, hasta);
}

async function cargarVentasPorCliente(desde, hasta) {
  desdeCli = desde;
  hastaCli = hasta;
  const tbody = document.getElementById('tabla-ventas-clientes');
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-subtle);">Cargando...</td></tr>`;
  try {
    datosClientes = await window.api.informes.ventasPorCliente(desde, hasta);
    renderResumenCli();
    renderTablaCli();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:#f87171;">Error: ${esc(err.message)}</td></tr>`;
  }
}

function renderResumenCli() {
  const resEl = document.getElementById('cli-resumen');
  if (!resEl) return;
  const totalClientes = datosClientes.length;
  const totalComprado = datosClientes.reduce((s, c) => s + Number(c.total_comprado), 0);
  const totalGanancia = datosClientes.reduce((s, c) => s + Number(c.ganancia_generada), 0);
  resEl.innerHTML = [
    { label: 'Clientes con compras', value: String(totalClientes), color: 'var(--text)'  },
    { label: 'Total vendido',        value: fmt(totalComprado),    color: '#60a5fa'       },
    { label: 'Ganancia generada',    value: fmt(totalGanancia),    color: '#4ade80'       },
  ].map(k => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg,12px);padding:14px 18px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);">${k.label}</div>
      <div style="font-size:19px;font-weight:700;font-family:monospace;margin-top:5px;color:${k.color};">${k.value}</div>
    </div>`).join('');
}

function renderTablaCli() {
  const tbody = document.getElementById('tabla-ventas-clientes');
  if (!datosClientes.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-subtle);">Sin clientes con compras en el período.</td></tr>`;
    return;
  }
  document.querySelectorAll('.sort-icon').forEach(el => {
    const col = el.dataset.col;
    el.textContent = col === sortColCli ? (sortDirCli === 'asc' ? '↑' : '↓') : '↕';
    el.style.color  = col === sortColCli ? 'var(--accent)' : 'var(--text-muted)';
  });
  const sorted = [...datosClientes].sort((a, b) => {
    const va = sortColCli === 'nombre' ? a.nombre : Number(a[sortColCli]);
    const vb = sortColCli === 'nombre' ? b.nombre : Number(b[sortColCli]);
    if (sortColCli === 'nombre') return sortDirCli === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDirCli === 'asc' ? va - vb : vb - va;
  });
  const maxTotal = Math.max(...sorted.map(c => Number(c.total_comprado)), 1);
  tbody.innerHTML = sorted.map((c, i) => {
    const pct = ((Number(c.total_comprado) / maxTotal) * 100).toFixed(1);
    return `<tr style="${i % 2 === 0 ? '' : 'background:rgba(255,255,255,.02);'}">
      <td style="padding:9px 14px;">
        <div style="font-weight:500;font-size:13px;">${esc(c.nombre)}</div>
        ${c.telefono ? `<div style="font-size:11px;color:var(--text-subtle);">${esc(c.telefono)}</div>` : ''}
        <div style="margin-top:4px;height:2px;background:var(--border);border-radius:1px;width:120px;">
          <div style="height:2px;background:var(--accent);border-radius:1px;width:${pct}%;"></div>
        </div>
      </td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;">${c.cantidad_transacciones}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;font-weight:600;font-family:monospace;">${fmt(c.total_comprado)}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;font-family:monospace;color:#4ade80;">${fmt(c.ganancia_generada)}</td>
    </tr>`;
  }).join('');
}

function sortClientes(col) {
  if (sortColCli === col) {
    sortDirCli = sortDirCli === 'asc' ? 'desc' : 'asc';
  } else {
    sortColCli = col;
    sortDirCli = col === 'nombre' ? 'asc' : 'desc';
  }
  renderTablaCli();
}

function exportarVentasPorCliente() {
  if (!datosClientes.length) return;
  exportarCSV(
    `ventas_por_cliente_${desdeCli || 'na'}_${hastaCli || 'na'}.csv`,
    ['Nombre', 'Teléfono', 'Transacciones', 'Total comprado', 'Ganancia generada'],
    datosClientes.map(c => [
      c.nombre, c.telefono || '', String(c.cantidad_transacciones),
      fmtCSV(c.total_comprado), fmtCSV(c.ganancia_generada),
    ])
  );
}
