import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@/types': resolve('src/types'),
        '@/utils': resolve('src/utils')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload'
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@/types': resolve('src/types'),
        '@/utils': resolve('src/utils')
      }
    },
    plugins: [react(), TanStackRouterVite()]
  }
})
