import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Šířka prvku v pixelech. Grafy se kreslí přesně do ní, ne škálováním
 * pevného viewBoxu — jinak by se text a vlasové čáry na každém telefonu
 * vykreslily v jiné velikosti.
 */
export function useWidth<T extends HTMLElement>(fallback = 329) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(Math.max(200, Math.round(el.getBoundingClientRect().width)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}
