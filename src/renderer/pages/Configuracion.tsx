import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { useSession } from '../context/SessionContext';
import { Card, CardHeader, CardBody, Toggle, Button, Field, Input, Select, Badge, Modal } from '../components/ui';
import type { Usuario, BackupInfo } from '../types/api';

const WIZARD_MODOS = [
  { id: 'monotributista',       nombre: 'Monotributista',         desc: 'Precios finales, sin IVA desglosado',              ejemplos: 'Kiosco, almacén, bazar, librería' },
  { id: 'responsable_inscripto',nombre: 'Responsable Inscripto',  desc: 'IVA desglosado (21% por defecto)',                  ejemplos: 'Distribuidora, mayorista, empresa' },
  { id: 'restaurante',          nombre: 'Restaurante / Rotisería',desc: 'Sin IVA desglosado, con propina',                   ejemplos: 'Rotisería, pizzería, comida para llevar' },
  { id: 'mayorista',            nombre: 'Mayorista',              desc: 'Precios sin IVA; IVA sumado al total',              ejemplos: 'Distribuidora, depósito, mayoreo' },
  { id: 'farmacia',             nombre: 'Farmacia / Perfumería',  desc: 'IVA múltiples tasas (21%, 10,5%, 0%)',             ejemplos: 'Farmacia, perfumería, cosmética' },
  { id: 'personalizado',        nombre: 'Personalizado',          desc: 'Configurá manualmente desde acá',                   ejemplos: '' },
];

const HUD_OPCIONES = [
  { id: 'compacto', label: 'Compacto',  desc: 'Tamaño base — pantalla cercana',  size: '13px' },
  { id: 'normal',   label: 'Normal',    desc: '× 1.4 — visión cómoda',           size: '18px' },
  { id: 'grande',   label: 'Grande',    desc: '× 1.85 — 1-2 m de distancia',     size: '24px' },
  { id: 'gigante',  label: 'Gigante',   desc: '× 2.4 — kiosco / accesibilidad',  size: '31px' },
];

export default function Configuracion() {
  const { showToast } = useToast();
  const { session } = useSession();
  const esAdmin = session?.rol === 'admin';

  // Form fields
  const [nombre, setNombre]     = useState('');
  const [dir, setDir]           = useState('');
  const [tel, setTel]           = useState('');
  const [cuit, setCuit]         = useState('');
  const [tasaIva, setTasaIva]   = useState('21');
  const [moneda, setMoneda]     = useState('$');
  const [msgTicket, setMsgTicket] = useState('');
  const [mostrarIva, setMostrarIva] = useState(true);
  const [saving, setSaving]     = useState(false);

  // Modo
  const [modo, setModo]         = useState('');
  const [tasaDefault, setTasaDefault] = useState('21');
  const [wizardOpen, setWizardOpen] = useState(false);

  // HUD
  const [hud, setHud]           = useState('normal');

  // Backup
  const [backups, setBackups]   = useState<BackupInfo[]>([]);
  const [backupRes, setBackupRes] = useState('');

  // Sync
  const [syncRes, setSyncRes]   = useState('');
  const [syncing, setSyncing]   = useState(false);

  // Reporte email
  const [repActivo, setRepActivo]     = useState(false);
  const [repDest, setRepDest]         = useState('');
  const [repFreq, setRepFreq]         = useState('diario');
  const [repHora, setRepHora]         = useState('08:00');
  const [repDiaSem, setRepDiaSem]     = useState('1');
  const [repDiaMes, setRepDiaMes]     = useState('1');
  const [repUltimo, setRepUltimo]     = useState('');
  const [repSending, setRepSending]   = useState(false);
  const [repRes, setRepRes]           = useState('');

  // Impresora
  const [impresoras, setImpresoras]   = useState<string[]>([]);
  const [impresoraActual, setImpresoraActual] = useState('');
  const [imprRes, setImprRes]         = useState('');

  // Usuarios
  const [usuarios, setUsuarios]       = useState<Usuario[]>([]);
  const [usuarioModal, setUsuarioModal] = useState(false);
  const [editUsuarioId, setEditUsuarioId] = useState<number|null>(null);
  const [uNombre, setUNombre]         = useState('');
  const [uUsuario, setUUsuario]       = useState('');
  const [uEmail, setUEmail]           = useState('');
  const [uPass, setUPass]             = useState('');
  const [uRol, setURol]               = useState<'cajero'|'admin'>('cajero');
  const [uError, setUError]           = useState('');
  const [uSaving, setUSaving]         = useState(false);

  useEffect(() => { cargarTodo(); }, []);

  async function cargarTodo() {
    const [cfg, modoVal, tasaDef, hudVal] = await Promise.all([
      window.api.config.getAll(),
      window.api.config.get('modo_negocio'),
      window.api.config.get('tasa_iva'),
      window.api.config.get('tamano_hud'),
    ]);
    setNombre(cfg.nombre_negocio ?? '');
    setDir(cfg.direccion ?? '');
    setTel(cfg.telefono ?? '');
    setCuit(cfg.cuit ?? '');
    setTasaIva(cfg.tasa_iva ?? cfg.impuesto_porcentaje ?? '21');
    setMoneda(cfg.moneda ?? '$');
    setMsgTicket(cfg.mensaje_ticket ?? '');
    setMostrarIva(cfg.mostrar_iva_desglosado !== '0');
    setModo(modoVal ?? '');
    setTasaDefault(tasaDef ?? '21');
    setHud(hudVal ?? 'normal');

    cargarBackups();
    cargarImpresoras();
    cargarReporte();
    if (esAdmin) cargarUsuarios();
  }

  async function cargarBackups() {
    const list = await window.api.backup.listar();
    setBackups(list ?? []);
  }

  async function cargarImpresoras() {
    const list = await window.api.printer.listarImpresoras();
    const actual = await window.api.config.get('impresora_nombre');
    setImpresoras(list ?? []);
    setImpresoraActual(actual ?? '');
  }

  async function cargarReporte() {
    try {
      const cfg = await window.api.reporteEmail.getConfig();
      setRepActivo(cfg.activo === '1');
      setRepDest(cfg.destino ?? '');
      setRepFreq(cfg.frecuencia ?? 'diario');
      setRepHora(cfg.hora ?? '08:00');
      setRepDiaSem(cfg.diaSemana ?? '1');
      setRepDiaMes(String(cfg.diaMes ?? '1'));
      if (cfg.ultimoEnvio) {
        const d = new Date(cfg.ultimoEnvio).toLocaleString('es-AR', { day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' });
        setRepUltimo('Último envío: ' + d);
      }
    } catch {}
  }

  async function cargarUsuarios() {
    const list = await window.api.usuarios.listar();
    setUsuarios(list);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const tasa = parseFloat(tasaIva);
    if (isNaN(tasa) || tasa < 0 || tasa > 100) { showToast('La tasa de IVA debe ser entre 0 y 100.', 'error'); return; }
    setSaving(true);
    try {
      const vals: Record<string,string> = { nombre_negocio: nombre.trim(), direccion: dir.trim(), telefono: tel.trim(), cuit: cuit.trim(), tasa_iva: String(tasa), impuesto_porcentaje: String(tasa), moneda: moneda.trim() || '$', mostrar_iva_desglosado: mostrarIva ? '1' : '0', mensaje_ticket: msgTicket.trim() };
      for (const [k,v] of Object.entries(vals)) await window.api.config.set(k, v);
      showToast('Configuración guardada.', 'ok');
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function cambiarModo(id: string) {
    await window.api.config.set('modo_negocio', id);
    setModo(id);
    setWizardOpen(false);
    showToast('Modo actualizado: ' + (WIZARD_MODOS.find(m => m.id === id)?.nombre ?? id), 'ok');
  }

  async function cambiarHud(id: string) {
    setHud(id);
    await window.api.config.set('tamano_hud', id);
    document.documentElement.classList.remove('hud-compacto','hud-normal','hud-grande','hud-gigante');
    document.documentElement.classList.add('hud-' + id);
    localStorage.setItem('oma_hud', id);
    showToast('Tamaño actualizado.', 'ok');
  }

  async function syncAhora() {
    setSyncing(true); setSyncRes('');
    const res = await window.api.sync.manual();
    if (res.ok) {
      const s = res.sincronizados ?? 0; const f = res.fallidos ?? 0;
      setSyncRes(s === 0 && f === 0 ? 'Sin pendientes.' : `${s} sincronizado${s!==1?'s':''}.${f>0?` ${f} fallido${f!==1?'s':''}.`:''}`);
    } else setSyncRes('Error: ' + res.error);
    setSyncing(false);
  }

  async function backupAhora() {
    setBackupRes('');
    const res = await window.api.backup.hacerAhora();
    if (res.ok) { setBackupRes('Backup creado.'); cargarBackups(); }
    else setBackupRes('Error: ' + res.error);
    setTimeout(() => setBackupRes(''), 4000);
  }

  async function restaurar(ruta: string) {
    const res = await window.api.backup.restaurar(ruta);
    if (res && !res.ok && !res.cancelado) showToast('Error: ' + res.error, 'error');
  }

  async function restaurarArchivo() {
    const ruta = await window.api.backup.seleccionarArchivo();
    if (ruta) await restaurar(ruta);
  }

  async function guardarRepConfig(patch: Record<string,string>) {
    try { await window.api.reporteEmail.setConfig(patch); } catch {}
  }

  async function enviarRepPrueba() {
    if (!repDest.trim()) { setRepRes('Ingresá un email destino.'); return; }
    setRepSending(true); setRepRes('Generando…');
    const res = await window.api.reporteEmail.enviarPrueba(repDest, repFreq);
    setRepRes(res.ok ? `Reporte enviado a ${repDest}` : 'Error: ' + res.error);
    setRepSending(false);
    setTimeout(() => setRepRes(''), 6000);
  }

  async function guardarUsuarioForm(e: React.FormEvent) {
    e.preventDefault();
    if (!uNombre.trim() || !uUsuario.trim()) { setUError('Nombre y usuario son obligatorios.'); return; }
    if (!editUsuarioId && !uPass) { setUError('La contraseña es obligatoria.'); return; }
    setUSaving(true); setUError('');
    try {
      if (editUsuarioId) await window.api.usuarios.actualizar(editUsuarioId, { nombre: uNombre, usuario: uUsuario, email: uEmail || undefined, password: uPass || undefined, rol: uRol });
      else await window.api.usuarios.crear({ nombre: uNombre, usuario: uUsuario, email: uEmail || undefined, password: uPass, rol: uRol });
      setUsuarioModal(false);
      cargarUsuarios();
    } catch (err: any) { setUError(err.message ?? 'Error.'); }
    finally { setUSaving(false); }
  }

  function abrirNuevoUsuario() {
    setEditUsuarioId(null); setUNombre(''); setUUsuario(''); setUEmail(''); setUPass(''); setURol('cajero'); setUError('');
    setUsuarioModal(true);
  }

  async function editarUsuario(u: Usuario) {
    setEditUsuarioId(u.id); setUNombre(u.nombre); setUUsuario(u.usuario); setUEmail(u.email ?? ''); setUPass(''); setURol(u.rol); setUError('');
    setUsuarioModal(true);
  }

  const modoActual = WIZARD_MODOS.find(m => m.id === modo);

  const fmtFecha = (s: string) => new Date(s).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-5">

          {/* ── Datos del negocio (form manual) ── */}
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.04 }}>
          <form onSubmit={guardar}>
          <Card>
            <CardHeader>Datos del negocio</CardHeader>
            <CardBody className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-5">
                {/* Izquierda: identidad */}
                <div className="flex flex-col gap-4">
                  <Field label="Nombre del negocio">
                    <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Oma Distribuciones" />
                  </Field>
                  <Field label="Dirección">
                    <Input value={dir} onChange={e => setDir(e.target.value)} placeholder="Av. Corrientes 1234, Buenos Aires" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Teléfono">
                      <Input value={tel} onChange={e => setTel(e.target.value)} placeholder="011-4567-8900" />
                    </Field>
                    <Field label="CUIT">
                      <Input value={cuit} onChange={e => setCuit(e.target.value)} placeholder="30-12345678-9" />
                    </Field>
                  </div>
                  <Field label="Mensaje en ticket" hint="Se muestra al pie del comprobante">
                    <Input value={msgTicket} onChange={e => setMsgTicket(e.target.value)} placeholder="¡Gracias por elegirnos!" />
                  </Field>
                </div>

                {/* Derecha: parámetros */}
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tasa de IVA (%)" hint="En caja e informes">
                      <Input type="number" step="0.1" min="0" max="100" value={tasaIva} onChange={e => setTasaIva(e.target.value)} placeholder="21" />
                    </Field>
                    <Field label="Símbolo de moneda" hint="Ej: $, USD, €">
                      <Input maxLength={5} value={moneda} onChange={e => setMoneda(e.target.value)} placeholder="$" />
                    </Field>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-[var(--r-in)] border border-border">
                    <Toggle
                      label="Mostrar IVA desglosado"
                      hint="Muestra subtotal + IVA + total en caja y comprobantes"
                      checked={mostrarIva}
                      onChange={e => setMostrarIva(e.target.checked)}
                    />
                  </div>
                </div>
              </div>

              {/* Guardar */}
              <div className="flex items-center gap-4 pt-1 border-t border-border">
                <Button type="submit" variant="primary" loading={saving} style={{ minWidth: 150 }}>
                  Guardar datos
                </Button>
              </div>
            </CardBody>
          </Card>
          </form>
          </motion.div>

          {/* ── Modo de negocio + Tamaño HUD ── */}
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08 }} className="grid grid-cols-2 gap-5">
            {/* Modo */}
            <Card>
              <CardHeader>Modo de negocio</CardHeader>
              <CardBody className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-[var(--r-in)] border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold">{modoActual?.nombre ?? 'Sin configurar'}</div>
                    <div className="text-[12px] text-text-muted mt-0.5 leading-snug">{modoActual?.desc ?? 'Abrí Caja para elegir el modo.'}</div>
                  </div>
                </div>
                {(modo === 'responsable_inscripto' || modo === 'farmacia') && (
                  <Field label="Tasa IVA por defecto">
                    <Select style={{ maxWidth: 200 }} value={tasaDefault} onChange={async e => { setTasaDefault(e.target.value); await window.api.config.set('tasa_iva', e.target.value); await window.api.config.set('impuesto_porcentaje', e.target.value); }}>
                      <option value="21">21%</option>
                      <option value="10.5">10,5%</option>
                      <option value="0">0% (exento)</option>
                    </Select>
                  </Field>
                )}
                {modo === 'restaurante' && (
                  <div className="p-3 bg-surface-2 rounded-[var(--r-in)] border border-border">
                    <Toggle label="Habilitar propina en cobro" hint="Muestra campo de propina antes de cobrar" defaultChecked />
                  </div>
                )}
                <Button variant="ghost" onClick={() => setWizardOpen(true)} style={{ alignSelf: 'flex-start' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
                  Cambiar modo
                </Button>
              </CardBody>
            </Card>

            {/* Tamaño HUD */}
            <Card>
              <CardHeader>Tamaño de pantalla de caja</CardHeader>
              <CardBody>
                <p className="text-[12px] text-text-muted mb-3">Ajustá el tamaño del texto según la distancia a la que trabajás.</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {HUD_OPCIONES.map(op => (
                    <button
                      key={op.id}
                      onClick={() => cambiarHud(op.id)}
                      className={`flex flex-col gap-2 p-3.5 rounded-[var(--r)] text-left border-2 transition-all ${hud === op.id ? 'bg-[rgba(79,142,245,.08)] border-accent' : 'bg-surface-2 border-border hover:border-border-sub'}`}
                    >
                      <span style={{ fontSize: op.size }} className="font-bold leading-none text-text">A</span>
                      <div>
                        <div className={`text-[13px] font-semibold ${hud === op.id ? 'text-accent' : 'text-text'}`}>{op.label}</div>
                        <div className="text-[11px] text-text-muted mt-0.5">{op.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* ── Backup + Sync ── */}
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.12 }} className="grid grid-cols-2 gap-5">
            {/* Backup */}
            <Card>
              <CardHeader>Backup de la base de datos</CardHeader>
              <CardBody className="flex flex-col gap-4">
                <p className="text-[13px] text-text-muted">Se genera automáticamente al cerrar la app. Se conservan los últimos 30 backups.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="ghost" onClick={backupAhora}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Hacer backup
                  </Button>
                  <Button variant="ghost" onClick={restaurarArchivo}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.1"/></svg>
                    Restaurar...
                  </Button>
                  <Button variant="ghost" onClick={() => window.api.backup.abrirCarpeta()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    Abrir carpeta
                  </Button>
                </div>
                {backupRes && <p className={`text-[12px] ${backupRes.startsWith('Error') ? 'text-danger' : 'text-[#4ade80]'}`}>{backupRes}</p>}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle mb-2">Backups guardados</div>
                  <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
                    {backups.length === 0 ? <span className="text-[13px] text-text-subtle">Sin backups.</span> : backups.map(b => (
                      <div key={b.ruta} className="flex items-center gap-2 p-1.5 px-2 bg-surface-2 rounded-[var(--r-in)]">
                        <span className="flex-1 text-[11px] text-text-muted font-mono truncate" title={b.nombre}>{b.nombre}</span>
                        <span className="text-[10px] text-text-subtle shrink-0">{fmtFecha(b.fecha)} · {Math.round(b.tamanio/1024)} KB</span>
                        <button onClick={() => restaurar(b.ruta)} className="text-[11px] text-text-muted hover:text-accent border border-border rounded px-1.5 py-px">Restaurar</button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Sync */}
            <Card>
              <CardHeader>Sincronización con la nube</CardHeader>
              <CardBody className="flex flex-col gap-4">
                <p className="text-[13px] text-text-muted">Sincroniza ventas, productos y clientes pendientes con Firebase. La app funciona sin internet; sincroniza cuando hay conexión.</p>
                <div className="flex items-center gap-3">
                  <Button variant="primary" loading={syncing} onClick={syncAhora}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                    Sincronizar ahora
                  </Button>
                  {syncRes && <span className={`text-[13px] ${syncRes.startsWith('Error') ? 'text-danger' : 'text-text-muted'}`}>{syncRes}</span>}
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* ── Reportes automáticos ── */}
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.16 }}>
          <Card>
            <CardHeader>Reportes automáticos por email</CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div className="p-3 bg-surface-2 rounded-[var(--r-in)] border border-border">
                <Toggle
                  label="Enviar reportes automáticamente"
                  hint="Recibí un resumen de ventas según la frecuencia configurada"
                  checked={repActivo}
                  onChange={e => { setRepActivo(e.target.checked); guardarRepConfig({ activo: e.target.checked ? '1' : '0' }); }}
                />
              </div>
              {repActivo && (
                <div className="flex flex-col gap-4 pt-1 border-t border-border">
                  <Field label="Email destino" hint="La dirección que recibirá el reporte">
                    <Input type="email" value={repDest} onChange={e => setRepDest(e.target.value)} onBlur={() => guardarRepConfig({ destino: repDest })} placeholder="ejemplo@gmail.com" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Frecuencia">
                      <Select value={repFreq} onChange={e => { setRepFreq(e.target.value); guardarRepConfig({ frecuencia: e.target.value }); }}>
                        <option value="diario">Diario</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensual">Mensual</option>
                      </Select>
                    </Field>
                    <Field label="Hora de envío">
                      <Input type="time" value={repHora} onChange={e => { setRepHora(e.target.value); guardarRepConfig({ hora: e.target.value }); }} />
                    </Field>
                  </div>
                  {repFreq === 'semanal' && (
                    <Field label="Día de la semana">
                      <Select style={{ maxWidth: 220 }} value={repDiaSem} onChange={e => { setRepDiaSem(e.target.value); guardarRepConfig({ diaSemana: e.target.value }); }}>
                        {[['1','Lunes'],['2','Martes'],['3','Miércoles'],['4','Jueves'],['5','Viernes'],['6','Sábado'],['0','Domingo']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    </Field>
                  )}
                  {repFreq === 'mensual' && (
                    <Field label="Día del mes" hint="Si el mes tiene menos días, se usa el último disponible">
                      <Select style={{ maxWidth: 220 }} value={repDiaMes} onChange={e => { setRepDiaMes(e.target.value); guardarRepConfig({ diaMes: e.target.value }); }}>
                        {Array.from({length:28},(_,i)=>i+1).map(d => <option key={d} value={d}>Día {d}</option>)}
                      </Select>
                    </Field>
                  )}
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" loading={repSending} onClick={enviarRepPrueba}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Enviar reporte de prueba
                    </Button>
                    {repRes && <span className="text-[12px] text-text-muted">{repRes}</span>}
                  </div>
                  {repUltimo && <span className="text-[12px] text-text-subtle">{repUltimo}</span>}
                </div>
              )}
            </CardBody>
          </Card>
          </motion.div>

          {/* ── Impresora ── */}
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.20 }}>
          <Card>
            <CardHeader>Impresora térmica</CardHeader>
            <CardBody className="flex flex-col gap-4">
              <p className="text-[12px] text-text-muted">Compatible con ESC/POS: Epson TM, Star, Bixolon y genéricas. Si no configurás ninguna, las ventas siguen funcionando.</p>
              <div className="flex items-end gap-2">
                <Field label="Impresora" className="flex-1">
                  <Select value={impresoraActual} onChange={async e => { setImpresoraActual(e.target.value); await window.api.config.set('impresora_nombre', e.target.value); setImprRes(e.target.value ? 'Guardada.' : 'Sin impresora.'); setTimeout(() => setImprRes(''), 3000); }}>
                    <option value="">— Sin impresora —</option>
                    {impresoras.map(n => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Field>
                <Button variant="ghost" onClick={cargarImpresoras} title="Recargar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={async () => {
                  if (!impresoraActual) { setImprRes('Seleccioná una impresora primero.'); return; }
                  setImprRes('Imprimiendo...');
                  const res = await window.api.printer.imprimirPrueba(impresoraActual);
                  setImprRes(res.ok ? 'Ticket de prueba enviado.' : 'Error: ' + res.error);
                  setTimeout(() => setImprRes(''), 5000);
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Imprimir ticket de prueba
                </Button>
                {imprRes && <span className="text-[12px] text-text-muted">{imprRes}</span>}
              </div>
            </CardBody>
          </Card>
          </motion.div>

          {/* ── Usuarios (solo admin) ── */}
          {esAdmin && (
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.24 }}>
            <Card>
              <CardHeader actions={<Button variant="primary" size="sm" onClick={abrirNuevoUsuario}>+ Nuevo usuario</Button>}>Usuarios del sistema</CardHeader>
              <CardBody className="p-0">
                {usuarios.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-none">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 ${u.rol === 'admin' ? 'bg-[#6366f1]' : 'bg-accent'}`}>
                      {u.nombre[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-text">{u.nombre} {session?.id === u.id && <span className="text-[10px] text-text-subtle">(vos)</span>}</div>
                      <div className="text-[11px] text-text-muted">@{u.usuario} · {u.rol === 'admin' ? 'Administrador' : 'Cajero'}</div>
                    </div>
                    <Badge variant={u.activo ? 'green' : 'gray'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => editarUsuario(u)}>Editar</Button>
                    {session?.id !== u.id && (
                      <Button size="sm" variant={u.activo ? 'danger' : 'ghost'} onClick={async () => { await window.api.usuarios.toggleActivo(u.id); cargarUsuarios(); }}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>
            </motion.div>
          )}

        </div>
      </main>

      {/* ── Wizard modo negocio ── */}
      <AnimatePresence>
        {wizardOpen && (
          <div className="fixed inset-0 z-[9999] bg-[rgba(15,23,42,.97)] flex items-center justify-center p-5">
            <motion.div initial={{ scale:0.95,opacity:0 }} animate={{ scale:1,opacity:1 }} exit={{ scale:0.95,opacity:0 }} className="max-w-[800px] w-full bg-[#1e293b] border border-[#334155] rounded-2xl p-8 flex flex-col gap-6">
              <div className="text-center">
                <div className="text-[22px] font-bold text-[#f1f5f9] mb-2">Elegí el modo de negocio</div>
                <div className="text-[13px] text-[#94a3b8] leading-relaxed">El modo configura cómo se comporta el IVA y el ticket.<br/>Podés cambiarlo en cualquier momento desde acá.</div>
              </div>
              <div className="grid grid-cols-3 gap-3.5">
                {WIZARD_MODOS.map(m => (
                  <button key={m.id} onClick={() => cambiarModo(m.id)} className={`bg-[#0f172a] border-2 rounded-[10px] p-5 text-left flex flex-col gap-2 transition-all hover:border-[#3b82f6] hover:bg-[rgba(59,130,246,.07)] ${m.id === modo ? 'border-[#3b82f6] bg-[rgba(59,130,246,.07)]' : 'border-[#334155]'}`}>
                    <div className="font-bold text-[14px] text-[#f1f5f9]">{m.nombre}</div>
                    <div className="text-[12px] text-[#94a3b8] leading-snug">{m.desc}</div>
                    {m.ejemplos && <div className="text-[11px] text-[#64748b]">{m.ejemplos}</div>}
                  </button>
                ))}
              </div>
              <div className="text-center">
                <Button variant="ghost" size="sm" onClick={() => setWizardOpen(false)}>Cancelar (mantener modo actual)</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal usuario ── */}
      <Modal
        open={usuarioModal}
        onClose={() => setUsuarioModal(false)}
        title={editUsuarioId ? 'Editar usuario' : 'Nuevo usuario'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setUsuarioModal(false)}>Cancelar</Button>
            <Button variant="primary" loading={uSaving} onClick={() => document.getElementById('form-usuario')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))}>Guardar</Button>
          </>
        }
      >
        <form id="form-usuario" onSubmit={guardarUsuarioForm} className="flex flex-col gap-4">
          <Field label="Nombre completo"><Input value={uNombre} onChange={e => setUNombre(e.target.value)} placeholder="Ej: María García" required /></Field>
          <Field label="Usuario (para login)"><Input value={uUsuario} onChange={e => setUUsuario(e.target.value)} placeholder="Ej: maria" required /></Field>
          <Field label="Email (para recuperar contraseña)"><Input type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} placeholder="nombre@ejemplo.com" /></Field>
          <Field label="Contraseña"><Input type="password" value={uPass} onChange={e => setUPass(e.target.value)} placeholder={editUsuarioId ? 'Dejar vacío para no cambiar' : '••••••••'} /></Field>
          <Field label="Rol">
            <Select value={uRol} onChange={e => setURol(e.target.value as 'cajero'|'admin')}>
              <option value="cajero">Cajero</option>
              <option value="admin">Administrador</option>
            </Select>
          </Field>
          {uError && <div className="px-3 py-2 rounded-[var(--r-in)] bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px]">{uError}</div>}
        </form>
      </Modal>
    </div>
  );
}

