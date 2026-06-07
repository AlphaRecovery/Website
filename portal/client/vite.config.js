import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.PORTAL_APP_BASE || '/portal-app/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4180,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
});
