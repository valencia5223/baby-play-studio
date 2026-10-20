import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 🎰 로또 탭: 동행복권은 브라우저에서 바로 부를 수 없어(CORS) 개발 서버가 /dh 로 대신 받아 준다
const dhProxy = {
  '/dh': {
    target: 'https://www.dhlottery.co.kr',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/dh/, ''),
    headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (baby-play-studio)' }
  }
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: dhProxy
  },
  preview: { proxy: dhProxy }
});
