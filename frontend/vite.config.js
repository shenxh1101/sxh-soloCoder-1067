import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 配置文件
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 配置代理，解决跨域问题
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  }
})
