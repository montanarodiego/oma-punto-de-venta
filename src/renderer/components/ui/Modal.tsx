import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

export function Modal({ open, onClose, title, children, footer, maxWidth = '460px', className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Notifica al proceso main que un modal está abierto (afecta hotkeys globales)
  useEffect(() => {
    if (!open) return;
    window.api?.modalState(true);
    return () => { window.api?.modalState(false); };
  }, [open]);

  // Focus trap: Tab/Shift+Tab queda dentro del modal; Escape lo cierra
  useFocusTrap(panelRef, open, onClose);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && onClose) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="modal-overlay"
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            ref={panelRef}
            className={clsx('modal-box', className)}
            style={{ maxWidth }}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {title && (
              <div className="modal-header">
                <h3 className="modal-title">{title}</h3>
                {onClose && (
                  <button className="modal-close" onClick={onClose}>×</button>
                )}
              </div>
            )}
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
