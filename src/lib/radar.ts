const INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json'

export interface RadarFrame {
  at: Date
  path: string
}

export interface RadarData {
  host: string
  frames: RadarFrame[]
}

interface RainViewerIndex {
  host: string
  radar?: {
    past?: Array<{ time: number; path: string }>
    nowcast?: Array<{ time: number; path: string }>
  }
}

/**
 * Snímky srážkového radaru za poslední dvě hodiny, případně i krátká predikce.
 * Zdarma a bez klíče; když služba nepojede, vrátí se prázdno a appka radar
 * prostě neukáže — je to doplněk, ne nosná funkce.
 */
export async function fetchRadar(signal?: AbortSignal): Promise<RadarData> {
  const res = await fetch(INDEX_URL, { signal })
  if (!res.ok) throw new Error('Radar se nepodařilo načíst.')

  const data = (await res.json()) as RainViewerIndex
  const raw = [...(data.radar?.past ?? []), ...(data.radar?.nowcast ?? [])]
  return {
    host: data.host,
    frames: raw.map((f) => ({ at: new Date(f.time * 1000), path: f.path })),
  }
}

/** Šablona dlaždice pro Leaflet. Barevné schéma 4 je čitelné i nad světlou topo mapou. */
export function radarTemplate(host: string, path: string): string {
  return `${host}${path}/256/{z}/{x}/{y}/4/1_1.png`
}
