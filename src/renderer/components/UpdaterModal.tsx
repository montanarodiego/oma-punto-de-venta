import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

type UpdaterState = 'idle' | 'available' | 'downloading' | 'ready' | 'error';

interface UpdateInfo {
  version: string;
  releaseNotes: string | null;
}

interface ProgressData {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

function fmtSpeed(bps: number): string {
  if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps >= 1_024) return `${Math.round(bps / 1_024)} KB/s`;
  return `${bps} B/s`;
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${Math.round(bytes / 1_024)} KB`;
  return `${bytes} B`;
}

const IconDownload = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="16 16 12 20 8 16" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

const IconCheck = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconError = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ── Íconos con fondo coloreado ─────────────────────────────────────
function IconBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </div>
  );
}

// ── Estado: descargando ────────────────────────────────────────────
function DownloadingState({ progress, onSkip }: { progress: ProgressData | null; onSkip: () => void }) {
  const pct = Math.min(100, Math.max(0, progress?.percent ?? 0));
  const hasSize = progress && progress.total > 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <IconBadge color="rgba(79,142,245,.15)">
          <span style={{ color: 'var(--accent)' }}><IconDownload /></span>
        </IconBadge>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            Descargando actualización…
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>{pct}%</span>
            <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>
              {progress?.bytesPerSecond ? fmtSpeed(progress.bytesPerSecond) : ''}
            </span>
          </div>
        </div>
      </div>

      {/* barra de progreso */}
      <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 999, height: 7, overflow: 'hidden', marginBottom: 10 }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, var(--accent), #7cb9fa)',
            borderRadius: 999,
          }}
        />
      </div>

      {hasSize && (
        <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginBottom: 14, textAlign: 'right' }}>
          {fmtBytes(progress!.transferred)} / {fmtBytes(progress!.total)}
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--text-subtle)', margin: '0 0 16px', textAlign: 'center' }}>
        No cierres la aplicación durante la descarga
      </p>
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={onSkip}
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-subtle)', fontSize: 12, cursor: 'pointer',
            textDecoration: 'underline', fontFamily: 'inherit', padding: 0,
          }}
        >
          Continuar sin actualizar
        </button>
      </div>
    </div>
  );
}

// ── Estado: listo para instalar ────────────────────────────────────
function ReadyState({ onInstall }: { onInstall: () => void }) {
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <IconBadge color="rgba(34,197,94,.12)">
          <span style={{ color: 'var(--success)' }}><IconCheck /></span>
        </IconBadge>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>¡Actualización lista!</div>
          <div style={{ color: '#86efac', fontSize: 13, marginTop: 2 }}>Descarga completada</div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 24px' }}>
        Todo tu trabajo está guardado. La app se reiniciará para aplicar los cambios — tarda solo unos segundos.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          onClick={() => { setLoading(true); onInstall(); }}
          style={{
            background: 'var(--success)', color: '#fff', border: 'none',
            padding: '10px 28px', borderRadius: 9, fontWeight: 700,
            cursor: loading ? 'default' : 'pointer', fontSize: 14,
            fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {loading ? (
            <>
              <motion.svg
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              >
                <path d="M12 2a10 10 0 0 1 10 10" />
              </motion.svg>
              Reiniciando…
            </>
          ) : (
            'Reiniciar e instalar'
          )}
        </motion.button>
      </div>
    </div>
  );
}

// ── Estado: error ──────────────────────────────────────────────────
function ErrorState({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <IconBadge color="rgba(239,68,68,.12)">
          <span style={{ color: 'var(--danger)' }}><IconError /></span>
        </IconBadge>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Error al actualizar</div>
      </div>
      <p style={{ fontSize: 13, color: '#fca5a5', margin: '0 0 22px', wordBreak: 'break-word', lineHeight: 1.5 }}>
        {message}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-subtle)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Podés intentarlo más tarde o actualizar manualmente desde el sitio de OmaTech.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: '1px solid rgba(239,68,68,.35)',
            color: '#fca5a5', padding: '8px 20px', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────
export function UpdaterModal() {
  const [state, setState] = useState<UpdaterState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Race condition: update-available puede haberse disparado antes de que
    // este componente montara. Consultamos el estado cacheado del proceso main.
    window.api.getPendingUpdate().then((info) => {
      if (info) {
        setUpdateInfo(info);
        setState('available');
      }
    });

    window.api.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setDismissed(false);
      setState('available');
    });

    window.api.onUpdateProgress((data) => {
      setProgress(data);
      setState('downloading');
    });

    window.api.onUpdateDownloaded(() => {
      setProgress(null);
      setState('ready');
    });

    window.api.onUpdateError((msg) => {
      setErrorMsg(msg || 'Error desconocido al descargar la actualización.');
      setState('error');
    });
    // preload no expone cleanup para estos listeners — están pensados para registrarse una sola vez
  }, []);

  const handleDownload = useCallback(() => {
    setState('downloading');
    window.api.startDownload();
  }, []);

  const handleInstall = useCallback(() => {
    window.api.installUpdate();
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setState('idle');
  }, []);

  const showToast  = state === 'available' && !dismissed;
  const showModal  = state === 'downloading' || state === 'ready' || state === 'error';

  return createPortal(
    <>
      {/* ── Toast no-intrusivo: update disponible ────────────────── */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            key="updater-toast"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
              width: 340,
              background: 'var(--surface-2)',
              border: '1px solid rgba(79,142,245,.3)',
              borderRadius: 14,
              padding: '16px 18px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <IconBadge color="rgba(79,142,245,.15)">
                <span style={{ color: 'var(--accent)' }}><IconDownload /></span>
              </IconBadge>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                  Nueva versión disponible
                </div>
                {updateInfo?.version && (
                  <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8, fontWeight: 600 }}>
                    v{updateInfo.version}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                  La descarga es rápida y no afecta tus datos ni tu turno activo.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleDismiss}
                    style={{
                      flex: 1,
                      background: 'transparent', border: '1px solid rgba(139,163,189,.2)',
                      color: 'var(--text-muted)', padding: '7px 0', borderRadius: 7,
                      cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
                    }}
                  >
                    Más tarde
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDownload}
                    style={{
                      flex: 2,
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      padding: '7px 0', borderRadius: 7, fontWeight: 600,
                      cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    }}
                  >
                    Descargar ahora
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal overlay: descargando / listo / error ───────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="updater-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 14 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 18, padding: 32,
                width: 'calc(100vw - 48px)', maxWidth: 420,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {state === 'downloading' && (
                <DownloadingState progress={progress} onSkip={handleDismiss} />
              )}
              {state === 'ready' && (
                <ReadyState onInstall={handleInstall} />
              )}
              {state === 'error' && (
                <ErrorState message={errorMsg} onClose={handleDismiss} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
