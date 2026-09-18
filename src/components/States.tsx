import { Icon } from './Icon'

/**
 * Kostra kopíruje geometrii obrazovky, která se načítá: verdikt, stupnice,
 * dvě věty, čtyři řádky měření. Obecný pulzující obdélník by po dojetí dat
 * nechal obsah poskočit.
 */
export function Loading({ what }: { what: string }) {
  return (
    <div className="sec">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div className="skel" style={{ width: 128, height: 42 }} />
        <div className="skel" style={{ width: 54, height: 26 }} />
      </div>
      <div className="skel" style={{ height: 8, marginTop: 12 }} />
      <div className="skel" style={{ height: 12, marginTop: 16, width: '92%' }} />
      <div className="skel" style={{ height: 12, marginTop: 7, width: '64%' }} />
      <div className="rows" style={{ marginTop: 26 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="row">
            <div className="skel" style={{ height: 11, width: 84 }} />
            <div style={{ flexGrow: 1 }} />
            <div className="skel" style={{ height: 15, width: 62 }} />
          </div>
        ))}
      </div>
      <div className="hint mono" style={{ marginTop: 16, letterSpacing: '0.06em' }}>
        {what}
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="sec" style={{ marginTop: 18 }}>
      <div className="note" data-tone="nejdi">
        <Icon name="warn" size={16} stroke={2} />
        <div>
          <strong>Data nedorazila.</strong>
          <div style={{ marginTop: 3, color: 'var(--paper-2)' }}>{message}</div>
        </div>
      </div>
      {onRetry && (
        <button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={onRetry}>
          <Icon name="refresh" size={17} stroke={2} />
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
      <Icon name="peak" size={34} stroke={1.5} color="var(--paper-4)" />
      <div className="state-title">{title}</div>
      <div className="hint" style={{ maxWidth: 268 }}>
        {hint}
      </div>
      {action && (
        <button className="btn" style={{ maxWidth: 240, marginTop: 6 }} onClick={action.onClick}>
          <Icon name="plus" size={17} stroke={2.2} />
          {action.label}
        </button>
      )}
    </div>
  )
}
