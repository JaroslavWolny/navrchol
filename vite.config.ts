import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function buildId(): string {
  const date = new Date().toISOString().slice(0, 10)
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim()
    return `${date}.${sha}`
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
