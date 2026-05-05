import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 8099, open: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-icons')) return 'icons'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('@tanstack') || id.includes('dexie') || id.includes('zustand')) return 'data'
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'react'
          return 'vendor'
        }
      }
    }
  }
})
