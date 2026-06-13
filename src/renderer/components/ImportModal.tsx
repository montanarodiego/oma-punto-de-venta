import { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../context/ToastContext';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type ImportOutcome = 'created' | 'updated' | 'skipped';

export interface ImportConfig {
  entityName: string;
  templateHeaders: string[];
  requiredFields?: string[];
  templateExample: (string | number)[];
  templateFilename: string;
  previewColumns: { key: string; label: string }[];
  validateRow: (raw: Record<string, string>, index: number) => { data: unknown; errors: string[] };
  importRow: (data: unknown) => Promise<ImportOutcome>;
}

// ── Normalización ──────────────────────────────────────────────────────────────

/** Lowercase + quitar acentos (unicode escape explícito para evitar problemas de encoding). */
function normalizeKey(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** normalizeKey + quita puntos y espacios (para matching de abreviaturas como "P. Venta"). */
function fuzzyNorm(s: string): string {
  return normalizeKey(s).replace(/[\s.]/g, '');
}

// ── Aliases exactos ────────────────────────────────────────────────────────────

const ALIAS_MAP: Record<string, string[]> = {
  nombre:          ['nombre', 'descripcion', 'descripción', 'producto', 'articulo', 'artículo',
                    'detalle', 'item', 'mercaderia', 'mercadería', 'denominacion', 'denominación',
                    'cliente', 'razon social', 'razón social', 'apellido y nombre', 'apellido',
                    'empresa', 'comercio', 'fabricante', 'distribuidor', 'laboratorio'],
  precio_unitario: ['precio', 'precio_unitario', 'precio venta', 'precio de venta', 'pventa',
                    'p.venta', 'p. venta', 'venta', 'precio_venta', 'importe', 'valor',
                    'precio final', 'precio minorista', 'minorista'],
  costo_unitario:  ['costo', 'costo_unitario', 'precio costo', 'pcosto', 'p.costo', 'p. costo',
                    'precio_costo', 'costo unitario'],
  codigo:          ['codigo', 'código', 'cod', 'cod.', 'sku', 'id',
                    'codigo de barras', 'código de barras', 'barcode', 'ean',
                    'referencia', 'ref', 'ref.'],
  stock_actual:    ['stock', 'stock_actual', 'cantidad', 'existencia', 'existencias',
                    'inventario', 'cant', 'qty'],
  stock_minimo:    ['stock_minimo', 'stock mínimo', 'stock minimo', 'minimo', 'mínimo',
                    'stock min', 'min'],
  departamento:    ['departamento', 'categoria', 'categoría', 'rubro', 'seccion', 'sección',
                    'familia', 'grupo', 'tipo', 'area', 'área'],
  proveedor:       ['proveedor', 'marca', 'fabricante', 'distribuidor', 'origen', 'laboratorio'],
  descripcion:     ['descripcion', 'descripción', 'detalle', 'observacion', 'observación',
                    'notas', 'nota', 'comentario'],
  notas:           ['notas', 'nota', 'observacion', 'observación', 'comentarios', 'comentario'],
  telefono:        ['telefono', 'teléfono', 'tel', 'cel', 'celular', 'movil', 'móvil',
                    'whatsapp', 'phone'],
  email:           ['email', 'mail', 'correo', 'e-mail'],
  direccion:       ['direccion', 'dirección', 'domicilio', 'dir'],
  limite_credito:  ['limite', 'límite', 'credito', 'crédito', 'limite_credito',
                    'limite de credito', 'saldo'],
  contacto:        ['contacto', 'nombre contacto', 'responsable', 'representante'],
};

// ── Fuzzy keywords (orden importa: campos más específicos primero) ─────────────

/**
 * Orden y keywords para fuzzy matching por contenido.
 * Se chequea si fuzzyNorm(columna).includes(fuzzyNorm(keyword)).
 * Los campos más específicos van primero para evitar falsos positivos.
 */
const FUZZY_KEYWORDS: [string, string[]][] = [
  ['costo_unitario',  ['costo', 'pcosto', 'compra']],
  ['stock_minimo',    ['stockmin', 'stockminimo', 'stomin', 'minstock', 'stockmn']],
  ['precio_unitario', ['precio', 'pventa', 'pcio', 'venta']],
  ['stock_actual',    ['stock', 'existencia', 'inventario', 'cantidad']],
  ['codigo',          ['codigo', 'sku', 'barcode', 'ean', 'referencia']],
  ['nombre',          ['nombre', 'producto', 'prod', 'articulo', 'art', 'descripcion',
                       'detalle', 'item', 'denom']],
  ['departamento',    ['depto', 'departamento', 'categoria', 'categ', 'rubro', 'familia', 'seccion']],
  ['proveedor',       ['proveedor', 'proveed', 'marca', 'fabricante', 'laboratorio']],
  ['telefono',        ['telefono', 'celular', 'movil', 'whatsapp']],
  ['email',           ['email', 'correo']],
  ['direccion',       ['direccion', 'domicilio']],
];

const FIELD_LABELS: Record<string, string> = {
  nombre:          'Nombre',
  precio_unitario: 'Precio de venta',
  costo_unitario:  'Costo unitario',
  codigo:          'Código',
  stock_actual:    'Stock',
  stock_minimo:    'Stock mínimo',
  departamento:    'Departamento / Rubro',
  proveedor:       'Proveedor / Marca',
  descripcion:     'Descripción',
  notas:           'Notas',
  telefono:        'Teléfono',
  email:           'Email',
  direccion:       'Dirección',
  limite_credito:  'Límite de crédito',
  contacto:        'Contacto',
};

// ── Lookup de aliases ──────────────────────────────────────────────────────────

/**
 * Construye un mapa normalizado alias→canónico para los campos del config.
 * Registra tanto la forma normalizada como la forma "stripped" (sin espacios/puntos)
 * de cada alias, para capturar variantes como "P. Venta" → "pventa".
 * Los nombres canónicos exactos tienen prioridad absoluta sobre aliases.
 */
function buildLookup(knownFields: string[]): Map<string, string> {
  const lookup = new Map<string, string>();

  const register = (alias: string, canonical: string) => {
    const norm = normalizeKey(alias);
    if (!lookup.has(norm)) lookup.set(norm, canonical);
    const strip = norm.replace(/[\s.]/g, '');
    if (strip !== norm && !lookup.has(strip)) lookup.set(strip, canonical);
  };

  // Paso 1: nombres canónicos exactos (máxima prioridad)
  for (const canonical of knownFields) register(canonical, canonical);
  // Paso 2: aliases
  for (const canonical of knownFields) {
    for (const alias of ALIAS_MAP[canonical] ?? []) register(alias, canonical);
  }

  return lookup;
}

// ── ColMapping ─────────────────────────────────────────────────────────────────

interface ColMapping {
  from:   string;
  to:     string;
  method: 'exact' | 'alias' | 'fuzzy' | 'manual';
}

// ── remapColumns ───────────────────────────────────────────────────────────────

/**
 * Aplica el lookup a cada columna del archivo.
 * Intenta primero con normalizeKey(col), luego con la versión stripped (sin espacios/puntos).
 * Detecta si el match fue exacto o vía alias.
 */
function remapColumns(
  raw: Record<string, unknown>,
  lookup: Map<string, string>,
): { remapped: Record<string, string>; matched: ColMapping[] } {
  const remapped: Record<string, string> = {};
  const matched: ColMapping[]            = [];

  for (const [key, value] of Object.entries(raw)) {
    const norm  = normalizeKey(key);
    const strip = norm.replace(/[\s.]/g, '');

    let canonical = lookup.get(norm);
    let usedStrip = false;
    if (!canonical && strip !== norm) {
      canonical = lookup.get(strip);
      usedStrip = !!canonical;
    }

    if (canonical) {
      remapped[canonical] = String(value ?? '').trim();
      const method: ColMapping['method'] =
        !usedStrip && normalizeKey(canonical) === norm ? 'exact' : 'alias';
      matched.push({ from: key, to: canonical, method });
    }
  }

  return { remapped, matched };
}

// ── applyFuzzyMatching ────────────────────────────────────────────────────────

/**
 * Segunda pasada: intenta mapear columnas aún sin mapear usando coincidencia
 * por contenido de keywords. El orden de FUZZY_KEYWORDS evita falsos positivos
 * (campos más específicos se verifican antes).
 */
function applyFuzzyMatching(
  fileRow:        Record<string, unknown>,
  knownFields:    string[],
  alreadyMatched: ColMapping[],
): ColMapping[] {
  const knownSet       = new Set(knownFields);
  const usedCanonicals = new Set(alreadyMatched.map(m => m.to));
  const usedColNorms   = new Set(alreadyMatched.map(m => normalizeKey(m.from)));
  const usedColStrips  = new Set(alreadyMatched.map(m => fuzzyNorm(m.from)));
  const additional: ColMapping[] = [];

  for (const col of Object.keys(fileRow)) {
    const colNorm  = normalizeKey(col);
    const colStrip = fuzzyNorm(col);

    if (usedColNorms.has(colNorm) || usedColStrips.has(colStrip)) continue;

    for (const [canonical, keywords] of FUZZY_KEYWORDS) {
      if (!knownSet.has(canonical) || usedCanonicals.has(canonical)) continue;

      const hit = keywords.some(kw => colStrip.includes(fuzzyNorm(kw)));
      if (hit) {
        usedCanonicals.add(canonical);
        usedColNorms.add(colNorm);
        usedColStrips.add(colStrip);
        additional.push({ from: col, to: canonical, method: 'fuzzy' });
        break;
      }
    }
  }

  return additional;
}

// ── Limpieza numérica ──────────────────────────────────────────────────────────

const NUMERIC_FIELDS = new Set([
  'precio_unitario', 'costo_unitario', 'stock_actual', 'stock_minimo', 'limite_credito',
]);

function cleanNumeric(raw: string): string {
  let s = raw
    .replace(/\s*(USD|ARS)\s*/gi, '')
    .replace(/[$€]\s*/g, '')
    .replace(/[ ​ ﻿]/g, '')
    .trim();

  if (!s) return '';

  const negative = s.startsWith('-');
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return '';

  const dotCount   = (s.match(/\./g)  ?? []).length;
  const commaCount = (s.match(/,/g)   ?? []).length;
  const lastDot    = s.lastIndexOf('.');
  const lastComma  = s.lastIndexOf(',');

  if (dotCount > 0 && commaCount > 0) {
    if (lastComma > lastDot) { s = s.replace(/\./g, '').replace(',', '.'); }
    else                     { s = s.replace(/,/g, ''); }
  } else if (commaCount > 0) {
    if (commaCount > 1) {
      s = s.replace(/,/g, '');
    } else {
      const afterComma = s.slice(lastComma + 1);
      s = afterComma.length <= 2 ? s.replace(',', '.') : s.replace(',', '');
    }
  } else if (dotCount > 1) {
    s = s.replace(/\./g, '');
  } else if (dotCount === 1) {
    const afterDot = s.slice(lastDot + 1);
    if (afterDot.length === 3 && !s.startsWith('0.')) s = s.replace('.', '');
  }

  const result = negative ? '-' + s : s;
  return s !== '' && !isNaN(Number(result)) ? result : '';
}

function applyNumericCleaning(remapped: Record<string, string>): Record<string, string> {
  const out = { ...remapped };
  for (const field of NUMERIC_FIELDS) {
    if (field in out && out[field] !== '') out[field] = cleanNumeric(out[field]);
  }
  return out;
}

// ── Descarga de plantilla ──────────────────────────────────────────────────────

function downloadTemplate(headers: string[], example: (string | number)[], filename: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  const raw  = Array.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array);
  const blob = new Blob([new Uint8Array(raw)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface ParsedRow { raw: Record<string, string>; data: unknown; errors: string[]; rowIndex: number }
type Phase = 'select' | 'mapping' | 'preview' | 'importing';

const METHOD_BADGE: Record<ColMapping['method'], { label: string; cls: string } | null> = {
  exact:  null,
  alias:  { label: 'alias',      cls: 'text-[#60a5fa]' },
  fuzzy:  { label: 'similitud',  cls: 'text-[#a78bfa]' },
  manual: { label: 'manual',     cls: 'text-[#fbbf24]' },
};

// ── Componente ─────────────────────────────────────────────────────────────────

export function ImportModal({ open, onClose, onDone, config }: {
  open: boolean; onClose: () => void; onDone: () => void; config: ImportConfig;
}) {
  const { showToast } = useToast();
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [phase,        setPhase]        = useState<Phase>('select');
  const [parsedRows,   setParsedRows]   = useState<ParsedRow[]>([]);
  const [progress,     setProgress]     = useState({ done: 0, total: 0 });
  const [dragOver,     setDragOver]     = useState(false);
  const [colMapping,   setColMapping]   = useState<ColMapping[]>([]);
  const [mappingOpen,  setMappingOpen]  = useState(false);

  // Datos de archivo en estado React (no refs) para garantizar persistencia correcta
  const [pendingRows,   setPendingRows]   = useState<Record<string, unknown>[]>([]);
  const [fileColumns,   setFileColumns]   = useState<string[]>([]);
  const [allAutoMatched, setAllAutoMatched] = useState<ColMapping[]>([]);
  // manualMap solo contiene los campos REQUERIDOS que no se detectaron automáticamente
  const [manualMap,     setManualMap]     = useState<Record<string, string>>({});

  const resetAll = useCallback(() => {
    setPhase('select'); setParsedRows([]); setProgress({ done: 0, total: 0 });
    setColMapping([]); setMappingOpen(false);
    setPendingRows([]); setFileColumns([]); setAllAutoMatched([]); setManualMap({});
  }, []);

  useEffect(() => { if (!open) resetAll(); }, [open, resetAll]);

  const validRows = parsedRows.filter(r => r.errors.length === 0);
  const errorRows = parsedRows.filter(r => r.errors.length > 0);

  const required    = config.requiredFields ?? [];
  const canContinue = required.every(
    f => allAutoMatched.some(m => m.to === f) || !!manualMap[f],
  );

  // ── parseFile ──────────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb      = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
        const ws      = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });

        if (rawRows.length === 0) { showToast('El archivo está vacío.', 'error'); return; }

        // Paso 1: aliases (incluye versiones stripped de "P. Venta" etc.)
        const lookup  = buildLookup(config.templateHeaders);
        const { matched: aliasMatched } = remapColumns(rawRows[0], lookup);

        if (aliasMatched.length === 0) {
          showToast('No reconocemos el formato de este archivo. Descargá la plantilla para ver el formato esperado.', 'error');
          return;
        }

        // Paso 2: fuzzy sobre columnas que quedaron sin mapear
        const fuzzyMatched = applyFuzzyMatching(rawRows[0], config.templateHeaders, aliasMatched);
        const allAuto      = [...aliasMatched, ...fuzzyMatched];

        // Paso 3: ¿faltan campos obligatorios?
        const missingReq = required.filter(f => !allAuto.some(m => m.to === f));

        if (missingReq.length > 0) {
          // Ir a mapeo manual solo con los campos requeridos faltantes
          const initMap: Record<string, string> = {};
          for (const f of missingReq) initMap[f] = '';

          setPendingRows(rawRows);
          setFileColumns(Object.keys(rawRows[0]));
          setAllAutoMatched(allAuto);
          setManualMap(initMap);
          setPhase('mapping');
        } else {
          // Todos los obligatorios detectados — construir lookup extendido con fuzzy y parsear
          const extLookup = new Map(lookup);
          for (const m of fuzzyMatched) extLookup.set(normalizeKey(m.from), m.to);

          const parsed = rawRows.map((rawRow, i) => {
            const { remapped } = remapColumns(rawRow, extLookup);
            const cleaned      = applyNumericCleaning(remapped);
            const result       = config.validateRow(cleaned, i + 1);
            return { raw: cleaned, data: result.data, errors: result.errors, rowIndex: i + 1 };
          });

          setColMapping(allAuto);
          setParsedRows(parsed);
          setPhase('preview');
        }
      } catch (err: unknown) {
        showToast('Error al leer el archivo: ' + (err instanceof Error ? err.message : 'Formato no reconocido.'), 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [config, required, showToast]);

  // ── handleMappingContinue ─────────────────────────────────────────────────

  const handleMappingContinue = useCallback(() => {
    // Reconstruir lookup desde cero (no dependemos de refs ni estado mutable externo)
    const extLookup = buildLookup(config.templateHeaders);

    // Aplicar entradas fuzzy
    for (const m of allAutoMatched) {
      if (m.method === 'fuzzy') extLookup.set(normalizeKey(m.from), m.to);
    }

    // Aplicar entradas manuales (mayor prioridad)
    const allMapping: ColMapping[] = [...allAutoMatched];
    for (const [canonical, originalCol] of Object.entries(manualMap)) {
      if (originalCol) {
        extLookup.set(normalizeKey(originalCol), canonical);
        allMapping.push({ from: originalCol, to: canonical, method: 'manual' });
      }
    }

    // Parsear todas las filas con el lookup completo
    const parsed = pendingRows.map((rawRow, i) => {
      const { remapped } = remapColumns(rawRow, extLookup);
      const cleaned      = applyNumericCleaning(remapped);
      const result       = config.validateRow(cleaned, i + 1);
      return { raw: cleaned, data: result.data, errors: result.errors, rowIndex: i + 1 };
    });

    setColMapping(allMapping);
    setParsedRows(parsed);
    setPhase('preview');
  }, [config, allAutoMatched, manualMap, pendingRows]);

  // ── handleConfirm ─────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (validRows.length === 0) return;
    setPhase('importing');
    setProgress({ done: 0, total: validRows.length });
    let created = 0, updated = 0, skipped = 0, failed = 0;
    for (let i = 0; i < validRows.length; i++) {
      try {
        const o = await config.importRow(validRows[i].data);
        if (o === 'created') created++; else if (o === 'updated') updated++; else skipped++;
      } catch { failed++; }
      setProgress({ done: i + 1, total: validRows.length });
    }
    const parts: string[] = [];
    if (created > 0) parts.push(`${created} creado${created !== 1 ? 's' : ''}`);
    if (updated > 0) parts.push(`${updated} actualizado${updated !== 1 ? 's' : ''}`);
    if (skipped > 0) parts.push(`${skipped} saltado${skipped !== 1 ? 's' : ''}`);
    if (failed  > 0) parts.push(`${failed} con error`);
    showToast(parts.join(', ') || 'Sin cambios.', failed > 0 ? 'error' : 'ok');
    onDone(); onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const isImporting   = phase === 'importing';
  const previewRows   = parsedRows.slice(0, 5);
  const modalMaxWidth = phase === 'preview' ? '740px' : phase === 'mapping' ? '540px' : '480px';

  // Campos requeridos sin mapear (para la pantalla de mapeo manual)
  const unmappedReq = Object.keys(manualMap).filter(f => required.includes(f));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={isImporting ? undefined : onClose}
      title={`Importar ${config.entityName}`}
      maxWidth={modalMaxWidth}
      footer={
        phase === 'select' ? (
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        ) : phase === 'mapping' ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" disabled={!canContinue} onClick={handleMappingContinue}>Continuar</Button>
          </>
        ) : phase === 'preview' ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" disabled={validRows.length === 0} onClick={handleConfirm}>
              Confirmar importación ({validRows.length} {validRows.length === 1 ? 'fila' : 'filas'})
            </Button>
          </>
        ) : undefined
      }
    >
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />

      {/* ── Seleccionar archivo ── */}
      {phase === 'select' && (
        <div className="flex flex-col gap-5">
          <div
            role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-[var(--r-in)] p-8 text-center cursor-pointer transition-colors select-none ${dragOver ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50 hover:bg-surface-2'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <svg className="mx-auto mb-3 text-text-subtle" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-[14px] font-semibold text-text mb-1">Arrastrá tu archivo aquí</p>
            <p className="text-[12px] text-text-subtle">o hacé click para seleccionar</p>
            <p className="text-[11px] text-text-subtle mt-2 opacity-70">Formatos: .xlsx · .xls · .csv</p>
          </div>
          <div className="flex justify-center">
            <button type="button" className="flex items-center gap-1.5 text-[12px] text-accent hover:opacity-80 transition-opacity"
              onClick={() => downloadTemplate(config.templateHeaders, config.templateExample, config.templateFilename)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Descargar plantilla de ejemplo
            </button>
          </div>
        </div>
      )}

      {/* ── Mapeo manual (solo campos requeridos sin detectar) ── */}
      {phase === 'mapping' && (
        <div className="flex flex-col gap-5">
          <div className="rounded-[var(--r-in)] bg-surface-2 border border-border px-4 py-3">
            <p className="text-[13px] font-semibold text-text mb-1">Ayudanos a identificar las columnas</p>
            <p className="text-[12px] text-text-muted leading-relaxed">
              Detectamos{' '}
              <span className="font-medium text-text">{allAutoMatched.length}</span> columna{allAutoMatched.length !== 1 ? 's' : ''} automáticamente
              {allAutoMatched.length > 0 && <span className="text-text-subtle"> ({allAutoMatched.map(m => m.from).join(', ')})</span>}.
              {' '}Indicá cuál es {unmappedReq.length === 1 ? 'el campo restante' : 'los campos restantes'}:
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {unmappedReq.map(field => (
              <div key={field} className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-text">
                  {FIELD_LABELS[field] ?? field}<span className="text-[#f87171] ml-1">*</span>
                </label>
                <select
                  className="w-full rounded-[var(--r-in)] border border-border bg-surface px-3 py-2 text-[12px] text-text outline-none focus:border-accent cursor-pointer"
                  value={manualMap[field] ?? ''}
                  onChange={e => setManualMap(m => ({ ...m, [field]: e.target.value }))}
                >
                  <option value="" disabled>Seleccioná una columna…</option>
                  {fileColumns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-start">
            <button type="button" className="text-[12px] text-text-subtle hover:text-accent transition-colors" onClick={resetAll}>
              ← Elegir otro archivo
            </button>
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      {phase === 'preview' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-surface-2 text-text-muted">
              {parsedRows.length} fila{parsedRows.length !== 1 ? 's' : ''} encontrada{parsedRows.length !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-[rgba(34,197,94,0.1)] text-[#4ade80]">
              ✓ {validRows.length} válida{validRows.length !== 1 ? 's' : ''}
            </span>
            {errorRows.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-[rgba(239,68,68,0.1)] text-[#f87171]">
                ✗ {errorRows.length} con error{errorRows.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          {/* Columnas detectadas */}
          <div className="rounded-[var(--r-in)] border border-border overflow-hidden">
            <button type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium text-text-muted bg-surface-2 hover:bg-surface-2/80 transition-colors"
              onClick={() => setMappingOpen(v => !v)}>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/>
                </svg>
                Columnas detectadas ({colMapping.length})
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: mappingOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {mappingOpen && (
              <div className="flex flex-wrap gap-1.5 p-3 bg-surface/50">
                {colMapping.map((m, i) => {
                  const badge  = METHOD_BADGE[m.method];
                  const isExact = m.method === 'exact';
                  return (
                    <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border font-mono ${m.method === 'manual' ? 'bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.25)]' : m.method === 'fuzzy' ? 'bg-[rgba(167,139,250,0.08)] border-[rgba(167,139,250,0.2)]' : 'bg-surface-2 border-border'} text-text-muted`}>
                      {isExact ? (
                        <><span className="text-text">{m.from}</span><span className="text-[#4ade80] ml-1">✓</span></>
                      ) : (
                        <>
                          <span className="text-text-subtle">{m.from}</span>
                          <span className="opacity-40 mx-0.5">→</span>
                          <span className="text-text">{m.to}</span>
                          {badge && <span className={`text-[10px] ml-0.5 opacity-80 ${badge.cls}`}>{badge.label}</span>}
                          <span className="text-[#4ade80] ml-0.5">✓</span>
                        </>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {previewRows.length > 0 && (
            <div className="overflow-x-auto rounded-[var(--r-in)] border border-border">
              <table className="tbl text-[12px] w-full">
                <thead>
                  <tr>
                    <th className="w-8 text-center text-[11px]">#</th>
                    {config.previewColumns.map(col => <th key={col.key}>{col.label}</th>)}
                    <th className="w-16 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(row => (
                    <tr key={row.rowIndex} className={row.errors.length > 0 ? 'bg-[rgba(239,68,68,0.05)]' : ''}>
                      <td className="text-center text-text-subtle font-mono text-[11px]">{row.rowIndex}</td>
                      {config.previewColumns.map(col => (
                        <td key={col.key} className="max-w-[180px] truncate">
                          {row.raw[col.key] || <span className="text-text-subtle italic text-[11px]">vacío</span>}
                        </td>
                      ))}
                      <td className="text-center">
                        {row.errors.length === 0
                          ? <span className="text-[#4ade80] text-[11px] font-semibold">✓ OK</span>
                          : <span className="text-[#f87171] text-[11px] font-semibold">✗ Error</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 5 && (
                <div className="px-4 py-2 text-[11px] text-text-subtle border-t border-border bg-surface-2">
                  Mostrando las primeras 5 de {parsedRows.length} filas.
                </div>
              )}
            </div>
          )}

          {errorRows.length > 0 && (
            <div className="rounded-[var(--r-in)] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] p-3 max-h-[140px] overflow-y-auto">
              <p className="text-[11px] font-semibold text-[#f87171] mb-2 uppercase tracking-wide">Errores detectados</p>
              {errorRows.map(row => (
                <div key={row.rowIndex} className="text-[12px] text-[#fca5a5] mb-1 leading-snug">
                  <span className="font-mono text-[11px] text-[#f87171] font-bold mr-2">Fila {row.rowIndex}:</span>
                  {row.errors.join(' · ')}
                </div>
              ))}
            </div>
          )}

          {validRows.length === 0 && errorRows.length === 0 && (
            <p className="text-[13px] text-text-subtle text-center py-1">No hay filas válidas para importar.</p>
          )}

          <div className="flex justify-start">
            <button type="button" className="text-[12px] text-text-subtle hover:text-accent transition-colors" onClick={resetAll}>
              ← Elegir otro archivo
            </button>
          </div>
        </div>
      )}

      {/* ── Importando ── */}
      {phase === 'importing' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <svg className="animate-spin text-accent" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" opacity="0.2"/><path d="M3 12a9 9 0 0 1 9-9"/>
          </svg>
          <p className="text-[14px] font-semibold text-text">Importando…</p>
          <p className="text-[13px] text-text-muted">{progress.done} de {progress.total} {progress.total === 1 ? 'fila' : 'filas'}</p>
          <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden mt-1">
            <div className="h-full bg-accent transition-all duration-100"
              style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
    </Modal>
  );
}
