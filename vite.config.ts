import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/kgapi': {
            target: 'http://localhost:8080',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/kgapi/, ''),
          }
        }
      },
      plugins: [react()],
      define: {
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
