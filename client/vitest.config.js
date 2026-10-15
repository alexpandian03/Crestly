import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(clientRoot, '..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(clientRoot, './src'),
    },
  },
  server: {
    fs: { allow: [repoRoot] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    testTimeout: 30000,
  },
});
