import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/check_compliance': 'http://localhost:8000',
      '/api':              'http://localhost:8000',
      '/health':           'http://localhost:8000',
    },
  },
  build: {
    outDir: '../frontend/dist',
    emptyOutDir: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':  ['react', 'react-dom'],
          'pdf-renderer':  ['@react-pdf/renderer'],
          'map-vendor':    ['d3', 'topojson-client'],
          'motion-vendor': ['framer-motion'],
        },
      },
    },
  },
})
