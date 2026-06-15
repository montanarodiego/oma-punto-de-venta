// Tema claro/oscuro del POS.
//
// La preferencia tiene 3 valores: 'auto' (sigue al sistema operativo), 'claro' u
// 'oscuro'. El tema oscuro es el default del CSS (:root); el claro se activa
// agregando la clase `theme-light` en <html> (ver globals.css).
//
// Para evitar un flash al arrancar, main.tsx llama a initTema() de forma síncrona
// (matchMedia es síncrono) ANTES de montar React, y luego aplica la preferencia
// guardada en la base cuando esa lectura asíncrona resuelve.

export type TemaPref = 'auto' | 'claro' | 'oscuro';
type TemaEfectivo = 'claro' | 'oscuro';

let pref: TemaPref = 'auto';

function temaDelSO(): TemaEfectivo {
  return window.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'claro' : 'oscuro';
}

function resolver(p: TemaPref): TemaEfectivo {
  return p === 'auto' ? temaDelSO() : p;
}

function pintar(efectivo: TemaEfectivo, conTransicion: boolean) {
  const el = document.documentElement;
  if (conTransicion) {
    // La clase habilita una transición de colores breve solo durante el cambio,
    // para que no sea un corte brusco. Se quita sola.
    el.classList.add('theme-transition');
    window.setTimeout(() => el.classList.remove('theme-transition'), 320);
  }
  el.classList.toggle('theme-light', efectivo === 'claro');
}

/** Cambia la preferencia y la aplica. Persistir aparte con config.set('tema', …). */
export function setTema(p: TemaPref, conTransicion = false): void {
  pref = p;
  pintar(resolver(p), conTransicion);
}

export function getTema(): TemaPref {
  return pref;
}

/** Aplica el tema actual ya mismo (sin flash) y re-aplica si el SO cambia en modo auto. */
export function initTema(): void {
  pintar(resolver(pref), false);
  window.matchMedia?.('(prefers-color-scheme: light)')?.addEventListener?.('change', () => {
    if (pref === 'auto') pintar(temaDelSO(), true);
  });
}
