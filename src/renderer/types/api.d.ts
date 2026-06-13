// Type definitions for window.api (Electron preload bridge)

// ─── Parámetros de búsqueda ───────────────────────────────────────────────────

export interface ArticuloSearchParams {
  query?: string;
  departamento_id?: number | null;
  limit?: number;
  offset?: number;
}

export interface ClienteSearchParams {
  query?: string;
  limit?: number;
  offset?: number;
}

export interface ListarMovimientosParams {
  articulo_id?: number;
  desde?: string;
  hasta?: string;
  tipo?: string;
}

export interface PagedResult<T> {
  rows: T[];
  total: number;
}

// ─── Entidades base ───────────────────────────────────────────────────────────

export interface Session {
  id: number;
  nombre: string;
  usuario: string;
  rol: 'admin' | 'cajero';
}

export interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  email: string | null;
  rol: 'admin' | 'cajero';
  activo: 0 | 1;
}

export interface Articulo {
  id: number;
  codigo: string;
  nombre: string;
  costo_unitario: number;
  precio_unitario: number;
  precio_mayoreo: number;
  stock_actual: number;
  stock_minimo: number;
  tasa_iva: number;
  unidad_medida: string;
  departamento_id: number | null;
  es_kit: 0 | 1;
  usa_inventario: 0 | 1;
  sync_status: string;
  departamento_nombre?: string | null;
  departamento_color?: string | null;
}

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  limite_credito: number;
  saldo_vencido: number;
  sync_status: string;
}

export interface Turno {
  id: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  efectivo_inicial: number;
  efectivo_esperado: number;
  efectivo_real: number | null;
  diferencia: number | null;
  total_ventas: number;
  total_transacciones: number;
  ventas_efectivo: number;
  ventas_debito: number;
  ventas_credito: number;
  ventas_transferencia: number;
  ventas_cuenta_corriente: number;
  estado: 'abierto' | 'cerrado';
}

export interface Transaccion {
  id: number;
  monto_total: number;
  subtotal: number;
  monto_impuesto: number;
  descuento_global: number;
  propina: number;
  forma_pago: string;
  forma_pago_2: string | null;
  monto_pago_2: number | null;
  cuenta_cliente_id: number | null;
  turno_id: number;
  estado: 'vigente' | 'cancelada' | 'devolucion_parcial';
  motivo_cancelacion: string | null;
  sync_status: string;
  created_at: string;
}

export interface Departamento {
  id: number;
  nombre: string;
  color: string;
}

export interface Proveedor {
  id: number;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  notas: string;
  sync_status: string;
}

export interface MovimientoCaja {
  id: number;
  turno_id: number;
  tipo: 'entrada' | 'salida';
  monto: number;
  descripcion: string;
  categoria: string;
  cancelado: 0 | 1;
  cancelado_motivo: string | null;
  created_at: string;
}

export interface BackupInfo {
  nombre: string;
  ruta: string;
  fecha: string;
  tamanio: number;
}

// ─── Informes ─────────────────────────────────────────────────────────────────
// Campos exactos que devuelve informes.js — si se renombra un campo en el
// backend el compilador (o el test de contrato) lo detecta inmediatamente.

export interface ResumenRapido {
  total_ventas:            number;
  cantidad_ventas:         number;
  ticket_promedio:         number;
  ganancia_bruta:          number;
  ventas_efectivo:         number;
  ventas_debito:           number;
  ventas_credito:          number;
  ventas_transferencia:    number;
  ventas_cuenta_corriente: number;
}

export interface VentasPeriodoResumen {
  cantidad:      number;
  total:         number;
  total_iva:     number;
  total_sin_iva: number;
  ganancia_bruta: number;
}

export interface VentaFormaPago {
  forma_pago: string;
  cantidad:   number;
  total:      number;
}

export interface TransaccionResumen {
  id:            number;
  created_at:    string;
  forma_pago:    string;
  forma_pago_2:  string | null;
  monto_pago_2:  number | null;
  subtotal:      number;
  monto_impuesto: number;
  monto_total:   number;
}

export interface VentasPeriodoResult {
  resumen:       VentasPeriodoResumen;
  porFormaPago:  VentaFormaPago[];
  transacciones: TransaccionResumen[];
}

export interface ArticuloVendido {
  codigo:         string;
  nombre:         string;
  cantidad_total: number;
  importe_total:  number;
  ganancia:       number;
}

export interface UtilidadItem {
  codigo:               string;
  nombre:               string;
  costo_unitario:       number;
  cantidad_total:       number;
  precio_venta_promedio: number;
  utilidad_total:       number;
}

export interface UtilidadBrutaResult {
  items:         UtilidadItem[];
  totalUtilidad: number;
  utilidad_bruta: number;
}

export interface SaldoCliente {
  id:             number;
  nombre:         string;
  telefono:       string;
  limite_credito: number;
  saldo_vencido:  number;
}

export interface SaldosClientesResult {
  clientes:   SaldoCliente[];
  totalDeuda: number;
}

export interface VentaDia {
  fecha:      string;
  cantidad:   number;
  monto_total: number;
  ganancia:   number;
}

export interface VentaHora {
  hora:     number;
  cantidad: number;
  total:    number;
}

export interface MejorDia {
  fecha:    string;
  cantidad: number;
  total:    number;
}

export interface VentaCliente {
  id:                     number;
  nombre:                 string;
  telefono:               string;
  cantidad_transacciones: number;
  total_comprado:         number;
  ganancia_generada:      number;
}

export interface VentaMes {
  mes:      string;
  cantidad: number;
  total:    number;
  ganancia: number;
}

export interface VentaDepto {
  departamento: string;
  cantidad:     number;
  total:        number;
  ganancia:     number;
}

// ─── Turnos ───────────────────────────────────────────────────────────────────

/** calcularResumen() devuelve todos los campos de Turno + campos calculados en runtime. */
export interface TurnoResumen extends Turno {
  total_descuentos: number;
  total_propinas:   number;
  total_entradas:   number;
  total_salidas:    number;
}

export interface TurnoDetalle {
  turno:         Turno;
  transacciones: Transaccion[];
}

// ─── Transacciones ────────────────────────────────────────────────────────────

export interface DetalleTransaccion {
  id:                   number;
  transaccion_id:       number;
  articulo_id:          number | null;
  descripcion_libre:    string | null;
  cantidad:             number;
  precio_al_momento:    number;
  descuento_porcentaje: number;
  importe_total:        number;
  nombre:               string;
  codigo:               string;
  unidad_medida:        string;
}

export type TransaccionConDetalle = Transaccion & { detalle: DetalleTransaccion[] };
export type TransaccionReciente   = Transaccion & { nombre_cliente: string | null };

export interface CreateTransaccionDetalle {
  articulo_id?:         number | null;
  descripcion_libre?:   string | null;
  cantidad:             number;
  precio_al_momento:    number;
  descuento_porcentaje?: number;
  importe_total:        number;
}

export interface CreateTransaccionInput {
  monto_total:        number;
  subtotal:           number;
  monto_impuesto:     number;
  descuento_global?:  number;
  notas?:             string | null;
  propina?:           number;
  turno_id?:          number | null;
  forma_pago:         string;
  forma_pago_2?:      string | null;
  monto_pago_2?:      number | null;
  cuenta_cliente_id?: number | null;
}

export interface CreateTransaccionData {
  transaccion: CreateTransaccionInput;
  detalle:     CreateTransaccionDetalle[];
}

// ─── Devoluciones ─────────────────────────────────────────────────────────────

export interface Devolucion {
  id:              number;
  transaccion_id:  number;
  turno_id:        number | null;
  motivo:          string;
  monto_devuelto:  number;
  tipo:            'total' | 'parcial';
  created_at:      string;
}

export interface DevolucionDetalle {
  id:              number;
  devolucion_id:   number;
  detalle_id:      number | null;
  articulo_id:     number | null;
  descripcion:     string;
  cantidad:        number;
  precio_unitario: number;
  importe:         number;
}

export type DevolucionConDetalle = Devolucion & { detalle: DevolucionDetalle[] };

export interface CancelarTransaccionData {
  transaccionId: number;
  turnoId?:      number | null;
  motivo:        string;
}

export interface DevolucionParcialItemData {
  detalle_id?:     number | null;
  articulo_id?:    number | null;
  descripcion:     string;
  cantidad:        number;
  precio_unitario: number;
}

export interface DevolucionParcialData {
  transaccionId: number;
  turnoId?:      number | null;
  motivo:        string;
  items:         DevolucionParcialItemData[];
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export interface PagoCliente {
  id:         number;
  cliente_id: number;
  monto:      number;
  tipo:       'abono' | 'dev_abono';
  forma_pago: string;
  estado:     'activo' | 'cancelado';
  created_at: string;
}

export interface TransaccionCliente {
  id:             number;
  monto_total:    number;
  subtotal:       number;
  monto_impuesto: number;
  forma_pago:     string;
  sync_status:    string;
  created_at:     string;
}

// ─── Artículos ────────────────────────────────────────────────────────────────

export interface PrecioHistorialEntry {
  id:             number;
  articulo_id:    number;
  campo:          string;
  valor_anterior: string;
  valor_nuevo:    string;
  usuario:        string;
  created_at:     string;
}

// ─── Kits ─────────────────────────────────────────────────────────────────────

export interface KitComponente {
  kit_id:       number;
  componente_id: number;
  cantidad:      number;
  nombre:        string;
  codigo:        string;
  unidad_medida: string;
  stock_actual:  number;
}

// ─── Promociones ──────────────────────────────────────────────────────────────

export interface Promocion {
  id:                 number;
  articulo_id:        number;
  nombre:             string;
  cantidad_desde:     number;
  cantidad_hasta:     number | null;
  precio_promocional: number;
  activa:             0 | 1;
}

export interface PromocionConArticulo extends Promocion {
  articulo_nombre: string;
  articulo_codigo: string;
}

// ─── Pedidos de compra ────────────────────────────────────────────────────────

export interface PedidoCompra {
  id:               number;
  proveedor_id:     number | null;
  proveedor_nombre: string | null;
  estado:           'borrador' | 'enviado' | 'recibido' | 'cancelado';
  notas:            string | null;
  usuario_id:       number | null;
  fecha_creacion:   string;
  fecha_envio:      string | null;
  fecha_recepcion:  string | null;
  proveedor_label:  string | null;
  total_items:      number;
}

export interface PedidoCompraItem {
  id:               number;
  pedido_id:        number;
  articulo_id:      number | null;
  descripcion_libre: string | null;
  cantidad_pedida:  number;
  cantidad_recibida: number;
  costo_unitario:   number;
  articulo_nombre:  string | null;
  articulo_codigo:  string | null;
  unidad_medida:    string | null;
}

export type PedidoCompraConItems = Omit<PedidoCompra, 'total_items'> & {
  items: PedidoCompraItem[];
};

export interface CrearPedidoCompraData {
  proveedor_id?:     number | null;
  proveedor_nombre?: string | null;
  notas?:            string | null;
  usuario_id?:       number | null;
  items?: Array<{
    articulo_id?:       number | null;
    descripcion_libre?: string | null;
    cantidad_pedida:    number;
    costo_unitario?:    number;
  }>;
}

export interface ActualizarPedidoCompraData {
  notas?: string | null;
  items?: Array<{
    articulo_id?:       number | null;
    descripcion_libre?: string | null;
    cantidad_pedida:    number;
    costo_unitario?:    number;
  }>;
}

export interface RecibirItemData {
  item_id:           number;
  articulo_id?:      number | null;
  cantidad_recibida: number;
  costo_unitario:    number;
}

// ─── Recepciones ──────────────────────────────────────────────────────────────

export interface Recepcion {
  id:               number;
  pedido_id:        number | null;
  proveedor_id:     number | null;
  proveedor_nombre: string | null;
  notas:            string | null;
  total_costo:      number;
  created_at:       string;
}

export interface RecepcionDetalle {
  id:                number;
  recepcion_id:      number;
  articulo_id:       number | null;
  descripcion:       string | null;
  cantidad_recibida: number;
  costo_unitario:    number;
  importe_total:     number;
}

export type RecepcionConDetalle = Recepcion & { detalle: RecepcionDetalle[] };

export interface CrearRecepcionData {
  proveedor_id?:    number;
  proveedor_nombre?: string;
  pedido_id?:       number;
  notas?:           string;
  detalle: Array<{
    articulo_id?:      number;
    descripcion?:      string;
    cantidad_recibida: number;
    costo_unitario?:   number;
    importe_total?:    number;
  }>;
}

// ─── Inventario ───────────────────────────────────────────────────────────────

export interface MovimientoInventario {
  id:                  number;
  articulo_id:         number | null;
  tipo:                string;
  cantidad_anterior:   number;
  cantidad_cambio:     number;
  cantidad_resultante: number;
  costo_unitario:      number;
  precio_unitario:     number;
  motivo:              string | null;
  usuario:             string | null;
  referencia_id:       number | null;
  fecha:               string;
  articulo_nombre:     string | null;
  articulo_codigo:     string | null;
  unidad_medida:       string | null;
}

export interface AjusteInventarioData {
  articulo_id: number;
  tipo_ajuste: 'entrada' | 'salida' | 'correccion';
  cantidad:    number;
  motivo?:     string;
  usuario?:    string;
}

export interface AjusteResult {
  anterior: number;
  nuevo:    number;
  cambio:   number;
}

export interface KardexResult {
  articulo:     Articulo;
  movimientos:  MovimientoInventario[];
}

// ─── Movimientos de caja (input) ──────────────────────────────────────────────

export interface RegistrarMovimientoData {
  turnoId:     number;
  tipo:        'entrada' | 'salida';
  monto:       number;
  descripcion: string;
  categoria?:  string;
}

// ─── Reporte por email ────────────────────────────────────────────────────────

export interface ReporteEmailConfig {
  activo:      string;
  destino:     string;
  frecuencia:  string;
  hora:        string;
  diaSemana:   string;
  diaMes:      string;
  ultimoEnvio: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Declaración global de window.api
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    SESSION?: Session;
    api: {
      usuarios: {
        hayUsuarios:  () => Promise<boolean>;
        login:        (usuario: string, password: string) => Promise<{ ok: boolean; user?: Session; error?: string }>;
        listar:       () => Promise<Usuario[]>;
        crear:        (data: Partial<Usuario> & { password: string }) => Promise<void>;
        actualizar:   (id: number, data: Partial<Usuario> & { password?: string }) => Promise<void>;
        toggleActivo: (id: number) => Promise<void>;
      };
      departamentos: {
        getAll:  () => Promise<Departamento[]>;
        create:  (data: Partial<Departamento>) => Promise<Departamento>;
        update:  (id: number, data: Partial<Departamento>) => Promise<void>;
        delete:  (id: number) => Promise<void>;
      };
      kits: {
        getComponentes: (kitId: number) => Promise<KitComponente[]>;
        setComponentes: (kitId: number, comp: Array<{ componente_id: number; cantidad: number }>) => Promise<KitComponente[]>;
      };
      articulos: {
        getAll:          () => Promise<Articulo[]>;
        getById:         (id: number) => Promise<Articulo>;
        getByCodigo:     (codigo: string) => Promise<Articulo | null>;
        create:          (data: Partial<Articulo>) => Promise<Articulo>;
        update:          (id: number, data: Partial<Articulo>) => Promise<void>;
        delete:          (id: number) => Promise<void>;
        search:          (query: string) => Promise<Articulo[]>;
        searchPaged:     (params: ArticuloSearchParams) => Promise<PagedResult<Articulo>>;
        precioHistorial: (id: number) => Promise<PrecioHistorialEntry[]>;
      };
      clientes: {
        getAll:           () => Promise<Cliente[]>;
        getById:          (id: number) => Promise<Cliente>;
        create:           (data: Partial<Cliente>) => Promise<Cliente>;
        update:           (id: number, data: Partial<Cliente>) => Promise<void>;
        delete:           (id: number) => Promise<void>;
        search:           (query: string) => Promise<Cliente[]>;
        searchPaged:      (params: ClienteSearchParams) => Promise<PagedResult<Cliente>>;
        getTransacciones: (id: number) => Promise<TransaccionCliente[]>;
        listarPagos:      (id: number) => Promise<PagoCliente[]>;
        cancelarPago:     (pagoId: number) => Promise<void>;
        liquidarDeuda:    (id: number, formaPago: string) => Promise<void>;
        registrarPago:    (id: number, monto: number, formaPago: string) => Promise<void>;
      };
      transacciones: {
        getAll:       () => Promise<Transaccion[]>;
        getById:      (id: number) => Promise<TransaccionConDetalle | null>;
        create:       (data: CreateTransaccionData) => Promise<{ id: number }>;
        getByFecha:   (desde: string, hasta: string) => Promise<Transaccion[]>;
        getRecientes: (limite: number) => Promise<TransaccionReciente[]>;
        getUltima:    (turnoId: number) => Promise<Transaccion | null>;
      };
      movimientos: {
        registrar:      (data: RegistrarMovimientoData) => Promise<MovimientoCaja>;
        listarPorTurno: (turnoId: number) => Promise<MovimientoCaja[]>;
        cancelar:       (id: number, motivo: string) => Promise<MovimientoCaja>;
      };
      devoluciones: {
        cancelar:   (data: CancelarTransaccionData) => Promise<Devolucion>;
        parcial:    (data: DevolucionParcialData) => Promise<Devolucion>;
        getByTrans: (id: number) => Promise<DevolucionConDetalle[]>;
        recientes:  (lim: number) => Promise<TransaccionReciente[]>;
      };
      informes: {
        ventasPorPeriodo:      (d: string, h: string) => Promise<VentasPeriodoResult>;
        articulosMasVendidos:  (d: string, h: string) => Promise<ArticuloVendido[]>;
        utilidadBruta:         (d: string, h: string) => Promise<UtilidadBrutaResult>;
        saldosClientes:        () => Promise<SaldosClientesResult>;
        ventasPorDia:          (d: string, h: string) => Promise<VentaDia[]>;
        ventasPorHora:         (d: string) => Promise<VentaHora[]>;
        mejorDia:              (d: string, h: string) => Promise<MejorDia | null>;
        resumenRapido:         (d: string, h: string) => Promise<ResumenRapido>;
        ventasPorCliente:      (d: string, h: string) => Promise<VentaCliente[]>;
        ventasPorMes:          (d: string, h: string) => Promise<VentaMes[]>;
        ventasPorDepartamento: (d: string, h: string) => Promise<VentaDepto[]>;
        ventasPorHoraRango:    (d: string, h: string) => Promise<VentaHora[]>;
      };
      proveedores: {
        getAll:                () => Promise<Proveedor[]>;
        getById:               (id: number) => Promise<Proveedor>;
        search:                (q: string) => Promise<Proveedor[]>;
        searchPaged:           (params: ClienteSearchParams) => Promise<PagedResult<Proveedor>>;
        create:                (data: Partial<Proveedor>) => Promise<Proveedor>;
        update:                (id: number, data: Partial<Proveedor>) => Promise<void>;
        delete:                (id: number) => Promise<void>;
        articulosConStockBajo: () => Promise<Articulo[]>;
      };
      pedidos: {
        getAll:         () => Promise<PedidoCompra[]>;
        getById:        (id: number) => Promise<PedidoCompraConItems | null>;
        crear:          (prvId: number, prvNombre: string, items: Array<{ articulo_id?: number; descripcion_libre?: string; cantidad_pedida: number; costo_unitario?: number }>) => Promise<PedidoCompra>;
        marcarRecibido: (pedidoId: number, itemsRecibidos: RecibirItemData[]) => Promise<void>;
      };
      promociones: {
        listarPorArticulo: (articuloId: number) => Promise<Promocion[]>;
        listarActivas:     (ids: number[]) => Promise<Promocion[]>;
        listarTodas:       () => Promise<PromocionConArticulo[]>;
        crear:             (data: Partial<Promocion>) => Promise<Promocion>;
        eliminar:          (id: number) => Promise<void>;
      };
      pedidosCompra: {
        listar:        () => Promise<PedidoCompra[]>;
        getById:       (id: number) => Promise<PedidoCompraConItems | null>;
        crear:         (data: CrearPedidoCompraData) => Promise<PedidoCompra>;
        actualizar:    (id: number, data: ActualizarPedidoCompraData) => Promise<void>;
        marcarEnviado: (id: number) => Promise<void>;
        recibir:       (id: number, items: RecibirItemData[]) => Promise<void>;
        cancelar:      (id: number) => Promise<void>;
        exportarPDF:   (id: number) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
        exportarCSV:   (id: number) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      };
      recepciones: {
        crear:   (data: CrearRecepcionData) => Promise<RecepcionConDetalle>;
        listar:  () => Promise<Recepcion[]>;
        getById: (id: number) => Promise<RecepcionConDetalle | null>;
      };
      turnos: {
        getActivo:       () => Promise<Turno | null>;
        obtenerActivo:   () => Promise<Turno | null>;
        abrir:           (efectivoInicial: number) => Promise<Turno>;
        calcularResumen: (id: number) => Promise<TurnoResumen>;
        cerrar:          (id: number, efectivoReal: number, notas: string) => Promise<void>;
        historial:       (limite: number) => Promise<Turno[]>;
        detalle:         (id: number) => Promise<TurnoDetalle | null>;
      };
      backup: {
        hacerAhora:         () => Promise<{ ok: boolean; error?: string }>;
        listar:             () => Promise<BackupInfo[]>;
        getRuta:            () => Promise<string>;
        abrirCarpeta:       () => Promise<void>;
        seleccionarArchivo: () => Promise<string | null>;
        restaurar:          (ruta: string) => Promise<{ ok: boolean; cancelado?: boolean; error?: string }>;
      };
      caja: {
        abrirComprobante: (data: { transaccionId: number; montoRecibido: number; vuelto: number; propina: number }) => Promise<void>;
      };
      config: {
        get:    (clave: string) => Promise<string | null>;
        getAll: () => Promise<Record<string, string>>;
        set:    (clave: string, valor: string) => Promise<void>;
      };
      sync: {
        manual:            () => Promise<{ ok: boolean; sincronizados?: number; fallidos?: number; error?: string }>;
        contarPendientes:  () => Promise<number>;
        detallePendientes: () => Promise<{ articulos: number; clientes: number; transacciones: number; proveedores: number }>;
      };
      auth: {
        login:            (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
        setSession:       (session: Session | null) => Promise<{ valid: boolean }>;
        solicitarReset:   (email: string) => Promise<{ ok: boolean; error?: string }>;
        verificarCodigo:  (email: string, codigo: string) => Promise<{ ok: boolean; error?: string }>;
        resetearPassword: (email: string, codigo: string, password: string) => Promise<{ ok: boolean; error?: string }>;
        estadoSync:       () => Promise<{ activa: boolean; firebaseConectado: boolean; ultimaSync: number | null }>;
      };
      inventario: {
        ajustar:           (data: AjusteInventarioData) => Promise<AjusteResult>;
        listarMovimientos: (filtros: ListarMovimientosParams) => Promise<MovimientoInventario[]>;
        kardex:            (artId: number) => Promise<KardexResult>;
        stockBajo:         () => Promise<Articulo[]>;
      };
      soporte: {
        enviarReporte: (datos: { tipo?: string; modulo?: string; descripcion: string; nombre?: string }) => Promise<{ ok: boolean; error?: string }>;
      };
      reporteEmail: {
        getConfig:    () => Promise<ReporteEmailConfig>;
        setConfig:    (data: Partial<ReporteEmailConfig>) => Promise<void>;
        enviarPrueba: (email: string, frecuencia: string) => Promise<{ ok: boolean; error?: string }>;
      };
      printer: {
        listarImpresoras:      () => Promise<string[]>;
        imprimir:              (transaccionId: number, extra: { montoRecibido: number; vuelto: number; propina: number }) => Promise<{ ok: boolean; error?: string }>;
        imprimirPrueba:        (nombreImpresora: string) => Promise<{ ok: boolean; noImpresora?: boolean; error?: string }>;
        imprimirCorteZ:        (turnoId: number) => Promise<void>;
        imprimirEstadoCuenta:  (clienteId: number) => Promise<void>;
      };
      db: {
        integrityStatus: () => Promise<{ ok: false; detalles: string[] } | null>;
      };
      ui: {
        setZoom: (factor: number) => Promise<void>;
      };
      log: {
        error: (message: string, detail?: string) => void;
      };
      navegar:       (file: string) => Promise<void>;
      modalState:    (open: boolean) => void;
      setModalCobro: (open: boolean) => void;
      onNavegar:          (cb: (file: string) => void) => () => void;
      onCobrarConTicket:  (cb: () => void) => () => void;
      onCobrarSinTicket:  (cb: () => void) => () => void;
      onAbrirCobro:       (cb: () => void) => () => void;
      startDownload:    () => Promise<void>;
      installUpdate:    () => Promise<void>;
      getPendingUpdate: () => Promise<{ version: string; releaseNotes: string | null } | null>;
      onUpdateAvailable:  (cb: (info: { version: string; releaseNotes: string | null }) => void) => void;
      onUpdateProgress:   (cb: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => void;
      onUpdateDownloaded: (cb: () => void) => void;
      onUpdateError:      (cb: (message: string) => void) => void;
    };
  }
}
