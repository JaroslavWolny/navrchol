import { Icon } from '../components/Icon'
import { Logo } from '../components/ui'

interface Props {
  onDemo: () => void
  onOwn: () => void
}

const POINTS = [
  {
    title: 'Verdikt pro celou trasu',
    text: 'Počasí v každém místě trati, v hodinu, kdy tam podle tvého tempa budeš.',
  },
  {
    title: 'Kdy vyrazit',
    text: 'Projde každou hodinu startu na týden dopředu a najde nejlepší okno.',
  },
  {
    title: 'Tvoje trasy',
    text: 'Naklikej body na mapě, nebo nahraj GPX z Mapy.cz, Komootu či hodinek.',
  },
]

/** Vrstevnice s tečkovanou cestou na vrchol — ilustrace, ne mapa. */
const CONTOUR = 'M283 260 272 251 259 249 246 252 231 260 M355 0 374 9 390 15 M74 260 20 240 9 234 4 227 2 221 3 214 13 178 15 158 11 135 0 110 M314 260 305 239 298 230 288 223 272 219 256 221 239 227 222 237 192 260 M390 153 367 172 357 177 344 182 324 185 272 189 249 193 226 201 184 219 170 223 154 223 141 219 125 209 106 191 64 135 26 92 11 69 7 56 6 46 7 36 10 26 16 17 25 10 36 4 48 0 M365 260 360 247 361 240 364 233 369 227 374 224 380 222 390 222 M273 0 305 14 345 36 375 56 390 70 M390 129 379 142 364 154 347 163 331 169 311 174 245 184 190 201 177 204 161 204 144 199 132 191 121 181 79 127 36 85 24 66 20 49 22 36 26 28 34 20 46 12 59 8 72 6 136 0 M184 3 223 2 256 6 292 19 334 40 361 59 371 69 378 79 382 89 384 99 382 112 377 122 367 135 351 148 334 156 311 164 243 176 184 189 164 189 154 186 144 181 125 165 88 118 45 76 36 59 35 49 35 43 40 33 47 26 56 21 69 17 184 3Z M177 23 213 21 246 23 279 32 308 44 334 62 342 69 349 79 354 89 355 99 354 109 351 115 341 128 328 138 311 145 288 152 220 164 193 167 174 166 157 160 144 150 130 135 105 99 81 69 76 59 75 53 79 46 82 43 95 37 177 23Z M203 29 233 30 262 35 288 44 312 56 329 69 334 76 340 86 342 95 342 102 337 115 328 126 311 136 292 143 269 149 223 156 197 158 177 156 159 148 151 142 141 132 126 109 108 76 106 66 107 59 111 53 117 49 134 42 170 33 203 29Z M193 39 220 38 246 40 272 46 295 55 315 69 326 82 330 95 327 109 320 118 307 128 292 135 272 141 239 146 206 149 187 147 170 142 154 130 141 112 131 89 129 72 133 63 146 53 167 44 193 39Z M213 56 233 56 252 58 269 63 283 69 292 76 300 86 302 95 300 105 294 112 282 120 269 125 252 128 229 131 210 131 195 128 184 124 172 115 164 102 162 89 164 79 170 71 180 64 193 59 213 56Z M226 66 252 69 272 76 279 82 284 89 285 95 283 102 277 109 269 113 256 118 243 120 226 121 213 120 203 118 193 114 187 109 181 99 180 89 183 82 189 76 200 70 213 67 226 66Z M223 82 236 81 249 84 256 89 258 95 256 99 251 102 241 105 226 106 216 104 209 99 208 92 213 86 223 82Z'
const CONTOUR_B = 'M327 0 357 18 390 33 M338 260 333 247 330 224 327 214 318 206 298 202 272 202 244 207 221 217 184 239 164 246 154 248 144 247 125 240 102 223 78 197 67 181 44 142 11 95 0 76 M184 13 220 11 252 16 288 27 322 43 347 61 356 69 363 79 367 89 369 99 368 109 363 118 353 132 340 142 321 151 302 157 190 177 170 177 161 174 151 170 141 163 131 153 95 107 61 72 53 59 52 53 53 46 56 39 62 33 79 26 184 13Z M190 49 213 46 236 47 259 51 282 58 298 68 310 79 316 92 317 99 315 105 308 115 298 123 285 129 265 134 239 138 213 140 193 139 180 135 167 127 156 115 148 99 146 82 149 72 157 63 170 55 190 49Z'
const ROUTE = 'M26 262C32 258 47 243 60 236C73 229 91 229 104 222C117 215 128 202 140 196C152 190 165 193 176 186C187 179 197 165 206 156C215 147 224 139 232 132C240 125 246 118 252 112C258 106 265 99 268 96'

export function UvodScreen({ onDemo, onOwn }: Props) {
  return (
    <div className="app">
      <div className="scroll" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 26 }}>
        <div className="between" style={{ padding: '14px 24px 0' }}>
          <div className="row" style={{ gap: 10 }}>
            <Logo />
            <span style={{ fontSize: 21, fontWeight: 800, fontStretch: '78%', letterSpacing: '-0.01em' }}>NaVrchol</span>
          </div>
          <span className="label">Počasí na túru</span>
        </div>

        <div style={{ position: 'relative', height: 196, marginTop: 10, flexShrink: 0 }}>
          <svg width="100%" height="196" viewBox="0 32 390 196" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: 'block' }}>
            <path d={CONTOUR} fill="none" stroke="rgba(14,18,16,0.16)" strokeWidth="1" strokeLinejoin="round" />
            <path d={CONTOUR_B} fill="none" stroke="rgba(14,18,16,0.34)" strokeWidth="1.25" strokeLinejoin="round" />
            <path d={ROUTE} fill="none" stroke="var(--bg)" strokeWidth="7" strokeLinecap="round" />
            <path d={ROUTE} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.1 6" />
            <path d="M268 84 279 102 257 102Z" fill="var(--ink)" stroke="var(--bg)" strokeWidth="2" strokeLinejoin="round" />
            <text x="286" y="88" fontFamily="var(--mono)" fontSize="10" letterSpacing="0.6" fill="var(--ink)">
              ČERVENÁ HORA
            </text>
            <text x="286" y="101" fontFamily="var(--mono)" fontSize="10" letterSpacing="0.6" fill="var(--ink-3)">
              1 333 M N. M.
            </text>
          </svg>
          <div className="sticker" aria-hidden="true">
            <b>JDI</b>
            <span>
              <span>ZÍTRA 15:00</span>
              <span>
                100<i>/100</i>
              </span>
            </span>
          </div>
        </div>

        <h1 style={{ padding: '14px 24px 0', fontSize: 48, lineHeight: 1, fontWeight: 800, fontStretch: '70%', letterSpacing: '-0.015em', textWrap: 'balance' }}>
          Počasí na túru, které řekne, jestli <span className="hilite">jít.</span>
        </h1>

        <ol className="points">
          {POINTS.map((p, i) => (
            <li key={p.title}>
              <span className="label">{String(i + 1).padStart(2, '0')}</span>
              <span className="stack" style={{ gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 650 }}>{p.title}</span>
                <span className="t-foot muted">{p.text}</span>
              </span>
            </li>
          ))}
        </ol>

        <div style={{ flex: 1, minHeight: 28 }} />

        <div className="stack" style={{ gap: 10, padding: '0 24px' }}>
          <button className="btn btn--arrow" onClick={onDemo}>
            <span>Vyzkoušet na Sněžce</span>
            <span className="btn-arrow" aria-hidden="true">
              <Icon name="arrowRight" size={20} stroke={2.2} />
            </span>
          </button>
          <button className="btn btn--gray" onClick={onOwn} style={{ minHeight: 52 }}>
            Zadat vlastní trasu
          </button>
          <p className="t-cap faint" style={{ marginTop: 6, textAlign: 'center', fontSize: 12 }}>
            Bez účtu a bez sledování. Trasy zůstávají v&nbsp;tomhle telefonu.
          </p>
        </div>
      </div>
    </div>
  )
}
