import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

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

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handleKey);
    window.api?.modalState(true);
    return () => {
      document.removeEventListener('keydown', handleKey);
      window.api?.modalState(false);
    };
  }, [open, onClose]);

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
