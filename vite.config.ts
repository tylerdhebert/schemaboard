import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const SERVER_PORT = process.env.SERVER_PORT ?? '3777'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['d3-force', 'elkjs/lib/elk.bundled.js'],
  },
})
