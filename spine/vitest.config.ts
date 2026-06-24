import { defineConfig } from 'vitest/config';
import path from 'path';

// Integration tests run against a real Postgres (the bugs we care about — the
// enrollment race, the answer-field leak — only show up against a real database
// with real constraints). Point DATABASE_URL at a throwaway test database.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    globals: true,
    // DB-backed tests share one database; run files serially so they don't
    // stomp on each other's fixtures.
    fileParallelism: false,
    globalSetup: './tests/setup/global-setup.ts',
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        'postgres://postgres:test@localhost:5432/avitam_test',
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'test',
    },
  },
});
