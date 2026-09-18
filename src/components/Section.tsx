import type { ReactNode } from 'react'

interface Props {
  label: string
  /** Doplňkový údaj vpravo v hlavičce — počet, jednotka, rozsah. */
  meta?: ReactNode
  tight?: boolean
  children: ReactNode
}

/**
 * Sekce datového listu: popiska veličiny, vlasová linka přes celou šířku
 * sazebního zrcadla, obsah. Nic víc — oddělovat obsah kartou by z appky
 * udělalo nástěnku s lístečky.
 */
export function Section({ label, meta, tight, children }: Props) {
  return (
    <section className={tight ? 'sec sec--tight' : 'sec'}>
      <div className="sec-hd">
        <h2 className="label">{label}</h2>
        {meta !== undefined && <span className="meta">{meta}</span>}
      </div>
      {children}
    </section>
  )
}
