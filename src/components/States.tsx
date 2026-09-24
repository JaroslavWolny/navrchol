import { Icon, type IconName } from './Icon'
import { vlna } from '../lib/format'

/**
 * Kostra kopíruje geometrii obrazovky, která se načítá: výběr dne, karta
 * verdiktu, graf. Obecný točící se kolečko by po dojetí dat nechal obsah
 * poskočit.
 */
export function Loading({ what }: { what: string }) {
  return (
    <div aria-busy="true" aria-label={what}>
      <div className="days" style={{ marginTop: 14 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skel" style={{ width: 52, height: 62, borderRadius: 13, flexShrink: 0 }} />
        ))}
      </div>
      <div className="page mt-12">
        <div className="card verdict">
          <div className="between">
            <div className="skel" style={{ width: 110, height: 38 }} />
            <div className="skel" style={{ width: 54, height: 38 }} />
          </div>
          <div className="skel mt-12" style={{ width: '86%', height: 14 }} />
          <div className="skel mt-16" style={{ height: 10 }} />
          <div className="skel mt-12" style={{ width: '60%', height: 12 }} />
        </div>
        <div className="card mt-12" style={{ height: 210, padding: 16 }}>
          <div className="skel" style={{ height: '100%' }} />
        </div>
      </div>
      <p className="footer-note">{what}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name="cloud" size={44} stroke={1.5} />
      </div>
      <div className="t-headline">Předpověď nedorazila</div>
      <p>{vlna(/[.!?]$/.test(message) ? message : `${message}.`)}</p>
      {onRetry && (
        <button className="btn btn--gray btn--small" onClick={onRetry}>
          <Icon name="refresh" size={17} stroke={2} />
          Zkusit znovu
        </button>
      )}
    </div>
  )
}

export function Empty({
  icon = 'mountain',
  title,
  hint,
  action,
}: {
  icon?: IconName
  title: string
  hint: string
  action?: { label: string; onClick: () => void; icon?: IconName }
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={44} stroke={1.5} />
      </div>
      <div className="t-headline">{title}</div>
      <p>{vlna(hint)}</p>
      {action && (
        <button className="btn btn--small" onClick={action.onClick}>
          <Icon name={action.icon ?? 'plus'} size={17} stroke={2.2} />
          {action.label}
        </button>
      )}
    </div>
  )
}
