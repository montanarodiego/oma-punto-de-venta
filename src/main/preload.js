const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
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
    getTransacciones: (id)         => ipcRenderer.invoke('clientes:getTransacciones', id),
    registrarPago:    (id, monto)  => ipcRenderer.invoke('clientes:registrarPago', id, monto),
  },

  // Transacciones
  transacciones: {
    getAll:      ()                 => ipcRenderer.invoke('transacciones:getAll'),
    getById:     (id)               => ipcRenderer.invoke('transacciones:getById', id),
    create:      (data)             => ipcRenderer.invoke('transacciones:create', data),
    getByFecha:  (desde, hasta)     => ipcRenderer.invoke('transacciones:getByFecha', desde, hasta),
  },

  // Informes
  informes: {
    ventasPorPeriodo:     (d, h) => ipcRenderer.invoke('informes:ventasPorPeriodo',     d, h),
    articulosMasVendidos: (d, h) => ipcRenderer.invoke('informes:articulosMasVendidos', d, h),
    utilidadBruta:        (d, h) => ipcRenderer.invoke('informes:utilidadBruta',        d, h),
    saldosClientes:       ()     => ipcRenderer.invoke('informes:saldosClientes'),
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
});
