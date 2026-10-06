import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(clientRoot, '..');

export default defineConfig({
  plugins: [react()],
   resolve: {
    alias: { '@': path.resolve(clientRoot, './src') },
  },
  server: {
    port: 5173,
    
    /* /shared holds the item rules the API and this app must agree on, so the dev
       server may serve files from the repository root, not only from /client. */
    fs: { allow: [repoRoot] },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
