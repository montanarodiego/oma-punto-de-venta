// Módulo Turno — apertura / cierre de caja

let turnoActivo = null;

const panelSinTurno    = document.getElementById('panel-sin-turno');
const panelTurnoActivo = document.getElementById('panel-turno-activo');
const formAbrir        = document.getElementById('form-abrir');
const formCerrar       = document.getElementById('form-cerrar');
const inpEfectivoReal  = document.getElementById('inp-efectivo-real');
const errorCierre      = document.getElementById('error-cierre');
const diferenciaValor  = document.getElementById('diferencia-valor');

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await cargar();
});

async function cargar() {
  const [turno, historial] = await Promise.all([
    window.api.turnos.obtenerActivo(),
    window.api.turnos.historial(30),
  ]);

  turnoActivo = turno;
  renderEstado();
  renderHistorial(historial);

  if (turno) {
    const resumen = await window.api.turnos.calcularResumen(turno.id);
    renderResumen(resumen);
  }
}

// ── Render estado ───────────────────────────────────────────────
function renderEstado() {
  if (turnoActivo) {
    panelSinTurno.classList.add('hidden');
    panelTurnoActivo.classList.remove('hidden');

    document.getElementById('turno-fecha-apertura').textContent =
      fmtFecha(turnoActivo.fecha_apertura);
    document.getElementById('turno-efectivo-inicial').textContent =
      fmt(turnoActivo.efectivo_inicial);
    document.getElementById('turno-total-transacciones').textContent = '—';
    document.getElementById('turno-resumen-ventas').innerHTML = '';
    document.getElementById('turno-total-ventas').textContent = '—';
    document.getElementById('turno-ventas-efectivo').textContent = '—';
    document.getElementById('turno-efectivo-esperado').textContent = '—';
  } else {
    panelSinTurno.classList.remove('hidden');
    panelTurnoActivo.classList.add('hidden');
  }
}

function renderResumen(r) {
  document.getElementById('turno-total-transacciones').textContent = r.total_transacciones;
  document.getElementById('turno-total-ventas').textContent        = fmt(r.total_ventas);
  document.getElementById('turno-ventas-efectivo').textContent     = fmt(r.ventas_efectivo);
  document.getElementById('turno-efectivo-esperado').textContent   = fmt(r.efectivo_esperado);

  const totalPropinas = r.total_propinas ?? 0;
  const filaPropinas  = document.getElementById('fila-propinas');
  if (totalPropinas > 0) {
    document.getElementById('turno-total-propinas').textContent = fmt(totalPropinas);
    filaPropinas.style.display = 'flex';
  } else {
    filaPropinas.style.display = 'none';
  }

  const medios = [
    { label: 'Efectivo',          valor: r.ventas_efectivo },
    { label: 'Débito',            valor: r.ventas_debito },
    { label: 'Crédito',           valor: r.ventas_credito },
    { label: 'Transferencia',     valor: r.ventas_transferencia },
    { label: 'Cuenta corriente',  valor: r.ventas_cuenta_corriente },
    { label: 'Propinas',          valor: totalPropinas, color: '#a78bfa' },
  ];

  document.getElementById('turno-resumen-ventas').innerHTML = medios
    .filter(m => m.valor > 0)
    .map(m => `
      <div style="background:var(--surface-2);border-radius:var(--r-in);padding:10px 14px;">
        <div style="font-size:11px;color:var(--text-subtle);margin-bottom:3px;">${esc(m.label)}</div>
        <div style="font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;${m.color ? `color:${m.color};` : ''}">${fmt(m.valor)}</div>
      </div>`)
    .join('') || '<div style="color:var(--text-subtle);font-size:13px;">Sin ventas aún en este turno.</div>';

  // Actualiza diferencia en tiempo real si hay valor en el input
  calcularDiferencia(r.efectivo_esperado);
}

// ── Abrir turno ─────────────────────────────────────────────────
formAbrir.addEventListener('submit', async e => {
  e.preventDefault();
  const efectivo = parseFloat(document.getElementById('inp-efectivo-inicial').value) || 0;
  const btn = formAbrir.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    turnoActivo = await window.api.turnos.abrir(efectivo);
    renderEstado();
    const historial = await window.api.turnos.historial(30);
    renderHistorial(historial);
  } finally {
    btn.disabled = false;
  }
});

// ── Cerrar turno ────────────────────────────────────────────────
inpEfectivoReal.addEventListener('input', async () => {
  if (!turnoActivo) return;
  const resumen = await window.api.turnos.calcularResumen(turnoActivo.id);
  calcularDiferencia(resumen.efectivo_esperado);
});

function calcularDiferencia(esperado) {
  const real = parseFloat(inpEfectivoReal.value);
  if (isNaN(real)) {
    diferenciaValor.textContent = '—';
    diferenciaValor.style.color = 'var(--text-subtle)';
    return;
  }
  const diff = real - esperado;
  diferenciaValor.textContent = (diff >= 0 ? '+' : '') + fmt(diff);
  diferenciaValor.style.color = diff >= 0 ? '#4ade80' : '#f87171';
}

formCerrar.addEventListener('submit', async e => {
  e.preventDefault();
  errorCierre.classList.add('hidden');

  const _raw = inpEfectivoReal.value.trim();
  const efectivoReal = _raw === '' ? 0 : parseFloat(_raw);
  if (isNaN(efectivoReal) || efectivoReal < 0)
    return mostrarErrorCierre('Ingresá el efectivo real en caja (puede ser $0).');

  if (!confirm('¿Cerrar el turno actual? Esta acción no se puede deshacer.')) return;

  const btn = document.getElementById('btn-cerrar-turno');
  btn.disabled = true;

  try {
    const notas = document.getElementById('inp-notas-cierre').value.trim();
    await window.api.turnos.cerrar(turnoActivo.id, efectivoReal, notas);
    turnoActivo = null;
    document.getElementById('inp-notas-cierre').value = '';
    inpEfectivoReal.value = '';
    diferenciaValor.textContent = '—';
    diferenciaValor.style.color = 'var(--text-subtle)';
    renderEstado();
    const historial = await window.api.turnos.historial(30);
    renderHistorial(historial);
  } catch (err) {
    mostrarErrorCierre(err.message || 'Error al cerrar el turno.');
  } finally {
    btn.disabled = false;
  }
});

// ── Actualizar resumen ──────────────────────────────────────────
document.getElementById('btn-actualizar-resumen').addEventListener('click', async () => {
  if (!turnoActivo) return;
  const resumen = await window.api.turnos.calcularResumen(turnoActivo.id);
  renderResumen(resumen);
});

// ── Historial ───────────────────────────────────────────────────
function renderHistorial(lista) {
  const tbody = document.getElementById('tabla-historial');
  if (!lista || lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-subtle);padding:28px 0;">Sin turnos registrados.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(t => {
    const diff     = t.diferencia ?? null;
    const diffColor = diff === null ? '' : diff >= 0 ? 'color:#4ade80' : 'color:#f87171';
    const diffTxt  = diff === null ? '—' : (diff >= 0 ? '+' : '') + fmt(diff);
    const estadoBadge = t.estado === 'abierto'
      ? '<span style="background:rgba(34,197,94,.15);color:#4ade80;font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;">ABIERTO</span>'
      : '<span style="background:rgba(100,116,139,.15);color:var(--text-muted);font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;">CERRADO</span>';
    return `
      <tr>
        <td style="font-variant-numeric:tabular-nums;">#${t.id}</td>
        <td style="white-space:nowrap;">${fmtFecha(t.fecha_apertura)}</td>
        <td style="white-space:nowrap;">${t.fecha_cierre ? fmtFecha(t.fecha_cierre) : '—'}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;">${t.total_ventas != null ? fmt(t.total_ventas) : '—'}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;">${t.efectivo_esperado != null ? fmt(t.efectivo_esperado) : '—'}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;">${t.efectivo_real != null ? fmt(t.efectivo_real) : '—'}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;${diffColor}">${diffTxt}</td>
        <td style="text-align:center;">${estadoBadge}</td>
      </tr>`;
  }).join('');
}

// ── Helpers ─────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
  }).format(n ?? 0);
}

function fmtFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mostrarErrorCierre(msg) {
  errorCierre.textContent = msg;
  errorCierre.classList.remove('hidden');
}
