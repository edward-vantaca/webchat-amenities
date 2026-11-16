/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

// The app picks its page from the path (src/main.tsx), so a static host needs a file at
// /booking-link too, or it returns 404 before the app loads.
const bookingLinkPage = (): Plugin => ({
  name: 'booking-link-page',
  apply: 'build',
  writeBundle({ dir }) {
    if (!dir) return
    fs.mkdirSync(path.join(dir, 'booking-link'), { recursive: true })
    fs.copyFileSync(path.join(dir, 'index.html'), path.join(dir, 'booking-link', 'index.html'))
  },
})

// Vite config — https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), bookingLinkPage()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
