import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Leaflet/react-leaflet ne sont utilisés que par 3 pages sur 10 (carte publique,
        // zones admin/ANASER) : les isoler dans leur propre chunk évite de les faire
        // télécharger à un visiteur qui ne consulte jamais la carte, et améliore le cache
        // inter-déploiement (ce chunk ne change presque jamais).
        manualChunks(id) {
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
            return 'leaflet'
          }
        },
      },
    },
  },
})
