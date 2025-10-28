import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/sitemap.xml': {
        target: 'https://ycojglkexgpbrxcilkkm.supabase.co/functions/v1/generate-sitemap',
        changeOrigin: true,
        rewrite: () => '',
      },
    },
  },
});
