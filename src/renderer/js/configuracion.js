// Módulo Configuración — parámetros del negocio y del sistema

const form    = document.getElementById('form-config');
const mensaje = document.getElementById('mensaje');
let timerMensaje   = null;
let modoActual     = '';
let tamanoHudActual = 'normal';

const HUD_OPCIONES = [
  { id: 'compacto',     label: 'Compacto',     desc: 'Texto pequeño, más info en pantalla', muestra: 'A' },
  { id: 'normal',      label: 'Normal',        desc: 'Tamaño estándar (recomendado)',        muestra: 'A' },
  { id: 'grande',      label: 'Grande',        desc: 'Para uso a 1-2 metros de distancia',  muestra: 'A' },
  { id: 'gigante',     label: 'Gigante',        desc: 'Máximo tamaño, lectura a distancia',  muestra: 'A' },
];

// ── Definición de modos (misma que caja.js) ────────────────────
const WIZARD_MODOS = [
  {
    id: 'monotributista',
    nombre: 'Monotributista',
    desc: 'Precios finales, sin IVA desglosado',
    ejemplos: 'Kiosco, almacén, bazar, librería',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    iconoPeq: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  },
  {
    id: 'responsable_inscripto',
    nombre: 'Responsable Inscripto',
    desc: 'IVA desglosado (21% por defecto, configurable por producto)',
    ejemplos: 'Distribuidora, mayorista, empresa',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    iconoPeq: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>`,
  },
  {
    id: 'restaurante',
    nombre: 'Restaurante / Rotisería',
    desc: 'Sin IVA desglosado, con opción de propina',
    ejemplos: 'Rotisería, pizzería, comida para llevar',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/><path d="M21 15v7"/></svg>`,
    iconoPeq: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/></svg>`,
  },
  {
    id: 'mayorista',
    nombre: 'Mayorista',
    desc: 'Precios base sin IVA; IVA sumado al total',
    ejemplos: 'Distribuidora, depósito, venta al por mayor',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    iconoPeq: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
  },
  {
    id: 'farmacia',
    nombre: 'Farmacia / Perfumería',
    desc: 'IVA desglosado, múltiples tasas por producto (21%, 10,5%, 0%)',
    ejemplos: 'Farmacia, perfumería, cosmética',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    iconoPeq: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  },
  {
    id: 'personalizado',
    nombre: 'Personalizado',
    desc: 'Configurá manualmente el comportamiento de IVA desde Configuración',
    ejemplos: '',
    icono: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    iconoPeq: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06"/></svg>`,
  },
];

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cargarConfig();
  cargarBackups();
  cargarModoNegocio();
  cargarTamanoHud();
  document.getElementById('btn-cambiar-modo').addEventListener('click', abrirWizard);
  document.getElementById('btn-cancelar-wizard').addEventListener('click', cerrarWizard);
});
form.addEventListener('submit', guardar);
document.getElementById('btn-sync').addEventListener('click', sincronizarAhora);
document.getElementById('btn-backup-ahora').addEventListener('click', hacerBackupAhora);
document.getElementById('btn-abrir-carpeta-backup').addEventListener('click', () => window.api.backup.abrirCarpeta());

async function cargarConfig() {
  const config = await window.api.config.getAll();

  form.nombre_negocio.value = config.nombre_negocio ?? '';
  form.direccion.value      = config.direccion       ?? '';
  form.telefono.value       = config.telefono        ?? '';
  form.cuit.value           = config.cuit            ?? '';
  // tasa_iva tiene prioridad; impuesto_porcentaje es el nombre legacy
  form.tasa_iva.value        = config.tasa_iva ?? config.impuesto_porcentaje ?? '21';
  form.moneda.value          = config.moneda          ?? '$';
  form.mensaje_ticket.value  = config.mensaje_ticket  ?? '';
  // toggle IVA: si no existe la clave se trata como ON (comportamiento previo)
  document.getElementById('toggle-iva').checked = config.mostrar_iva_desglosado !== '0';
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
    nombre_negocio:        form.nombre_negocio.value.trim(),
    direccion:             form.direccion.value.trim(),
    telefono:              form.telefono.value.trim(),
    cuit:                  form.cuit.value.trim(),
    tasa_iva:              String(tasa),
    impuesto_porcentaje:   String(tasa),   // alias que usan caja.js e informes.js
    moneda:                form.moneda.value.trim() || '$',
    mostrar_iva_desglosado: document.getElementById('toggle-iva').checked ? '1' : '0',
    mensaje_ticket:        form.mensaje_ticket.value.trim(),
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

// ── Backup ─────────────────────────────────────────────────────
async function cargarBackups() {
  const lista = await window.api.backup.listar();
  const el    = document.getElementById('lista-backups');
  if (!lista || lista.length === 0) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text-subtle);">Sin backups guardados.</div>';
    return;
  }
  el.innerHTML = lista.map(b => {
    const fecha = new Date(b.fecha).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const kb = (b.tamanio / 1024).toFixed(0);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--surface-2);border-radius:var(--r-in);font-size:12px;">
      <span style="color:var(--text-muted);font-family:monospace;">${esc(b.nombre)}</span>
      <span style="color:var(--text-subtle);white-space:nowrap;margin-left:12px;">${fecha} · ${kb} KB</span>
    </div>`;
  }).join('');
}

async function hacerBackupAhora() {
  const btn = document.getElementById('btn-backup-ahora');
  const res_el = document.getElementById('backup-resultado');
  btn.disabled    = true;
  res_el.textContent = '';
  const res = await window.api.backup.hacerAhora();
  if (res.ok) {
    res_el.textContent = 'Backup creado correctamente.';
    res_el.style.color = '#4ade80';
    await cargarBackups();
  } else {
    res_el.textContent = 'Error: ' + (res.error || 'error desconocido');
    res_el.style.color = '#f87171';
  }
  btn.disabled = false;
  setTimeout(() => { res_el.textContent = ''; }, 4000);
}

// ── Modo Negocio ───────────────────────────────────────────────
async function cargarModoNegocio() {
  const [modo, tasaDefault] = await Promise.all([
    window.api.config.get('modo_negocio'),
    window.api.config.get('tasa_iva'),
  ]);
  modoActual = modo || '';
  renderModoActual(modoActual, tasaDefault);
}

function renderModoActual(modo, tasaDefault) {
  const def  = WIZARD_MODOS.find(m => m.id === modo);
  const nombre     = def ? def.nombre : 'Sin configurar';
  const desc       = def ? def.desc   : 'Abrí Caja para elegir el modo de negocio.';
  const iconoHtml  = def ? def.iconoPeq : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

  document.getElementById('modo-icono').innerHTML       = iconoHtml;
  document.getElementById('modo-nombre').textContent    = nombre;
  document.getElementById('modo-descripcion').textContent = desc;

  // Opciones específicas por modo
  const opRI   = document.getElementById('modo-opciones-ri');
  const opRest = document.getElementById('modo-opciones-rest');
  opRI.style.display   = (modo === 'responsable_inscripto' || modo === 'farmacia') ? 'flex' : 'none';
  opRest.style.display = (modo === 'restaurante') ? 'flex' : 'none';

  if (opRI.style.display !== 'none') {
    const sel = document.getElementById('tasa-iva-default');
    sel.value = tasaDefault || '21';
    sel.onchange = async () => {
      await window.api.config.set('tasa_iva', sel.value);
      await window.api.config.set('impuesto_porcentaje', sel.value);
    };
  }
}

function abrirWizard() {
  const container = document.getElementById('wizard-cards-config');
  container.innerHTML = WIZARD_MODOS.map(m => `
    <button class="wizard-card${m.id === modoActual ? '" style="border-color:#3b82f6;background:rgba(59,130,246,.07);' : '"'} data-modo="${m.id}" type="button">
      <div style="color:#3b82f6;">${m.icono}</div>
      <div>
        <div style="font-weight:700;font-size:14px;color:#f1f5f9;">${esc(m.nombre)}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.5;">${esc(m.desc)}</div>
        ${m.ejemplos ? `<div style="font-size:11px;color:#64748b;margin-top:6px;">${esc(m.ejemplos)}</div>` : ''}
      </div>
    </button>`
  ).join('');

  container.onclick = async e => {
    const card = e.target.closest('.wizard-card[data-modo]');
    if (!card) return;
    await window.api.config.set('modo_negocio', card.dataset.modo);
    modoActual = card.dataset.modo;
    cerrarWizard();
    await cargarModoNegocio();
    mostrarMensaje('Modo de negocio actualizado correctamente.', 'ok');
  };

  document.getElementById('modal-wizard').style.display = 'flex';
}

function cerrarWizard() {
  document.getElementById('modal-wizard').style.display = 'none';
}

// ── Tamaño HUD ─────────────────────────────────────────────────
async function cargarTamanoHud() {
  const valor = await window.api.config.get('tamano_hud');
  tamanoHudActual = valor || 'normal';
  aplicarHudAlDocumento(tamanoHudActual);
  renderTamanoHud();
}

function aplicarHudAlDocumento(id) {
  const html = document.documentElement;
  html.classList.remove('hud-compacto', 'hud-normal', 'hud-grande', 'hud-gigante');
  html.classList.add('hud-' + id);
  localStorage.setItem('oma_hud', id);
}

function renderTamanoHud() {
  const FONT_SIZES = { compacto: '11px', normal: '15px', grande: '20px', gigante: '27px' };
  const container = document.getElementById('hud-size-cards');
  container.innerHTML = HUD_OPCIONES.map(op => {
    const activo = op.id === tamanoHudActual;
    return `<button type="button" data-hud="${op.id}"
      style="display:flex;flex-direction:column;gap:8px;padding:14px;
        border-radius:var(--r);cursor:pointer;font-family:inherit;text-align:left;
        background:${activo ? 'rgba(59,130,246,.1)' : 'var(--surface-2)'};
        border:2px solid ${activo ? '#3b82f6' : 'var(--border)'};
        transition:border-color .15s,background .15s;">
      <span style="font-size:${FONT_SIZES[op.id]};font-weight:700;color:var(--text);line-height:1;">A</span>
      <div>
        <div style="font-size:13px;font-weight:600;color:${activo ? '#93c5fd' : 'var(--text)'};">${esc(op.label)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${esc(op.desc)}</div>
      </div>
    </button>`;
  }).join('');

  container.onclick = async e => {
    const btn = e.target.closest('[data-hud]');
    if (!btn) return;
    tamanoHudActual = btn.dataset.hud;
    await window.api.config.set('tamano_hud', tamanoHudActual);
    aplicarHudAlDocumento(tamanoHudActual);
    renderTamanoHud();
    mostrarMensaje('Tamaño de letra actualizado.', 'ok');
  };
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Gestión de usuarios (solo admin) ──────────────────────────
let editandoUsuarioId = null;

document.addEventListener('DOMContentLoaded', () => {
  const esAdmin = !!(window.SESSION && window.SESSION.rol === 'admin');
  const cardUsuarios = document.getElementById('card-usuarios');
  if (esAdmin) {
    cardUsuarios.style.display = '';
    cargarUsuarios();
    document.getElementById('btn-nuevo-usuario').addEventListener('click', abrirModalUsuario);
    document.getElementById('btn-cancelar-usuario').addEventListener('click', cerrarModalUsuario);
    document.getElementById('form-usuario').addEventListener('submit', guardarUsuario);
  } else {
    cardUsuarios.style.display = 'none';
  }
});

async function cargarUsuarios() {
  const usuarios = await window.api.usuarios.listar();
  const lista    = document.getElementById('lista-usuarios');

  lista.innerHTML = usuarios.map(u => {
    const rolLabel  = u.rol === 'admin' ? 'Administrador' : 'Cajero';
    const activoBg  = u.activo ? 'rgba(74,222,128,.1)' : 'rgba(100,116,139,.08)';
    const activoCol = u.activo ? '#4ade80' : 'var(--text-subtle)';
    const esSelf    = window.SESSION && window.SESSION.id === u.id;
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;">
        ${esc(u.nombre[0].toUpperCase())}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text);">${esc(u.nombre)} ${esSelf ? '<span style="font-size:10px;color:var(--text-subtle);">(vos)</span>' : ''}</div>
        <div style="font-size:11px;color:var(--text-muted);">@${esc(u.usuario)} · ${esc(rolLabel)}</div>
      </div>
      <span style="font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600;background:${activoBg};color:${activoCol};">
        ${u.activo ? 'Activo' : 'Inactivo'}
      </span>
      <button class="btn btn-ghost" style="padding:4px 8px;font-size:11px;" onclick="editarUsuario(${u.id})">Editar</button>
      ${!esSelf ? `<button class="btn btn-ghost" style="padding:4px 8px;font-size:11px;color:${u.activo ? 'var(--danger)' : 'var(--success)'};" onclick="toggleUsuario(${u.id})">${u.activo ? 'Desactivar' : 'Activar'}</button>` : ''}
    </div>`;
  }).join('');
}

function abrirModalUsuario(id, datos) {
  editandoUsuarioId = id || null;
  document.getElementById('modal-usuario-titulo').textContent = id ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('u-nombre').value   = datos?.nombre   || '';
  document.getElementById('u-usuario').value  = datos?.usuario  || '';
  document.getElementById('u-email').value    = datos?.email    || '';
  document.getElementById('u-password').value = '';
  document.getElementById('u-password').placeholder = id ? 'Dejar vacío para no cambiar' : '••••••••';
  document.getElementById('u-rol').value      = datos?.rol || 'cajero';
  document.getElementById('u-error').classList.add('hidden');
  document.getElementById('modal-usuario').style.display = 'flex';
  setTimeout(() => document.getElementById('u-nombre').focus(), 50);
}

function cerrarModalUsuario() {
  document.getElementById('modal-usuario').style.display = 'none';
  editandoUsuarioId = null;
}

async function editarUsuario(id) {
  const usuarios = await window.api.usuarios.listar();
  const u = usuarios.find(x => x.id === id);
  if (u) abrirModalUsuario(id, u);
}

async function toggleUsuario(id) {
  await window.api.usuarios.toggleActivo(id);
  cargarUsuarios();
}

// ── Reporte automático por email ──────────────────────────────
function mostrarOpcionesReporte(visible) {
  document.getElementById('reporte-email-opciones').style.display = visible ? 'flex' : 'none';
}

function actualizarVisibilidadDia(frecuencia) {
  document.getElementById('reporte-dia-semana-wrap').style.display = frecuencia === 'semanal' ? '' : 'none';
  document.getElementById('reporte-dia-mes-wrap').style.display    = frecuencia === 'mensual' ? '' : 'none';
}

async function cargarConfigReporte() {
  let cfg;
  try {
    cfg = await window.api.reporteEmail.getConfig();
  } catch (err) {
    console.error('[reporte] error al cargar config:', err);
    return;
  }

  const activo = cfg.activo === '1';
  document.getElementById('toggle-reporte-email').checked = activo;
  mostrarOpcionesReporte(activo);

  document.getElementById('inp-reporte-destino').value    = cfg.destino    || '';
  document.getElementById('sel-reporte-frecuencia').value = cfg.frecuencia || 'diario';
  document.getElementById('inp-reporte-hora').value       = cfg.hora       || '08:00';
  document.getElementById('sel-reporte-dia-semana').value = cfg.diaSemana  || '1';
  const selMes = document.getElementById('sel-reporte-dia-mes');
  if (selMes.options.length > 0) selMes.value = String(cfg.diaMes || '1');

  actualizarVisibilidadDia(cfg.frecuencia || 'diario');

  const ultimoEl = document.getElementById('reporte-ultimo-envio');
  if (cfg.ultimoEnvio) {
    const d = new Date(cfg.ultimoEnvio).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    ultimoEl.textContent   = `Último reporte enviado: ${d}`;
    ultimoEl.style.display = '';
  } else {
    ultimoEl.style.display = 'none';
  }
}

async function guardarReporteConfig(data) {
  try {
    await window.api.reporteEmail.setConfig(data);
  } catch (err) {
    console.error('[reporte] error al guardar:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Generar opciones de días del mes (1-28, compatible con todos los meses)
  const selDiaMes = document.getElementById('sel-reporte-dia-mes');
  for (let d = 1; d <= 28; d++) {
    const opt = document.createElement('option');
    opt.value = String(d);
    opt.textContent = `Día ${d}`;
    selDiaMes.appendChild(opt);
  }

  cargarConfigReporte();

  // Toggle — actualizar display INMEDIATAMENTE, luego guardar en background
  document.getElementById('toggle-reporte-email').addEventListener('change', e => {
    const on = e.target.checked;
    mostrarOpcionesReporte(on);
    guardarReporteConfig({ activo: on ? '1' : '0' });
  });

  // Email destino — guardar en blur
  document.getElementById('inp-reporte-destino').addEventListener('blur', e => {
    guardarReporteConfig({ destino: e.target.value.trim() });
  });

  // Frecuencia — mostrar/ocultar selector de día condicionalmente
  document.getElementById('sel-reporte-frecuencia').addEventListener('change', e => {
    actualizarVisibilidadDia(e.target.value);
    guardarReporteConfig({ frecuencia: e.target.value });
  });

  // Hora
  document.getElementById('inp-reporte-hora').addEventListener('change', e => {
    guardarReporteConfig({ hora: e.target.value });
  });

  // Día de la semana
  document.getElementById('sel-reporte-dia-semana').addEventListener('change', e => {
    guardarReporteConfig({ diaSemana: e.target.value });
  });

  // Día del mes
  document.getElementById('sel-reporte-dia-mes').addEventListener('change', e => {
    guardarReporteConfig({ diaMes: e.target.value });
  });

  // Botón prueba
  document.getElementById('btn-reporte-prueba').addEventListener('click', async () => {
    const email = document.getElementById('inp-reporte-destino').value.trim();
    const freq  = document.getElementById('sel-reporte-frecuencia').value;
    const resEl = document.getElementById('reporte-resultado');
    const btn   = document.getElementById('btn-reporte-prueba');

    if (!email) {
      resEl.textContent = 'Ingresá un email destino primero.';
      resEl.style.color = 'var(--danger)';
      setTimeout(() => { resEl.textContent = ''; resEl.style.color = ''; }, 4000);
      return;
    }

    btn.disabled      = true;
    resEl.textContent = 'Generando reporte...';
    resEl.style.color = 'var(--text-muted)';

    try {
      const res = await window.api.reporteEmail.enviarPrueba(email, freq);
      if (res.ok) {
        resEl.textContent = `Reporte enviado a ${email}`;
        resEl.style.color = '#4ade80';
      } else {
        resEl.textContent = 'Error: ' + (res.error || 'error desconocido');
        resEl.style.color = 'var(--danger)';
      }
    } catch (err) {
      resEl.textContent = 'Error: ' + err.message;
      resEl.style.color = 'var(--danger)';
    }

    btn.disabled = false;
    setTimeout(() => { resEl.textContent = ''; resEl.style.color = ''; }, 6000);
  });
});

// ── Impresora térmica ──────────────────────────────────────────
async function cargarImpresoras() {
  const sel = document.getElementById('sel-impresora');
  sel.disabled = true;
  sel.innerHTML = '<option value="">Cargando...</option>';

  const [impresoras, actual] = await Promise.all([
    window.api.printer.listarImpresoras(),
    window.api.config.get('impresora_nombre'),
  ]);

  sel.innerHTML = '<option value="">— Sin impresora —</option>';
  for (const name of impresoras) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  if (actual) sel.value = actual;
  sel.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  cargarImpresoras();

  document.getElementById('sel-impresora').addEventListener('change', async e => {
    await window.api.config.set('impresora_nombre', e.target.value);
    document.getElementById('impresora-resultado').textContent = e.target.value
      ? 'Impresora guardada.'
      : 'Sin impresora configurada.';
    setTimeout(() => { document.getElementById('impresora-resultado').textContent = ''; }, 3000);
  });

  document.getElementById('btn-recargar-impresoras').addEventListener('click', async () => {
    document.getElementById('impresora-resultado').textContent = '';
    await cargarImpresoras();
  });

  document.getElementById('btn-prueba-impresora').addEventListener('click', async () => {
    const nombre = document.getElementById('sel-impresora').value;
    const resEl  = document.getElementById('impresora-resultado');
    if (!nombre) {
      resEl.textContent = 'Seleccioná una impresora primero.';
      resEl.style.color = 'var(--danger)';
      setTimeout(() => { resEl.textContent = ''; resEl.style.color = ''; }, 3000);
      return;
    }
    const btn = document.getElementById('btn-prueba-impresora');
    btn.disabled = true;
    resEl.textContent = 'Imprimiendo...';
    resEl.style.color = 'var(--text-muted)';
    const res = await window.api.printer.imprimirPrueba(nombre);
    if (res.ok) {
      resEl.textContent = 'Ticket de prueba enviado correctamente.';
      resEl.style.color = '#4ade80';
    } else if (res.noImpresora) {
      resEl.textContent = 'Sin impresora configurada.';
      resEl.style.color = 'var(--danger)';
    } else {
      resEl.textContent = 'Error: ' + (res.error || 'error desconocido');
      resEl.style.color = 'var(--danger)';
    }
    btn.disabled = false;
    setTimeout(() => { resEl.textContent = ''; resEl.style.color = ''; }, 5000);
  });
});

async function guardarUsuario(e) {
  e.preventDefault();
  const errEl  = document.getElementById('u-error');
  errEl.classList.add('hidden');

  const nombre   = document.getElementById('u-nombre').value.trim();
  const usuario  = document.getElementById('u-usuario').value.trim();
  const email    = document.getElementById('u-email').value.trim() || null;
  const password = document.getElementById('u-password').value;
  const rol      = document.getElementById('u-rol').value;

  if (!nombre || !usuario) {
    errEl.textContent = 'Nombre y usuario son obligatorios.';
    errEl.classList.remove('hidden');
    return;
  }
  if (!editandoUsuarioId && !password) {
    errEl.textContent = 'La contraseña es obligatoria para nuevos usuarios.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-guardar-usuario');
  btn.disabled = true;

  try {
    if (editandoUsuarioId) {
      await window.api.usuarios.actualizar(editandoUsuarioId, { nombre, usuario, email, password: password || undefined, rol });
    } else {
      await window.api.usuarios.crear({ nombre, usuario, email, password, rol });
    }
    cerrarModalUsuario();
    cargarUsuarios();
  } catch (err) {
    errEl.textContent = err.message || 'Error al guardar usuario.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}
