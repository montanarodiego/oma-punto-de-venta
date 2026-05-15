// Módulo Configuración — parámetros del negocio y del sistema

const form    = document.getElementById('form-config');
const mensaje = document.getElementById('mensaje');
let timerMensaje = null;

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', cargarConfig);
form.addEventListener('submit', guardar);
document.getElementById('btn-sync').addEventListener('click', sincronizarAhora);

async function cargarConfig() {
  const config = await window.api.config.getAll();

  form.nombre_negocio.value = config.nombre_negocio ?? '';
  form.direccion.value      = config.direccion       ?? '';
  form.telefono.value       = config.telefono        ?? '';
  form.cuit.value           = config.cuit            ?? '';
  // tasa_iva tiene prioridad; impuesto_porcentaje es el nombre legacy
  form.tasa_iva.value       = config.tasa_iva ?? config.impuesto_porcentaje ?? '21';
  form.moneda.value         = config.moneda          ?? '$';
}

// ── Guardar ────────────────────────────────────────────────────
async function guardar(e) {
  e.preventDefault();
  ocultarMensaje();

  const tasa = parseFloat(form.tasa_iva.value);
  if (isNaN(tasa) || tasa < 0 || tasa > 100) {
    return mostrarMensaje('La tasa de IVA debe ser un número entre 0 y 100.', 'error');
  }

  const valores = {
    nombre_negocio:      form.nombre_negocio.value.trim(),
    direccion:           form.direccion.value.trim(),
    telefono:            form.telefono.value.trim(),
    cuit:                form.cuit.value.trim(),
    tasa_iva:            String(tasa),
    impuesto_porcentaje: String(tasa),   // alias que usan caja.js e informes.js
    moneda:              form.moneda.value.trim() || '$',
  };

  const btn = document.getElementById('btn-guardar');
  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    for (const [clave, valor] of Object.entries(valores)) {
      await window.api.config.set(clave, valor);
    }
    mostrarMensaje('Configuración guardada correctamente.', 'ok');
  } catch (err) {
    mostrarMensaje('Error al guardar: ' + (err.message || err), 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Guardar cambios';
  }
}

// ── Sincronizar ────────────────────────────────────────────────
async function sincronizarAhora() {
  const btn = document.getElementById('btn-sync');
  const res_el = document.getElementById('sync-resultado');

  btn.disabled    = true;
  btn.textContent = 'Sincronizando...';
  res_el.textContent = '';

  const res = await window.api.sync.manual();

  if (res.ok) {
    const s = res.sincronizados;
    const f = res.fallidos;
    res_el.textContent = s === 0 && f === 0
      ? 'No había registros pendientes.'
      : `${s} registro${s !== 1 ? 's' : ''} sincronizado${s !== 1 ? 's' : ''}${f > 0 ? `, ${f} fallido${f !== 1 ? 's' : ''}` : ''}.`;
    res_el.className = f > 0 ? 'text-sm text-yellow-600' : 'text-sm text-green-600';

    // actualizar badge tras sincronizar
    const total = await window.api.sync.contarPendientes();
    const badge = document.getElementById('badge-sync');
    if (badge) {
      if (total > 0) {
        badge.textContent = `${total} pendiente${total === 1 ? '' : 's'}`;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  } else {
    res_el.textContent = 'Error: ' + (res.error || 'error desconocido');
    res_el.className = 'text-sm text-red-600';
  }

  btn.disabled    = false;
  btn.textContent = 'Sincronizar ahora';
}

// ── Mensaje ────────────────────────────────────────────────────
function mostrarMensaje(texto, tipo) {
  clearTimeout(timerMensaje);
  mensaje.textContent = texto;
  mensaje.className   = tipo === 'ok'
    ? 'px-4 py-3 rounded-lg text-sm text-center font-medium bg-green-50 border border-green-200 text-green-700'
    : 'px-4 py-3 rounded-lg text-sm text-center font-medium bg-red-50 border border-red-200 text-red-700';
  mensaje.classList.remove('hidden');

  if (tipo === 'ok') {
    timerMensaje = setTimeout(ocultarMensaje, 3000);
  }
}

function ocultarMensaje() {
  mensaje.classList.add('hidden');
  mensaje.textContent = '';
}
