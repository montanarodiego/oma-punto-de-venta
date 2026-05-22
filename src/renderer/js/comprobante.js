// Módulo Comprobante — ticket imprimible post-venta

const FORMAS_PAGO = {
  efectivo:         'Efectivo',
  tarjeta_debito:   'Tarjeta débito',
  tarjeta_credito:  'Tarjeta crédito',
  transferencia:    'Transferencia',
  cuenta_corriente: 'Crédito cliente',
};

const MODOS_SIN_IVA = new Set(['monotributista', 'restaurante']);

document.addEventListener('DOMContentLoaded', async () => {
  const params        = new URLSearchParams(location.search);
  const id            = parseInt(params.get('id'), 10);
  const montoRecibido = parseFloat(params.get('recibido')) || 0;
  const vuelto        = parseFloat(params.get('vuelto'))   || 0;
  const propina       = parseFloat(params.get('propina'))  || 0;

  const [transaccion, config] = await Promise.all([
    window.api.transacciones.getById(id),
    window.api.config.getAll(),
  ]);

  if (!transaccion) {
    document.getElementById('ticket').innerHTML =
      '<p style="text-align:center;color:#ef4444;padding:16px;">Error: comprobante no encontrado.</p>';
    return;
  }

  let cliente = null;
  if (transaccion.cuenta_cliente_id) {
    cliente = await window.api.clientes.getById(transaccion.cuenta_cliente_id);
  }

  const modo = config.modo_negocio || '';

  // Encabezado
  document.getElementById('nombre-negocio').textContent = config.nombre_negocio || 'Mi Negocio';
  document.getElementById('fecha').textContent          = formatFecha(transaccion.created_at);
  document.getElementById('ticket-num').textContent     = `Ticket #${transaccion.id}`;
  document.title = `Comprobante #${transaccion.id}`;

  // Datos del negocio (solo líneas con valor)
  const lineasNegocio = [
    config.direccion?.trim(),
    config.telefono?.trim()  ? `Tel: ${config.telefono.trim()}`  : null,
    config.cuit?.trim()      ? `CUIT: ${config.cuit.trim()}`     : null,
  ].filter(Boolean);
  document.getElementById('info-negocio').innerHTML =
    lineasNegocio.map(l => `<div>${esc(l)}</div>`).join('');

  // Pie del ticket
  const msgTicket = config.mensaje_ticket?.trim() || 'Gracias por su compra';
  document.getElementById('ticket-footer').textContent = `— ${msgTicket} —`;

  // Items — mostrar descuento por ítem si existe
  document.getElementById('items-table').innerHTML = transaccion.detalle.map(item => {
    const tieneDesc = (item.descuento_porcentaje || 0) > 0;
    const precioOriginal = tieneDesc
      ? item.importe_total / (item.cantidad * (1 - item.descuento_porcentaje / 100))
      : item.precio_al_momento;

    return `
      <tr>
        <td class="py-0.5 pr-2 truncate max-w-[8rem]">${esc(item.nombre)}</td>
        <td class="py-0.5 text-right pr-2">${fmtNum(item.cantidad)} ${esc(item.unidad_medida || 'u.')}</td>
        <td class="py-0.5 text-right pr-2">
          ${tieneDesc
            ? `<span style="text-decoration:line-through;color:#9ca3af;font-size:10px;">${fmt(precioOriginal)}</span><br>${fmt(item.precio_al_momento * (1 - item.descuento_porcentaje / 100))}`
            : fmt(item.precio_al_momento)}
        </td>
        <td class="py-0.5 text-right font-semibold">${fmt(item.importe_total)}</td>
      </tr>
      ${tieneDesc ? `<tr><td colspan="3" style="font-size:10px;color:#b45309;padding-bottom:3px;">Desc. ${fmtNum(item.descuento_porcentaje)}%</td><td></td></tr>` : ''}`;
  }).join('');

  // Totales — adaptar según modo
  const tasa = parseFloat(config.impuesto_porcentaje) || 21;
  let mostrarIva;
  if (MODOS_SIN_IVA.has(modo)) {
    mostrarIva = false;
  } else if (modo === 'personalizado' || modo === '') {
    mostrarIva = config.mostrar_iva_desglosado !== '0';
  } else {
    mostrarIva = true;
  }

  document.getElementById('subtotal').textContent  = fmt(transaccion.subtotal);
  document.getElementById('label-iva').textContent = `IVA (${tasa}%)`;
  document.getElementById('impuesto').textContent  = fmt(transaccion.monto_impuesto);
  document.getElementById('total').textContent     = fmt(transaccion.monto_total);
  document.getElementById('fila-subtotal').style.display = mostrarIva ? '' : 'none';
  document.getElementById('fila-iva').style.display      = mostrarIva ? '' : 'none';

  // Descuento global
  const descGlobal = transaccion.descuento_global || 0;
  if (descGlobal > 0) {
    document.getElementById('fila-descuento-global').style.display = '';
    document.getElementById('desc-global-monto').textContent = `−${fmt(descGlobal)}`;
  }

  // Propina (sólo RESTAURANTE)
  if (modo === 'restaurante' && propina > 0) {
    document.getElementById('fila-propina').style.display = '';
    document.getElementById('propina-monto').textContent  = fmt(propina);
  }

  // Forma de pago (simple o mixta)
  if (transaccion.forma_pago_2) {
    document.getElementById('forma-pago').textContent = 'Pago mixto';
    document.getElementById('seccion-pago-mixto').classList.remove('hidden');
    const monto1 = transaccion.monto_total - (transaccion.monto_pago_2 || 0);
    const monto2 = transaccion.monto_pago_2 || 0;
    document.getElementById('mixto-forma-1').textContent   = FORMAS_PAGO[transaccion.forma_pago]   || transaccion.forma_pago;
    document.getElementById('mixto-importe-1').textContent = fmt(monto1);
    document.getElementById('mixto-forma-2').textContent   = FORMAS_PAGO[transaccion.forma_pago_2] || transaccion.forma_pago_2;
    document.getElementById('mixto-importe-2').textContent = fmt(monto2);
  } else {
    document.getElementById('forma-pago').textContent =
      FORMAS_PAGO[transaccion.forma_pago] || transaccion.forma_pago;
  }

  // Efectivo: vuelto (aplica también si efectivo es sub-método en mixto)
  const tieneEfectivo = transaccion.forma_pago === 'efectivo' || transaccion.forma_pago_2 === 'efectivo';
  if (tieneEfectivo && montoRecibido > 0) {
    document.getElementById('seccion-efectivo').classList.remove('hidden');
    document.getElementById('recibido').textContent = fmt(montoRecibido);
    document.getElementById('vuelto').textContent   = fmt(vuelto);
  }

  // Cliente
  if (cliente) {
    document.getElementById('seccion-cliente').classList.remove('hidden');
    document.getElementById('nombre-cliente').textContent = cliente.nombre;
  }

  // Notas del ticket
  if (transaccion.notas?.trim()) {
    document.getElementById('seccion-notas').style.display = '';
    document.getElementById('notas-texto').textContent = transaccion.notas.trim();
  }
});

function formatFecha(str) {
  if (!str) return '';
  const d = new Date(str.replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmt(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
  }).format(n ?? 0);
}

function fmtNum(n) {
  const num = parseFloat(n) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(3).replace(/\.?0+$/, '');
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
