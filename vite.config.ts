import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

/**
 * Identifikace buildu do „O appce", aby šlo hlášení od testera dohledat ke commitu.
 * Na Vercelu není `git rev-parse` k dispozici, ale SHA podstrkuje v proměnné prostředí.
 */
function buildId(): string {
  const date = new Date().toISOString().slice(0, 10)

  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  if (fromCi) return `${date}.${fromCi}`

  try {
    return `${date}.${execSync('git rev-parse --short HEAD').toString().trim()}`
  } catch {
    return date
  }
}

/**
 * Malý soubor s číslem verze, který appka umí stáhnout mimo jakoukoliv cache.
 * Bez něj se na iOS nepozná, že běží stará verze: appka přidaná na plochu má
 * vlastní úložiště a sama od sebe se neaktualizuje.
 */
function emitVersion(id: string): Plugin {
  return {
    name: 'navrchol-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: id }),
      })
    },
  }
}

const id = buildId()

export default defineConfig({
  plugins: [react(), emitVersion(id)],
  define: {
    __BUILD_ID__: JSON.stringify(id),
  },
})
