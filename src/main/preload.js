const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Usuarios
  usuarios: {
    login:        (usuario, password) => ipcRenderer.invoke('usuarios:login', usuario, password),
    listar:       ()                  => ipcRenderer.invoke('usuarios:listar'),
    crear:        (data)              => ipcRenderer.invoke('usuarios:crear', data),
    actualizar:   (id, data)          => ipcRenderer.invoke('usuarios:actualizar', id, data),
    toggleActivo: (id)                => ipcRenderer.invoke('usuarios:toggleActivo', id),
  },

  // Departamentos
  departamentos: {
    getAll:  ()           => ipcRenderer.invoke('departamentos:getAll'),
    create:  (data)       => ipcRenderer.invoke('departamentos:create', data),
    update:  (id, data)   => ipcRenderer.invoke('departamentos:update', id, data),
    delete:  (id)         => ipcRenderer.invoke('departamentos:delete', id),
  },

  // Kits
  kits: {
    getComponentes: (kitId)       => ipcRenderer.invoke('kits:getComponentes', kitId),
    setComponentes: (kitId, comp) => ipcRenderer.invoke('kits:setComponentes', kitId, comp),
  },

  // Artículos
  articulos: {
    getAll:      ()           => ipcRenderer.invoke('articulos:getAll'),
    getById:     (id)         => ipcRenderer.invoke('articulos:getById', id),
    getByCodigo: (codigo)     => ipcRenderer.invoke('articulos:getByCodigo', codigo),
    create:      (data)       => ipcRenderer.invoke('articulos:create', data),
    update:      (id, data)   => ipcRenderer.invoke('articulos:update', id, data),
    delete:      (id)         => ipcRenderer.invoke('articulos:delete', id),
    search:      (query)      => ipcRenderer.invoke('articulos:search', query),
  },

  // Clientes
  clientes: {
    getAll:  ()           => ipcRenderer.invoke('clientes:getAll'),
    getById: (id)         => ipcRenderer.invoke('clientes:getById', id),
    create:  (data)       => ipcRenderer.invoke('clientes:create', data),
    update:  (id, data)   => ipcRenderer.invoke('clientes:update', id, data),
    delete:           (id)         => ipcRenderer.invoke('clientes:delete', id),
    search:           (query)      => ipcRenderer.invoke('clientes:search', query),
    getTransacciones: (id)                  => ipcRenderer.invoke('clientes:getTransacciones', id),
    listarPagos:      (id)                  => ipcRenderer.invoke('clientes:listarPagos', id),
    cancelarPago:     (pagoId)              => ipcRenderer.invoke('clientes:cancelarPago', pagoId),
    liquidarDeuda:    (id, formaPago)       => ipcRenderer.invoke('clientes:liquidarDeuda', id, formaPago),
    registrarPago:    (id, monto, formaPago) => ipcRenderer.invoke('clientes:registrarPago', id, monto, formaPago),
  },

  // Transacciones
  transacciones: {
    getAll:       ()               => ipcRenderer.invoke('transacciones:getAll'),
    getById:      (id)             => ipcRenderer.invoke('transacciones:getById', id),
    create:       (data)           => ipcRenderer.invoke('transacciones:create', data),
    getByFecha:   (desde, hasta)   => ipcRenderer.invoke('transacciones:getByFecha', desde, hasta),
    getRecientes: (limite)         => ipcRenderer.invoke('transacciones:getRecientes', limite),
  },

  // Movimientos de caja
  movimientos: {
    registrar:      (data)     => ipcRenderer.invoke('movimientos:registrar', data),
    listarPorTurno: (turnoId)  => ipcRenderer.invoke('movimientos:listarPorTurno', turnoId),
  },

  // Devoluciones
  devoluciones: {
    cancelar:     (data)  => ipcRenderer.invoke('devoluciones:cancelar',   data),
    parcial:      (data)  => ipcRenderer.invoke('devoluciones:parcial',    data),
    getByTrans:   (id)    => ipcRenderer.invoke('devoluciones:getByTrans', id),
    recientes:    (lim)   => ipcRenderer.invoke('devoluciones:recientes',  lim),
  },

  // Informes
  informes: {
    ventasPorPeriodo:     (d, h) => ipcRenderer.invoke('informes:ventasPorPeriodo',     d, h),
    articulosMasVendidos: (d, h) => ipcRenderer.invoke('informes:articulosMasVendidos', d, h),
    utilidadBruta:        (d, h) => ipcRenderer.invoke('informes:utilidadBruta',        d, h),
    saldosClientes:       ()     => ipcRenderer.invoke('informes:saldosClientes'),
    ventasPorDia:         (d, h) => ipcRenderer.invoke('informes:ventasPorDia',         d, h),
    ventasPorHora:        (d)    => ipcRenderer.invoke('informes:ventasPorHora',        d),
    mejorDia:             (d, h) => ipcRenderer.invoke('informes:mejorDia',             d, h),
    resumenRapido:        (d, h) => ipcRenderer.invoke('informes:resumenRapido',        d, h),
    ventasPorCliente:     (d, h) => ipcRenderer.invoke('informes:ventasPorCliente',     d, h),
  },

  // Proveedores
  proveedores: {
    getAll:    ()           => ipcRenderer.invoke('proveedores:getAll'),
    getById:   (id)         => ipcRenderer.invoke('proveedores:getById', id),
    search:    (q)          => ipcRenderer.invoke('proveedores:search', q),
    create:    (data)       => ipcRenderer.invoke('proveedores:create', data),
    update:    (id, data)   => ipcRenderer.invoke('proveedores:update', id, data),
    delete:    (id)         => ipcRenderer.invoke('proveedores:delete', id),
    articulosConStockBajo: () => ipcRenderer.invoke('proveedores:articulosConStockBajo'),
  },

  // Pedidos de proveedor
  pedidos: {
    getAll:         ()                            => ipcRenderer.invoke('pedidos:getAll'),
    getById:        (id)                          => ipcRenderer.invoke('pedidos:getById', id),
    crear:          (prvId, prvNombre, items)     => ipcRenderer.invoke('pedidos:crear', prvId, prvNombre, items),
    marcarRecibido: (pedidoId, itemsRecibidos)    => ipcRenderer.invoke('pedidos:marcarRecibido', pedidoId, itemsRecibidos),
  },

  // Promociones por volumen
  promociones: {
    listarPorArticulo: (articuloId) => ipcRenderer.invoke('promociones:listarPorArticulo', articuloId),
    listarActivas:     (ids)        => ipcRenderer.invoke('promociones:listarActivas', ids),
    crear:             (data)       => ipcRenderer.invoke('promociones:crear', data),
    eliminar:          (id)         => ipcRenderer.invoke('promociones:eliminar', id),
  },

  // Pedidos de compra (órdenes)
  pedidosCompra: {
    listar:        ()           => ipcRenderer.invoke('pedidosCompra:listar'),
    getById:       (id)         => ipcRenderer.invoke('pedidosCompra:getById', id),
    crear:         (data)       => ipcRenderer.invoke('pedidosCompra:crear', data),
    actualizar:    (id, data)   => ipcRenderer.invoke('pedidosCompra:actualizar', id, data),
    marcarEnviado: (id)         => ipcRenderer.invoke('pedidosCompra:marcarEnviado', id),
    recibir:       (id, items)  => ipcRenderer.invoke('pedidosCompra:recibir', id, items),
    cancelar:      (id)         => ipcRenderer.invoke('pedidosCompra:cancelar', id),
  },

  // Recepciones
  recepciones: {
    crear:   (data) => ipcRenderer.invoke('recepciones:crear',   data),
    listar:  ()     => ipcRenderer.invoke('recepciones:listar'),
    getById: (id)   => ipcRenderer.invoke('recepciones:getById', id),
  },

  // Turnos
  turnos: {
    obtenerActivo:   ()                              => ipcRenderer.invoke('turnos:obtenerActivo'),
    abrir:           (efectivoInicial)               => ipcRenderer.invoke('turnos:abrir', efectivoInicial),
    calcularResumen: (id)                            => ipcRenderer.invoke('turnos:calcularResumen', id),
    cerrar:          (id, efectivoReal, notas)       => ipcRenderer.invoke('turnos:cerrar', id, efectivoReal, notas),
    historial:       (limite)                        => ipcRenderer.invoke('turnos:historial', limite),
    detalle:         (id)                            => ipcRenderer.invoke('turnos:detalle', id),
  },

  // Backup
  backup: {
    hacerAhora:    ()  => ipcRenderer.invoke('backup:hacerAhora'),
    listar:        ()  => ipcRenderer.invoke('backup:listar'),
    getRuta:       ()  => ipcRenderer.invoke('backup:getRuta'),
    abrirCarpeta:  ()  => ipcRenderer.invoke('backup:abrirCarpeta'),
  },

  // Caja
  caja: {
    abrirComprobante: (data) => ipcRenderer.invoke('caja:abrirComprobante', data),
  },

  // Configuración
  config: {
    get:    (clave)         => ipcRenderer.invoke('config:get', clave),
    getAll: ()              => ipcRenderer.invoke('config:getAll'),
    set:    (clave, valor)  => ipcRenderer.invoke('config:set', clave, valor),
  },

  // Sincronización
  sync: {
    manual:           ()  => ipcRenderer.invoke('sync:manual'),
    contarPendientes: ()  => ipcRenderer.invoke('sync:contarPendientes'),
  },

  // Autenticación / licencia
  auth: {
    login: (email, password) => ipcRenderer.invoke('auth:login', email, password),
  },

  // Inventario
  inventario: {
    ajustar:          (data)    => ipcRenderer.invoke('inventario:ajustar', data),
    listarMovimientos:(filtros) => ipcRenderer.invoke('inventario:listarMovimientos', filtros),
    kardex:           (artId)   => ipcRenderer.invoke('inventario:kardex', artId),
    stockBajo:        ()        => ipcRenderer.invoke('inventario:stockBajo'),
  },

  // Navegación (main process loadFile — funciona aunque location.href falle en Electron)
  navegar: (file) => ipcRenderer.invoke('navegar', file),
});
