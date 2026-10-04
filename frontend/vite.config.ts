import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      watch: { usePolling: true },
      proxy: {
        '/sanctum': {
          target: env.API_PROXY_TARGET || 'http://backend:8000',
          changeOrigin: true,
          proxyTimeout: 120000,
          timeout: 120000,
        },
        '/api': {
          target: env.API_PROXY_TARGET || 'http://backend:8000',
          changeOrigin: true,
          proxyTimeout: 120000,
          timeout: 120000,
        },
      },
    },
  }
})
