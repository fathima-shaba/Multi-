import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const proxy = { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001' }

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
