// Módulo Clientes — ABM y cuenta corriente

// ── Estado ─────────────────────────────────────────────────────
let clientes        = [];
let editandoId      = null;
let cuentaClienteId = null;
let cancelarAbonoId = null;
let tabCuenta       = 'pagos';

// ── Refs DOM ───────────────────────────────────────────────────
const tabla         = document.getElementById('tabla-clientes');
const inputBusq     = document.getElementById('busqueda');
const modal         = document.getElementById('modal');
const modalTitulo   = document.getElementById('modal-titulo');
const form          = document.getElementById('form-cliente');
const errorMsg      = document.getElementById('error-msg');
const modalConfirm  = document.getElementById('modal-confirm');
const confirmNombre = document.getElementById('confirm-nombre');
const modalCuenta   = document.getElementById('modal-cuenta');

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', cargarClientes);

inputBusq.addEventListener('input', () => renderTabla(filtrar(inputBusq.value)));

document.getElementById('btn-nuevo').addEventListener('click', abrirModalNuevo);
document.getElementById('btn-cancelar-modal').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar-confirm').addEventListener('click', cerrarConfirm);
document.getElementById('btn-cerrar-cuenta').addEventListener('click', cerrarCuenta);
document.getElementById('btn-pagar').addEventListener('click', registrarPago);
form.addEventListener('submit', guardar);

modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
modalConfirm.addEventListener('click', e => { if (e.target === modalConfirm) cerrarConfirm(); });
modalCuenta.addEventListener('click', e => { if (e.target === modalCuenta) cerrarCuenta(); });

// Tabs historial cuenta
document.querySelectorAll('.cuenta-tab').forEach(btn =>
  btn.addEventListener('click', () => cambiarTabCuenta(btn.dataset.tab))
);

// Liquidar deuda
document.getElementById('btn-liquidar-deuda').addEventListener('click', abrirLiquidar);
document.getElementById('btn-cerrar-liquidar').addEventListener('click', cerrarLiquidar);
document.getElementById('btn-cancelar-liquidar').addEventListener('click', cerrarLiquidar);
document.getElementById('btn-confirmar-liquidar').addEventListener('click', confirmarLiquidar);
document.getElementById('modal-liquidar').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-liquidar')) cerrarLiquidar();
});

// Cancelar abono
document.getElementById('btn-cerrar-cancelar-abono').addEventListener('click', cerrarCancelarAbono);
document.getElementById('btn-no-cancelar-abono').addEventListener('click', cerrarCancelarAbono);
document.getElementById('btn-si-cancelar-abono').addEventListener('click', confirmarCancelarAbono);
document.getElementById('modal-cancelar-abono').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-cancelar-abono')) cerrarCancelarAbono();
});

tabla.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id     = parseInt(btn.dataset.id, 10);
  const action = btn.dataset.action;
  if (action === 'editar')   abrirModalEdicion(id);
  if (action === 'eliminar') abrirConfirm(id);
  if (action === 'cuenta')   abrirCuenta(id);
});

// ── Carga ──────────────────────────────────────────────────────
async function cargarClientes() {
  clientes = await window.api.clientes.getAll();
  renderTabla(filtrar(inputBusq.value));
}

// ── Filtro ─────────────────────────────────────────────────────
function filtrar(q) {
  const term = q.trim().toLowerCase();
  if (!term) return clientes;
  return clientes.filter(c =>
    c.nombre.toLowerCase().includes(term) ||
    (c.telefono || '').toLowerCase().includes(term)
  );
}

// ── Render tabla ───────────────────────────────────────────────
function renderTabla(lista) {
  if (lista.length === 0) {
    const msg = inputBusq.value.trim()
      ? 'Sin resultados para la búsqueda'
      : 'No hay clientes. Creá el primero con "+ Nuevo cliente".';
    tabla.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">${msg}</td></tr>`;
    return;
  }

  tabla.innerHTML = lista.map(c => {
    const conDeuda = Number(c.saldo_vencido) > 0;
    const rowCls   = conDeuda ? 'bg-red-50' : 'hover:bg-gray-50';
    const saldoCls = conDeuda ? 'text-red-600 font-bold' : 'text-gray-700';

    return `
      <tr class="${rowCls} transition-colors">
        <td class="px-4 py-2.5">
          <span class="font-medium">${esc(c.nombre)}</span>
          ${conDeuda ? '<span class="ml-2 text-xs text-red-500 font-semibold">&#9888; Deuda</span>' : ''}
        </td>
        <td class="px-4 py-2.5 text-gray-600">${esc(c.telefono || '—')}</td>
        <td class="px-4 py-2.5 text-gray-500 text-sm">${esc(c.direccion || '—')}</td>
        <td class="px-4 py-2.5 text-right text-gray-600">${fmt(c.limite_credito)}</td>
        <td class="px-4 py-2.5 text-right ${saldoCls}">${fmt(c.saldo_vencido)}</td>
        <td class="px-4 py-2.5 text-center whitespace-nowrap">
          <button data-action="cuenta"   data-id="${c.id}"
            class="text-purple-600 hover:text-purple-800 text-xs font-medium mr-2 hover:underline">
            Ver cuenta
          </button>
          <button data-action="editar"   data-id="${c.id}"
            class="text-blue-600 hover:text-blue-800 text-xs font-medium mr-2 hover:underline">
            Editar
          </button>
          <button data-action="eliminar" data-id="${c.id}"
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
  modalTitulo.textContent       = 'Nuevo cliente';
  form.nombre.value             = '';
  form.telefono.value           = '';
  form.direccion.value          = '';
  form.limite_credito.value     = '0';
  ocultarError();
  modal.classList.remove('hidden');
  form.nombre.focus();
}

function abrirModalEdicion(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;

  editandoId                    = id;
  modalTitulo.textContent       = 'Editar cliente';
  form.nombre.value             = c.nombre          ?? '';
  form.telefono.value           = c.telefono        ?? '';
  form.direccion.value          = c.direccion       ?? '';
  form.limite_credito.value     = c.limite_credito  ?? 0;
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
    nombre:         form.nombre.value.trim(),
    telefono:       form.telefono.value.trim()   || null,
    direccion:      form.direccion.value.trim()  || null,
    limite_credito: parseFloat(form.limite_credito.value) || 0,
  };

  if (!data.nombre)
    return mostrarError('El nombre es obligatorio.');
  if (data.limite_credito < 0)
    return mostrarError('El límite de crédito no puede ser negativo.');

  bloquearFormulario(true);
  try {
    if (editandoId !== null) {
      const actualizado = await window.api.clientes.update(editandoId, data);
      const idx = clientes.findIndex(c => c.id === editandoId);
      if (idx !== -1) clientes[idx] = actualizado;
    } else {
      const nuevo = await window.api.clientes.create(data);
      clientes.push(nuevo);
      clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
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
  const c = clientes.find(x => x.id === id);
  if (!c) return;

  confirmNombre.textContent = c.nombre;

  const btnConfirmar = document.getElementById('btn-confirmar-eliminar');
  const clone = btnConfirmar.cloneNode(true);
  btnConfirmar.parentNode.replaceChild(clone, btnConfirmar);
  clone.addEventListener('click', async () => {
    cerrarConfirm();
    await window.api.clientes.delete(id);
    clientes = clientes.filter(x => x.id !== id);
    renderTabla(filtrar(inputBusq.value));
  });

  modalConfirm.classList.remove('hidden');
}

function cerrarConfirm() {
  modalConfirm.classList.add('hidden');
}

// ── Detalle de cuenta ──────────────────────────────────────────
async function abrirCuenta(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;

  cuentaClienteId = id;

  document.getElementById('cuenta-nombre').textContent    = esc(c.nombre);
  document.getElementById('cuenta-telefono').textContent  = c.telefono  || '—';
  document.getElementById('cuenta-direccion').textContent = c.direccion || '—';
  document.getElementById('cuenta-limite').textContent    = fmt(c.limite_credito);

  actualizarSaldoEnModal(c.saldo_vencido);
  cambiarTabCuenta('pagos');

  await Promise.all([
    cargarPagosCuenta(id),
    cargarTransaccionesCuenta(id),
  ]);

  document.getElementById('monto-pago').value = '';
  ocultarErrorPago();

  modalCuenta.classList.remove('hidden');
}

function actualizarSaldoEnModal(saldo) {
  const el  = document.getElementById('cuenta-saldo');
  el.textContent = fmt(saldo);
  el.style.color = Number(saldo) > 0 ? '#fca5a5' : '#4ade80';

  const btnLiquidar = document.getElementById('btn-liquidar-deuda');
  if (Number(saldo) > 0) {
    btnLiquidar.classList.remove('hidden');
  } else {
    btnLiquidar.classList.add('hidden');
  }
}

function cambiarTabCuenta(tab) {
  tabCuenta = tab;
  document.querySelectorAll('.cuenta-tab').forEach(btn => {
    const activo = btn.dataset.tab === tab;
    btn.style.color       = activo ? 'var(--accent)' : 'var(--text-subtle)';
    btn.style.borderBottom = activo ? '2px solid var(--accent)' : '2px solid transparent';
    btn.classList.toggle('active', activo);
  });
  document.getElementById('panel-cuenta-pagos').style.display   = tab === 'pagos'   ? '' : 'none';
  document.getElementById('panel-cuenta-compras').style.display = tab === 'compras' ? '' : 'none';
}

async function cargarPagosCuenta(id) {
  const pagos = await window.api.clientes.listarPagos(id);
  const tbody = document.getElementById('cuenta-pagos');

  const FORMA_LABEL = {
    efectivo:        'Efectivo',
    transferencia:   'Transferencia',
    tarjeta_debito:  'Tarjeta débito',
    tarjeta_credito: 'Tarjeta crédito',
  };

  if (!pagos.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-subtle);font-size:13px;">Sin abonos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = pagos.map(p => {
    const cancelado   = p.estado === 'cancelado';
    const esDevAbono  = p.tipo   === 'dev_abono';
    const rowStyle    = cancelado ? 'opacity:.5;' : (esDevAbono ? 'background:rgba(239,68,68,.05);' : '');
    const montoColor  = esDevAbono ? '#f87171' : '#4ade80';
    const signo       = esDevAbono ? '+' : '−';
    const tipoLabel   = esDevAbono ? 'Reversión' : 'Abono';

    let badge = '';
    if (cancelado)  badge = `<span style="font-size:10px;font-weight:700;background:rgba(156,163,175,.2);color:#9ca3af;padding:1px 6px;border-radius:999px;margin-left:6px;">CANCELADO</span>`;
    if (esDevAbono) badge = `<span style="font-size:10px;font-weight:700;background:rgba(239,68,68,.15);color:#f87171;padding:1px 6px;border-radius:999px;margin-left:6px;">REVERSIÓN</span>`;

    const accion = (!cancelado && !esDevAbono)
      ? `<button data-action="cancelar-abono" data-id="${p.id}" data-monto="${p.monto}"
           style="font-size:11px;color:#f87171;background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:var(--r-in);"
           onmouseover="this.style.background='rgba(239,68,68,.1)'" onmouseout="this.style.background='none'">
           Cancelar
         </button>`
      : '';

    return `
      <tr style="${rowStyle}">
        <td style="padding:7px 10px;font-size:12px;color:var(--text-subtle);">${formatFecha(p.created_at)}</td>
        <td style="padding:7px 10px;font-size:12px;">${tipoLabel}${badge}</td>
        <td style="padding:7px 10px;font-size:12px;color:var(--text-muted);">${FORMA_LABEL[p.forma_pago] || p.forma_pago}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:600;font-size:13px;font-variant-numeric:tabular-nums;color:${montoColor};">
          ${signo} ${fmt(p.monto)}
        </td>
        <td style="padding:7px 6px;text-align:center;">${accion}</td>
      </tr>`;
  }).join('');

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action="cancelar-abono"]');
    if (!btn) return;
    const pagoId = parseInt(btn.dataset.id, 10);
    const monto  = parseFloat(btn.dataset.monto);
    abrirCancelarAbono(pagoId, monto);
  }, { once: true });
}

async function cargarTransaccionesCuenta(id) {
  const txs   = await window.api.clientes.getTransacciones(id);
  const tbody = document.getElementById('cuenta-transacciones');

  if (txs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-subtle);font-size:13px;">Sin transacciones a crédito.</td></tr>`;
    return;
  }

  tbody.innerHTML = txs.map(t => `
    <tr>
      <td style="padding:6px 8px;font-size:12px;font-family:monospace;color:var(--text-muted);">#${t.id}</td>
      <td style="padding:6px 8px;font-size:12px;">${formatFecha(t.created_at)}</td>
      <td style="padding:6px 8px;text-align:right;font-size:12px;">${fmt(t.subtotal)}</td>
      <td style="padding:6px 8px;text-align:right;font-size:12px;">${fmt(t.monto_impuesto)}</td>
      <td style="padding:6px 8px;text-align:right;font-size:13px;font-weight:600;">${fmt(t.monto_total)}</td>
      <td style="padding:6px 8px;text-align:center;">
        <span style="font-size:11px;padding:1px 7px;border-radius:999px;font-weight:600;
          ${t.sync_status === 'synced'
            ? 'background:rgba(34,197,94,.15);color:#4ade80;'
            : 'background:rgba(251,191,36,.15);color:#fbbf24;'}">
          ${t.sync_status === 'synced' ? 'Sync' : 'Pendiente'}
        </span>
      </td>
    </tr>`).join('');
}

function cerrarCuenta() {
  modalCuenta.classList.add('hidden');
  cuentaClienteId = null;
}

// ── Registrar abono ────────────────────────────────────────────
async function registrarPago() {
  ocultarErrorPago();

  const monto     = parseFloat(document.getElementById('monto-pago').value) || 0;
  const formaPago = document.getElementById('forma-pago-abono').value;

  if (monto <= 0)
    return mostrarErrorPago('El monto debe ser mayor a 0.');

  const cliente = clientes.find(c => c.id === cuentaClienteId);
  if (cliente && monto > Number(cliente.saldo_vencido))
    return mostrarErrorPago(
      `El monto (${fmt(monto)}) supera el saldo vencido (${fmt(cliente.saldo_vencido)}).`
    );

  const btnPagar = document.getElementById('btn-pagar');
  btnPagar.disabled    = true;
  btnPagar.textContent = 'Registrando...';

  try {
    const actualizado = await window.api.clientes.registrarPago(cuentaClienteId, monto, formaPago);

    const idx = clientes.findIndex(c => c.id === cuentaClienteId);
    if (idx !== -1) clientes[idx] = actualizado;

    actualizarSaldoEnModal(actualizado.saldo_vencido);
    document.getElementById('monto-pago').value = '';

    await cargarPagosCuenta(cuentaClienteId);
    renderTabla(filtrar(inputBusq.value));
    mostrarToast(`Abono de ${fmt(monto)} registrado.`);
  } catch (err) {
    mostrarErrorPago(err.message || 'Error al registrar el pago.');
  } finally {
    btnPagar.disabled    = false;
    btnPagar.textContent = 'Registrar abono';
  }
}

// ── Cancelar abono ─────────────────────────────────────────────
function abrirCancelarAbono(pagoId, monto) {
  cancelarAbonoId = pagoId;
  document.getElementById('cancelar-abono-monto').textContent = fmt(monto);
  document.getElementById('modal-cancelar-abono').classList.remove('hidden');
}

function cerrarCancelarAbono() {
  document.getElementById('modal-cancelar-abono').classList.add('hidden');
  cancelarAbonoId = null;
}

async function confirmarCancelarAbono() {
  if (!cancelarAbonoId) return;
  const pagoId = cancelarAbonoId;
  cerrarCancelarAbono();
  try {
    const actualizado = await window.api.clientes.cancelarPago(pagoId);
    const idx = clientes.findIndex(c => c.id === cuentaClienteId);
    if (idx !== -1) clientes[idx] = actualizado;

    actualizarSaldoEnModal(actualizado.saldo_vencido);
    await cargarPagosCuenta(cuentaClienteId);
    renderTabla(filtrar(inputBusq.value));
    mostrarToast('Abono cancelado. Saldo actualizado.');
  } catch (err) {
    alert('Error: ' + (err.message || err));
  }
}

// ── Liquidar deuda ─────────────────────────────────────────────
function abrirLiquidar() {
  const c = clientes.find(x => x.id === cuentaClienteId);
  if (!c || Number(c.saldo_vencido) <= 0) return;

  document.getElementById('liquidar-nombre').textContent = c.nombre;
  document.getElementById('liquidar-monto').textContent  = fmt(c.saldo_vencido);
  document.getElementById('liquidar-forma-pago').value   = 'efectivo';
  document.getElementById('modal-liquidar').classList.remove('hidden');
}

function cerrarLiquidar() {
  document.getElementById('modal-liquidar').classList.add('hidden');
}

async function confirmarLiquidar() {
  const formaPago = document.getElementById('liquidar-forma-pago').value;
  const btn = document.getElementById('btn-confirmar-liquidar');
  btn.disabled    = true;
  btn.textContent = 'Procesando...';

  try {
    const actualizado = await window.api.clientes.liquidarDeuda(cuentaClienteId, formaPago);
    cerrarLiquidar();

    const idx = clientes.findIndex(c => c.id === cuentaClienteId);
    const monto = idx !== -1 ? Number(clientes[idx].saldo_vencido) : 0;
    if (idx !== -1) clientes[idx] = actualizado;

    actualizarSaldoEnModal(actualizado.saldo_vencido);
    await cargarPagosCuenta(cuentaClienteId);
    renderTabla(filtrar(inputBusq.value));
    mostrarToast(`Deuda de ${fmt(monto)} liquidada.`);
  } catch (err) {
    alert('Error: ' + (err.message || err));
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Liquidar';
  }
}

// ── Helpers ────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
  }).format(n ?? 0);
}

function formatFecha(str) {
  if (!str) return '—';
  const d = new Date(str.replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

function mostrarErrorPago(msg) {
  const el = document.getElementById('error-pago');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function ocultarErrorPago() {
  const el = document.getElementById('error-pago');
  el.textContent = '';
  el.classList.add('hidden');
}

function bloquearFormulario(bloquear) {
  const btn = document.getElementById('btn-guardar');
  btn.disabled    = bloquear;
  btn.textContent = bloquear ? 'Guardando...' : 'Guardar';
}

function mostrarToast(msg) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
