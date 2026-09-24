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
        <div className="empty" style={{ flex: 1, justifyContent: 'center' }}>
          <div className="empty-icon">
            <Icon name="warn" size={44} stroke={1.6} color="var(--stop)" />
          </div>
          <div className="t-headline">Appka spadla</div>
          <p>Něco se pokazilo při vykreslování. Tvoje trasy jsou v pořádku, jsou uložené v telefonu.</p>
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--ink-2)',
              background: 'var(--fill-2)',
              padding: '8px 10px',
              borderRadius: 8,
              maxWidth: 300,
              wordBreak: 'break-word',
              textAlign: 'left',
            }}
          >
            {error.message}
          </code>
          <button className="btn btn--small" onClick={() => this.setState({ error: null })}>
            <Icon name="refresh" size={17} stroke={2} />
            Zkusit znovu
          </button>
          <button className="link t-sub" onClick={() => location.reload()}>
            Načíst appku od začátku
          </button>
        </div>
      </div>
    )
  }
}
