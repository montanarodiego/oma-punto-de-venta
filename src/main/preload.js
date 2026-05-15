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

  // Autenticación / licencia
  auth: {
    login: (email, password) => ipcRenderer.invoke('auth:login', email, password),
  },
});
