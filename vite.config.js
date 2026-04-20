import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['cityvoid.patricklmbn.online'],
    port: 5111,
    hmr: {
      host: 'cityvoid.patricklmbn.online',
      protocol: 'wss',
      clientPort: 443
    }
  }
})
