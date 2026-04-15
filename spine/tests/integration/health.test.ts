import { describe, it, expect } from 'vitest';

import { GET as healthGET } from '@/app/api/health/route';
import pkg from '../../package.json';

/**
 * v2-deployed: /api/health liveness probe.
 *
 * Asserts the shape (status, version, timestamp) and that the status is 200.
 * This endpoint has no auth and no DB dependency, so no test DB harness is
 * required.
 */
describe('GET /api/health', () => {
  it('returns 200 with status, version, timestamp', async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe((pkg as { version: string }).version);
    expect(typeof body.timestamp).toBe('string');
    // Parse the ISO timestamp to make sure it's valid.
    expect(Number.isFinite(Date.parse(body.timestamp))).toBe(true);
  });
});
