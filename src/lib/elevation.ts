const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation'
/** Kolik souřadnic Open-Meteo snese v jednom dotazu. */
const BATCH = 100

/**
 * Nadmořské výšky z digitálního modelu terénu (Copernicus 90 m) po dávkách.
 * Null, když cokoliv selže — volající pak musí umět jet bez nich.
 */
export async function lookupElevations(
  points: Array<{ lat: number; lon: number }>,
  signal?: AbortSignal,
): Promise<number[] | null> {
  const out: number[] = []
  try {
    for (let i = 0; i < points.length; i += BATCH) {
      const chunk = points.slice(i, i + BATCH)
      const url =
        `${ELEVATION_URL}?latitude=${chunk.map((p) => p.lat.toFixed(5)).join(',')}` +
        `&longitude=${chunk.map((p) => p.lon.toFixed(5)).join(',')}`
      const res = await fetch(url, { signal })
      if (!res.ok) return null
      const data = (await res.json()) as { elevation?: number[] }
      if (!data.elevation || data.elevation.length !== chunk.length) return null
      out.push(...data.elevation)
    }
  } catch {
    return null
  }
  return out
}

/** Výška jednoho bodu. Nula, když se nedá zjistit — bod se pak dá opravit ručně. */
export async function lookupElevation(lat: number, lon: number, signal?: AbortSignal): Promise<number> {
  const r = await lookupElevations([{ lat, lon }], signal)
  return Math.round(r?.[0] ?? 0)
}
