/**
 * Navegación espacial de elementos focusables dentro de un contenedor [data-modal].
 *
 * Para ←→: sólo considera elementos dentro del 70% de la altura del activo
 *   (mismo rango vertical ≈ misma fila de un grid o grupo horizontal).
 * Para ↑↓: sólo considera elementos dentro del 70% del ancho del activo
 *   (mismo rango horizontal ≈ misma columna de un grid o lista vertical).
 * Si ↑↓ no encuentra candidatos espaciales, cae al orden DOM lineal como
 *   fallback para listas o elementos sueltos (inputs, botones aislados).
 * Devuelve true si movió el foco (para saber si llamar preventDefault).
 */
export const MODAL_SEL =
  'button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled])';

export function navigateInModal(
  modal:  HTMLElement,
  active: HTMLElement,
  dir:    'up' | 'down' | 'left' | 'right',
): boolean {
  const all = Array.from(modal.querySelectorAll<HTMLElement>(MODAL_SEL));
  if (!all.length) return false;

  const ar  = active.getBoundingClientRect();
  const ax  = ar.left + ar.width  / 2;
  const ay  = ar.top  + ar.height / 2;
  const isH = dir === 'left' || dir === 'right';

  // Umbral perpendicular: 70% de la dimensión del elemento activo en el eje secundario.
  // Para ←→ usa la altura (distingue filas); para ↑↓ usa el ancho (distingue columnas).
  const perp = (isH ? ar.height : ar.width) * 0.7;

  const candidates = all.filter(el => {
    if (el === active) return false;
    const r  = el.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    switch (dir) {
      case 'right': return cx > ax + 4 && Math.abs(cy - ay) <= perp;
      case 'left':  return cx < ax - 4 && Math.abs(cy - ay) <= perp;
      case 'down':  return cy > ay + 4 && Math.abs(cx - ax) <= perp;
      case 'up':    return cy < ay - 4 && Math.abs(cx - ax) <= perp;
    }
  });

  // Fallback lineal para ↑↓ cuando no hay candidatos espaciales (listas, inputs sueltos)
  if (!candidates.length && !isH) {
    const idx = all.indexOf(active);
    if (idx < 0) return false;
    const next = dir === 'down'
      ? Math.min(idx + 1, all.length - 1)
      : Math.max(idx - 1, 0);
    if (next === idx) return false;
    all[next].focus();
    return true;
  }

  if (!candidates.length) return false;

  // Más cercano en el eje primario
  const best = candidates.reduce((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const da = isH
      ? Math.abs(ra.left + ra.width  / 2 - ax)
      : Math.abs(ra.top  + ra.height / 2 - ay);
    const db = isH
      ? Math.abs(rb.left + rb.width  / 2 - ax)
      : Math.abs(rb.top  + rb.height / 2 - ay);
    return da < db ? a : b;
  });

  best.focus();
  return true;
}
