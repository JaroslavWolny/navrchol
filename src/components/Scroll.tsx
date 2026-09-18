import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/** Vzdálenost (už po odporu), od které se gesto počítá jako „obnov". */
const TRIGGER = 52
const MAX = 84
/** Odpor: pás se posune o necelou polovinu toho, o co táhne prst. */
const DAMPING = 0.45

interface Props {
  /** Bez obsluhy je to obyčejná rolovací plocha. */
  onRefresh?: () => void
  /** Stahování běží — drží pás vytažený, dokud data nedorazí. */
  refreshing?: boolean
  children: ReactNode
}

/**
 * Rolovací plocha, kterou jde stáhnout dolů pro nová data.
 *
 * Předpověď stará třicet minut vypadá stejně jako čerstvá, takže appka musí
 * mít způsob, jak si říct o novou. Táhnutí je na to na telefonu jediné gesto,
 * které nikdo nemusí hledat.
 *
 * Posluchače si věší ručně: React dává touchmove pasivně, a pasivní posluchač
 * nesmí zrušit gumový odskok iOS.
 */
export function Scroll({ onRefresh, refreshing = false, children }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el || !onRefresh) return

    let startY = 0
    let active = false

    const start = (e: TouchEvent) => {
      // Mapa a posuvník mají vlastní tažení — do těch se neplete.
      const target = e.target as Element | null
      if (target?.closest('.leaflet-container, input[type="range"]')) return
      if (el.scrollTop > 0) return
      active = true
      startY = e.touches[0].clientY
    }

    const move = (e: TouchEvent) => {
      if (!active) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) {
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
  const height = refreshing && !dragging ? 40 : pull

  return (
    <div className="scroll" ref={host}>
      {onRefresh && (
        <div
          className="pull"
          data-armed={armed}
          data-busy={refreshing}
          style={{ height, transition: dragging ? 'none' : 'height 220ms cubic-bezier(0.22,0.61,0.36,1)' }}
          aria-hidden="true"
        >
          {height > 16 && (
            <>
              <Icon name={refreshing ? 'refresh' : 'arrowDown'} size={13} stroke={2} />
              {refreshing ? 'stahuju' : armed ? 'pusť a stáhne se' : 'táhni pro nová data'}
            </>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
