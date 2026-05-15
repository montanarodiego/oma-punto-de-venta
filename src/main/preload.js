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
    delete:  (id)         => ipcRenderer.invoke('clientes:delete', id),
    search:  (query)      => ipcRenderer.invoke('clientes:search', query),
  },

  // Transacciones
  transacciones: {
    getAll:      ()                 => ipcRenderer.invoke('transacciones:getAll'),
    getById:     (id)               => ipcRenderer.invoke('transacciones:getById', id),
    create:      (data)             => ipcRenderer.invoke('transacciones:create', data),
    getByFecha:  (desde, hasta)     => ipcRenderer.invoke('transacciones:getByFecha', desde, hasta),
  },

  // Configuración
  config: {
    get:    (clave)         => ipcRenderer.invoke('config:get', clave),
    getAll: ()              => ipcRenderer.invoke('config:getAll'),
    set:    (clave, valor)  => ipcRenderer.invoke('config:set', clave, valor),
  },
});
