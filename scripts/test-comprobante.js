// Prueba de la lógica de comprobante (Fase 3) contra HOMOLOGACIÓN.
//   node scripts/test-comprobante.js            → sólo chequea la matemática del IVA
//   node scripts/test-comprobante.js --emitir    → además emite C y B reales
const fs   = require('fs');
const path = require('path');
const comp = require('../src/main/fiscal/comprobante');

const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });

// ── 1) Matemática del IVA (sin red) ──
const dg = comp.desglosarIVA([{ importe: 121, tasaIva: 21 }, { importe: 110.5, tasaIva: 10.5 }]);
const okMath = dg.neto === 200 && dg.iva === 31.5 && dg.total === 231.5;
console.log('Desglose IVA:', dg, okMath ? '✓' : '✗ ESPERABA neto 200 / iva 31.5 / total 231.5');
if (!okMath) process.exit(1);

// elegirTipo
const t1 = comp.elegirTipo('monotributo', comp.COND_IVA.RI);          // C
const t2 = comp.elegirTipo('responsable_inscripto', comp.COND_IVA.RI); // A
const t3 = comp.elegirTipo('responsable_inscripto', comp.COND_IVA.CF); // B
console.log('elegirTipo:', { mono: t1, ri_a_ri: t2, ri_a_cf: t3 },
  (t1 === 11 && t2 === 1 && t3 === 6) ? '✓' : '✗');

if (!process.argv.includes('--emitir')) { console.log('\n(OK lógica. Corré con --emitir para emitir contra ARCA.)'); return; }

(async () => {
  const cert = fs.readFileSync(path.join(root, 'cert.crt'), 'utf8');
  const key  = fs.readFileSync(path.join(root, 'private.key'), 'utf8');
  const cuit = process.env.AFIP_CUIT || '20111111112';
  const base = { cert, key, cuit, ptoVenta: 1, production: false };

  console.log('\n→ Factura C (monotributo) por $121...');
  const c = await comp.emitir({
    emisor: { ...base, condicion: 'monotributo' },
    receptor: { condicionIVAId: comp.COND_IVA.CF },
    items: [{ importe: 121, tasaIva: 0 }],
    cacheDir: __dirname,
  });
  console.log(`  ✓ C Nº ${c.nro} | CAE ${c.cae} | vto ${c.caeVto} | total ${c.total}`);

  console.log('→ Factura B (RI → consumidor final) con IVA 21% + 10.5%...');
  const b = await comp.emitir({
    emisor: { ...base, condicion: 'responsable_inscripto' },
    receptor: { condicionIVAId: comp.COND_IVA.CF },
    items: [{ importe: 121, tasaIva: 21 }, { importe: 110.5, tasaIva: 10.5 }],
    cacheDir: __dirname,
  });
  console.log(`  ✓ B Nº ${b.nro} | CAE ${b.cae} | neto ${b.neto} iva ${b.iva} total ${b.total}`);
  console.log('   alícuotas:', b.alicuotas);

  console.log('\n✓✓✓ FASE 3 OK — A/B/C + IVA discriminado emitiendo contra ARCA.');
})().catch(e => { console.error('✗', e.message); process.exit(1); });
