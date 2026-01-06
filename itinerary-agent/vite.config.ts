import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,  // listen on all interfaces, required for Docker
    port: 3000,  // container port
    proxy: {
      '/api': {
        target: 'http://itinerary-agent-backend:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
})
