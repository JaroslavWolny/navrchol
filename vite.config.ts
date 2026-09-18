import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
  },
})
