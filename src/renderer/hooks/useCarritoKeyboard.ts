import { useRef, useEffect } from 'react';
import { navigateInModal } from './modalNav';

interface UseCarritoKeyboardOptions {
  enabled:  boolean;
  hasItems: boolean;
  onPlus:   () => void;
  onMinus:  () => void;
  onUp:     () => void;
  onDown:   () => void;
  onStar:   () => void;
}

/**
 * Intercepción en capture phase de las teclas del carrito: +/=, -, *, ↑↓←→.
 *
 * Lógica de flechas:
 *   - Dentro de [data-modal]: navegación espacial entre elementos del modal.
 *     ←→ mueven dentro de la misma fila (grid horizontal); ↑↓ mueven dentro
 *     de la misma columna con fallback lineal para listas y inputs sueltos.
 *     preventDefault sólo si el movimiento ocurrió (preserva cursor en inputs
 *     cuando no hay candidato en esa dirección).
 *   - Fuera de modal, foco en input/textarea/select: no actúa (no interfiere
 *     con el lector de código de barras).
 *   - Fuera de modal, foco en otro elemento: ↑↓ navegan el carrito respetando
 *     enabled y hasItems; ←→ se ignoran.
 *
 * Para +/-/*: sólo actúa si enabled y hasItems (fuera de modal).
 */
export function useCarritoKeyboard(opts: UseCarritoKeyboardOptions) {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const o = ref.current;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const active = document.activeElement as HTMLElement | null;
        const modal  = active?.closest('[data-modal]') as HTMLElement | null;

        if (modal) {
          const dir = e.key === 'ArrowUp'    ? 'up'
                    : e.key === 'ArrowDown'  ? 'down'
                    : e.key === 'ArrowLeft'  ? 'left'
                    :                          'right';
          const moved = navigateInModal(modal, active!, dir);
          if (moved) e.preventDefault();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const tag = active?.tagName.toLowerCase();
          if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
          if (!o.enabled || !o.hasItems) return;
          e.preventDefault();
          if (e.key === 'ArrowUp')   o.onUp();
          if (e.key === 'ArrowDown') o.onDown();
        }
        // ←→ fuera de modal: sin acción, el browser los maneja
        return;
      }

      if (!o.enabled || !o.hasItems) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); o.onPlus();  return; }
      if (e.key === '-')                   { e.preventDefault(); o.onMinus(); return; }
      if (e.key === '*')                   { e.preventDefault(); o.onStar();  return; }
    }
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);
}
