// Prueba standalone de WSAA contra HOMOLOGACIÓN de ARCA.
// Usa el cert.crt / private.key de la raíz (cert de homologación del socio).
// Corre con:  node scripts/test-wsaa.js
const fs   = require('fs');
const path = require('path');
const { obtenerTA } = require('../src/main/fiscal/wsaa');
const wsfe = require('../src/main/fiscal/wsfev1');

(async () => {
  const root = path.join(__dirname, '..');
  const cert = fs.readFileSync(path.join(root, 'cert.crt'), 'utf8');
  const key  = fs.readFileSync(path.join(root, 'private.key'), 'utf8');
  // CUIT de homologación desde .env si está; sólo se usa como clave de cache.
  require('dotenv').config({ path: path.join(root, '.env') });
  const cuit = process.env.AFIP_CUIT || '20111111112';

  console.log(`→ Pidiendo TA a WSAA homologación (CUIT ${cuit}, service wsfe)...`);
  try {
    const ta = await obtenerTA({ cert, key, cuit, production: false, service: 'wsfe', cacheDir: __dirname });
    console.log('✓ TA obtenido de ARCA:');
    console.log('  token (primeros 60):', ta.token.slice(0, 60) + '...');
    console.log('  sign  (primeros 60):', ta.sign.slice(0, 60) + '...');
    console.log('  vence:', new Date(ta.expiration).toLocaleString('es-AR'));
    console.log('\n✓✓ WSAA OK (sin afipsdk).');

    // ── Fase 2: WSFEv1 ──
    console.log('\n→ FEDummy (estado de servidores)...');
    const est = await wsfe.dummy(false);
    console.log('  ', est);

    console.log('→ FECompUltimoAutorizado (PtoVta 1, Factura C=11)...');
    const ult = await wsfe.ultimoAutorizado({ ta, cuit, ptoVta: 1, cbteTipo: 11, production: false });
    console.log('   último comprobante autorizado:', ult);
    console.log('\n✓✓ WSFEv1 OK — conexión directa completa (WSAA + WSFE).');

    // ── Emisión real de Factura C (sólo con --emitir) ──
    if (process.argv.includes('--emitir')) {
      const proximo = ult + 1;
      const hoy = new Date();
      const p = n => String(n).padStart(2, '0');
      const fch = `${hoy.getFullYear()}${p(hoy.getMonth() + 1)}${p(hoy.getDate())}`;
      console.log(`\n→ Emitiendo Factura C Nº ${proximo} por $121 (consumidor final)...`);
      const r = await wsfe.solicitarCAE({
        ta, cuit, production: false,
        cab: { PtoVta: 1, CbteTipo: 11 },
        det: {
          Concepto: 1, DocTipo: 99, DocNro: 0,
          CbteDesde: proximo, CbteHasta: proximo, CbteFch: fch,
          ImpTotal: 121, ImpTotConc: 0, ImpNeto: 121, ImpOpEx: 0, ImpTrib: 0, ImpIVA: 0,
          MonId: 'PES', MonCotiz: 1, CondicionIVAReceptorId: 5, Iva: [],
        },
      });
      console.log('✓ FACTURA C EMITIDA por ARCA:');
      console.log('   Nº:', r.nro, '| CAE:', r.cae, '| vto CAE:', r.caeVto);
      if (r.observaciones.length) console.log('   obs:', r.observaciones);
      console.log('\n✓✓✓ EMISIÓN DIRECTA CONTRA ARCA OK — devolvió CAE válido.');
    }
  } catch (err) {
    console.error('✗ Falló:', err.message);
    process.exit(1);
  }
})();
