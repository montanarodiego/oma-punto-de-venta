import { useState, useEffect, useCallback } from 'react';
import { Button, Field, Input, Select, Badge, Toggle } from './ui';
import { useToast } from '../context/ToastContext';
import { useFiscal } from '../context/FiscalContext';
import type { FiscalEstado, FiscalConfig } from '../types/api';

const URL_CERTIFICADOS = 'https://www.afip.gob.ar/ws/documentacion/certificados.asp';
const URL_RELACIONES   = 'https://www.afip.gob.ar/ws/documentacion/wsaa.asp';

const COND_LABEL: Record<string,string> = { monotributo: 'Monotributo', responsable_inscripto: 'Responsable Inscripto' };

function fmtFecha(s: string) { return s ? new Date(s).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—'; }

export default function FiscalOnboarding() {
  const { showToast } = useToast();
  const { modoFiscal, setModoFiscal } = useFiscal();
  const [estado, setEstado] = useState<FiscalEstado | null>(null);
  const [form, setForm] = useState<FiscalConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(() => {
    window.api.fiscal.estado().then(r => { if (r.ok) { setEstado(r.data); setForm(r.data.config); } });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (!estado || !form) return <div className="text-text-subtle text-sm">Cargando…</div>;

  const set = (k: keyof FiscalConfig, v: string | number) => setForm(f => f ? { ...f, [k]: v } : f);
  const link = (url: string) => (e: React.MouseEvent) => { e.preventDefault(); window.api.abrirExterno(url); };

  const guardarConfig = async () => {
    const r = await window.api.fiscal.guardarConfig(form);
    if (r.ok) { showToast('Datos fiscales guardados', 'ok'); cargar(); }
    else showToast(r.error, 'error');
  };

  const generarCSR = async () => {
    if (!form.cuit || form.cuit.replace(/\D/g,'').length !== 11) { showToast('Cargá un CUIT válido (11 dígitos)', 'warning'); return; }
    if (!form.razonSocial) { showToast('Cargá la razón social', 'warning'); return; }
    setBusy(true);
    try {
      await window.api.fiscal.guardarConfig(form);
      const r = await window.api.fiscal.generarCSR({ cuit: form.cuit, razonSocial: form.razonSocial, alias: form.alias });
      if (r.ok) { showToast(r.data.guardadoEn ? 'CSR generado y guardado' : 'CSR generado', 'ok'); cargar(); }
      else showToast(r.error, 'error');
    } finally { setBusy(false); }
  };

  const importarCert = async () => {
    setBusy(true);
    try {
      const r = await window.api.fiscal.importarCert();
      if (r.ok) { showToast('Certificado importado correctamente', 'ok'); cargar(); }
      else if (!r.canceled) showToast(r.error || 'No se pudo importar', 'error');
    } finally { setBusy(false); }
  };

  const probar = async () => {
    setBusy(true);
    try {
      const r = await window.api.fiscal.probarConexion();
      if (r.ok) showToast(`Conexión OK con ARCA (${r.data.ambiente}) · servidores App/Db/Auth operativos`, 'ok');
      else showToast(`Falló: ${r.error}`, 'error');
    } finally { setBusy(false); }
  };

  const rehacer = async () => {
    const r = await window.api.fiscal.limpiarCert();
    if (r.ok) { showToast('Certificado eliminado. Podés volver a empezar.', 'warning'); cargar(); }
  };

  const paso = estado.estadoCert; // sin_solicitar | csr_pendiente | activo

  return (
    <div className="flex flex-col gap-4">
      {/* Estado actual */}
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-text-muted">Estado del certificado:</span>
        {paso === 'activo'        && <Badge variant="green">Activo</Badge>}
        {paso === 'csr_pendiente' && <Badge variant="yellow">Esperando certificado de ARCA</Badge>}
        {paso === 'sin_solicitar' && <Badge variant="gray">Sin configurar</Badge>}
        {paso === 'activo' && estado.config.ambiente === 'homologacion' && <Badge variant="yellow">Homologación (prueba)</Badge>}
        {paso === 'activo' && estado.config.ambiente === 'produccion'   && <Badge variant="blue">Producción</Badge>}
      </div>

      {/* Datos fiscales */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="CUIT del comercio">
          <Input value={form.cuit} onChange={e => set('cuit', e.target.value)} placeholder="20111111112" inputMode="numeric" />
        </Field>
        <Field label="Razón social">
          <Input value={form.razonSocial} onChange={e => set('razonSocial', e.target.value)} placeholder="Mi Comercio S.R.L." />
        </Field>
        <Field label="Condición frente al IVA">
          <Select value={form.condicionFiscal} onChange={e => set('condicionFiscal', e.target.value)}>
            <option value="monotributo">Monotributo (Factura C)</option>
            <option value="responsable_inscripto">Responsable Inscripto (Factura A/B)</option>
          </Select>
        </Field>
        <Field label="Punto de venta">
          <Input type="number" min={1} value={form.ptoVenta} onChange={e => set('ptoVenta', parseInt(e.target.value || '1', 10))} />
        </Field>
        <Field label="Ambiente" hint="Probá siempre en Homologación antes de pasar a Producción.">
          <Select value={form.ambiente} onChange={e => set('ambiente', e.target.value)}>
            <option value="homologacion">Homologación (prueba)</option>
            <option value="produccion">Producción (facturas reales)</option>
          </Select>
        </Field>
      </div>
      <div>
        <Button variant="ghost" size="sm" onClick={guardarConfig}>Guardar datos</Button>
      </div>

      {/* Paso 1: generar CSR */}
      {paso === 'sin_solicitar' && (
        <div className="p-3 rounded-[var(--r-in)] border border-border bg-surface-2 flex flex-col gap-2">
          <div className="text-[13px] font-semibold">Paso 1 — Generar la solicitud de certificado</div>
          <p className="text-[12px] text-text-muted">
            La app crea la clave privada (que nunca sale de esta PC) y un archivo <b>.csr</b> que vas a subir a ARCA.
          </p>
          <div><Button variant="primary" size="sm" loading={busy} onClick={generarCSR}>Generar solicitud (.csr)</Button></div>
        </div>
      )}

      {/* Paso 2: subir a ARCA + importar */}
      {paso === 'csr_pendiente' && (
        <div className="p-3 rounded-[var(--r-in)] border border-border bg-surface-2 flex flex-col gap-2">
          <div className="text-[13px] font-semibold">Paso 2 — Obtener el certificado en ARCA</div>
          <ol className="text-[12px] text-text-muted list-decimal pl-5 flex flex-col gap-1">
            <li>Entrá con tu clave fiscal a <a href="#" onClick={link(URL_CERTIFICADOS)} className="text-accent underline">Administración de Certificados Digitales</a>.</li>
            <li>Creá un alias y subí el archivo <b>.csr</b> que se guardó recién. Descargá el <b>.crt</b> que te devuelve ARCA.</li>
            <li>En <a href="#" onClick={link(URL_RELACIONES)} className="text-accent underline">Administrador de Relaciones</a>, asociá ese certificado al servicio <b>“Facturación Electrónica” (wsfe)</b>.</li>
            <li>Volvé acá e importá el <b>.crt</b>.</li>
          </ol>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" loading={busy} onClick={importarCert}>Importar certificado (.crt)</Button>
            <Button variant="ghost" size="sm" onClick={rehacer}>Volver a generar</Button>
          </div>
        </div>
      )}

      {/* Paso 3: activo */}
      {paso === 'activo' && (
        <div className="p-3 rounded-[var(--r-in)] border border-success/40 bg-[rgba(34,197,94,.06)] flex flex-col gap-2">
          <div className="text-[13px] font-semibold text-[#4ade80]">Certificado activo</div>
          {estado.cert && (
            <div className="text-[12px] text-text-muted grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span>Titular: <span className="text-text">{estado.cert.subject || '—'}</span></span>
              <span>Emisor: <span className="text-text">{estado.cert.emisor || 'ARCA'}</span></span>
              <span>Vence: <span className="text-text">{fmtFecha(estado.cert.vencimiento)}</span></span>
              <span>CUIT: <span className="text-text">{estado.config.cuit}</span></span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="success" size="sm" loading={busy} onClick={probar}>Probar conexión con ARCA</Button>
            <Button variant="ghost" size="sm" onClick={rehacer}>Reemplazar certificado</Button>
          </div>
        </div>
      )}

      {/* Modo fiscal */}
      <div className="p-3 rounded-[var(--r-in)] border border-border bg-surface-2">
        <Toggle
          label="Modo fiscal"
          hint={paso === 'activo'
            ? `Con el modo fiscal activo, cada venta emite una factura (${COND_LABEL[estado.config.condicionFiscal]}) vía ARCA. Atajo: Ctrl+Shift+F.`
            : 'Configurá y activá el certificado antes de usar el modo fiscal.'}
          checked={modoFiscal}
          onChange={e => setModoFiscal(e.target.checked)}
          disabled={paso !== 'activo'}
        />
      </div>
    </div>
  );
}
