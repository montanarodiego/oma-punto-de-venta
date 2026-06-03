'use strict';
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const execFileAsync = promisify(execFile);

// ── ESC/POS ──────────────────────────────────────────────────────
const ESC  = 0x1B;
const GS   = 0x1D;
const COLS = 48; // 80 mm, fuente A estándar

// Mapa Unicode → PC850 para caracteres españoles
const PC850 = {
  'á':0xA0,'é':0x82,'í':0xA1,'ó':0xA2,'ú':0xA3,
  'ñ':0xA4,'Ñ':0xA5,'ü':0x81,'ö':0x94,'ä':0x84,
  'Á':0xB5,'É':0x90,'Í':0xD6,'Ó':0xE0,'Ú':0xE9,
  '¡':0xAD,'¿':0xA8,'°':0xF8,
  '—':0x2D,'–':0x2D,
  '“':0x22,'”':0x22,
  '‘':0x27,'’':0x27,
};

function enc(str) {
  const out = [];
  for (const ch of String(str)) {
    const b = PC850[ch];
    if (b !== undefined)        out.push(b);
    else if (ch.charCodeAt(0) < 128) out.push(ch.charCodeAt(0));
    else                         out.push(0x3F);
  }
  return Buffer.from(out);
}

function rpad(s, w) { return String(s).slice(0, w).padEnd(w); }
function lpad(s, w) { return String(s).slice(-w).padStart(w); }

// ── Build ticket ESC/POS ─────────────────────────────────────────
function buildTicketBuffer(trans, cfg) {
  const parts = [];
  const cmd = (...b) => parts.push(Buffer.from(b));
  const txt = s => parts.push(enc(s));
  const sep = () => txt('-'.repeat(COLS) + '\n');

  const mon = cfg.moneda || '$';
  const fmt = n => mon + parseFloat(n || 0).toFixed(2);
  const der = (label, valor) => {
    const l = String(label), v = String(valor);
    return l + ' '.repeat(Math.max(1, COLS - l.length - v.length)) + v + '\n';
  };

  // Init + code page 850
  cmd(ESC, 0x40);
  cmd(ESC, 0x74, 0x02);

  // Header centrado
  cmd(ESC, 0x61, 0x01);
  cmd(ESC, 0x21, 0x30);
  txt((cfg.nombreNegocio || 'MI NEGOCIO').toUpperCase() + '\n');
  cmd(ESC, 0x21, 0x00);
  if (cfg.direccion) txt(cfg.direccion + '\n');
  if (cfg.telefono)  txt('Tel: ' + cfg.telefono + '\n');
  if (cfg.cuit)      txt('CUIT: ' + cfg.cuit + '\n');
  cmd(ESC, 0x61, 0x00);

  // Cabecera del ticket
  txt('\n');
  sep();
  const fecha = new Date().toLocaleString('es-AR', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
  });
  txt('Ticket #' + trans.id + '\n');
  txt(fecha + '\n');
  sep();

  // Columnas: DESC(26) CANT(6) PRECIO(8) TOTAL(8) = 48
  const CD=26, CQ=6, CP=8, CT=8;
  const fila = (d, q, p, t) => rpad(d,CD) + lpad(q,CQ) + lpad(p,CP) + lpad(t,CT) + '\n';

  cmd(ESC, 0x45, 0x01);
  txt(fila('DESCRIPCION', 'CANT', 'PRECIO', 'TOTAL'));
  cmd(ESC, 0x45, 0x00);
  sep();

  for (const it of trans.detalle || []) {
    const desc = String(it.nombre || it.descripcion_libre || '(sin nombre)');
    const cant = parseFloat(it.cantidad || 1);
    const prec = parseFloat(it.precio_al_momento || 0);
    const dPct = parseFloat(it.descuento_porcentaje || 0);
    const sub  = prec * cant * (1 - dPct / 100);
    const cStr = cant % 1 === 0 ? String(cant) : cant.toFixed(3).replace(/\.?0+$/, '');

    if (desc.length > CD) {
      txt(desc.slice(0, COLS) + '\n');
      txt(fila('', cStr, fmt(prec), fmt(sub)));
    } else {
      txt(fila(desc, cStr, fmt(prec), fmt(sub)));
    }
    if (dPct > 0) txt(' '.repeat(CD) + '  Desc. ' + dPct + '%\n');
  }

  sep();

  // Totales
  const total   = parseFloat(trans.monto_total     || 0);
  const subtot  = parseFloat(trans.subtotal         || 0);
  const imp     = parseFloat(trans.monto_impuesto   || 0);
  const descG   = parseFloat(trans.descuento_global || 0);
  const propina = parseFloat(trans.propina          || 0);

  if (imp > 0) {
    txt(der('Subtotal:', fmt(subtot)));
    txt(der('IVA:', fmt(imp)));
  }
  if (descG > 0) txt(der('Descuento global:', '-' + fmt(descG)));
  if (propina > 0) txt(der('Propina:', fmt(propina)));

  cmd(ESC, 0x45, 0x01);
  cmd(ESC, 0x21, 0x10);
  txt(der('TOTAL:', fmt(total)));
  cmd(ESC, 0x21, 0x00);
  cmd(ESC, 0x45, 0x00);

  sep();

  // Forma de pago
  const FP = {
    efectivo:'Efectivo', tarjeta:'Tarjeta', debito:'Debito',
    transferencia:'Transferencia', cuenta_corriente:'Cta. Cte.',
    qr:'QR/MercadoPago', otro:'Otro',
  };
  txt('Forma de pago: ' + (FP[trans.forma_pago] || trans.forma_pago || '—') + '\n');
  if (trans.forma_pago_2) {
    const fp2 = FP[trans.forma_pago_2] || trans.forma_pago_2;
    txt('Pago 2: ' + fp2 + (trans.monto_pago_2 ? '  ' + fmt(trans.monto_pago_2) : '') + '\n');
  }
  if (trans._montoRecibido != null && trans.forma_pago === 'efectivo') {
    txt(der('Recibido:', fmt(trans._montoRecibido)));
    txt(der('Vuelto:', fmt(trans._vuelto || 0)));
  }

  if (cfg.mensajeTicket) {
    txt('\n');
    cmd(ESC, 0x61, 0x01);
    txt(cfg.mensajeTicket + '\n');
    cmd(ESC, 0x61, 0x00);
  }

  parts.push(Buffer.from([0x0A, 0x0A, 0x0A]));

  // Cajón de dinero: ESC p 0 25 250
  cmd(ESC, 0x70, 0x00, 0x19, 0xFA);

  // Corte parcial
  cmd(GS, 0x56, 0x42, 0x00);

  return Buffer.concat(parts);
}

// ── Ticket de prueba ─────────────────────────────────────────────
function buildPruebaBuffer(cfg) {
  const parts = [];
  const cmd = (...b) => parts.push(Buffer.from(b));
  const txt = s => parts.push(enc(s));

  cmd(ESC, 0x40);
  cmd(ESC, 0x74, 0x02);
  cmd(ESC, 0x61, 0x01);
  cmd(ESC, 0x21, 0x30);
  txt((cfg.nombreNegocio || 'OmaTech POS').toUpperCase() + '\n');
  cmd(ESC, 0x21, 0x00);
  txt('--- TICKET DE PRUEBA ---\n\n');
  cmd(ESC, 0x61, 0x00);
  txt('-'.repeat(COLS) + '\n');
  txt('Impresora configurada correctamente\n');
  txt('Caracteres: a e i o u N\n');
  txt('Acentos:    a e i o u n\n');
  txt('-'.repeat(COLS) + '\n');
  cmd(ESC, 0x45, 0x01);
  txt('TOTAL:' + ' '.repeat(COLS - 16) + '$ 99.999,99\n');
  cmd(ESC, 0x45, 0x00);
  txt('-'.repeat(COLS) + '\n');
  cmd(ESC, 0x61, 0x01);
  txt('OmaTech POS\n');
  cmd(ESC, 0x61, 0x00);
  parts.push(Buffer.from([0x0A, 0x0A, 0x0A]));
  cmd(GS, 0x56, 0x42, 0x00);
  return Buffer.concat(parts);
}

// ── Listar impresoras (Windows WMIC) ─────────────────────────────
async function listarImpresoras() {
  const { stdout } = await execFileAsync(
    'wmic', ['printer', 'get', 'name', '/format:value'],
    { timeout: 8000 }
  );
  return stdout
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.startsWith('Name='))
    .map(l => l.slice(5).trim())
    .filter(Boolean);
}

// ── Envío RAW via PowerShell P/Invoke (sin dependencias nativas) ──
const PS_SCRIPT = `param([string]$DataFile)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public struct DOCINFOA {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }
    [DllImport("winspool.Drv",EntryPoint="OpenPrinterA",SetLastError=true)]
    public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr d);
    [DllImport("winspool.Drv",EntryPoint="ClosePrinter")]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.Drv",EntryPoint="StartDocPrinterA",SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr h,int lv,ref DOCINFOA di);
    [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.Drv",EntryPoint="WritePrinter",SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h,IntPtr p,int c,out int w);
    public static bool Send(string name,byte[] data){
        IntPtr hp;
        if(!OpenPrinter(name,out hp,IntPtr.Zero))return false;
        try{
            DOCINFOA di=new DOCINFOA();
            di.pDocName="Ticket";
            di.pDataType="RAW";
            if(StartDocPrinter(hp,1,ref di)<=0)return false;
            try{
                if(!StartPagePrinter(hp))return false;
                try{
                    IntPtr ptr=Marshal.AllocCoTaskMem(data.Length);
                    Marshal.Copy(data,0,ptr,data.Length);
                    int w; bool ok=WritePrinter(hp,ptr,data.Length,out w);
                    Marshal.FreeCoTaskMem(ptr);
                    return ok;
                }finally{EndPagePrinter(hp);}
            }finally{EndDocPrinter(hp);}
        }finally{ClosePrinter(hp);}
    }
}
'@
$printerName = PRINTER_PLACEHOLDER
$bytes = [System.IO.File]::ReadAllBytes($DataFile)
$ok = [RawPrint]::Send($printerName,$bytes)
if($ok){Write-Output "OK"}else{
    $code=[System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $msg=(New-Object System.ComponentModel.Win32Exception $code).Message
    Write-Error "FAIL: $msg";exit 1
}`;

async function enviarRaw(nombreImpresora, buffer) {
  const stamp   = Date.now();
  const binPath = path.join(os.tmpdir(), `oma-t-${stamp}.bin`);
  const ps1Path = path.join(os.tmpdir(), `oma-p-${stamp}.ps1`);

  const escaped = nombreImpresora.replace(/'/g, "''");
  const script  = PS_SCRIPT.replace('PRINTER_PLACEHOLDER', `'${escaped}'`);

  try {
    fs.writeFileSync(binPath, buffer);
    fs.writeFileSync(ps1Path, script, 'utf8');

    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      ['-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
       '-File', ps1Path, '-DataFile', binPath],
      { timeout: 15000 }
    );

    const out = (stdout || '').trim();
    const err = (stderr || '').trim();
    if (!out.includes('OK')) throw new Error(err || 'La impresora no respondió correctamente');
    return { ok: true };

  } finally {
    try { fs.unlinkSync(binPath); } catch {}
    try { fs.unlinkSync(ps1Path); } catch {}
  }
}

// ── Corte Z (cierre de turno) ────────────────────────────────────
function buildCorteZBuffer(resumen, cfg) {
  const parts = [];
  const cmd = (...b) => parts.push(Buffer.from(b));
  const txt = s  => parts.push(enc(s));
  const sep = () => txt('='.repeat(COLS) + '\n');
  const lin = () => txt('-'.repeat(COLS) + '\n');

  const mon = cfg.moneda || '$';
  const fmt = n => {
    const num = parseFloat(n || 0);
    const abs = Math.abs(num).toFixed(2);
    const [ent, dec] = abs.split('.');
    const entF = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (num < 0 ? '-' : '') + mon + entF + ',' + dec;
  };
  const der = (label, valor) => {
    const l = String(label), v = String(valor);
    return l + ' '.repeat(Math.max(1, COLS - l.length - v.length)) + v + '\n';
  };
  const fmtFecha = iso => {
    if (!iso) return '—';
    const d = new Date(iso.replace(' ', 'T'));
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // Init + code page 850
  cmd(ESC, 0x40);
  cmd(ESC, 0x74, 0x02);

  // Header centrado
  cmd(ESC, 0x61, 0x01);
  cmd(ESC, 0x21, 0x30);
  txt((cfg.nombreNegocio || 'MI NEGOCIO').toUpperCase() + '\n');
  cmd(ESC, 0x21, 0x00);
  if (cfg.direccion) txt(cfg.direccion + '\n');
  if (cfg.telefono)  txt('Tel: ' + cfg.telefono + '\n');
  if (cfg.cuit)      txt('CUIT: ' + cfg.cuit + '\n');
  cmd(ESC, 0x61, 0x00);

  txt('\n');
  sep();
  cmd(ESC, 0x61, 0x01);
  cmd(ESC, 0x45, 0x01);
  txt('CORTE Z - CIERRE DE TURNO\n');
  cmd(ESC, 0x45, 0x00);
  cmd(ESC, 0x61, 0x00);
  sep();

  txt(der('Turno N:', resumen.id));
  txt(der('Apertura:', fmtFecha(resumen.fecha_apertura)));
  txt(der('Cierre:',   fmtFecha(resumen.fecha_cierre)));
  lin();

  // Ventas por medio de pago
  cmd(ESC, 0x45, 0x01);
  txt('VENTAS DEL TURNO\n');
  cmd(ESC, 0x45, 0x00);
  lin();

  txt(der('Total ventas:', fmt(resumen.total_ventas)));
  const medios = [
    [resumen.ventas_efectivo,          'Efectivo'],
    [resumen.ventas_debito,            'Tarjeta debito'],
    [resumen.ventas_credito,           'Tarjeta credito'],
    [resumen.ventas_transferencia,     'Transferencia'],
    [resumen.ventas_cuenta_corriente,  'Cuenta corriente'],
  ];
  for (const [v, label] of medios) {
    if (parseFloat(v || 0) > 0) txt(der('  ' + label + ':', fmt(v)));
  }
  if (parseFloat(resumen.total_descuentos || 0) > 0)
    txt(der('Descuentos otorgados:', '-' + fmt(resumen.total_descuentos)));
  if (parseFloat(resumen.total_propinas || 0) > 0)
    txt(der('Propinas:', fmt(resumen.total_propinas)));
  txt(der('Cantidad de ventas:', resumen.total_transacciones || 0));
  lin();

  // Efectivo
  cmd(ESC, 0x45, 0x01);
  txt('CAJA - EFECTIVO\n');
  cmd(ESC, 0x45, 0x00);
  lin();

  txt(der('Efectivo inicial:', fmt(resumen.efectivo_inicial)));
  if (parseFloat(resumen.total_entradas || 0) > 0)
    txt(der('Entradas:', '+' + fmt(resumen.total_entradas)));
  if (parseFloat(resumen.total_salidas || 0) > 0)
    txt(der('Salidas:', '-' + fmt(resumen.total_salidas)));
  txt(der('Esperado en caja:', fmt(resumen.efectivo_esperado)));

  cmd(ESC, 0x45, 0x01);
  txt(der('Real (contado):', fmt(resumen.efectivo_real)));
  cmd(ESC, 0x45, 0x00);

  const dif = parseFloat(resumen.diferencia ?? 0);
  const difStr = (dif > 0 ? '+' : '') + fmt(dif);
  cmd(ESC, 0x45, 0x01);
  txt(der('Diferencia:', difStr));
  cmd(ESC, 0x45, 0x00);

  if (Math.abs(dif) > 0.005) {
    txt('\n');
    cmd(ESC, 0x61, 0x01);
    txt(dif < 0 ? '*** FALTANTE ***\n' : '*** SOBRANTE ***\n');
    cmd(ESC, 0x61, 0x00);
  }

  if (resumen.notas) {
    lin();
    txt('Notas: ' + resumen.notas + '\n');
  }

  sep();
  cmd(ESC, 0x61, 0x01);
  txt('OmaTech POS\n');
  cmd(ESC, 0x61, 0x00);
  parts.push(Buffer.from([0x0A, 0x0A, 0x0A]));
  cmd(GS, 0x56, 0x42, 0x00);

  return Buffer.concat(parts);
}

module.exports = { listarImpresoras, buildTicketBuffer, buildPruebaBuffer, buildCorteZBuffer, enviarRaw };
