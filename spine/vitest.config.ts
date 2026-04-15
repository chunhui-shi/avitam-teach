import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Avoid DB races: run test files sequentially, one at a time.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    setupFiles: ['tests/helpers/setup-env.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    teardownTimeout: 5000,
  },
});
