import { useEffect, useState } from 'react'

interface Rozmery {
  okno: string
  obrazovka: string
  ram: string
  zonaNahore: string
  zonaDole: string
  rezim: string
  diraPodRamem: string
  chybiOknu: string
}

/** Přečte bezpečné zóny tak, jak je vidí prohlížeč — spočítat se nedají. */
function zmer(): Rozmery {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;' +
    'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const nahore = cs.paddingTop
  const dole = cs.paddingBottom
  probe.remove()

  const app = document.querySelector('.app')?.getBoundingClientRect()
  const standalone = window.matchMedia('(display-mode: standalone)').matches

  return {
    okno: `${window.innerWidth} × ${window.innerHeight}`,
    obrazovka: `${window.screen.width} × ${window.screen.height}`,
    ram: app ? `${Math.round(app.top)} → ${Math.round(app.bottom)} (${Math.round(app.height)})` : '—',
    zonaNahore: nahore,
    zonaDole: dole,
    rezim: standalone ? 'na ploše' : 'v prohlížeči',
    diraPodRamem: app ? `${Math.round(window.innerHeight - app.bottom)} px` : '—',
    chybiOknu: `${Math.round(Math.max(window.screen.width, window.screen.height) - window.innerHeight)} px`,
  }
}

/**
 * Skutečné rozměry z konkrétního telefonu. Bez nich se rozbitý rám na iOS
 * hádá naslepo — každý model má jiné bezpečné zóny a jinak se chová na ploše
 * než v prohlížeči.
 */
export function Diagnostika() {
  const [r, setR] = useState<Rozmery | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setR(zmer()), 120)
    return () => clearTimeout(t)
  }, [])

  if (!r) return null

  const radky: Array<[string, string]> = [
    ['režim', r.rezim],
    ['okno', r.okno],
    ['obrazovka', r.obrazovka],
    ['zóna nahoře', r.zonaNahore],
    ['zóna dole', r.zonaDole],
    ['oknu chybí', r.chybiOknu],
    ['rám appky', r.ram],
    ['díra pod rámem', r.diraPodRamem],
  ]

  return (
    <>
      {radky.map(([k, v]) => {
        // Nenulová díra pod rámem je jediná hodnota, která znamená rozbité okno.
        const spatne = k === 'díra pod rámem' && !v.startsWith('0 ')
        return (
          <div className="cell" key={k} style={{ minHeight: 36 }}>
            <span className="t-sub muted grow">{k}</span>
            <span className="t-sub num" style={{ color: spatne ? 'var(--stop)' : 'var(--ink)', fontWeight: 500 }}>
              {v}
            </span>
          </div>
        )
      })}
    </>
  )
}
