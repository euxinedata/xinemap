import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

function gitInfo() {
  try {
    const commit = execSync('git rev-parse --short=7 HEAD').toString().trim()
    const date = execSync('git log -1 --format=%cI HEAD').toString().trim().split('T')[0]
    return { commit, date }
  } catch {
    return { commit: 'dev', date: '' }
  }
}

const { commit, date } = gitInfo()

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: {
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_COMMIT_DATE__: JSON.stringify(date),
  },
})
