import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    exclude: ['client/**', 'node_modules/**', '.backups/**'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
