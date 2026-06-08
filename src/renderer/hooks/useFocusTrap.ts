import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Preferred initial focus: real input/select/textarea before buttons
const FIRST_INPUT =
  'input:not([disabled]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), ' +
  'select:not([disabled]), textarea:not([disabled])';

/**
 * Focus trap para modales.
 * - Traps Tab/Shift+Tab inside `containerRef`.
 * - Auto-enfoca el primer input (o primer focusable si no hay inputs) si nada
 *   dentro ya tiene foco (respeta autoFocus existente).
 * - Llama `onEscape` en Escape y detiene la propagación para que handlers
 *   del nivel window no interfieran.
 *
 * Usa capture phase para interceptar antes que los handlers de React.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
) {
  // Ref para onEscape: evita re-registrar el listener en cada render
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    // Auto-focus con pequeño delay para dejar que autoFocus y animaciones actúen primero
    const t = setTimeout(() => {
      if (el.contains(document.activeElement)) return;
      const target =
        el.querySelector<HTMLElement>(FIRST_INPUT) ??
        el.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }, 60);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (onEscapeRef.current) {
          e.preventDefault();
          e.stopPropagation(); // evita que window-level handlers también procesen Escape
          onEscapeRef.current();
        }
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = Array.from(el!.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) return;

      const first  = focusable[0];
      const last   = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (active === first || !el!.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !el!.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    // Capture phase: dispara antes que los handlers de React (bubble)
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [active, containerRef]);
}
