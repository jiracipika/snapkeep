import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        guideExport: fileURLToPath(
          new URL('./guide/how-to-export-snapchat-memories/index.html', import.meta.url),
        ),
        guideBackup: fileURLToPath(
          new URL('./guide/back-up-memories-before-deleting-snapchat/index.html', import.meta.url),
        ),
        guideMyData: fileURLToPath(
          new URL('./guide/snapchat-my-data-explained/index.html', import.meta.url),
        ),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
