import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base : chemin du dépôt sur GitHub Pages (https://sit-pmo.github.io/dronereport-collectivite/)
export default defineConfig({
  base: '/dronereport-collectivite/',
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
})
