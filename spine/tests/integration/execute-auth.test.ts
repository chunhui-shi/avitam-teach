import { describe, it, expect, beforeEach } from 'vitest';
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

describe('POST /api/execute', () => {
  it('returns 401 without a session', async () => {
    const res = await executePOST(
      makeRequest({ body: { code: 'console.log(1)' } })
    );
    expect(res.status).toBe(401);
  });

  it('runs a harmless snippet for an authenticated user', async () => {
    const user = await createUser();
    setCookie(
      'avitam_session',
      signToken({ userId: user.id, email: user.email })
    );

    const res = await executePOST(
      makeRequest({
        body: { code: 'console.log("hello from test")' },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // The route shape is: { output: string[], errors, runtimeError, result }
    expect(json.output).toContain('hello from test');
    expect(json.runtimeError).toBeNull();
  });
});
