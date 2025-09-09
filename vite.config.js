import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist'
  },
  server: {
    proxy: {
      // 카카오 API CORS 문제 해결을 위한 프록시 설정
      '/api/kakao': {
        target: 'https://dapi.kakao.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kakao/, '')
      }
    }
  }
})
