import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/** Vzdálenost (už po odporu), od které se gesto počítá jako „obnov". */
const TRIGGER = 60
const MAX = 96
/** Odpor: pás se posune o necelou polovinu toho, o co táhne prst. */
const DAMPING = 0.45

interface Props {
  /** Titulek obrazovky: velký úzký nápis nahoře. */
  title: ReactNode
  /** Tlačítka vpravo od titulku (u podřízené obrazovky v liště). */
  actions?: ReactNode
  /** Zpět nad titulkem, u podřízené obrazovky Zrušit v liště. */
  leading?: ReactNode
  /** Popisek verzálkami pod titulkem. */
  subtitle?: ReactNode
  /**
   * Popisek verzálkami nad titulkem, v jednom řádku s tlačítky. Pak je titulek
   * menší a je to tlačítko (Verdikt: výběr trasy).
   */
  eyebrow?: ReactNode
  /** Obsah vedle velkého titulku (vpravo). */
  titleAside?: ReactNode
  /** Podřízená obrazovka: lišta Zrušit — titulek — Uložit, bez velkého titulku. */
  compact?: boolean
  onRefresh?: () => void
  refreshing?: boolean
  children: ReactNode
}

/**
 * Obrazovka: velký úzký titulek, který odroluje s obsahem. Podřízená
 * obrazovka (editor) má místo něj pevnou lištu, ať jsou Zrušit a Uložit
 * pořád po ruce.
 *
 * Táhnutím dolů se stáhne nová předpověď. Posluchače si to věší ručně:
 * React dává touchmove pasivně a pasivní posluchač nesmí zrušit gumový
 * odskok iOS.
 */
export function Screen({
  title,
  actions,
  leading,
  subtitle,
  eyebrow,
  titleAside,
  compact = false,
  onRefresh,
  refreshing = false,
  children,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > (compact ? 2 : 36))
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [compact])

  useEffect(() => {
    const el = host.current
    if (!el || !onRefresh) return

    let startY = 0
    let active = false

    const start = (e: TouchEvent) => {
      // Mapa, posuvník a vodorovné pásy mají vlastní tažení — do těch se neplete.
      const target = e.target as Element | null
      if (target?.closest('.leaflet-container, input[type="range"], .days, .no-pull')) return
      if (el.scrollTop > 0) return
      active = true
      startY = e.touches[0].clientY
    }

    const move = (e: TouchEvent) => {
      if (!active) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || el.scrollTop > 0) {
        setPull(0)
        setDragging(false)
        return
      }
      e.preventDefault()
      setDragging(true)
      setPull(Math.min(MAX, dy * DAMPING))
    }

    const end = () => {
      if (!active) return
      active = false
      setDragging(false)
      setPull((distance) => {
        if (distance >= TRIGGER) onRefresh()
        return 0
      })
    }

    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [onRefresh])

  const armed = pull >= TRIGGER
  const pullHeight = refreshing && !dragging ? 44 : pull

  return (
    <div className="screen">
      {compact && (
        <header className="bar" data-scrolled={scrolled}>
          <div className="bar-side bar-side--start">{leading}</div>
          <div className="bar-title">{title}</div>
          <div className="bar-side bar-side--end">{actions}</div>
        </header>
      )}

      <div className="scroll" ref={host}>
        {onRefresh && (
          <div
            className="pull"
            data-armed={armed}
            style={{
              height: pullHeight,
              transition: dragging ? 'none' : 'height 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            aria-hidden="true"
          >
            {pullHeight > 18 &&
              (refreshing ? (
                <>
                  <Icon name="refresh" size={16} className="spin" />
                  Stahuju předpověď
                </>
              ) : (
                <>
                  <Icon name="arrowDown" size={16} />
                  {armed ? 'Pusť a stáhne se' : 'Táhni pro novou předpověď'}
                </>
              ))}
          </div>
        )}

        {!compact && (
          <header className="hd">
            {leading}
            {eyebrow !== undefined ? (
              <>
                <div className="hd-meta">
                  <div className="label truncate">{eyebrow}</div>
                  {actions && <div className="hd-actions">{actions}</div>}
                </div>
                <h1>{title}</h1>
              </>
            ) : (
              <>
                <div className="hd-row">
                  <h1 className="t-large">{title}</h1>
                  {(titleAside || actions) && (
                    <div className="hd-actions">
                      {titleAside}
                      {actions}
                    </div>
                  )}
                </div>
                {subtitle && <div className="label hd-sub">{subtitle}</div>}
              </>
            )}
          </header>
        )}
        {children}
      </div>
    </div>
  )
}
