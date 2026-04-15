import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  installCookieMock,
  clearCookies,
  setCookie,
} from '../helpers/mock-next-cookies';

installCookieMock();

import { useTestDb } from '../helpers/db-setup';
import { makeRequest } from '../helpers/request';
import { createUser } from '../helpers/fixtures';

import { POST as executePOST } from '@/app/api/execute/route';
import { signToken } from '@/lib/auth';

useTestDb();

beforeEach(() => {
  clearCookies();
});

/**
 * v1 KNOWN ISSUE #2 — vm sandbox escape. TEACHING CENTERPIECE OF CHAPTER 6.
 *
 * src/app/api/execute/route.ts uses vm.runInNewContext(code, sandbox) with a
 * console shim as the "sandbox". vm.runInNewContext does NOT isolate the
 * prototype chain, so user code can walk up via
 *
 *     this.constructor.constructor('return process.env.SOMETHING')()
 *
 * and read any environment variable — including secrets — from the Node
 * process running the route.
 *
 * This test plants a unique marker in process.env, submits an attack string
 * to the execute route as an authenticated user, and asserts the marker
 * does NOT appear in the response. On the v1 codebase the marker DOES appear,
 * so the test FAILS.
 *
 * Fixing this requires architectural change (move user-code execution out
 * of the Node process entirely: ephemeral container, nsjail, or a service).
 * That is beyond Chapter 6's scope, so this test is EXPECTED TO STAY FAILING
 * through v1-tested and v2-deployed. It goes green in v3-secured.
 */
describe('execute route — vm sandbox escape', () => {
  const marker = 'PWNED_BY_TEST_' + crypto.randomUUID();
  const envKey = 'TEST_SECRET_MARKER';

  beforeEach(() => {
    process.env[envKey] = marker;
  });

  it('does not leak process.env through prototype-chain escape', async () => {
    const user = await createUser();
    setCookie(
      'avitam_session',
      signToken({ userId: user.id, email: user.email })
    );

    const attack = "this.constructor.constructor('return process.env." + envKey + "')()";

    const res = await executePOST(makeRequest({ body: { code: attack } }));
    expect(res.status).toBe(200);
    const body = await res.text();

    expect(
      body,
      'v1-tested: /api/execute vm sandbox escape demonstrated. An ' +
        'authenticated attacker can read any process env var via prototype-' +
        'chain traversal on vm.runInNewContext. Fix scheduled for v3-secured: ' +
        'move execution out of process (container/service). This test stays ' +
        'failing through v1 and v2 as an active known-broken state.'
    ).not.toContain(marker);
  });
});
