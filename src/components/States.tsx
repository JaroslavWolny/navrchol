import { Icon } from './Icon'

export function Loading({ what }: { what: string }) {
  return (
    <div className="state">
      <div className="skeleton" style={{ width: '100%', height: 120 }} />
      <div className="skeleton" style={{ width: '100%', height: 64 }} />
      <div className="state-title">{what}</div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="pad" style={{ paddingTop: 20 }}>
      <div className="error-box">
        <strong>Data nedorazila.</strong>
        <div style={{ marginTop: 4, color: 'var(--dim)' }}>{message}</div>
      </div>
      {onRetry && (
        <button className="btn" style={{ marginTop: 12 }} onClick={onRetry}>
          <Icon name="refresh" size={18} stroke={2.2} />
          Zkusit znovu
        </button>
      )}
    </div>
  )
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="state">
      <Icon name="peak" size={40} stroke={1.4} color="var(--faint)" />
      <div className="state-title">{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 260 }}>{hint}</div>
      {action && (
        <button className="btn" style={{ maxWidth: 220, marginTop: 6 }} onClick={action.onClick}>
          <Icon name="plus" size={18} stroke={2.4} />
          {action.label}
        </button>
      )}
    </div>
  )
}
