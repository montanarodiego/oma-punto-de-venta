// Type definitions for window.api (Electron preload bridge)

export interface Session {
  id: number;
  nombre: string;
  usuario: string;
  rol: 'admin' | 'cajero';
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
  departamento_nombre?: string;
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

export interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  email: string | null;
  rol: 'admin' | 'cajero';
  activo: 0 | 1;
}

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
        getComponentes: (kitId: number) => Promise<any[]>;
        setComponentes: (kitId: number, comp: any[]) => Promise<void>;
      };
      articulos: {
        getAll:          () => Promise<Articulo[]>;
        getById:         (id: number) => Promise<Articulo>;
        getByCodigo:     (codigo: string) => Promise<Articulo | null>;
        create:          (data: Partial<Articulo>) => Promise<Articulo>;
        update:          (id: number, data: Partial<Articulo>) => Promise<void>;
        delete:          (id: number) => Promise<void>;
        search:          (query: string) => Promise<Articulo[]>;
        precioHistorial: (id: number) => Promise<any[]>;
      };
      clientes: {
        getAll:           () => Promise<Cliente[]>;
        getById:          (id: number) => Promise<Cliente>;
        create:           (data: Partial<Cliente>) => Promise<Cliente>;
        update:           (id: number, data: Partial<Cliente>) => Promise<void>;
        delete:           (id: number) => Promise<void>;
        search:           (query: string) => Promise<Cliente[]>;
        getTransacciones: (id: number) => Promise<Transaccion[]>;
        listarPagos:      (id: number) => Promise<any[]>;
        cancelarPago:     (pagoId: number) => Promise<void>;
        liquidarDeuda:    (id: number, formaPago: string) => Promise<void>;
        registrarPago:    (id: number, monto: number, formaPago: string) => Promise<void>;
      };
      transacciones: {
        getAll:       () => Promise<Transaccion[]>;
        getById:      (id: number) => Promise<Transaccion & { detalle: any[] }>;
        create:       (data: any) => Promise<{ id: number }>;
        getByFecha:   (desde: string, hasta: string) => Promise<Transaccion[]>;
        getRecientes: (limite: number) => Promise<Transaccion[]>;
        getUltima:    (turnoId: number) => Promise<Transaccion | null>;
      };
      movimientos: {
        registrar:      (data: any) => Promise<void>;
        listarPorTurno: (turnoId: number) => Promise<MovimientoCaja[]>;
        cancelar:       (id: number, motivo: string) => Promise<void>;
      };
      devoluciones: {
        cancelar:   (data: any) => Promise<void>;
        parcial:    (data: any) => Promise<void>;
        getByTrans: (id: number) => Promise<any[]>;
        recientes:  (lim: number) => Promise<any[]>;
      };
      informes: {
        ventasPorPeriodo:      (d: string, h: string) => Promise<any>;
        articulosMasVendidos:  (d: string, h: string) => Promise<any[]>;
        utilidadBruta:         (d: string, h: string) => Promise<any>;
        saldosClientes:        () => Promise<any[]>;
        ventasPorDia:          (d: string, h: string) => Promise<any[]>;
        ventasPorHora:         (d: string) => Promise<any[]>;
        mejorDia:              (d: string, h: string) => Promise<any>;
        resumenRapido:         (d: string, h: string) => Promise<any>;
        ventasPorCliente:      (d: string, h: string) => Promise<any[]>;
        ventasPorMes:          (d: string, h: string) => Promise<any[]>;
        ventasPorDepartamento: (d: string, h: string) => Promise<any[]>;
        ventasPorHoraRango:    (d: string, h: string) => Promise<any[]>;
      };
      proveedores: {
        getAll:                () => Promise<Proveedor[]>;
        getById:               (id: number) => Promise<Proveedor>;
        search:                (q: string) => Promise<Proveedor[]>;
        create:                (data: Partial<Proveedor>) => Promise<Proveedor>;
        update:                (id: number, data: Partial<Proveedor>) => Promise<void>;
        delete:                (id: number) => Promise<void>;
        articulosConStockBajo: () => Promise<any[]>;
      };
      pedidos: {
        getAll:         () => Promise<any[]>;
        getById:        (id: number) => Promise<any>;
        crear:          (prvId: number, prvNombre: string, items: any[]) => Promise<any>;
        marcarRecibido: (pedidoId: number, itemsRecibidos: any[]) => Promise<void>;
      };
      promociones: {
        listarPorArticulo: (articuloId: number) => Promise<any[]>;
        listarActivas:     (ids: number[]) => Promise<any[]>;
        listarTodas:       () => Promise<any[]>;
        crear:             (data: any) => Promise<any>;
        eliminar:          (id: number) => Promise<void>;
      };
      pedidosCompra: {
        listar:        () => Promise<any[]>;
        getById:       (id: number) => Promise<any>;
        crear:         (data: any) => Promise<any>;
        actualizar:    (id: number, data: any) => Promise<void>;
        marcarEnviado: (id: number) => Promise<void>;
        recibir:       (id: number, items: any[]) => Promise<void>;
        cancelar:      (id: number) => Promise<void>;
        exportarPDF:   (id: number) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
        exportarCSV:   (id: number) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      };
      recepciones: {
        crear:   (data: any) => Promise<any>;
        listar:  () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
      };
      turnos: {
        getActivo:       () => Promise<Turno | null>;
        obtenerActivo:   () => Promise<Turno | null>;
        abrir:           (efectivoInicial: number) => Promise<Turno>;
        calcularResumen: (id: number) => Promise<any>;
        cerrar:          (id: number, efectivoReal: number, notas: string) => Promise<void>;
        historial:       (limite: number) => Promise<Turno[]>;
        detalle:         (id: number) => Promise<any>;
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
        detallePendientes: () => Promise<{ articulos: number; clientes: number; transacciones: number }>;
      };
      auth: {
        login:            (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
        setSession:       (session: Session) => Promise<void>;
        solicitarReset:   (email: string) => Promise<{ ok: boolean; error?: string }>;
        verificarCodigo:  (email: string, codigo: string) => Promise<{ ok: boolean; error?: string }>;
        resetearPassword: (email: string, codigo: string, password: string) => Promise<{ ok: boolean; error?: string }>;
      };
      inventario: {
        ajustar:           (data: any) => Promise<void>;
        listarMovimientos: (filtros: any) => Promise<any[]>;
        kardex:            (artId: number) => Promise<any[]>;
        stockBajo:         () => Promise<any[]>;
      };
      soporte: {
        enviarReporte: (datos: any) => Promise<{ ok: boolean; error?: string }>;
      };
      reporteEmail: {
        getConfig:    () => Promise<any>;
        setConfig:    (data: any) => Promise<void>;
        enviarPrueba: (email: string, frecuencia: string) => Promise<{ ok: boolean; error?: string }>;
      };
      printer: {
        listarImpresoras:       () => Promise<string[]>;
        imprimir:               (transaccionId: number, extra: any) => Promise<{ ok: boolean; error?: string }>;
        imprimirPrueba:         (nombreImpresora: string) => Promise<{ ok: boolean; noImpresora?: boolean; error?: string }>;
        imprimirCorteZ:         (turnoId: number) => Promise<void>;
        imprimirEstadoCuenta:   (clienteId: number) => Promise<void>;
      };
      navegar:       (file: string) => Promise<void>;
      modalState:    (open: boolean) => void;
      setModalCobro: (open: boolean) => void;
      onNavegar:     (cb: (file: string) => void) => () => void;
      onCobrarConTicket: (cb: () => void) => () => void;
      onCobrarSinTicket: (cb: () => void) => () => void;
      onAbrirCobro:      (cb: () => void) => () => void;
      startDownload:    () => Promise<void>;
      installUpdate:    () => Promise<void>;
      getPendingUpdate: () => Promise<{ version: string; releaseNotes: string | null } | null>;
      onUpdateAvailable:  (cb: (info: any) => void) => void;
      onUpdateProgress:   (cb: (data: any) => void) => void;
      onUpdateDownloaded: (cb: () => void) => void;
      onUpdateError:      (cb: (message: string) => void) => void;
    };
  }
}
