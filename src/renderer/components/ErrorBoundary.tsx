import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      window.api.log.error(`[ErrorBoundary] ${error.message}`, info.componentStack ?? '');
    } catch {}
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleGoToCaja = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.hash = '#/caja';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', minHeight: '400px', padding: '2rem', gap: '1.5rem',
        background: 'var(--surface)', color: 'var(--text)', textAlign: 'center',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--danger)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>

        <div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Algo falló al renderizar esta pantalla
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            El error fue registrado en el log. Podés reintentar o volver a Caja.
          </div>
        </div>

        {this.state.errorMessage && (
          <div style={{
            fontSize: '0.75rem', fontFamily: 'monospace',
            color: 'var(--text-muted)', background: 'var(--surface-2)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-in)',
            padding: '0.625rem 1rem', maxWidth: '520px', wordBreak: 'break-word',
          }}>
            {this.state.errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={this.handleRetry} className="btn btn-primary">
            Reintentar
          </button>
          <button onClick={this.handleGoToCaja} className="btn btn-ghost">
            Volver a Caja
          </button>
        </div>
      </div>
    );
  }
}
