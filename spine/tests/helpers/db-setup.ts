import { beforeAll, beforeEach, afterAll } from 'vitest';
import { initSchema, truncateAll, closeTestDb } from './test-db';

/**
 * Integration-test helper. Call at top level of a test file to:
 *   - create the schema once per file
 *   - wipe all rows before each test
 *   - close the pg client after the file finishes
 *
 * We don't drop the DB — the test DB `avitam_teach_v1_test` is created once
 * out-of-band (see tests/README implicit) and reused across runs.
 */
export function useTestDb() {
  beforeAll(async () => {
    await initSchema();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeTestDb();
  });
}
