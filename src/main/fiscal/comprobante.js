// Armado y emisión de comprobantes fiscales (Fase 3).
//
// Concentra la lógica fiscal: elige el tipo (A/B/C) según la condición del
// emisor y del receptor, calcula el desglose de IVA por alícuota, arma el
// payload de FECAESolicitar, resuelve la numeración (consulta el último JUSTO
// antes de emitir y reintenta ante error 10016) y devuelve el resultado con
// todo lo necesario para persistir e imprimir el QR.
//
// Tablas tomadas del manual de ARCA. Son estables, pero también se pueden
// consultar en vivo (FEParamGetTiposIva / FEParamGetCondicionIvaReceptor).

const wsaa = require('./wsaa');
const wsfe = require('./wsfev1');

const CBTE = { A: 1, B: 6, C: 11 };                 // Factura A / B / C
const DOC  = { CUIT: 80, CUIL: 86, DNI: 96, CF: 99 };

// tasa de IVA (%) → Id de alícuota de ARCA
const ALIC_IVA = { 0: 3, 2.5: 9, 5: 8, 10.5: 4, 21: 5, 27: 6 };

// Condición frente al IVA del receptor (RG 5616, obligatorio desde sep-2026)
const COND_IVA = {
  RI: 1, EXENTO: 4, CF: 5, MONOTRIBUTO: 6,
  NO_CATEG: 7, MT_SOCIAL: 13, MT_INDEP: 16,
};

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

function fechaHoy() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// Elige el tipo de comprobante.
//   Monotributo  → siempre Factura C
//   Resp. Inscripto → A a otro RI, B a todos los demás (CF, monotributo, exento)
function elegirTipo(condEmisor, condReceptorId) {
  if (condEmisor === 'monotributo') return CBTE.C;
  return condReceptorId === COND_IVA.RI ? CBTE.A : CBTE.B;
}

// Desglosa una lista de ítems (importe = precio FINAL con IVA incluido, por línea)
// en bases e IVA por alícuota. Devuelve { neto, iva, total, alicuotas:[{Id,BaseImp,Importe}] }.
function desglosarIVA(items) {
  const porTasa = new Map(); // tasa% → total con IVA incluido
  for (const it of items) {
    const tasa = Number(it.tasaIva || 0);
    if (!(tasa in ALIC_IVA)) throw new Error(`Tasa de IVA no soportada por ARCA: ${tasa}%`);
    porTasa.set(tasa, (porTasa.get(tasa) || 0) + Number(it.importe || 0));
  }
  let neto = 0, iva = 0;
  const alicuotas = [];
  for (const [tasa, totalConIva] of porTasa) {
    const t = round2(totalConIva);
    const importeIva = round2(t * tasa / (100 + tasa)); // IVA contenido en el precio final
    const base = round2(t - importeIva);                 // neto = total - iva (suma exacta)
    neto += base; iva += importeIva;
    alicuotas.push({ Id: ALIC_IVA[tasa], BaseImp: base, Importe: importeIva });
  }
  return { neto: round2(neto), iva: round2(iva), total: round2(neto + iva), alicuotas };
}

/**
 * Emite un comprobante contra ARCA y devuelve el CAE.
 * @param {object} o
 * @param {object} o.emisor    { cert, key, cuit, condicion:'monotributo'|'responsable_inscripto', ptoVenta, production }
 * @param {object} o.receptor  { condicionIVAId, docTipo?, docNro? }  (sin doc → consumidor final)
 * @param {Array}  o.items     [{ importe, tasaIva }]  importe = precio final (IVA incluido) por línea
 * @param {string} [o.cacheDir]
 * @returns {Promise<object>}  { tipo, ptoVta, nro, cae, caeVto, cbteFch, neto, iva, total, alicuotas, docTipo, docNro, condicionIVAId, cuitEmisor, production }
 */
async function emitir({ emisor, receptor, items, cacheDir } = {}) {
  if (!emisor || !emisor.cert || !emisor.key) throw new Error('Faltan certificado/clave del emisor');
  if (!emisor.cuit) throw new Error('Falta el CUIT del emisor');
  if (!items || !items.length) throw new Error('No hay ítems para facturar');

  const production = !!emisor.production;
  const ptoVta = parseInt(emisor.ptoVenta || 1, 10);
  const condReceptorId = receptor?.condicionIVAId || COND_IVA.CF;
  const cbteTipo = elegirTipo(emisor.condicion, condReceptorId);

  // Receptor: por defecto consumidor final sin identificar
  let docTipo = receptor?.docTipo ?? DOC.CF;
  let docNro  = receptor?.docNro ?? 0;

  // Factura A: el receptor DEBE ser RI e identificado con CUIT
  if (cbteTipo === CBTE.A) {
    if (docTipo !== DOC.CUIT || !docNro) throw new Error('Factura A: el receptor debe tener CUIT (DocTipo 80)');
    if (condReceptorId !== COND_IVA.RI)  throw new Error('Factura A: el receptor debe ser Responsable Inscripto');
  }

  // Importes: Factura C no discrimina IVA; A/B sí
  let neto, iva, total, alicuotas;
  if (cbteTipo === CBTE.C) {
    total = round2(items.reduce((s, it) => s + Number(it.importe || 0), 0));
    neto = total; iva = 0; alicuotas = [];
  } else {
    ({ neto, iva, total, alicuotas } = desglosarIVA(items));
  }

  const ta = await wsaa.obtenerTA({ cert: emisor.cert, key: emisor.key, cuit: emisor.cuit, production, service: 'wsfe', cacheDir });
  const cbteFch = fechaHoy();

  const det = {
    Concepto: 1, // 1 = productos
    DocTipo: docTipo, DocNro: docNro,
    CbteFch: cbteFch,
    ImpTotal: total, ImpTotConc: 0, ImpNeto: neto, ImpOpEx: 0, ImpTrib: 0, ImpIVA: iva,
    MonId: 'PES', MonCotiz: 1,
    CondicionIVAReceptorId: condReceptorId,
    Iva: alicuotas,
  };

  // Numeración: consultar el último JUSTO antes de emitir; ante 10016, reconsultar y reintentar.
  let ultErr;
  for (let intento = 0; intento < 2; intento++) {
    const ultimo = await wsfe.ultimoAutorizado({ ta, cuit: emisor.cuit, ptoVta, cbteTipo, production });
    const nro = ultimo + 1;
    try {
      const r = await wsfe.solicitarCAE({
        ta, cuit: emisor.cuit, production,
        cab: { PtoVta: ptoVta, CbteTipo: cbteTipo },
        det: { ...det, CbteDesde: nro, CbteHasta: nro },
      });
      return {
        tipo: cbteTipo, ptoVta, nro: r.nro || nro,
        cae: r.cae, caeVto: r.caeVto, cbteFch: r.cbteFch || cbteFch,
        neto, iva, total, alicuotas,
        docTipo, docNro, condicionIVAId: condReceptorId,
        cuitEmisor: String(emisor.cuit), production,
        observaciones: r.observaciones,
      };
    } catch (e) {
      ultErr = e;
      const esCorrelativo = e.afipErrors?.some(x => String(x.code) === '10016');
      if (esCorrelativo && intento === 0) continue; // otro proceso tomó el número: reintentar
      throw e;
    }
  }
  throw ultErr;
}

module.exports = { emitir, elegirTipo, desglosarIVA, CBTE, DOC, ALIC_IVA, COND_IVA };
