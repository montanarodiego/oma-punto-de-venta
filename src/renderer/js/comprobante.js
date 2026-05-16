// Módulo Comprobante — ticket imprimible post-venta

const FORMAS_PAGO = {
  efectivo:         'Efectivo',
  tarjeta_debito:   'Tarjeta débito',
  tarjeta_credito:  'Tarjeta crédito',
  transferencia:    'Transferencia',
  cuenta_corriente: 'Crédito cliente',
};

document.addEventListener('DOMContentLoaded', async () => {
  const params       = new URLSearchParams(location.search);
  const id           = parseInt(params.get('id'), 10);
  const montoRecibido = parseFloat(params.get('recibido')) || 0;
  const vuelto       = parseFloat(params.get('vuelto'))   || 0;

  const [transaccion, config] = await Promise.all([
    window.api.transacciones.getById(id),
    window.api.config.getAll(),
  ]);

  if (!transaccion) {
    document.getElementById('ticket').innerHTML =
      '<p class="text-red-500 text-center py-4">Error: comprobante no encontrado.</p>';
    return;
  }

  let cliente = null;
  if (transaccion.cuenta_cliente_id) {
    cliente = await window.api.clientes.getById(transaccion.cuenta_cliente_id);
  }

  // Encabezado
  document.getElementById('nombre-negocio').textContent = config.nombre_negocio || 'Mi Negocio';
  document.getElementById('fecha').textContent          = formatFecha(transaccion.created_at);
  document.getElementById('ticket-num').textContent     = `Ticket #${transaccion.id}`;
  document.title = `Comprobante #${transaccion.id}`;

  // Items
  document.getElementById('items-table').innerHTML = transaccion.detalle.map(item => `
    <tr>
      <td class="py-0.5 pr-2 truncate max-w-[8rem]">${esc(item.nombre)}</td>
      <td class="py-0.5 text-right pr-2">${fmtNum(item.cantidad)} ${esc(item.unidad_medida || 'u.')}</td>
      <td class="py-0.5 text-right pr-2">${fmt(item.precio_al_momento)}</td>
      <td class="py-0.5 text-right font-semibold">${fmt(item.importe_total)}</td>
    </tr>`).join('');

  // Totales
  const tasa        = parseFloat(config.impuesto_porcentaje) || 21;
  const mostrarIva  = config.mostrar_iva_desglosado !== '0';
  document.getElementById('subtotal').textContent  = fmt(transaccion.subtotal);
  document.getElementById('label-iva').textContent = `IVA (${tasa}%)`;
  document.getElementById('impuesto').textContent  = fmt(transaccion.monto_impuesto);
  document.getElementById('total').textContent     = fmt(transaccion.monto_total);
  document.getElementById('fila-subtotal').style.display = mostrarIva ? '' : 'none';
  document.getElementById('fila-iva').style.display      = mostrarIva ? '' : 'none';

  // Forma de pago
  document.getElementById('forma-pago').textContent =
    FORMAS_PAGO[transaccion.forma_pago] || transaccion.forma_pago;

  // Efectivo: vuelto
  if (transaccion.forma_pago === 'efectivo' && montoRecibido > 0) {
    document.getElementById('seccion-efectivo').classList.remove('hidden');
    document.getElementById('recibido').textContent = fmt(montoRecibido);
    document.getElementById('vuelto').textContent   = fmt(vuelto);
  }

  // Cliente
  if (cliente) {
    document.getElementById('seccion-cliente').classList.remove('hidden');
    document.getElementById('nombre-cliente').textContent = cliente.nombre;
  }
});

function formatFecha(str) {
  if (!str) return '';
  // SQLite datetime() devuelve UTC sin zona — agregamos Z para que Date lo interprete correctamente
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
