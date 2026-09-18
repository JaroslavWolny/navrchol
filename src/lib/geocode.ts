export interface Place {
  name: string
  lat: number
  lon: number
  elevation: number
  /** "Krkonoše, Královéhradecký" — aby šly rozlišit dvě stejně pojmenované hory. */
  context: string
}

/**
 * Hledání místa. Open-Meteo vrací víc stejnojmenných vrcholů (Sněžka je v Česku dvakrát),
 * proto se u každého výsledku ukazuje výška i kraj — bez toho si vybereš špatnou horu.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=cs&format=json`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Vyhledávání selhalo.')

  const data = (await res.json()) as {
    results?: Array<{
      name: string
      latitude: number
      longitude: number
      elevation?: number
      country?: string
      admin1?: string
      admin2?: string
    }>
  }

  return (data.results ?? []).map((r) => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    elevation: Math.round(r.elevation ?? 0),
    context: [r.admin1 ?? r.admin2, r.country].filter(Boolean).join(', '),
  }))
}

/** Nadmořská výška bodu naťukaného na mapě. */
export async function lookupElevation(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<number> {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}`
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return 0
    const data = (await res.json()) as { elevation?: number[] }
    return Math.round(data.elevation?.[0] ?? 0)
  } catch {
    return 0
  }
}
