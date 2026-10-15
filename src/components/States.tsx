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
      <div className="days" style={{ marginTop: 18 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skel" style={{ height: 66, borderRadius: 16 }} />
        ))}
      </div>
      <div className="page" style={{ marginTop: 16 }}>
        <div className="verdict" style={{ background: 'var(--surface)' }}>
          <div className="skel" style={{ width: '60%', height: 12 }} />
          <div className="between mt-16" style={{ alignItems: 'flex-end' }}>
            <div className="skel" style={{ width: 150, height: 96, borderRadius: 14 }} />
            <div className="skel" style={{ width: 70, height: 52, borderRadius: 12 }} />
          </div>
          <div className="skel mt-16" style={{ width: '86%', height: 16 }} />
          <div className="skel mt-24" style={{ height: 8 }} />
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
        <Icon name="cloud" size={28} stroke={1.8} />
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
        <Icon name={icon} size={28} stroke={1.8} />
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
