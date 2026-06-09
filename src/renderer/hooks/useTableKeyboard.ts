import { useRef, useEffect } from 'react';
import { navigateInModal } from './modalNav';

interface UseTableKeyboardOptions {
  items:        any[];
  activeIdx:    number;
  setActiveIdx: (idx: number) => void;
  onOpen:       (item: any) => void;
  enabled?:     boolean;
}

/**
 * Navegación de tabla con teclado: ↑↓ mueven la fila activa, Enter abre el ítem.
 *
 * Lógica de flechas:
 *   - Dentro de [data-modal]: navegación espacial (mismo que useCarritoKeyboard).
 *     ←→ mueven dentro de la misma fila; ↑↓ dentro de la misma columna con
 *     fallback lineal. preventDefault sólo si se movió el foco.
 *   - Fuera de modal: ↑↓ navegan la tabla aunque el foco esté en el input de
 *     búsqueda (comportamiento intencionado). ←→ se ignoran (sin acción).
 */
export function useTableKeyboard({
  items, activeIdx, setActiveIdx, onOpen, enabled = true,
}: UseTableKeyboardOptions) {
  const ref = useRef({ items, activeIdx, setActiveIdx, onOpen, enabled });
  ref.current = { items, activeIdx, setActiveIdx, onOpen, enabled };

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const o = ref.current;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' ||
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
          return;
        }

        // Fuera de modal: sólo ↑↓ navegan la tabla; ←→ pasan al browser
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        if (!o.enabled || o.items.length === 0) return;
        e.preventDefault();
        if (e.key === 'ArrowDown')
          o.setActiveIdx(o.activeIdx < o.items.length - 1 ? o.activeIdx + 1 : 0);
        else
          o.setActiveIdx(o.activeIdx > 0 ? o.activeIdx - 1 : o.items.length - 1);
        return;
      }

      if (e.key === 'Enter') {
        const active = document.activeElement as HTMLElement | null;
        if (active?.closest('[data-modal]')) return;
        if (!o.enabled || o.activeIdx < 0 || !o.items[o.activeIdx]) return;
        e.preventDefault();
        o.onOpen(o.items[o.activeIdx]);
      }
    }
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);
}
