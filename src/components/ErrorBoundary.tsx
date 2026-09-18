import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Bez tohohle zčerná při jedné neodchycené výjimce celá appka a uživatel nemá
 * co dělat. Radši ukázat, co se stalo, a nabídnout cestu ven.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('NaVrchol spadl:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="app">
        <div className="state" style={{ justifyContent: 'center', flexGrow: 1 }}>
          <Icon name="warn" size={40} stroke={1.4} color="var(--stop)" />
          <div className="state-title">Appka spadla</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 280 }}>
            Něco se pokazilo při vykreslování. Tvoje trasy jsou v pořádku, jsou uložené v telefonu.
          </div>
          <code
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--mute)',
              background: 'var(--card)',
              padding: '8px 10px',
              borderRadius: 8,
              maxWidth: 300,
              wordBreak: 'break-word',
              textAlign: 'left',
            }}
          >
            {error.message}
          </code>
          <button
            className="btn"
            style={{ maxWidth: 220, marginTop: 6 }}
            onClick={() => this.setState({ error: null })}
          >
            <Icon name="refresh" size={18} stroke={2.2} />
            Zkusit znovu
          </button>
          <button
            style={{ fontSize: 12.5, color: 'var(--mute)', textDecoration: 'underline', marginTop: 2 }}
            onClick={() => location.reload()}
          >
            Načíst appku od začátku
          </button>
        </div>
      </div>
    )
  }
}
