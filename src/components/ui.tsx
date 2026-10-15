import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import { vlna } from '../lib/format'

/** Sekce: nadpis, obsah, případně poznámka pod ním. */
export function Section({
  title,
  aside,
  footer,
  children,
  style,
}: {
  title?: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <section className="section" style={style}>
      {(title || aside) && (
        <div className="section-hd">
          {title && <h2>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
      {footer && <p className="section-ft">{typeof footer === 'string' ? vlna(footer) : footer}</p>}
    </section>
  )
}

interface CellProps {
  icon?: IconName
  tone?: string
  title: ReactNode
  sub?: ReactNode
  value?: ReactNode
  chevron?: boolean
  onClick?: () => void
  children?: ReactNode
  style?: CSSProperties
  ariaLabel?: string
}

/** Řádek seskupeného seznamu. Se `onClick` je to tlačítko přes celou šířku. */
export function Cell({ icon, tone, title, sub, value, chevron, onClick, children, style, ariaLabel }: CellProps) {
  const body = (
    <>
      {icon && (
        <span className="cell-icon" data-tone={tone}>
          <Icon name={icon} size={20} stroke={1.9} />
        </span>
      )}
      <div className="cell-main">
        <div className="cell-title">{title}</div>
        {sub && <div className="cell-sub">{typeof sub === 'string' ? vlna(sub) : sub}</div>}
      </div>
      {value !== undefined && <div className="cell-value">{value}</div>}
      {children}
      {chevron && <Icon name="chevron" size={16} stroke={2.2} className="cell-chev" />}
    </>
  )
  return onClick ? (
    <button className="cell cell--tap" onClick={onClick} style={style} aria-label={ariaLabel}>
      {body}
    </button>
  ) : (
    <div className="cell" style={style}>
      {body}
    </div>
  )
}

/** Spodní panel přes obrazovku. Vykresluje se do body, mimo rolovací plochy. */
export function Sheet({
  open,
  title,
  onClose,
  children,
  action,
}: {
  open: boolean
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  action?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grab" />
        {(title || action) && (
          <div className="sheet-hd">
            <div className="t-headline">{title}</div>
            {action ?? (
              <button className="icon-btn icon-btn--filled" onClick={onClose} aria-label="Zavřít">
                <Icon name="close" size={16} stroke={2.2} />
              </button>
            )}
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  )
}

/** Logo: turistická značka — pruhy bílá, limetková, bílá na černém čtverci. */
export function Logo({ size = 26 }: { size?: number }) {
  const k = size / 26
  return (
    <span
      className="logo"
      aria-hidden="true"
      style={k === 1 ? undefined : { width: size, height: size, padding: `${5 * k}px ${4 * k}px`, borderRadius: 7 * k, gap: 2 * k }}
    >
      <i style={k === 1 ? undefined : { height: 4 * k }} />
      <i style={k === 1 ? undefined : { height: 6 * k }} />
      <i style={k === 1 ? undefined : { height: 4 * k }} />
    </span>
  )
}

/** Přepínač jako na iOS. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  )
}

/** Segmentový přepínač. Čísla (minuty pauzy) jdou v monospace. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  mono = false,
}: {
  value: T
  options: Array<{ id: T; label: ReactNode }>
  onChange: (v: T) => void
  label: string
  mono?: boolean
}) {
  return (
    <div className={mono ? 'seg seg--mono' : 'seg'} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
