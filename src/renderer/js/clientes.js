// Módulo Clientes — ABM y cuenta corriente

// ── Estado ─────────────────────────────────────────────────────
let clientes       = [];
let editandoId     = null;
let cuentaClienteId = null;

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

  await cargarTransaccionesCuenta(id);

  document.getElementById('monto-pago').value = '';
  ocultarErrorPago();

  modalCuenta.classList.remove('hidden');
}

function actualizarSaldoEnModal(saldo) {
  const el  = document.getElementById('cuenta-saldo');
  el.textContent = fmt(saldo);
  el.className   = Number(saldo) > 0
    ? 'ml-1 font-bold text-lg text-red-600'
    : 'ml-1 font-bold text-lg text-green-600';
}

async function cargarTransaccionesCuenta(id) {
  const txs   = await window.api.clientes.getTransacciones(id);
  const tbody = document.getElementById('cuenta-transacciones');

  if (txs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-2 py-5 text-center text-gray-400 text-sm">
          Sin transacciones a crédito
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = txs.map(t => `
    <tr class="hover:bg-gray-50">
      <td class="px-2 py-2 text-xs text-gray-500 font-mono">#${t.id}</td>
      <td class="px-2 py-2 text-xs">${formatFecha(t.created_at)}</td>
      <td class="px-2 py-2 text-right text-xs text-gray-600">${fmt(t.subtotal)}</td>
      <td class="px-2 py-2 text-right text-xs text-gray-600">${fmt(t.monto_impuesto)}</td>
      <td class="px-2 py-2 text-right text-sm font-semibold">${fmt(t.monto_total)}</td>
      <td class="px-2 py-2 text-center">
        <span class="px-1.5 py-0.5 rounded-full text-xs font-medium
          ${t.sync_status === 'synced'
            ? 'bg-green-100 text-green-700'
            : 'bg-yellow-100 text-yellow-700'}">
          ${t.sync_status === 'synced' ? 'Sync' : 'Pendiente'}
        </span>
      </td>
    </tr>`).join('');
}

function cerrarCuenta() {
  modalCuenta.classList.add('hidden');
  cuentaClienteId = null;
}

// ── Registrar pago ─────────────────────────────────────────────
async function registrarPago() {
  ocultarErrorPago();

  const monto = parseFloat(document.getElementById('monto-pago').value) || 0;
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
    const actualizado = await window.api.clientes.registrarPago(cuentaClienteId, monto);

    // Actualizar cache local
    const idx = clientes.findIndex(c => c.id === cuentaClienteId);
    if (idx !== -1) clientes[idx] = actualizado;

    // Actualizar saldo visible en modal
    actualizarSaldoEnModal(actualizado.saldo_vencido);

    document.getElementById('monto-pago').value = '';

    // Refrescar tabla de fondo
    renderTabla(filtrar(inputBusq.value));
  } catch (err) {
    mostrarErrorPago(err.message || 'Error al registrar el pago.');
  } finally {
    btnPagar.disabled    = false;
    btnPagar.textContent = 'Registrar pago';
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
