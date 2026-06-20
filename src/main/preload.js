const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Usuarios
  usuarios: {
    hayUsuarios:  ()                  => ipcRenderer.invoke('usuarios:hayUsuarios'),
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
    search:          (query)  => ipcRenderer.invoke('articulos:search', query),
    searchPaged:     (params) => ipcRenderer.invoke('articulos:searchPaged', params),
    precioHistorial: (id)     => ipcRenderer.invoke('articulos:precioHistorial', id),
  },

  // Clientes
  clientes: {
    getAll:  ()           => ipcRenderer.invoke('clientes:getAll'),
    getById: (id)         => ipcRenderer.invoke('clientes:getById', id),
    create:  (data)       => ipcRenderer.invoke('clientes:create', data),
    update:  (id, data)   => ipcRenderer.invoke('clientes:update', id, data),
    delete:           (id)         => ipcRenderer.invoke('clientes:delete', id),
    search:           (query)      => ipcRenderer.invoke('clientes:search', query),
    searchPaged:      (params)     => ipcRenderer.invoke('clientes:searchPaged', params),
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
    getUltima:    (turnoId)        => ipcRenderer.invoke('transacciones:getUltima', turnoId),
  },

  // Movimientos de caja
  movimientos: {
    registrar:      (data)            => ipcRenderer.invoke('movimientos:registrar', data),
    listarPorTurno: (turnoId)         => ipcRenderer.invoke('movimientos:listarPorTurno', turnoId),
    cancelar:       (id, motivo)      => ipcRenderer.invoke('movimientos:cancelar', id, motivo),
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
    ventasPorMes:         (d, h) => ipcRenderer.invoke('informes:ventasPorMes',         d, h),
    ventasPorDepartamento:(d, h) => ipcRenderer.invoke('informes:ventasPorDepartamento',d, h),
    ventasPorHoraRango:   (d, h) => ipcRenderer.invoke('informes:ventasPorHoraRango',   d, h),
  },

  // Proveedores
  proveedores: {
    getAll:    ()           => ipcRenderer.invoke('proveedores:getAll'),
    getById:   (id)         => ipcRenderer.invoke('proveedores:getById', id),
    search:      (q)          => ipcRenderer.invoke('proveedores:search', q),
    searchPaged: (params)     => ipcRenderer.invoke('proveedores:searchPaged', params),
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
    listarTodas:       ()           => ipcRenderer.invoke('promociones:listarTodas'),
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
    exportarPDF:   (id)         => ipcRenderer.invoke('pedidosCompra:exportarPDF', id),
    exportarCSV:   (id)         => ipcRenderer.invoke('pedidosCompra:exportarCSV', id),
  },

  // Recepciones
  recepciones: {
    crear:   (data) => ipcRenderer.invoke('recepciones:crear',   data),
    listar:  ()     => ipcRenderer.invoke('recepciones:listar'),
    getById: (id)   => ipcRenderer.invoke('recepciones:getById', id),
  },

  // Turnos
  turnos: {
    getActivo:       ()                              => ipcRenderer.invoke('turnos:obtenerActivo'),
    obtenerActivo:   ()                              => ipcRenderer.invoke('turnos:obtenerActivo'),
    abrir:           (efectivoInicial)               => ipcRenderer.invoke('turnos:abrir', efectivoInicial),
    calcularResumen: (id)                            => ipcRenderer.invoke('turnos:calcularResumen', id),
    cerrar:          (id, efectivoReal, notas)       => ipcRenderer.invoke('turnos:cerrar', id, efectivoReal, notas),
    historial:       (limite)                        => ipcRenderer.invoke('turnos:historial', limite),
    detalle:         (id)                            => ipcRenderer.invoke('turnos:detalle', id),
  },

  // Backup
  backup: {
    hacerAhora:        ()     => ipcRenderer.invoke('backup:hacerAhora'),
    listar:            ()     => ipcRenderer.invoke('backup:listar'),
    getRuta:           ()     => ipcRenderer.invoke('backup:getRuta'),
    abrirCarpeta:      ()     => ipcRenderer.invoke('backup:abrirCarpeta'),
    seleccionarArchivo:()     => ipcRenderer.invoke('backup:seleccionarArchivo'),
    restaurar:         (ruta) => ipcRenderer.invoke('backup:restaurar', ruta),
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
    manual:            ()  => ipcRenderer.invoke('sync:manual'),
    contarPendientes:  ()  => ipcRenderer.invoke('sync:contarPendientes'),
    detallePendientes: ()  => ipcRenderer.invoke('sync:detallePendientes'),
  },

  // Autenticación / licencia
  auth: {
    login:            (email, password)          => ipcRenderer.invoke('auth:login', email, password),
    setSession:       (session)                  => ipcRenderer.invoke('auth:setSession', session),
    solicitarReset:   (email)                    => ipcRenderer.invoke('auth:solicitarReset', email),
    verificarCodigo:  (email, codigo)            => ipcRenderer.invoke('auth:verificarCodigo', email, codigo),
    resetearPassword: (email, codigo, password)  => ipcRenderer.invoke('auth:resetearPassword', email, codigo, password),
    estadoSync:       ()                         => ipcRenderer.invoke('auth:estadoSync'),
  },

  // Licencia (activación por clave en pantalla)
  licencia: {
    estado:  ()    => ipcRenderer.invoke('licencia:estado'),
    activar: (key) => ipcRenderer.invoke('licencia:activar', key),
  },

  // Facturación electrónica (ARCA/AFIP)
  facturacion: {
    estado:  ()        => ipcRenderer.invoke('facturacion:estado'),
    emitir:  (payload) => ipcRenderer.invoke('facturacion:emitir', payload),
    porTransaccion: (id) => ipcRenderer.invoke('comprobantes:obtenerPorTransaccion', id),
  },

  // Onboarding/configuración del certificado fiscal (ARCA)
  fiscal: {
    estado:         ()      => ipcRenderer.invoke('fiscal:estado'),
    guardarConfig:  (cfg)   => ipcRenderer.invoke('fiscal:guardarConfig', cfg),
    generarCSR:     (datos) => ipcRenderer.invoke('fiscal:generarCSR', datos),
    importarCert:   ()      => ipcRenderer.invoke('fiscal:importarCert'),
    probarConexion: ()      => ipcRenderer.invoke('fiscal:probarConexion'),
    limpiarCert:    ()      => ipcRenderer.invoke('fiscal:limpiarCert'),
  },
  abrirExterno: (url) => ipcRenderer.invoke('shell:abrirExterno', url),

  // Inventario
  inventario: {
    ajustar:          (data)    => ipcRenderer.invoke('inventario:ajustar', data),
    listarMovimientos:(filtros) => ipcRenderer.invoke('inventario:listarMovimientos', filtros),
    kardex:           (artId)   => ipcRenderer.invoke('inventario:kardex', artId),
    stockBajo:        ()        => ipcRenderer.invoke('inventario:stockBajo'),
  },

  // Soporte
  soporte: {
    enviarReporte: (datos) => ipcRenderer.invoke('soporte:enviarReporte', datos),
  },

  // Log de actividad (auditoría — solo admin)
  actividad: {
    listar: (filtros) => ipcRenderer.invoke('actividad:listar', filtros),
  },

  // Reportes automáticos por email
  reporteEmail: {
    getConfig:    ()                   => ipcRenderer.invoke('reporteEmail:getConfig'),
    setConfig:    (data)               => ipcRenderer.invoke('reporteEmail:setConfig', data),
    enviarPrueba: (email, frecuencia)  => ipcRenderer.invoke('reporteEmail:enviarPrueba', email, frecuencia),
  },

  // Impresora térmica
  printer: {
    listarImpresoras: ()                       => ipcRenderer.invoke('printer:listarImpresoras'),
    imprimir:         (transaccionId, extra)   => ipcRenderer.invoke('printer:imprimir', transaccionId, extra),
    imprimirPrueba:   (nombreImpresora)        => ipcRenderer.invoke('printer:imprimirPrueba', nombreImpresora),
    imprimirCorteZ:        (turnoId)    => ipcRenderer.invoke('printer:imprimirCorteZ', turnoId),
    imprimirEstadoCuenta:  (clienteId)  => ipcRenderer.invoke('printer:imprimirEstadoCuenta', clienteId),
  },

  // Integridad de la DB — resultado del quick_check al arrancar
  db: {
    integrityStatus: () => ipcRenderer.invoke('db:integrity-status'),
  },

  // Control de zoom nativo (setZoomFactor en el proceso main)
  ui: {
    setZoom: (factor) => ipcRenderer.invoke('ui:setZoom', factor),
  },

  // Log desde renderer → electron-log en el proceso principal
  log: {
    error: (message, detail) => ipcRenderer.send('log:error', message, detail),
  },

  // Navegación (main process loadFile — funciona aunque location.href falle en Electron)
  navegar: (file) => ipcRenderer.invoke('navegar', file),

  // Estado de modales — bloquea F1-F8 en el proceso principal
  modalState:    (open) => ipcRenderer.send('modal-state',       open),
  setModalCobro: (open) => ipcRenderer.send('modal-cobro-state', open),

  // Suscripción a navegación global desde main (globalShortcut F1-F8)
  onNavegar: (cb) => {
    const handler = (_e, file) => cb(file);
    ipcRenderer.on('navegar-global', handler);
    return () => ipcRenderer.removeListener('navegar-global', handler);
  },

  // Cobro desde globalShortcut (F1/F2 dentro del modal de cobro)
  onCobrarConTicket: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('cobrar-con-ticket', handler);
    return () => ipcRenderer.removeListener('cobrar-con-ticket', handler);
  },
  onCobrarSinTicket: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('cobrar-sin-ticket', handler);
    return () => ipcRenderer.removeListener('cobrar-sin-ticket', handler);
  },
  onAbrirCobro: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('abrir-cobro', handler);
    return () => ipcRenderer.removeListener('abrir-cobro', handler);
  },
  onAbrirVerificador: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('abrir-verificador', handler);
    return () => ipcRenderer.removeListener('abrir-verificador', handler);
  },

  // Auto-updater
  startDownload:    () => ipcRenderer.invoke('updater:start-download'),
  installUpdate:    () => ipcRenderer.invoke('updater:install'),
  getPendingUpdate: () => ipcRenderer.invoke('updater:get-pending'),
  onUpdateAvailable:  (cb) => { ipcRenderer.on('update-available',  (_e, info)    => cb(info));    },
  onUpdateProgress:   (cb) => { ipcRenderer.on('update-progress',   (_e, data)    => cb(data));    },
  onUpdateDownloaded: (cb) => { ipcRenderer.on('update-downloaded', ()            => cb());        },
  onUpdateError:      (cb) => { ipcRenderer.on('update-error',      (_e, message) => cb(message)); },
});
