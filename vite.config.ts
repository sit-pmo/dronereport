import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base : chemin du dépôt sur GitHub Pages (https://sit-pmo.github.io/dronereport/)
export default defineConfig({
  base: '/dronereport/',
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
})
