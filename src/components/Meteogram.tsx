import { useId } from 'react'
import { dayShort, deg } from '../lib/format'
import type { DayInfo, HourPoint } from '../lib/types'

/** Pixelů na hodinu: na telefon se vejdou zhruba tři dny, zbytek se odroluje. */
const PX = 4
const AXIS_W = 30

const DAY_Y = 12
const TEMP_TOP = 32
const TEMP_BOTTOM = 84
const CLOUD_TOP = 100
const CLOUD_BOTTOM = 192
const RAIN_TOP = 202
const RAIN_BOTTOM = 224
const WIND_TOP = 240
const WIND_BOTTOM = 284
const ARROW_Y = 297
const TIME_Y = 318
const HEIGHT = 322

/** Strop grafu oblačnosti. Nad deset kilometrů už nic, co by na túře hrálo roli. */
const CEIL_M = 10_000
/** Odmocninová osa: dole, kde se chodí, je víc místa než v cirrech. */
const altY = (m: number) =>
  CLOUD_BOTTOM - Math.sqrt(Math.max(0, Math.min(CEIL_M, m)) / CEIL_M) * (CLOUD_BOTTOM - CLOUD_TOP)
const ALT_TICKS = [1000, 3000, 6000, 9000]

/** Pod desetinu milimetru to není déšť, jen šum kvantilu. */
const WET = 0.1

/**
 * Meteogram vrcholu na celý výhled: teplota, oblačnost po výškách s čarou
 * vrcholu, srážky a vítr se směrem. Hodnoty jsou tytéž, ze kterých počítá
 * verdikt — vítr dorovnaný na hřeben, nárazy a srážky z nepříznivé strany
 * ansámblu — takže graf a skóre nikdy neřeknou dvě různé věci.
 */
export function Meteogram({ hours, days, elevation }: { hours: HourPoint[]; days: DayInfo[]; elevation: number }) {
  const gradientId = useId().replace(/:/g, '')
  const t0 = new Date()
  t0.setHours(0, 0, 0, 0)
  const series = hours.filter((h) => new Date(h.time).getTime() >= t0.getTime())
  if (series.length < 24) return null

  const W = series.length * PX
  const x = (i: number) => i * PX + PX / 2
  const xAt = (ms: number) => ((ms - t0.getTime()) / 3_600_000) * PX + PX / 2
  const line = (ys: number[]) => ys.map((y, i) => `${i ? 'L' : 'M'}${x(i)} ${y.toFixed(1)}`).join('')

  // Teplota: rozsah s rezervou na popisky nad maximem a pod minimem.
  const temps = series.map((h) => h.temperature)
  const tLo = Math.floor(Math.min(...temps)) - 1
  const tHi = Math.ceil(Math.max(...temps)) + 1
  const ty = (v: number) => TEMP_BOTTOM - ((v - tLo) / (tHi - tLo)) * (TEMP_BOTTOM - TEMP_TOP)
  const tStep = [1, 2, 5, 10].find((s) => (tHi - tLo) / s <= 3) ?? 10
  const tTicks: number[] = []
  for (let v = Math.ceil(tLo / tStep) * tStep; v <= tHi; v += tStep) tTicks.push(v)

  const rains = series.map((h) => h.precipitationRisk)
  const rMax = Math.max(2, Math.ceil(Math.max(...rains)))
  const gusts = series.map((h) => h.windGustsRisk)
  const wMax = Math.max(30, Math.ceil((Math.max(...gusts) * 1.1) / 10) * 10)
  const wy = (v: number) => WIND_BOTTOM - (v / wMax) * (WIND_BOTTOM - WIND_TOP)

  // Dny: hranice, popisek uprostřed, denní maximum a minimum teploty a nejsilnější náraz.
  const dayStarts = series.flatMap((h, i) => (h.time.endsWith('T00:00') ? [i] : []))
  const dayRanges = dayStarts.map((from, k) => ({ from, to: (dayStarts[k + 1] ?? series.length) - 1 }))
  const argBy = (from: number, to: number, val: (i: number) => number, better: (a: number, b: number) => boolean) => {
    let best = from
    for (let i = from + 1; i <= to; i++) if (better(val(i), val(best))) best = i
    return best
  }

  const daylight = days
    .map((d) => ({ from: xAt(new Date(d.sunrise).getTime()), to: xAt(new Date(d.sunset).getTime()) }))
    .filter((d) => Number.isFinite(d.from) && Number.isFinite(d.to) && d.to > 0 && d.from < W)

  const hasClouds = series.some((h) => (h.clouds?.length ?? 0) > 1)
  const summitY = altY(elevation)
  const nowX = xAt(Date.now())

  return (
    <div>
      <div className="meteo">
        <svg className="chart meteo-axis" width={AXIS_W} height={HEIGHT} aria-hidden="true">
          {tTicks.map((v) => (
            <text key={v} x={AXIS_W - 6} y={ty(v) + 4} textAnchor="end" className="axis">
              {deg(v)}
            </text>
          ))}
          {ALT_TICKS.filter((m) => Math.abs(altY(m) - summitY) > 10).map((m) => (
            <text key={m} x={AXIS_W - 6} y={altY(m) + 4} textAnchor="end" className="axis">
              {m / 1000} km
            </text>
          ))}
          <path
            d={`M${AXIS_W - 11} ${summitY + 4}L${AXIS_W - 6} ${summitY - 4}L${AXIS_W - 1} ${summitY + 4}Z`}
            fill="var(--ink)"
          />
          <text x={AXIS_W - 2} y={RAIN_TOP + 8} textAnchor="end" className="axis">
            {rMax} mm
          </text>
          <text x={AXIS_W - 6} y={wy(wMax) + 4} textAnchor="end" className="axis">
            {wMax}
          </text>
          <text x={AXIS_W - 6} y={wy(wMax / 2) + 4} textAnchor="end" className="axis">
            {wMax / 2}
          </text>
        </svg>

        <div className="meteo-scroll">
          <svg
            className="chart"
            width={W}
            height={HEIGHT}
            viewBox={`0 0 ${W} ${HEIGHT}`}
            role="img"
            aria-label="Meteogram vrcholu: teplota, oblačnost po výškách, srážky a vítr na celý výhled"
          >
            {daylight.map((d) => (
              <rect
                key={d.from}
                x={d.from}
                y={DAY_Y + 8}
                width={d.to - d.from}
                height={TIME_Y - DAY_Y - 18}
                fill="var(--daylight)"
              />
            ))}
            {dayStarts.map((i) => (
              <line key={i} x1={i * PX} x2={i * PX} y1={0} y2={TIME_Y - 10} className="grid" />
            ))}

            {dayRanges.map(({ from, to }) => {
              const date = new Date(series[from].time)
              const mid = ((from + to + 1) / 2) * PX
              const hi = argBy(from, to, (i) => temps[i], (a, b) => a > b)
              const lo = argBy(from, to, (i) => temps[i], (a, b) => a < b)
              const g = argBy(from, to, (i) => gusts[i], (a, b) => a > b)
              const gust = Math.round(gusts[g])
              const edge = (i: number) => Math.min(W - 12, Math.max(12, x(i)))
              return (
                <g key={from}>
                  {to - from >= 10 && (
                    <text x={mid} y={DAY_Y} textAnchor="middle" className="val" style={{ textTransform: 'uppercase' }}>
                      {dayShort(date).toUpperCase()}
                    </text>
                  )}
                  <text x={edge(hi)} y={ty(temps[hi]) - 5} textAnchor="middle" className="val-2">
                    {deg(temps[hi])}
                  </text>
                  {lo !== hi && (
                    <text x={edge(lo)} y={ty(temps[lo]) + 13} textAnchor="middle" className="val-2">
                      {deg(temps[lo])}
                    </text>
                  )}
                  <text
                    x={edge(g)}
                    y={wy(gusts[g]) - 5}
                    textAnchor="middle"
                    className="val-2"
                    style={gust >= 50 ? { fill: gust >= 70 ? 'var(--danger-icon)' : 'var(--warn-ink)' } : undefined}
                  >
                    {gust}
                  </text>
                </g>
              )
            })}

            {tLo < 0 && tHi > 0 && (
              <line x1={0} x2={W} y1={ty(0)} y2={ty(0)} stroke="var(--cold)" strokeDasharray="3 3" opacity="0.7" />
            )}
            <path d={line(temps.map(ty))} fill="none" stroke="var(--ink)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />

            {ALT_TICKS.map((m) => (
              <line key={m} x1={0} x2={W} y1={altY(m)} y2={altY(m)} className="grid" />
            ))}
            {hasClouds ? (
              // Mezi hladinami se plynule přechází. Ostré bloky by tvrdily hranu mraku
              // v půli cesty mezi 900 a 850 hPa — tedy v horách klidně na metr přesně
              // ve výšce vrcholu, o které ale data nic neříkají.
              <g>
                <defs>
                  {series.map((h, i) =>
                    (h.clouds?.length ?? 0) > 1 ? (
                      <linearGradient
                        key={i}
                        id={`${gradientId}${i}`}
                        gradientUnits="userSpaceOnUse"
                        x1="0"
                        x2="0"
                        y1={CLOUD_BOTTOM}
                        y2={CLOUD_TOP}
                      >
                        {h.clouds!.map((l) => (
                          <stop
                            key={l.height}
                            offset={(CLOUD_BOTTOM - altY(l.height)) / (CLOUD_BOTTOM - CLOUD_TOP)}
                            stopColor="var(--ink)"
                            stopOpacity={(0.6 * l.cover) / 100}
                          />
                        ))}
                      </linearGradient>
                    ) : null,
                  )}
                </defs>
                {series.map((h, i) =>
                  (h.clouds?.length ?? 0) > 1 ? (
                    <rect
                      key={i}
                      x={i * PX}
                      y={CLOUD_TOP}
                      width={PX}
                      height={CLOUD_BOTTOM - CLOUD_TOP}
                      fill={`url(#${gradientId}${i})`}
                    />
                  ) : null,
                )}
              </g>
            ) : (
              <text x={Math.min(W, 300) / 2} y={(CLOUD_TOP + CLOUD_BOTTOM) / 2} textAnchor="middle" className="axis">
                Oblačnost po výškách se ukáže po obnovení předpovědi.
              </text>
            )}
            <line x1={0} x2={W} y1={summitY} y2={summitY} stroke="var(--ink)" strokeWidth="1.25" strokeDasharray="4 4" />
            <text x={4} y={summitY - 5} className="axis" style={{ fontSize: 9.5, letterSpacing: '0.04em' }}>
              VÝŠKA VRCHOLU
            </text>

            {rains.map((r, i) => {
              if (r < WET) return null
              const h = Math.max(2, (r / rMax) * (RAIN_BOTTOM - RAIN_TOP))
              const snow = series[i].snowfallRisk > WET
              return (
                <rect
                  key={i}
                  x={i * PX + 0.5}
                  y={RAIN_BOTTOM - h}
                  width={PX - 1}
                  height={h}
                  fill={snow ? 'var(--cold)' : 'var(--rain)'}
                  opacity={0.35 + 0.65 * Math.min(1, series[i].precipitationProbability / 100)}
                />
              )
            })}
            <line x1={0} x2={W} y1={RAIN_BOTTOM} y2={RAIN_BOTTOM} className="grid" />

            <path
              d={`${line(series.map((h) => wy(h.windSpeed)))}L${x(series.length - 1)} ${WIND_BOTTOM}L${x(0)} ${WIND_BOTTOM}Z`}
              fill="var(--sunk)"
            />
            <path d={line(gusts.map(wy))} fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinejoin="round" />
            <line x1={0} x2={W} y1={WIND_BOTTOM} y2={WIND_BOTTOM} className="grid" />

            {series.map((h, i) =>
              i % 3 === 1 ? (
                // Šipka míří tam, kam vítr fouká: od severu dolů.
                <path
                  key={i}
                  d="M0 -5L0 5M-3 1.5L0 5L3 1.5"
                  transform={`translate(${x(i)} ${ARROW_Y}) rotate(${Math.round(h.windDirection)})`}
                  fill="none"
                  stroke="var(--ink-3)"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null,
            )}

            {series.map((h, i) => {
              const hour = Number(h.time.slice(11, 13))
              return hour % 6 === 0 && hour !== 0 ? (
                <text key={i} x={x(i)} y={TIME_Y} textAnchor="middle" className="axis">
                  {hour}
                </text>
              ) : null
            })}

            {nowX > 0 && nowX < W && (
              <g>
                <line x1={nowX} x2={nowX} y1={DAY_Y + 8} y2={TIME_Y - 10} stroke="var(--ink)" strokeWidth="1" />
                <rect x={Math.max(0, nowX - 14.5)} y={DAY_Y + 8} width="29" height="14" rx="4" fill="var(--ink)" />
                <text x={Math.max(14.5, nowX)} y={DAY_Y + 18} textAnchor="middle" style={{ fill: 'var(--go)', fontSize: 9, fontWeight: 600 }}>
                  TEĎ
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
      <div className="legend">
        <span>
          <i className="line" style={{ background: 'var(--ink)' }} />
          teplota
        </span>
        <span>
          <i style={{ background: 'var(--ink-3)', opacity: 0.6 }} />
          oblačnost
        </span>
        <span>
          <i style={{ background: 'var(--rain)' }} />
          srážky mm/h
        </span>
        <span>
          <i className="line" style={{ background: 'var(--ink-3)', height: 2 }} />
          nárazy km/h
        </span>
        <span>
          <i style={{ background: 'var(--daylight)', boxShadow: 'inset 0 0 0 1px #f1d58e' }} />
          světlo
        </span>
      </div>
    </div>
  )
}
