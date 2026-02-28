import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"

import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { resolve } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ 
      autoCodeSplitting: true,
      routeFileIgnorePattern: ".stories.tsx|.model.ts|.test.ts|__tests__",
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
